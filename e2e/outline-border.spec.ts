import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/outline.md",
      "# 第一章\n\n正文\n\n## 小节\n\n更多正文\n",
      "outline",
    );
  });
  await page.waitForSelector('[data-testid="outline-btn"]', {
    timeout: 10000,
  });
}

test.describe("大纲浮层边框（ui-polish-batch6 11.1）", () => {
  test("未钉住无边框；钉住后 1px", async ({ page }) => {
    await boot(page);
    await page.getByTestId("outline-btn").hover();
    const panel = page.getByTestId("outline-menu");
    await expect(panel).toBeVisible();

    const unpinned = await panel.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth,
    );
    expect(unpinned).toBe("0px");

    await page.getByTestId("outline-btn").click();
    await expect(panel).toHaveAttribute("data-pinned", "true");
    const pinned = await panel.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth,
    );
    expect(pinned).toBe("1px");
  });
});
