import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 打开一个 markdown 页签、切到编辑模式，光标停在文末正文（块非活跃）。 */
async function openDoc(page: Page, path: string, content: string) {
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
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  return editor;
}

test("高亮块渲染出图标、标题与内容", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-render.md",
    "> [!NOTE] 重要提醒\n> 记得带伞\n\n正文",
  );

  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await expect(card.locator(".cm-callout-icon")).toHaveText("📝");
  await expect(card.locator(".cm-callout-title")).toHaveText("重要提醒");
  await expect(card.locator(".cm-callout-content")).toContainText("记得带伞");
});

test("非活跃高亮块不显示 > [!note] 源标记", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-inactive.md",
    "> [!NOTE] 标题\n> 内容\n\n正文",
  );

  const content = page.locator(".cm-content");
  await expect(content).not.toContainText("> [!NOTE]");
  await expect(content).not.toContainText("[!NOTE]");
  // 卡片内容仍在，只是源码标记被 widget 取代。
  await expect(content).toContainText("标题");
  await expect(content).toContainText("内容");
});

test("点击标题出现行内编辑", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-title.md",
    "> [!NOTE] 旧标题\n> 内容\n\n正文",
  );

  const title = page.locator(".cm-callout-title").first();
  await expect(title).toBeVisible();
  await title.click();

  const input = page.locator('[data-testid="cm-callout-title-editor"]');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("旧标题");
});

test("分栏渲染为多列", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/col-render.md",
    "::: {.col-2}\n左栏内容\n\n右栏内容\n:::\n\n正文",
  );

  const columns = page.locator('[data-testid="cm-columns"]').first();
  await expect(columns).toBeVisible();
  await expect(columns.locator(".cm-column")).toHaveCount(2);
  await expect(columns.locator(".cm-column").first()).toContainText("左栏内容");
  await expect(columns.locator(".cm-column").nth(1)).toContainText("右栏内容");
});
