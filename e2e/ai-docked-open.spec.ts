import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function dockAndFocusAi(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            dockAiPane: () => string;
            focusPane: (id: string) => void;
          };
        };
      }
    ).__biaoyue_store__.getState();
    const id = store.dockAiPane();
    store.focusPane(id);
  });
  await expect(page.locator('[data-pane-kind="ai"]')).toBeVisible();
}

function hasTab(page: Page, path: string): Promise<boolean> {
  return page.evaluate((p) => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { tabs: Record<string, { path: string | null }> };
        };
      }
    ).__biaoyue_store__.getState();
    return Object.values(s.tabs).some((t) => t.path === p);
  }, path);
}

async function aiTabCount(page: Page): Promise<number> {
  return page.locator('[data-pane-kind="ai"] [data-tab-id]').count();
}

test("AI 停靠且聚焦时，Ctrl+O 打开文件落到普通栏", async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    window.__biaoyue_openFile__("/tmp/ado/start.md", "# start", "start"),
  );
  await dockAndFocusAi(page);
  expect(await aiTabCount(page)).toBe(0);

  await page.keyboard.press("Control+o");

  await expect.poll(() => hasTab(page, "/Users/test/测试文档.md")).toBe(true);
  await expect(page.locator('[role="tab"]').first()).toBeVisible();
  expect(await aiTabCount(page)).toBe(0);
  await expect(page.locator(".preview-content")).toContainText("测试内容");
});

test("AI 停靠且聚焦时，卡片路径打开文件落到普通栏", async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    window.__biaoyue_openFile__("/tmp/ado/start.md", "# start", "start"),
  );
  await dockAndFocusAi(page);

  await page.evaluate(() =>
    window.__biaoyue_openFile__(
      "/tmp/ado/card.md",
      "# 卡片文档\n\n双击卡片应打开这段内容。",
      "card",
    ),
  );

  await expect.poll(() => hasTab(page, "/tmp/ado/card.md")).toBe(true);
  await expect(page.locator(".preview-content")).toContainText(
    "双击卡片应打开这段内容",
  );
  expect(await aiTabCount(page)).toBe(0);
});
