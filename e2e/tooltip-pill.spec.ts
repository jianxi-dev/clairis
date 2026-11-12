import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/tip.md", "# 标题\n\n正文。", "tip.md");
  });
  await page.waitForTimeout(300);
}

test("悬停功能按钮满 1 分钟出现胶囊提示，原生矩形不再出现", async ({
  page,
}) => {
  await boot(page);
  await page.clock.install();
  const btn = page.getByTestId("home-entry");
  await btn.hover();
  const tip = page.locator(".app-tip");
  await page.waitForTimeout(1200);
  await expect(tip).toHaveCount(0);
  await page.clock.fastForward(60_000);
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

test("轮盘扇区不再出现提示，只有圆心保留操作说明", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
  const line = page.locator(".cm-line").nth(1);
  await line.click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }

  await wheel.locator('[data-sector="convert"]').hover();
  await page.waitForTimeout(700);
  await expect(page.locator(".app-tip")).toHaveCount(0);
});

test("右键菜单打开期间不出现悬停提示，关闭后恢复", async ({ page }) => {
  await boot(page);
  const tab = page.locator("[data-tab-id]").first();
  await tab.click({ button: "right" });
  await expect(page.locator(".fixed.z-50").first()).toBeVisible();

  const btn = page.getByTestId("pane-mode").first();
  await btn.hover();
  await page.waitForTimeout(700);
  await expect(page.locator(".app-tip")).toHaveCount(0);

  await page.mouse.click(400, 300);
  await page.mouse.move(10, 10);
  await page.clock.install();
  await btn.hover();
  await page.clock.fastForward(60_000);
  await expect(page.locator(".app-tip")).toBeVisible({ timeout: 3000 });
});
