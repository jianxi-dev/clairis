// DS-9 阅读预设面：默认三套、点选应用三项、改名/热应用生效。
import { test, expect, type Page } from "@playwright/test";

const APP_URL = process.env.READER_PRESETS_APP_URL ?? "http://localhost:1420";

async function boot(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/presets/doc.md", "# 标题\n\n正文。", "doc.md");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

async function openPresetRow(page: Page) {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setScene("settings");
  });
  await page.locator('[data-settings-nav="reading"]').click();
  await expect(page.locator('[data-testid^="reader-preset-"]').first()).toBeVisible({
    timeout: 5000,
  });
}

test("默认三套预设可见，点选「宽屏」应用三项并落盘", async ({ page }) => {
  await boot(page);
  await openPresetRow(page);

  const labels = await page
    .locator('[data-testid^="reader-preset-"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  expect(labels).toEqual(["紧凑", "标准", "宽屏"]);

  await page.locator('[data-testid="reader-preset-wide"]').click();

  const config = await page.evaluate(
    () => (window as unknown as Record<string, any>).__biaoyue_editor_store__.getState().config,
  );
  expect(config.readerFontSize).toBe(19);
  expect(config.readerWidth).toBe(1280);
  expect(config.readerSkin).toBe("paper");
  // 落盘：行宽控件显示归整后的值
  await expect(page.getByTestId("reader-width-value")).toHaveText("1280px", {
    timeout: 3000,
  });
});

test("改预设文件后 1 秒内热应用：按钮改名且不含旧名", async ({ page }) => {
  await boot(page);
  await openPresetRow(page);

  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_reader_presets__ = [
      { id: "compact", label: "紧凑", fontSize: 15, width: 960, skin: "paper" },
      { id: "standard", label: "标准", fontSize: 17, width: 1080, skin: "paper" },
      { id: "wide", label: "超宽", fontSize: 21, width: 1320, skin: "indigo" },
    ];
    win.__mock_emit__("surfaces-changed", "reader-presets");
  });

  await expect(page.locator('[data-testid="reader-preset-wide"]')).toHaveText("超宽", {
    timeout: 3000,
  });
  const labels = await page
    .locator('[data-testid^="reader-preset-"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  expect(labels).not.toContain("宽屏");

  await page.locator('[data-testid="reader-preset-wide"]').click();
  const config = await page.evaluate(
    () => (window as unknown as Record<string, any>).__biaoyue_editor_store__.getState().config,
  );
  expect(config.readerFontSize).toBe(21);
  expect(config.readerWidth).toBe(1320);
  expect(config.readerSkin).toBe("indigo");
});
