import { test, expect, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { moveThrough, openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1320 症状 B：表格左缘外的正文空白点击不再被不可见手柄带吞掉。
 *
 * 几何（实测，视口 1200×800）：`.cm-content` 左内边距 32px，表格 wrap 左缘
 * 在 x≈32（表格块占满纸宽），单元格转换手柄在 wrap 左缘外 19px（x≈14..30）。
 * 所以「表格左侧正文空白」实为 content 左缘与 wrap 左缘之间的窄条（x≈12..30），
 * 手柄带正压在这条窄条上。修复前隐藏态 `pointer-events:auto` 吞掉点击
 * （命中 SVG 路径，光标不动）；修复后隐藏态 `pointer-events:none`，点击落到
 * `.cm-content`，光标落在被点行。
 *
 * T1 点击表格左缘外正文窄条（x≈22，与首行单元格同高）→ 命中 `.cm-content`，
 *     `.cm-table-cell-selected` = 0，`.cm-table-wrap[data-selected]` = 0，
 *     无 `.cm-selectionBackground`，光标落在被点行。
 * T2 点击表格上方正文行 → 光标落在该行，不选中表格。
 * T3 悬停表格后点击行热点 / 单元格手柄 → 既有行为保持（插入行 / 内容菜单）。
 * T4 点击表格真实单元格 → 既有单元格选中行为不变（行内 input 打开）。
 *
 * 回归 0：手柄 / 热点只有在表格可见悬停态才可交互（T3 断言）。
 *
 * 光标落点用 `.cm-cursor` 矩形与被点 `.cm-line` 行盒比较（既有 e2e 口径，
 * 见 `typing-stability-1320.spec.ts`）；不读 CM6 内部 state（无 view 桥）。
 */

const ART = ".artifacts/1320";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const DOC = [
  "第一段正文",
  "",
  "| 模块 | 已实现内容 | 依据 |",
  "| --- | --- | --- |",
  "| 安全组织 | 单位法人 | [1] |",
  "| 隐患排查 | 闭环管理 | [2] |",
  "",
  "第二段正文",
  "",
  "第三段正文",
].join("\n");

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
        `.artifacts/1320/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

/** 打开文档并等表格 widget 落定。 */
async function openTableDoc(page: Page, name: string): Promise<void> {
  await openMarkdownInEdit(page, DOC, name);
  await expect(page.locator("table.cm-table")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
}

interface CursorState {
  cursorTop: number | null;
  cursorBottom: number | null;
  selectedCells: number;
  activeCells: number;
  selectionBackgrounds: number;
  selectedWrap: number;
}

/** 读光标矩形与表格选区类（既有 e2e 口径）。 */
async function readCursorState(page: Page): Promise<CursorState> {
  return page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    const cursor = document.querySelector(".cm-cursor") as HTMLElement | null;
    const cr = cursor?.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    return {
      cursorTop: cr ? Math.round(cr.top - sr.top) : null,
      cursorBottom: cr ? Math.round(cr.bottom - sr.top) : null,
      selectedCells: document.querySelectorAll(".cm-table-cell-selected").length,
      activeCells: document.querySelectorAll(".cm-table-cell-active").length,
      selectionBackgrounds: document.querySelectorAll(".cm-selectionBackground")
        .length,
      selectedWrap: document.querySelectorAll(".cm-table-wrap[data-selected]")
        .length,
    };
  });
}

/** 光标矩形是否落在给定 `.cm-line` 行盒内（纵向重叠即视为落该行）。 */
async function cursorOnLine(
  page: Page,
  line: Locator,
): Promise<{ onLine: boolean; cursorTop: number | null; lineTop: number }> {
  const cursor = await page.evaluate(() => {
    const el = document.querySelector(".cm-cursor") as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, left: r.left } : null;
  });
  const box = (await line.boundingBox())!;
  const onLine =
    cursor !== null && cursor.bottom > box.y && cursor.top < box.y + box.height;
  return { onLine, cursorTop: cursor?.top ?? null, lineTop: box.y };
}

/** 点击落点的 elementFromPoint 命中信息。 */
async function hitAt(
  page: Page,
  x: number,
  y: number,
): Promise<{ hit: string | null; inTable: boolean }> {
  return page.evaluate(
    ([cx, cy]) => {
      const el = document.elementFromPoint(cx, cy) as HTMLElement | null;
      return {
        hit: el ? (el.className || el.tagName).toString() : null,
        inTable: !!el?.closest(".cm-table-wrap"),
      };
    },
    [x, y],
  );
}

test("T1 表格左缘外正文窄条点击：命中正文、光标落在被点行，不选中表格", async ({
  page,
}) => {
  await openTableDoc(page, "table-blank-left-1320b");

  const wrap = page.locator(".cm-table-wrap").first();
  const wrapBox = (await wrap.boundingBox())!;
  const table = page.locator("table.cm-table").first();
  const tableBox = (await table.boundingBox())!;
  const contentLeft = await page.evaluate(
    () =>
      (
        document.querySelector(".cm-content") as HTMLElement
      ).getBoundingClientRect().left,
  );

  // 表格左缘外正文窄条：content 左缘内、wrap 左缘外，与首行单元格手柄带同高。
  const cell = page.locator('td[data-row="0"][data-col="0"]');
  const cellBox = (await cell.boundingBox())!;
  const handle = cell.locator(".cm-table-cell-handle");
  const handleBox = (await handle.boundingBox())!;
  const x = Math.round(handleBox.x + handleBox.width / 2);
  const y = Math.round(handleBox.y + handleBox.height / 2);
  expect(x).toBeLessThan(wrapBox.x);

  // 点击前命中：隐藏态手柄带不再拦截（修复后应命中正文，而非手柄 SVG 路径）。
  const before = await hitAt(page, x, y);
  expect(before.inTable, "点击落点不应在表格内").toBe(false);
  expect(
    before.hit ?? "",
    "隐藏态手柄带不应拦截指针（应命中正文容器）",
  ).toContain("cm-content");

  await page.mouse.click(x, y);
  await page.waitForTimeout(250);

  const after = await hitAt(page, x, y);
  expect(after.inTable, "点击后落点不应在表格内").toBe(false);
  // 命中应是正文（.cm-content），不是手柄 SVG 路径。
  expect(after.hit ?? "", "命中应是正文容器而非手柄").toContain("cm-content");
  // 手柄带不再吞点击：不打开单元格菜单（修复前会命中手柄 SVG 触发菜单）。
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);

  const state = await readCursorState(page);
  // 光标落在被点行（表格块首行 —— CM6 把 widget 块首作为光标落点）。
  const tableLine = page.locator(".cm-line").filter({ hasText: "模块" }).first();
  const { onLine } = await cursorOnLine(page, tableLine);
  expect(onLine, "光标应落在被点行（表格块首行）").toBe(true);
  // 不选中任何单元格，无选区背景，wrap 无 data-selected。
  expect(state.selectedCells).toBe(0);
  expect(state.activeCells).toBe(0);
  expect(state.selectionBackgrounds).toBe(0);
  expect(state.selectedWrap).toBe(0);
  expect(state.cursorTop).not.toBeNull();

  await shot(page, "07-blank-left-cursor", "blank-left-cursor");
});

test("T2 表格上方正文行点击：光标落在该行，不选中表格", async ({ page }) => {
  await openTableDoc(page, "table-blank-above-1320b");

  const wrap = page.locator(".cm-table-wrap").first();
  const wrapBox = (await wrap.boundingBox())!;
  const firstLine = page
    .locator(".cm-line")
    .filter({ hasText: "第一段正文" })
    .first();
  const lineBox = (await firstLine.boundingBox())!;

  // 表格上方紧邻的正文行，水平落在 wrap 左缘内。
  const x = Math.round(wrapBox.x + 40);
  const y = Math.round(lineBox.y + lineBox.height / 2);
  await page.mouse.click(x, y);
  await page.waitForTimeout(250);

  const hit = await hitAt(page, x, y);
  expect(hit.inTable, "点击落点不应在表格内").toBe(false);

  const state = await readCursorState(page);
  const { onLine } = await cursorOnLine(page, firstLine);
  expect(onLine, "光标应落在表格上方正文行").toBe(true);
  expect(state.selectedCells).toBe(0);
  expect(state.activeCells).toBe(0);
  expect(state.selectionBackgrounds).toBe(0);
  expect(state.selectedWrap).toBe(0);

  await shot(page, "07b-blank-above-cursor", "blank-above-cursor");
});

test("T3 悬停表格后点击行热点 / 单元格手柄：既有行为保持", async ({
  page,
}) => {
  await openTableDoc(page, "table-hover-handle-1320b");

  const table = page.locator("table.cm-table").first();
  const tableBox = (await table.boundingBox())!;

  // 先悬停表格（wrap 内）→ 热点显现。
  await moveThrough(
    page,
    [{ x: tableBox.x + tableBox.width / 2, y: tableBox.y + 12 }],
    { steps: 6 },
  );
  const rowSpots = page.locator(".cm-table-hotspot-row");
  const colSpots = page.locator(".cm-table-hotspot-col");
  await expect(rowSpots).toHaveCount(3);
  await expect(colSpots).toHaveCount(4);
  await expect(page.locator(".cm-table-hotspot-revealed")).toHaveCount(7);

  // 点击行热点 → 气泡出现 → 「插入行」：行数 +1。
  const rowsBefore = await table.locator("tbody tr").count();
  await rowSpots.nth(1).click();
  const insertBtn = page.locator(
    ".cm-table-hotspot-active [data-testid='cm-table-boundary-insert']",
  );
  await expect(insertBtn).toBeVisible();
  await insertBtn.click();
  await expect(table.locator("tbody tr")).toHaveCount(rowsBefore + 1);

  // 单元格转换手柄：悬停单元格后点击 → 内容菜单打开。
  const cell = page.locator('td[data-row="0"][data-col="0"]');
  const cellBox = (await cell.boundingBox())!;
  await moveThrough(
    page,
    [
      {
        x: cellBox.x + cellBox.width / 2,
        y: cellBox.y + cellBox.height / 2,
      },
    ],
    { steps: 6 },
  );
  const handle = cell.locator(".cm-table-cell-handle");
  await expect
    .poll(async () => handle.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  await handle.click();
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({
    timeout: 3000,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);

  await shot(page, "08-hover-handle-click", "hover-handle-click");
});

test("T4 点击表格真实单元格：既有单元格选中行为不变", async ({ page }) => {
  await openTableDoc(page, "table-cell-click-1320b");

  const cell = page.locator('td[data-row="0"][data-col="0"]');
  await cell.click();
  const input = cell.locator(".cm-table-cell-input");
  await expect(input).toBeVisible({ timeout: 3000 });
  await expect(input).toHaveValue("安全组织");
  // 单元格选中态仍在（既有行为）。
  await expect(cell).toHaveClass(/cm-table-cell-selected/);

  await shot(page, "09-cell-click", "cell-click");
});
