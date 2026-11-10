import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");

async function openMedia(page: Page, file: string): Promise<void> {
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
        path: "/tmp/movies/ep2.mp4",
        name: "ep2.mp4",
        kind: "video",
        target: "ep2",
      },
    ];
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((p) => {
    const win = window as unknown as Record<string, unknown>;
    (win.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      p,
      "",
      p.split("/").pop() ?? p,
    );
  }, file);
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
}

async function withRealVideo(page: Page): Promise<void> {
  await page.evaluate(async (b64) => {
    const video = document.querySelector(
      ".art-video-player video",
    ) as HTMLVideoElement;
    video.src = `data:video/mp4;base64,${b64}`;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
  }, TINY_MP4);
  await page.waitForTimeout(200);
}

test("全屏后时间戳窗口仍可见且层级在播放器之上", async ({ page }) => {
  await openMedia(page, "/tmp/movies/ep1.mp4");
  await withRealVideo(page);
  await page.locator('.art-control[data-name="note"]').click();
  const note = page.locator('[data-testid="timestamp-note"]');
  await expect(note).toBeVisible({ timeout: 3000 });
  await page.locator('.art-control[data-name="fullscreen"]').click();
  await page.waitForTimeout(500);
  await expect(note).toBeVisible();
  const z = await note.evaluate((el) => Number(getComputedStyle(el).zIndex));
  expect(z).toBeGreaterThan(1000);
  const dir = process.env.EVIDENCE_DIR;
  if (dir) {
    await page.screenshot({ path: `${dir}/fullscreen-note.png` });
  }
});
