import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/cc/a.md", "# A\n\n正文。", "a.md");
    w.__biaoyue_openFile__("/tmp/cc/b.md", "# B\n\n正文。", "b.md");
    w.__biaoyue_store__.getState().setRailState("pinned");
  });
  await page.waitForTimeout(300);
}

const colorOf = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => getComputedStyle(el).color);

test("四处 chrome 静息色一致，AI 例外", async ({ page }) => {
  await boot(page);
  const home = await colorOf(page, '[data-testid="home-entry"]');
  const tab = await colorOf(page, '[role="tab"][aria-selected="false"]');
  const paneBtn = await colorOf(page, '[data-testid="pane-mode"]');
  const railBtn = await colorOf(page, '[data-testid="rail-card-action"]');

  expect(tab).toBe(home);
  expect(paneBtn).toBe(home);
  expect(railBtn).toBe(home);

  const aiFill = await page
    .locator('[data-testid="ai-entry"] svg')
    .first()
    .evaluate((el) => getComputedStyle(el).fill);
  expect(aiFill).not.toBe(home);
});

test("悬停变亮且与同类按钮一致，全屏不再变蓝", async ({ page }) => {
  await boot(page);
  const rest = await colorOf(page, '[data-testid="pane-mode"]');

  await page.getByTestId("pane-mode").hover();
  const modeHover = await colorOf(page, '[data-testid="pane-mode"]');
  expect(modeHover).not.toBe(rest);

  const fullscreen = page.locator('button[aria-label*="全屏"]').first();
  await fullscreen.hover();
  const fsHover = await fullscreen.evaluate((el) => getComputedStyle(el).color);
  expect(fsHover).toBe(modeHover);
});
