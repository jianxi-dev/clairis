import { expect, type Locator, type Page } from "@playwright/test";

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

/** 探针点取 `.cm-content` 左缘的比例（D5 召唤区是左 25%，取 10% 落在区内）。 */
export const SUMMON_PROBE_RATIO = 0.1;

/**
 * 在行的左缘召唤区内移动指针（D5：块手柄只在 `.cm-content` 左缘 25% 召唤）。
 *
 * 行中心悬停召唤不出手柄——T4.1（#228）把召唤区收窄到左 25% 后，旧的行中心
 * 悬停用例全部超时。取 `.cm-content` 左侧 10% 处（落在 25% 内），并保证不
 * 超出行的左边界。只移动指针，不等手柄；调用方自己等 `.cm-block-handle-visible`。
 */
export async function hoverLineLeft(page: Page, line: Locator): Promise<void> {
  const box = await line.boundingBox();
  if (!box) throw new Error("找不到可测量的行");
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await moveThrough(
    page,
    [
      {
        x: Math.max(box.x, content.left + content.width * SUMMON_PROBE_RATIO),
        y: box.y + box.height / 2,
      },
    ],
    { steps: 4 },
  );
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

/**
 * 默认隐藏态下唤出状态栏：先落回隐藏态，再从底边热区临时显形；钉住态直接落点。
 */
export async function revealStatusBar(page: Page): Promise<void> {
  const bar = page.getByTestId("status-bar");
  // 先移出条体，等既有的瞬时显形规则收起，避免「半途卸载」与随后唤出交错。
  await page.mouse.move(10, 10);
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="status-bar"]');
      if (el && getComputedStyle(el).position !== "fixed") return true;
      return Boolean(document.querySelector('[data-testid="status-hotzone"]'));
    },
    null,
    { timeout: 5000 },
  );
  const pinned = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="status-bar"]');
    return Boolean(el) && getComputedStyle(el as Element).position !== "fixed";
  });
  if (!pinned) await page.getByTestId("status-hotzone").hover();
  await expect(bar).toBeVisible({ timeout: 3000 });
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 3,
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
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
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
