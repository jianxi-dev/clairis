import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

test.describe("状态栏高度与显隐（ui-polish-batch6 4.1）", () => {
  test("状态栏高度不超过 26px", async ({ page }) => {
    await boot(page);
    const height = await page
      .getByTestId("status-bar")
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(26);
  });

  test("双击隐藏，指针进入底部热区 500ms 内显现，移出后隐藏", async ({
    page,
  }) => {
    await boot(page);
    const bar = page.getByTestId("status-bar");
    await bar.locator("span").first().dblclick();
    await expect(bar).toHaveCount(0);

    const zone = page.getByTestId("status-hotzone");
    await expect(zone).toHaveCount(1);

    await zone.hover();
    await expect(bar).toBeVisible({ timeout: 2000 });

    await page.mouse.move(400, 200);
    await page.mouse.move(400, 260);
    await expect(bar).toHaveCount(0, { timeout: 3000 });
  });
});

test.describe("主题下拉弹窗（ui-polish-batch6 5.1）", () => {
  test("悬停弹出四项，点击暗色后切换并关闭", async ({ page }) => {
    await boot(page);
    await page.getByTestId("theme-entry").hover();

    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });
    await expect(menu.locator("button")).toHaveCount(4);

    await page.getByTestId("theme-option-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(menu).toHaveCount(0);
  });
});

test.describe("主页入口（ui-polish-batch6 6.1）", () => {
  test("点击主页回到启动页", async ({ page }) => {
    await boot(page);
    await page.getByTestId("home-entry").click();
    await expect(page.getByTestId("portal")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("页面宽度调整面板（ui-polish-batch6 6.2）", () => {
  test("三档预设与滑块，选择后宽度同步", async ({ page }) => {
    await boot(page);
    const widthText = page.getByTestId("status-width");
    await expect(widthText).toHaveText(/^\d+px$/);

    await widthText.click();
    const panel = page.getByTestId("width-panel");
    await expect(panel).toBeVisible({ timeout: 3000 });
    await expect(panel.locator("button")).toHaveCount(3);
    await expect(page.getByTestId("width-slider")).toHaveCount(1);

    await page.getByTestId("width-preset-720").click();
    await expect(widthText).toHaveText("720px");
  });
});
