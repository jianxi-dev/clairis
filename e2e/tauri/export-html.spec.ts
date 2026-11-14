import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/244");

mkdirSync(ART, { recursive: true });

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

  test("格头更多 → 导出 → HTML… → save_as_file 收到离线单文件", async ({
    page,
  }) => {
    await openMockFile(page);

    await page.locator('[role="tab"]').first().click({ button: "right" });
    await page.locator('[data-menu-item="export"]').click();
    await page.locator('[data-export-item="exportHtml"]').click();

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

    const saved = await page.evaluate(
      () =>
        (window as unknown as Record<string, any>)
          .__biaoyue_saved_files__[0] as {
          content: string;
          defaultName: string;
        },
    );

    expect(saved.defaultName).toBe("测试文档.html");
    const content = saved.content;

    expect(content.startsWith("<!doctype html>")).toBe(true);
    expect(content).toContain("<title>测试文档.md</title>");
    expect(content).toContain("导出用的正文。");
    expect(content).toContain("<style>");
    expect(content).not.toMatch(/<script[^>]+src=/i);
    expect(content).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);

    await page.screenshot({ path: path.join(ART, "html-saved.png") });
  });
});
