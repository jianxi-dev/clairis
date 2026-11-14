import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

type Page = Parameters<Parameters<typeof test>[1]>[0]["page"];

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
}

async function openMockFile(page: Page) {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/Users/test/测试文档.md",
      "---\ntitle: 元数据\n---\n# 测试文档\n\n## 第一节\n\n导出用的正文。",
      "测试文档.md",
    );
  });
  await expect(page.getByText("测试文档.md").first()).toBeVisible({
    timeout: 5000,
  });
}

test.describe("导出 Word", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
  });

  test("格头更多 → 导出 → Word… → save_binary_as_file 收到 DOCX", async ({
    page,
  }) => {
    await openMockFile(page);

    await page.locator('[role="tab"]').first().click({ button: "right" });
    await page.locator('[data-menu-item="export"]').click();
    await page.locator('[data-export-item="exportDocx"]').click();

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as Record<string, any>)
                .__biaoyue_saved_binaries__?.length ?? 0,
          ),
        { timeout: 20000 },
      )
      .toBe(1);

    const call = await page.evaluate(
      () =>
        (window as unknown as Record<string, any>)
          .__biaoyue_saved_binaries__[0],
    );

    expect(call.defaultName).toBe("测试文档.docx");

    const head = await page.evaluate((b64: string) => {
      const bin = atob(b64);
      return Array.from(bin.slice(0, 4), (c) => c.charCodeAt(0));
    }, call.base64 as string);
    expect(head).toEqual([0x50, 0x4b, 0x03, 0x04]);

    await expect(page.locator("[data-export-notice]")).toContainText("已导出", {
      timeout: 5000,
    });
  });
});
