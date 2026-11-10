import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

test("双击页签条空白处新建 Markdown 页签", async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setScene("workspace");
  });
  const strip = page.locator(".tab-strip").first();
  await expect(strip).toBeVisible();
  await expect
    .poll(async () => (await strip.boundingBox())?.height ?? 0)
    .toBeGreaterThan(0);
  const box = (await strip.boundingBox())!;
  await page.mouse.dblclick(
    box.x + Math.min(box.width - 12, 240),
    box.y + box.height / 2,
  );

  await expect(page.locator("[data-tab-id]")).toHaveCount(1);
  const tab = page.locator("[data-tab-id]").first();
  await expect(tab).toContainText("未命名");
  await expect(
    page.locator('[data-testid="pane-mode"]').first(),
  ).toHaveAttribute("data-mode", "edit");
});

test("已有页签时双击空白仍新建，不误触双击重命名", async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/tab-blank.md",
      "# 标题\n",
      "tab-blank.md",
    );
  });
  await expect(page.locator("[data-tab-id]")).toHaveCount(1);

  const strip = page.locator(".tab-strip").first();
  const box = (await strip.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width - 16, box.y + box.height / 2);

  await expect(page.locator("[data-tab-id]")).toHaveCount(2);
  await expect(page.locator('[data-testid="tab-title-input"]')).toHaveCount(0);
});
