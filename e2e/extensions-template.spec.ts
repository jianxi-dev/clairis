import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

interface Extensions {
  snippets: unknown[];
  templates: { name: string; body: string; path: string }[];
  theme: { tokens: Record<string, string>; warnings: string[] };
  warnings: string[];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
});

async function gotoWithExtensions(page: Page, extensions: Extensions | null) {
  if (extensions !== null) {
    await page.addInitScript((ext) => {
      (window as unknown as Record<string, unknown>).__biaoyue_extensions__ =
        ext;
    }, extensions);
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
}

function readActiveTab(
  page: Page,
): Promise<{ title: string; content: string }> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const tab = state.tabs[state.activeTabId];
    return { title: tab?.title ?? "", content: tab?.content ?? "" };
  });
}

test("点新建出现模板选择器，选择后写入替换正文且标题为模板名", async ({
  page,
}) => {
  await gotoWithExtensions(page, {
    snippets: [],
    templates: [
      {
        name: "日记",
        body: "# {{title}}\n\n日期：{{date}}\n\n未知：{{author}}\n",
        path: "/Users/test/.config/clairis/templates/日记.md",
      },
    ],
    theme: { tokens: {}, warnings: [] },
    warnings: [],
  });

  await page.locator("button").filter({ hasText: "新建" }).click();

  const picker = page.locator('[data-testid="template-picker"]');
  await expect(picker).toBeVisible();
  await expect(
    picker.locator('[data-testid="template-item"]').filter({ hasText: "日记" }),
  ).toBeVisible();
  await expect(picker.locator('[data-testid="template-blank"]')).toBeVisible();

  await picker
    .locator('[data-testid="template-item"]')
    .filter({ hasText: "日记" })
    .click();

  await expect(picker).toHaveCount(0);
  const tab = await readActiveTab(page);
  expect(tab.title).toBe("日记");
  expect(tab.content).toContain("# 日记");
  expect(tab.content).toMatch(/日期：\d{4}-\d{2}-\d{2}/);
  expect(tab.content).toContain("未知：{{author}}");
  expect(tab.content).not.toContain("{{title}}");
  expect(tab.content).not.toContain("{{date}}");
});

test("Esc 关闭选择器且不新建页签", async ({ page }) => {
  await gotoWithExtensions(page, {
    snippets: [],
    templates: [{ name: "日记", body: "正文\n", path: "/x/日记.md" }],
    theme: { tokens: {}, warnings: [] },
    warnings: [],
  });

  await page.locator("button").filter({ hasText: "新建" }).click();
  const picker = page.locator('[data-testid="template-picker"]');
  await expect(picker).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  const tab = await readActiveTab(page);
  expect(tab.title).toBe("");
});

test("选空白文档走默认新建", async ({ page }) => {
  await gotoWithExtensions(page, {
    snippets: [],
    templates: [{ name: "日记", body: "正文\n", path: "/x/日记.md" }],
    theme: { tokens: {}, warnings: [] },
    warnings: [],
  });

  await page.locator("button").filter({ hasText: "新建" }).click();
  const picker = page.locator('[data-testid="template-picker"]');
  await expect(picker).toBeVisible();

  await picker.locator('[data-testid="template-blank"]').click();
  await expect(picker).toHaveCount(0);
  const tab = await readActiveTab(page);
  expect(tab.title).toBe("未命名");
  expect(tab.content).toBe("");
});

test("无模板时不出现选择器，新建直接空白页", async ({ page }) => {
  await gotoWithExtensions(page, {
    snippets: [],
    templates: [],
    theme: { tokens: {}, warnings: [] },
    warnings: [],
  });

  await page.locator("button").filter({ hasText: "新建" }).click();
  await expect(page.locator('[data-testid="template-picker"]')).toHaveCount(0);
  const tab = await readActiveTab(page);
  expect(tab.title).toBe("未命名");
  expect(tab.content).toBe("");
});
