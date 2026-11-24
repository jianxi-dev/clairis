import { test, expect, type Page } from "@playwright/test";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1437 第 2/3/4 项：
 * - 纯高亮与标注视觉分家（1px 全边框 / 4px 圆角 / 更强荧光底）；
 * - 点击纯高亮块的工具条居中且为荧光笔图标；
 * - 独立颜色面板的「随机」同时换边框与填充、文字色不变，「恢复默认」清空；
 * - 转换菜单高亮/标注图标不同，标注类型复用新增菜单 emoji；
 * - 新增手柄菜单标注项名为「标注」。
 */

const DOC =
  "第一段正文\n\n> [!highlight]\n> 高亮正文\n\n> [!NOTE] 标题\n> 标注正文\n";

interface BridgeWindow extends Window {
  __biaoyue_store__: {
    getState: () => {
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
  };
}

async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function summonBlockMenu(page: Page, lineIndex: number): Promise<void> {
  await hoverLineLeft(page, page.locator(".cm-line").nth(lineIndex));
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

test("纯高亮与标注计算样式分家", async ({ page }) => {
  await openMarkdownInEdit(
    page,
    "> [!highlight]{bg=yellow}\n> 高亮正文\n\n> [!NOTE] 标题\n> 标注正文\n",
    "highlight-visual",
  );
  const mark = page.locator(".cm-callout-mark").first();
  const note = page.locator(".cm-callout:not(.cm-callout-mark)").first();
  await expect(mark).toBeVisible();
  await expect(note).toBeVisible();

  const markStyles = await mark.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      left: style.borderInlineStartWidth,
      top: style.borderTopWidth,
      radius: style.borderRadius,
      bg: style.getPropertyValue("--callout-bg").trim(),
    };
  });
  expect(markStyles.left).toBe("0px");
  expect(markStyles.top).toBe("1px");
  expect(markStyles.radius).toBe("4px");
  expect(markStyles.bg).toContain("38%");

  const noteLeft = await note.evaluate(
    (el) => getComputedStyle(el).borderInlineStartWidth,
  );
  expect(noteLeft).toBe("3px");
  await page.screenshot({ path: ".artifacts/1437/01-mark-vs-note.png" });
});

test("点击纯高亮块：工具条居中且图标为荧光笔", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-bar");
  const mark = page.locator(".cm-callout-mark").first();
  const card = await mark.boundingBox();
  await mark.locator(".cm-callout-content").click();
  const bar = page.locator('[data-testid="callout-color-bar"]');
  await expect(bar).toBeVisible();
  const barBox = (await bar.boundingBox())!;
  const delta = Math.abs(
    barBox.x + barBox.width / 2 - (card!.x + card!.width / 2),
  );
  expect(delta).toBeLessThanOrEqual(2);
  await page.screenshot({ path: ".artifacts/1437/04-bar-centered.png" });
  await expect(bar.locator('svg[data-icon="HighlighterOutlined"]')).toHaveCount(
    1,
  );
});

test("随机同时换边框与填充、文字不变，一次撤销还原；恢复默认清空", async ({
  page,
}) => {
  await openMarkdownInEdit(
    page,
    "> [!highlight]{text=gray}\n> 高亮正文\n",
    "highlight-random",
  );
  const mark = page.locator(".cm-callout-mark").first();
  await mark.locator(".cm-callout-content").click();
  await page.locator('[data-testid="callout-color-entry"]').click();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();
  expect(
    await panel.locator('.cm-color-row[data-kind="background"]').count(),
  ).toBe(2);

  await panel.locator('[data-testid="color-random"]').click();
  await expect
    .poll(() => content(page))
    .toMatch(/> \[!highlight\]\{bg=[a-z]+ border=[a-z]+ text=gray\}/);

  const first = await content(page);
  const attr = /\{bg=([a-z]+) border=([a-z]+) text=gray\}/.exec(first)!;
  expect(attr[1]).not.toBe(attr[2]);
  await page.screenshot({ path: ".artifacts/1437/02-random-pair.png" });

  await page.keyboard.press("Meta+z");
  await expect
    .poll(() => content(page))
    .toBe("> [!highlight]{text=gray}\n> 高亮正文\n");

  await mark.locator(".cm-callout-content").click();
  await page.locator('[data-testid="callout-color-entry"]').click();
  await page
    .locator('[data-testid="callout-color-panel"] [data-testid="color-reset"]')
    .click();
  await expect.poll(() => content(page)).toBe("> [!highlight]\n> 高亮正文\n");
  await page.screenshot({ path: ".artifacts/1437/03-reset.png" });
});

test("转换菜单高亮/标注图标不同，标注类型复用新增菜单 emoji", async ({
  page,
}) => {
  await openMarkdownInEdit(page, "第一段正文\n", "highlight-menu");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("/");
  const slash = page.locator(".mdb-slash-menu");
  await expect(slash).toBeVisible({ timeout: 3000 });
  await slash.locator(".mdb-slash-item").filter({ hasText: "标注" }).hover();
  const slashFlyout = page.locator(".mdb-slash-flyout");
  await expect(slashFlyout).toBeVisible({ timeout: 3000 });
  const slashEmoji = await slashFlyout
    .locator(".mdb-slash-flyout-item [data-glyph='emoji']")
    .allTextContents();
  expect(slashEmoji).toHaveLength(13);
  await page.keyboard.press("Escape");

  await openMarkdownInEdit(page, DOC, "highlight-menu-convert");
  await summonBlockMenu(page, 0);
  const markCell = page
    .locator('[data-testid="block-menu-cell"][data-target="callout"]')
    .first();
  const annotationCell = page.locator(
    '[data-testid="block-menu-cell"][data-has-children="true"]',
  );
  const icons = await page
    .locator('[data-testid="block-menu-cell"][data-target="callout"] svg')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-icon")),
    );
  expect(new Set(icons).size).toBe(2);
  expect(icons).toContain("HighlighterOutlined");

  await annotationCell.hover();
  const flyout = page.locator('[data-testid="block-menu-convert-flyout"]');
  await expect(flyout).toBeVisible({ timeout: 3000 });
  const flyoutEmoji = await flyout
    .locator(".cm-block-menu-flyout-icon")
    .allTextContents();
  expect(flyoutEmoji).toEqual(slashEmoji);
  await expect(markCell).toHaveCount(1);
});

test("新增手柄菜单标注项文案为「标注」", async ({ page }) => {
  await openMarkdownInEdit(page, "第一段正文\n", "highlight-add-menu");
  await hoverLineLeft(page, page.locator(".cm-line").first());
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await page.locator('[data-testid="block-menu-add-below"]').hover();
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  const labels = await menu.locator(".mdb-slash-item-label").allTextContents();
  expect(labels).toContain("标注");
  expect(labels).not.toContain("高亮");
});
