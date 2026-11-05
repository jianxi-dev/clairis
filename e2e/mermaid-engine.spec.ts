import { expect, test, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 图表换装",
  "",
  "```mermaid",
  "flowchart LR",
  "  开始 --> 结束",
  "```",
  "",
].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

async function openInPreview(page: Page) {
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/mermaid-engine.md",
      body,
      "mermaid-engine.md",
    );
    store.getState().setEditorMode("preview");
  }, DOC);
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

/**
 * 直接切根节点 class：主题在应用里就是 `html.dark` 的作用域（tokens/reader 都挂在它下面）。
 * 本用例断言的是"CSS 变量跟随、SVG 不被替换"，不是主题按钮的循环状态，
 * 因此不经过按钮，也不引入任何固定等待。
 */
async function enableDark(page: Page) {
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(page.locator("html")).toHaveClass(/dark/);
}

test("深色切换：图颜色跟随 CSS 变量，svg 元素不被替换", async ({ page }) => {
  await openInPreview(page);
  const view = page.locator(".preview-content .mermaid-view");
  await expect(view.locator("svg")).toBeVisible();

  // 在 svg 上打一个标记属性作为稳定身份：主题切换后标记还在，说明是同一个节点
  await view
    .locator("svg")
    .evaluate((el) => el.setAttribute("data-identity", "pele-svg"));
  const before = await view.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--pele-fg").trim(),
  );

  await enableDark(page);

  const svg = view.locator("svg[data-identity='pele-svg']");
  await expect(svg).toBeVisible(); // 同一个 <svg> 仍在（未被重插）
  await expect(view.locator("svg")).toHaveCount(1);

  const after = await view.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--pele-fg").trim(),
  );
  expect(before).not.toBe("");
  expect(after).not.toBe("");
  expect(after).not.toBe(before); // 颜色变了（CSS 变量随 .dark 翻转）
});

test("关闭「图表水合」移除图并显示源码，重新开启恢复且不重复挂载", async ({
  page,
}) => {
  await openInPreview(page);
  await expect(
    page.locator(".preview-content .mermaid-view svg"),
  ).toBeVisible();

  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
  await page.locator('[data-testid="capability-mermaid"]').uncheck();

  await expect(page.locator(".preview-content .mermaid-view")).toHaveCount(0);
  await expect(page.locator(".preview-content pre.mermaid")).toBeVisible();
  await expect(page.locator(".preview-content pre.mermaid")).toContainText(
    "开始",
  );

  await page.locator('[data-testid="capability-mermaid"]').check();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await expect(
    page.locator(".preview-content .mermaid-view svg"),
  ).toBeVisible();
  await expect(page.locator(".preview-content .mermaid-view")).toHaveCount(1);
});
