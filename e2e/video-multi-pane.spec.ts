import { test, expect, type Page } from "@playwright/test";

/**
 * 视频多栏独立播放（第十批）：第二栏打开视频/其他文件不影响第一栏。
 */

async function boot(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
}

async function openInFocusedPane(page: Page, path: string) {
  await page.evaluate((p) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(p, "", p.split("/").pop() ?? p);
  }, path);
}

function videoSrcs(page: Page): Promise<string[]> {
  return page
    .locator(".art-video-player video")
    .evaluateAll((els) => els.map((el) => (el as HTMLVideoElement).src));
}

test("第二栏打开视频：两栏各留一个播放器，第一栏源不变", async ({ page }) => {
  await boot(page);
  await openInFocusedPane(page, "/Users/test/clip-a.mp4");
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
  const firstSrc = (await videoSrcs(page))[0];

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().splitPane("row");
  });
  await openInFocusedPane(page, "/Users/test/clip-b.webm");
  await expect(page.locator(".art-video-player")).toHaveCount(2);
  await page.waitForTimeout(300);

  const srcs = await videoSrcs(page);
  expect(srcs).toContain(firstSrc);
  expect(srcs.some((s) => s.includes("clip-b.webm"))).toBe(true);
});

test("第二栏打开 Markdown：第一栏视频继续挂载", async ({ page }) => {
  await boot(page);
  await openInFocusedPane(page, "/Users/test/clip-a.mp4");
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().splitPane("row");
  });
  await openInFocusedPane(page, "/Users/test/note.md");
  await page.waitForTimeout(300);

  // 第一栏播放器仍在（另一个播放器离屏挂载）
  await expect(page.locator(".art-video-player")).toHaveCount(1);
  const srcs = await videoSrcs(page);
  expect(srcs[0]).toContain("clip-a.mp4");
});

test("视频显示时左侧阅读空间展开按钮仍在最上层", async ({ page }) => {
  await boot(page);
  await openInFocusedPane(page, "/Users/test/clip-a.mp4");
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });

  const edge = page.locator('[data-testid="rail-edge"]');
  await expect(edge).toBeVisible();
  const hit = await edge.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    return Boolean(top && (top === el || el.contains(top)));
  });
  expect(hit).toBe(true);
  await edge.click();
  await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();
});
