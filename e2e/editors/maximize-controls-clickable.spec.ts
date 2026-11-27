import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1603 八轮真机：放大层「按钮条显隐已生效，但点所有按钮都没反应」。
 * 根因：热区与按钮条同 z-index 且热区后挂，整条按钮被热区盖住。
 * 本用例走真实点击（非 dispatchEvent）验证：热区存在时缩放按钮仍生效。
 */

const PNG = makePngDataUrl(64, 64, [90, 140, 200]);

async function openMaximize(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((src: string) => {
    const win = window as unknown as Record<string, any>;
    win.__convertedMediaPaths__ = [];
    win.__TAURI_INTERNALS__.convertFileSrc = (path: string) => {
      win.__convertedMediaPaths__.push(path);
      return src;
    };
  }, PNG);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((doc: string) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/maxclick/maxclick.md", doc, "maxclick.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, `![示例](${PNG})\n`);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator(".cm-image-widget").dblclick();
  await expect(page.locator('[data-testid="img-maximize"]')).toBeVisible({
    timeout: 5000,
  });
}

function scaleOf(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      '[data-testid="img-max-scale"]',
    );
    return Number((el?.textContent ?? "100%").replace("%", ""));
  });
}

test("热区存在时点缩放按钮仍生效（按钮不被热区盖住）", async ({ page }) => {
  await openMaximize(page);
  // dock 在场
  await expect(page.locator(".img-max-dock")).toHaveCount(1);
  const btn = page.locator('[data-testid="img-max-zoom-in"]');
  await expect(btn).toBeVisible();
  const before = await scaleOf(page);
  await btn.click();
  await expect
    .poll(() => scaleOf(page), { timeout: 3000 })
    .toBeGreaterThan(before);
  // 点关闭能真正关掉（同一层叠结论）
  await page.locator('[data-testid="img-max-close"]').click();
  await expect(page.locator('[data-testid="img-maximize"]')).toHaveCount(0);
});
