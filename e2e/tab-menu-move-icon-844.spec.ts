import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #844 / editor-surface-batch19 13.1（B4）：
 * - 「移动到」图标不再与「打开文件位置」重复（A-13.1：两图标 path 去重数 = 2）
 * - hover「导出」即展开二级（A-13.2），移出父项后保持可见（A-13.3）
 *
 * 走真实右键 + 真实 hover；截图落 `.artifacts/844/`，
 * 由 `scripts/cw-evidence.sh record-state` 汇总状态覆盖。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/844");

test.beforeAll(() => {
  mkdirSync(ART, { recursive: true });
});

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/844.md", "# 标题\n\n正文。", "844.md");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

async function openTabMenu(page: Page): Promise<void> {
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await expect(page.locator("[data-tab-menu]")).toHaveCount(1);
}

async function iconPaths(page: Page, item: string): Promise<string[]> {
  return page
    .locator(`[data-menu-item="${item}"] svg path`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("d") ?? ""));
}

test.describe("移动到图标与打开文件位置去重（A-13.1）", () => {
  test("两图标 path 去重数量为 2", async ({ page }) => {
    await boot(page);
    await openTabMenu(page);

    const move = await iconPaths(page, "move");
    const reveal = await iconPaths(page, "reveal");
    expect(move.length).toBeGreaterThan(0);
    expect(reveal.length).toBeGreaterThan(0);
    expect(move.join("|")).not.toBe(reveal.join("|"));
    expect(new Set([...move, ...reveal]).size).toBe(2);

    await shot(page, "move-icon-distinct");
  });
});

test.describe("导出二级 hover 展开并保持（A-13.2 / A-13.3）", () => {
  test("hover 导出即出现二级，移出父项后仍为 1", async ({ page }) => {
    await boot(page);
    await openTabMenu(page);

    const submenu = page.locator('[data-testid="pane-export-submenu"]');
    expect(await submenu.count()).toBe(0);

    // 只 hover、不点击：父项一滑入就展开。
    await page.locator('[data-menu-item="export"]').hover();
    await expect(submenu).toHaveCount(1);
    await shot(page, "export-submenu-open");

    // 指针移出父项（落到同级「打印」上）后，已展开的二级仍保持可见。
    await page.locator('[data-menu-item="print"]').hover();
    await expect(submenu).toHaveCount(1);
    await shot(page, "export-submenu-persist");
  });

  test("点击导出仍打开二级（回归）", async ({ page }) => {
    await boot(page);
    await openTabMenu(page);
    await page.locator('[data-menu-item="export"]').click();
    await expect(
      page.locator('[data-testid="pane-export-submenu"]'),
    ).toHaveCount(1);
  });
});

test.describe("菜单整体仍就绪", () => {
  test("右键菜单打开且顶层 11 行", async ({ page }) => {
    await boot(page);
    await openTabMenu(page);
    await expect(
      page.locator(
        "[data-tab-menu] > button, [data-tab-menu] > [data-export-row]",
      ),
    ).toHaveCount(11);
    await shot(page, "menu-open");
  });
});
