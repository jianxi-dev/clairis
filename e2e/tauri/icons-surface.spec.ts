import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const APP_URL = process.env.ICONS_APP_URL ?? "http://localhost:1420";
const ART = resolve(process.cwd(), ".artifacts/1500");

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

const DEFAULT_ICONS = JSON.parse(
  readFileSync(
    resolve(REPO_ROOT, "src-tauri/src/resources/icons.default.json"),
    "utf8",
  ),
).items as Record<string, unknown>[];

// mock 的图标默认集合必须与仓库内 JSON 默认源逐项一致（单一真相源对账）。
test("mock 默认集合与 icons.default.json 对账", () => {
  const mockSource = readFileSync(
    resolve(REPO_ROOT, "e2e/mocks/tauri-mock.js"),
    "utf8",
  );
  const block = mockSource.match(/var DEFAULT_ICON_ITEMS = (\[[\s\S]*?\]);/);
  expect(block, "mock 应有 DEFAULT_ICON_ITEMS").not.toBeNull();
  const mockItems = new Function(`return ${block![1]};`)() as unknown[];
  expect(mockItems).toEqual(DEFAULT_ICONS);
});

async function boot(page: Page, iconOverride: Record<string, unknown> | null = null) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (iconOverride !== null) {
    await page.addInitScript((items) => {
      (window as unknown as Record<string, unknown>).__biaoyue_icon_items__ =
        items;
    }, iconOverride);
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/icons/doc.md", "# 标题\n\n内容。", "doc.md");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

async function openDrawer(page: Page) {
  await page.keyboard.press("ControlOrMeta+,");
  const drawer = page.locator('[data-testid="icon-drawer"]');
  await expect(drawer).toBeVisible({ timeout: 5000 });
  return drawer;
}

/** 取某概念键在抽屉里渲染的 svg 的第一条 path 的 d（字形层证据）。 */
async function glyphPath(page: Page, key: string): Promise<string | null> {
  return page
    .locator(`[data-icon-entry="${key}"] svg[data-icon="${key}"] path`)
    .first()
    .getAttribute("d");
}

test.describe("图标面（icons）", () => {
  test("默认态：抽屉逐键渲染，label 与默认源一致", async ({ page }) => {
    await boot(page);
    const drawer = await openDrawer(page);
    const entries = drawer.locator("[data-icon-entry]");
    await expect(entries).toHaveCount(DEFAULT_ICONS.length);
    const close = drawer.locator('[data-icon-entry="close"]');
    await expect(close).toContainText("关闭");
    const defaultPath = DEFAULT_ICONS.find((i) => i.key === "close")?.s as string;
    expect(await glyphPath(page, "close")).toBe(defaultPath);
    mkdirSync(ART, { recursive: true });
    await page.screenshot({ path: `${ART}/01-default.png` });
  });

  test("改名生效：close label → 关窗（严格等于，旧名出现 0 次）", async ({
    page,
  }) => {
    await boot(page, { close: { label: "关窗" } });
    const drawer = await openDrawer(page);
    const close = drawer.locator('[data-icon-entry="close"]');
    await expect(close).toContainText("关窗");
    expect(await close.innerText()).not.toContain("关闭");
    // 字形不变（只改名）
    const defaultPath = DEFAULT_ICONS.find((i) => i.key === "close")?.s as string;
    expect(await glyphPath(page, "close")).toBe(defaultPath);
    await page.screenshot({ path: `${ART}/02-renamed.png` });
  });

  test("换路径生效：close 的 s 路径被替换（字形层断言）", async ({ page }) => {
    const newPath = "M2 2 L22 22 M22 2 L2 22";
    await boot(page, { close: { s: newPath } });
    await openDrawer(page);
    expect(await glyphPath(page, "close")).toBe(newPath);
    await page.screenshot({ path: `${ART}/03-repathed.png` });
  });

  test("清空覆盖（取消）后回落默认 label 与默认路径", async ({ page }) => {
    await boot(page, null);
    const drawer = await openDrawer(page);
    await expect(drawer.locator('[data-icon-entry="close"]')).toContainText(
      "关闭",
    );
    const defaultPath = DEFAULT_ICONS.find((i) => i.key === "close")?.s as string;
    expect(await glyphPath(page, "close")).toBe(defaultPath);
    await page.screenshot({ path: `${ART}/04-fallback-default.png` });
  });

  test("未知概念键不静默新增（回落默认集合，无新条目）", async ({ page }) => {
    await boot(page, { brandNew: { label: "新图标", s: "M0 0" } });
    const drawer = await openDrawer(page);
    await expect(drawer.locator("[data-icon-entry]")).toHaveCount(
      DEFAULT_ICONS.length,
    );
    await page.screenshot({ path: `${ART}/05-unknown-key.png` });
  });

  test("菜单项图标消费图标面：换路径后格头菜单字形同步（字形层）", async ({
    page,
  }) => {
    const newPath = "M3 3 L21 21";
    await boot(page, { code: { s: newPath } });
    await page.locator('[data-testid="pane-menu-button"]').first().click();
    const item = page.locator('[data-menu-item="source"]').first();
    await expect(item).toBeVisible();
    // 字形层：菜单项内 svg 的 path d 等于新路径（不只断言 data-icon 名）
    const d = await item
      .locator('svg[data-icon="code"] path')
      .first()
      .getAttribute("d");
    expect(d).toBe(newPath);
    await page.screenshot({ path: `${ART}/06-menu-consumer.png` });
  });

});
