import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * 对照场验收（ui-quality-primitives-v1 / 2.4，票 #1712）。
 *
 * 断言的是「四基件 × 六态 = 24 个锚点」这一可量化事实，以及明暗切换后仍为 24
 * 且视觉真的换了主题——不是「页面能打开」。
 */

const ARTIFACTS = ".artifacts/1712";

test.beforeAll(() => {
  mkdirSync(ARTIFACTS, { recursive: true });
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/?showcase", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-showcase="button-default"]', { timeout: 30000 });
}

const ANCHORS = '[data-section="matrix"] [data-showcase]';

test("四基件 × 六态 = 24 个锚点，每个基件各 6 个", async ({ page }) => {
  await boot(page);
  await expect(page.locator(ANCHORS)).toHaveCount(24);
  for (const primitive of ["button", "iconbutton", "menu", "tooltip"]) {
    await expect(
      page.locator(`[data-section="matrix"] [data-showcase^="${primitive}-"]`),
    ).toHaveCount(6);
  }
  await page.screenshot({ path: `${ARTIFACTS}/01-matrix-light.png`, fullPage: true });
});

test("切到暗色后仍是 24 个锚点，且底色真的变了", async ({ page }) => {
  await boot(page);
  const bgLight = await page
    .locator('[data-showcase="button-default"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.locator("[data-showcase-theme-toggle]").click();
  await expect(page.locator("[data-showcase-theme-toggle]")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await expect(page.locator(ANCHORS)).toHaveCount(24);
  const bgDark = await page
    .locator('[data-showcase="button-default"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgDark).not.toBe(bgLight);
  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  expect(isDark).toBe(true);
  await page.screenshot({ path: `${ARTIFACTS}/02-matrix-dark.png`, fullPage: true });
});

test("空态单元格不留空白块", async ({ page }) => {
  await boot(page);
  const cell = page.locator('[data-showcase="iconbutton-empty"]');
  await expect(cell).toBeVisible();
  await expect(cell).toContainText("图标缺键");
  const box = await cell.evaluate((el) => el.getBoundingClientRect());
  expect(box.height).toBeGreaterThan(40);
  await cell.screenshot({ path: `${ARTIFACTS}/04-empty-state.png` });
});

test("菜单与提示样张各自可见（形态对照不是空壳）", async ({ page }) => {
  await boot(page);
  for (const anchor of ["menu-open", "menu-icons", "menu-shortcuts", "menu-disabled"]) {
    await expect(
      page.locator(`[data-showcase="${anchor}"] [role="menuitem"]`).first(),
    ).toBeVisible();
  }
  for (const side of ["above", "below", "left", "right"]) {
    await expect(
      page.locator(`[data-showcase="tooltip-${side}"] [role="tooltip"]`),
    ).toBeVisible();
  }
  await page.locator('[data-showcase="tooltip-above"]').screenshot({
    path: `${ARTIFACTS}/03-tooltip-four-sides.png`,
  });
});
