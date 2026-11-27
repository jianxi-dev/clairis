import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1612（用户 2026-11-27 反馈）：放大层工具条排序与图标区分。
 * 1. 「恢复原始尺寸」是工具条第一个按钮
 * 2. 查看工具条不含「重置图片」（#1603 九轮用户裁定：多图切换时它会让
 *    切换按钮左右跑位；重置能力留在编辑态工具条）
 */

const IMG = makePngDataUrl(600, 400, [90, 140, 200]);

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
}

async function openCropDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/maxorder/doc.md", body, "doc.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, `![图](${IMG}){width=300}\n`);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const i = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!i && i.complete && i.naturalWidth > 0;
  });
}

/** 把裁剪框拖小 30×20 并双击确认，使图片带上 crop 属性。 */
async function cropOnce(page: Page): Promise<void> {
  await page.locator(".cm-image-widget").first().click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  const h = page.locator('.cm-image-crop-frame [data-handle="nw"]');
  const b = (await h.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 20, {
    steps: 4,
  });
  await page.mouse.up();
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
}

test("放大层按钮顺序：恢复原始尺寸第一，且无重置图片按钮", async ({ page }) => {
  await openCropDoc(page);
  await cropOnce(page);
  await page.locator(".cm-image-widget").first().dblclick();
  await expect(page.getByTestId("img-maximize")).toBeVisible({
    timeout: 5000,
  });
  const order = await page.evaluate(() =>
    [
      ...document.querySelectorAll('[data-testid="img-max-controls"] button'),
    ].map((b) => (b as HTMLElement).dataset.testid ?? ""),
  );
  expect(order[0]).toBe("img-max-reset");
  // 查看工具条不含重置图片（裁剪过的图也一样）
  expect(order).not.toContain("img-max-clear-crop");
  expect(await page.getByTestId("img-max-clear-crop").count()).toBe(0);
  expect(order).toContain("img-max-close");
});
