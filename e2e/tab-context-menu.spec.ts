import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/e2e-ctx.md", "# 标题\n\n内容。", "ctx");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

test.describe("页签右键菜单图标（ui-polish-batch6 3.1）", () => {
  test("每一项都带图标", async ({ page }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const labels = ["向右分栏", "向下分栏", "关闭", "关闭其他"];
    for (const label of labels) {
      const item = page.getByRole("button", { name: label, exact: true });
      await expect(item).toBeVisible();
      expect(await item.locator("svg").count()).toBe(1);
    }
  });
});

test.describe("「关闭其他」图标可辨（shell-media-batch7 3.1）", () => {
  test("单一叉、无虚线、与「关闭」不同", async ({ page }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const svg = page
      .getByRole("button", { name: "关闭其他", exact: true })
      .locator("svg");
    expect(await svg.locator("[stroke-dasharray]").count()).toBe(0);

    const paths = await svg
      .locator("path")
      .evaluateAll((els) => els.map((e) => e.getAttribute("d") ?? ""));
    expect(paths).toHaveLength(3);
    expect((paths[0].match(/M/gi) ?? []).length).toBe(2);

    const closeD = await page
      .getByRole("button", { name: "关闭", exact: true })
      .locator("svg path")
      .first()
      .getAttribute("d");
    expect(paths.join("|")).not.toBe(closeD);
  });
});
