import type { Page } from "@playwright/test";

/**
 * 真实指针路径。
 *
 * `locator.hover()` 是「瞬移」：浏览器一步就把指针放到目标上，中间的
 * mouseleave / pointerleave 根本来不及派发。大纲浮层的 6px 空隙就是这样
 * 漏掉的——e2e 全绿，用户一摸就消失（#107）。
 *
 * 这里显式分步移动，并允许在指定点停顿，逼出真实的 enter/leave 序列。
 */
export async function moveThrough(
  page: Page,
  points: ReadonlyArray<{ x: number; y: number }>,
  options: { steps?: number; pauseMs?: number } = {},
): Promise<void> {
  const { steps = 6, pauseMs = 0 } = options;
  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps });
    if (pauseMs > 0) await page.waitForTimeout(pauseMs);
  }
}

/** 元素中心点；元素不存在时抛错（不要返回 0,0 让后续断言失真）。 */
export async function centerOf(
  page: Page,
  selector: string,
): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`找不到可测量的元素：${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export interface MeasuredBox {
  width: number;
  height: number;
  x: number;
  y: number;
}

/** 读元素几何（取整，避免子像素噪声）。 */
export async function boxOf(
  page: Page,
  selector: string,
): Promise<MeasuredBox> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      };
    });
}

/** 读计算样式（可见性/尺寸类断言必须看计算值，不能只看元素存在）。 */
export async function styleOf(
  page: Page,
  selector: string,
  property: string,
): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate(
      (el, prop) => getComputedStyle(el as Element).getPropertyValue(prop),
      property,
    );
}

/**
 * 打开一篇 markdown 并进入编辑态。
 *
 * 用 app 暴露的两个桥（`__biaoyue_openFile__` / `__biaoyue_store__`），
 * 不依赖真实文件系统。
 */
export async function openMarkdownInEdit(
  page: Page,
  body: string,
  name = "fixture",
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate(
    ({ body, name }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(`/tmp/${name}.md`, body, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { body, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}
