import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/selection-capsule.md", body, "capsule.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
    win.__biaoyue_editor_store__
      .getState()
      .setConfig({ selectionToolbar: "capsule" });
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

test("胶囊模式选中文字出单行工具条，轮盘不出现", async ({ page }) => {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });

  const capsule = page.locator('[data-testid="selection-capsule"]');
  await expect(capsule).toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-testid="selection-roulette"]')).toHaveCount(
    0,
  );
  await expect(capsule.locator(".capsule-row")).toHaveCount(1);

  const primary = capsule.locator(".capsule-row-single");
  for (const action of [
    "format-bold",
    "format-italic",
    "capsule-font",
    "capsule-bg",
    "clear-format",
  ]) {
    await expect(primary.locator(`[data-action="${action}"]`)).toHaveCount(1);
  }
});

test("胶囊按钮可直接加粗，切回轮盘后胶囊消失", async ({ page }) => {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  const capsule = page.locator('[data-testid="selection-capsule"]');
  await expect(capsule).toBeVisible({ timeout: 3000 });

  await capsule.locator('[data-action="format-bold"]').click();
  await expect.poll(() => content(page)).toMatch(/\*\*第一段正文\s*\*\*/);

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_editor_store__
      .getState()
      .setConfig({ selectionToolbar: "roulette" });
  });
  await page.mouse.click(8, 300);
  await page.locator(".cm-line").nth(4).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  await expect(page.locator('[data-testid="selection-roulette"]')).toBeVisible({
    timeout: 3000,
  });
  await expect(page.locator('[data-testid="selection-capsule"]')).toHaveCount(
    0,
  );
});

test("设置页可在轮盘与胶囊之间切换", async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_editor_store__
      .getState()
      .setConfig({ selectionToolbar: "roulette" });
  });
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();

  const capsuleBtn = page.locator('[data-testid="selection-toolbar-capsule"]');
  const rouletteBtn = page.locator(
    '[data-testid="selection-toolbar-roulette"]',
  );
  await expect(rouletteBtn).toHaveAttribute("aria-pressed", "true");
  await capsuleBtn.click();
  await expect(capsuleBtn).toHaveAttribute("aria-pressed", "true");
  await expect(rouletteBtn).toHaveAttribute("aria-pressed", "false");
});
