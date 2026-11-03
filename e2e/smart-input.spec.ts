import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

async function openMarkdownForEditing(page: Page, path: string) {
  await page.evaluate((p) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      p,
      "",
      p.split("/").pop(),
    );
  }, path);
  await page.locator("button").filter({ hasText: "编辑" }).first().click();
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

test("列表项回车自动续写", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/si-list.md");
  await page.keyboard.type("- 第一项");
  await page.keyboard.press("Enter");
  await page.keyboard.type("第二项");

  const text = await storeContent(page);
  expect(text).toBe("- 第一项\n- 第二项");
});

test("有序列表回车自动递增", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/si-ol.md");
  await page.keyboard.type("1. 第一项");
  await page.keyboard.press("Enter");
  await page.keyboard.type("第二项");

  const text = await storeContent(page);
  expect(text).toBe("1. 第一项\n2. 第二项");
});

test("空列表项回车退出列表", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/si-exit.md");
  await page.keyboard.type("- 项");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  const text = await storeContent(page);
  expect(text).toBe("- 项\n");
});

test("全角逗号与斜杠换成半角", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/si-punct.md");
  await page.keyboard.type("你好，世界／测试");
  const text = await storeContent(page);
  expect(text).toBe("你好,世界/测试");
});

test("围栏代码块内保留全角", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/si-punct-code.md");
  await page.keyboard.type("```");
  await page.keyboard.press("Enter");
  await page.keyboard.type("，");
  const text = await storeContent(page);
  expect(text).toContain("，");
});
