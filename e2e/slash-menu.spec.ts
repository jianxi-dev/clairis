import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  // 浏览器层测试不接 Tauri：注入 IPC mock + store 桥，再用 __biaoyue_openFile__
  // 直接打开一个 markdown 页签。
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 打开一个 markdown 页签并切到编辑模式，返回可输入的内容区。 */
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

test("输入 / 打开斜杠菜单", async ({ page }) => {
  const content = await openMarkdownForEditing(
    page,
    "/Users/test/slash-open.md",
  );
  await page.keyboard.type("/");

  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1);
  await expect(menu.locator(".mdb-slash-item").first()).toBeVisible();
  await expect(content).toContainText("/");
});

test("输入过滤词把菜单收窄到标题行", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-filter.md");
  // 标题的拼音首字母是 b，所以按名称过滤用 `/b`；`/h1` 是子项键码，不是过滤词。
  await page.keyboard.type("/b");

  const items = page.locator(".mdb-slash-grid-menu .mdb-slash-item");
  await expect(items).toHaveCount(3);
  await expect(items.filter({ hasText: "标题" })).toHaveCount(1);

  await page.keyboard.type("t");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("标题");
});

test("回车应用命令并生成一级标题行", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-apply.md");
  await page.keyboard.type("/b");
  await expect(
    page.locator(".mdb-slash-grid-menu .mdb-slash-item"),
  ).toHaveCount(3);

  // 第一次 Enter 打开「标题」浮层；第二次 Enter 应用默认的 1 级标题。
  await page.keyboard.press("Enter");
  await expect(page.locator(".mdb-slash-flyout-item")).toHaveCount(6);
  await page.keyboard.press("Enter");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await page.keyboard.type("标题");

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toContain("# 标题");
});

test("Esc 关闭菜单且 DOM 无残留", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-escape.md");
  await page.keyboard.type("/");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(0);
  // 取消连同触发文本一起带走，不留孤立的 `/`。
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("");
});

test("输入 / 后退格关闭菜单且不留残留", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-backspace.md");
  await page.keyboard.type("/");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  await page.keyboard.press("Backspace");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(0);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("");
});

test("行首逗号归一为斜杠并打开菜单", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-comma.md");
  await page.keyboard.type(",h1");

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("/h1");
  await expect(page.locator(".mdb-slash-empty")).toHaveCount(1);
});

test("全角逗号同样归一为斜杠并打开菜单", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-comma-fullwidth.md");
  await page.keyboard.type("，h1");

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("/h1");
});

test("删空查询后恢复全量 17 行", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-comma-backspace.md");
  await page.keyboard.type("/h1");
  const items = page.locator(".mdb-slash-grid-menu .mdb-slash-item");
  await expect(items).toHaveCount(0);

  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(items).toHaveCount(17);
});

test("代码块内逗号不转换", async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/Users/test/slash-comma-code.md",
      "```\nX\n```",
      "slash-comma-code.md",
    );
  });
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const content = page.locator(".cm-content");
  await content.waitFor({ state: "visible", timeout: 10000 });
  await content.getByText("X").click();
  await page.keyboard.press("Home");
  await page.keyboard.type(",");

  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toBe("```\n,X\n```");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
});

test("Esc 关闭逗号归一打开的菜单且无残留", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-comma-esc.md");
  await page.keyboard.type(",h1");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(0);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("");
});

test("表格网格滑入任意格选中左上到指针的矩形，离开再回来保留选中", async ({
  page,
}) => {
  const shots = ".artifacts/705";
  fs.mkdirSync(shots, { recursive: true });

  const content = await openMarkdownForEditing(
    page,
    "/Users/test/slash-grid.md",
  );
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1);

  const tableRow = menu.locator(".mdb-slash-item").filter({ hasText: "表格" });
  await tableRow.hover();
  const grid = page.locator(".mdb-slash-grid");
  await expect(grid).toBeVisible();

  const onCells = page.locator('.mdb-slash-grid-cell[data-on="true"]');
  await expect(onCells).toHaveCount(1);
  await page.screenshot({ path: `${shots}/01-grid-open.png` });

  const cellAt = (r: number, c: number) =>
    page.locator(`.mdb-slash-grid-cell[data-r="${r}"][data-c="${c}"]`);

  await cellAt(3, 4).hover();
  await expect(onCells).toHaveCount(12);
  await page.screenshot({ path: `${shots}/02-rect-3x4.png` });

  await cellAt(1, 1).hover();
  await expect(onCells).toHaveCount(1);
  await page.screenshot({ path: `${shots}/03-back-1x1.png` });

  // 回到 3×4，然后指针离开表格行（滑到浮层标题）再滑回表格行：选中必须保留。
  await cellAt(3, 4).hover();
  await expect(onCells).toHaveCount(12);
  await page.locator(".mdb-slash-grid-title").hover();
  await tableRow.hover();
  await expect(onCells).toHaveCount(12);
  await page.screenshot({ path: `${shots}/04-after-reenter.png` });

  // 单击第 3 行第 4 列插入 3 行 4 列表格，关闭后无残留网格。
  await cellAt(3, 4).click();
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-grid")).toHaveCount(0);
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toContain("|  |  |  |  |");
  const doc = await storeContent(page);
  expect(doc.split("\n")).toHaveLength(5); // 表头 + 分隔 + 3 行正文
  await expect(content).toBeVisible();
});

test("分栏选区 5 根竖条，滑到第 3 根单击插入 col-3 围栏", async ({ page }) => {
  const shots = ".artifacts/769";
  fs.mkdirSync(shots, { recursive: true });

  const content = await openMarkdownForEditing(
    page,
    "/Users/test/slash-columns.md",
  );
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1);

  await menu.locator(".mdb-slash-item").filter({ hasText: "分栏" }).hover();
  const grid = page.locator(".mdb-slash-grid");
  await expect(grid).toBeVisible();

  // 柱数严格等于 5，且单元无文字标签。
  const cells = grid.locator(".mdb-slash-grid-cell");
  await expect(cells).toHaveCount(5);
  const texts = await cells.evaluateAll((els) =>
    els.map((el) => el.textContent),
  );
  for (const text of texts) expect(text).toBe("");

  const onCells = grid.locator('.mdb-slash-grid-cell[data-on="true"]');
  await expect(onCells).toHaveCount(1);
  await page.screenshot({ path: `${shots}/01-columns-open.png` });

  // 指针滑到第 3 根：选中数恰为 3。
  await cells.nth(2).hover();
  await expect(onCells).toHaveCount(3);
  await page.screenshot({ path: `${shots}/02-hover-3rd.png` });

  await cells.nth(2).click();
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-grid")).toHaveCount(0);
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toBe("::: {.col-3}\n\n:::");
  await page.screenshot({ path: `${shots}/03-after-insert.png` });
  await expect(content).toBeVisible();
});

test("分栏选区键盘左右移动选中，Enter 插入 col-3 围栏", async ({ page }) => {
  const content = await openMarkdownForEditing(
    page,
    "/Users/test/slash-columns-kbd.md",
  );
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1);

  await menu.locator(".mdb-slash-item").filter({ hasText: "分栏" }).hover();
  const grid = page.locator(".mdb-slash-grid");
  await expect(grid).toBeVisible();
  const onCells = grid.locator('.mdb-slash-grid-cell[data-on="true"]');

  await page.keyboard.press("ArrowRight");
  await expect(onCells).toHaveCount(2);
  await page.keyboard.press("ArrowRight");
  await expect(onCells).toHaveCount(3);
  await page.keyboard.press("ArrowLeft");
  await expect(onCells).toHaveCount(2);
  await page.keyboard.press("ArrowRight");
  await expect(onCells).toHaveCount(3);

  await page.keyboard.press("Enter");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-grid")).toHaveCount(0);
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toBe("::: {.col-3}\n\n:::");
  await expect(content).toBeVisible();
});
