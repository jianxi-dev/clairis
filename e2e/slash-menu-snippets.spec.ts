import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

// 片段正文：多行，用于断言插入逐字节相等、且一次撤销回到空文档。
const SNIPPET_BODY = "## 本周\n\n- 完成：\n";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  // 通过 mock 的注入点提供用户片段；必须在应用加载前设置（编辑器创建时读取）。
  await page.addInitScript(() => {
    (
      window as unknown as { __biaoyue_extensions__?: unknown }
    ).__biaoyue_extensions__ = {
      snippets: [
        {
          id: "weekly-review",
          label: "周报模板",
          keywords: ["weekly"],
          icon: "DocTextOutlined",
          body: "## 本周\n\n- 完成：\n",
          path: "/Users/test/.config/clairis/snippets/weekly.md",
        },
      ],
      templates: [],
      theme: { tokens: {}, warnings: [] },
      warnings: [],
    };
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

async function openMarkdownForEditing(page: Page, path: string) {
  await page.evaluate((p) => {
    (window as unknown as Record<string, unknown>).__biaoyue_openFile__(
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
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__;
    const state = (
      store as {
        getState(): {
          tabs: Record<string, { content: string }>;
          activeTabId: string;
        };
      }
    ).getState();
    const tab = state.tabs[state.activeTabId];
    return tab?.content ?? "";
  });
}

test("用户片段可被斜杠菜单搜到并单事务撤销", async ({ page }) => {
  await openMarkdownForEditing(page, "/Users/test/slash-snippet.md");

  // `/` 打开菜单后按别名 `weekly` 过滤，片段行出现。
  await page.keyboard.type("/weekly");
  const items = page.locator(".mdb-slash-grid-menu .mdb-slash-item");
  await expect(items.filter({ hasText: "周报模板" })).toHaveCount(1);

  // 回车应用：文档等于片段正文，菜单关闭。
  await page.keyboard.press("Enter");
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(0);
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toBe(SNIPPET_BODY);

  // 插入是单事务：一次撤销回到空文档。
  await page.keyboard.press("Meta+Z");
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("");
});
