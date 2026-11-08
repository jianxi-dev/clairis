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
