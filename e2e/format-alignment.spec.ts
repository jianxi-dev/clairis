import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1514";
mkdirSync(OUT, { recursive: true });

const DOC = [
  "# 标题",
  "",
  "正文一段用于测量纸宽。",
  "",
  "- 无序甲",
  "- 无序乙",
  "",
  "1. 有序甲",
  "2. 有序乙",
  "",
  "| 列一 | 列二 | 列三 |",
  "| --- | --- | --- |",
  "| 甲 | 乙 | 丙 |",
  "",
  "> 引用一段用于测量右缘。",
  "",
].join("\n");

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
}

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((d) => {
    const w = window as unknown as BW;
    w.__biaoyue_openFile__("/tmp/align/align.md", d, "align.md");
    w.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

test("表格不超正文纸宽；有序与无序 marker 左缘一致", async ({ page }) => {
  await setup(page);

  const geom = await page.evaluate(() => {
    const line = document.querySelector(".cm-line:not(.cm-list)") as HTMLElement;
    const table = document.querySelector(".cm-table-wrap") as HTMLElement;
    const unordered = document.querySelector(".cm-line.cm-list") as HTMLElement;
    const markers = Array.from(
      document.querySelectorAll(".cm-list-marker"),
    ) as HTMLElement[];
    const unorderedMarker = document.querySelector(
      ".cm-line.cm-list .cm-list-bullet",
    ) as HTMLElement | null;
    const orderedMarker = markers[markers.length - 1] ?? null;
    return {
      lineW: line?.getBoundingClientRect().width ?? 0,
      tableW: table?.getBoundingClientRect().width ?? 0,
      unorderedLeft: unorderedMarker?.getBoundingClientRect().left ?? 0,
      orderedLeft: orderedMarker?.getBoundingClientRect().left ?? 0,
      unorderedLineLeft: unordered?.getBoundingClientRect().left ?? 0,
    };
  });

  expect(geom.tableW).toBeLessThanOrEqual(geom.lineW + 2);
  await page.screenshot({ path: `${OUT}/01-table-list.png` });

  if (geom.unorderedLeft && geom.orderedLeft) {
    expect(Math.abs(geom.orderedLeft - geom.unorderedLeft)).toBeLessThanOrEqual(2);
  }
  await page.screenshot({ path: `${OUT}/02-markers.png` });

  await page.evaluate(() => {
    const w = window as unknown as BW;
    w.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-preview.png` });

  await page.evaluate(() => {
    const w = window as unknown as BW;
    w.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/04-back-edit.png` });
});
