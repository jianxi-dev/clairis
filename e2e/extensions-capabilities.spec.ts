import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 能力开关",
  "",
  "$$",
  "a^2 + b^2",
  "$$",
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

async function openInPreview(page: Page) {
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/capabilities.md",
      body,
      "capabilities.md",
    );
    store.getState().setEditorMode("preview");
  }, DOC);
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

async function openSettings(page: Page) {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
}

test("Cmd+, 打开设置，能力默认全开", async ({ page }) => {
  await openInPreview(page);
  await openSettings(page);

  for (const id of ["math", "code-highlight", "mermaid", "preview-zoom"]) {
    await expect(
      page.locator(`[data-testid="capability-${id}"]`),
    ).toBeChecked();
  }
});

test("关闭数学公式后预览显示原文，重新开启恢复", async ({ page }) => {
  await openInPreview(page);
  await expect(page.locator(".preview-content .katex").first()).toBeVisible();

  await openSettings(page);
  await page.locator('[data-testid="capability-math"]').uncheck();

  await expect(page.locator(".preview-content .katex")).toHaveCount(0);
  await expect(page.locator(".preview-content")).toContainText("a^2 + b^2");

  await page.locator('[data-testid="capability-math"]').check();
  await expect(page.locator(".preview-content .katex").first()).toBeVisible();
});

test("关闭代码高亮后代码块回退为纯文本，源码不丢", async ({ page }) => {
  await openInPreview(page);
  await expect(
    page.locator(".preview-content .tok-keyword").first(),
  ).toBeVisible();

  await openSettings(page);
  await page.locator('[data-testid="capability-code-highlight"]').uncheck();

  await expect(page.locator(".preview-content .tok-keyword")).toHaveCount(0);
  await expect(page.locator(".preview-content")).toContainText("const a = 1;");
});

test("Esc 关闭设置，能力状态保持", async ({ page }) => {
  await openInPreview(page);
  await openSettings(page);
  await page.locator('[data-testid="capability-math"]').uncheck();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
  await expect(page.locator(".preview-content .katex")).toHaveCount(0);
});
