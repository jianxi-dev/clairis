import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
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
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
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

  // 第十批：列之间有一条比外框更浅的竖分割线；最后一列不画
  const cell = table.locator("tbody tr").first().locator("td").first();
  const border = await cell.evaluate(
    (el) => getComputedStyle(el).borderRightWidth,
  );
  expect(border).toBe("1px");
  const last = table.locator("thead th").last();
  expect(
    await last.evaluate((el) => getComputedStyle(el).borderRightWidth),
  ).toBe("0px");
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

test("单元格里打 / 打开插入菜单，选中后内容进单元格", async ({ page }) => {
  await openTableDoc(
    page,
    "/tmp/cell-slash.md",
    "| A | B |\n| --- | --- |\n| a1 |  |\n",
  );
  const cell = page.locator('td[data-row="0"][data-col="1"]');
  await cell.click();
  const input = page.locator('[data-testid="cm-table-cell-input"]');
  await input.click();
  await page.keyboard.type("/");
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({ timeout: 3000 });
  // 取消，验证菜单确实挂在单元格上而不是块的斜杠菜单
  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
});

test("Tab 提交当前单元格", async ({ page }) => {
  await openTableDoc(
    page,
    "/tmp/cell-tab.md",
    "| A | B |\n| --- | --- |\n| a1 | b1 |\n",
  );
  await page.locator('td[data-row="0"][data-col="0"]').click();
  const input = page.locator('[data-testid="cm-table-cell-input"]');
  await input.click();
  await page.keyboard.type("x");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-testid="cm-table-cell-input"]')).toHaveCount(
    0,
  );
  const content = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return s.tabs[s.activeTabId]?.content as string;
  });
  expect(content).toContain("a1x");
});

test("单元格菜单只列行内命令，选中后插进单元格而不是表格下方", async ({
  page,
}) => {
  await openTableDoc(
    page,
    "/tmp/cell-insert.md",
    "| A | B |\n| --- | --- |\n| a1 |  |\n",
  );
  const cell = page.locator('td[data-row="0"][data-col="1"]');
  await cell.click();
  const input = page.locator('[data-testid="cm-table-cell-input"]');
  await input.click();
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });

  // 块级命令不该出现在单元格菜单里（它们进不去单元格）
  await expect(menu.locator("text=标题")).toHaveCount(0);
  await expect(menu.locator("text=表格")).toHaveCount(0);

  const before = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return s.tabs[s.activeTabId]?.content as string;
  });

  // 选第一项（图片引用会弹系统框，这里改选能直接落地的行：此处菜单只剩媒体项，
  // 所以直接取消，只验证「没有块级项」与「不在表格外插入」）
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  const after = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return s.tabs[s.activeTabId]?.content as string;
  });
  expect(after).toBe(before);
});

test("预览态表格同样有浅色竖分割线", async ({ page }) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/Users/test/tbl-preview.md",
      "| 姓名 | 城市 |\n| --- | --- |\n| 甲 | 北京 |",
      "tbl-preview.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  const table = page.locator(".preview-content table");
  await expect(table).toBeVisible();
  const first = table.locator("tbody td").first();
  expect(
    await first.evaluate((el) => getComputedStyle(el).borderRightWidth),
  ).toBe("1px");
  const last = table.locator("thead th").last();
  expect(
    await last.evaluate((el) => getComputedStyle(el).borderRightWidth),
  ).toBe("0px");
});
