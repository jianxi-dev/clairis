import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/outline.md",
      "# 第一章\n\n正文\n\n## 小节\n\n更多正文\n",
      "outline",
    );
  });
  await page.waitForSelector('[data-testid="outline-btn"]', {
    timeout: 10000,
  });
}

test.describe("大纲浮层边框（ui-polish-batch6 11.1）", () => {
  test("未钉住无边框；钉住后 1px", async ({ page }) => {
    await boot(page);
    await page.getByTestId("outline-btn").hover();
    const panel = page.getByTestId("outline-menu");
    await expect(panel).toBeVisible();

    const unpinned = await panel.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth,
    );
    expect(unpinned).toBe("0px");

    await page.getByTestId("outline-btn").click();
    await expect(panel).toHaveAttribute("data-pinned", "true");
    const pinned = await panel.evaluate(
      (el) => window.getComputedStyle(el).borderTopWidth,
    );
    expect(pinned).toBe("1px");
  });
});

test("大纲按钮距内容区右缘约容器宽度的 2/3（#393）", async ({ page }) => {
  await boot(page);
  const gap = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="outline-btn"]')!;
    const wrap = btn.closest(".biaoyue-outline") as HTMLElement | null;
    const container = wrap?.offsetParent as HTMLElement | null;
    if (!btn || !wrap || !container) return null;
    const b = btn.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    return { gap: c.right - b.right, width: c.width };
  });
  if (!gap) throw new Error("无法测量大纲按钮");
  expect(Math.abs(gap.gap - gap.width / 3)).toBeLessThanOrEqual(4);
});
