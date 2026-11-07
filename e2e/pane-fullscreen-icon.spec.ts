import { test, expect, type Page } from "@playwright/test";

async function openDoc(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/ic/a.md", "# 标题\n正文", "a.md");
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
}

test("单格渲染可用的全屏按钮（G-7）", async ({ page }) => {
  await openDoc(page);
  const btn = page.locator('[data-testid="pane-fullscreen"]').first();
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await expect(btn.locator("svg")).toHaveAttribute("data-icon", "expand");

  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await expect(btn.locator("svg")).toHaveAttribute("data-icon", "collapse");

  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await expect(btn.locator("svg")).toHaveAttribute("data-icon", "expand");
});

test("全屏按钮随状态切换 expand ↔ collapse", async ({ page }) => {
  await openDoc(page);
  await page.keyboard.press("ControlOrMeta+Alt+ArrowRight");
  const btn = page.locator('[data-testid="pane-fullscreen"]').first();
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await expect(btn).toHaveAttribute("aria-label", "全屏当前格");
  await expect(btn.locator("svg")).toHaveAttribute("data-icon", "expand");

  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await expect(btn).toHaveAttribute("aria-label", "退出全屏");
  await expect(btn.locator("svg")).toHaveAttribute("data-icon", "collapse");

  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await expect(btn.locator("svg")).toHaveAttribute("data-icon", "expand");
});
