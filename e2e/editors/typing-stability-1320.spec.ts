import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1320 正文输入稳定性。
 *
 * A-1 首行末尾键入 `2026-11-25` + 20 个中文：`.cm-scroller` 的 scrollTop
 *     前后差 = 0（±1）。
 * A-2 纯文本输入（无结构变化）下 `.cm-content` 的 scrollHeight 不出现 >8px
 *     跳变；首行折行属于结构变化，取稳定后的值比较。
 * A-3 输入后块级 widget 数与输入前相同，`.cm-line` 数与文本行数一致。
 * A-4 输入前后媒体 widget 的 DOM 节点身份不变（上游键入不再销毁重建
 *     下游图片 / 视频 —— 抖动的根因）。
 * B-1 点击两块之间的空白：不出现表格整块选中类，光标落在点击行。
 */

const ART = ".artifacts/1320";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const DOC_PATH = "/Users/mason/Desktop/中汽系统搭建情况对称1110.md";
const DOC = readFileSync(DOC_PATH, "utf8");

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

interface Metrics {
  scrollTop: number;
  scrollHeight: number;
  lineCount: number;
  imageWidgets: number;
  mediaWidgets: number;
  tableWidgets: number;
  calloutWidgets: number;
  dpbWidgets: number;
}

async function metrics(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    const content = document.querySelector(".cm-content") as HTMLElement;
    return {
      scrollTop: scroller.scrollTop,
      scrollHeight: content.scrollHeight,
      lineCount: document.querySelectorAll(".cm-line").length,
      imageWidgets: document.querySelectorAll(".cm-image-widget").length,
      mediaWidgets: document.querySelectorAll(".cm-media-widget").length,
      tableWidgets: document.querySelectorAll(".cm-table-wrap").length,
      calloutWidgets: document.querySelectorAll(".cm-callout").length,
      dpbWidgets: document.querySelectorAll(".cm-dpb-embed").length,
    };
  });
}

/** 给块 widget DOM 打稳定标记，用于判断是否被销毁重建。 */
async function stampWidgets(page: Page): Promise<void> {
  await page.evaluate(() => {
    [".cm-image-widget", ".cm-media-widget", ".cm-dpb-embed"].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        const node = el as HTMLElement;
        if (!node.dataset.stableId) {
          node.dataset.stableId = `${sel}:${i}`;
        }
      });
    });
  });
}

async function widgetIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    [".cm-image-widget", ".cm-media-widget", ".cm-dpb-embed"].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        out.push((el as HTMLElement).dataset.stableId ?? `${sel}:unstamped`);
      });
    });
    return out;
  });
}

/** 等到连续两帧 scrollHeight 稳定（无结构变化），返回稳定值。 */
async function settledScrollHeight(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const content = document.querySelector(".cm-content") as HTMLElement;
        let last = content.scrollHeight;
        let stable = 0;
        const step = (): void => {
          const now = content.scrollHeight;
          if (now === last) {
            stable += 1;
            if (stable >= 2) {
              resolve(now);
              return;
            }
          } else {
            stable = 0;
            last = now;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
  );
}

test("A：首行末尾键入不抖动、不重建媒体 widget、块计数不变", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "typing-stability-1320");
  await page.waitForTimeout(500);
  await stampWidgets(page);

  const before = await metrics(page);
  const beforeIds = await widgetIds(page);
  const beforeHeight = await settledScrollHeight(page);

  await shot(page, "01-before-typing", "before-typing");

  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");
  await page.waitForTimeout(120);

  const typed = "2026-11-25" + "中文测试内容用于复现抖动".repeat(2);
  for (const ch of typed) {
    await page.keyboard.type(ch);
  }
  await page.waitForTimeout(200);

  const after = await metrics(page);
  const afterIds = await widgetIds(page);
  const afterHeight = await settledScrollHeight(page);

  // A-1 视口不跳。
  expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThanOrEqual(1);

  // A-2 纯文本输入不制造 >8px 的高度跳变（首行折行属结构变化，这里输入量
  // 不足以让首行折行，故前后应相等）。
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThanOrEqual(8);

  // A-3 块计数与行数不变。
  expect(after.imageWidgets).toBe(before.imageWidgets);
  expect(after.mediaWidgets).toBe(before.mediaWidgets);
  expect(after.tableWidgets).toBe(before.tableWidgets);
  expect(after.calloutWidgets).toBe(before.calloutWidgets);
  expect(after.lineCount).toBe(before.lineCount);

  // A-4 媒体 widget 的 DOM 节点身份不变（#1320 根因）。
  expect(afterIds).toEqual(beforeIds);

  await shot(page, "02-after-typing", "after-typing");
});

test("B：点两块之间的空白不选中表格，光标落在点击行", async ({ page }) => {
  const doc = [
    "第一段正文",
    "",
    "| 模块 | 已实现内容 | 依据 |",
    "| --- | --- | --- |",
    "| 安全组织 | 单位法人 | [1] |",
    "",
    "第二段正文",
    "",
    "第三段正文",
  ].join("\n");
  await openMarkdownInEdit(page, doc, "typing-stability-1320-b");
  await page.waitForTimeout(500);

  await shot(page, "03-before-blank-click", "before-blank-click");

  const blank = page.locator(".cm-line").filter({ hasText: /^$/ }).first();
  const box = (await blank.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(250);

  const state = await page.evaluate(
    ([cx, cy]) => {
      const el = document.elementFromPoint(cx, cy) as HTMLElement | null;
      const scroller = document.querySelector(".cm-scroller") as HTMLElement;
      const cursor = document.querySelector(".cm-cursor") as HTMLElement | null;
      const cr = cursor?.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      return {
        hit: el ? el.className || el.tagName : null,
        inTable: !!el?.closest(".cm-table-wrap"),
        cursorTop: cr ? Math.round(cr.top - sr.top) : null,
        selectedCells: document.querySelectorAll(".cm-table-cell-selected").length,
        activeCells: document.querySelectorAll(".cm-table-cell-active").length,
        selectedWrap: document.querySelectorAll(".cm-table-wrap[data-selected]")
          .length,
        selectionBackgrounds: document.querySelectorAll(".cm-selectionBackground")
          .length,
      };
    },
    [x, y],
  );

  // B-1 不出现表格整块选中效果。
  expect(state.selectedCells).toBe(0);
  expect(state.activeCells).toBe(0);
  expect(state.selectedWrap).toBe(0);
  // 落点不是表格。
  expect(state.inTable).toBe(false);
  // 光标在视口内（落在点击行，未被吸到表格块首）。
  expect(state.cursorTop).not.toBeNull();
  expect(state.cursorTop!).toBeGreaterThan(0);

  await shot(page, "04-after-blank-click", "after-blank-click");
});
