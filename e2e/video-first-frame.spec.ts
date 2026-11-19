import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");

const ART = path.resolve(process.cwd(), ".artifacts/1183");

async function installRealVideo(page: Page): Promise<void> {
  await page.addInitScript((b64) => {
    const DATA = `data:video/mp4;base64,${b64}`;
    const proto = HTMLMediaElement.prototype as unknown as Record<
      string,
      unknown
    >;
    const desc = Object.getOwnPropertyDescriptor(proto, "src");
    if (!desc?.get || !desc.set) return;
    Object.defineProperty(proto, "src", {
      configurable: true,
      get: desc.get,
      set(this: HTMLMediaElement, value: string) {
        const next =
          typeof value === "string" && value.startsWith("media://")
            ? DATA
            : value;
        desc.set?.call(this, next);
      },
    });
  }, TINY_MP4);
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openVideo(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/movies/ep1.mp4", "", "ep1.mp4");
  });
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
}

async function assertFirstFramePaused(page: Page): Promise<void> {
  const video = page.locator(".art-video-player video").first();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
  expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  expect(
    await page.evaluate(() => {
      const el = document.querySelector(
        ".art-video-player .art-loading",
      ) as HTMLElement | null;
      return el ? getComputedStyle(el).display : "missing";
    }),
  ).toBe("none");
}

test("打开视频显示首帧画面、暂停且不显示加载指示", async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await installRealVideo(page);
  await boot(page);
  await openVideo(page);
  await assertFirstFramePaused(page);
  await page.screenshot({ path: path.join(ART, "01-first-frame-visible.png") });

  const display = await page.evaluate(() => {
    const el = document.querySelector(
      ".art-video-player .art-loading",
    ) as HTMLElement | null;
    return el ? getComputedStyle(el).display : "missing";
  });
  expect(display).toBe("none");
  await page.screenshot({
    path: path.join(ART, "02-no-loading-indicator.png"),
  });

  const before = await page.evaluate(
    () =>
      (document.querySelector(".art-video-player video") as HTMLVideoElement)
        .currentTime,
  );
  await page.waitForTimeout(500);
  const after = await page.evaluate(
    () =>
      (document.querySelector(".art-video-player video") as HTMLVideoElement)
        .currentTime,
  );
  expect(after).toBeLessThanOrEqual(before + 0.05);
  await page.screenshot({ path: path.join(ART, "03-paused-no-autoplay.png") });
});

test("重启恢复后视频为暂停态且显示首帧画面", async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await installRealVideo(page);
  await boot(page);
  await openVideo(page);
  await assertFirstFramePaused(page);
  // 等 paneLayout 持久化（App 在 paneRoot 变化后 500ms debounce 保存）
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".art-video-player").first().waitFor({ timeout: 15000 });
  await assertFirstFramePaused(page);
  await page.screenshot({
    path: path.join(ART, "04-restored-first-frame-paused.png"),
  });
});
