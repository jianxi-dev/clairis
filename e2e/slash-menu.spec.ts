import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  // 浏览器层测试不接 Tauri：注入 IPC mock + store 桥，再用 __biaoyue_openFile__
  // 直接打开一个 markdown 页签。
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

/** 打开一个 markdown 页签并切到编辑模式，返回可输入的内容区。 */
async function openMarkdownForEditing(page: Page, path: string) {
  await page.evaluate((p) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      p,
      "",
      p.split("/").pop(),
    );
  }, path);
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
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

test("输入 / 打开斜杠菜单", async ({ page }) => {
  const content = await openMarkdownForEditing(
    page,
    "/Users/test/slash-open.md",
  );
  await page.keyboard.type("/");

  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1);
  await expect(menu.locator(".mdb-slash-item").first()).toBeVisible();
  await expect(content).toContainText("/");
});

test("输入过滤词把菜单收窄到标题行", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-filter.md");
  // 标题的拼音首字母是 b，所以按名称过滤用 `/b`；`/h1` 是子项键码，不是过滤词。
  await page.keyboard.type("/b");

  const items = page.locator(".mdb-slash-grid-menu .mdb-slash-item");
  await expect(items).toHaveCount(3);
  await expect(items.filter({ hasText: "标题" })).toHaveCount(1);

  await page.keyboard.type("t");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("标题");
});

test("回车应用命令并生成一级标题行", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-apply.md");
  await page.keyboard.type("/b");
  await expect(
    page.locator(".mdb-slash-grid-menu .mdb-slash-item"),
  ).toHaveCount(3);

  // 第一次 Enter 打开「标题」浮层；第二次 Enter 应用默认的 1 级标题。
  await page.keyboard.press("Enter");
  await expect(page.locator(".mdb-slash-flyout-item")).toHaveCount(6);
  await page.keyboard.press("Enter");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await page.keyboard.type("标题");

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toContain("# 标题");
});

test("Esc 关闭菜单且 DOM 无残留", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-escape.md");
  await page.keyboard.type("/");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(0);
  // 取消连同触发文本一起带走，不留孤立的 `/`。
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("");
});

test("输入 / 后退格关闭菜单且不留残留", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-backspace.md");
  await page.keyboard.type("/");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);

  await page.keyboard.press("Backspace");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect(page.locator(".mdb-slash-flyout")).toHaveCount(0);
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("");
});
