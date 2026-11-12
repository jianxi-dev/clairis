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

/**
 * 连播与竖拍适配（batch15 1.1）。
 *
 * 媒体桩说明：mock 桥的 media:// 文件不存在，Chromium 无法解码真视频。
 * 与 video-multi-pane 同一建模：把 HTMLMediaElement 的 play/pause/paused
 * 建成浏览器契约，断言应用调用点；竖拍适配把 videoWidth/videoHeight 建成
 * 竖向维度（真实的旋转元数据解码是 Chromium 契约），验证的是我们的
 * autoSize/容器 CSS 对竖向维度的适配。
 */
async function installMediaStub(page: Page): Promise<void> {
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

function setMedia(
  page: Page,
  items: Array<Record<string, string>>,
): Promise<void> {
  return page.evaluate((list) => {
    (window as unknown as Record<string, any>).__biaoyue_media__ = list;
  }, items);
}

async function fireEnded(page: Page): Promise<void> {
  await page.evaluate(() => {
    const video = document.querySelector("video");
    video?.dispatchEvent(new Event("ended"));
  });
}

function currentMediaPath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("biaoyue.media.lastIndex");
    if (!raw) return "";
    try {
      return (JSON.parse(raw) as { path?: string }).path ?? "";
    } catch {
      return "";
    }
  });
}

test("默认档连播：播完自动切下一个视频，音频不静默起播", async ({ page }) => {
  await installMediaStub(page);
  await boot(page);
  await setMedia(page, [
    { path: "/tmp/movies/ep1.mp4", name: "ep1.mp4", kind: "video", target: "" },
    { path: "/tmp/movies/ep2.mp4", name: "ep2.mp4", kind: "video", target: "" },
    {
      path: "/tmp/movies/song.mp3",
      name: "song.mp3",
      kind: "audio",
      target: "",
    },
  ]);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/movies/ep1.mp4", "", "ep1.mp4");
  });
  await page.waitForSelector(".art-video-player video", { timeout: 10000 });

  await fireEnded(page);
  await expect.poll(() => currentMediaPath(page)).toBe("/tmp/movies/ep2.mp4");

  // ep2 播完：下一项是音频 → 停下，不得静默起播
  await fireEnded(page);
  await expect.poll(() => currentMediaPath(page)).toBe("/tmp/movies/ep2.mp4");
  const playing = await page.evaluate(
    () =>
      (document.querySelector("video") as unknown as Record<string, any> | null)
        ?.__playing ?? false,
  );
  expect(playing).toBe(false);
});

test("列表循环：列表尾环绕回第一项", async ({ page }) => {
  await installMediaStub(page);
  await boot(page);
  await setMedia(page, [
    { path: "/tmp/movies/ep1.mp4", name: "ep1.mp4", kind: "video", target: "" },
    { path: "/tmp/movies/ep2.mp4", name: "ep2.mp4", kind: "video", target: "" },
  ]);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/movies/ep1.mp4", "", "ep1.mp4");
  });
  await page.waitForSelector(".art-video-player video", { timeout: 10000 });

  // none → single → playlist
  const loopBtn = page.locator(".art-control[data-name='loop']");
  await loopBtn.click();
  await loopBtn.click();

  await fireEnded(page);
  await expect.poll(() => currentMediaPath(page)).toBe("/tmp/movies/ep2.mp4");
  await fireEnded(page);
  await expect.poll(() => currentMediaPath(page)).toBe("/tmp/movies/ep1.mp4");
});

test("竖拍适配：画面呈竖向且不溢出容器；关闭后无残留实例", async ({ page }) => {
  await installMediaStub(page);
  await page.addInitScript(() => {
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get() {
        return 64;
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get() {
        return 128;
      },
    });
    // src 赋值后同步派发 loadedmetadata，触发 ArtPlayer autoSize。
    const desc = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "src",
    );
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: true,
      set(value: string) {
        desc?.set?.call(this, value);
        this.dispatchEvent(new Event("loadedmetadata"));
      },
      get() {
        return desc?.get?.call(this) ?? "";
      },
    });
  });
  await boot(page);
  await setMedia(page, [
    {
      path: "/tmp/movies/portrait.mp4",
      name: "portrait.mp4",
      kind: "video",
      target: "",
    },
  ]);
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/movies/portrait.mp4", "", "portrait.mp4");
  });
  await page.waitForSelector(".art-video-player video", { timeout: 10000 });

  // 画面朝向正确：播放器盒子竖向（旋转元数据由 Chromium 解码，这里验证
  // 我们的 autoSize/容器对竖向维度的适配）
  const geo = await page.evaluate(() => {
    const player = document.querySelector(".art-video-player");
    const stage = player?.parentElement;
    if (!player || !stage) return null;
    const p = player.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return { pw: p.width, ph: p.height, sw: s.width };
  });
  expect(geo).not.toBeNull();
  expect(geo!.pw).toBeLessThan(geo!.ph);
  expect(geo!.pw).toBeLessThanOrEqual(geo!.sw);

  // 取消播放（关页签）→ 无残留播放器实例
  const tab = page.locator('[data-tab-id][aria-selected="true"]');
  await tab.hover();
  await page.locator('[data-tab-id] button[title^="关闭"]').first().click();
  await expect(page.locator(".art-video-player")).toHaveCount(0);
});
