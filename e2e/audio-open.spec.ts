import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openMp3(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/song.mp3", "", "song.mp3");
  });
  await page.waitForTimeout(600);
}

test("打开 mp3 不出现 PDF 渲染错误", async ({ page }) => {
  await boot(page);
  await openMp3(page);
  await expect(page.getByText("无法预览 PDF")).toHaveCount(0);
  await expect(page.getByText("FPDF_LoadMemDocument failed")).toHaveCount(0);
});

test("打开 mp3 挂载媒体播放器", async ({ page }) => {
  await boot(page);
  await openMp3(page);
  const media = page.locator("audio, video");
  await media.first().waitFor({ state: "attached", timeout: 5000 });
  expect(await media.count()).toBeGreaterThan(0);
});

test("证据：音频四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  await openMp3(page);
  await page.screenshot({ path: `${dir}/mp3-open.png` });
  await page.locator("audio, video").first().waitFor({ state: "attached" });
  await page.screenshot({ path: `${dir}/mp3-player.png` });
  await page.screenshot({ path: `${dir}/mp3-tab.png` });
  await page.evaluate(() => {
    const s = window.__biaoyue_store__.getState();
    if (s.activeTabId) s.closeTab(s.activeTabId);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/mp3-closed.png` });
});
