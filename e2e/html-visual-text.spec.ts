import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ART = path.resolve(process.cwd(), ".artifacts/247");

mkdirSync(ART, { recursive: true });

/**
 * 文本编辑（E-16 切片 4 / 票 165）。
 *
 * 断言必须落在「改完之后用户能看到什么」：`content` 变了、预览里是改后的字、
 * 编辑器没被每个按键重建（否则光标会丢，输入根本进行不下去）。
 */

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif}p{font-size:16px;margin:0;padding:16px}",
  "</style></head><body><h1>标题</h1><p>第一段</p></body></html>",
].join("");

async function openVisual(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/t/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  const iframe = page.locator('iframe[title="HTML 可视化编辑"]');
  await expect(iframe).toHaveCount(1);
  return page.frameLocator('iframe[title="HTML 可视化编辑"]');
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    return (s.tabs[s.activeTabId]?.content as string) ?? "";
  });
}

test("双击进入编辑，输入回写 content", async ({ page }) => {
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();
  // 进入编辑态：该元素变成 contenteditable
  await expect(p).toHaveAttribute("contenteditable", "true");
  await page.screenshot({ path: path.join(ART, "html-visual-edit.png") });

  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("改过的段落");

  await expect
    .poll(() => content(page), { timeout: 5000 })
    .toContain("改过的段落");
  const after = await content(page);
  expect(after).not.toContain("第一段");
  // 编辑期痕迹不许留在 content 里
  expect(after).not.toContain("data-cm-");
  expect(after).not.toContain("contenteditable");
});

test("改动在预览里可见，且编辑器未被每次按键重建", async ({ page }) => {
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();

  // 记下编辑中元素身份：若每键重建 iframe，这句后面的断言会因为节点销毁而失败
  await p.evaluate((el) => {
    (el as unknown as Record<string, unknown>).__probe = "keep";
  });
  await page.keyboard.type("XY");
  await expect.poll(() => content(page), { timeout: 5000 }).toContain("XY");

  const kept = await p.evaluate(
    (el) => (el as unknown as Record<string, unknown>).__probe === "keep",
  );
  expect(kept).toBe(true);

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  const preview = page.locator('iframe[title="HTML 预览"]');
  await expect(preview).toHaveCount(1);
  const srcdoc = await preview.getAttribute("srcdoc");
  expect(srcdoc).toContain("XY");
  await page.screenshot({ path: path.join(ART, "html-live-preview.png") });
});

test("先打字再回车：打字内容不丢，且确实拆成两块", async ({ page }) => {
  // 这条是回归：Enter 会在同一 tick 连发 textEditInput / textEditEnd / splitBlock，
  // 曾经三者共用渲染期的旧 content，导致打字被最后一条覆盖、连拆块都 no-op。
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("改过的段落");
  await expect
    .poll(() => content(page), { timeout: 5000 })
    .toContain("改过的段落");

  // 光标移到中间再回车：在末尾按 Enter 属于「新建空块」，本切片不做
  await p.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode() as Text | null;
    if (!node) throw new Error("no text node");
    const r = document.createRange();
    r.setStart(node, 3);
    r.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  });
  await page.keyboard.press("Enter");
  // 轮询"真的变成两块"，而不是轮询一句打字时就已经成立的内容
  await expect
    .poll(async () => ((await content(page)).match(/<p/g) ?? []).length, {
      timeout: 5000,
    })
    .toBeGreaterThanOrEqual(2);
  const after = await content(page);
  expect(after).not.toContain("第一段");
  expect((after.match(/<p/g) ?? []).length).toBeGreaterThanOrEqual(2);
});

test("可视化改完切到源码，CM6 里是新内容（不被旧文档回滚）", async ({
  page,
}) => {
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("源码里也要看到这句");
  await expect
    .poll(() => content(page), { timeout: 5000 })
    .toContain("源码里也要看到这句");

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("source");
  });
  const cm = page.locator(".cm-content");
  await expect(cm).toBeVisible();
  await expect(cm).toContainText("源码里也要看到这句");
});

test("Enter 把段落拆成两块", async ({ page }) => {
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();
  // 光标放到 "第" 与 "一" 之间。
  // 注意 firstChild 是锚点注释，不是文本节点——按 firstChild 设光标会落在注释上，
  // 选区为空、Enter 什么都不做（这个坑踩过一次）。用 TreeWalker 找真正的文本节点。
  await p.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode() as Text | null;
    if (!node) throw new Error("no text node");
    const r = document.createRange();
    r.setStart(node, 1);
    r.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  });
  await page.keyboard.press("Enter");

  await expect
    .poll(() => content(page), { timeout: 5000 })
    .toMatch(/<p[^>]*>第<\/p>/);
  const after = await content(page);
  expect(after).toContain("一段");
  expect((after.match(/<p/g) ?? []).length).toBe(2);
});
