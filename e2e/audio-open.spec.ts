import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

interface MediaItem {
  path: string;
  name: string;
  kind: string;
  target: string;
}

async function boot(page: Page, media?: MediaItem[]): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (media) {
    await page.addInitScript((items: MediaItem[]) => {
      const w = window as unknown as Record<string, unknown>;
      w.__biaoyue_media__ = items;
      localStorage.removeItem("biaoyue.media.lastIndex");
    }, media);
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openMp3(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/song.mp3", "", "song.mp3");
  });
  await page.waitForTimeout(600);
}

/**
 * 媒体桩：mock 桥给的 media:// 文件不存在，Chromium 无法解码真音频，
 * 因此把 HTMLMediaElement 的 play()/paused 建模成浏览器契约（play 置
 * __playing 并派发 play），用于断言「我们的代码是否调用了 play/pause」——
 * 被测对象是应用调用点，不是媒体解码本身。
 */
async function installMediaStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__playCalls = 0;
    HTMLMediaElement.prototype.play = function play() {
      w.__playCalls = (w.__playCalls as number) + 1;
      (this as unknown as Record<string, unknown>).__playing = true;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      (this as unknown as Record<string, unknown>).__playing = false;
      this.dispatchEvent(new Event("pause"));
    };
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get(this: HTMLMediaElement) {
        return !(this as unknown as Record<string, unknown>).__playing;
      },
    });
  });
}

async function bootWithStub(page: Page, media?: MediaItem[]): Promise<void> {
  await installMediaStub(page);
  await boot(page, media);
}

/** 播放器媒体元素状态：限定 .art-video-player 内，排除恒 muted 的 thumbVideo */
function mediaState(page: Page): Promise<{ paused: boolean; muted: boolean }> {
  return page
    .locator(".art-video-player video")
    .first()
    .evaluate((el) => ({
      paused: (el as HTMLVideoElement).paused,
      muted: (el as HTMLVideoElement).muted,
    }));
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

test("静音后 100ms 内音频停播且静音（A-7.1）", async ({ page }) => {
  await bootWithStub(page);
  await openMp3(page);
  const video = page.locator(".art-video-player video").first();
  await video.waitFor({ state: "attached", timeout: 10000 });
  // 起播后应处于播放态（桩建模），否则本用例证明不了「静音即停播」
  await expect
    .poll(() => mediaState(page))
    .toEqual({ paused: false, muted: false });

  const tabId = await tabIdOfPath(page, "/tmp/song.mp3");
  const mute = page.locator(`[data-testid="tab-mute-${tabId}"]`);
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  // 规格 A-7.1：100ms 时已不处于播放态、无声音残留
  await page.waitForTimeout(100);
  expect(await mediaState(page)).toEqual({ paused: true, muted: true });

  // 取消静音：恢复出声但不自动续播（保持既有语义，避免惊吓）
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  expect(await mediaState(page)).toEqual({ paused: true, muted: false });
});

test("同目录 3 个音频自动入播放列表且自然序稳定（A-7.2）", async ({ page }) => {
  await boot(page, [
    {
      path: "/tmp/music/track-10.mp3",
      name: "track-10.mp3",
      kind: "audio",
      target: "",
    },
    {
      path: "/tmp/music/track-2.mp3",
      name: "track-2.mp3",
      kind: "audio",
      target: "",
    },
    {
      path: "/tmp/music/track-1.mp3",
      name: "track-1.mp3",
      kind: "audio",
      target: "",
    },
  ]);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/music/track-1.mp3", "", "track-1.mp3");
  });
  const playlistBtn = page.locator(".art-control[data-name='playlist']");
  await playlistBtn.hover();
  await expect(page.getByText("播放列表（3）")).toBeVisible();

  const names = () =>
    page.locator("[data-testid='playlist-item-name']").allTextContents();
  // 自然序：track-1 < track-2 < track-10（数值比较，而非字典序）
  const expected = ["track-1.mp3", "track-2.mp3", "track-10.mp3"];
  expect(await names()).toEqual(expected);

  // 关掉浮层再开：两次读取顺序一致（顺序稳定）
  await page.mouse.move(600, 200);
  await page.waitForTimeout(300);
  await playlistBtn.hover();
  expect(await names()).toEqual(expected);
});

test("关闭音频页签后无残留播放器实例", async ({ page }) => {
  await bootWithStub(page);
  await openMp3(page);
  await expect(page.locator(".art-video-player")).toHaveCount(1);
  const tabId = await tabIdOfPath(page, "/tmp/song.mp3");
  await page.evaluate((id) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().closeTab(id);
  }, tabId);
  await expect(page.locator(".art-video-player")).toHaveCount(0);
});
