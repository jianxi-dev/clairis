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

/**
 * 起播态与多路并行（第十三批 #574）：
 * 打开视频即自动播放；每格播放互不影响；多路可同时出声。
 *
 * 媒体桩说明：mock 桥给的 media:// 文件不存在，Chromium 无法解码真视频，
 * 因此把 HTMLMediaElement 的 play()/paused 建模成浏览器契约（play 置
 * __playing 并派发 play），用于断言「我们的代码是否调用了 play」——
 * 被测对象是应用调用点，不是媒体解码本身。
 */
async function installMediaStub(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, any>;
    w.__playCalls = 0;
    HTMLMediaElement.prototype.play = function play() {
      w.__playCalls += 1;
      (this as unknown as Record<string, any>).__playing = true;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      (this as unknown as Record<string, any>).__playing = false;
      this.dispatchEvent(new Event("pause"));
    };
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get(this: HTMLMediaElement) {
        return !(this as unknown as Record<string, any>).__playing;
      },
    });
  });
}

async function bootWithMediaStub(page: Page) {
  await installMediaStub(page);
  await boot(page);
}

function playCalls(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as Record<string, any>).__playCalls as number,
  );
}

function videoStates(page: Page) {
  return page.locator(".art-video-player video").evaluateAll((els) =>
    els.map((el) => ({
      paused: (el as HTMLVideoElement).paused,
      muted: (el as HTMLVideoElement).muted,
      src: (el as HTMLVideoElement).src,
    })),
  );
}

test("打开视频即自动播放（含重新挂载）", async ({ page }) => {
  await bootWithMediaStub(page);
  await openInFocusedPane(page, "/Users/test/clip-a.mp4");
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);

  const states = await videoStates(page);
  expect(states).toHaveLength(1);
  expect(states[0].paused).toBe(false);
  expect(await playCalls(page)).toBeGreaterThanOrEqual(1);

  // 重新挂载等价于程序重启恢复工作区：关闭页签再重新打开同一视频
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const tab = Object.values(state.tabs as Record<string, any>).find(
      (t: any) => t.path === "/Users/test/clip-a.mp4",
    ) as any;
    state.closeTab(tab.id);
  });
  await page.waitForTimeout(200);
  await openInFocusedPane(page, "/Users/test/clip-a.mp4");
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);

  const again = await videoStates(page);
  expect(again[0].paused).toBe(false);
  expect(await playCalls(page)).toBeGreaterThanOrEqual(2);
});

test("两栏视频各自独立播放，且都未静音", async ({ page }) => {
  await bootWithMediaStub(page);
  await openInFocusedPane(page, "/Users/test/clip-a.mp4");
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().splitPane("row");
  });
  await openInFocusedPane(page, "/Users/test/clip-b.webm");
  await expect(page.locator(".art-video-player")).toHaveCount(2);
  await page.waitForTimeout(300);

  const players = page.locator(".art-video-player");
  await page.waitForTimeout(400);
  let states = await videoStates(page);
  expect(states.every((s) => s.paused === false)).toBe(true);
  expect(states.every((s) => s.muted === false)).toBe(true);

  // 暂停第一格：第二格继续播放，互不影响（无全局 mutex）。
  await players
    .nth(0)
    .locator("video")
    .evaluate((el) => {
      (el as HTMLVideoElement).pause();
    });
  await page.waitForTimeout(150);
  states = await videoStates(page);
  const paused = states.map((s) => s.paused);
  expect(paused.filter((p) => p === true)).toHaveLength(1);
  expect(paused.filter((p) => p === false)).toHaveLength(1);

  await players
    .nth(0)
    .locator("video")
    .evaluate((el) => {
      void (el as HTMLVideoElement).play();
    });
  await page.waitForTimeout(150);
  states = await videoStates(page);
  expect(states.every((s) => s.paused === false)).toBe(true);
  expect(states[0].src).not.toBe(states[1].src);
});
