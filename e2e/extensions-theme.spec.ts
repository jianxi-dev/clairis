import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
});

async function gotoWithTokens(page: Page, tokens: Record<string, string>) {
  await page.addInitScript((t) => {
    (window as unknown as Record<string, unknown>).__biaoyue_extensions__ = {
      snippets: [],
      templates: [],
      theme: { tokens: t, warnings: [] },
      warnings: [],
    };
  }, tokens);
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
}

test("注入的 theme token 覆盖 :root 变量且只挂一个 style", async ({ page }) => {
  await gotoWithTokens(page, { "--app-accent": "#c2410c" });

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--app-accent")
            .trim(),
        ),
      { timeout: 5000 },
    )
    .toBe("#c2410c");

  expect(await page.locator("#user-theme-tokens").count()).toBe(1);
});

test("无 token 时不创建 style 元素", async ({ page }) => {
  await gotoWithTokens(page, {});
  await expect(page.locator("#user-theme-tokens")).toHaveCount(0);
});
