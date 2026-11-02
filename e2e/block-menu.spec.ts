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
  // 红线 1：只有目标块的首行前缀变化，其余字节逐字不变
  expect(content).toBe("# 标题\n\n# 第一段正文\n\n第二段正文\n");
});

test("红线 5：转换后可见文本等于源码文本（去掉标记）", async ({ page }) => {
  await hoverHandle(page, 2);
  await page
    .locator('[data-testid="block-menu-item"][data-target="h1"]')
    .click();

  // 源码：首行带标记
  const source = await storeContent(page);
  const sourceLine = source
    .split("\n")
    .find((line) => line.includes("第一段正文"));
  expect(sourceLine).toBe("# 第一段正文");

  // 预览：同样的文字，不带标记
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  const heading = page
    .locator(".preview-content h1")
    .filter({ hasText: "第一段正文" });
  await expect(heading).toHaveCount(1);
  expect((await heading.textContent())?.trim()).toBe("第一段正文");
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
