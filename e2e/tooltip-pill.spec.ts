import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/tip.md", "# 标题\n\n正文。", "tip.md");
  });
  await page.waitForTimeout(300);
}

test("悬停功能按钮出现胶囊提示，原生矩形不再出现", async ({ page }) => {
  await boot(page);
  const btn = page.getByTestId("theme-entry");
  await btn.hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });

  const shape = await tip.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      radius: cs.borderRadius,
      height: Math.round(el.getBoundingClientRect().height),
      position: cs.position,
    };
  });
  expect(parseInt(shape.radius, 10)).toBeGreaterThanOrEqual(
    Math.round(shape.height / 2),
  );
  expect(shape.position).toBe("fixed");

  const btnTitle = await btn.getAttribute("title");
  expect(btnTitle).toBeNull();

  await page.mouse.move(10, 10);
  await expect(tip).toHaveCount(0, { timeout: 3000 });
  const restored = await btn.getAttribute("title");
  expect(restored).not.toBe("");
});

test("轮盘扇区悬停显示中文名称提示", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
  const line = page.locator(".cm-line").nth(1);
  await line.click({ clickCount: 3 });
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });

  await wheel.locator('[data-sector="convert"]').hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });
  await expect(tip).toHaveText("转换");
});
