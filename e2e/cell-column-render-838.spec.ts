import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * #838（change=editor-surface-batch19/5.1）单元格与分栏内外渲染一致验收。
 *
 * A-5.1 单元格 / 分栏内标题与列表装饰节点数 ≥1
 * A-5.2 单元格 / 分栏内可见源码标记（`**` / `##`）节点数 = 0
 * A-5.3 同一块在编辑态与预览态渲染一致（共享渲染管线）
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/838");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const TABLE_DOC = [
  "| 表头一 | 表头二 |",
  "| --- | --- |",
  "| ## 单元格标题 | - 单元格列表 |",
  "| **粗体** 与 `代码` | 普通文本 |",
].join("\n");

const COLUMN_DOC = [
  "::: {.col-2}",
  "",
  "## 栏目标题",
  "",
  "- 栏目列表一",
  "- 栏目列表二",
  "",
  ":::",
].join("\n");

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 写真实截图并登记到 state-coverage.json（ui-surface 证据面）。 */
async function shot(page: Page, name: string): Promise<void> {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      name,
      "--screenshot",
      file,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
}

async function openDoc(page: Page, p: string, content: string): Promise<void> {
  await page.evaluate(
    ({ path: docPath, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        docPath,
        c,
        docPath.split("/").pop(),
      );
    },
    { path: p, c: content },
  );
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.waitForTimeout(250);
}

test("A-5.1/A-5.2 单元格内标题与列表按正文渲染，源码标记不可见", async ({
  page,
}) => {
  await openDoc(page, "/tmp/cell-render-838.md", TABLE_DOC);

  const table = page.locator("table.cm-table");
  await expect(table).toBeVisible();

  const headingCell = page.locator('td[data-row="0"][data-col="0"]');
  const listCell = page.locator('td[data-row="0"][data-col="1"]');
  const inlineCell = page.locator('td[data-row="1"][data-col="0"]');

  // A-5.1：标题 / 列表装饰节点存在。
  await expect(headingCell.locator(".cm-heading")).toHaveCount(1);
  await expect(listCell.locator(".cm-list")).toHaveCount(1);
  // 粗斜体与行内代码也按正文渲染。
  await expect(inlineCell.locator("strong")).toHaveCount(1);
  await expect(inlineCell.locator("code")).toHaveCount(1);

  // A-5.2：可见源码标记为 0（标题前缀 / 列表标记 / 粗体星号都不出现）。
  await expect(headingCell).not.toContainText("##");
  await expect(listCell).not.toContainText("- 单元格列表");
  await expect(inlineCell).not.toContainText("**");
  await expect(headingCell).toHaveText("单元格标题");
  await expect(listCell).toHaveText("单元格列表");

  await shot(page, "cell-rich-render");
});

test("A-5.1/A-5.2 分栏内标题与列表按正文渲染，源码标记不可见", async ({
  page,
}) => {
  await openDoc(page, "/tmp/column-render-838.md", COLUMN_DOC);

  const col0 = page.locator('.cm-column[data-col="0"]');
  const col1 = page.locator('.cm-column[data-col="1"]');
  await expect(col0.locator(".cm-column-body")).toBeVisible();
  await expect(col1.locator(".cm-column-body")).toBeVisible();

  // A-5.1：标题节点 1 个、列表节点 2 个（多行列表块）。
  await expect(col0.locator(".cm-heading")).toHaveCount(1);
  await expect(col1.locator(".cm-list")).toHaveCount(2);

  // A-5.2：栏内可见源码标记为 0。
  await expect(col0).not.toContainText("##");
  await expect(col1).not.toContainText("- 栏目列表");
  await expect(col0.locator(".cm-column-body")).toHaveText("栏目标题");

  await shot(page, "column-rich-render");
});

test("A-5.3 同一分栏块在编辑态与预览态渲染一致", async ({ page }) => {
  await openDoc(page, "/tmp/column-parity-838.md", COLUMN_DOC);

  const readEdit = () =>
    page.evaluate(() => {
      const body = document.querySelector<HTMLElement>(
        '.cm-column[data-col="0"] .cm-column-body',
      );
      const list = document.querySelector<HTMLElement>(
        '.cm-column[data-col="1"] .cm-column-body',
      );
      const heading = body?.querySelector<HTMLElement>(".cm-heading");
      return {
        headingText: heading?.textContent ?? null,
        headingSize: heading ? getComputedStyle(heading).fontSize : null,
        headingWeight: heading ? getComputedStyle(heading).fontWeight : null,
        listCount: list?.querySelectorAll(".cm-list").length ?? null,
      };
    });

  const edit = await readEdit();
  expect(edit.headingText).toBe("栏目标题");
  expect(edit.listCount).toBe(2);

  await shot(page, "parity-edit");

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  await page.locator(".preview-content").waitFor({ timeout: 10000 });

  const preview = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(
      ".preview-content .layout-col-2",
    );
    const h2 = root?.querySelector<HTMLElement>("h2");
    return {
      headingText: h2?.textContent ?? null,
      headingSize: h2 ? getComputedStyle(h2).fontSize : null,
      headingWeight: h2 ? getComputedStyle(h2).fontWeight : null,
      listCount: root?.querySelectorAll("ul li").length ?? null,
    };
  });

  expect(preview.headingText).toBe(edit.headingText);
  expect(preview.headingSize).toBe(edit.headingSize);
  expect(preview.headingWeight).toBe(edit.headingWeight);
  expect(preview.listCount).toBe(edit.listCount);

  await shot(page, "parity-preview");
});

test("A-5.2 编辑态取消分栏就地编辑后渲染不退化（Esc 还原块级 DOM）", async ({
  page,
}) => {
  await openDoc(page, "/tmp/column-esc-838.md", COLUMN_DOC);

  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();
  await expect(area).toHaveValue("## 栏目标题");
  await page.keyboard.press("Escape");
  await expect(area).toHaveCount(0);

  // Esc 取消后栏正文仍是渲染后的标题，而不是 `## 栏目标题` 源码。
  await expect(body.locator(".cm-heading")).toHaveCount(1);
  await expect(body).not.toContainText("##");

  await shot(page, "column-esc-restored");
});

test("#917 引用块/单元格/分栏内均可召唤手柄，菜单与统一菜单一致", async ({
  page,
}) => {
  const NESTED_DOC = [
    "> 引用第一段",
    ">",
    "> ## 引用小标题",
    "",
    "| 表头一 | 表头二 |",
    "| --- | --- |",
    "| **粗体** | 普通文本 |",
    "",
    "::: {.col-2}",
    "",
    "- 栏目列表一",
    "",
    ":::",
  ].join("\n");

  const summonZone = async () =>
    page.evaluate(() => {
      const rect = (
        document.querySelector(".cm-content") as HTMLElement
      ).getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    });

  await openDoc(page, "/tmp/nested-handle-917.md", NESTED_DOC);

  // 嵌套容器内不显示源码标记（引用走主编辑器装饰渲染）。
  const quote = page.locator(".cm-quote").first();
  await expect(quote).not.toContainText("##");
  await expect(quote).not.toContainText("**");

  // 引用内嵌套段落的转换手柄：hover 左缘召唤 → 手柄 → 统一菜单。
  const quoteLine = page.locator(".cm-line", { hasText: "引用第一段" });
  const qbox = (await quoteLine.boundingBox())!;
  const zone = await summonZone();
  await page.mouse.move(
    Math.max(qbox.x, zone.left + zone.width * 0.1),
    qbox.y + qbox.height / 2,
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  // 命中的是嵌套块而不是引用容器：文档以引用块开头，容器手柄的 from 是 0，
  // 嵌套段手柄的 from 必然 > 0（旧实现只会给整条引用一个容器手柄）。
  expect(Number(await handle.getAttribute("data-block-from"))).toBeGreaterThan(
    0,
  );
  await handle.hover();
  const nestedMenu = page.locator('[data-testid="block-menu"]');
  await expect(nestedMenu).toBeVisible({ timeout: 3000 });
  const nestedCount = await nestedMenu.locator(".cm-block-menu-item").count();
  expect(nestedCount).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(nestedMenu).toHaveCount(0);

  // 菜单项集 = 统一菜单：与顶层段落菜单的项数严格相等，且都含「在下方添加」。
  await openDoc(page, "/tmp/plain-917.md", "顶层段落");
  const plainLine = page.locator(".cm-line").first();
  const pbox = (await plainLine.boundingBox())!;
  const pzone = await summonZone();
  await page.mouse.move(
    Math.max(pbox.x, pzone.left + pzone.width * 0.1),
    pbox.y + pbox.height / 2,
  );
  const plainHandle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(plainHandle).toHaveCount(1, { timeout: 3000 });
  await plainHandle.hover();
  const plainMenu = page.locator('[data-testid="block-menu"]');
  await expect(plainMenu).toBeVisible({ timeout: 3000 });
  const plainCount = await plainMenu.locator(".cm-block-menu-item").count();
  expect(nestedCount).toBe(plainCount);
  await expect(plainMenu).toContainText("在下方添加");

  // 可召唤容器 ≥3：引用嵌套手柄 + 表格单元格手柄 + 分栏手柄。
  await openDoc(page, "/tmp/nested-all-917.md", NESTED_DOC);
  await expect(
    page.locator('[data-testid="block-handle"]').first(),
  ).toBeAttached();
  await expect(
    page.locator('[data-testid="cm-table-cell-handle"]').first(),
  ).toBeAttached();
  await expect(
    page.locator('[data-testid="cm-columns-add-handle"]').first(),
  ).toBeAttached();
  await shot(page, "nested-handles-917");
});
