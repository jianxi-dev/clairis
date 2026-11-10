import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const WHEEL = '[data-testid="selection-roulette"]';

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/roulette.md", body, "roulette.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function selectLine(page: Page, index: number): Promise<void> {
  const line = page.locator(".cm-line").nth(index);
  await line.click({ clickCount: 3 });
  await expect(page.locator(WHEEL)).toBeVisible({ timeout: 3000 });
}

async function openSector(page: Page, id: string): Promise<void> {
  await page.locator(`[data-sector="${id}"]`).click({ force: true });
}

test("选中文字出现轮盘：8 扇区 + 圆心，旧横条不残留", async ({ page }) => {
  await selectLine(page, 2);
  const wheel = page.locator(WHEEL);
  await expect(wheel.locator(".sr-sector")).toHaveCount(8);
  await expect(wheel.locator('[data-testid="roulette-center"]')).toHaveCount(1);
  await expect(page.locator(".cm-floating-toolbar")).toHaveCount(0);
  for (const sector of [
    "smart",
    "convert",
    "align",
    "columns",
    "history",
    "clear",
    "format",
    "color",
  ]) {
    await expect(wheel.locator(`[data-sector="${sector}"]`)).toHaveCount(1);
  }
});

test("圆心落在鼠标落点（未夹取时偏差 ≤1px）", async ({ page }) => {
  const line = await page.locator(".cm-line").nth(2).boundingBox();
  if (!line) throw new Error("行不可测量");
  const x = line.x + 80;
  const y = line.y + line.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator(WHEEL)).toBeVisible({ timeout: 3000 });
  const wheel = await page.locator(WHEEL).boundingBox();
  if (!wheel) throw new Error("轮盘不可测量");
  const viewport = page.viewportSize()!;
  const expectX = Math.min(Math.max(x + 30, 218), viewport.width - 218);
  const expectY = Math.min(Math.max(y, 218), viewport.height - 218);
  expect(Math.abs(wheel.x + wheel.width / 2 - expectX)).toBeLessThanOrEqual(1);
  expect(Math.abs(wheel.y + wheel.height / 2 - expectY)).toBeLessThanOrEqual(1);
});

test("按住拖选期间不出现，松手 90ms 后出现", async ({ page }) => {
  const line = await page.locator(".cm-line").nth(2).boundingBox();
  if (!line) throw new Error("行不可测量");
  await page.mouse.move(line.x + 30, line.y + line.height / 2);
  await page.mouse.down();
  await page.mouse.move(line.x + 180, line.y + line.height / 2, { steps: 6 });
  await expect(page.locator(WHEEL)).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator(WHEEL)).toBeVisible({ timeout: 3000 });
});

test("点击才展开：6 项扇形紧排，跨度 90°", async ({ page }) => {
  await selectLine(page, 2);
  await expect(page.locator(".sr-item")).toHaveCount(0);
  await openSector(page, "format");
  const items = page.locator('.sr-unit[data-band="2"]');
  await expect(items).toHaveCount(6);

  const wheel = await page.locator(WHEEL).boundingBox();
  if (!wheel) throw new Error("轮盘不可测量");
  const cx = wheel.x + wheel.width / 2;
  const cy = wheel.y + wheel.height / 2;
  const angles: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const b = (await items.nth(i).boundingBox())!;
    angles.push(
      ((Math.atan2(b.y + b.height / 2 - cy, b.x + b.width / 2 - cx) * 180) /
        Math.PI +
        360) %
        360,
    );
  }
  angles.sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i += 1) {
    expect(Math.abs(angles[i] - angles[i - 1] - 15)).toBeLessThanOrEqual(2);
  }
  expect(
    Math.abs(angles[angles.length - 1] - angles[0] - 75),
  ).toBeLessThanOrEqual(3);
});

test("加粗与斜体连击都写入源码且轮盘保持展开", async ({ page }) => {
  await selectLine(page, 2);
  await openSector(page, "format");
  await expect(page.locator('.sr-unit[data-band="2"]')).toHaveCount(6);
  await page
    .locator('.sr-sec[data-band="2"][data-action="format-bold"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toMatch(/\*\*第一段正文\s*\*\*/);
  await page
    .locator('.sr-sec[data-band="2"][data-action="format-italic"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toMatch(/(^|[^*])\*第一段正文\s*\*/);
  await expect(page.locator(WHEEL)).toHaveCount(1);
});

test("格式二层顺序：链接 / 下划线 / 斜体 / 加粗 / 行内代码 / 删除线", async ({
  page,
}) => {
  await selectLine(page, 2);
  await openSector(page, "format");
  const ids = await page
    .locator('.sr-sec[data-band="2"]')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.action),
    );
  expect(ids).toEqual([
    "format-link",
    "format-underline",
    "format-italic",
    "format-bold",
    "format-code",
    "format-strike",
  ]);
});

test("颜色扇区为双圈：文字色 9 格、背景色 16 格", async ({ page }) => {
  await selectLine(page, 2);
  await openSector(page, "color");
  await expect(page.locator(".sr-color-font")).toHaveCount(9);
  await expect(page.locator(".sr-color-bg")).toHaveCount(16);
  await expect(page.locator(".sr-color-A")).toHaveCount(9);
});

test("转换二层：段落 7 项，顺序为代码块/表格/标题/列表/高亮/引用/分割线", async ({
  page,
}) => {
  await selectLine(page, 2);
  await openSector(page, "convert");
  const ids = await page
    .locator('.sr-sec[data-band="2"]')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.action),
    );
  expect(ids).toEqual([
    "convert-code",
    "convert-table",
    "convert-heading-group",
    "convert-list-group",
    "convert-callout-group",
    "convert-quote",
    "convert-divider",
  ]);
});

test("标题三层 H1–H6 画在外环，二层保留并降到 0.8", async ({ page }) => {
  await selectLine(page, 2);
  await openSector(page, "convert");
  await page
    .locator('.sr-sec[data-band="2"][data-action="convert-heading-group"]')
    .click({ force: true });

  await expect(page.locator('.sr-sec[data-band="3"]')).toHaveCount(6);
  await expect(page.locator('.sr-sec[data-band="2"]')).toHaveCount(7);
  const opacity = await page
    .locator('.sr-sec[data-band="2"]')
    .first()
    .evaluate((n) => Number((n as SVGPathElement).style.opacity || "1"));
  expect(opacity).toBeCloseTo(0.8, 5);
  await expect(page.locator('[data-testid="roulette-center"]')).toHaveAttribute(
    "aria-label",
    "返回",
  );

  await page
    .locator('.sr-sec[data-band="3"][data-action="convert-h6"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toMatch(/###### 第一段正文/);
});

test("高亮三层十三类：注释/信息/摘要/待办/提示/成功/问题/警告/失败/危险/Bug/示例/引用", async ({
  page,
}) => {
  await selectLine(page, 2);
  await openSector(page, "convert");
  await page
    .locator('.sr-sec[data-band="2"][data-action="convert-callout-group"]')
    .click({ force: true });
  const ids = await page
    .locator('.sr-sec[data-band="3"]')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.action),
    );
  expect(ids).toEqual([
    "convert-note",
    "convert-info",
    "convert-abstract",
    "convert-todo",
    "convert-tip",
    "convert-success",
    "convert-question",
    "convert-warning",
    "convert-failure",
    "convert-danger",
    "convert-bug",
    "convert-example",
    "convert-quote",
  ]);
  await page
    .locator('.sr-sec[data-band="3"][data-action="convert-note"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toContain("> [!note]");
});

test("分栏 3 写入 ::: {.col-3}", async ({ page }) => {
  await selectLine(page, 2);
  await openSector(page, "columns");
  await page
    .locator('.sr-sec[data-band="2"][data-action="columns-3"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toMatch(/::: \{\.col-3\}/);
});

test("清除格式保留链接", async ({ page }) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/roulette-clear.md",
      "**粗** [链接](https://a.b) 普通\n",
      "roulette-clear.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor();
  await selectLine(page, 0);
  await openSector(page, "clear");
  await expect.poll(() => content(page)).not.toContain("**");
  expect(await content(page)).toContain("[链接](https://a.b)");
});

test("格式刷：取一次格式后刷到另一段，计数为 2", async ({ page }) => {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    const st = win.__biaoyue_store__.getState();
    Object.keys(st.tabs).forEach((id) => st.closeTab(id));
    win.__biaoyue_openFile__(
      "/tmp/roulette-brush.md",
      "**第一段**\n\n第二段\n\n第三段\n",
      "roulette-brush.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor();

  await selectLine(page, 0);
  await page.locator('[data-testid="roulette-center"]').click({ force: true });

  const viewport = page.viewportSize()!;
  const farX = viewport.width - 40;
  const line2 = await page.locator(".cm-line").nth(2).boundingBox();
  const line4 = await page.locator(".cm-line").nth(4).boundingBox();
  if (!line2 || !line4) throw new Error("行不可测量");
  await page.mouse.click(farX, line2.y + line2.height / 2, { clickCount: 3 });
  await expect.poll(() => content(page)).toContain("**第二段**");
  await page.mouse.click(farX, line4.y + line4.height / 2, { clickCount: 3 });
  await expect(page.locator('[data-testid="roulette-center"]')).toHaveText("2");
});

test("点击根扇区不移动轮盘，指针滑入二层不消失", async ({ page }) => {
  await selectLine(page, 2);
  await page.waitForTimeout(200);
  const wheel = page.locator(WHEEL);
  const before = (await wheel.boundingBox())!;

  await openSector(page, "format");
  await page.waitForTimeout(250);
  const after = (await wheel.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);

  await page.locator('.sr-sec[data-band="2"]').first().hover();
  await page.waitForTimeout(700);
  await expect(wheel).toBeVisible();
  await expect(page.locator('.sr-sec[data-band="2"]')).toHaveCount(6);
});

test("MD 源码编辑态同样出轮盘，不出胶囊", async ({ page }) => {
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().setEditorMode("source");
  });
  await page.locator(".cm-content").waitFor();
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await expect(page.locator(WHEEL)).toBeVisible({ timeout: 3000 });
  await expect(page.locator("[data-selection-pill]")).toHaveCount(0);
  await expect(page.locator(".cm-floating-toolbar")).toHaveCount(0);
});
