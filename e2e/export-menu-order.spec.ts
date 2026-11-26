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

async function openExportSubmenu(page: Page): Promise<void> {
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await page.locator('[data-menu-item="export"]').click();
}

test("页签右键菜单导出子菜单顺序为 Word / .mdpkg / 图片 / PDF / HTML / ZIP", async ({
  page,
}) => {
  await boot(page);
  const dir = process.env.EVIDENCE_DIR;
  await page.locator('[role="tab"]').first().click({ button: "right" });
  if (dir) {
    await page.screenshot({ path: `${dir}/tab-menu-open.png` });
  }
  await page.locator('[data-menu-item="export"]').click();
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
    "exportPdf",
    "exportHtml",
    "exportZip",
  ]);
  expect(order).not.toContain("print");
});

test("点击 PDF 生成 PDF 文件", async ({ page }) => {
  await boot(page);
  await openExportSubmenu(page);
  await page.locator('[data-export-item="exportPdf"]').click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as unknown as Record<string, unknown>;
          const list = w.__biaoyue_saved_binaries__ as
            { base64: string; defaultName: string }[] | undefined;
          return list && list.length > 0
            ? list[list.length - 1].base64.slice(0, 8)
            : "";
        }),
      { timeout: 20000 },
    )
    .toBe("JVBERi0x");
  const dir = process.env.EVIDENCE_DIR;
  if (dir) {
    await page.screenshot({ path: `${dir}/pdf-exported.png` });
  }
});

test("导出菜单关闭后无残留", async ({ page }) => {
  await boot(page);
  await openExportSubmenu(page);
  await expect(page.locator('[data-testid="pane-export-submenu"]')).toHaveCount(
    1,
  );
  const dir = process.env.EVIDENCE_DIR;
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-tab-menu]")).toHaveCount(0, {
    timeout: 3000,
  });
  if (dir) {
    await page.screenshot({ path: `${dir}/export-closed.png}` });
  }
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await page.locator('[data-menu-item="export"]').click();
  await expect(page.locator('[data-testid="pane-export-submenu"]')).toHaveCount(
    1,
  );
  if (dir) {
    await page.screenshot({ path: `${dir}/export-reopened.png` });
  }
});

test("导出子菜单默认右开；窄窗口贴右边界翻左", async ({ page }) => {
  const { mkdirSync } = await import("node:fs");
  const OUT = ".artifacts/1519";
  mkdirSync(OUT, { recursive: true });
  await boot(page);

  await openExportSubmenu(page);
  const submenu = page.locator('[data-testid="pane-export-submenu"]');
  await expect(submenu).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: `${OUT}/01-default-right.png` });

  const menu = page.locator("[data-tab-menu]").first();
  const menuBox = (await menu.boundingBox())!;
  const subBox = (await submenu.boundingBox())!;
  expect(subBox.x).toBeGreaterThanOrEqual(menuBox.x + menuBox.width - 2);

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 520, height: 640 });
  await page.waitForTimeout(200);
  await openExportSubmenu(page);
  await expect(submenu).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: `${OUT}/02-narrow-flip.png` });

  const subBox2 = (await submenu.boundingBox())!;
  expect(subBox2.x).toBeGreaterThanOrEqual(0);
  expect(subBox2.x + subBox2.width).toBeLessThanOrEqual(521);
  await page.screenshot({ path: `${OUT}/03-flipped-left.png` });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/04-closed.png` });
});
