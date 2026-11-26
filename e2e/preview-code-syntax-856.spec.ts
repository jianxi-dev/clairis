import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 预览态语法颜色与代码块缩进（#856 / C4b / design D15）。
 *
 * 复用既有高亮器（renderers/highlight.ts）的 .tok-* token 与语言别名表：
 * 脚本文件（.js/.py/.ts）预览按扩展名取别名，Markdown 围栏代码块走同一渲染层。
 * 断言读真实 DOM 与计算样式（QG-4）：token 节点存在 + 前导缩进严格等于源码。
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/856");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

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

async function openPreview(
  page: Page,
  fileName: string,
  body: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ fileName, body }) => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_openFile__(`/tmp/${fileName}`, body, fileName);
      w.__biaoyue_store__.getState().setEditorMode("preview");
    },
    { fileName, body },
  );
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

interface CodeGeometry {
  tokens: number;
  keywords: number;
  whiteSpace: string;
  lines: string[];
}

async function readCode(page: Page): Promise<CodeGeometry> {
  return page.evaluate(() => {
    const pre = document.querySelector(".preview-content pre");
    const text = pre?.textContent ?? "";
    return {
      tokens: document.querySelectorAll(".preview-content [class*='tok-']")
        .length,
      keywords: document.querySelectorAll(".preview-content .tok-keyword")
        .length,
      whiteSpace: pre ? getComputedStyle(pre).whiteSpace : "",
      lines: text.split("\n"),
    };
  });
}

function leadingSpaces(line: string): string {
  return line.match(/^\s*/)?.[0] ?? "";
}

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

test("js 文件预览：产生 .tok-* 且前导缩进等于源码", async ({ page }) => {
  const body = [
    "function add(a, b) {",
    "  const sum = a + b;",
    "  return sum;",
    "}",
  ].join("\n");
  await openPreview(page, "pcs856.js", body);

  await expect
    .poll(async () => (await readCode(page)).keywords, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  const geo = await readCode(page);
  expect(geo.tokens).toBeGreaterThanOrEqual(1);
  expect(geo.whiteSpace).toBe("pre");
  expect(leadingSpaces(geo.lines[1])).toBe("  ");

  await shot(page, "preview-js-tokens", "preview-js-tokens");
});

test("python 文件预览：产生 .tok-* 且四级缩进保留", async ({ page }) => {
  const body = ["def f():", "    return 1"].join("\n");
  await openPreview(page, "pcs856.py", body);

  await expect
    .poll(async () => (await readCode(page)).keywords, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  const geo = await readCode(page);
  expect(geo.tokens).toBeGreaterThanOrEqual(1);
  expect(geo.whiteSpace).toBe("pre");
  expect(leadingSpaces(geo.lines[1])).toBe("    ");

  await shot(page, "preview-python-tokens", "preview-python-tokens");
});

test("ts 文件预览：按扩展名取别名产生 .tok-*", async ({ page }) => {
  const body = ["interface Point {", "  x: number;", "  y: number;", "}"].join(
    "\n",
  );
  await openPreview(page, "pcs856.ts", body);

  await expect
    .poll(async () => (await readCode(page)).tokens, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  const geo = await readCode(page);
  expect(geo.whiteSpace).toBe("pre");
  expect(leadingSpaces(geo.lines[1])).toBe("  ");

  await shot(page, "preview-ts-tokens", "preview-ts-tokens");
});

test("markdown 围栏代码块预览：tok-* 与缩进保留", async ({ page }) => {
  const body = [
    "# 代码块",
    "",
    "```js",
    "function add(a, b) {",
    "  const sum = a + b;",
    "  return sum;",
    "}",
    "```",
    "",
  ].join("\n");
  await openPreview(page, "pcs856.md", body);

  await expect
    .poll(async () => (await readCode(page)).keywords, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  const geo = await readCode(page);
  expect(geo.tokens).toBeGreaterThanOrEqual(1);
  expect(geo.whiteSpace).toBe("pre");
  expect(leadingSpaces(geo.lines[1])).toBe("  ");

  await shot(page, "preview-markdown-fence", "preview-markdown-fence");
});

test("纯文本预览：无语言回落纯文本，缩进仍保留", async ({ page }) => {
  const body = ["plain text", "  indented line", "    deeper line"].join("\n");
  await openPreview(page, "pcs856.txt", body);

  const geo = await readCode(page);
  expect(geo.tokens).toBe(0);
  expect(geo.keywords).toBe(0);
  expect(geo.whiteSpace).toBe("pre-wrap");
  expect(leadingSpaces(geo.lines[1])).toBe("  ");
  expect(leadingSpaces(geo.lines[2])).toBe("    ");

  await shot(page, "preview-plain-text", "preview-plain-text");
});
