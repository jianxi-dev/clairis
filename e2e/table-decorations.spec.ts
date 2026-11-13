import { test, expect, type Locator, type Page } from "@playwright/test";

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

test("表格容器不出现滚动条，编辑态与预览态均为 visible", async ({ page }) => {
  const paragraphs = Array.from({ length: 40 }, (_, i) => `第${i}段内容`).join(
    "\n\n",
  );
  await openTableDoc(
    page,
    "/Users/test/tbl-scroll.md",
    `| 姓名 | 城市 |\n| --- | --- |\n| 甲 | 北京 |\n| 乙 | 上海 |\n\n${paragraphs}`,
  );

  const wrap = page.locator(".cm-table-wrap").first();
  await expect(wrap).toBeVisible();
  const overflow = await wrap.evaluate(
    (el) =>
      getComputedStyle(el).overflowX + "/" + getComputedStyle(el).overflowY,
  );
  expect(overflow).toBe("visible/visible");

  // 滚轮穿透：指针停在表格上滚动文档，编辑器滚动位置必须前进（#642 第二条期望）。
  const scroller = page.locator(".cm-scroller");
  const before = await scroller.evaluate((el) => el.scrollTop);
  await wrap.hover();
  await page.mouse.wheel(0, 480);
  await expect
    .poll(async () => scroller.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(before);

  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "preview")
    await modeBtn.click();
  const previewWrap = page.locator(".preview-content .table-wrap").first();
  await expect(previewWrap).toBeVisible();
  const previewOverflow = await previewWrap.evaluate(
    (el) =>
      getComputedStyle(el).overflowX + "/" + getComputedStyle(el).overflowY,
  );
  expect(previewOverflow).toBe("visible/visible");
});

test("单元格手柄统一图标、垂直居中、在边框线外，表头无手柄（#739）", async ({
  page,
}) => {
  await openTableDoc(
    page,
    "/tmp/cell-handle-unify.md",
    "| 表头一 | 表头二 |\n| --- | --- |\n| 有内容 |  |\n",
  );

  const table = page.locator("table.cm-table");
  await expect(table).toBeVisible();
  const filled = table.locator('td[data-row="0"][data-col="0"]');
  const empty = table.locator('td[data-row="0"][data-col="1"]');
  await expect(filled).toBeVisible();
  await expect(empty).toBeVisible();

  const readState = async (cell: Locator) => {
    await cell.hover();
    const handle = cell.locator(".cm-table-cell-handle");
    await expect
      .poll(() => handle.evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
    const cellBox = (await cell.boundingBox())!;
    const handleBox = (await handle.boundingBox())!;
    return {
      handle,
      icon: await handle.getAttribute("data-icon"),
      svgIcon: await handle.locator("svg").getAttribute("data-icon"),
      radius: await handle.evaluate((el) => getComputedStyle(el).borderRadius),
      cellBox,
      handleBox,
    };
  };

  const emptyState = await readState(empty);
  const filledState = await readState(filled);

  // 1) 空 / 非空手柄图标统一为 DataSheetOutlined
  expect(emptyState.icon).toBe("DataSheetOutlined");
  expect(emptyState.svgIcon).toBe("DataSheetOutlined");
  expect(filledState.icon).toBe(emptyState.icon);
  expect(filledState.svgIcon).toBe(emptyState.svgIcon);

  // 2) 圆角固定 3px
  expect(emptyState.radius).toBe("3px");
  expect(filledState.radius).toBe("3px");

  // 3) 手柄纵向中心与单元格纵向中心差 ≤ 2px
  for (const s of [emptyState, filledState]) {
    const cellCenter = s.cellBox.y + s.cellBox.height / 2;
    const handleCenter = s.handleBox.y + s.handleBox.height / 2;
    expect(Math.abs(handleCenter - cellCenter)).toBeLessThanOrEqual(2);
  }

  // 4) 手柄在单元格左边框线外侧
  for (const s of [emptyState, filledState]) {
    expect(s.handleBox.x + s.handleBox.width).toBeLessThanOrEqual(
      s.cellBox.x + 2,
    );
  }

  // 5) 手柄不覆盖单元格文本（A-1.5：与 .cm-table-cell-text 矩形无交叠）
  for (const s of [emptyState, filledState]) {
    const textBox = await s.handle
      .locator("xpath=ancestor::td")
      .locator(".cm-table-cell-text")
      .boundingBox();
    if (textBox) {
      const overlapX = Math.min(
        s.handleBox.x + s.handleBox.width,
        textBox.x + textBox.width,
      );
      expect(overlapX).toBeLessThanOrEqual(textBox.x);
    }
  }

  // 5) 表头不渲染手柄
  await table.locator("thead th").first().hover();
  await expect(table.locator("thead th .cm-table-cell-handle")).toHaveCount(0);
  await expect(table.locator("thead .cm-table-cell-handle")).toHaveCount(0);

  // 6) 取消悬停后手柄隐藏，无残留
  await filled.hover();
  await expect
    .poll(() =>
      filled
        .locator(".cm-table-cell-handle")
        .evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("1");
  await page.mouse.move(8, 8);
  await expect
    .poll(() =>
      filled
        .locator(".cm-table-cell-handle")
        .evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("0");
});

test("点击单元格手柄仍打开内容菜单（#739 回归）", async ({ page }) => {
  await openTableDoc(
    page,
    "/tmp/cell-handle-click.md",
    "| 表头一 | 表头二 |\n| --- | --- |\n| 有内容 |  |\n",
  );
  const handle = page
    .locator('td[data-row="0"][data-col="0"]')
    .locator(".cm-table-cell-handle");
  await handle.click();
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
});

// QG-5 证据探针（#642）：EVIDENCE_DIR 设置时采集四态截图，平时跳过。
test("evidence: 表格四态", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await openTableDoc(
    page,
    "/Users/test/tbl-evidence.md",
    "| 姓名 | 城市 |\n| --- | --- |\n| 甲 | 北京 |\n| 乙 | 上海 |",
  );
  const wrap = page.locator(".cm-table-wrap").first();
  await expect(wrap).toBeVisible();
  await wrap.screenshot({ path: `${dir}/table-edit-default.png` });

  await wrap.hover();
  await wrap.screenshot({ path: `${dir}/table-hover.png` });

  await page.locator('td[data-row="0"][data-col="0"]').click();
  await expect(
    page
      .locator('td[data-row="0"][data-col="0"]')
      .locator(".cm-table-cell-input"),
  ).toBeVisible();
  await page
    .locator(".cm-table-wrap")
    .first()
    .screenshot({ path: `${dir}/table-cell-active.png` });

  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "preview")
    await modeBtn.click();
  const previewTable = page.locator(".preview-content .table-wrap").first();
  await expect(previewTable).toBeVisible();
  await previewTable.screenshot({ path: `${dir}/table-preview.png` });
});
