import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");

async function openPlayer(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/Users/test/clip.mp4", "", "clip.mp4");
  });
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
  await page.evaluate(async (b64) => {
    const video = document.querySelector(
      ".art-video-player video",
    ) as HTMLVideoElement;
    video.src = `data:video/mp4;base64,${b64}`;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
    video.pause();
  }, TINY_MP4);
  await page.waitForTimeout(300);
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const player = document.querySelector(".art-video-player")!;
    const box = player.getBoundingClientRect();
    const host = player.parentElement!.getBoundingClientRect();
    const video = player.querySelector("video")!;
    return {
      w: box.width,
      h: box.height,
      hostW: host.width,
      hostH: host.height,
      naturalRatio: video.videoWidth / video.videoHeight,
      boxRatio: box.width / box.height,
    };
  });
}

async function resizePane(page: Page, ratio: number): Promise<void> {
  const branchId = await page.evaluate((r) => {
    const st = window as unknown as Record<string, any>;
    st.__biaoyue_store__.getState().splitPane("row");
    const root = st.__biaoyue_store__.getState().paneRoot;
    st.__biaoyue_store__.getState().setPaneRatio(root.id, r);
    return root.id as string;
  }, ratio);
  expect(branchId).toBeTruthy();
}

test("分栏尺寸变化后视频按新容器重新适配", async ({ page }) => {
  await openPlayer(page);
  await resizePane(page, 0.72);

  await expect
    .poll(
      async () => {
        const m = await measure(page);
        return Math.abs(m.boxRatio - m.naturalRatio) < 0.02
          ? "fitted"
          : "stale";
      },
      { timeout: 3000 },
    )
    .toBe("fitted");

  const m = await measure(page);
  expect(m.h).toBeLessThanOrEqual(m.hostH + 1);
  expect(m.w).toBeLessThanOrEqual(m.hostW + 1);
  expect(Math.max(m.w / m.hostW, m.h / m.hostH)).toBeGreaterThan(0.98);
});

test("返回单栏后视频仍保持原始宽高比", async ({ page }) => {
  await openPlayer(page);
  await resizePane(page, 0.3);
  await page.evaluate(() => {
    const st = window as unknown as Record<string, any>;
    st.__biaoyue_store__.getState().collapsePanes();
  });

  await expect
    .poll(
      async () => {
        const m = await measure(page);
        return Math.abs(m.boxRatio - m.naturalRatio) < 0.02
          ? "fitted"
          : "stale";
      },
      { timeout: 3000 },
    )
    .toBe("fitted");
});
