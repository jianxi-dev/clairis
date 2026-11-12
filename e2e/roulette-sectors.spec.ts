import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/sectors.md",
      "# 标题\n\n正文。",
      "sectors.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
}

async function openWheel(page: Page) {
  const line = page.locator(".cm-line").nth(1);
  await line.click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
  return wheel;
}

test("配置去掉 columns 后扇区数量与集合变化", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_editor_store__
      .getState()
      .setConfig({ rouletteSectors: ["smart", "format"] });
  });
  const wheel = await openWheel(page);
  await expect(wheel.locator("[data-sector]")).toHaveCount(2);
  await expect(wheel.locator('[data-sector="columns"]')).toHaveCount(0);
});

test("未知扇区被忽略", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_editor_store__
      .getState()
      .setConfig({ rouletteSectors: ["smart", "bogus"] });
  });
  const wheel = await openWheel(page);
  await expect(wheel.locator("[data-sector]")).toHaveCount(1);
});

test("缺省配置保持 8 个扇区", async ({ page }) => {
  await boot(page);
  const wheel = await openWheel(page);
  await expect(wheel.locator("[data-sector]")).toHaveCount(8);
});

async function openSettingsEditor(page: Page) {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
}

async function closeSettings(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0, {
    timeout: 3000,
  });
}

test("设置中取消勾选分栏后轮盘为 7 个扇区", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page
    .locator('[data-testid="roulette-sector-toggle-columns"]')
    .uncheck();
  await page.waitForTimeout(300);
  await closeSettings(page);
  const wheel = await openWheel(page);
  await expect(wheel.locator("[data-sector]")).toHaveCount(7);
  await expect(wheel.locator('[data-sector="columns"]')).toHaveCount(0);
});

test("上移一项改变扇区顺序", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page.locator('[data-testid="roulette-sector-up-format"]').click();
  await page.waitForTimeout(300);
  await closeSettings(page);
  const wheel = await openWheel(page);
  const order = await wheel
    .locator("[data-sector]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-sector")));
  expect(order.indexOf("format")).toBeLessThan(order.indexOf("clear"));
});

test("恢复默认回到 8 个扇区", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page
    .locator('[data-testid="roulette-sector-toggle-columns"]')
    .uncheck();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="roulette-sector-reset"]').click();
  await page.waitForTimeout(300);
  await closeSettings(page);
  const wheel = await openWheel(page);
  await expect(wheel.locator("[data-sector]")).toHaveCount(8);
});

test("取消勾选后重启仍保持", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page
    .locator('[data-testid="roulette-sector-toggle-columns"]')
    .uncheck();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/sectors2.md",
      "# 标题\n\n正文。",
      "sectors2.md",
    );
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(300);
  const wheel = await openWheel(page);
  await expect(wheel.locator("[data-sector]")).toHaveCount(7);
});
