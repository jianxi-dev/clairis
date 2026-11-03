import { test, expect } from "@playwright/test";
import { openMarkdownInEdit } from "./helpers/ui-probe";

/**
 * 浮层定位（E-14）：最短路径是默认，但优先级是「可见 > 同类一致 > 最近」。
 *
 * 所以这里量两件事：
 * 1. 矩形最近距离（不是中心点距离——中心点会随菜单高度变化，逼着菜单做小）
 * 2. 同类浮层连续两次召唤时相对偏移完全一致（整齐比近几像素重要）
 */

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 两个矩形之间的最近距离（px）；相交时为 0。 */
function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
  return Math.round(Math.hypot(dx, dy));
}

const MAX_GAP_PX = 8;

test.describe("浮层定位：距离（E-14 优先级 3）", () => {
  test("块手柄 → 块菜单 ≤ 8px", async ({ page }) => {
    await openMarkdownInEdit(
      page,
      "# 标题\n\n第一段正文\n\n第二段\n",
      "sp-block",
    );
    await page.locator(".cm-line").nth(2).hover();
    const handle = page.locator(
      '[data-testid="block-handle"].cm-block-handle-visible',
    );
    await handle.waitFor({ timeout: 5000 });
    await handle.hover();
    await page.locator('[data-testid="block-menu"]').waitFor({ timeout: 5000 });

    const rects = await page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      return {
        handle: box(
          document.querySelector(
            '[data-testid="block-handle"].cm-block-handle-visible',
          ),
        ),
        menu: box(document.querySelector('[data-testid="block-menu"]')),
      };
    });
    expect(rects.handle).not.toBeNull();
    expect(rects.menu).not.toBeNull();
    expect(gap(rects.handle!, rects.menu!)).toBeLessThanOrEqual(MAX_GAP_PX);
  });

  test("「在下方添加」→ 二级面板 ≤ 8px", async ({ page }) => {
    await openMarkdownInEdit(
      page,
      "# 标题\n\n第一段正文\n\n第二段\n",
      "sp-flyout",
    );
    await page.locator(".cm-line").nth(2).hover();
    const handle = page.locator(
      '[data-testid="block-handle"].cm-block-handle-visible',
    );
    await handle.waitFor({ timeout: 5000 });
    await handle.hover();
    await page.locator('[data-testid="block-menu-add-below"]').waitFor({
      timeout: 5000,
    });
    await page.locator('[data-testid="block-menu-add-below"]').hover();
    await page.locator(".mdb-slash-menu").first().waitFor({ timeout: 5000 });

    const rects = await page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      const menus = Array.from(document.querySelectorAll(".mdb-slash-menu"));
      return {
        row: box(
          document.querySelector('[data-testid="block-menu-add-below"]'),
        ),
        flyout: box(menus[menus.length - 1] ?? null),
      };
    });
    expect(rects.row).not.toBeNull();
    expect(rects.flyout).not.toBeNull();
    expect(gap(rects.row!, rects.flyout!)).toBeLessThanOrEqual(MAX_GAP_PX);
  });

  test("大纲按钮 → 浮层 ≤ 8px", async ({ page }) => {
    await openMarkdownInEdit(page, "# 一\n\n## 二\n\n## 三\n", "sp-outline");
    await page.locator('[data-testid="outline-btn"]').hover();
    await page
      .locator('[data-testid="outline-menu"]')
      .waitFor({ timeout: 5000 });

    const rects = await page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      return {
        btn: box('[data-testid="outline-btn"]'),
        panel: box('[data-testid="outline-menu"]'),
      };
    });
    expect(rects.btn).not.toBeNull();
    expect(rects.panel).not.toBeNull();
    expect(gap(rects.btn!, rects.panel!)).toBeLessThanOrEqual(MAX_GAP_PX);
  });
});

test.describe("同类浮层位置一致（E-14 优先级 2）", () => {
  test("同一手柄连续召唤两次，菜单相对偏移完全相同", async ({ page }) => {
    await openMarkdownInEdit(
      page,
      "# 标题\n\n第一段正文\n\n第二段\n",
      "sp-stable",
    );

    const summonAndMeasure = async () => {
      await page.locator(".cm-line").nth(2).hover();
      const handle = page.locator(
        '[data-testid="block-handle"].cm-block-handle-visible',
      );
      await handle.waitFor({ timeout: 5000 });
      await handle.hover();
      await page.locator('[data-testid="block-menu"]').waitFor({
        timeout: 5000,
      });
      const rects = await page.evaluate(() => {
        const box = (sel: string) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: Math.round(b.left), y: Math.round(b.top) };
        };
        return {
          handle: box('[data-testid="block-handle"].cm-block-handle-visible'),
          menu: box('[data-testid="block-menu"]'),
        };
      });
      await page.keyboard.press("Escape");
      await page.mouse.move(900, 600);
      await page.waitForTimeout(250);
      return rects;
    };

    const first = await summonAndMeasure();
    const second = await summonAndMeasure();

    expect(first.menu).not.toBeNull();
    expect(second.menu).not.toBeNull();
    expect(second.menu!.x - second.handle!.x).toBe(
      first.menu!.x - first.handle!.x,
    );
    expect(second.menu!.y - second.handle!.y).toBe(
      first.menu!.y - first.handle!.y,
    );
  });
});
