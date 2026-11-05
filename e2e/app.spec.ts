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

    await page.waitForSelector("header", { timeout: 10000 });
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

  test("2. 顶栏无旧控件，AI 入口唯一", async ({ page }) => {
    const banner = page.getByRole("banner");
    for (const name of ["打开", "保存", "新建", "侧栏", "翻译"]) {
      await expect(
        banner.getByRole("button", { name, exact: true }),
      ).toHaveCount(0);
    }
    await expect(page.locator("[data-ai-entry]")).toHaveCount(1);
  });

  test("3. toolbar header visible", async ({ page }) => {
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("4. dark mode changes editor bg", async ({ page }) => {
    const btn = page.getByTitle(/当前:/);
    for (let i = 0; i < 5; i++) {
      const title = await btn.getAttribute("title");
      if (title?.includes("暗色")) break;
      await btn.click();
      await page.waitForTimeout(100);
    }
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
    await page.waitForSelector("header", { timeout: 10000 });
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
