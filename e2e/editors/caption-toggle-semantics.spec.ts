import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1603 九轮用户裁定：「添加描述」纯显隐开关——
 *  - 默认未选中、描述区隐藏
 *  - 点一下 → 按钮选中、描述区（输入框）始终显示
 *  - 再点一下 → 未选中、描述区隐藏
 *  - 不看文档里有没有内容；录入后点外部即保存，描述行显示新文字
 */

const PNG = makePngDataUrl(64, 64, [90, 140, 200]);

async function openDoc(page: Page): Promise<void> {
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
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 30000 });
  await page.evaluate((doc: string) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/captoggle/captoggle.md",
      doc,
      "captoggle.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, `![示例](${PNG})\n`);
  await page.locator(".cm-content").waitFor({ timeout: 30000 });
  // 图片 widget 与图片资源就绪后再交互（首个用例冷启动需要）
  await page.locator(".cm-image-widget").waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () => {
      const img = document.querySelector(
        ".cm-image-widget img",
      ) as HTMLImageElement | null;
      return !!img && img.complete && img.naturalWidth > 0;
    },
    undefined,
    { timeout: 30000 },
  );
}

const commentBtn = (page: Page) => page.getByTestId("img-toolbar-comment");
const captionRow = (page: Page) => page.locator('[data-testid="img-caption"]');
const visibleInput = (page: Page) =>
  page.locator('[data-testid="img-caption-input"]:visible');

test("描述开关全流程：默认隐藏→点开→录入→点外面取消选中但文字留存→再选中仍开→关闭后消失", async ({
  page,
}) => {
  await openDoc(page);
  const clickOutside = async () => {
    const box = (await page.locator(".cm-content").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
  };

  // 1) 选中图片：按钮未选中、描述区隐藏
  await page.locator(".cm-image-widget").click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "false");
  await expect(captionRow(page)).toBeHidden();

  // 2) 点开：按钮选中、输入框可见
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
  await expect(visibleInput(page)).toHaveCount(1);

  // 3) 录入并点外面：保存 + 文字显示 + 图片取消选中、工具条消失
  await visibleInput(page).fill("十二轮描述");
  await clickOutside();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as Record<string, any>;
        const s = win.__biaoyue_store__.getState();
        return s.tabs[s.activeTabId]?.content ?? "";
      }),
    )
    .toContain('"十二轮描述"');
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);
  // 描述文字仍在（开关是图片自己的）
  await expect(captionRow(page)).toBeVisible();
  await expect(captionRow(page)).toHaveText("十二轮描述");

  // 4) 再选中：按钮仍是选中态（开关记住了）
  await page.locator(".cm-image-widget").click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
  await expect(captionRow(page)).toBeVisible();

  // 5) 点按钮关闭：描述消失；取消选中后也不残留
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "false");
  await expect(captionRow(page)).toBeHidden();
  await clickOutside();
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(captionRow(page)).toBeHidden();

  // 6) 再选中并点开：预填已保存内容
  await page.locator(".cm-image-widget").click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "false");
  await commentBtn(page).click();
  await expect(visibleInput(page)).toHaveValue("十二轮描述");
});

test("录入后点图片也能保存（不被选中重建清空）", async ({ page }) => {
  await openDoc(page);
  await page.locator(".cm-image-widget").click();
  await commentBtn(page).click();
  await visibleInput(page).fill("点图片保存");

  // 直接点图片本身（不是外面）：应提交并保持选中
  await page.locator(".cm-image-widget").click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as Record<string, any>;
        const s = win.__biaoyue_store__.getState();
        return s.tabs[s.activeTabId]?.content ?? "";
      }),
    )
    .toContain('"点图片保存"');
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(captionRow(page)).toHaveText("点图片保存");
  // 输入框已收尾，按钮仍选中
  await expect(visibleInput(page)).toHaveCount(0);
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
});
