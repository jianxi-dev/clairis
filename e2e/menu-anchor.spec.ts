import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/menu.md", "# 标题\n\n正文。", "menu.md");
  });
  await page.waitForTimeout(300);
}

test("格头菜单居中优先、越界时夹进视口（ui-polish-batch15 11.1）", async ({
  page,
}) => {
  await boot(page);
  const button = page.locator('[data-testid="pane-menu-button"]').first();
  await button.click();
  const menu = page.locator('[data-testid="pane-menu"]').first();
  await expect(menu).toBeVisible({ timeout: 3000 });

  const b = await button.boundingBox();
  const m = await menu.boundingBox();
  if (!b || !m) throw new Error("无法测量按钮或菜单");

  const vw = await page.evaluate(() => window.innerWidth);
  const margin = 8;
  const buttonCenter = b.x + b.width / 2;
  const menuCenter = m.x + m.width / 2;
  // 居中放得下时中心对齐按钮；放不下时夹到视口边距处（右缘越界像素为 0）
  const minCenter = margin + m.width / 2;
  const maxCenter = vw - margin - m.width / 2;
  const expectedCenter = Math.max(minCenter, Math.min(buttonCenter, maxCenter));
  expect(Math.abs(menuCenter - expectedCenter)).toBeLessThanOrEqual(2);
  expect(m.x).toBeGreaterThanOrEqual(0);
  expect(m.x + m.width).toBeLessThanOrEqual(vw);
});

test("关闭菜单后无残留节点", async ({ page }) => {
  await boot(page);
  await page.locator('[data-testid="pane-menu-button"]').first().click();
  await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(1);
  // 指针先移出触发按钮，避免关闭后 hover 立刻重开（并发下 flake）。
  await page.mouse.move(10, 10);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(0, {
    timeout: 3000,
  });
});

test("证据：菜单四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  await page.screenshot({ path: `${dir}/menu-closed.png` });
  const button = page.locator('[data-testid="pane-menu-button"]').first();
  await button.click();
  await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(1);
  await page.screenshot({ path: `${dir}/menu-open.png` });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(0);
  await page.screenshot({ path: `${dir}/menu-escaped.png` });
  await button.click();
  await page.screenshot({ path: `${dir}/menu-reopened.png` });
});
