import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/commands.md",
      "# 标题\n\n正文。",
      "commands.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
}

async function openFormatBand(page: Page) {
  const line = page.locator(".cm-line").nth(1);
  await line.click({ clickCount: 3 });
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  await wheel.locator('[data-sector="format"]').click();
  await expect(wheel.locator('path[data-action="format-bold"]')).toBeVisible({
    timeout: 3000,
  });
  return wheel;
}

test("轮盘格式动作经命令注册表执行", async ({ page }) => {
  await boot(page);
  const wheel = await openFormatBand(page);
  await wheel.locator('path[data-action="format-bold"]').click();
  const content = await page.evaluate(() => {
    const s = window.__biaoyue_store__.getState();
    const tab = s.tabs[s.activeTabId];
    return tab ? tab.content : "";
  });
  expect(content).toContain("**");
});

test("关闭轮盘后无残留节点", async ({ page }) => {
  await boot(page);
  const wheel = await openFormatBand(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(wheel).toHaveCount(0, { timeout: 3000 });
});
