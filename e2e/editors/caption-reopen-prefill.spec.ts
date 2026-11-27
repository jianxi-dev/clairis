import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1603 八轮真机：描述保存 → 切预览 → 切回编辑 → 再点「添加描述」，
 * 输入框必须**预填已保存的描述**（真机曾清空）。同时断言保存后输入框
 * 已收尾移除、描述行显示文字、按钮选中。
 */

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: {
    getState: () => {
      setEditorMode: (mode: string) => void;
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
  };
}

const PNG = makePngDataUrl(64, 64, [90, 140, 200]);

async function openEditor(
  page: Page,
  doc: string,
  name: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((src: string) => {
    const win = window as unknown as Record<string, any>;
    win.__convertedMediaPaths__ = [];
    win.__TAURI_INTERNALS__.convertFileSrc = (path: string) => {
      win.__convertedMediaPaths__.push(path);
      return src;
    };
  }, PNG);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ doc, name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function clickOutside(page: Page): Promise<void> {
  const box = (await page.locator(".cm-content").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
}

test("保存后切预览再切编辑，点添加描述预填原内容且不丢", async ({ page }) => {
  await openEditor(page, `![示例](${PNG})\n`, "reopen-prefill");
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-comment").click();
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await input.fill("诊断描述");
  await clickOutside(page);

  // 保存收尾：文档写入 title、输入框移除、描述行显示文字
  await expect.poll(() => content(page)).toContain('"诊断描述"');
  // 写回后 decoration 重建：新渲染的输入框常驻但隐藏（display:none 是设计）
  await expect(
    page.locator('[data-testid="img-caption-input"]:visible'),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid="img-caption"]')).toHaveText(
    "诊断描述",
  );

  // 切预览 → 切回编辑（真实用户路径）
  await page.evaluate(() => {
    (window as unknown as BridgeWindow).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    (window as unknown as BridgeWindow).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await page.waitForTimeout(120);

  // 重新选中：描述开关跨选中/模式切换持久（十二轮语义），按钮已是选中态
  await page.locator(".cm-image-widget").click();
  await expect(page.getByTestId("img-toolbar-comment")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-testid="img-caption"]')).toBeVisible();

  // 关一下再开：输入框出现且预填原内容
  await page.getByTestId("img-toolbar-comment").click();
  await expect(
    page.locator('[data-testid="img-caption-input"]:visible'),
  ).toHaveCount(0);
  await page.getByTestId("img-toolbar-comment").click();
  const reopened = page.locator('[data-testid="img-caption-input"]:visible');
  await expect(reopened).toHaveCount(1);
  await expect(reopened).toHaveValue("诊断描述");

  // 收尾：内容仍在文档里
  await page.getByTestId("img-toolbar-comment").click();
  await expect.poll(() => content(page)).toContain('"诊断描述"');
});
