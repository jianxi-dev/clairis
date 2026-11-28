import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1678 真机：预览 ↔ 编辑切换后落在不同位置（比例换算在两态高度差异大时
 * 必然错位）。现在按「顶部可见文本」恢复，断言切换后该段仍在视口内。
 */

const PNG = makePngDataUrl(400, 300, [90, 140, 200]);

async function openDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((src: string) => {
    const win = window as unknown as Record<string, any>;
    win.__convertedMediaPaths__ = [];
    win.__TAURI_INTERNALS__.convertFileSrc = (p: string) => {
      win.__convertedMediaPaths__.push(p);
      return src;
    };
  }, PNG);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 30000 });
  const body =
    Array.from(
      { length: 26 },
      (_, i) => `第 ${i} 段：这一段用于验证切换保位。`,
    ).join("\n\n") +
    `\n\n![示例](${PNG})\n\n` +
    Array.from(
      { length: 26 },
      (_, i) => `后 ${i} 段：这一段用于验证切换保位。`,
    ).join("\n\n") +
    "\n";
  await page.evaluate((doc: string) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/modeanchor/doc.md", doc, "doc.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, body);
  await page.locator(".cm-content").waitFor({ timeout: 30000 });
}

/** 视口（编辑态 scroller 或预览容器）顶部可见文本。 */
function topText(page: Page, mode: "edit" | "preview"): Promise<string> {
  return page.evaluate((mode) => {
    const sel = (m: string) =>
      m === "edit" ? ".cm-scroller" : ".content-scroll";
    const el = document.querySelector(sel(mode)) as HTMLElement | null;
    if (!el) return "";
    const top = el.getBoundingClientRect().top;
    const blocks = Array.from(
      el.querySelectorAll<HTMLElement>(
        "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table,.cm-line",
      ),
    );
    for (const b of blocks) {
      const r = b.getBoundingClientRect();
      if (r.bottom <= top + 1) continue;
      const text = (b.textContent ?? "").trim();
      if (text) return text.slice(0, 30);
    }
    return "";
  }, mode);
}

async function setMode(page: Page, mode: "edit" | "preview"): Promise<void> {
  await page.evaluate((m: string) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().setEditorMode(m);
  }, mode);
  await page.waitForTimeout(350);
}

test("预览↔编辑切换后落在同一段内容", async ({ page }) => {
  await openDoc(page);
  // 编辑态滚到中部（图片之后）
  await page.evaluate(() => {
    const sc = document.querySelector(".cm-scroller") as HTMLElement;
    sc.scrollTop = Math.round((sc.scrollHeight - sc.clientHeight) * 0.62);
  });
  await page.waitForTimeout(250);
  const anchor = await topText(page, "edit");
  expect(anchor.length).toBeGreaterThan(4);

  await setMode(page, "preview");
  const inPreview = await topText(page, "preview");
  // 同一段内容的文本片段应出现在预览顶部附近
  const head = anchor.slice(0, 8);
  expect(inPreview).toContain(head.slice(0, 4));

  await setMode(page, "edit");
  const backInEdit = await topText(page, "edit");
  expect(backInEdit).toContain(head.slice(0, 4));
});
