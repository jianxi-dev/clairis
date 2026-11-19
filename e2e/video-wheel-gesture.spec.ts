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
}

function playerRect(page: Page) {
  return page.evaluate(() => {
    const player = document.querySelector(".art-video-player") as HTMLElement;
    const rect = player.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });
}

function readState(page: Page) {
  return page.evaluate(() => {
    const video = document.querySelector(
      ".art-video-player video",
    ) as HTMLVideoElement;
    const brightness = /brightness\(([\d.]+)\)/.exec(video.style.filter);
    return {
      brightness: brightness ? Number(brightness[1]) : null,
      volume: video.volume,
      transform: video.style.transform,
    };
  });
}

async function wheelAt(page: Page, x: number, y: number, deltaY: number) {
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, deltaY);
}

const evidenceDir = process.env.EVIDENCE_DIR;

async function shot(page: Page, name: string): Promise<void> {
  if (!evidenceDir) return;
  await page.screenshot({ path: `${evidenceDir}/${name}.png` });
}

test("左半无修饰键 wheel 调亮度、右半调音量", async ({ page }) => {
  await openPlayer(page);
  const rect = await playerRect(page);
  const midY = rect.top + rect.height / 2;
  const leftX = rect.left + rect.width * 0.25;
  const rightX = rect.left + rect.width * 0.75;

  const before = await readState(page);
  expect(before.brightness).toBe(1);

  await wheelAt(page, leftX, midY, -240);
  await expect
    .poll(async () => (await readState(page)).brightness)
    .toBeGreaterThan(1);
  await shot(page, "left-wheel-brightness");

  await wheelAt(page, rightX, midY, -240);
  await expect
    .poll(async () => (await readState(page)).volume)
    .toBeGreaterThan(before.volume);
  await shot(page, "right-wheel-volume");
});

test("Ctrl+wheel 仍只缩放，不改亮度与音量", async ({ page }) => {
  await openPlayer(page);
  const rect = await playerRect(page);
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const before = await readState(page);
  await page.keyboard.down("Control");
  await wheelAt(page, x, y, -240);
  await page.keyboard.up("Control");

  await expect
    .poll(async () => (await readState(page)).transform)
    .toContain("scale(1.1)");
  const after = await readState(page);
  expect(after.brightness).toBe(before.brightness);
  expect(after.volume).toBe(before.volume);
  await shot(page, "ctrl-wheel-zoom-only");
});

test("无修饰键 wheel 不触发缩放", async ({ page }) => {
  await openPlayer(page);
  const rect = await playerRect(page);
  await wheelAt(
    page,
    rect.left + rect.width * 0.25,
    rect.top + rect.height / 2,
    -240,
  );
  expect((await readState(page)).transform).toContain("scale(1)");
  await shot(page, "no-modifier-wheel-no-zoom");
});

test("touch 双指通道仍调亮度/音量", async ({ page }) => {
  await openPlayer(page);
  const result = await page.evaluate(async () => {
    const player = document.querySelector(".art-video-player") as HTMLElement;
    const video = player.querySelector("video") as HTMLVideoElement;
    const rect = player.getBoundingClientRect();
    const dispatch = (type: string, x: number, y: number): void => {
      const touch = (id: number, tx: number, ty: number) =>
        new Touch({ identifier: id, target: player, clientX: tx, clientY: ty });
      player.dispatchEvent(
        new TouchEvent(type, {
          touches:
            type === "touchend" ? [] : [touch(1, x, y), touch(2, x + 10, y)],
          bubbles: true,
          cancelable: true,
        }),
      );
    };
    const leftX = rect.left + rect.width * 0.25;
    const rightX = rect.left + rect.width * 0.75;
    const midY = rect.top + rect.height / 2;

    dispatch("touchstart", leftX, midY);
    dispatch("touchmove", leftX, midY - 120);
    dispatch("touchend", leftX, midY - 120);

    video.volume = 0.2;
    dispatch("touchstart", rightX, midY);
    dispatch("touchmove", rightX, midY - 120);
    dispatch("touchend", rightX, midY - 120);

    return { volume: video.volume };
  });
  await expect
    .poll(async () => (await readState(page)).brightness)
    .toBeGreaterThan(1);
  expect(result.volume).toBeGreaterThan(0.2);
  await shot(page, "touch-gesture-still-works");
});
