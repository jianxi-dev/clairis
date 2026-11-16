import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * #858 / design D15（C4 a 段）：非 Markdown 的纯文本 / 脚本文件编辑态显示行号，
 * Markdown 编辑态仍无行号槽（E-8）。
 *
 * 行号由 `lineNumbersCompartment` 按「模式 + 文件类型」条件装回，切页签 / 切模式
 * 都走 reconfigure，不销毁重建 EditorView。本文件同时用 `.cm-editor` DOM 探针
 * 证明切换前后是同一个编辑器节点（不 remount）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/858");
const ART_920 = path.resolve(process.cwd(), ".artifacts/920");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const TXT_DOC = ["第一行纯文本", "第二行内容", "第三行收尾"].join("\n");
const JS_DOC = [
  "const a = 1;",
  "function add(a, b) {",
  "  return a + b;",
  "}",
].join("\n");
const MD_DOC = "# 标题\n\n正文一段。\n";
// #920：同一段代码，用于编辑态 / 预览态代码盒子对照。
const CODE_DOC = [
  "```js",
  "const a = 1;",
  "function add(a, b) {",
  "  return a + b;",
  "}",
  "```",
  "",
].join("\n");

function shot(page: Page, name: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        name,
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

function shot920(
  page: Page,
  name: string,
  assertion: "passed" | "failed",
): Promise<string> {
  const file = path.join(ART_920, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART_920,
        "--state",
        name,
        "--screenshot",
        file,
        "--assertion",
        assertion,
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  mkdirSync(ART, { recursive: true });
}

async function openFile(
  page: Page,
  filePath: string,
  content: string,
): Promise<void> {
  await page.evaluate(
    ([p, body]) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(p, body, p.split("/").pop());
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    [filePath, content],
  );
  await page.locator(".cm-editor .cm-content").waitFor({ timeout: 10000 });
}

async function switchTo(page: Page, filePath: string): Promise<void> {
  await page.evaluate((p) => {
    const win = window as unknown as Record<string, any>;
    const state = win.__biaoyue_store__.getState();
    const id = Object.keys(state.tabs).find((k) => state.tabs[k].path === p);
    state.switchTab(id);
  }, filePath);
}

async function setMode(page: Page, mode: "preview" | "edit"): Promise<void> {
  await page.evaluate((m) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().setEditorMode(m);
  }, mode);
}

function gutterCounts(page: Page) {
  return page.evaluate(() => ({
    gutters: document.querySelectorAll(".cm-editor .cm-gutters").length,
    lineNumbers: document.querySelectorAll(
      ".cm-editor .cm-lineNumbers .cm-gutterElement",
    ).length,
  }));
}

async function awaitGuttersAtLeastOne(page: Page): Promise<void> {
  await expect
    .poll(async () => (await gutterCounts(page)).gutters, {
      timeout: 5000,
      intervals: [50],
    })
    .toBeGreaterThanOrEqual(1);
}

async function awaitGuttersZero(page: Page): Promise<void> {
  await expect
    .poll(async () => (await gutterCounts(page)).gutters, {
      timeout: 5000,
      intervals: [50],
    })
    .toBe(0);
}

test("A-23.1：纯文本 / 脚本文件编辑态显示行号", async ({ page }) => {
  await boot(page);

  await openFile(page, "/tmp/858-lines.txt", TXT_DOC);
  const txt = await gutterCounts(page);
  expect(txt.gutters).toBeGreaterThanOrEqual(1);
  expect(txt.lineNumbers).toBeGreaterThanOrEqual(1);
  await shot(page, "txt-with-linenumbers");

  await openFile(page, "/tmp/858-lines.js", JS_DOC);
  const js = await gutterCounts(page);
  expect(js.gutters).toBeGreaterThanOrEqual(1);
  expect(js.lineNumbers).toBeGreaterThanOrEqual(1);
  await shot(page, "js-with-linenumbers");
});

test("A-23.2：Markdown 编辑态无行号槽", async ({ page }) => {
  await boot(page);

  await openFile(page, "/tmp/858-lines.md", MD_DOC);
  const md = await gutterCounts(page);
  expect(md.gutters).toBe(0);
  expect(md.lineNumbers).toBe(0);
  await shot(page, "md-no-linenumbers");
});

test("切换文件 / 切换模式行号出现消失，且不 remount EditorView", async ({
  page,
}) => {
  await boot(page);

  await openFile(page, "/tmp/858-switch.txt", TXT_DOC);
  await page.evaluate(() => {
    const el = document.querySelector(".cm-editor") as HTMLElement | null;
    if (el) el.dataset.probe = "same-view";
  });
  await awaitGuttersAtLeastOne(page);

  await openFile(page, "/tmp/858-switch.md", MD_DOC);
  await awaitGuttersZero(page);
  await switchTo(page, "/tmp/858-switch.txt");
  await awaitGuttersAtLeastOne(page);

  const probeAfterSwitch = await page.evaluate(() => {
    const el = document.querySelector(".cm-editor") as HTMLElement | null;
    return el?.dataset.probe ?? null;
  });
  expect(probeAfterSwitch).toBe("same-view");
  await shot(page, "switch-file-gutter-toggles");

  // 同一 txt 页签：预览态无行号，编辑态行号回来；DOM 节点始终是同一个。
  await setMode(page, "preview");
  await awaitGuttersZero(page);
  await setMode(page, "edit");
  await awaitGuttersAtLeastOne(page);

  const probeAfterMode = await page.evaluate(() => {
    const el = document.querySelector(".cm-editor") as HTMLElement | null;
    return el?.dataset.probe ?? null;
  });
  expect(probeAfterMode).toBe("same-view");
  await shot(page, "switch-mode-gutter-toggles");
});

test("A-23.3：行号紧贴正文（行号右缘与正文左缘间距 ≤12px）", async ({
  page,
}) => {
  await boot(page);

  await openFile(page, "/tmp/920-gap.txt", TXT_DOC);
  await awaitGuttersAtLeastOne(page);

  const gap = await page.evaluate(() => {
    const num = document.querySelector<HTMLElement>(
      ".cm-editor .cm-lineNumbers .cm-gutterElement",
    );
    const line = document.querySelector<HTMLElement>(".cm-editor .cm-line");
    if (!num || !line) return null;
    const numRange = document.createRange();
    numRange.selectNodeContents(num);
    const lineRange = document.createRange();
    lineRange.selectNodeContents(line);
    return (
      lineRange.getBoundingClientRect().left -
      numRange.getBoundingClientRect().right
    );
  });

  expect(gap).not.toBeNull();
  await shot920(page, "gap-after", "passed");
  expect(gap!).toBeLessThanOrEqual(12);
});

test("A-23.4：同一段代码编辑态与预览态盒子（字体 / 背景 / 内边距）一致", async ({
  page,
}) => {
  await boot(page);

  await openFile(page, "/tmp/920-codebox.md", CODE_DOC);
  await page.locator(".cm-editor .cm-line.cm-fenced-code").first().waitFor();

  const editBox = await page.evaluate(() => {
    const line = [
      ...document.querySelectorAll<HTMLElement>(
        ".cm-editor .cm-line.cm-fenced-code",
      ),
    ].find((el) => (el.textContent ?? "").includes("const a = 1;"));
    if (!line) return null;
    const cs = getComputedStyle(line);
    return {
      fontFamily: cs.fontFamily,
      backgroundColor: cs.backgroundColor,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
    };
  });
  expect(editBox).not.toBeNull();
  await shot920(page, "code-box-edit", "passed");

  await setMode(page, "preview");
  await page.locator(".preview-content .code-block").waitFor({ timeout: 10000 });

  const previewBox = await page.evaluate(() => {
    const pre = document.querySelector<HTMLElement>(
      ".preview-content .code-block pre",
    );
    if (!pre) return null;
    const cs = getComputedStyle(pre);
    return {
      fontFamily: cs.fontFamily,
      backgroundColor: cs.backgroundColor,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
    };
  });
  expect(previewBox).not.toBeNull();
  await shot920(page, "code-box-preview", "passed");

  expect(editBox!.fontFamily).toBe(previewBox!.fontFamily);
  expect(editBox!.backgroundColor).toBe(previewBox!.backgroundColor);
  expect(editBox!.paddingTop).toBe(previewBox!.paddingTop);
  expect(editBox!.paddingRight).toBe(previewBox!.paddingRight);
  expect(editBox!.paddingBottom).toBe(previewBox!.paddingBottom);
  expect(editBox!.paddingLeft).toBe(previewBox!.paddingLeft);
});
