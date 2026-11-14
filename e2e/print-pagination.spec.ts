import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * #824 打印分页/媒体真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js，window.print 替换为桩（打印视图保持挂载）。
 * 用 page.emulateMedia({ media: "print" }) + page.pdf() 断言页数、mermaid 不跨页、
 * 视频占位可见；PDF 落 `.artifacts/824/`，state-coverage.json 记录状态。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/824");
mkdirSync(ART, { recursive: true });

const MM_TO_PX = 96 / 25.4;
const MERMAID_MAX_HEIGHT_PX = 240 * MM_TO_PX;

const FORMULA = readFileSync(
  "/Users/mason/Downloads/formula-mermaid.md",
  "utf8",
);

const LONG_DOC = [
  "# 长文档标题",
  "",
  ...Array.from({ length: 120 }, (_, i) => [
    `## 第 ${i + 1} 节`,
    "",
    `第 ${i + 1} 节正文：用于撑出多页内容，打印时不得只渲染前几页。`,
    "",
    "| 列 A | 列 B | 列 C |",
    "| --- | --- | --- |",
    `| ${i + 1}-1 | ${i + 1}-2 | ${i + 1}-3 |`,
    "",
  ]).flat(),
].join("\n");

const TALL_MERMAID_DOC = [
  "# 高图文档",
  "",
  "```mermaid",
  "graph TD",
  ...Array.from(
    { length: 26 },
    (_, i) => `  N${i}[节点 ${i}]${i < 25 ? ` --> N${i + 1}` : ""}`,
  ),
  "```",
  "",
  "## 图后正文",
  "",
  "图后正文第一段：mermaid 之后的内容必须继续输出。",
  "",
  "| 列 A | 列 B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "图后最后一段。",
].join("\n");

const VIDEO_DOC = [
  "# 视频文档",
  "",
  "下面是一个视频：",
  "",
  "![示例视频](clip.mp4)",
  "",
  "视频之后正文。",
].join("\n");

interface StateRow {
  state: string;
  assertion: "passed" | "failed" | "untested";
  detail: string;
  recorded_at: string;
}

const states: StateRow[] = [];

function record(state: string, detail: string): void {
  states.push({
    state,
    assertion: "passed",
    detail,
    recorded_at: new Date().toISOString(),
  });
}

test.afterAll(() => {
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify({ task: "824-print-pagination", states }, null, 2)}\n`,
  );
});

function pdfPageCount(buf: Buffer): number {
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

async function boot(page: Page, content: string, name: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    (c) => window.__biaoyue_openFile__(`/tmp/${name}.md`, c, name),
    content,
  );
  await page.waitForTimeout(400);
}

async function triggerPrint(page: Page): Promise<void> {
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await page.locator('[data-menu-item="print"]').click();
  await page.waitForSelector("#biaoyue-print-root", {
    state: "attached",
    timeout: 5000,
  });
  await page.waitForTimeout(600);
  await page.emulateMedia({ media: "print" });
}

async function printPdf(page: Page, file: string): Promise<Buffer> {
  const buf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });
  writeFileSync(path.join(ART, file), buf);
  return buf;
}

test("[#824] 长文档页数完整、表格与文本存在、父链无夹住", async ({ page }) => {
  await boot(page, LONG_DOC, "long-824");
  await triggerPrint(page);

  const m = await page.evaluate(() => {
    const root = document.querySelector("#biaoyue-print-root")!;
    const content = root.querySelector(".preview-content")!;
    return {
      rootH: Math.round(root.getBoundingClientRect().height),
      bodyH: Math.round(document.body.getBoundingClientRect().height),
      bodyOverflow: getComputedStyle(document.body).overflow,
      contentOverflow: getComputedStyle(content).overflow,
      contentMinHeight: getComputedStyle(content).minHeight,
      text: root.textContent ?? "",
      tables: root.querySelectorAll("table").length,
      rows: root.querySelectorAll("tbody tr").length,
    };
  });

  expect(m.bodyOverflow).toBe("visible");
  expect(m.contentOverflow).toBe("visible");
  expect(m.contentMinHeight).toBe("0px");
  expect(m.tables).toBe(120);
  expect(m.rows).toBe(120);
  expect(m.text).toContain("第 120 节");
  expect(m.text).toContain("120-3");
  expect(m.rootH).toBeGreaterThanOrEqual(m.bodyH - 2);

  const buf = await printPdf(page, "long.pdf");
  const pages = pdfPageCount(buf);
  expect(pages).toBeGreaterThanOrEqual(9);
  record("long-doc", `${pages} 页；120 表格/120 行；root=${m.rootH}px`);
});

test("[#824] formula-mermaid 页数完整且 mermaid 不跨页、图后内容存在", async ({
  page,
}) => {
  await boot(page, FORMULA, "formula-824");
  await triggerPrint(page);

  const m = await page.evaluate(() => {
    const root = document.querySelector("#biaoyue-print-root")!;
    const block = root.querySelector(".mermaid-block")!;
    const svg = block.querySelector("svg")!;
    return {
      blockH: Math.round(block.getBoundingClientRect().height),
      svgH: Math.round(svg.getBoundingClientRect().height),
      breakInside: getComputedStyle(block).breakInside,
      text: root.textContent ?? "",
    };
  });

  expect(m.breakInside).toBe("avoid");
  expect(m.blockH).toBeLessThanOrEqual(MERMAID_MAX_HEIGHT_PX + 60);
  expect(m.svgH).toBeLessThanOrEqual(MERMAID_MAX_HEIGHT_PX + 2);
  expect(m.text).toContain("代码高亮");
  expect(m.text).toContain("MD-Bundle");

  const buf = await printPdf(page, "formula.pdf");
  const pages = pdfPageCount(buf);
  expect(pages).toBeGreaterThanOrEqual(2);
  record("formula-mermaid", `${pages} 页；mermaid block=${m.blockH}px`);
});

test("[#824] 超高 mermaid 缩放到单页内且图后文字/表格继续输出", async ({
  page,
}) => {
  await boot(page, TALL_MERMAID_DOC, "tall-mermaid-824");
  await triggerPrint(page);

  const m = await page.evaluate(() => {
    const root = document.querySelector("#biaoyue-print-root")!;
    const block = root.querySelector(".mermaid-block")!;
    const svg = block.querySelector("svg")!;
    return {
      blockH: Math.round(block.getBoundingClientRect().height),
      svgH: Math.round(svg.getBoundingClientRect().height),
      text: root.textContent ?? "",
      tables: root.querySelectorAll("table").length,
    };
  });

  expect(m.blockH).toBeLessThanOrEqual(MERMAID_MAX_HEIGHT_PX + 60);
  expect(m.svgH).toBeLessThanOrEqual(MERMAID_MAX_HEIGHT_PX + 2);
  expect(m.text).toContain("图后正文第一段");
  expect(m.text).toContain("图后最后一段");
  expect(m.tables).toBe(1);

  const buf = await printPdf(page, "tall-mermaid.pdf");
  const pages = pdfPageCount(buf);
  expect(pages).toBeLessThanOrEqual(4);
  record("tall-mermaid", `${pages} 页；mermaid block=${m.blockH}px`);
});

test("[#824] 视频在打印根内替换为含文件名的可见占位", async ({ page }) => {
  await boot(page, VIDEO_DOC, "video-824");
  await triggerPrint(page);

  const m = await page.evaluate(() => {
    const root = document.querySelector("#biaoyue-print-root")!;
    const box = root.querySelector(".print-video");
    return {
      videoCount: root.querySelectorAll("video").length,
      placeholderCount: root.querySelectorAll(".print-video").length,
      name: box?.querySelector(".print-video-name")?.textContent ?? "",
      note: box?.querySelector(".print-video-note")?.textContent ?? "",
      boxDisplay: box ? getComputedStyle(box).display : null,
      text: root.textContent ?? "",
    };
  });

  expect(m.videoCount).toBe(0);
  expect(m.placeholderCount).toBe(1);
  expect(m.name).toBe("clip.mp4");
  expect(m.note).toContain("打印稿");
  expect(m.boxDisplay).toBe("flex");
  expect(m.text).toContain("视频之后正文");

  const buf = await printPdf(page, "video.pdf");
  expect(pdfPageCount(buf)).toBeGreaterThanOrEqual(1);
  record("video-placeholder", `占位文件名=${m.name}`);
});
