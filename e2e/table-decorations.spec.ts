import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

/** 打开一个 markdown 页签、切到编辑模式，光标停在文末正文（表格块非活跃）。 */
async function openTableDoc(page: Page, path: string, content: string) {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: path, c: content },
  );
  await page.locator("button").filter({ hasText: "编辑" }).first().click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  return editor;
}

test("表格渲染出真实网格", async ({ page }) => {
  await openTableDoc(
    page,
    "/Users/test/tbl-grid.md",
    "| 姓名 | 城市 |\n| --- | --- |\n| 甲 | 北京 |\n| 乙 | 上海 |",
  );

  const table = page.locator("table.cm-table");
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveCount(2);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(
    table.locator("tbody tr").first().locator("td").first(),
  ).toHaveText("甲");
});

test("非活跃表格块不显示 | 管道符", async ({ page }) => {
  await openTableDoc(
    page,
    "/Users/test/tbl-inactive.md",
    "| 姓名 | 城市 |\n| --- | --- |\n| 甲 | 北京 |\n\n正文",
  );

  const content = page.locator(".cm-content");
  await expect(content).not.toContainText("| 姓名 |");
  await expect(content).not.toContainText("| --- |");
  await expect(content).not.toContainText("| 甲 |");
  // 单元格文字仍在，只是管道符被 widget 取代。
  await expect(content).toContainText("姓名");
  await expect(content).toContainText("甲");
});

test("点击单元格进入活跃态并显示源码", async ({ page }) => {
  await openTableDoc(
    page,
    "/Users/test/tbl-active.md",
    "| 姓名 | 城市 |\n| --- | --- |\n| 甲 | 北京 |",
  );

  // 非活跃：表格是 widget，源码不可见。
  await expect(page.locator("table.cm-table")).toBeVisible();

  // 点击单元格进入编辑：出现行内 input，其值等于源码单元格文本。
  const cell = page.locator('td[data-row="0"][data-col="0"]');
  await cell.click();
  const input = cell.locator(".cm-table-cell-input");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("甲");
});

test("拖选多个单元格出现选区高亮", async ({ page }) => {
  await openTableDoc(
    page,
    "/Users/test/tbl-select.md",
    "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |",
  );

  const first = page.locator('td[data-row="0"][data-col="0"]');
  const second = page.locator('td[data-row="1"][data-col="1"]');
  await expect(first).toBeVisible();

  const from = await first.boundingBox();
  const to = await second.boundingBox();
  if (!from || !to) throw new Error("cells have no layout box");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 8,
  });
  await page.mouse.up();

  // 矩形范围内四个单元格都带选区高亮。
  for (const [row, col] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]) {
    await expect(
      page.locator(`td[data-row="${row}"][data-col="${col}"]`),
    ).toHaveClass(/cm-table-cell-selected/);
  }
});
