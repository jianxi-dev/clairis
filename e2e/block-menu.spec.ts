import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/block-menu.md",
      body,
      "block-menu.md",
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

async function hoverHandle(page: Page, lineIndex: number) {
  const line = page.locator(".cm-line").nth(lineIndex);
  await line.hover();
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

test("hover 块手柄弹出块菜单，十项转换 + 在下方添加", async ({ page }) => {
  await hoverHandle(page, 0);

  const items = page.locator('[data-testid="block-menu-item"]');
  await expect(items).toHaveCount(10);
  await expect(
    page.locator('[data-testid="block-menu-add-below"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="block-menu"]')).toContainText(
    "转为",
  );
});

test("点「一级标题」把段落转成标题，其余字节不变", async ({ page }) => {
  await hoverHandle(page, 2);

  await page
    .locator('[data-testid="block-menu-item"][data-target="h1"]')
    .click();

  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
  const content = await storeContent(page);
  expect(content).toContain("# 第一段正文");
  expect(content).toContain("# 标题");
  expect(content).toContain("第二段正文");
});

test("Esc 关闭块菜单", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.keyboard.press("Escape");

  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
});

test("滚动即收：编辑器滚动后块菜单关闭", async ({ page }) => {
  await hoverHandle(page, 2);

  await page.locator(".cm-scroller").evaluate((el) => {
    el.dispatchEvent(new Event("scroll"));
  });

  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
});
