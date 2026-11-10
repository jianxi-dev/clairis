import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openPreview(page: Page, path: string, title: string, x: number) {
  await page.evaluate(
    ({ p, t, px }) => {
      const store = window.__biaoyue_store__.getState();
      store.openPreview({
        path: p,
        title: t,
        x: px,
        y: 140,
        w: 300,
        h: 200,
        flippedX: false,
        flippedY: false,
        source: "tab",
      });
    },
    { p: path, t: title, px: x },
  );
  await expect(
    page.locator(
      `[data-testid="floating-preview"][data-preview-path="${path}"]`,
    ),
  ).toBeVisible();
}

async function pin(page: Page, path: string) {
  await page
    .locator(
      `[data-testid="floating-preview"][data-preview-path="${path}"] [data-testid="preview-pin"]`,
    )
    .click();
  await expect(
    page.locator(
      `[data-testid="floating-preview"][data-preview-path="${path}"]`,
    ),
  ).toHaveAttribute("data-pinned", "true");
}

test("两个视频可同时以悬浮窗显示", async ({ page }) => {
  await boot(page);
  await openPreview(page, "/tmp/movies/ep1.mp4", "ep1.mp4", 160);
  await pin(page, "/tmp/movies/ep1.mp4");
  await openPreview(page, "/tmp/movies/ep2.mp4", "ep2.mp4", 520);
  await pin(page, "/tmp/movies/ep2.mp4");

  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(2);
  await expect(
    page.locator('[data-testid="preview-media"][data-media-kind="video"]'),
  ).toHaveCount(2);
  await expect(
    page.locator('[data-testid="floating-preview"] video'),
  ).toHaveCount(2);
});
