import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

const BLOCK_ACTIONS = ["ai-edit", "background", "border", "delete"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/block-toolbar.md",
      body,
      "block-toolbar.md",
    );
    store.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function clickBlock(page: Page, lineIndex: number): Promise<void> {
  await page.locator(".cm-line").nth(lineIndex).click();
  await expect(page.locator('[data-testid="block-toolbar"]')).toBeVisible({
    timeout: 3000,
  });
}

test("光标在块内出现块工具条，控件集合恰为 workbuddy 4 项", async ({
  page,
}) => {
  await clickBlock(page, 2);

  const toolbar = page.locator('[data-testid="block-toolbar"]');
  const actions = toolbar.locator("[data-action]");
  await expect(actions).toHaveCount(4);

  const names = await actions.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-action")),
  );
  expect(names).toEqual(BLOCK_ACTIONS);
});

test("块工具条每个控件都是图标按钮（SVG）", async ({ page }) => {
  await clickBlock(page, 2);

  const buttons = page.locator(
    '[data-testid="block-toolbar"] > [data-action] button.cm-toolbar-btn, [data-testid="block-toolbar"] > button.cm-toolbar-btn',
  );
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(buttons.nth(i).locator("svg")).toHaveCount(1);
  }
});

test("背景色把块内容包进 mdb-bg-*", async ({ page }) => {
  await clickBlock(page, 2);

  await page.locator('[data-action="background"]').hover();
  await page
    .locator(
      '[data-testid="color-swatch-background"][data-class-name="mdb-bg-blue"]',
    )
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe(
      '# 标题\n\n<span class="mdb-bg-blue">第一段正文</span>\n\n第二段正文\n',
    );
});

test("边框色把块内容包进 mdb-border-*", async ({ page }) => {
  await clickBlock(page, 2);

  await page.locator('[data-action="border"]').hover();
  await page
    .locator(
      '[data-testid="color-swatch-border"][data-class-name="mdb-border-red"]',
    )
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe(
      '# 标题\n\n<span class="mdb-border-red">第一段正文</span>\n\n第二段正文\n',
    );
});

test("删除移除整个块", async ({ page }) => {
  await clickBlock(page, 2);

  await page
    .locator('[data-testid="block-toolbar"] [data-action="delete"]')
    .click();

  await expect.poll(() => storeContent(page)).toBe("# 标题\n\n第二段正文\n");
});

test("AI 编辑打开 AI 浮层并预填整块文本", async ({ page }) => {
  await clickBlock(page, 2);

  await page
    .locator('[data-testid="block-toolbar"] [data-action="ai-edit"]')
    .click();

  await expect(page.locator("[data-ai-overlay]")).toBeVisible();
  const inputValue = await page.locator("[data-ai-input]").inputValue();
  expect(inputValue).toContain("第一段正文");
});

test("选中文字时块工具条隐藏，文字工具条出现", async ({ page }) => {
  const line = page.locator(".cm-line").nth(2);
  const box = (await line.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, y, { steps: 6 });
  await page.mouse.up();

  await expect(page.locator('[data-testid="floating-toolbar"]')).toBeVisible();
  await expect(page.locator('[data-testid="block-toolbar"]')).toBeHidden();
});
