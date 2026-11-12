import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const WHEEL = '[data-testid="selection-roulette"]';
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/regression-566.md",
      "# 标题\n\n正文。",
      "regression-566.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
}

async function openWheel(page: Page) {
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator(WHEEL);
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
  return wheel;
}

test("三层展开后根扇区 opacity 为 0.9", async ({ page }) => {
  await boot(page);
  const wheel = await openWheel(page);
  await wheel.locator('[data-sector="convert"]').click();
  await wheel
    .locator('.sr-sec[data-band="2"][data-action="convert-heading-group"]')
    .click({ force: true });
  await expect(page.locator('.sr-sec[data-band="3"]')).toHaveCount(6);
  await expect(wheel.locator('[data-sector="convert"]')).toHaveCSS(
    "opacity",
    "0.9",
  );
});

test("关闭轮盘后无残留节点", async ({ page }) => {
  await boot(page);
  await openWheel(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(WHEEL)).toHaveCount(0, { timeout: 3000 });
});

test("证据：轮盘四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  const wheel = await openWheel(page);
  await page.screenshot({ path: `${dir}/wheel-default.png` });
  await wheel.locator('[data-sector="convert"]').click();
  await page.screenshot({ path: `${dir}/wheel-sub-open.png` });
  await wheel
    .locator('.sr-sec[data-band="2"][data-action="convert-heading-group"]')
    .click({ force: true });
  await page.screenshot({ path: `${dir}/wheel-third-open.png` });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/wheel-closed.png` });
});
