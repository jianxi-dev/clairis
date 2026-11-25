import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const APP_URL = "http://localhost:1420";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

// mock 的默认集合必须与仓库内 JSON 默认源逐项一致（单一真相源对账）。
test("mock 默认集合与 html-toolbar.default.json 对账", () => {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, "src-tauri/src/resources/html-toolbar.default.json"),
      "utf8",
    ),
  );
  const mockSource = readFileSync(
    resolve(REPO_ROOT, "e2e/mocks/tauri-mock.js"),
    "utf8",
  );
  const block = mockSource.match(/var DEFAULT_SURFACE_ITEMS = (\[[\s\S]*?\]);/);
  expect(block, "mock 应有 DEFAULT_SURFACE_ITEMS").not.toBeNull();
  const mockItems = new Function(`return ${block![1]};`)() as unknown[];
  expect(mockItems).toEqual(json.items);
});

const DOC = [
  "<!DOCTYPE html><html><body>",
  "<h1>标题</h1>",
  "<p>段落正文</p>",
  "</body></html>",
].join("\n");

const BAR = ".cm-floating-toolbar";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/surface/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("source");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openBar(page: Page) {
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  const bar = page.locator(BAR);
  await expect(bar).toBeVisible({ timeout: 3000 });
  return bar;
}

function setToolbarItems(page: Page, items: string[] | null) {
  return page.evaluate((value) => {
    const store = (window as unknown as Record<string, any>)
      .__biaoyue_editor_store__;
    store.getState().setConfig({ htmlToolbarItems: value });
  }, items);
}

async function actionIds(page: Page, bar: import("@playwright/test").Locator) {
  const ids = await bar
    .locator("[data-action]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
  // clear-format 是横条末尾的固定控件，不属于数据面集合。
  return ids.filter((id) => id !== "clear-format");
}

test("覆盖顺序驱动渲染顺序，未知 id 被过滤", async ({ page }) => {
  await boot(page);
  await setToolbarItems(page, ["format-bold", "nope", "format-italic"]);
  const bar = await openBar(page);
  expect(await actionIds(page, bar)).toEqual(["format-bold", "format-italic"]);
});

test("覆盖为 null 渲染完整默认 12 项", async ({ page }) => {
  await boot(page);
  await setToolbarItems(page, null);
  const bar = await openBar(page);
  expect(await actionIds(page, bar)).toHaveLength(12);
});

test("覆盖为空数组回落默认 12 项", async ({ page }) => {
  await boot(page);
  await setToolbarItems(page, []);
  const bar = await openBar(page);
  expect(await actionIds(page, bar)).toHaveLength(12);
});

test("默认顺序与既有内置顺序一致（回归红线）", async ({ page }) => {
  await boot(page);
  const bar = await openBar(page);
  expect(await actionIds(page, bar)).toEqual([
    "ai-rewrite",
    "ai-translate",
    "ai-polish",
    "format-bold",
    "format-italic",
    "format-underline",
    "format-strike",
    "format-code",
    "format-link",
    "align-left",
    "align-center",
    "align-right",
  ]);
});
