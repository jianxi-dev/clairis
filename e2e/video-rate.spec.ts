import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 视频倍速（#369）：菜单档位、playbackRate 生效、变调修正、切文件复位。
 *
 * 断言落在 `<video>` 元素自身的属性上——`playbackRate` 是浏览器真实生效值，
 * 只看菜单里打了勾不代表视频真的加速。
 */

const ART = path.resolve(process.cwd(), ".artifacts/369");
mkdirSync(ART, { recursive: true });

async function openPlayer(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openMedia(page, "/Users/test/clip.mp4");
}

async function openMedia(page: Page, filePath: string) {
  await page.evaluate((p) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(p, "", p.split("/").pop() ?? p);
  }, filePath);
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
}

async function videoState(page: Page) {
  return page
    .locator(".art-video-player video")
    .first()
    .evaluate((node) => {
      const video = node as HTMLVideoElement & {
        webkitPreservesPitch?: boolean;
      };
      return {
        rate: video.playbackRate,
        preservesPitch: video.preservesPitch,
        webkitPreservesPitch: video.webkitPreservesPitch,
      };
    });
}

async function pickRate(page: Page, label: string) {
  await page.locator(".art-control[data-name='rate']").click();
  const item = page.locator(".rate-menu-item", { hasText: label }).first();
  await item.click();
}

test("倍速菜单恰好六档，主控件为速度表图标", async ({ page }) => {
  await openPlayer(page);

  const button = page.locator(".art-control[data-name='rate']");
  await expect(button.locator("svg[data-icon='speed']")).toHaveCount(1);

  await button.click();
  await expect(page.locator(".rate-menu-item")).toHaveCount(6);
  await expect(page.locator(".rate-menu-item")).toHaveText([
    "0.5×",
    "0.75×",
    "1.0× ✓",
    "1.25×",
    "1.5×",
    "2.0×",
  ]);
  await page.screenshot({ path: path.join(ART, "01-rate-menu.png") });
});

test("选 1.5× 后播放速率与变调修正同时生效", async ({ page }) => {
  await openPlayer(page);
  await pickRate(page, "1.5×");

  await expect(
    page.locator(".art-control[data-name='rate'] svg[data-icon='speed']"),
  ).toHaveCount(1);
  const state = await videoState(page);
  expect(state.rate).toBe(1.5);
  expect(state.preservesPitch).toBe(true);
  if (state.webkitPreservesPitch !== undefined) {
    expect(state.webkitPreservesPitch).toBe(true);
  }
  await page.screenshot({ path: path.join(ART, "02-rate-1_5.png") });
});

test("关闭菜单后倍速保持，重开菜单标记当前档位", async ({ page }) => {
  await openPlayer(page);
  await pickRate(page, "2.0×");
  await expect(page.locator(".rate-menu")).toHaveCount(0);

  const button = page.locator(".art-control[data-name='rate']");
  await expect(button.locator("svg[data-icon='speed']")).toHaveCount(1);
  await button.click();
  await expect(
    page.locator(".rate-menu-item", { hasText: "2.0×" }).first(),
  ).toHaveAttribute("aria-checked", "true");
  expect((await videoState(page)).rate).toBe(2);
  await page.screenshot({ path: path.join(ART, "04-rate-reopen.png") });
});

test("切换到另一个视频后倍速回到 1.0", async ({ page }) => {
  await openPlayer(page);
  await pickRate(page, "1.5×");
  expect((await videoState(page)).rate).toBe(1.5);

  await openMedia(page, "/Users/test/clip2.mp4");
  const state = await videoState(page);
  expect(state.rate).toBe(1);
  await expect(
    page.locator(".art-control[data-name='rate'] svg[data-icon='speed']"),
  ).toHaveCount(1);
  await page.screenshot({ path: path.join(ART, "03-switch-reset.png") });
});
