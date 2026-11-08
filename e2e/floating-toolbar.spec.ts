import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

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
  await expect(page.locator('[data-testid="selection-roulette"]')).toBeVisible({
    timeout: 3000,
  });
}

test("选中文字出现轮盘：8 扇区 + 圆心，旧横条不残留", async ({ page }) => {
  await selectLine(page, 2);
  const wheel = page.locator('[data-testid="selection-roulette"]');
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

test("格式扇形就近展开：6 项、跨度不超过 136°", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-sector="format"]').hover();
  const items = page.locator(".sr-item");
  await expect(items).toHaveCount(6);

  const wheel = await page
    .locator('[data-testid="selection-roulette"]')
    .boundingBox();
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
});

test("加粗与斜体连击都写入源码且轮盘保持展开", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-sector="format"]').hover();
  await expect(page.locator(".sr-item")).toHaveCount(6);
  await page
    .locator('.sr-item[data-action="format-bold"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toMatch(/\*\*第一段正文\s*\*\*/);
  await page
    .locator('.sr-item[data-action="format-italic"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toMatch(/(^|[^*])\*第一段正文\s*\*/);
  await expect(page.locator('[data-testid="selection-roulette"]')).toHaveCount(
    1,
  );
});

test("颜色扇区为双圈：文字色 9 格、背景色 16 格", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-sector="color"]').hover();
  await expect(page.locator(".sr-color-font")).toHaveCount(9);
  await expect(page.locator(".sr-color-bg")).toHaveCount(16);
});

test("转换三层：标题 › 原位替换并可返回；选二级标题写源码", async ({
  page,
}) => {
  await selectLine(page, 2);
  await page.locator('[data-sector="convert"]').hover();
  const group = page.locator('.sr-item[data-action="convert-heading-group"]');
  await expect(group).toHaveCount(1);
  await group.click({ force: true });
  await expect(page.locator('.sr-item[data-action="convert-h2"]')).toHaveCount(
    1,
  );
  await page
    .locator('.sr-item[data-action="convert-h2"]')
    .click({ force: true });
  await expect.poll(() => content(page)).toMatch(/## 第一段正文/);
});

test("分栏 3 写入 ::: {.col-3}", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-sector="columns"]').hover();
  await page
    .locator('.sr-item[data-action="columns-3"]')
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
  await page.locator('[data-sector="clear"]').click({ force: true });
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
  await selectLine(page, 2);
  await expect.poll(() => content(page)).toContain("**第二段**");
  await selectLine(page, 4);
  await expect(page.locator('[data-testid="roulette-center"]')).toHaveText("2");
});
