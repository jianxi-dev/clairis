import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const SHOTS = ".artifacts/825";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

const states: {
  state: string;
  screenshot: string;
  assertion: string;
  recorded_at: string;
  runner: string;
}[] = [];

test.afterAll(() => {
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(
    `${SHOTS}/state-coverage.json`,
    JSON.stringify({ task: "825-slash-comma-columns", states }, null, 2),
  );
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

async function openMarkdownForEditing(page: Page, path: string) {
  await page.evaluate((p) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      p,
      "",
      p.split("/").pop(),
    );
  }, path);
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const content = page.locator(".cm-content");
  await content.waitFor({ state: "visible", timeout: 10000 });
  await content.click();
  return content;
}

async function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const tab = state.tabs[state.activeTabId];
    return (tab?.content as string) ?? "";
  });
}

/**
 * 模拟一次 IME 组合提交：compositionstart → 落字 → compositionend。
 * 真实输入法在组合态内把文本提交进文档，compositionend 才触发归一。
 */
async function imeCommit(page: Page, text: string) {
  await page.evaluate(() => {
    const el = document.querySelector(".cm-content");
    if (!el) throw new Error("no .cm-content");
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true, data: "" }),
    );
  });
  await page.keyboard.type(text);
  await page.evaluate((t) => {
    const el = document.querySelector(".cm-content");
    if (!el) throw new Error("no .cm-content");
    el.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: t }),
    );
  }, text);
}

test("IME 组合提交逗号归一为斜杠并打开菜单，继续输入 f 命中分栏（#825）", async ({
  page,
}) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await openMarkdownForEditing(page, "/Users/test/slash-comma-ime-825.md");

  await imeCommit(page, "，");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("/");

  const shot = `${SHOTS}/01-comma-ime-menu.png`;
  await page.locator(".mdb-slash-menu").screenshot({ path: shot });
  states.push({
    state: "01-comma-ime-menu",
    screenshot: shot,
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@unknown`,
  });

  // 菜单锚在斜杠原位：继续输入 f 作为查询词，不吞字符。
  await page.keyboard.type("f");
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("/f");
  await expect(
    page.locator(".mdb-slash-item").filter({ hasText: "分栏" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".mdb-slash-item").filter({ hasText: "1 栏" }),
  ).toHaveCount(1);
});

test("逗号转斜杠后 /f → 上下键选择、回车插入分栏围栏（#825）", async ({
  page,
}) => {
  await openMarkdownForEditing(page, "/Users/test/slash-comma-apply-825.md");
  await page.keyboard.type(",f");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  await page.keyboard.press("ArrowDown");
  await expect(
    page.locator(".mdb-slash-item[data-selected='true']"),
  ).toContainText("1 栏");

  await page.keyboard.press("Enter");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toBe("::: {.col-1}\n\n:::");
});

test("IME 组合提交半角逗号同样归一（#825）", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-comma-ime-half-825.md");
  await imeCommit(page, ",");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("/");
});

test("IME 组合提交词中逗号不归一、不打开菜单（#825）", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-comma-ime-mid-825.md");
  await page.keyboard.type("你好");
  await imeCommit(page, "，");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("你好,");
});

test("/f 分栏候选图标与轮盘同源且 1~5 栏可区分（#825）", async ({ page }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await openMarkdownForEditing(page, "/Users/test/slash-f-columns-825.md");
  await page.keyboard.type("/f");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  const paths: string[] = [];
  for (let n = 1; n <= 5; n++) {
    const item = page.locator(".mdb-slash-item").filter({ hasText: `${n} 栏` });
    await expect(item).toHaveCount(1);
    await expect(item.locator("svg")).toHaveAttribute(
      "data-icon",
      `columns${n}`,
    );
    const d = await item.locator("svg path").getAttribute("d");
    paths.push(d ?? "");
  }
  // 5 个候选的图形（分隔线数量）两两不同。
  expect(new Set(paths).size).toBe(5);
  // 根行「分栏」与轮盘扇区同名同源。
  await expect(
    page.locator(".mdb-slash-item").filter({ hasText: "分栏" }).locator("svg"),
  ).toHaveAttribute("data-icon", "columns3");

  const shot = `${SHOTS}/02-slash-f-columns.png`;
  await page.locator(".mdb-slash-menu").screenshot({ path: shot });
  states.push({
    state: "02-slash-f-columns",
    screenshot: shot,
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@unknown`,
  });
});

test("轮盘分栏图标对照（#825）", async ({ page }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/columns-825.md",
      "# 标题\n\n正文。",
      "columns-825.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  const line = page.locator(".cm-line").nth(1);
  await line.click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
  await wheel.locator('[data-sector="columns"]').click();
  await expect(wheel.locator("svg[data-icon='columns1']")).toHaveCount(1);

  const shot = `${SHOTS}/03-roulette-columns.png`;
  await wheel.screenshot({ path: shot });
  states.push({
    state: "03-roulette-columns",
    screenshot: shot,
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@unknown`,
  });
});
