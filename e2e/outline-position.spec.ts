import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #261：大纲按钮 right 由 46px 改为 23px（原空隙为已移除的 Aa 阅读设置钮预留）。
 * 预览态与编辑态计算值一致。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/261");

mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openMarkdown(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_openFile__: (p: string, c: string, t: string) => void;
      }
    ).__biaoyue_openFile__(
      "/tmp/outline/doc.md",
      "# 标题一\n\n## 标题二\n\n正文段落。\n\n### 子节\n\n更多正文。",
      "doc",
    );
  });
  await expect(page.locator(".biaoyue-outline")).toBeVisible({
    timeout: 10000,
  });
}

test("大纲按钮 right 计算值恒为 4px（预览态与编辑态）", async ({ page }) => {
  await boot(page);
  await openMarkdown(page);

  const readRight = () =>
    page
      .locator(".biaoyue-outline")
      .evaluate((el) => getComputedStyle(el).right);

  expect(await readRight()).toBe("4px");
  await page.screenshot({ path: path.join(ART, "outline-preview.png") });

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await expect(
    page.locator('[data-testid="pane-mode"]').first(),
  ).toHaveAttribute("data-mode", "edit");
  await expect(page.locator(".biaoyue-outline")).toBeVisible();
  expect(await readRight()).toBe("4px");
  await page.screenshot({ path: path.join(ART, "outline-edit.png") });
});
