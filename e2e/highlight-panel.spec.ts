import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { openMarkdownInEdit } from "./helpers/ui-probe";

const DOC = "> [!highlight]\n> 高亮正文\n";
const OUT = ".artifacts/1521";
mkdirSync(OUT, { recursive: true });

async function openPanelByHover(page: Page) {
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

test("鼠标滑入颜色图标即展开面板（无需点击）", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-panel-hover");
  await openPanelByHover(page);
  await page.screenshot({ path: `${OUT}/01-hover-open.png` });
});

test("四行各 8 格且不换行", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-panel-rows");
  const panel = await openPanelByHover(page);

  const rows = panel.locator(".cm-highlight-color-panel .cm-color-row");
  await expect(rows).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    const swatches = rows.nth(i).locator(".cm-color-swatch");
    await expect(swatches).toHaveCount(8);
    const tops = await swatches.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    const spread = Math.max(...tops) - Math.min(...tops);
    expect(spread).toBeLessThanOrEqual(2);
  }
  await page.screenshot({ path: `${OUT}/02-rows-8-nowrap.png` });
});

test("随机与选色都不关闭面板，Esc 才关闭", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-panel-keepopen");
  const panel = await openPanelByHover(page);

  await page.locator('[data-testid="color-random"]').click();
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();
  await page.screenshot({ path: `${OUT}/03-random-keepopen.png` });

  await panel
    .locator('.cm-color-row[data-kind="background"] .cm-color-swatch')
    .nth(3)
    .click();
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();
  await page.screenshot({ path: `${OUT}/04-pick-keepopen.png` });

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden({ timeout: 3000 });
});
