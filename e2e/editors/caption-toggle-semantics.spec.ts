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
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((doc: string) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/captoggle/captoggle.md",
      doc,
      "captoggle.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, `![示例](${PNG})\n`);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

const commentBtn = (page: Page) => page.getByTestId("img-toolbar-comment");
const captionRow = (page: Page) => page.locator('[data-testid="img-caption"]');
const visibleInput = (page: Page) =>
  page.locator('[data-testid="img-caption-input"]:visible');

test("开关语义：默认隐藏 → 点开显示 → 再点隐藏 → 再点仍显示", async ({
  page,
}) => {
  await openDoc(page);
  await page.locator(".cm-image-widget").click();

  // 默认：按钮未选中、描述行隐藏
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "false");
  await expect(captionRow(page)).toBeHidden();

  // 点开：按钮选中、描述行可见、输入框可见
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
  await expect(captionRow(page)).toBeVisible();
  await expect(visibleInput(page)).toHaveCount(1);

  // 再点：未选中、描述行移除
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "false");
  await expect(captionRow(page)).toBeHidden();

  // 再点开：仍可显示（不因"库里没内容"拒绝）
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
  await expect(visibleInput(page)).toHaveCount(1);
});

test("录入后点外部：保存 + 描述行显示新文字 + 按钮保持选中", async ({
  page,
}) => {
  await openDoc(page);
  await page.locator(".cm-image-widget").click();
  await commentBtn(page).click();
  await visibleInput(page).fill("九轮描述");
  const box = (await page.locator(".cm-content").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);

  // 文档写入、描述行显示新文字、按钮仍选中、输入框已收尾
  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as Record<string, any>;
        const s = win.__biaoyue_store__.getState();
        return s.tabs[s.activeTabId]?.content ?? "";
      }),
    )
    .toContain('"九轮描述"');
  await expect(captionRow(page)).toHaveText("九轮描述");
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
  await expect(visibleInput(page)).toHaveCount(0);

  // 再点开关 → 隐藏；再点开 → 预填已保存内容
  await commentBtn(page).click();
  await expect(captionRow(page)).toBeHidden();
  await commentBtn(page).click();
  await expect(visibleInput(page)).toHaveValue("九轮描述");
});

test("描述框开着时点外面：保存并保持选中（未修改也一样）", async ({ page }) => {
  await openDoc(page);
  await page.locator(".cm-image-widget").click();
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");

  // 不输入，直接点外面：不应 deselect（十轮真机反馈）
  const box = (await page.locator(".cm-content").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
  await expect(captionRow(page)).toBeVisible();

  // 描述开着期间点外面一律保持选中；关掉描述（按钮取消选中）后才退出
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "false");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "false",
  );
});

test("保存后（widget 已重建）反复点外面：选中不丢，关掉描述后才退出", async ({
  page,
}) => {
  await openDoc(page);
  await page.locator(".cm-image-widget").click();
  await commentBtn(page).click();
  await visibleInput(page).fill("重建后描述");
  const box = (await page.locator(".cm-content").boundingBox())!;
  const clickOutside = () =>
    page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);

  await clickOutside();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as Record<string, any>;
        const s = win.__biaoyue_store__.getState();
        return s.tabs[s.activeTabId]?.content ?? "";
      }),
    )
    .toContain('"重建后描述"');

  // 描述仍选中，连续点外面：选中态不丢（十一轮真机 bug 路径）
  for (let i = 0; i < 2; i += 1) {
    await clickOutside();
    await expect(page.locator(".cm-image-widget")).toHaveAttribute(
      "data-selected",
      "true",
    );
    await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "true");
    await expect(captionRow(page)).toBeVisible();
  }

  // 关掉描述（按钮取消选中）后点外面：才退出选中
  await commentBtn(page).click();
  await expect(commentBtn(page)).toHaveAttribute("aria-pressed", "false");
  await clickOutside();
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "false",
  );
});
