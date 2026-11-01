import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

type Page = Parameters<Parameters<typeof test>[1]>[0]["page"];

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
}

async function openMockFile(page: Page) {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/Users/test/测试文档.md",
      "# 测试文档\n\n## 第一节\n\n导出用的正文。",
      "测试文档.md",
    );
  });
  await expect(page.getByText("测试文档.md").first()).toBeVisible({
    timeout: 5000,
  });
}

test.describe("导出 HTML", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
  });

  test("右键页签 → 导出 HTML… → save_as_file 收到离线单文件", async ({
    page,
  }) => {
    await openMockFile(page);

    await page.locator("[data-tab-id]").first().click({ button: "right" });
    const menu = page.locator("[data-tab-menu]");
    await expect(menu).toBeVisible({ timeout: 3000 });

    const exportItem = page.getByRole("button", { name: "导出 HTML…" });
    await expect(exportItem).toBeVisible();

    await exportItem.click();

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as Record<string, any>).__biaoyue_saved_files__
                ?.length ?? 0,
          ),
        { timeout: 5000 },
      )
      .toBe(1);

    const content = await page.evaluate(
      () =>
        (window as unknown as Record<string, any>).__biaoyue_saved_files__[0]
          .content as string,
    );

    expect(content.startsWith("<!doctype html>")).toBe(true);
    expect(content).toContain("<title>测试文档.md</title>");
    expect(content).toContain("导出用的正文。");
    expect(content).toContain("<style>");
    expect(content).not.toMatch(/<script[^>]+src=/i);
    expect(content).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
  });
});
