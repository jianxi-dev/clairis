import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.describe("外壳顶栏与沉浸入口（ui-polish-batch6 1.1）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_store__?.getState?.().setScene("workspace");
    });
    await page.waitForSelector('[data-testid="pane-header"]', {
      timeout: 15000,
    });
  });

  test("窗口顶部没有品牌横条", async ({ page }) => {
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByText("标月", { exact: true })).toHaveCount(0);
  });

  test("页签条贴内容区顶缘，上方无空白带", async ({ page }) => {
    const bodyTop = await page
      .locator('[data-testid="workspace-body"]')
      .evaluate((el) => el.getBoundingClientRect().top);
    const headerTop = await page
      .locator('[data-testid="pane-header"]')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.round(headerTop - bodyTop)).toBe(0);
  });

  test("沉浸入口只留图标且保留可访问名", async ({ page }) => {
    const btn = page.getByTestId("immersive-entry");
    await expect(btn).toBeVisible();

    const textNodes = await btn.evaluate(
      (el) =>
        Array.from(el.childNodes).filter(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
        ).length,
    );
    expect(textNodes).toBe(0);

    const label = await btn.getAttribute("aria-label");
    expect(label ?? "").toContain("沉浸阅读");
  });
});
