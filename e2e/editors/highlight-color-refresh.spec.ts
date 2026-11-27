import { test, expect, type Page } from "@playwright/test";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * 票 1.3（highlight-mark-refine-v1 / D4 + D5）：
 * - 纯高亮颜色面板色块 44×40 → 22×20（面积 1/4），行 gap 8px → 4px，面板宽 216px 不变；
 * - 选色 / 「随机」后 `data-active` 在原地面板内即时刷新，面板不关；
 * - Esc 关闭后再打开，选中态与块首行属性一致（无残留）。
 */

const DOC = "> [!highlight]{bg=darkred border=red}\n> 高亮正文\n";

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

/** 点击纯高亮块 → 工具条 → 滑入颜色图标展开面板（pointerenter 即开，无需点击）。 */
async function openPanel(page: Page) {
  const block = page.locator(".cm-callout-mark").first();
  await expect(block).toBeVisible();
  await block.locator(".cm-callout-content").click();
  const entry = page.locator('[data-testid="callout-color-entry"]');
  await expect(entry).toBeVisible({ timeout: 3000 });
  await entry.hover();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible({
    timeout: 3000,
  });
  return panel;
}

const activeOf = (panel: ReturnType<Page["locator"]>, kind: string) =>
  panel.locator(
    `.cm-color-row[data-kind="${kind}"] .cm-color-swatch[data-active="true"]`,
  );

/**
 * 填充有深 / 中两行，共用同一 bg 值：一个色名可能同时命中两行（如 `orange`
 * 命中深档默认格与中档 `hl-fill-orange`），也可能只命中一行（如 `yellow`
 * 只在中档）。断言按「行」取选中格：每行至多 1 个，且两行的选中色名并集
 * 恰含块首行 bg 对应的那一格。
 */
function activeFillByRow(panel: ReturnType<Page["locator"]>) {
  const rows = panel.locator('.cm-color-row[data-kind="background"]');
  return [0, 1].map((i) =>
    rows.nth(i).locator('.cm-color-swatch[data-active="true"]'),
  );
}

test("色块 22×20、行 gap 4px、每行 8 格不换行", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-color-geometry");
  const panel = await openPanel(page);

  const size = await panel
    .locator('.cm-color-row[data-kind="border"] .cm-color-swatch')
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: style.width, height: style.height, flex: style.flex };
    });
  expect(size.width).toBe("22px");
  expect(size.height).toBe("20px");
  expect(size.flex).toBe("0 0 22px");

  const rowGap = await panel
    .locator('.cm-color-row[data-kind="border"]')
    .evaluate((el) => getComputedStyle(el).gap);
  expect(rowGap).toBe("4px");

  const rows = panel.locator(".cm-highlight-color-panel .cm-color-row");
  await expect(rows).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    const swatches = rows.nth(i).locator(".cm-color-swatch");
    await expect(swatches).toHaveCount(8);
    const tops = await swatches.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
    const flexWrap = await rows.nth(i).evaluate(
      (el) => getComputedStyle(el).flexWrap,
    );
    expect(flexWrap).toBe("nowrap");
  }

  // 外层 wrap（`data-testid="callout-color-panel"`）宽 216px、padding 4px；
  // 内容根 `.cm-highlight-color-panel` 撑满内容盒 206px = 8×22 + 7×4。
  const wrapWidth = await panel.evaluate(
    (el) => el.getBoundingClientRect().width,
  );
  expect(Math.round(wrapWidth)).toBe(216);
  const wrapMinWidth = await panel.evaluate(
    (el) => getComputedStyle(el).minWidth,
  );
  expect(wrapMinWidth).toBe("216px");
  const wrapPadding = await panel.evaluate(
    (el) => getComputedStyle(el).padding,
  );
  expect(wrapPadding).toBe("4px");
  const panelWidth = await panel
    .locator(".cm-highlight-color-panel")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.round(panelWidth)).toBe(206);

  // 无换行：每行最后一个色块 right 不超过面板内容右缘（padding 4px）。
  const overflow = await panel
    .locator(".cm-highlight-color-panel")
    .evaluate((root) => {
      const contentRight =
        root.getBoundingClientRect().right -
        Number.parseFloat(getComputedStyle(root).paddingRight);
      return Array.from(root.querySelectorAll(".cm-color-row")).map((row) => {
        const swatches = Array.from(
          row.querySelectorAll(".cm-color-swatch"),
        ) as HTMLElement[];
        const last = swatches[swatches.length - 1];
        return Math.round(last.getBoundingClientRect().right - contentRight);
      });
    });
  for (const delta of overflow) {
    expect(delta).toBeLessThanOrEqual(0);
  }
});

test("点一个非当前色块：新格 true、旧格 false，面板仍可见", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "highlight-color-pick-refresh");
  const panel = await openPanel(page);

  const borderRow = panel.locator('.cm-color-row[data-kind="border"]');
  const before = await borderRow
    .locator('.cm-color-swatch[data-active="true"]')
    .getAttribute("data-class-name");
  expect(before).toBe("hl-border-red");

  const target = borderRow.locator('.cm-color-swatch[data-class-name="hl-border-green"]');
  await target.click();

  await expect
    .poll(() => storeContent(page))
    .toBe("> [!highlight]{bg=darkred border=green}\n> 高亮正文\n");
  await expect(target).toHaveAttribute("data-active", "true");
  await expect(
    borderRow.locator('.cm-color-swatch[data-class-name="hl-border-red"]'),
  ).toHaveAttribute("data-active", "false");
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();
});

test("点「随机」：边框行与填充行各有一个 true 且与点击前不同，面板仍可见", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "highlight-color-random-refresh");
  const panel = await openPanel(page);

  const snapshot = async () => {
    const border = await activeOf(panel, "border").getAttribute("data-class-name");
    const [deep, mid] = activeFillByRow(panel);
    const [deepCount, midCount] = await Promise.all([
      deep.count(),
      mid.count(),
    ]);
    return {
      border,
      deep: deepCount === 1 ? await deep.getAttribute("data-class-name") : null,
      mid: midCount === 1 ? await mid.getAttribute("data-class-name") : null,
    };
  };

  const before = await snapshot();
  expect(before.border).toBe("hl-border-red");
  expect(before.deep).toBe("hl-fill-darkred");

  await panel.locator('[data-testid="color-random"]').click();

  await expect
    .poll(() => storeContent(page))
    .toMatch(/> \[!highlight\]\{bg=[a-z]+ border=[a-z]+\}/);

  // 边框行恰 1 个选中；两行填充各至多 1 个（同一 bg 值可能同时命中两行）。
  await expect(activeOf(panel, "border")).toHaveCount(1);
  const [deep, mid] = activeFillByRow(panel);
  expect(await deep.count()).toBeLessThanOrEqual(1);
  expect(await mid.count()).toBeLessThanOrEqual(1);
  expect((await deep.count()) + (await mid.count())).toBeGreaterThan(0);

  const after = await snapshot();
  expect(after.border).not.toBe(before.border);
  // 同色系：随机写回的 bg / border 属同一家族。
  const content = await storeContent(page);
  const m = /\{bg=([a-z]+) border=([a-z]+)\}/.exec(content)!;
  expect(m[1].replace("dark", "")).toBe(m[2]);
  // 填充选中格与块首行 bg 一致（深档命中同名格，中档命中 `hl-fill-<bg>`）。
  const bgCls = `hl-fill-${m[1]}`;
  expect([after.deep, after.mid]).toContain(bgCls);
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();
});

test("Esc 关闭后再打开：选中态与块首行一致，无残留", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-color-reopen");
  const panel = await openPanel(page);

  await panel.locator('[data-testid="color-random"]').click();
  await expect
    .poll(() => storeContent(page))
    .toMatch(/> \[!highlight\]\{bg=[a-z]+ border=[a-z]+\}/);
  const afterRandom = await storeContent(page);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden({ timeout: 3000 });

  await page.locator(".cm-callout-mark").first().locator(".cm-callout-content").click();
  await page.locator('[data-testid="callout-color-entry"]').hover();
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible({
    timeout: 3000,
  });

  const m = /\{bg=([a-z]+) border=([a-z]+)\}/.exec(afterRandom)!;
  await expect(activeOf(panel, "border")).toHaveCount(1);
  await expect(activeOf(panel, "border")).toHaveAttribute(
    "data-class-name",
    `hl-border-${m[2]}`,
  );
  // 两行填充各至多 1 个选中，且必有一格色名与块首行 bg 一致（无残留）。
  const [deep, mid] = activeFillByRow(panel);
  expect(await deep.count()).toBeLessThanOrEqual(1);
  expect(await mid.count()).toBeLessThanOrEqual(1);
  const bgCls = `hl-fill-${m[1]}`;
  const deepCls = (await deep.count()) === 1
    ? await deep.getAttribute("data-class-name")
    : null;
  const midCls = (await mid.count()) === 1
    ? await mid.getAttribute("data-class-name")
    : null;
  expect([deepCls, midCls]).toContain(bgCls);
});

test("块菜单路径：高亮块「颜色」二级面板宽 216、色块 22×20、每行 8 格", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "highlight-block-menu-color");
  await hoverLineLeft(page, page.locator(".cm-line").first());
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });

  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });

  const width = await panel.evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.round(width)).toBe(216);

  const swatch = await panel
    .locator('.cm-color-row[data-kind="border"] .cm-color-swatch')
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: style.width, height: style.height };
    });
  expect(swatch.width).toBe("22px");
  expect(swatch.height).toBe("20px");

  const rows = panel.locator(".cm-highlight-color-panel .cm-color-row");
  await expect(rows).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    await expect(rows.nth(i).locator(".cm-color-swatch")).toHaveCount(8);
    const flexWrap = await rows.nth(i).evaluate(
      (el) => getComputedStyle(el).flexWrap,
    );
    expect(flexWrap).toBe("nowrap");
  }
});
