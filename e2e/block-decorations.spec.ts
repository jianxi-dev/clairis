import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

/** 打开一个 markdown 页签、切到编辑模式，光标停在文末正文（块非活跃）。 */
async function openInactive(page: Page, path: string, content: string) {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: path, c: content },
  );
  await page.locator("button").filter({ hasText: "编辑" }).first().click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  return editor;
}

test("分割线渲染为装饰块", async ({ page }) => {
  await openInactive(page, "/Users/test/bd-hr.md", "---\n\n正文");
  await expect(page.locator(".cm-thematic-break").first()).toBeVisible();
});

test("链接渲染为链接装饰且非活跃块隐藏源标记", async ({ page }) => {
  await openInactive(
    page,
    "/Users/test/bd-link.md",
    "[示例](https://example.com)\n\n正文",
  );
  const link = page.locator(".cm-link").first();
  await expect(link).toBeVisible();
  await expect(link).toHaveText("示例");
});

test("图片无解析器时退化为 alt 文本回退", async ({ page }) => {
  await openInactive(
    page,
    "/Users/test/bd-image.md",
    "![示意图](missing.png)\n\n正文",
  );
  await expect(page.locator(".cm-image-widget").first()).toBeVisible();
  await expect(page.locator(".cm-image-fallback").first()).toHaveText(
    "[图片: missing.png]",
  );
});

test("mermaid 块在非活跃时出图容器", async ({ page }) => {
  await openInactive(
    page,
    "/Users/test/bd-mermaid.md",
    "```mermaid\ngraph TD;\nA-->B;\n```\n\n正文",
  );
  await expect(page.locator(".cm-mermaid-block").first()).toBeVisible();
  await expect(page.locator(".cm-content")).not.toContainText("```mermaid");
});
