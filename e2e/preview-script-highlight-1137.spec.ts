import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 脚本类文件整文件预览语法高亮（#1137 / change=shell-preview-refine/3.1 / design D4）。
 *
 * 整文件预览分支按扩展名查 renderers/highlight.ts 的 LANGUAGES 表：.js / .ts / .py
 * 命中即渲染 .tok-*，表外扩展名（.foo）回退纯文本。断言读真实 DOM（QG-4），
 * 不断言内部函数调用。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1137");
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

interface PreviewGeo {
  tokens: number;
  text: string;
}

async function readPreview(page: Page): Promise<PreviewGeo> {
  return page.evaluate(() => ({
    tokens: document.querySelectorAll(".preview-content [class*='tok-']")
      .length,
    text: document.querySelector(".preview-content pre")?.textContent ?? "",
  }));
}

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

test("js 整文件预览：按扩展名命中 LANGUAGES 产生 .tok-*", async ({ page }) => {
  const body = [
    "function add(a, b) {",
    "  const sum = a + b;",
    "  return sum;",
    "}",
  ].join("\n");
  await openPreview(page, "highlight1137.js", body);

  await expect
    .poll(async () => (await readPreview(page)).tokens, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  await shot(page, "js-highlight", "js-highlight");
});

test("ts 整文件预览：按扩展名命中 LANGUAGES 产生 .tok-*", async ({ page }) => {
  const body = ["interface Point {", "  x: number;", "  y: number;", "}"].join(
    "\n",
  );
  await openPreview(page, "highlight1137.ts", body);

  await expect
    .poll(async () => (await readPreview(page)).tokens, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  await shot(page, "ts-highlight", "ts-highlight");
});

test("py 整文件预览：按扩展名命中 LANGUAGES 产生 .tok-*", async ({ page }) => {
  const body = ["def f():", "    return 1"].join("\n");
  await openPreview(page, "highlight1137.py", body);

  await expect
    .poll(async () => (await readPreview(page)).tokens, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  await shot(page, "py-highlight", "py-highlight");
});

test("超过 20k 字符的脚本整文件预览仍着色（用户实测文件 26.8k）", async ({
  page,
}) => {
  const lines: string[] = [];
  for (let i = 0; i < 900; i++) {
    lines.push(`const value${i} = ${i} + "segment-${i}";`);
  }
  const body = lines.join("\n");
  expect(body.length).toBeGreaterThan(20000);
  await openPreview(page, "highlight-large-1137.js", body);

  await expect
    .poll(async () => (await readPreview(page)).tokens, { timeout: 15000 })
    .toBeGreaterThanOrEqual(1);

  await shot(page, "js-large-highlight", "js-large-highlight");
});

test("未知扩展名 .foo：回退纯文本且文本完整", async ({ page }) => {
  const body = [
    "function add(a, b) {",
    "  const sum = a + b;",
    "  return sum;",
    "}",
  ].join("\n");
  await openPreview(page, "highlight1137.foo", body);

  const geo = await readPreview(page);
  expect(geo.tokens).toBe(0);
  expect(geo.text).toBe(body);

  await shot(page, "unknown-ext-plaintext", "unknown-ext-plaintext");
});
