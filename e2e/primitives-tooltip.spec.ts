import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * 基件 C（useTipMeasure + 方位判定抽模块）真实浏览器验收（#1710 / 2.3）。
 *
 * 单测覆盖了贴顶/贴底的方位翻转与锚点夹取（`src/__tests__/ui/tipPlacement.test.ts`），
 * 这里验证的是**接线**：抽出模块后 TooltipLayer 仍能在真实页面接管 title、按延迟弹出胶囊、
 * 移开后不留残留、且始终在视口内。
 */

const ARTIFACTS = ".artifacts/1710";

test.beforeAll(() => {
  mkdirSync(ARTIFACTS, { recursive: true });
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/?showcase", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-showcase="iconbutton-18-enabled"]', {
    timeout: 30000,
  });
}

const ICON_BTN = '[data-showcase="iconbutton-18-enabled"]';

test("悬停图标按钮后弹出胶囊提示，文案来自 title", async ({ page }) => {
  await boot(page);
  await page.locator(ICON_BTN).hover();
  const tip = page.locator('[role="tooltip"]');
  await expect(tip).toBeVisible({ timeout: 8000 });
  await expect(tip).toContainText("设置");
  await page.screenshot({
    path: `${ARTIFACTS}/01-tooltip-visible.png`,
    fullPage: false,
  });
});

test("提示矩形完全在视口内", async ({ page }) => {
  await boot(page);
  await page.locator(ICON_BTN).hover();
  const tip = page.locator('[role="tooltip"]');
  await expect(tip).toBeVisible({ timeout: 8000 });
  const box = await tip.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left,
      y: r.top,
      right: r.right,
      bottom: r.bottom,
      w: window.innerWidth,
      h: window.innerHeight,
    };
  });
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.w);
  expect(box.bottom).toBeLessThanOrEqual(box.h);
});

test("移开指针后提示消失且 DOM 无残留", async ({ page }) => {
  await boot(page);
  await page.locator(ICON_BTN).hover();
  await expect(page.locator('[role="tooltip"]')).toBeVisible({ timeout: 8000 });

  await page.mouse.move(5, 400);
  await expect(page.locator('[role="tooltip"]')).toHaveCount(0, {
    timeout: 5000,
  });
  expect(await page.locator(".app-tip").count()).toBe(0);
  await page.screenshot({
    path: `${ARTIFACTS}/02-tooltip-gone.png`,
    fullPage: false,
  });
});

test("暗色主题下提示同样可见且不越界", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.locator(ICON_BTN).hover();
  const tip = page.locator('[role="tooltip"]');
  await expect(tip).toBeVisible({ timeout: 8000 });
  const box = await tip.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { right: r.right, bottom: r.bottom, w: window.innerWidth, h: window.innerHeight };
  });
  expect(box.right).toBeLessThanOrEqual(box.w);
  expect(box.bottom).toBeLessThanOrEqual(box.h);
  await page.screenshot({
    path: `${ARTIFACTS}/03-tooltip-dark.png`,
    fullPage: false,
  });
});

test("没有 title 的按钮不触发提示（不越权接管）", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="button-secondary-md"]').hover();
  await page.waitForTimeout(2500);
  expect(await page.locator('[role="tooltip"]').count()).toBe(0);
  await page.screenshot({
    path: `${ARTIFACTS}/04-no-tooltip-without-title.png`,
    fullPage: false,
  });
});
