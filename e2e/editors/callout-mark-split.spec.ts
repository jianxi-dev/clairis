import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, moveThrough, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1416";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
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
        `.artifacts/1416/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function openDoc(page: Page, body: string, name: string): Promise<void> {
  await page.evaluate(
    ({ b, n }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(`/tmp/${n}.md`, b, `${n}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { b: body, n: name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
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

test("斜杠菜单常用段只有「高亮」「标注」两项，无第三项", async ({ page }) => {
  await openDoc(page, DOC, "mark-split-slash");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  const labels = await menu
    .locator(".mdb-slash-item-label")
    .allTextContents();
  expect(labels.filter((t) => t === "高亮" || t === "标注")).toEqual([
    "高亮",
    "标注",
  ]);
  // 常用段不再出现旧的第 14 类「纯高亮」独立行。
  expect(labels).not.toContain("纯高亮");
  await shot(page, "01-menu-two-items", "menu-two-items");
});

test("「高亮」插入后无左边框、无标题栏、圆角 8px", async ({ page }) => {
  await openDoc(page, "第一段正文\n", "mark-split-insert");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await menu.locator(".mdb-slash-item").filter({ hasText: "高亮" }).click();

  await expect.poll(() => content(page)).toContain("> [!highlight]");
  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/cm-callout-mark/);
  await expect(card.locator(".cm-callout-header")).toHaveCount(0);
  await expect
    .poll(async () =>
      card.evaluate((el) => getComputedStyle(el).borderInlineStartWidth),
    )
    .toBe("0px");
  await expect
    .poll(async () => card.evaluate((el) => getComputedStyle(el).borderRadius))
    .toBe("8px");
  await shot(page, "02-highlight-inserted", "highlight-inserted");
});

test("「标注」展开 13 类语义 callout，选中写回 [!NOTE]", async ({ page }) => {
  await openDoc(page, "第一段正文\n", "mark-split-annotation");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await menu.locator(".mdb-slash-item").filter({ hasText: "标注" }).hover();
  const flyout = page.locator(".mdb-slash-flyout");
  await expect(flyout).toBeVisible({ timeout: 3000 });
  await expect(page.locator(".mdb-slash-flyout-item")).toHaveCount(13);
  await shot(page, "03-annotation-13", "annotation-13");
  await page.locator(".mdb-slash-flyout-item").first().click();
  await expect.poll(() => content(page)).toContain("> [!NOTE]");
});

test("块菜单「转为」网格只有「高亮」「标注」两项，标注展开 13 类", async ({
  page,
}) => {
  await openDoc(page, DOC, "mark-split-block-menu");
  await summonBlockMenu(page, 2);
  const cells = page.locator('[data-testid="block-menu-cell"]');
  await expect(cells).toHaveCount(11);
  const titles = await cells.evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLElement).title),
  );
  expect(titles.filter((t) => t === "高亮" || t === "标注")).toEqual([
    "高亮",
    "标注",
  ]);
  const annotationCell = page.locator(
    '[data-testid="block-menu-cell"][data-has-children="true"]',
  );
  await expect(annotationCell).toHaveCount(1);
  await annotationCell.hover();
  const flyout = page.locator('[data-testid="block-menu-convert-flyout"]');
  await expect(flyout).toBeVisible({ timeout: 3000 });
  await expect(
    flyout.locator('[data-testid="block-menu-convert-option"]'),
  ).toHaveCount(13);
});

test("六色板切换后高亮块底色为半透明（alpha < 1）", async ({ page }) => {
  await openDoc(page, "> [!highlight]\n> 高亮正文\n", "mark-split-color");
  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await summonBlockMenu(page, 0);
  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 5000 });
  await panel.locator('[data-class-name="mdb-bg-red"]').click();

  await expect.poll(() => content(page)).toContain("bg=red");
  // 六色之一写入后，卡片底色是 10% 叠底（alpha 0.1），不是实色。
  const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
  const alpha = Number(bg.match(/\/\s*([\d.]+)\s*\)$/)?.[1] ?? "1");
  expect(alpha).toBeLessThan(1);
  await shot(page, "04-color-six", "color-six");
});

test("Esc 关闭斜杠菜单后无残留菜单节点", async ({ page }) => {
  await openDoc(page, "第一段正文\n", "mark-split-esc");
  await page.locator(".cm-content").click();
  await page.keyboard.type("/");
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(0);
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
});

test("手柄菜单与轮盘「高亮」直落 > [!highlight]", async ({ page }) => {
  await openDoc(page, DOC, "mark-split-roulette");
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await page.keyboard.press("Meta+Shift+Space");
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
  await page.locator('[data-sector="convert"]').click({ force: true });
  await page
    .locator('.sr-sec[data-band="2"][data-action="convert-callout-mark"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toContain("> [!highlight]");
});
