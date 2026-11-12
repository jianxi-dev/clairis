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

test("导出菜单「打印」调用 window.print 恰好一次且不产生导出文件", async ({
  page,
}) => {
  await boot(page);
  await page.locator('[data-testid="pane-menu-button"]').first().click();
  await page.locator('[data-menu-item="export"]').first().hover();
  const submenu = page.locator('[data-testid="pane-export-submenu"]');
  await expect(submenu).toBeVisible({ timeout: 3000 });
  await record(page, "menu-with-print");
  await page.locator('[data-export-item="print"]').click();
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
