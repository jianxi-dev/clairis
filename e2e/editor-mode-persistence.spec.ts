import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = `# 标题一

正文**加粗**内容。

> [!NOTE] 提示标题
> 提示正文
`;

async function openForEditing(page: Page) {
  await page.evaluate(
    (args) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        args.path,
        args.content,
        "persist.md",
      );
    },
    { path: "/Users/test/persist.md", content: DOC },
  );
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  await expect(modeBtn).toHaveAttribute("data-mode", "edit");
  await page.locator(".cm-content").first().waitFor({ state: "visible" });
  await expect(page.locator(".cm-callout").first()).toBeVisible();
}

async function expectRichFirstPane(page: Page) {
  const pane = page.locator('[data-testid="pane-header"]').first();
  await expect(pane.locator('[data-testid="pane-mode"]')).toHaveAttribute(
    "data-mode",
    "edit",
  );
  const body = page.locator(".cm-content").first();
  expect(
    await body.locator(".cm-heading-marker").count(),
  ).toBeGreaterThanOrEqual(1);
  expect(await body.locator(".cm-callout").count()).toBeGreaterThanOrEqual(1);
  expect(await body.innerText()).not.toContain("**");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

test("分栏后原格编辑态仍为富文本", async ({ page }) => {
  await openForEditing(page);
  await expectRichFirstPane(page);

  await page.locator('[data-testid="pane-menu-button"]').first().hover();
  const menu = page.locator('[data-testid="pane-menu"]').first();
  await expect(menu).toBeVisible();
  await menu.locator('[data-menu-item="splitRight"]').click();

  await expect(page.locator('[data-testid="pane-header"]')).toHaveCount(2);
  await expectRichFirstPane(page);
});

test("整屏往返后编辑态仍为富文本", async ({ page }) => {
  await openForEditing(page);
  await page.locator('[data-testid="pane-fullscreen"]').first().click();
  await page.keyboard.press("Escape");
  await expectRichFirstPane(page);
});
