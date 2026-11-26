import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1562（change=editor-surface-batch23/2.1）图片选中工具条滚动期隐藏（方案A）。
 *
 * 1. 滚动期隐藏：选中图片后连续滚轮，滚动期间工具条 is-scrolling 单一状态
 *    （翻转 ≤1），不闪跳。
 * 2. 停滚复位：停滚后 ≤300ms 工具条可见，且与图片的相对位置和选中时一致。
 * 3. 滚出视口：图片完全离开视口后工具条消失且选中态清除（IntersectionObserver）。
 *
 * 全程零固定 sleep：滚动用 mouse.wheel，等待用 expect.poll / waitForFunction。
 * 滚动期用例用超大图（高 2400 >> 视口）+ 小步长滚动，保证滚动期间图片不出
 * 视口，从而隔离「滚动期隐藏」路径（否则会先触发「滚出视口」路径）。
 */

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);

interface BridgeState {
  setEditorMode: (mode: string) => void;
  tabs: Record<string, { content: string }>;
  activeTabId: string;
}

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => BridgeState };
}

/** 超大图（高 6000 >> 视口与 2 秒滚动量）：滚动期图片保持在视口内。 */
const TALL_DOC = [
  `![甲](${IMG}){width=600 height=300}`,
  "",
  ...Array.from({ length: 12 }, (_, i) => `第 ${i} 段正文`).join("\n\n"),
  "",
].join("\n");

/** 多图 + 长文：滚出视口用例用。 */
const LONG_DOC = [
  `![甲](${IMG}){width=300}`,
  "",
  ...Array.from({ length: 40 }, (_, i) => `第 ${i} 段正文`).join("\n\n"),
  "",
].join("\n");

async function openDoc(page: Page, doc: string, name: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ body, name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(
        `/tmp/toolbar-scroll/${name}.md`,
        body,
        `${name}.md`,
      );
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { body: doc, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const imgs = [
      ...document.querySelectorAll(".cm-image-widget img"),
    ] as HTMLImageElement[];
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  });
}

async function toolbarDisplay(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="img-toolbar"]');
    if (!el) return "absent";
    return el.classList.contains("is-scrolling")
      ? "none"
      : getComputedStyle(el).display;
  });
}

/** 工具条底边中点相对图片顶边的偏移（选中时基准，停滚后应一致）。 */
async function toolbarOffset(page: Page): Promise<{ dx: number; dy: number }> {
  return page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>(
      '[data-testid="img-toolbar"]',
    );
    const widget = document.querySelector<HTMLElement>(
      ".cm-image-widget[data-selected='true']",
    );
    if (!toolbar || !widget) throw new Error("缺工具条或选中图片");
    const t = toolbar.getBoundingClientRect();
    const w = widget.getBoundingClientRect();
    return {
      dx: t.left + t.width / 2 - (w.left + w.width / 2),
      dy: t.bottom - w.top,
    };
  });
}

async function selectFirstImage(page: Page): Promise<void> {
  const widget = page.locator(".cm-image-widget").first();
  await widget.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await widget.click();
  await expect(page.getByTestId("img-toolbar")).toBeVisible({ timeout: 5000 });
}

/** 页面内记录 is-scrolling 翻转次数（采样在浏览器内，避免测试端往返干扰滚动）。 */
async function armFlipCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const toolbar = document.querySelector('[data-testid="img-toolbar"]');
    if (!toolbar) throw new Error("缺工具条");
    const win = window as unknown as { __flips: number; __last: boolean };
    win.__flips = 0;
    win.__last = toolbar.classList.contains("is-scrolling");
    new MutationObserver(() => {
      const now = toolbar.classList.contains("is-scrolling");
      if (now !== win.__last) {
        win.__flips += 1;
        win.__last = now;
      }
    }).observe(toolbar, { attributes: true, attributeFilter: ["class"] });
  });
}

async function readFlips(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __flips: number }).__flips,
  );
}

test("滚动期工具条保持隐藏且状态翻转 ≤1 次，停滚后复位到选中时位置", async ({
  page,
}) => {
  await openDoc(page, TALL_DOC, "tall");
  await selectFirstImage(page);

  const base = await toolbarOffset(page);
  expect(await toolbarDisplay(page)).not.toBe("none");
  await armFlipCounter(page);

  // 连续滚动 2 秒：小步长，滚动期间图片保持在视口内（不触发滚出视口路径）。
  const started = Date.now();
  while (Date.now() - started < 2000) {
    await page.mouse.wheel(0, 0.25);
  }

  expect(await readFlips(page)).toBeLessThanOrEqual(1);

  // 停滚 ≤300ms 复位：可见，且工具条底边中点仍贴在图片上方（水平居中、
  // 垂直方向底边在图片顶边上方 margin 处，与选中时的锚定关系一致）。
  await expect
    .poll(() => toolbarDisplay(page), { timeout: 300 })
    .not.toBe("none");
  const after = await toolbarOffset(page);
  expect(Math.abs(after.dx - base.dx)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.dy - base.dy)).toBeLessThanOrEqual(1);
});

test("图片滚出视口后工具条消失且选中态清除", async ({ page }) => {
  await openDoc(page, LONG_DOC, "long");
  await selectFirstImage(page);

  // 滚轮把图片滚出视口：IntersectionObserver 在 ratio 穿越 0 时稳定回调。
  await page.mouse.move(600, 400);
  for (let i = 0; i < 30; i += 1) {
    await page.mouse.wheel(0, 200);
  }

  await expect
    .poll(() => page.getByTestId("img-toolbar").count(), { timeout: 10000 })
    .toBe(0);
  await expect(
    page.locator(".cm-image-widget[data-selected='true']"),
  ).toHaveCount(0);
});
