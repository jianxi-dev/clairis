import { test, expect, type Page } from "@playwright/test";

/**
 * 媒体播放结束语义（#633）：
 * 「不循环」是默认档位，播完应停在当前文件；旧实现会无条件把同目录下一项
 * 塞进同一个播放器，下一项是音频时画面上看不出变化，只有声音继续 ——
 * 用户只能关闭页签才停。
 */

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__biaoyue_media__ = [
      {
        path: "/tmp/movies/ep1.mp4",
        name: "ep1.mp4",
        kind: "video",
        target: "ep1",
      },
      {
        path: "/tmp/movies/ep2.mp3",
        name: "ep2.mp3",
        kind: "audio",
        target: "ep2",
      },
    ];
    localStorage.removeItem("biaoyue.media.lastIndex");
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

test("视频播完停在当前文件，不自动播放同目录下一项", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      "/tmp/movies/ep1.mp4",
      "",
      "ep1.mp4",
    );
  });
  await page.locator(".art-video-player video").first().waitFor({
    timeout: 10000,
  });

  // 播放列表就绪后再触发结束：ended 处理读取的是异步加载的 playlistRef，
  // 列表未就绪时旧实现同样不会切集，会让本用例假绿。
  await page.locator(".art-control[data-name='playlist']").hover();
  await expect(page.getByText("播放列表（2）")).toBeVisible();
  await page.mouse.move(600, 200);

  const afterEnded = await page.evaluate(async () => {
    const v = document.querySelector(
      ".art-video-player video",
    ) as HTMLVideoElement;
    v.dispatchEvent(new Event("ended"));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return { src: v.src, paused: v.paused };
  });

  expect(afterEnded.src).not.toContain("ep2");
  expect(afterEnded.paused).toBe(true);
});

test("列表循环模式播完仍接管同目录下一项", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      "/tmp/movies/ep1.mp4",
      "",
      "ep1.mp4",
    );
  });
  await page.locator(".art-video-player video").first().waitFor({
    timeout: 10000,
  });
  await page.locator(".art-control[data-name='playlist']").hover();
  await expect(page.getByText("播放列表（2）")).toBeVisible();
  await page.mouse.move(600, 200);

  const loop = page.locator(".art-control[data-name='loop']");
  await loop.click();
  await loop.click();
  await expect(page.locator(".art-notice")).toContainText("列表循环");

  const thumbSrc = await page.evaluate(() => {
    const v = document.querySelector(
      ".art-video-player video",
    ) as HTMLVideoElement;
    const thumb = document.querySelector(
      '[data-testid="video-thumb-source"]',
    ) as HTMLVideoElement;
    v.dispatchEvent(new Event("ended"));
    return thumb.src;
  });

  expect(thumbSrc).toContain("ep2");
});
