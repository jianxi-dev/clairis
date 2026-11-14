import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

test("双击页签条空白不新建页签，也不进重命名（D15）", async ({ page }) => {
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

  // D15：空白双击是窗口级最大化/还原，不再新建文档；也不触发页签重命名。
  await expect(page.locator("[data-tab-id]")).toHaveCount(0);
  await expect(page.locator('[data-testid="tab-title-input"]')).toHaveCount(0);
});

test("已有页签时：双击空白不动页签，双击页签进重命名（D15）", async ({
  page,
}) => {
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
  await expect(page.locator("[data-tab-id]")).toHaveCount(1);
  await expect(page.locator('[data-testid="tab-title-input"]')).toHaveCount(0);

  // 双击页签本体才是重命名。
  await page.locator("[data-tab-id]").first().dblclick();
  await expect(page.locator('[data-testid="tab-title-input"]')).toHaveCount(1);
});
