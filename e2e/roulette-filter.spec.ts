import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const WHEEL = '[data-testid="selection-roulette"]';
const FILTER_INPUT = '[data-testid="sr-filter-input"]';
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/roulette-filter.md", body, "filter.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

async function openFilter(page: Page) {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator(WHEEL);
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
  await page.keyboard.press("Control+f");
  await expect(page.locator(FILTER_INPUT)).toBeVisible({ timeout: 3000 });
}

const rowLabels = (page: Page) =>
  page.locator(`${WHEEL} .sr-filter-row .sr-filter-label`);

test("搜索上级名称展开其全部子层级动作，父级不重复显示", async ({ page }) => {
  await openFilter(page);
  await page.locator(FILTER_INPUT).fill("高亮");

  await expect(page.locator(`${WHEEL} .sr-filter-row`)).toHaveCount(13);
  await expect(rowLabels(page).filter({ hasText: "注释" })).toHaveCount(1);
  await expect(rowLabels(page).filter({ hasText: "引用" })).toHaveCount(1);
  await expect(rowLabels(page).filter({ hasText: "警告" })).toHaveCount(1);
});

test("搜索列表上级列出三种列表动作，无死父级行", async ({ page }) => {
  await openFilter(page);
  await page.locator(FILTER_INPUT).fill("列表");

  const rows = rowLabels(page);
  await expect(rows.filter({ hasText: "无序列表" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "有序列表" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "待办" })).toHaveCount(1);
  await expect(rows).toHaveCount(3);
});

test("搜索叶子名称仍按叶子命中", async ({ page }) => {
  await openFilter(page);
  await page.locator(FILTER_INPUT).fill("待办");

  await expect(rowLabels(page).filter({ hasText: "待办" })).toHaveCount(2);
});

// QG-5 证据探针（#638）：EVIDENCE_DIR 设置时采集四态截图，平时跳过。
test("evidence: 轮盘筛选四态", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await openFilter(page);
  await page
    .locator(WHEEL)
    .screenshot({ path: `${dir}/filter-open-empty.png` });

  await page.locator(FILTER_INPUT).fill("高亮");
  await expect(page.locator(`${WHEEL} .sr-filter-row`)).toHaveCount(13);
  await page
    .locator(WHEEL)
    .screenshot({ path: `${dir}/filter-parent-query.png` });

  await page.locator(FILTER_INPUT).fill("待办");
  await expect(page.locator(`${WHEEL} .sr-filter-row`)).toHaveCount(2);
  await page
    .locator(WHEEL)
    .screenshot({ path: `${dir}/filter-leaf-query.png` });

  await page.locator(FILTER_INPUT).fill("");
  await expect(page.locator(`${WHEEL} .sr-filter-empty`)).toContainText(
    "输入关键词",
  );
  await page.locator(WHEEL).screenshot({ path: `${dir}/filter-cleared.png` });
});
