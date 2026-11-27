import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1612（用户 2026-11-27 反馈）：放大层工具条排序与图标区分。
 * 1. 「恢复原始尺寸」是工具条第一个按钮
 * 2. 「重置图片」在「关闭」之前（有裁剪时）
 * 3. 「旋转 90°」与「重置图片」图标 path 不同（此前两处同为 RotateOutlined）
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

test("放大层按钮顺序：恢复原始尺寸第一，重置图片在关闭之前", async ({
  page,
}) => {
  await openCropDoc(page);
  await cropOnce(page);
  await page.locator(".cm-image-widget").first().dblclick();
  await expect(page.getByTestId("img-maximize")).toBeVisible({
    timeout: 5000,
  });

  const order = await page.evaluate(() => {
    const controls = document.querySelector(
      '[data-testid="img-max-controls"]',
    )!;
    const ids = [
      ...controls.querySelectorAll<HTMLElement>("[data-testid]"),
    ].map((el) => el.dataset.testid);
    return ids;
  });
  console.log("MAX-ORDER", order.join(" → "));

  expect(order[0]).toBe("img-max-reset");
  expect(order.indexOf("img-max-clear-crop")).toBeGreaterThan(-1);
  expect(order.indexOf("img-max-clear-crop")).toBeLessThan(
    order.indexOf("img-max-close"),
  );
  expect(order).toContain("img-max-rotate");
});

test("旋转与重置图片图标不同（SVG path 不一致）", async ({ page }) => {
  await openCropDoc(page);
  await page.locator(".cm-image-widget").first().dblclick();
  await expect(page.getByTestId("img-maximize")).toBeVisible({
    timeout: 5000,
  });

  const paths = await page.evaluate(() => {
    const grab = (testid: string) =>
      document
        .querySelector(`[data-testid="${testid}"] svg path`)
        ?.getAttribute("d");
    return { rotate: grab("img-max-rotate"), reset: grab("img-max-reset") };
  });
  console.log("ICON-PATHS", JSON.stringify(paths));
  expect(paths.rotate).toBeTruthy();
  expect(paths.reset).toBeTruthy();
  expect(paths.rotate).not.toBe(paths.reset);
});
