import { test, expect, type Page } from "@playwright/test";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

const DOC = "> [!highlight]\n> 高亮正文\n\n> [!NOTE] 标题\n> 标注正文\n";

/** 块手柄：指针移到卡片渲染矩形左缘召唤区（左 10%），逼出真实 enter 序列。 */
async function summonBlock(page: Page, widget: ReturnType<Page["locator"]>): Promise<void> {
  const box = (await widget.boundingBox())!;
  const contentRect = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, contentRect.left + contentRect.width * 0.1),
    box.y + box.height / 2,
    { steps: 6 },
  );
}

/** 点卡片内容区唤出工具条，断言工具条水平居中于卡片，返回工具条。 */
async function openBar(page: Page, card: ReturnType<Page["locator"]>) {
  const cardBox = (await card.boundingBox())!;
  await card.locator(".cm-callout-content").click();
  const bar = page.locator(".cm-callout-bar");
  await expect(
    page.locator('[data-testid="callout-color-panel"]'),
  ).toBeVisible({ timeout: 3000 }).catch(() => {});
  await expect(bar).toBeVisible({ timeout: 3000 });
  const barBox = (await bar.boundingBox())!;
  const delta = Math.abs(
    barBox.x + barBox.width / 2 - (cardBox.x + cardBox.width / 2),
  );
  expect(delta).toBeLessThanOrEqual(2);
  return bar;
}

test("两条工具条居中且颜色入口是调色板", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "callout-bar-icons");

  const mark = page.locator(".cm-callout-mark").first();
  const note = page.locator(".cm-callout:not(.cm-callout-mark)").first();
  await expect(mark).toBeVisible();
  await expect(note).toBeVisible();

  const markBar = await openBar(page, mark);
  await expect(
    markBar.locator('[data-testid="callout-color-entry"] svg'),
  ).toHaveAttribute("data-icon", "PaletteOutlined");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="callout-color-panel"]')).toHaveCount(
    0,
  );

  const noteBar = await openBar(page, note);
  await expect(
    noteBar.locator('[data-testid="callout-color-entry"] svg'),
  ).toHaveAttribute("data-icon", "PaletteOutlined");
  await page.keyboard.press("Escape");
});

test("纯高亮手柄图标与标注不同", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "callout-handle-icons");

  const markWidget = page.locator(".cm-callout-mark").first();
  const noteWidget = page.locator(".cm-callout:not(.cm-callout-mark)").first();
  await expect(markWidget).toBeVisible();
  await expect(noteWidget).toBeVisible();

  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );

  await summonBlock(page, markWidget);
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await expect(handle.locator(".cm-block-handle-icon svg")).toHaveAttribute(
    "data-icon",
    "HighlightBlockOutlined",
  );

  await summonBlock(page, noteWidget);
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await expect(handle.locator(".cm-block-handle-icon svg")).toHaveAttribute(
    "data-icon",
    "CalloutOutlined",
  );
});
