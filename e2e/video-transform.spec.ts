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
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/Users/test/clip.mp4", "", "clip.mp4");
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
  await page.waitForTimeout(200);
}

async function openVisual(page: Page): Promise<void> {
  await page.locator(".art-control[data-name='visual']").click();
  await expect(page.getByTestId("visual-panel")).toBeVisible({ timeout: 3000 });
}

async function videoStyle(page: Page) {
  return page.evaluate(() => {
    const v = document.querySelector(".art-video-player video") as HTMLElement;
    const cs = getComputedStyle(v);
    return {
      transform: v.style.transform,
      filter: v.style.filter,
      computed: cs.transform,
    };
  });
}

test("画面面板提供旋转/放大/缩小/亮度/重置", async ({ page }) => {
  await openPlayer(page);
  await openVisual(page);
  await expect(page.locator(".art-control-rotate")).toBeVisible();
  await expect(page.getByTestId("visual-zoom-in")).toBeVisible();
  await expect(page.getByTestId("visual-zoom-out")).toBeVisible();
  await expect(page.getByTestId("visual-brightness")).toBeVisible();
  await expect(page.getByTestId("visual-reset")).toBeVisible();
});

test("连续四次旋转回到 0°，缩放上限 4 倍", async ({ page }) => {
  await openPlayer(page);
  await openVisual(page);
  await page.locator(".art-control-rotate").click();
  expect((await videoStyle(page)).transform).toContain("rotate(90deg)");
  for (let i = 0; i < 3; i += 1)
    await page.locator(".art-control-rotate").click();
  expect((await videoStyle(page)).transform).toContain("rotate(0deg)");

  await page.locator(".art-control[data-name='visual']").click();
  await expect(page.getByTestId("visual-panel")).toBeVisible({ timeout: 3000 });
  for (let i = 0; i < 20; i += 1)
    await page.getByTestId("visual-zoom-in").click();
  expect((await videoStyle(page)).transform).toContain("scale(4)");
});

test("亮度可调到 150%", async ({ page }) => {
  await openPlayer(page);
  await openVisual(page);
  await page.getByTestId("visual-brightness").fill("150");
  expect((await videoStyle(page)).filter).toBe("brightness(1.5)");
});

test("切换文件后画面状态复位", async ({ page }) => {
  await openPlayer(page);
  await openVisual(page);
  await page.locator(".art-control-rotate").click();
  await page.getByTestId("visual-zoom-in").click();
  await page.getByTestId("visual-brightness").fill("150");
  await page
    .getByTestId("visual-panel")
    .press("Escape")
    .catch(() => {});
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/Users/test/clip2.mp4", "", "clip2.mp4");
  });
  await page.waitForTimeout(600);
  const s = await videoStyle(page);
  expect(s.transform).toContain("rotate(0deg)");
  expect(s.transform).toContain("scale(1)");
  expect(s.filter).toBe("brightness(1)");
});

test("音频文件不显示画中画面板入口", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/Users/test/song.mp3", "", "song.mp3");
  });
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
  await expect(page.locator(".art-control[data-name='visual']")).toBeHidden();
});
