import { test, expect, type Page } from "@playwright/test";

const DOC = [
  "<!DOCTYPE html><html><body>",
  "<h1>标题</h1>",
  "<p>段落正文</p>",
  "</body></html>",
].join("\n");

async function openSource(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/hr/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("source");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

test("HTML 源码编辑态选区显示同一轮盘，不显示视觉编辑横条", async ({
  page,
}) => {
  await openSource(page);
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });

  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  await expect(wheel.locator(".sr-sector")).toHaveCount(8);
  await expect(page.locator(".html-edit-toolbar")).toHaveCount(0);
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(0);
});

test("HTML 源码编辑态轮盘加粗写入 content", async ({ page }) => {
  await openSource(page);
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  await page.locator('[data-sector="format"]').hover();
  await expect(page.locator(".sr-item")).toHaveCount(6);
  await page
    .locator('.sr-item[data-action="format-bold"]')
    .click({ force: true });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = (window as any).__biaoyue_store__.getState();
        return (s.tabs[s.activeTabId]?.content ?? "") as string;
      }),
    )
    .toMatch(/\*\*<h1>标题<\/h1>/);
});
