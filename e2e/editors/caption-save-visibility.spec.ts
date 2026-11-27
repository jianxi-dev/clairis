import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1602：图片描述「点外部保存后不显示」与「清空描述无法移除」。
 *
 * A：输入描述 → 点编辑器正文空白处（blur 提交）→ 标题已写回文档，重选图片后
 *    描述行显示该文字。
 * B：图片已有描述 → 清空输入框 → 点外部保存 → 文档移除 title 属性，描述行回
 *    占位态。
 * Esc 取消不写入（既有行为不变）。
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

/** 点编辑器正文空白处（图片下方），触发 blur 提交。 */
async function clickOutside(page: Page): Promise<void> {
  const box = (await page.locator(".cm-content").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
}

test("A：输入描述点外部保存，重选图片后描述行显示该文字", async ({ page }) => {
  await openEditor(page, `![示例](${PNG})\n`, "capvis-a");
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await page.getByTestId("img-toolbar-comment").click();
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await input.fill("诊断描述");
  await clickOutside(page);

  // 标题已写回文档
  await expect.poll(() => content(page)).toContain('"诊断描述"');

  // 重选图片：描述行显示该文字（不依赖保存瞬间的选中态）
  await widget.click();
  await expect(page.locator('[data-testid="img-caption"]')).toHaveText(
    "诊断描述",
  );
});

test("B：清空描述点外部保存，文档移除 title 且描述行回占位态", async ({
  page,
}) => {
  await openEditor(page, `![示例](${PNG} "旧描述")\n`, "capvis-b");
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await page.getByTestId("img-toolbar-comment").click();
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await input.fill("");
  await clickOutside(page);

  // 文档移除 title 属性
  await expect.poll(() => content(page)).not.toContain('"旧描述"');

  // 重选图片：描述行回占位态
  await widget.click();
  await expect(page.locator('[data-testid="img-caption"]')).toHaveText(
    "输入图片描述",
  );
});

test("Esc 取消不写入（既有行为不变）", async ({ page }) => {
  const doc = `![示例](${PNG} "旧描述")\n`;
  await openEditor(page, doc, "capvis-esc");
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await page.getByTestId("img-toolbar-comment").click();
  const input = page.locator('[data-testid="img-caption-input"]');
  await expect(input).toHaveCount(1);
  await input.fill("不应保存");
  await input.press("Escape");

  await expect(input).toHaveCount(0);
  expect(await content(page)).toBe(doc);
  await expect(page.locator('[data-testid="img-caption"]')).toHaveText(
    "旧描述",
  );
});
