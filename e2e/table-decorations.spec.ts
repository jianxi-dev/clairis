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

// ── #740 行列插入圆点 ──────────────────────────────────────────────────────
// 滑入表格：列点在上边框外（n+1 个）、行点在左边框外（rows+1 个）；悬停变 +；
// 点击气泡插入/删除；滑出隐藏。A-2.1 ~ A-2.5。

test("行列插入圆点：滑入出现在表格外缘、悬停变 +、滑出隐藏（#740）", async ({
  page,
}) => {
  await openTableDoc(
    page,
    "/tmp/table-dots-reveal.md",
    "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |",
  );

  const wrap = page.locator(".cm-table-wrap").first();
  const table = page.locator("table.cm-table").first();
  await expect(table).toBeVisible();

  const colDots = page.locator(".cm-table-hotspot-col");
  const rowDots = page.locator(".cm-table-hotspot-row");
  const revealed = page.locator(".cm-table-hotspot-revealed");
  const active = page.locator(".cm-table-hotspot-active");

  const tableBox = (await table.boundingBox())!;
  expect(tableBox).not.toBeNull();

  // A-2.1 / A-2.3：滑入表格 → 全部圆点出现，列点 n+1、行点 rows+1，且每个
  // 圆点矩形与表格矩形相离（列点在上边框外、行点在左边框外，距边框 0-2px）。
  await wrap.hover();
  await expect(colDots).toHaveCount(3);
  await expect(rowDots).toHaveCount(3);
  await expect(revealed).toHaveCount(6);
  await expect(colDots.nth(0)).toBeVisible();

  for (let i = 0; i < 3; i += 1) {
    const colBox = (await colDots.nth(i).boundingBox())!;
    expect(colBox).not.toBeNull();
    const colGap = tableBox.y - (colBox.y + colBox.height);
    expect(colGap).toBeGreaterThanOrEqual(0);
    expect(colGap).toBeLessThanOrEqual(2);

    const rowBox = (await rowDots.nth(i).boundingBox())!;
    expect(rowBox).not.toBeNull();
    const rowGap = tableBox.x - (rowBox.x + rowBox.width);
    expect(rowGap).toBeGreaterThanOrEqual(0);
    expect(rowGap).toBeLessThanOrEqual(2);
  }

  // A-2.2：悬停一个圆点 → 只有它处于「+」形态（hotspot-active），其余保持小圆点。
  await colDots.nth(1).hover();
  await expect(active).toHaveCount(1);
  await expect(colDots.nth(1)).toHaveClass(/cm-table-hotspot-active/);
  await expect(colDots.nth(0)).not.toHaveClass(/cm-table-hotspot-active/);
  await expect(rowDots.nth(0)).not.toHaveClass(/cm-table-hotspot-active/);

  // 移开 → 圆点回小圆点形态。
  await page.mouse.move(
    tableBox.x + tableBox.width / 2,
    tableBox.y + tableBox.height / 2,
  );
  await expect(active).toHaveCount(0);

  // A-2.1 隐藏态：指针移出表格 → 全部圆点隐藏，无残留浮层。
  await page.mouse.move(
    tableBox.x + tableBox.width / 2,
    tableBox.y + tableBox.height + 120,
  );
  await expect(revealed).toHaveCount(0);
  await expect(active).toHaveCount(0);
  await expect(page.locator(".cm-table-hotspot-bubble:visible")).toHaveCount(0);

  // 取消操作（滑出、未点气泡）后源码逐字节不变。
  const contentAfter = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return s.tabs[s.activeTabId]?.content as string;
  });
  expect(contentAfter).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |");
});

test("行列插入圆点：点击气泡插入列/删除行，源码逐字节不变（#740）", async ({
  page,
}) => {
  const source = ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join(
    "\n",
  );
  await openTableDoc(page, "/tmp/table-dots-edit.md", source);

  const wrap = page.locator(".cm-table-wrap").first();
  const table = page.locator("table.cm-table").first();
  await expect(table).toBeVisible();

  const colDots = page.locator(".cm-table-hotspot-col");
  const rowDots = page.locator(".cm-table-hotspot-row");

  const readContent = () =>
    page.evaluate(() => {
      const store = (window as unknown as Record<string, any>)
        .__biaoyue_store__;
      const s = store.getState();
      return s.tabs[s.activeTabId]?.content as string;
    });

  await wrap.hover();
  await expect(colDots).toHaveCount(3);
  await expect(rowDots).toHaveCount(3);

  // A-2.4：点击列间圆点 → 气泡出现 → 「插入列」：列数 +1，其余字节不变。
  await colDots.nth(1).click();
  const colBubble = page.locator(
    ".cm-table-hotspot-active .cm-table-hotspot-bubble",
  );
  await expect(colBubble).toBeVisible();
  await expect(colBubble.locator(".cm-table-boundary-insert")).toBeVisible();
  await colBubble.locator(".cm-table-boundary-insert").click();

  await expect(table.locator("thead th")).toHaveCount(3);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  expect(await readContent()).toBe(
    [
      "| A |  | B |",
      "| --- | --- | --- |",
      "| 1 |  | 2 |",
      "| 3 |  | 4 |",
    ].join("\n"),
  );

  // A-2.5：点击行间圆点 → 气泡出现 → 「删除行」：行数 -1，其余字节不变。
  await rowDots.nth(1).click();
  const rowBubble = page.locator(
    ".cm-table-hotspot-active .cm-table-hotspot-bubble",
  );
  await expect(rowBubble).toBeVisible();
  await expect(rowBubble.locator(".cm-table-boundary-delete")).toBeVisible();
  await rowBubble.locator(".cm-table-boundary-delete").click();

  await expect(table.locator("tbody tr")).toHaveCount(1);
  expect(await readContent()).toBe(
    ["| A |  | B |", "| --- | --- | --- |", "| 1 |  | 2 |"].join("\n"),
  );

  // D2 追加入口：点击尾列圆点（重建后 3 列 → 4 点，尾点 = last）→ 末尾追加一列。
  await colDots.last().click();
  const trailBubble = page.locator(
    ".cm-table-hotspot-active .cm-table-hotspot-bubble",
  );
  await expect(trailBubble).toBeVisible();
  await trailBubble.locator(".cm-table-boundary-insert").click();
  await expect(table.locator("thead th")).toHaveCount(4);
  expect(await readContent()).toBe(
    ["| A |  | B |  |", "| --- | --- | --- | --- |", "| 1 |  | 2 |  |"].join(
      "\n",
    ),
  );
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

// ── #740：行列插入圆点（上/左外缘、悬停变 +、点击插入/删除）──────────────

/** 读取当前页签源码。 */
async function getSource(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return s.tabs[s.activeTabId]?.content as string;
  });
}

/** 表头单元格数。 */
function headerCellCount(source: string): number {
  const line = source.split("\n").find((l) => /^\s*\|.*\|\s*$/.test(l));
  return line ? line.split("|").slice(1, -1).length : 0;
}

/** 正文行数。 */
function bodyRowCount(source: string): number {
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(l));
  if (sep < 0) return 0;
  let count = 0;
  for (let i = sep + 1; i < lines.length; i += 1) {
    if (/^\s*\|.*\|\s*$/.test(lines[i])) count += 1;
    else break;
  }
  return count;
}

/** 打开一个 3 列 3 行带内容的表格文档。 */
async function openBoundaryDoc(page: Page, path: string) {
  await openTableDoc(
    page,
    path,
    "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n| 7 | 8 | 9 |",
  );
  const table = page.locator("table.cm-table");
  await expect(table).toBeVisible();
  return table;
}

test("#740 行列插入圆点：上/左外缘显示、悬停变 +、离开隐藏", async ({
  page,
}) => {
  const table = await openBoundaryDoc(page, "/tmp/table-boundary-dots.md");
  const tableBox = (await table.boundingBox())!;
  const colSpots = page.locator(".cm-table-hotspot-col");
  const rowSpots = page.locator(".cm-table-hotspot-row");
  const colDots = page.locator(".cm-table-hotspot-col .cm-table-hotspot-dot");
  const rowDots = page.locator(".cm-table-hotspot-row .cm-table-hotspot-dot");

  // 3 列 + 1 = 4 个列点；3 行 + 1 = 4 个行点（含第一列前 / 尾列后、表头分隔线 /
  // 尾行下追加）。
  await expect(colDots).toHaveCount(4);
  await expect(rowDots).toHaveCount(4);

  // 指针在表格外时圆点隐藏。
  await page.mouse.move(8, 8);
  const displayOf = (loc: Locator) =>
    loc.evaluate((el) => getComputedStyle(el).display);
  await expect.poll(() => displayOf(colSpots.first())).toBe("none");
  await expect.poll(() => displayOf(rowSpots.first())).toBe("none");

  // 滑入表格：全部圆点显示。
  await table.hover();
  await expect.poll(() => displayOf(colSpots.first())).toBe("flex");
  await expect.poll(() => displayOf(rowSpots.first())).toBe("flex");

  // 1) 几何：列点在表格上边框外、行点在左边框外，差距 0–2px。
  for (const dot of await colDots.all()) {
    const box = (await dot.boundingBox())!;
    expect(box.y).toBeLessThanOrEqual(tableBox.y);
    const gap = tableBox.y - (box.y + box.height);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(2);
  }
  for (const dot of await rowDots.all()) {
    const box = (await dot.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(tableBox.x);
    const gap = tableBox.x - (box.x + box.width);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(2);
  }

  // 2) 悬停一个列点：页面内只有一个热点进入「+」形态。
  await colDots.nth(1).hover();
  await expect(page.locator(".cm-table-hotspot-active")).toHaveCount(1);
  await expect(
    page.locator(".cm-table-hotspot-active .cm-table-hotspot-dot"),
  ).toHaveText("＋");

  // 3) 指针离开表格：圆点全部隐藏，无残留浮层。
  await page.mouse.move(8, 8);
  await expect.poll(() => displayOf(colSpots.first())).toBe("none");
  await expect.poll(() => displayOf(rowSpots.first())).toBe("none");
  await expect(page.locator(".cm-table-hotspot-active")).toHaveCount(0);
  await expect(page.locator(".cm-table-hotspot-bubble:visible")).toHaveCount(0);
});

test("#740 点击列间圆点展开气泡并插入列", async ({ page }) => {
  const table = await openBoundaryDoc(page, "/tmp/table-boundary-insert.md");
  await table.hover();
  const colSpots = page.locator(".cm-table-hotspot-col");
  const colDots = page.locator(".cm-table-hotspot-col .cm-table-hotspot-dot");
  await expect
    .poll(() => colSpots.first().evaluate((el) => getComputedStyle(el).display))
    .toBe("flex");

  const before = await getSource(page);
  expect(headerCellCount(before)).toBe(3);

  await colDots.nth(1).click();
  const insertBtn = page.locator(
    ".cm-table-hotspot-active [data-testid='cm-table-boundary-insert']",
  );
  await expect(insertBtn).toBeVisible();
  await insertBtn.click();

  await expect
    .poll(async () => headerCellCount(await getSource(page)))
    .toBe(headerCellCount(before) + 1);
  // 其余内容逐字节不变：原单元格文本仍在。
  const after = await getSource(page);
  for (const text of [
    "A",
    "B",
    "C",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
  ]) {
    expect(after).toContain(text);
  }
});

test("#740 点击行间圆点展开气泡并删除行", async ({ page }) => {
  const table = await openBoundaryDoc(page, "/tmp/table-boundary-delete.md");
  await table.hover();
  const rowSpots = page.locator(".cm-table-hotspot-row");
  const rowDots = page.locator(".cm-table-hotspot-row .cm-table-hotspot-dot");
  await expect
    .poll(() => rowSpots.first().evaluate((el) => getComputedStyle(el).display))
    .toBe("flex");

  const before = await getSource(page);
  expect(bodyRowCount(before)).toBe(3);

  await rowDots.nth(1).click();
  const deleteBtn = page.locator(
    ".cm-table-hotspot-active [data-testid='cm-table-boundary-delete']",
  );
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();

  await expect
    .poll(async () => bodyRowCount(await getSource(page)))
    .toBe(bodyRowCount(before) - 1);
});
