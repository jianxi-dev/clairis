import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1563（change=editor-surface-batch23/2.2）放大层 tooltip + ± 缩放 + 百分比。
 *
 * 1. 悬停按钮 → 自制气泡出现（不依赖原生 title），移开即消失；退出放大层无残留。
 * 2. 点「放大」→ scale 与百分比同步变化。
 * 3. 连点到上限 → 「放大」disabled。
 * 4. 点「缩小」到下限 → 「缩小」disabled。
 */

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);
const DOC = `![甲](${IMG}){width=600}\n`;

interface Transform {
  scale: number;
}

async function readScale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const img = document.querySelector(
      '[data-testid="img-maximize"] img',
    ) as HTMLImageElement | null;
    if (!img) return 0;
    const m = /scale\((-?[\d.eE+-]+)\)/.exec(img.style.transform);
    return m ? parseFloat(m[1]) : 0;
  });
}

async function openMaximize(page: Page): Promise<void> {
  await page.locator(".cm-image-widget img").dblclick();
  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "max-tooltip-zoom");
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openMaximize(page);
});

test("悬停按钮出现气泡提示，移开消失；退出后无残留", async ({ page }) => {
  const tip = page.getByTestId("img-max-tooltip");
  await expect(tip).toHaveCount(0);

  const rotate = page.getByTestId("img-max-rotate");
  await rotate.hover();
  await expect(tip).toHaveCount(1, { timeout: 2000 });
  await expect(tip).toHaveText("旋转 90°");

  // 气泡不依赖原生 title：全局 TooltipLayer 接管 title 后会摘除它。
  await expect(rotate).not.toHaveAttribute("title", /.+/);

  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0, { timeout: 2000 });

  await page.getByTestId("img-max-close").click();
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
  await expect(tip).toHaveCount(0);
});

test("点「放大」两次：scale 与百分比同步变化", async ({ page }) => {
  const label = page.getByTestId("img-max-scale");
  await expect(label).toHaveText("100%");

  await page.getByTestId("img-max-zoom-in").click();
  await expect
    .poll(async () => readScale(page))
    .toBeGreaterThan(1.09);
  await expect(label).not.toHaveText("100%");

  const first = await readScale(page);
  await page.getByTestId("img-max-zoom-in").click();
  await expect
    .poll(async () => readScale(page))
    .toBeGreaterThan(first);
});

test("连点到上限：「放大」disabled", async ({ page }) => {
  const zoomIn = page.getByTestId("img-max-zoom-in");
  await expect(zoomIn).toBeEnabled();

  // 1.1^n ≥ 8 → n ≥ 21；多点几次确保触顶。
  for (let i = 0; i < 30; i++) {
    if (await zoomIn.isDisabled()) break;
    await zoomIn.click();
  }
  await expect(zoomIn).toBeDisabled();
  await expect(page.getByTestId("img-max-scale")).toHaveText("800%");
});

test("点「缩小」到下限：「缩小」disabled", async ({ page }) => {
  const zoomOut = page.getByTestId("img-max-zoom-out");
  await expect(zoomOut).toBeEnabled();

  // 1.1^-n ≤ 0.5 → n ≥ 8；多点几次确保触底。
  for (let i = 0; i < 20; i++) {
    if (await zoomOut.isDisabled()) break;
    await zoomOut.click();
  }
  await expect(zoomOut).toBeDisabled();
  await expect(page.getByTestId("img-max-scale")).toHaveText("50%");
});
