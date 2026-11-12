import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 编辑态围栏代码按语言高亮（#703 / design D8）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js，切到编辑模式后读 `.cm-line` 上的 `.tok-*`
 * class。每个 state 截图落 `.artifacts/703/`，收尾写 state-coverage.json。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/703");

mkdirSync(ART, { recursive: true });

const DOC = [
  "# 代码高亮",
  "",
  "```js",
  "const answer = 42;",
  "```",
  "",
  "```python",
  "def f():",
  "    return 1",
  "```",
  "",
  "```text",
  "const notHighlighted = 42;",
  "```",
  "",
].join("\n");

interface StateRow {
  state: string;
  screenshot: string;
  assertion: "passed" | "failed" | "untested";
}
const states: StateRow[] = [];

async function record(
  page: Page,
  state: string,
  marker?: string,
): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  if (marker) {
    await page
      .locator(".cm-editor .cm-line", { hasText: marker })
      .first()
      .screenshot({ path: file });
  } else {
    await page.locator(".cm-editor").screenshot({ path: file });
  }
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
  });
}

test.afterAll(() => {
  const byState = new Map<string, StateRow>();
  for (const row of states) byState.set(row.state, row);
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify({ states: [...byState.values()] }, null, 2)}\n`,
  );
});

async function openInEditMode(page: Page, body: string = DOC): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/code-highlight.md", body, "code-highlight.md");
    w.__biaoyue_store__.getState().setEditorMode("edit");
  }, body);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

interface FenceTokenInfo {
  found: boolean;
  keyword: number;
  tokenClasses: string[];
}

function fenceTokenInfo(page: Page, marker: string): Promise<FenceTokenInfo> {
  return page.evaluate((marker) => {
    const lines = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ];
    const line = lines.find((el) => (el.textContent ?? "").includes(marker));
    if (!line) return { found: false, keyword: 0, tokenClasses: [] };
    const tokenClasses = [...line.querySelectorAll("*")].flatMap((el) =>
      [...el.classList].filter((c) => c.startsWith("tok-")),
    );
    return {
      found: true,
      keyword: line.querySelectorAll(".tok-keyword").length,
      tokenClasses,
    };
  }, marker);
}

test("js 围栏按语言高亮：const 产生 .tok-keyword", async ({ page }) => {
  await openInEditMode(page);

  await expect
    .poll(
      async () => (await fenceTokenInfo(page, "const answer = 42;")).keyword,
      {
        timeout: 10000,
      },
    )
    .toBeGreaterThanOrEqual(1);

  const info = await fenceTokenInfo(page, "const answer = 42;");
  expect(info.found).toBe(true);
  expect(info.tokenClasses).toContain("tok-keyword");

  await record(page, "01-js-tokens", "const answer = 42;");
});

test("python 围栏按语言高亮：def 产生 .tok-keyword", async ({ page }) => {
  await openInEditMode(page);

  await expect
    .poll(async () => (await fenceTokenInfo(page, "def f():")).keyword, {
      timeout: 10000,
    })
    .toBeGreaterThanOrEqual(1);

  const info = await fenceTokenInfo(page, "def f():");
  expect(info.found).toBe(true);
  expect(info.tokenClasses).toContain("tok-keyword");

  await record(page, "02-python-tokens", "def f():");
});

test("未知语言围栏不产生 .tok-keyword（回落纯文本）", async ({ page }) => {
  await openInEditMode(page);

  await page
    .locator(".cm-editor .cm-line", { hasText: "const notHighlighted" })
    .first()
    .waitFor({ timeout: 10000 });

  const info = await fenceTokenInfo(page, "const notHighlighted");
  expect(info.found).toBe(true);
  expect(info.keyword).toBe(0);
  expect(info.tokenClasses).not.toContain("tok-keyword");

  await record(page, "03-plain-text-no-tokens", "const notHighlighted");
  await record(page, "04-before-after");
});
