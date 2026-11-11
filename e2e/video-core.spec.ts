import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

test("视频页签提供静音切换", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/movies/ep1.mp4", "", "ep1.mp4");
  });
  await page.waitForTimeout(300);
  const btn = page.locator('[data-testid^="tab-mute-"]').first();
  await expect(btn).toBeVisible({ timeout: 3000 });
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
});

test("非媒体页签不出现静音按钮", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/note.md", "# 标题\n\n正文。", "note.md");
  });
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid^="tab-mute-"]')).toHaveCount(0);
});

test("PDF 与图片页签不出现静音按钮", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/Users/test/doc.pdf", "", "doc.pdf");
  });
  await expect(
    page
      .locator("[data-tab-id]", { hasText: "doc.pdf" })
      .locator('[data-testid^="tab-mute-"]'),
  ).toHaveCount(0);

  await page.evaluate(() => {
    window.__biaoyue_openFile__("/Users/test/pic.png", "", "pic.png");
  });
  await expect(
    page
      .locator("[data-tab-id]", { hasText: "pic.png" })
      .locator('[data-testid^="tab-mute-"]'),
  ).toHaveCount(0);
});

test("音频页签出现静音按钮", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/Users/test/song.mp3", "", "song.mp3");
  });
  await expect(
    page
      .locator("[data-tab-id]", { hasText: "song.mp3" })
      .locator('[data-testid^="tab-mute-"]'),
  ).toHaveCount(1);
});

test("证据：视频四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/movies/ep1.mp4", "", "ep1.mp4");
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/video-tab.png` });
  const btn = page.locator('[data-testid^="tab-mute-"]').first();
  await btn.waitFor({ state: "visible" });
  await page.screenshot({ path: `${dir}/mute-unmuted.png` });
  await btn.click();
  await page.screenshot({ path: `${dir}/mute-muted.png` });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/note.md", "# 标题\n\n正文。", "note.md");
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/non-media-tab.png` });
});
