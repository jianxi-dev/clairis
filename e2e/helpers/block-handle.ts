import { expect, type Locator, type Page } from "@playwright/test";

/** `.cm-content` 左缘召唤区比例（D5：块手柄只在左 25% 召唤，取 10% 稳妥）。 */
const SUMMON_PROBE_RATIO = 0.1;

/**
 * 空行「+」手柄的两段式悬停：先按 D5 规则在 `.cm-content` 左缘召唤区停留，
 * 等父级 `.cm-block-handle` 显现（恢复 `pointer-events: auto`）后再hover。
 *
 * 未显现时父级是 `pointer-events: none`（editor.css 的
 * `.cm-block-handle:not(.cm-block-handle-visible)`），直接 `locator.hover()`
 * 会被 `.cm-content` 拦截并报 "intercepts pointer events"（#799 / #800）。
 * 可见性一律用类名断言等待，不用固定 sleep。
 */
export async function summonAddHandle(page: Page, add: Locator): Promise<void> {
  const box = await add.boundingBox();
  if (!box) throw new Error("找不到可测量的空行「+」手柄");
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });

  // 指针停在召唤区，触发 onDomPointerMove 的 arm()；300ms 后父级加 visible 类。
  await page.mouse.move(
    content.left + content.width * SUMMON_PROBE_RATIO,
    box.y + box.height / 2,
  );

  const handle = add.locator("xpath=..");
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  await add.hover();
}
