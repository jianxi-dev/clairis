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
      "/tmp/roulette-batch15.md",
      "# 标题\n\n正文。",
      "batch15.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
}

async function selectLine(page: Page) {
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
}

test("选中文字不再自动弹轮盘", async ({ page }) => {
  await boot(page);
  await selectLine(page);
  await page.waitForTimeout(400);
  await expect(page.locator(WHEEL)).toHaveCount(0);
});

test("按开关快捷键召唤轮盘，默认圆心形态无可见扇区", async ({ page }) => {
  await boot(page);
  await selectLine(page);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(WHEEL)).toHaveCount(1);
  await expect(page.locator(`${WHEEL}[data-form="hub"]`)).toHaveCount(1);
  await expect(page.locator(`${WHEEL} [data-sector]:visible`)).toHaveCount(0);
});

test("双击圆心切整盘，中键拖动位置写入配置并在重载后保持", async ({ page }) => {
  await boot(page);
  await selectLine(page);
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator(WHEEL);
  await expect(wheel).toHaveCount(1);

  await wheel.locator('[data-testid="roulette-center"]').dblclick();
  await expect(page.locator(`${WHEEL}[data-form="disk"]`)).toHaveCount(1);
  const sectors = wheel.locator("[data-sector]:visible");
  expect(await sectors.count()).toBeGreaterThan(0);

  const before = await wheel.evaluate((el) => ({
    left: el.style.left,
    top: el.style.top,
  }));
  const box = (await wheel.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(cx + 90, cy + 70, { steps: 6 });
  await page.mouse.up({ button: "middle" });

  const after = await wheel.evaluate((el) => ({
    left: el.style.left,
    top: el.style.top,
  }));
  expect(after.left).not.toBe(before.left);
  expect(after.top).not.toBe(before.top);

  const stored = await page.evaluate(() => {
    const s = window.__biaoyue_editor_store__.getState();
    return s.config.roulettePosition ?? null;
  });
  expect(stored).not.toBeNull();
  await page.waitForTimeout(300);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/roulette-batch15b.md",
      "# 标题\n\n正文。",
      "batch15b.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(WHEEL)).toHaveCount(1);
  const restored = await page.locator(WHEEL).evaluate((el) => ({
    left: el.style.left,
    top: el.style.top,
  }));
  expect(restored.left).toBe(after.left);
  expect(restored.top).toBe(after.top);
});

test("关闭轮盘后无残留节点", async ({ page }) => {
  await boot(page);
  await selectLine(page);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(WHEEL)).toHaveCount(1);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(WHEEL)).toHaveCount(0);
});

test("设置面板可改快捷键与默认形态", async ({ page }) => {
  await boot(page);
  await page.keyboard.press(`${MOD}+,`);
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();

  const hotkey = page.locator('[data-testid="settings-roulette-hotkey"]');
  await hotkey.fill(`${MOD}+Shift+K`);
  await hotkey.press("Enter");
  await page.locator('[data-testid="settings-roulette-form-disk"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0, {
    timeout: 3000,
  });

  await selectLine(page);
  await page.keyboard.press(`${MOD}+Shift+K`);
  await expect(page.locator(WHEEL)).toHaveCount(1);
  await expect(page.locator(`${WHEEL}[data-form="disk"]`)).toHaveCount(1);
  await expect(
    page.locator(`${WHEEL} [data-sector]:visible`).first(),
  ).toBeVisible();
});
