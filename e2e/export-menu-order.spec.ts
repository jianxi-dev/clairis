import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/export.md",
      "# 标题\n\n正文。",
      "export.md",
    );
  });
  await page.waitForTimeout(300);
}

test("导出菜单顺序为 Word / .mdpkg / 图片 / HTML / ZIP", async ({ page }) => {
  await boot(page);
  const dir = process.env.EVIDENCE_DIR;
  await page.locator('[data-testid="pane-menu-button"]').first().click();
  if (dir) {
    await page.screenshot({ path: `${dir}/pane-menu-open.png` });
  }
  await page.locator('[data-menu-item="export"]').first().hover();
  const submenu = page.locator('[data-testid="pane-export-submenu"]');
  await expect(submenu).toBeVisible({ timeout: 3000 });
  if (dir) {
    await page.screenshot({ path: `${dir}/export-submenu.png` });
  }
  const order = await submenu
    .locator("[data-export-item]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-export-item")));
  expect(order).toEqual([
    "exportDocx",
    "exportMdpkg",
    "exportPng",
    "exportHtml",
    "exportZip",
  ]);
});

test("导出菜单关闭后无残留", async ({ page }) => {
  await boot(page);
  await page.locator('[data-testid="pane-menu-button"]').first().click();
  await page.locator('[data-menu-item="export"]').first().hover();
  await expect(page.locator('[data-testid="pane-export-submenu"]')).toHaveCount(
    1,
  );
  const dir = process.env.EVIDENCE_DIR;
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(0, {
    timeout: 3000,
  });
  if (dir) {
    await page.screenshot({ path: `${dir}/export-closed.png` });
  }
  await page.locator('[data-testid="pane-menu-button"]').first().click();
  await page.locator('[data-menu-item="export"]').first().hover();
  await expect(page.locator('[data-testid="pane-export-submenu"]')).toHaveCount(
    1,
  );
  if (dir) {
    await page.screenshot({ path: `${dir}/export-reopened.png` });
  }
});
