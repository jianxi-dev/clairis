import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

test("Cmd+K 打开浮层并聚焦输入，Esc 关闭且无残留", async ({ page }) => {
  await page.keyboard.press("Meta+k");
  await expect(page.locator("[data-ai-overlay]")).toBeVisible();
  await expect(page.locator("[data-ai-input]")).toBeFocused();

  await page.keyboard.type("随便打点什么");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ai-overlay]")).toHaveCount(0);

  await page.keyboard.press("Meta+k");
  await expect(page.locator("[data-ai-overlay]")).toBeVisible();
  await expect(page.locator("[data-ai-input]")).toHaveValue("");
});

test("点浮层外部关闭", async ({ page }) => {
  await page.keyboard.press("Meta+k");
  await expect(page.locator("[data-ai-overlay]")).toBeVisible();

  await page.mouse.click(20, 200);
  await expect(page.locator("[data-ai-overlay]")).toHaveCount(0);
});

test("空态包含提示与至少两个示例指令", async ({ page }) => {
  await page.keyboard.press("Meta+k");
  const overlay = page.locator("[data-ai-overlay]");
  await expect(overlay).toBeVisible();
  const buttons = overlay.locator("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(2);
  await expect(overlay.getByText("换成深色主题")).toBeVisible();

  // 点击示例只填入输入框，不提交
  await overlay.getByText("换成深色主题").click();
  await expect(page.locator("[data-ai-input]")).toHaveValue("换成深色主题");
  await expect(overlay.getByText("已切换到深色主题。")).toHaveCount(0);
});

test("一句话改主题后撤销，主题回原值", async ({ page }) => {
  await page.keyboard.press("Meta+k");
  const overlay = page.locator("[data-ai-overlay]");
  await page.locator("[data-ai-input]").fill("换成深色主题");
  await page.keyboard.press("Enter");
  // session-silent（默认）首次同类需确认
  await page.locator("[data-ai-confirm-ok]").click();

  await expect(overlay.getByText("已切换到深色主题。")).toBeVisible({
    timeout: 5000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark")),
    )
    .toBe(true);

  const undoBar = page.locator("[data-undo-bar]");
  await expect(undoBar).toBeVisible();
  await expect(undoBar).toHaveClass(/opacity-100/);

  // 淡出后 hover 底部重现区应重新显示
  await page.waitForTimeout(3300);
  await expect(undoBar).toHaveClass(/opacity-0/);
  await page.mouse.move(600, 790);
  await expect(undoBar).toHaveClass(/opacity-100/);

  await page.locator("[data-undo-button]").click();

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark")),
    )
    .toBe(false);
  await expect(overlay.getByText("已恢复到改动前。")).toBeVisible();
});

test("撤销条旁的历史打开快照面板，可一键恢复", async ({ page }) => {
  await page.keyboard.press("Meta+k");
  await page.locator("[data-ai-input]").fill("字号调到 18");
  await page.keyboard.press("Enter");
  await page.locator("[data-ai-confirm-ok]").click();
  await expect(
    page.locator("[data-ai-overlay]").getByText("已把字号调到 18。"),
  ).toBeVisible({ timeout: 5000 });

  // 淡出后需先 hover 重现区，否则按钮不可点
  await page.mouse.move(600, 790);
  await expect(page.locator("[data-undo-bar]")).toHaveClass(/opacity-100/);
  await page.locator("[data-undo-history-button]").click();
  const panel = page.locator("[data-snapshot-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("今天", { exact: false }).first()).toBeVisible();

  await panel.getByRole("button", { name: "恢复" }).first().click();
  await expect(
    page.locator("[data-ai-overlay]").getByText("已恢复到选中的历史状态。"),
  ).toBeVisible({ timeout: 5000 });
});
