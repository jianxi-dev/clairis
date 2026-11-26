import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1515";
mkdirSync(OUT, { recursive: true });

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
}

const DOC = Array.from({ length: 80 }, (_, i) => `第 ${i + 1} 行：滚动保位测试段落。`).join("\n\n");

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((d) => {
    const w = window as unknown as BW;
    w.__biaoyue_openFile__("/tmp/ms/ms.md", d, "ms.md");
    w.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function scrollerTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const els = [
      ...document.querySelectorAll<HTMLElement>(".content-scroll, .cm-scroller"),
    ];
    for (const el of els) {
      if (el.scrollHeight > el.clientHeight + 100 && el.scrollTop > 0) return el.scrollTop;
    }
    return -1;
  });
}

test("编辑态滚到中部切预览再切回，位置不回顶", async ({ page }) => {
  await setup(page);
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);
  const before = await scrollerTop(page);
  expect(before).toBeGreaterThan(100);
  await page.screenshot({ path: `${OUT}/01-edit-mid.png` });

  await page.evaluate(() => {
    const w = window as unknown as BW;
    w.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await page.waitForTimeout(700);
  const previewTop = await scrollerTop(page);
  expect(previewTop).toBeGreaterThan(100);
  await page.screenshot({ path: `${OUT}/02-preview-kept.png` });

  await page.evaluate(() => {
    const w = window as unknown as BW;
    w.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(700);
  const after = await scrollerTop(page);
  expect(after).toBeGreaterThan(100);
  expect(Math.abs(after - before) / Math.max(1, before)).toBeLessThan(0.2);
  await page.screenshot({ path: `${OUT}/03-back-edit-kept.png` });

  await page.evaluate(() => {
    const w = window as unknown as BW;
    w.__biaoyue_store__.getState().setEditorMode("source");
  });
  await page.waitForTimeout(500);
  const sourceTop = await scrollerTop(page);
  expect(sourceTop).toBeGreaterThan(100);
  await page.screenshot({ path: `${OUT}/04-source-kept.png` });
});
