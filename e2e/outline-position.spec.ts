import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #261：大纲按钮 right 由 46px 改为 23px（原空隙为已移除的 Aa 阅读设置钮预留）。
 * 预览态与编辑态计算值一致。
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/261");
const ART925 = path.resolve(process.cwd(), ".artifacts/925");

mkdirSync(ART, { recursive: true });
mkdirSync(ART925, { recursive: true });

/**
 * #925：大纲按钮下移约两个条目高度。
 *
 * 红态（改动前）实测：`.biaoyue-outline` computed top = 10px。
 * 绿态要求 top ≥ 10 + 48 = 58px，且 ≠ 10px（确实下移，不是原地）。
 */
const OUTLINE_OLD_TOP_PX = 10;
const OUTLINE_MIN_SHIFT_PX = 48;

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

test("大纲按钮 top 相对现状下移 ≥48px（#925）", async ({ page }) => {
  await boot(page);
  await openMarkdown(page);
  await page.locator('[data-testid="outline-btn"]').hover();

  const readTop = () =>
    page.locator(".biaoyue-outline").evaluate((el) => getComputedStyle(el).top);

  const top = await readTop();
  const itemHeight = await page
    .locator('[data-testid="outline-item-0"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  console.log(
    `[925] outline top=${top} itemHeight=${itemHeight} 两个条目高度=${itemHeight * 2}`,
  );

  expect(parseFloat(top, 10)).toBeGreaterThanOrEqual(
    OUTLINE_OLD_TOP_PX + OUTLINE_MIN_SHIFT_PX,
  );
  expect(top).not.toBe(`${OUTLINE_OLD_TOP_PX}px`);
  await page.screenshot({ path: path.join(ART925, "outline-top-green.png") });
});
