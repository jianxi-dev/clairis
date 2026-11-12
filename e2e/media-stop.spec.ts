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

/**
 * 页签喇叭按文件独立静音（#669 / ui-polish-batch15 6.1）：
 * 静音状态挂在文件（页签）维度，页签喇叭只改自己的实例；两个媒体页签同时
 * 存在时互不影响，关闭页签后静音记录清理、重开同一文件不残留。
 *
 * 两个媒体页签分置两栏：同栏切换页签会替换该栏的播放源（mediaPlayer 按格
 * 持有），只有分栏才能同时挂载两个播放器实例。
 */
async function openInFocusedPane(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    const w = window as unknown as Record<string, unknown>;
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      p,
      "",
      p.split("/").pop() ?? p,
    );
  }, path);
}

function tabIdOfPath(page: Page, path: string): Promise<string> {
  return page.evaluate((p) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const tab = Object.values(
      store.getState().tabs as Record<string, any>,
    ).find((t: any) => t.path === p) as any;
    return tab?.id ?? "";
  }, path);
}

function mutedStates(page: Page): Promise<boolean[]> {
  return page
    .locator(".art-video-player video")
    .evaluateAll((els) => els.map((el) => (el as HTMLVideoElement).muted));
}

test("页签喇叭按文件独立静音，关闭后无残留", async ({ page }) => {
  await boot(page);
  await openInFocusedPane(page, "/tmp/movies/ep1.mp4");
  await page
    .locator(".art-video-player video")
    .first()
    .waitFor({ timeout: 10000 });

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().splitPane("row");
  });
  await openInFocusedPane(page, "/tmp/movies/ep2.mp3");
  await expect(page.locator(".art-video-player")).toHaveCount(2);

  const ep1TabId = await tabIdOfPath(page, "/tmp/movies/ep1.mp4");
  const ep2TabId = await tabIdOfPath(page, "/tmp/movies/ep2.mp3");
  expect(ep1TabId).not.toBe("");
  expect(ep2TabId).not.toBe("");
  expect(ep1TabId).not.toBe(ep2TabId);

  const mute1 = page.locator(`[data-testid="tab-mute-${ep1TabId}"]`);
  const mute2 = page.locator(`[data-testid="tab-mute-${ep2TabId}"]`);
  await expect(mute1).toHaveAttribute("aria-pressed", "false");
  await expect(mute2).toHaveAttribute("aria-pressed", "false");
  expect(await mutedStates(page)).toEqual([false, false]);

  // 静音第一个：只有第一个实例静音，第二个不受影响
  await mute1.click();
  await expect(mute1).toHaveAttribute("aria-pressed", "true");
  await expect(mute2).toHaveAttribute("aria-pressed", "false");
  expect(await mutedStates(page)).toEqual([true, false]);

  // 取消静音：第一个恢复出声，第二个仍不受影响
  await mute1.click();
  await expect(mute1).toHaveAttribute("aria-pressed", "false");
  expect(await mutedStates(page)).toEqual([false, false]);

  // 再次静音第一个并关闭其页签：实例消失，另一个状态不受影响
  await mute1.click();
  expect(await mutedStates(page)).toEqual([true, false]);
  await page.evaluate((id) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().closeTab(id);
  }, ep1TabId);
  await expect(page.locator(".art-video-player")).toHaveCount(1);
  expect(await mutedStates(page)).toEqual([false]);

  // 重开同一文件：静音记录已随页签关闭清理，不残留
  await openInFocusedPane(page, "/tmp/movies/ep1.mp4");
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const v = document.querySelector(
          ".art-video-player video",
        ) as HTMLVideoElement | null;
        return v?.src ?? "";
      }),
    )
    .toContain("ep1.mp4");
  expect(await mutedStates(page)).toEqual([false]);
});
