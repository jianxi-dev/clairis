import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const APP_URL = process.env.MENUS_APP_URL ?? "http://localhost:1424";
const ART = resolve(process.cwd(), ".artifacts/1499");

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

const DEFAULT_ITEMS = JSON.parse(
  readFileSync(
    resolve(REPO_ROOT, "src-tauri/src/resources/menus.default.json"),
    "utf8",
  ),
).items as Record<string, unknown>[];

// mock 的菜单默认集合必须与仓库内 JSON 默认源逐项一致（单一真相源对账）。
test("mock 默认集合与 menus.default.json 对账", () => {
  const mockSource = readFileSync(
    resolve(REPO_ROOT, "e2e/mocks/tauri-mock.js"),
    "utf8",
  );
  const block = mockSource.match(/var DEFAULT_MENU_ITEMS = (\[[\s\S]*?\]);/);
  expect(block, "mock 应有 DEFAULT_MENU_ITEMS").not.toBeNull();
  const mockItems = new Function(`return ${block![1]};`)() as unknown[];
  expect(mockItems).toEqual(DEFAULT_ITEMS);
});

async function boot(page: Page, menuOverride: unknown[] | null = null) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (menuOverride !== null) {
    await page.addInitScript((items) => {
      (window as unknown as Record<string, unknown>).__biaoyue_menu_items__ =
        items;
    }, menuOverride);
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/menus/doc.md", "# 标题\n\n内容。", "doc.md");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

async function openPaneMenu(page: Page) {
  await page.locator('[data-testid="pane-menu-button"]').first().click();
  const menu = page.locator('[data-testid="pane-menu"]').first();
  await expect(menu).toBeVisible();
  return menu;
}

function renamedItems() {
  return DEFAULT_ITEMS.map((item) =>
    item.id === "pane-source" ? { ...item, label: "查看源码" } : item,
  );
}

function disabledItems() {
  return DEFAULT_ITEMS.map((item) =>
    item.id === "pane-source" ? { ...item, enabled: false } : item,
  );
}

test.describe("菜单面（六处接线）", () => {
  test("默认格头菜单恰好 6 项且顺序文案与现值一致（打开态）", async ({
    page,
  }) => {
    await boot(page);
    const menu = await openPaneMenu(page);
    const items = menu.locator("[data-menu-item]");
    await expect(items).toHaveCount(6);
    const labels = (await items.allInnerTexts()).map((t) => t.trim());
    expect(labels).toEqual([
      "新建文件",
      "分享",
      "右分",
      "下分",
      "源码模式",
      "定位",
    ]);
    mkdirSync(ART, { recursive: true });
    await page.screenshot({ path: `${ART}/01-default-open.png` });
  });

  test("改名生效：源码模式 → 查看源码，且不含源码模式", async ({ page }) => {
    await boot(page, renamedItems());
    const menu = await openPaneMenu(page);
    const labels = (await menu.locator("[data-menu-item]").allInnerTexts()).map(
      (t) => t.trim(),
    );
    expect(labels).toContain("查看源码");
    expect(labels).not.toContain("源码模式");
    await page.screenshot({ path: `${ART}/02-renamed.png` });
  });

  test("停用某项后该项不出现（空态回落前的缺项）", async ({ page }) => {
    await boot(page, disabledItems());
    const menu = await openPaneMenu(page);
    expect(await menu.locator("[data-menu-item]").count()).toBe(5);
    expect(await menu.locator('[data-menu-item="source"]').count()).toBe(0);
    await page.screenshot({ path: `${ART}/03-disabled.png` });
  });

  test("清空覆盖（取消）后回落完整默认集合", async ({ page }) => {
    await boot(page, null);
    const menu = await openPaneMenu(page);
    const labels = (await menu.locator("[data-menu-item]").allInnerTexts()).map(
      (t) => t.trim(),
    );
    expect(labels).toEqual([
      "新建文件",
      "分享",
      "右分",
      "下分",
      "源码模式",
      "定位",
    ]);
    await page.screenshot({ path: `${ART}/04-fallback-default.png` });
  });

  test("页签右键菜单顺序随覆盖变化（关闭 ↔ 悬浮小窗换位）", async ({
    page,
  }) => {
    const reordered = DEFAULT_ITEMS.map((item) =>
      item.id === "tab-close"
        ? { ...item, order: 1 }
        : item.id === "tab-preview"
          ? { ...item, order: 12 }
          : item,
    );
    await boot(page, reordered);
    await page.locator('[role="tab"]').first().click({ button: "right" });
    const rows = page.locator(
      "[data-tab-menu] > button, [data-tab-menu] > [data-export-row]",
    );
    await expect(rows).toHaveCount(12);
    const labels = await rows.evaluateAll((els) =>
      els.map((el) => el.textContent?.trim() ?? ""),
    );
    expect(labels[0]).toBe("关闭");
    expect(labels).toContain("悬浮小窗");
    expect(labels.indexOf("悬浮小窗")).toBeGreaterThan(labels.indexOf("关闭"));
    await page.screenshot({ path: `${ART}/05-tab-reordered.png` });
  });

  test("导出子菜单顺序不变（Word/.mdpkg/图片/PDF/HTML/ZIP）", async ({
    page,
  }) => {
    await boot(page, renamedItems());
    await page.locator('[role="tab"]').first().click({ button: "right" });
    await page.locator('[data-menu-item="export"]').click();
    const submenu = page.locator('[data-testid="pane-export-submenu"]');
    await expect(submenu).toBeVisible({ timeout: 3000 });
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
  });

  test("Esc 关闭菜单后无残留", async ({ page }) => {
    await boot(page, renamedItems());
    const menu = await openPaneMenu(page);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await page.screenshot({ path: `${ART}/06-closed-no-residue.png` });
  });
});
