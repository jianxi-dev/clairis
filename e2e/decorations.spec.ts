import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
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

test("光标在标题块内显示结构标记，离开后恢复隐藏", async ({ page }) => {
  const content = await openMarkdownForEditing(
    page,
    "/Users/test/deco-heading.md",
  );

  // 输入 `## 标题`：智能输入把 `## ` 转成标题行，光标停在标题文字后。
  await page.keyboard.type("## 标题");
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toBe("## 标题");

  // 光标在块内：标记以低透明度显示（cm-heading-marker-active）。
  const marker = page.locator(".cm-heading-marker");
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveClass(/cm-heading-marker-active/);
  await expect(marker).toHaveCSS("opacity", "0.4");

  // 再起一个段落，把光标移到段落里：标题块变成非活跃，标记透明度归 0。
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("段落");
  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toBe("## 标题\n\n段落");

  await expect(marker).toHaveCount(1);
  await expect(marker).not.toHaveClass(/cm-heading-marker-active/);
  await expect(marker).toHaveCSS("opacity", "0");

  // 标题文字仍然按级别渲染（显示 = 源码，标记只是隐藏不是删除）。
  await expect(content.locator(".cm-heading.cm-h2")).toHaveText("标题");
});

test("空标题不抛错且能继续输入", async ({ page }) => {
  const content = await openMarkdownForEditing(
    page,
    "/Users/test/deco-empty-heading.md",
  );

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // `# ` 后还没有正文：正文范围宽度为 0，装饰构建不得抛错。
  await page.keyboard.type("# ");
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("# ");
  await expect(page.locator(".cm-heading-marker")).toHaveCount(1);

  // 继续输入标题文字。
  await page.keyboard.type("标题");
  await expect.poll(() => storeContent(page), { timeout: 5000 }).toBe("# 标题");
  await expect(content.locator(".cm-heading.cm-h1")).toHaveText("标题");

  expect(errors).toEqual([]);
});
