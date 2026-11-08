import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";

test.describe("Biaoyue E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    // 应用启动在门户首屏（layout-portal 2.1）；本套用例测的是工作区外壳
    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_store__?.getState?.().setScene("workspace");
    });

    await page.waitForSelector('[data-testid="pane-header"]', {
      timeout: 10000,
    });
  });

  test("页面标题显示新品牌名", async ({ page }) => {
    await expect(page).toHaveTitle("标月 Biaoyue");
  });

  test("1. 工作区外壳：阅读栏边缘 + 分栏头，无旧左侧栏", async ({ page }) => {
    await expect(page.locator('[data-testid="rail-edge"]')).toBeVisible();
    await expect(page.locator('[data-testid="pane-header"]')).toBeVisible();
    for (const name of ["文件", "最近", "目录"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        0,
      );
    }
  });

  test("2. 顶栏已移除；四个产品入口唯一且只在状态栏", async ({ page }) => {
    await expect(page.getByRole("banner")).toHaveCount(0);

    const bar = page.getByTestId("status-bar");
    await expect(bar.locator("[data-ai-entry]")).toHaveCount(1);
    await expect(bar.locator('[data-testid="grid-entry"]')).toHaveCount(1);
    await expect(bar.locator('[data-testid="immersive-entry"]')).toHaveCount(1);
    for (const sel of [
      "[data-ai-entry]",
      '[data-testid="grid-entry"]',
      '[data-testid="immersive-entry"]',
      '[title^="当前:"]',
    ]) {
      await expect(page.locator(sel)).toHaveCount(1);
    }
  });

  test("3. 顶部没有品牌横条", async ({ page }) => {
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByText("标月", { exact: true })).toHaveCount(0);
  });

  test("4. dark mode changes editor bg", async ({ page }) => {
    // 主题按钮自 #389 起是「悬停开菜单再选」，不再点击循环。
    await page.getByTestId("theme-entry").hover();
    await page.getByTestId("theme-option-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const bg = await page
      .locator(".cm-editor")
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const b = (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3;
      expect(b).toBeLessThan(128);
    }
  });

  test("5. Cmd+Shift+H / Cmd+Alt+Down add panes, Cmd+Shift+S collapses", async ({
    page,
  }) => {
    // Open two tabs via the exposed store bridge (web mode has no real fs)
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, any>)
        .__biaoyue_store__;
      store.getState().openFile("/virtual/a.md", "# A\n\ntab a content");
      store.getState().openFile("/virtual/b.md", "# B\n\ntab b content");
    });
    await page.waitForTimeout(300);

    // pane 递归树（layout-portal 3.1）：每格一个 CM 容器
    await expect(page.locator(".cm-editor-container")).toHaveCount(1);

    // Cmd+Shift+H: split the focused pane to the right
    await page.keyboard.press(`${MOD}+Shift+H`);
    await expect(page.locator(".cm-editor-container")).toHaveCount(2);

    // Cmd+Alt+Down: split the focused (new) pane downward.
    // （layout-portal 8.1 起 ⌘⇧V 让位给悬浮预览开关，向下分屏改用 ⌘⌥↓）
    await page.keyboard.press(`${MOD}+Alt+ArrowDown`);
    await expect(page.locator(".cm-editor-container")).toHaveCount(3);

    // Cmd+Shift+S: collapse the tree back to a single pane
    await page.keyboard.press(`${MOD}+Shift+S`);
    await expect(page.locator(".cm-editor-container")).toHaveCount(1);
  });

  test("6. tab right-click shows context menu with split options", async ({
    page,
  }) => {
    // Open a tab first (need content for tab to exist)
    // In web mode, there are no tabs initially. Skip if no tabs.
    const tabs = page.locator(".tab-bar > div");
    const tabCount = await tabs.count();
    if (tabCount === 0) {
      test.skip(true, "No tabs in web mode");
      return;
    }
    // Right-click the first tab
    await tabs.first().click({ button: "right" });
    await page.waitForTimeout(200);
    // Context menu should appear
    const menu = page.locator(".fixed.z-50");
    await expect(menu).toBeVisible();
    // Should have split options
    await expect(page.getByText("向右分栏")).toBeVisible();
    await expect(page.getByText("向下分栏")).toBeVisible();
  });

  test("7. no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    await page.waitForSelector('[data-testid="pane-header"]', {
      timeout: 10000,
    });
    const critical = errors.filter(
      (e) =>
        !e.includes("Failed to load config") &&
        !e.includes("invoke") &&
        !e.includes("504") &&
        !e.includes("Outdated Optimize Dep"),
    );
    expect(critical).toHaveLength(0);
  });
});
