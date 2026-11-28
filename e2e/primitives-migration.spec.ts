import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * 迁移验收（ui-quality-primitives-v1 / 2.6，票 #1713 首批 6 处）。
 *
 * 断言的是「这些控件真的由基件渲染」——检查基件类名与命中区几何，
 * 而不是「按钮还在」。设置页 3 处走 Button，阅读轨 3 处走 IconButton(chrome)。
 */

const ARTIFACTS = ".artifacts/1713";

test.beforeAll(() => {
  mkdirSync(ARTIFACTS, { recursive: true });
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 20000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="extensions"]').click();
  await expect(page.locator('[data-testid="extension-row"]')).toHaveCount(2);
}

async function setDark(page: Page, dark: boolean): Promise<void> {
  await page.evaluate((on) => {
    document.documentElement.classList.toggle("dark", on);
  }, dark);
}

test("设置页 3 个扩展按钮由 Button 基件渲染，禁用语义保留", async ({ page }) => {
  await boot(page);
  await openSettings(page);

  for (const id of ["extension-open", "extension-export", "extension-preview"]) {
    const btn = page.locator(`[data-testid="${id}"]`).first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/bp-btn/);
    await expect(btn).toHaveClass(/bp-btn--secondary/);
  }
  await expect(page.locator('[data-testid="extension-open"]').first()).toBeDisabled();
  await expect(page.locator('[data-testid="extension-export"]').first()).toBeDisabled();

  await page.screenshot({ path: `${ARTIFACTS}/01-settings-light.png` });
  await setDark(page, true);
  await page.screenshot({ path: `${ARTIFACTS}/02-settings-dark.png` });
  await setDark(page, false);
});

test("阅读轨动作按钮由 IconButton(chrome) 渲染，命中区 ≥24", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/mig/a.md", "# A\n\n正文。", "a.md");
    w.__biaoyue_openFile__("/tmp/mig/b.md", "# B\n\n正文。", "b.md");
  });
  await page.hover('[data-testid="rail-edge"]');
  await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "pinned",
  );

  const card = page.locator('[data-testid="rail-item"]').first();
  await card.hover();
  const actions = card.locator('[data-testid="rail-card-action"]');
  await expect(actions.first()).toBeVisible();

  const count = await actions.count();
  expect(count).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < 3; i += 1) {
    const el = actions.nth(i);
    await expect(el).toHaveClass(/bp-icon-btn/);
    await expect(el).toHaveClass(/bp-icon-btn--chrome/);
    const box = await el.evaluate((n) => n.getBoundingClientRect());
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  }

  await page.screenshot({ path: `${ARTIFACTS}/03-rail-actions-light.png` });
  await setDark(page, true);
  await card.hover();
  await page.screenshot({ path: `${ARTIFACTS}/04-rail-actions-dark.png` });
  await setDark(page, false);
});
