import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { openMarkdownInEdit } from "./helpers/ui-probe";

const DOC = "> [!highlight]\n> 高亮正文\n";
const LEGACY = "> [!highlight]{bg=darkred border=green text=yellow}\n> 旧属性\n";
const OUT = ".artifacts/1508";
mkdirSync(OUT, { recursive: true });

test("高亮面板字体颜色行渲染 8 格", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-palette");
  const mark = page.locator(".cm-callout-mark").first();
  await expect(mark).toBeVisible();
  await mark.locator(".cm-callout-content").click();
  await page.locator('[data-testid="callout-color-entry"]').click();

  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();

  const fontRow = panel.locator('.cm-color-row[data-kind="font"]');
  await expect(fontRow.locator(".cm-color-swatch")).toHaveCount(8);
  await expect(
    panel.locator('.cm-color-row[data-kind="border"] .cm-color-swatch'),
  ).toHaveCount(8);
  const bgRows = panel.locator('.cm-color-row[data-kind="background"]');
  await expect(bgRows).toHaveCount(2);
  await expect(bgRows.nth(0).locator(".cm-color-swatch")).toHaveCount(8);
  await expect(bgRows.nth(1).locator(".cm-color-swatch")).toHaveCount(8);
});

test("旧属性文档打开面板至少一格选中", async ({ page }) => {
  await openMarkdownInEdit(page, LEGACY, "highlight-legacy-active");
  await expect(page.locator(".cm-callout-mark").first()).toBeVisible();
  await page.locator(".cm-callout-mark").first().locator(".cm-callout-content").click();
  await page.locator('[data-testid="callout-color-entry"]').click();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();
  await expect(
    panel.locator('.cm-color-swatch[data-active="true"]'),
  ).not.toHaveCount(0);
});

test("QG-5 四态证据采集", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "highlight-evidence");
  await expect(page.locator(".cm-callout-mark").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/01-panel-closed.png` });

  await page.locator(".cm-callout-mark").first().locator(".cm-callout-content").click();
  await page.locator('[data-testid="callout-color-entry"]').click();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await expect(panel.locator(".cm-highlight-color-panel")).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-panel-font-8.png` });

  await page.keyboard.press("Escape");
  await openMarkdownInEdit(page, LEGACY, "highlight-legacy");
  await expect(page.locator(".cm-callout-mark").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/03-legacy-attrs.png` });

  await page.keyboard.press("Escape");
  await expect(panel.locator(".cm-highlight-color-panel")).toBeHidden();
  await page.locator(".cm-callout-mark").first().locator(".cm-callout-content").click();
  await page.locator('[data-testid="callout-color-entry"]').click();
  await expect(panel.locator('.cm-color-row[data-kind="font"] .cm-color-swatch')).toHaveCount(8);
  await page.screenshot({ path: `${OUT}/04-reopen-8.png` });
});
