import { test, expect, type Locator, type Page } from "@playwright/test";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1677：标注颜色面板（非高亮）按字体色块行定宽 246px、边框 / 填充 16 格换行、
 * 头行加「随机」。
 *
 * - 浮条路径：点内容唤出工具条 → 颜色入口 → 面板计算宽 246px；
 *   字体行 1 行 9 格，边框 / 填充各 16 格且各占 2 行（按色块 top 聚合）；
 *   随机按钮存在。
 * - 点随机后块首行属性同时出现同名 `bg=` 与 `border=`，面板仍可见。
 * - Esc 关闭后重开，选中态与首行属性一致。
 */

const DOC = "> [!NOTE] 标题\n> 正文";

interface BridgeWindow extends Window {
  __biaoyue_store__: {
    getState: () => {
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
  };
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

/** 点标注块内容 → 工具条 → 颜色入口，返回浮层 wrap（data-testid=callout-color-panel）。 */
async function openPanel(page: Page): Promise<Locator> {
  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await card.locator(".cm-callout-content").click();
  const entry = page.locator('[data-testid="callout-color-entry"]');
  await expect(entry).toBeVisible({ timeout: 3000 });
  await entry.click();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  return panel;
}

/** 一行色块的 top 聚合数（= 视觉行数）。 */
async function visualRows(locator: Locator): Promise<number> {
  const tops = await locator.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().top)),
  );
  return new Set(tops).size;
}

test("标注面板宽 246px、字体行 1 行 9 格、边框 / 填充各 16 格各占 2 行", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "callout-color-panel-annotation");
  const panel = await openPanel(page);

  const width = await panel.evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.round(width)).toBe(246);

  const fontRow = panel.locator('.cm-color-row[data-kind="font"]');
  await expect(fontRow.locator(".cm-color-swatch")).toHaveCount(9);
  expect(await visualRows(fontRow.locator(".cm-color-swatch"))).toBe(1);

  for (const kind of ["border", "background"]) {
    const row = panel.locator(`.cm-color-row[data-kind="${kind}"]`);
    await expect(row.locator(".cm-color-swatch")).toHaveCount(16);
    expect(await visualRows(row.locator(".cm-color-swatch"))).toBe(2);
  }

  await expect(
    panel.locator('[data-testid="color-random-callout"]'),
  ).toHaveCount(1);
});

test("点随机后首行同名 bg / border 写入，面板仍可见；Esc 重开选中态一致", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "callout-color-panel-annotation-random");
  const panel = await openPanel(page);

  await panel.locator('[data-testid="color-random-callout"]').click();

  await expect
    .poll(() => storeContent(page))
    .toMatch(/> \[!NOTE\]\{bg=[a-z]+ border=[a-z]+\} 标题/);
  const content = await storeContent(page);
  const m = /\{bg=([a-z]+) border=([a-z]+)\} 标题/.exec(content)!;
  expect(m[1]).toBe(m[2]);
  await expect(panel).toBeVisible();

  /** 选中态与首行属性一致（data-active 格色名 = 首行属性对应类名）。 */
  const expectActive = async (root: Locator): Promise<void> => {
    const bgActive = root.locator(
      '.cm-color-row[data-kind="background"] .cm-color-swatch[data-active="true"]',
    );
    const borderActive = root.locator(
      '.cm-color-row[data-kind="border"] .cm-color-swatch[data-active="true"]',
    );
    await expect(bgActive).toHaveCount(1);
    await expect(borderActive).toHaveCount(1);
    await expect(bgActive).toHaveAttribute(
      "data-class-name",
      `mdb-bg-${m[1]}`,
    );
    await expect(borderActive).toHaveAttribute(
      "data-class-name",
      `mdb-border-${m[2]}`,
    );
  };

  await expectActive(panel);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden({ timeout: 3000 });

  const reopened = await openPanel(page);
  await expectActive(reopened);
});
