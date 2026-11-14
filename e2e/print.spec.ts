import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 打印入口与打印版式（#707 / D12）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js；window.print 被替换为计数器，不打开真实打印对话框。
 * 每个 state 截图落 `.artifacts/707/`，收尾写 state-coverage.json。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/707");

mkdirSync(ART, { recursive: true });

const DOC = [
  "# 标题",
  "",
  "正文段落，用于验证打印入口与打印版式。",
  "",
  "```js",
  "const a = 1;",
  "const b = 2;",
  "```",
  "",
  "> 引用块：打印时不应被分页切断。",
  "",
  "| 列 A | 列 B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "## 二级标题",
  "",
  "更多正文。",
].join("\n");

type Assertion = "passed" | "failed" | "untested";
interface StateRow {
  state: string;
  screenshot: string;
  assertion: Assertion;
  recorded_at: string;
  runner: string;
}
const states: StateRow[] = [];

async function record(page: Page, state: string): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
}

async function recordLocator(locator: Locator, state: string): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  await locator.screenshot({ path: file });
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
}

test.afterAll(() => {
  const byState = new Map<string, StateRow>();
  for (const row of states) byState.set(row.state, row);
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify({ task: "707-print", states: [...byState.values()] }, null, 2)}\n`,
  );
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    const w = window as unknown as { __printCalls?: number };
    w.__printCalls = 0;
    window.print = () => {
      w.__printCalls = (w.__printCalls ?? 0) + 1;
    };
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((content) => {
    window.__biaoyue_openFile__("/tmp/print.md", content, "print.md");
  }, DOC);
  await page.waitForTimeout(300);
}

test("页签右键「打印」调用 window.print 恰好一次且不产生导出文件", async ({
  page,
}) => {
  await boot(page);
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await record(page, "menu-with-print");
  await page.locator('[data-menu-item="print"]').click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __printCalls?: number }).__printCalls ?? 0,
        ),
      { timeout: 5000 },
    )
    .toBe(1);
  const saved = await page.evaluate(() => ({
    files:
      (window as unknown as { __biaoyue_saved_files__?: unknown[] })
        .__biaoyue_saved_files__?.length ?? 0,
    binaries:
      (window as unknown as { __biaoyue_saved_binaries__?: unknown[] })
        .__biaoyue_saved_binaries__?.length ?? 0,
  }));
  expect(saved.files).toBe(0);
  expect(saved.binaries).toBe(0);
});

test("打印态隐藏顶栏/页签/状态栏并对代码块与表格应用 break-inside: avoid", async ({
  page,
}) => {
  await boot(page);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(150);

  const header = page.locator('[data-testid="pane-header"]').first();
  expect(await header.evaluate((el) => getComputedStyle(el).display)).toBe(
    "none",
  );

  const tabStrip = page.locator(".tab-strip").first();
  expect(await tabStrip.evaluate((el) => getComputedStyle(el).display)).toBe(
    "none",
  );

  const statusBar = page.locator('[data-testid="status-bar"]').first();
  expect(await statusBar.evaluate((el) => getComputedStyle(el).display)).toBe(
    "none",
  );

  const railRoot = page.locator(".rail-root").first();
  expect(await railRoot.evaluate((el) => getComputedStyle(el).display)).toBe(
    "none",
  );
  const railEdge = page.locator('[data-testid="rail-edge"]').first();
  await expect(railEdge).toBeHidden();

  const pre = page.locator(".preview-content pre").first();
  expect(await pre.evaluate((el) => getComputedStyle(el).breakInside)).toBe(
    "avoid",
  );
  const table = page.locator(".preview-content table").first();
  expect(await table.evaluate((el) => getComputedStyle(el).breakInside)).toBe(
    "avoid",
  );

  await record(page, "print-media-shell");
  await recordLocator(pre, "print-media-code");
});

test("编辑态打印保留 .cm-content 可见且铺满纸宽", async ({ page }) => {
  await boot(page);
  await page.locator('[data-testid="pane-mode"]').first().click();
  await expect(page.locator(".cm-content").first()).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(150);

  const content = page.locator(".cm-content").first();
  expect(await content.evaluate((el) => getComputedStyle(el).display)).not.toBe(
    "none",
  );
  expect(await content.evaluate((el) => getComputedStyle(el).maxWidth)).toBe(
    "none",
  );
  await record(page, "print-media-edit");
});

test("@page 规则为 A4 纵向、10mm 页边距", async ({ page }) => {
  await boot(page);
  const rules = await page.evaluate(() => {
    const out: string[] = [];
    const PAGE_RULE = 6;
    const MEDIA_RULE = 4;
    for (const sheet of Array.from(document.styleSheets)) {
      let cssRules: CSSRuleList;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(cssRules)) {
        if (rule.type === PAGE_RULE) {
          out.push(rule.cssText);
        } else if (rule.type === MEDIA_RULE) {
          for (const inner of Array.from((rule as CSSMediaRule).cssRules)) {
            if (inner.type === PAGE_RULE) out.push(inner.cssText);
          }
        }
      }
    }
    return out;
  });
  const text = rules.join("\n").toLowerCase();
  expect(text).toContain("size: a4");
  expect(text).toContain("margin: 10mm");
});

test("返回屏幕媒体后 body 无打印残留类", async ({ page }) => {
  await boot(page);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(150);
  await page.emulateMedia({ media: "screen" });
  await page.waitForTimeout(150);
  const bodyClass = await page.evaluate(() => document.body.className);
  expect(bodyClass).not.toContain("print");
  await record(page, "back-to-screen");
});

// ── #807：打印按 Markdown 预览态输出（含 mermaid，打印后恢复现场）─────
//
// window.print 被替换为「快照桩」：调用瞬间记录打印视图的 DOM 状态，
// 不打开真实打印对话框。截图落 `.artifacts/807/`，由 cw-evidence.sh
// record-state 汇总进 state-coverage.json。

const ART_807 = path.resolve(process.cwd(), ".artifacts/807");

interface PrintSnapshot {
  present: boolean;
  previewContent?: number;
  cmLines?: number;
  svg?: number;
  text?: string;
  mermaidPreCount?: number;
  mermaidPreHiddenCount?: number;
}

async function printCalls(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __printCalls?: number }).__printCalls ?? 0,
  );
}

async function snapshotOf(page: Page): Promise<PrintSnapshot> {
  return page.evaluate(
    () =>
      (window as unknown as { __printSnapshot?: PrintSnapshot })
        .__printSnapshot ?? { present: false },
  );
}

async function bootPrintSpy(page: Page, content: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    const w = window as unknown as {
      __printCalls?: number;
      __printSnapshot?: PrintSnapshot;
    };
    w.__printCalls = 0;
    w.__printSnapshot = { present: false };
    window.print = () => {
      w.__printCalls = (w.__printCalls ?? 0) + 1;
      const root = document.querySelector("#biaoyue-print-root");
      if (!root) return;
      const pres = Array.from(
        root.querySelectorAll<HTMLElement>("pre.mermaid"),
      );
      w.__printSnapshot = {
        present: true,
        previewContent: root.querySelectorAll(".preview-content").length,
        cmLines: root.querySelectorAll(".cm-line").length,
        svg: root.querySelectorAll("svg").length,
        text: root.textContent ?? "",
        mermaidPreCount: pres.length,
        mermaidPreHiddenCount: pres.filter((el) => el.hidden).length,
      };
    };
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((c) => {
    window.__biaoyue_openFile__("/tmp/print-807.md", c, "print-807");
  }, content);
  await page.waitForTimeout(400);
}

async function openTabMenuAndPrint(page: Page): Promise<void> {
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await page.locator('[data-menu-item="print"]').click();
}

const MERMAID_DOC = [
  "# 图表文档",
  "",
  "打印视图应当出现下面的流程图。",
  "",
  "```mermaid",
  "graph TD",
  "  A[开始] --> B{判断}",
  "  B -->|是| C[完成]",
  "  B -->|否| A",
  "```",
].join("\n");

test("[#807] 打印视图为预览排版：含 mermaid svg、不含 CodeMirror 源码行", async ({
  page,
}) => {
  await bootPrintSpy(page, MERMAID_DOC);
  await openTabMenuAndPrint(page);
  await expect.poll(() => printCalls(page)).toBe(1);

  const snap = await snapshotOf(page);
  expect(snap.present).toBe(true);
  expect(snap.previewContent).toBe(1);
  expect(snap.cmLines).toBe(0);
  expect(snap.svg).toBe(1);
  expect(snap.text).toContain("打印视图应当出现下面的流程图");

  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: path.join(ART_807, "print-view-mounted.png") });
  await page.emulateMedia({ media: "screen" });
});

test("[#807] 打印媒体下应用根隐藏、打印视图可见且回到正常流", async ({
  page,
}) => {
  await bootPrintSpy(page, DOC);
  await openTabMenuAndPrint(page);
  await expect.poll(() => printCalls(page)).toBe(1);

  // 显示媒体：屏幕外、不可见、不参与命中测试。
  const screenState = await page.evaluate(() => {
    const root = document.querySelector("#biaoyue-print-root");
    if (!root) return null;
    const cs = getComputedStyle(root);
    return {
      visibility: cs.visibility,
      pointerEvents: cs.pointerEvents,
      position: cs.position,
    };
  });
  expect(screenState).not.toBeNull();
  expect(screenState?.visibility).toBe("hidden");
  expect(screenState?.pointerEvents).toBe("none");

  await page.emulateMedia({ media: "print" });
  const printState = await page.evaluate(() => {
    const root = document.querySelector("#biaoyue-print-root");
    if (!root) return null;
    const cs = getComputedStyle(root);
    return {
      appRootDisplay: getComputedStyle(document.querySelector(".app-root")!)
        .display,
      position: cs.position,
      visibility: cs.visibility,
    };
  });
  expect(printState).not.toBeNull();
  expect(printState?.appRootDisplay).toBe("none");
  expect(printState?.position).toBe("static");
  expect(printState?.visibility).toBe("visible");
  await expect(page.locator("#biaoyue-print-root")).toBeVisible();

  await page.screenshot({ path: path.join(ART_807, "print-media-on.png") });
  await page.emulateMedia({ media: "screen" });
});

test("[#807] 编辑态触发打印仍输出预览排版，模式保持 edit", async ({ page }) => {
  await bootPrintSpy(page, MERMAID_DOC);
  await page.locator('[data-testid="pane-mode"]').first().click();
  await expect(page.locator(".cm-content").first()).toBeVisible();

  await openTabMenuAndPrint(page);
  await expect.poll(() => printCalls(page)).toBe(1);

  const snap = await snapshotOf(page);
  expect(snap.present).toBe(true);
  expect(snap.cmLines).toBe(0);
  expect(snap.svg).toBe(1);
  expect(snap.text).toContain("打印视图应当出现下面的流程图");
  expect(
    await page
      .locator('[data-testid="pane-mode"]')
      .first()
      .getAttribute("data-mode"),
  ).toBe("edit");

  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: path.join(ART_807, "edit-mode-print.png") });
  await page.emulateMedia({ media: "screen" });
});

test("[#807] 打印结束后视图无残留、标记清除、滚动位置精确还原", async ({
  page,
}) => {
  const longDoc = [
    "# 长文档",
    "",
    ...Array.from(
      { length: 80 },
      (_, i) => `第 ${i + 1} 段正文，用于撑出可滚动的预览内容。`,
    ).flatMap((line) => [line, ""]),
  ].join("\n");
  await bootPrintSpy(page, longDoc);

  const scrollEl = page.locator(".content-scroll").first();
  await scrollEl.evaluate((el) => {
    el.scrollTop = 900;
  });
  await page.waitForTimeout(150);
  const before = await scrollEl.evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(0);

  await openTabMenuAndPrint(page);
  await expect.poll(() => printCalls(page)).toBe(1);

  // 打印媒体期间应用根被 display:none，是最可能丢掉滚动位置的路径。
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(120);
  await page.emulateMedia({ media: "screen" });

  await expect.poll(() => page.locator("#biaoyue-print-root").count()).toBe(0);
  const marker = await page.evaluate(() =>
    document.documentElement.getAttribute("data-biaoyue-printing"),
  );
  expect(marker).toBeNull();
  const bodyClass = await page.evaluate(() => document.body.className);
  expect(bodyClass).not.toContain("print");

  const after = await scrollEl.evaluate((el) => el.scrollTop);
  expect(after).toBe(before);

  await page.screenshot({ path: path.join(ART_807, "cleaned-up.png") });
});

test("[#807] mermaid 语法错误时保留可读源码块且不阻断打印", async ({
  page,
}) => {
  const badDoc = [
    "# 坏图文档",
    "",
    "```mermaid",
    "graph TD",
    "  A[未闭合 --> B",
    "",
    "```",
    "",
    "坏图之后仍有正文。",
  ].join("\n");
  await bootPrintSpy(page, badDoc);
  await openTabMenuAndPrint(page);
  await expect.poll(() => printCalls(page)).toBe(1);

  const snap = await snapshotOf(page);
  expect(snap.present).toBe(true);
  expect(snap.mermaidPreCount).toBe(1);
  expect(snap.mermaidPreHiddenCount).toBe(0);
  expect(snap.text).toContain("坏图之后仍有正文");

  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: path.join(ART_807, "invalid-mermaid.png") });
  await page.emulateMedia({ media: "screen" });
});
