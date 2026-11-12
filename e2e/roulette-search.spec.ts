import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const WHEEL = '[data-testid="selection-roulette"]';
const FILTER_PANEL = '[data-testid="sr-filter-panel"]';
const FILTER_INPUT = '[data-testid="sr-filter-input"]';
const FILTER_LIST = `${WHEEL} .sr-filter-list`;
const ROW = `${WHEEL} .sr-filter-row`;
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;
const GROUP_NAMES = ["智能", "转换", "对齐", "分栏", "历史", "清格", "格式"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/roulette-search.md", body, "search.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

async function openSearch(page: Page) {
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

test("搜索按动作名过滤：行数 ≤9、首行选中、无层级名、无重复", async ({
  page,
}) => {
  await openSearch(page);
  await page.locator(FILTER_INPUT).fill("一级");

  const rows = page.locator(ROW);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveClass(/hot/);
  await expect(page.locator(`${WHEEL} .sr-filter-group`)).toHaveCount(0);

  const label = await rows.first().locator(".sr-filter-label").textContent();
  expect(label?.trim()).toBe("一级标题");
  for (const name of GROUP_NAMES) expect(label).not.toContain(name);

  const ids = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-action")),
  );
  expect(new Set(ids).size).toBe(ids.length);
});

test("结果列表最多 9 行且可滚动，快捷键列横向坐标固定", async ({ page }) => {
  await openSearch(page);
  await page.locator(FILTER_INPUT).fill("高亮");

  const list = page.locator(FILTER_LIST);
  const rows = page.locator(ROW);
  await expect(rows).toHaveCount(13);

  const ids = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-action")),
  );
  expect(new Set(ids).size).toBe(ids.length);

  const metrics = await list.evaluate((el) => ({
    maxHeight: getComputedStyle(el).maxHeight,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(metrics.maxHeight).toBe("234px");
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

  const shortcut = page.locator(`${ROW} [data-shortcut="2"]`);
  await expect(shortcut).toHaveCount(1);
  expect((await shortcut.textContent())?.trim()).toContain("2");
  await expect(page.locator(`${ROW} [data-shortcut="1"]`)).toHaveText(/回车/);

  const before = (await shortcut.boundingBox())!;
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(50);
  const after = (await shortcut.boundingBox())!;
  expect(after.x).toBe(before.x);

  await page.locator(FILTER_INPUT).fill("加粗");
  await expect(rows).toHaveCount(1);
  const single = (await page
    .locator(`${ROW} .sr-filter-shortcut`)
    .boundingBox())!;
  expect(single.x).toBe(before.x);
});

test("⌘/Ctrl+2 执行第二行动作", async ({ page }) => {
  await openSearch(page);
  await page.locator(FILTER_INPUT).fill("标题");
  await expect(page.locator(ROW)).toHaveCount(6);
  await expect(page.locator(`${ROW} [data-shortcut="2"]`)).toHaveCount(1);

  await page.keyboard.down(MOD);
  await page.keyboard.press("2");
  await page.keyboard.up(MOD);

  await expect(page.locator(WHEEL)).toHaveCount(0);
  const content = await page.evaluate(() => {
    const s = window.__biaoyue_store__.getState();
    return s.tabs[s.activeTabId]?.content ?? "";
  });
  expect(content).toContain("## 第一段正文");
});

test("关闭搜索后轮盘回到原态且无残留节点", async ({ page }) => {
  await openSearch(page);
  await page.locator(FILTER_INPUT).fill("一级");
  await expect(page.locator(ROW)).toHaveCount(1);

  await page.keyboard.press("Escape");

  await expect(page.locator(FILTER_PANEL)).toBeHidden();
  await expect(page.locator(ROW)).toHaveCount(0);
  await expect(page.locator(WHEEL)).toHaveCount(1);
  await expect(page.locator(`${WHEEL}[data-form="disk"]`)).toHaveCount(1);
  await expect(
    page.locator(`${WHEEL} [data-sector]:visible`).first(),
  ).toBeVisible();
});
