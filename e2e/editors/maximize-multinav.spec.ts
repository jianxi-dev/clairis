import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1564（change=editor-surface-batch23/2.3）放大层多图切换。
 *
 * 1. 3 图文档双击第 1 张 → 点「下一张」切到第 2 张且索引「2/3」。
 * 2. 左方向键回第 1 张；第 1 张时「上一张」disabled。
 * 3. 切换后缩放重置为该图默认；已裁剪图呈现裁剪后画面。
 * 4. 单图文档不显示切换控件（向后兼容）。
 * 5. 切到无 crop 图时「重置图片」按钮隐藏。
 */

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);
const THREE_DOC = [
  `![甲](${IMG}){width=600}`,
  `![乙](${IMG}){width=500}`,
  `![丙](${IMG}){width=400}`,
].join("\n\n");
const SINGLE_DOC = `![独](${IMG}){width=600}\n`;

async function openThree(page: Page): Promise<void> {
  await openMarkdownInEdit(page, THREE_DOC, "max-multinav");
  await page.waitForFunction(() => {
    const imgs = [
      ...document.querySelectorAll(".cm-image-widget img"),
    ] as HTMLImageElement[];
    return (
      imgs.length === 3 && imgs.every((i) => i.complete && i.naturalWidth > 0)
    );
  });
}

async function openSingle(page: Page): Promise<void> {
  await openMarkdownInEdit(page, SINGLE_DOC, "max-multinav-single");
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
}

async function openMaximize(page: Page, index = 0): Promise<void> {
  await page.locator(".cm-image-widget img").nth(index).dblclick();
  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
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

test("3 图文档：下一张切到第 2 张且索引 2/3；左方向键回第 1 张；第 1 张时上一张禁用", async ({
  page,
}) => {
  await openThree(page);
  await openMaximize(page, 0);

  const index = page.getByTestId("img-max-index");
  await expect(index).toHaveText("1/3");
  await expect(page.getByTestId("img-max-prev")).toBeDisabled();
  await expect(page.getByTestId("img-max-next")).toBeEnabled();

  await page.getByTestId("img-max-next").click();
  await expect(index).toHaveText("2/3");
  await expect(page.getByTestId("img-max-prev")).toBeEnabled();
  await expect(page.getByTestId("img-max-next")).toBeEnabled();

  await page.keyboard.press("ArrowLeft");
  await expect(index).toHaveText("1/3");
  await expect(page.getByTestId("img-max-prev")).toBeDisabled();

  // 边界不越界：第 1 张继续按左方向键仍停在第 1 张。
  await page.keyboard.press("ArrowLeft");
  await expect(index).toHaveText("1/3");
});

test("切换后缩放重置为该图默认", async ({ page }) => {
  await openThree(page);
  await openMaximize(page, 0);

  await page.getByTestId("img-max-zoom-in").click();
  await expect.poll(async () => readScale(page)).toBeGreaterThan(1.09);

  await page.getByTestId("img-max-next").click();
  await expect(page.getByTestId("img-max-index")).toHaveText("2/3");
  await expect.poll(async () => readScale(page)).toBe(1);
  await expect(page.getByTestId("img-max-scale")).toHaveText("100%");
});

test("已裁剪图片呈现裁剪后画面；查看工具条无「重置图片」（切换不跑位）", async ({
  page,
}) => {
  const cropped = `![裁](${IMG}){crop=200,140,800,560 width=400 height=280}`;
  const plain = `![素](${IMG}){width=600}`;
  await openMarkdownInEdit(
    page,
    `${cropped}\n\n${plain}\n`,
    "max-multinav-crop",
  );
  await page.waitForFunction(() => {
    const imgs = [
      ...document.querySelectorAll(".cm-image-widget img"),
    ] as HTMLImageElement[];
    return (
      imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0)
    );
  });

  await openMaximize(page, 0);
  await expect(page.getByTestId("img-max-index")).toHaveText("1/2");
  // 查看工具条永不含重置图片（#1603 九轮）：裁剪图也一样
  await expect(page.getByTestId("img-max-clear-crop")).toHaveCount(0);

  await page.getByTestId("img-max-next").click();
  await expect(page.getByTestId("img-max-index")).toHaveText("2/2");
  await expect(page.getByTestId("img-max-next")).toBeDisabled();
  await expect(page.getByTestId("img-max-clear-crop")).toHaveCount(0);
});

test("单图文档：放大层不含切换控件（向后兼容）", async ({ page }) => {
  await openSingle(page);
  await openMaximize(page, 0);

  await expect(page.getByTestId("img-max-nav")).toHaveCount(0);
  await expect(page.getByTestId("img-max-prev")).toHaveCount(0);
  await expect(page.getByTestId("img-max-next")).toHaveCount(0);
  await expect(page.getByTestId("img-max-index")).toHaveCount(0);
});

test("退出后索引节点不残留", async ({ page }) => {
  await openThree(page);
  await openMaximize(page, 0);
  await expect(page.getByTestId("img-max-index")).toHaveCount(1);

  await page.getByTestId("img-max-close").click();
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
  await expect(page.getByTestId("img-max-index")).toHaveCount(0);
  await expect(page.getByTestId("img-max-nav")).toHaveCount(0);
});
