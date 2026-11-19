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

test("A-23.3：行号槽紧贴正文（槽右缘与正文左缘间距 ≤12px）", async ({
  page,
}) => {
  await boot(page);

  await openFile(page, "/tmp/920-gap.txt", TXT_DOC);
  await awaitGuttersAtLeastOne(page);

  // #1145：断言口径由「数字字形右缘」改为「行号槽右缘（分隔线位置）」。
  // 自 #1145 起，编辑态数字与分隔线之间保留 0.75em 间隙（与预览态一致），
  // 字形右缘因此左移，旧的「字形紧贴」口径不再成立；但槽（分隔线）右缘仍贴正文。
  const gap = await page.evaluate(() => {
    const num = document.querySelector<HTMLElement>(
      ".cm-editor .cm-lineNumbers .cm-gutterElement",
    );
    const line = document.querySelector<HTMLElement>(".cm-editor .cm-line");
    if (!num || !line) return null;
    const lineRange = document.createRange();
    lineRange.selectNodeContents(line);
    return (
      lineRange.getBoundingClientRect().left - num.getBoundingClientRect().right
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
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });

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

// ── #1051 / A-13：预览态纯文本 / 脚本行号列 ─────────────────────
// 预览 .txt / .js 出现逐行的重点行号列；字体 / 颜色严格复用编辑态行号槽 token；
// 行号与分隔线之间保留非零间隙；Markdown 预览不引入行号节点。
const ART_1051 = path.resolve(process.cwd(), ".artifacts/1051");

function shot1051(page: Page, name: string): Promise<string> {
  mkdirSync(ART_1051, { recursive: true });
  const file = path.join(ART_1051, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART_1051,
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

function previewNumberCounts(page: Page) {
  return page.evaluate(() => ({
    total: document.querySelectorAll("[data-preview-line-number]").length,
    inPreview: document.querySelectorAll(
      ".preview-content [data-preview-line-number]",
    ).length,
  }));
}

test("A-13.1：预览态 .txt / .js 出现逐行行号列", async ({ page }) => {
  await boot(page);

  await openFile(page, "/tmp/1051-preview.txt", TXT_DOC);
  await setMode(page, "preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  const txt = await previewNumberCounts(page);
  expect(txt.inPreview).toBeGreaterThanOrEqual(1);
  expect(txt.inPreview).toBe(3);
  await shot1051(page, "01-txt-preview-numbers");

  await openFile(page, "/tmp/1051-preview.js", JS_DOC);
  await setMode(page, "preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  const js = await previewNumberCounts(page);
  expect(js.inPreview).toBeGreaterThanOrEqual(1);
  expect(js.inPreview).toBe(4);
});

test("A-13.2：预览行号 font-family / 颜色与编辑态行号槽一致", async ({
  page,
}) => {
  await boot(page);

  await openFile(page, "/tmp/1051-parity.txt", TXT_DOC);
  await awaitGuttersAtLeastOne(page);
  const gutter = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      ".cm-editor .cm-lineNumbers .cm-gutterElement",
    );
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fontFamily: cs.fontFamily, color: cs.color };
  });
  expect(gutter).not.toBeNull();

  await setMode(page, "preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  const preview = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      ".preview-content [data-preview-line-number]",
    );
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fontFamily: cs.fontFamily, color: cs.color };
  });
  expect(preview).not.toBeNull();
  await shot1051(page, "02-editor-gutter-parity");

  expect(preview!.fontFamily).toBe(gutter!.fontFamily);
  expect(preview!.color).toBe(gutter!.color);
});

test("A-13.3：预览行号与分隔线之间存在非零间隙", async ({ page }) => {
  await boot(page);

  await openFile(page, "/tmp/1051-gap.txt", TXT_DOC);
  await setMode(page, "preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });

  const gaps = await page.evaluate(() => {
    const col = document.querySelector<HTMLElement>(
      ".preview-content .code-line-numbers",
    );
    const num = document.querySelector<HTMLElement>(
      ".preview-content [data-preview-line-number]",
    );
    if (!col || !num) return null;
    const colRect = col.getBoundingClientRect();
    const numRect = num.getBoundingClientRect();
    return {
      numberToSeparator: colRect.right - numRect.right,
      paddingRight: getComputedStyle(col).paddingRight,
    };
  });
  expect(gaps).not.toBeNull();
  await shot1051(page, "03-gap-nonzero");

  expect(gaps!.numberToSeparator).toBeGreaterThan(0);
  expect(parseFloat(gaps!.paddingRight)).toBeGreaterThan(0);
});

test("A-13.4：Markdown 预览零行号，关闭文档后无残留", async ({ page }) => {
  await boot(page);

  await openFile(page, "/tmp/1051-preview.md", MD_DOC);
  await setMode(page, "preview");
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
  expect((await previewNumberCounts(page)).total).toBe(0);
  await shot1051(page, "04-md-preview-none");

  // 曾显示行号的文档关闭后，DOM 不残留行号节点。
  await openFile(page, "/tmp/1051-close.txt", TXT_DOC);
  await setMode(page, "preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  expect((await previewNumberCounts(page)).total).toBeGreaterThan(0);

  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    const state = win.__biaoyue_store__.getState();
    const id = Object.keys(state.tabs).find(
      (k) => state.tabs[k].path === "/tmp/1051-close.txt",
    );
    if (id) state.closeTab(id);
  });
  await expect
    .poll(async () => (await previewNumberCounts(page)).total, {
      timeout: 5000,
      intervals: [50],
    })
    .toBe(0);
});

// ── #1051 补强：真实默认模式 + 真实 invoke 预览面 ─────────────────
// 主预览不再先强制 edit：按 store.openFile 的默认模式断言（.txt→preview、
// .js→edit），脚本文件用真实格头按钮进入 preview。悬浮预览走
// FloatingPreview 自己的 invoke("open_file_direct") 真实读取路径，
// 与主预览同属「文本文件预览态」，一并要求行号列。

async function editorModeOf(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    const s = win.__biaoyue_store__.getState();
    return s.activeTabId ? s.tabs[s.activeTabId].editorMode : null;
  });
}

async function openViaBridge(page: Page, filePath: string, body: string) {
  await page.evaluate(
    ([p, content]) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(p, content, p.split("/").pop());
    },
    [filePath, body],
  );
}

async function pinRail(page: Page): Promise<void> {
  const edge = page.locator('[data-testid="rail-edge"]');
  if (await edge.isVisible().catch(() => false)) await edge.hover();
  const panel = page.locator('[data-testid="rail-panel"]');
  await expect(panel).toBeVisible();
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(panel).toHaveAttribute("data-rail-state", "pinned");
}

async function hoverRecentRow(page: Page, title: string): Promise<void> {
  const row = page
    .locator('[data-section="recent"] [data-testid="rail-item"]')
    .filter({ hasText: title })
    .first();
  await expect(row).toBeVisible();
  const box = (await row.boundingBox())!;
  await page.mouse.move(
    box.x + Math.min(box.width - 20, box.width * 0.9),
    box.y + box.height / 2,
  );
  await expect(page.locator('[data-testid="floating-preview"]')).toBeVisible({
    timeout: 3000,
  });
}

function floatingCounts(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="floating-preview"]');
    const doc = root?.querySelector('[data-testid="preview-doc"]');
    return {
      kind: doc?.getAttribute("data-doc-kind") ?? null,
      numbers: root
        ? root.querySelectorAll("[data-preview-line-number]").length
        : 0,
      block: root
        ? root.querySelectorAll(".code-block.has-line-numbers").length
        : 0,
    };
  });
}

test("A-13.5：真实默认模式直开 .txt 即 preview 且行号逐行；.js 经格头按钮入 preview", async ({
  page,
}) => {
  await boot(page);

  await openViaBridge(page, "/tmp/1051-default.txt", TXT_DOC);
  expect(await editorModeOf(page)).toBe("preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  expect((await previewNumberCounts(page)).inPreview).toBe(3);

  await openViaBridge(page, "/tmp/1051-default.js", JS_DOC);
  expect(await editorModeOf(page)).toBe("edit");
  await page.locator('[data-testid="pane-mode"]').first().click();
  await expect.poll(() => editorModeOf(page)).toBe("preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  expect((await previewNumberCounts(page)).inPreview).toBe(4);
});

test("A-13.6：悬浮预览（真实 open_file_direct 面）文本 / 脚本出现行号列", async ({
  page,
}) => {
  await boot(page);

  await openViaBridge(page, "/tmp/1051-float.txt", TXT_DOC);
  await pinRail(page);
  await hoverRecentRow(page, "1051-float.txt");
  const txt = await floatingCounts(page);
  expect(txt.kind).toBe("text");
  expect(txt.block).toBe(1);
  expect(txt.numbers).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().closePreview();
  });
  await openViaBridge(page, "/tmp/1051-float.js", JS_DOC);
  await hoverRecentRow(page, "1051-float.js");
  const js = await floatingCounts(page);
  expect(js.kind).toBe("code");
  expect(js.block).toBe(1);
  expect(js.numbers).toBeGreaterThanOrEqual(1);
});

// ── #1145：编辑态行号槽间隙与预览态对齐 ─────────────────────
// ab562cd 把 `.cm-gutterElement` 的 padding 归零，编辑态行号紧贴分隔线；
// 预览态 `.code-line-numbers` 一直保留 0.75em。此处锁住两侧间隙一致，
// 防止再次被归零。
const ART_1145 = path.resolve(process.cwd(), ".artifacts/1145");

function shot1145(page: Page, name: string): Promise<string> {
  mkdirSync(ART_1145, { recursive: true });
  const file = path.join(ART_1145, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART_1145,
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

async function editGutterGap(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      ".cm-editor .cm-lineNumbers .cm-gutterElement",
    );
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      paddingRight: parseFloat(cs.paddingRight),
      fontSize: parseFloat(cs.fontSize),
    };
  });
}

async function previewGutterGap(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      ".preview-content .code-line-numbers",
    );
    if (!el) return null;
    return parseFloat(getComputedStyle(el).paddingRight);
  });
}

test("A-13.7：编辑态行号槽间隙 ≈ 0.75em 且与预览态一致（#1145）", async ({
  page,
}) => {
  await boot(page);

  await openFile(page, "/tmp/1145-gutter.txt", TXT_DOC);
  await awaitGuttersAtLeastOne(page);
  const edit = await editGutterGap(page);
  expect(edit).not.toBeNull();
  await shot1145(page, "01-edit-gutter-gap");

  await setMode(page, "preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  const preview = await previewGutterGap(page);
  expect(preview).not.toBeNull();
  await shot1145(page, "02-preview-gutter-gap");

  // 编辑态 = 0.75em × 编辑态字号（14.45px → ≈10.84px）
  expect(
    Math.abs(edit!.paddingRight - 0.75 * edit!.fontSize),
  ).toBeLessThanOrEqual(2);
  // 与预览态绝对值对齐（两侧字号 0.85em / 0.88em，差 <1px）
  expect(Math.abs(edit!.paddingRight - preview!)).toBeLessThanOrEqual(2);
});

test("A-13.8：脚本文件编辑态行号槽间隙同样保留（#1145）", async ({ page }) => {
  await boot(page);

  await openFile(page, "/tmp/1145-gutter.js", JS_DOC);
  await awaitGuttersAtLeastOne(page);
  const edit = await editGutterGap(page);
  expect(edit).not.toBeNull();
  await shot1145(page, "03-edit-gutter-gap-js");

  await setMode(page, "preview");
  await page
    .locator(".preview-content .code-block")
    .waitFor({ timeout: 10000 });
  const preview = await previewGutterGap(page);
  expect(preview).not.toBeNull();
  await shot1145(page, "04-preview-gutter-gap-js");

  expect(
    Math.abs(edit!.paddingRight - 0.75 * edit!.fontSize),
  ).toBeLessThanOrEqual(2);
  expect(Math.abs(edit!.paddingRight - preview!)).toBeLessThanOrEqual(2);
});
