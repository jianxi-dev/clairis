import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

async function openPreview(page: Page, path: string, title: string) {
  await page.evaluate(
    ({ p, t }) => {
      (window as unknown as Record<string, any>).__biaoyue_store__
        .getState()
        .openPreview({
          path: p,
          title: t,
          x: 120,
          y: 120,
          w: 380,
          h: 300,
          flippedX: false,
          flippedY: false,
          source: "tab",
        });
    },
    { p: path, t: title },
  );
  const win = page.locator('[data-testid="floating-preview"]');
  await expect(win).toBeVisible();
  return win;
}

test("md 小窗在钉住右侧切换预览/编辑并保存", async ({ page }) => {
  const win = await openPreview(
    page,
    "/tmp/preview-edit.md",
    "preview-edit.md",
  );
  const pin = win.locator('[data-testid="preview-pin"]');
  const toggle = win.locator('[data-testid="preview-edit-toggle"]');
  await expect(toggle).toHaveCount(1);

  const order = await win
    .locator('[data-testid="preview-titlebar"] > *')
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid") ?? el.tagName),
    );
  const pinIndex = order.indexOf("preview-pin");
  const toggleIndex = order.indexOf("preview-edit-toggle");
  expect(pinIndex).toBeGreaterThanOrEqual(0);
  expect(toggleIndex).toBe(pinIndex + 1);

  await toggle.click();
  const editor = win.locator('[data-testid="preview-editor"]');
  await expect(editor).toBeVisible();
  await editor.fill("改过的内容");

  await page.keyboard.press("Meta+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as Record<string, any>).__saved_files__?.[
            "/tmp/preview-edit.md"
          ],
      ),
    )
    .toContain("改过的内容");

  await expect(win.locator('[data-testid="preview-save-state"]')).toHaveText(
    "已保存",
  );
  await toggle.click();
  await expect(editor).toHaveCount(0);
  await expect(win.locator('[data-testid="preview-doc"]')).toContainText(
    "改过的内容",
  );
});

test("html 与文本小窗同样提供编辑切换", async ({ page }) => {
  for (const [path, title] of [
    ["/tmp/preview-edit.html", "preview-edit.html"],
    ["/tmp/preview-edit.txt", "preview-edit.txt"],
  ]) {
    await page.evaluate(
      ({ p, t }) => {
        const store = (window as unknown as Record<string, any>)
          .__biaoyue_store__;
        store.getState().closeAllPreviews?.();
        store.getState().openPreview({
          path: p,
          title: t,
          x: 140,
          y: 140,
          w: 360,
          h: 280,
          flippedX: false,
          flippedY: false,
          source: "tab",
        });
      },
      { p: path, t: title },
    );
    const win = page.locator(
      `[data-testid="floating-preview"][data-preview-path="${path}"]`,
    );
    await expect(win).toBeVisible();
    await expect(
      win.locator('[data-testid="preview-edit-toggle"]'),
    ).toHaveCount(1);
    await win.locator('[data-testid="preview-edit-toggle"]').click();
    await expect(win.locator('[data-testid="preview-editor"]')).toBeVisible();
  }
});
