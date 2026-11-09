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
    expect(
      await page
        .getByTestId("outline-btn")
        .evaluate((el) => getComputedStyle(el).borderTopWidth),
    ).toBe("0px");

    await page.getByTestId("outline-btn").click();
    await expect(panel).toHaveAttribute("data-pinned", "true");
    const pinned = await panel.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth,
    );
    expect(pinned).toBe("1px");
    expect(
      await page
        .getByTestId("outline-btn")
        .evaluate((el) => getComputedStyle(el).borderTopWidth),
    ).toBe("1px");
  });
});

test("大纲按钮右缘与栏目更多按钮右缘对齐", async ({ page }) => {
  await boot(page);
  const gap = await page.evaluate(() => {
    const outline = document.querySelector('[data-testid="outline-btn"]')!;
    const more = document.querySelector('[data-testid="pane-menu-button"]')!;
    return (
      more.getBoundingClientRect().right - outline.getBoundingClientRect().right
    );
  });
  expect(Math.abs(gap)).toBeLessThanOrEqual(1);
  expect(
    await page
      .locator(".biaoyue-outline")
      .evaluate((el) => getComputedStyle(el).right),
  ).toBe("4px");
});
