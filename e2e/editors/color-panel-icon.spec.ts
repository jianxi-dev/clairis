import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1413";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const NOTE = "> [!NOTE] 标题\n> 正文";
const HIGHLIGHT = "> [!highlight] 高亮标题\n> 正文";

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        `.artifacts/1413/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function openCallout(page: Page, doc = NOTE): Promise<void> {
  await openMarkdownInEdit(page, doc, "color-panel-icon");
  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await card.locator(".cm-callout-content").click();
  await expect(page.locator('[data-testid="callout-color-bar"]')).toBeVisible();
}

async function openColorPanel(page: Page): Promise<void> {
  await openCallout(page);
  await page.locator('[data-testid="callout-color-entry"]').click();
  await expect(
    page.locator('[data-testid="callout-color-panel"]'),
  ).toBeVisible();
}

test("颜色面板：字体色块恢复字母 A 字形", async ({ page }) => {
  await openColorPanel(page);
  const panel = page.locator('[data-testid="callout-color-panel"]');
  const fontRow = panel.locator('.cm-color-row[data-kind="font"]').first();
  const icons = fontRow.locator(".cm-color-swatch-icon svg");
  await expect(icons).toHaveCount(9);
  const dataIcons = await icons.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("data-icon")),
  );
  expect(new Set(dataIcons)).toEqual(new Set(["FormatColorTextOutlined"]));
  const glyphs = await icons.evaluateAll((nodes) =>
    nodes.map((n) => (n.textContent ?? "").trim()),
  );
  expect(glyphs.every((text) => text === "A")).toBe(true);
  await shot(page, "01-panel-icons", "panel-icons");
});

test("色块容器 justify-content 为 center", async ({ page }) => {
  await openColorPanel(page);
  const panel = page.locator('[data-testid="callout-color-panel"]');
  const values = await panel
    .locator('.cm-color-row[data-kind="font"] .cm-color-swatch')
    .evaluateAll((nodes) =>
      nodes.map((n) => getComputedStyle(n).justifyContent),
    );
  expect(values.length).toBe(9);
  for (const value of values) expect(value).toBe("center");
});

test("高亮块工具条无类型切换入口", async ({ page }) => {
  await openCallout(page, HIGHLIGHT);
  const bar = page.locator('[data-testid="callout-color-bar"]');
  await expect(bar.locator('[data-testid="callout-type-entry"]')).toHaveCount(
    0,
  );
  await expect(bar.locator(".cm-callout-bar-btn")).toHaveCount(1);
  await shot(page, "03-no-type-entry", "no-type-entry");
});

test("NOTE 改红填充后切 TIP，填充色相仍为红；Esc 后无残留激活态", async ({
  page,
}) => {
  await openCallout(page);
  await page.locator('[data-testid="callout-color-entry"]').click();
  const panel = page.locator('[data-testid="callout-color-panel"]');
  await panel.locator('[data-class-name="mdb-bg-red"]').click();
  await expect
    .poll(() => storeContent(page))
    .toBe("> [!NOTE]{bg=red} 标题\n> 正文");

  const card = page.locator(".cm-callout").first();
  const redBefore = await card.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--callout-bg").trim(),
  );
  expect(redBefore).toContain("color-mix");

  await card.locator(".cm-callout-content").click();
  await hoverLineLeft(page, page.locator(".cm-line").first());
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  const typeRow = page.locator('[data-testid="block-menu-type"]');
  await expect(typeRow).toBeVisible({ timeout: 3000 });
  await typeRow.hover();
  const typePanel = page.locator('[data-testid="block-menu-type-panel"]');
  await typePanel.waitFor({ timeout: 3000 });
  await typePanel.locator('[data-type-key="tip"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("> [!TIP]{bg=red} 标题\n> 正文");
  const bgAfter = await card.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--callout-bg").trim(),
  );
  expect(bgAfter).toBe(redBefore);
  await shot(page, "04-hue-preserved", "hue-preserved");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="callout-color-panel"]')).toHaveCount(
    0,
  );
});
