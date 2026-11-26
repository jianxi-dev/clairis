import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/839");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const DOC = [
  "# 编辑态边框对齐",
  "",
  "这是一段正文文本，用来测量正文文本块的左右边界。",
  "",
  ...Array.from(
    { length: 8 },
    (_, i) => `填充段落 ${i + 1}，让文档高度超过一屏。`,
  ),
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
  "> 引用第一行",
  "> 引用第二行",
  "",
  ...Array.from({ length: 8 }, (_, i) => `引用之后的填充段落 ${i + 1}。`),
  "",
  "```mermaid",
  "flowchart LR",
  "  A --> B",
  "```",
  "",
  "正文之后。",
].join("\n");

interface Edges {
  left: number;
  right: number;
}

interface BorderGeometry {
  body: Edges;
  code: Edges;
  quote: Edges;
  mermaid: Edges;
  bodyMaxWidth: string;
}

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openInEditMode(page: Page, body: string = DOC): Promise<void> {
  await page.evaluate((text) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/edit-block-borders-839.md",
      text,
      "edit-block-borders-839.md",
    );
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  }, body);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator(".cm-mermaid-block .mermaid-view svg").first().waitFor({
    timeout: 10000,
  });
}

/** 写真实截图并登记到 state-coverage.json（ui-surface 证据面）。 */
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
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

/** 三类块的边框盒与正文行盒的左右 x（取整，规避亚像素抖动）。 */
async function readGeometry(page: Page): Promise<BorderGeometry> {
  return page.evaluate(() => {
    const edges = (el: Element): Edges => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    };
    const body = Array.from(
      document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ).find((el) => (el.textContent ?? "").includes("这是一段正文文本"));
    const code = document.querySelector<HTMLElement>(
      ".cm-editor .cm-line.cm-fenced-code",
    );
    const quote = document.querySelector<HTMLElement>(
      ".cm-editor .cm-line.cm-quote",
    );
    const mermaid = document.querySelector<HTMLElement>(".cm-mermaid-block");
    if (!body || !code || !quote || !mermaid) {
      throw new Error("border geometry: block not found");
    }
    return {
      body: edges(body),
      code: edges(code),
      quote: edges(quote),
      mermaid: edges(mermaid),
      bodyMaxWidth: getComputedStyle(body).maxWidth,
    };
  });
}

async function centerOn(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: "center" });
  }, selector);
  await page.waitForTimeout(200);
}

test("编辑态代码块 / 引用块 / mermaid 块左右边框与正文文本块对齐", async ({
  page,
}) => {
  await openInEditMode(page);

  const geo = await readGeometry(page);

  // .cm-line 基础行宽不变（E-23 / A6 硬约束）。
  expect(geo.bodyMaxWidth).toBe("1080px");

  const leftDiff = {
    code: geo.code.left - geo.body.left,
    quote: geo.quote.left - geo.body.left,
    mermaid: geo.mermaid.left - geo.body.left,
  };
  const rightDiff = {
    code: geo.code.right - geo.body.right,
    quote: geo.quote.right - geo.body.right,
    mermaid: geo.mermaid.right - geo.body.right,
  };
  const mutualLeft = {
    codeQuote: geo.code.left - geo.quote.left,
    codeMermaid: geo.code.left - geo.mermaid.left,
    quoteMermaid: geo.quote.left - geo.mermaid.left,
  };
  const mutualRight = {
    codeQuote: geo.code.right - geo.quote.right,
    codeMermaid: geo.code.right - geo.mermaid.right,
    quoteMermaid: geo.quote.right - geo.mermaid.right,
  };

  // 证据态 1：代码块居中（左 / 右边框与正文行盒对齐）。
  await centerOn(page, ".cm-editor .cm-line.cm-fenced-code");
  await shot(page, "code-aligned", "code-aligned");

  // 证据态 2：引用块居中。
  await centerOn(page, ".cm-editor .cm-line.cm-quote");
  await shot(page, "quote-aligned", "quote-aligned");

  // 证据态 3：mermaid 块居中。
  await centerOn(page, ".cm-mermaid-block");
  await shot(page, "mermaid-aligned", "mermaid-aligned");

  // 证据态 4：三类一致 + 测量探针（正文行盒左右各一条参考线）。
  await page.evaluate((g) => {
    const body = Array.from(
      document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ).find((el) => (el.textContent ?? "").includes("这是一段正文文本"));
    if (!body) return;
    body.scrollIntoView({ block: "center" });
    const r = body.getBoundingClientRect();
    for (const x of [r.left, r.right]) {
      const line = document.createElement("div");
      line.style.cssText =
        "position:fixed;top:0;bottom:0;width:1px;background:#e11d48;" +
        "z-index:99999;pointer-events:none";
      line.style.left = `${x}px`;
      document.body.appendChild(line);
    }
    const probe = document.createElement("div");
    probe.id = "border-probe";
    probe.style.cssText =
      "position:fixed;left:8px;top:8px;z-index:99999;background:#111;color:#0f0;" +
      "font:12px monospace;padding:8px;border-radius:6px;white-space:pre";
    probe.textContent = [
      `body  ${g.body.left} .. ${g.body.right}`,
      `code  ${g.code.left} .. ${g.code.right}`,
      `quote ${g.quote.left} .. ${g.quote.right}`,
      `merm  ${g.mermaid.left} .. ${g.mermaid.right}`,
    ].join("\n");
    document.body.appendChild(probe);
  }, geo);
  await page.waitForTimeout(200);
  await shot(page, "three-consistent", "three-consistent");
  await page.evaluate(() => {
    document.getElementById("border-probe")?.remove();
    document
      .querySelectorAll("div[style*='background:#e11d48']")
      .forEach((el) => {
        el.remove();
      });
  });

  // A-6.1：三类块与正文文本块左 / 右边界 x 差为 0。
  expect(leftDiff).toEqual({ code: 0, quote: 0, mermaid: 0 });
  expect(rightDiff).toEqual({ code: 0, quote: 0, mermaid: 0 });

  // A-6.2：三类块彼此左 / 右边界 x 差为 0。
  expect(mutualLeft).toEqual({ codeQuote: 0, codeMermaid: 0, quoteMermaid: 0 });
  expect(mutualRight).toEqual({
    codeQuote: 0,
    codeMermaid: 0,
    quoteMermaid: 0,
  });
});
