import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/fp/a.md", "# A\n\nA 内容", "a.md");
    w.__biaoyue_openFile__("/tmp/fp/b.md", "# B\n\nB 内容", "b.md");
  });
}

async function openPreview(page: Page, path: string, title: string) {
  await page.evaluate(
    ({ p, t }) => {
      (window as unknown as Record<string, any>).__biaoyue_store__
        .getState()
        .openPreview({
          path: p,
          title: t,
          x: p.includes("/a.md") ? 180 : 620,
          y: 140,
          w: 320,
          h: 260,
          flippedX: false,
          flippedY: false,
          source: "tab",
        });
    },
    { p: path, t: title },
  );
  await expect(
    page.locator(
      `[data-testid="floating-preview"][data-preview-path="${path}"]`,
    ),
  ).toBeVisible();
}

async function pin(page: Page, path: string) {
  await page
    .locator(
      `[data-testid="floating-preview"][data-preview-path="${path}"] [data-testid="preview-pin"]`,
    )
    .click();
  await expect(
    page.locator(
      `[data-testid="floating-preview"][data-preview-path="${path}"]`,
    ),
  ).toHaveAttribute("data-pinned", "true");
}

test("钉住后可继续打开多个悬浮窗，各自可关闭与取消钉住", async ({ page }) => {
  await boot(page);

  await openPreview(page, "/tmp/fp/a.md", "a.md");
  await pin(page, "/tmp/fp/a.md");
  await openPreview(page, "/tmp/fp/b.md", "b.md");
  await pin(page, "/tmp/fp/b.md");

  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(2);

  // 取消 A 的钉住：其余窗口保持钉住，数量不变
  await page
    .locator(
      '[data-testid="floating-preview"][data-preview-path="/tmp/fp/a.md"] [data-testid="preview-pin"]',
    )
    .click();
  await expect(
    page.locator(
      '[data-testid="floating-preview"][data-preview-path="/tmp/fp/a.md"]',
    ),
  ).toHaveAttribute("data-pinned", "false");
  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(2);
  await expect(
    page.locator(
      '[data-testid="floating-preview"][data-preview-path="/tmp/fp/b.md"]',
    ),
  ).toHaveAttribute("data-pinned", "true");

  // 关闭 A：只剩 B
  await page
    .locator(
      '[data-testid="floating-preview"][data-preview-path="/tmp/fp/a.md"] [data-testid="preview-close"]',
    )
    .click();
  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(1);
  await expect(
    page.locator('[data-testid="floating-preview"]'),
  ).toHaveAttribute("data-preview-path", "/tmp/fp/b.md");
});
