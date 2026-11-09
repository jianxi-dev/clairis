import { test, expect, type Page } from "@playwright/test";

const DOC = [
  "<!DOCTYPE html><html><body>",
  "<h1>标题</h1>",
  "<p>段落正文</p>",
  "</body></html>",
].join("\n");

const BAR = ".cm-floating-toolbar";
const WHEEL = '[data-testid="selection-roulette"]';

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

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (window as any).__biaoyue_store__.getState();
    return (s.tabs[s.activeTabId]?.content ?? "") as string;
  });
}

test("HTML 源码编辑态选区显示横向条，不显示轮盘", async ({ page }) => {
  await openSource(page);
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });

  const bar = page.locator(BAR);
  await expect(bar).toBeVisible({ timeout: 3000 });
  await expect(bar.locator('button[aria-label="粗体"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="斜体"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="下划线"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="删除线"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="行内代码"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="链接"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="左对齐"]')).toBeVisible();
  await expect(bar.locator('select[aria-label="文字颜色"]')).toBeVisible();
  await expect(page.locator(WHEEL)).toHaveCount(0);
});

test("横条不遮挡选区且贴近选区", async ({ page }) => {
  await openSource(page);
  const line = await page.locator(".cm-line").nth(1).boundingBox();
  if (!line) throw new Error("行不可测量");
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  const bar = await page.locator(BAR).boundingBox();
  if (!bar) throw new Error("工具条不可测量");
  const gap = line.y - (bar.y + bar.height);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(40);
});

test("HTML 源码编辑态横条加粗写入 content", async ({ page }) => {
  await openSource(page);
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  await page.locator(`${BAR} button[aria-label="粗体"]`).click();
  await expect.poll(() => content(page)).toContain("**<h1>标题</h1>**");
  await page.locator(`${BAR} button[aria-label="粗体"]`).click();
  await expect.poll(() => content(page)).not.toContain("**<h1>标题</h1>**");
});

test("HTML 源码编辑态不出现可视化编辑横条", async ({ page }) => {
  await openSource(page);
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await expect(page.locator(".cm-floating-toolbar")).toHaveCount(1);
  await expect(page.locator(".html-edit-toolbar")).toHaveCount(0);
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(0);
});
