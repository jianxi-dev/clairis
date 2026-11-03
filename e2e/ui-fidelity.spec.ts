import { test, expect } from "@playwright/test";
import { ANCHOR_TOLERANCE_PX, EDITOR_ANCHORS } from "./fixtures/editor-anchors";
import {
  boxOf,
  centerOf,
  moveThrough,
  openMarkdownInEdit,
} from "./helpers/ui-probe";

/**
 * 保真回归层（#116）。
 *
 * 这一层只做一件事：把「用户在页面上看到的几何与图标」按锚点表钉住。
 * 断言数字全部来自 `e2e/fixtures/editor-anchors.ts`，本文件不写魔法数字。
 */

const DOC = ["# 标题一", "", "第一段正文", "", "第二段正文", ""].join("\n");

async function summonHandle(page: import("@playwright/test").Page) {
  await page.locator(".cm-line").nth(2).hover();
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  return handle;
}

test.describe("块手柄几何", () => {
  test.beforeEach(async ({ page }) => {
    await openMarkdownInEdit(page, DOC, "fidelity-handle");
  });

  test("药丸是 42×26（E-7）", async ({ page }) => {
    const handle = await summonHandle(page);
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(
      EDITOR_ANCHORS.handle.width - ANCHOR_TOLERANCE_PX,
    );
    expect(Math.round(box!.width)).toBeLessThanOrEqual(
      EDITOR_ANCHORS.handle.width + ANCHOR_TOLERANCE_PX,
    );
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(
      EDITOR_ANCHORS.handle.height - ANCHOR_TOLERANCE_PX,
    );
    expect(Math.round(box!.height)).toBeLessThanOrEqual(
      EDITOR_ANCHORS.handle.height + ANCHOR_TOLERANCE_PX,
    );
  });
});

test.describe("块菜单几何与图标", () => {
  test.beforeEach(async ({ page }) => {
    await openMarkdownInEdit(page, DOC, "fidelity-menu");
    const handle = await summonHandle(page);
    await handle.hover();
    await page.locator('[data-testid="block-menu"]').waitFor({ timeout: 3000 });
  });

  test("菜单宽 236、行高 32（E-7）", async ({ page }) => {
    const menu = await boxOf(page, '[data-testid="block-menu"]');
    expect(
      Math.abs(menu.width - EDITOR_ANCHORS.menu.width),
    ).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX);
    // 网格单元不是 32px 行；行高锚点只约束列表行（「在下方添加」等）。
    const rows = page.locator(".cm-block-menu-item");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const row = await rows.nth(i).boundingBox();
      expect(Math.round(row!.height)).toBe(EDITOR_ANCHORS.menu.rowHeight);
    }
  });

  test("「转为」是 5 列 × 2 行网格（豆包 §4.3）", async ({ page }) => {
    await expect(page.locator('[data-testid="block-menu-cell"]')).toHaveCount(
      EDITOR_ANCHORS.convertCells,
    );
    const columns = await page
      .locator('[data-testid="block-menu-grid"]')
      .evaluate(
        (el) =>
          getComputedStyle(el)
            .gridTemplateColumns.split(" ")
            .filter((part) => part.trim() !== "").length,
      );
    expect(columns).toBe(5);
  });

  test("每个「转为」单元都有图标", async ({ page }) => {
    const rows = page.locator('[data-testid="block-menu-cell"]');
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i).locator("svg")).toHaveCount(1);
    }
  });

  test("菜单图标渲染 18px（豆包 §2.2）", async ({ page }) => {
    const width = await page
      .locator('[data-testid="block-menu-cell"] svg')
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(width).toBeGreaterThanOrEqual(
      EDITOR_ANCHORS.menuIcon - ANCHOR_TOLERANCE_PX,
    );
  });

  test("「在下方添加」行也有图标与展开指示", async ({ page }) => {
    const row = page.locator('[data-testid="block-menu-add-below"]');
    await expect(row.locator("svg")).toHaveCount(1);
    await expect(row.locator(".cm-block-menu-chevron")).toHaveCount(1);
  });
});

test.describe("大纲浮层", () => {
  test.beforeEach(async ({ page }) => {
    await openMarkdownInEdit(
      page,
      "# 一\n\n## 二\n\n## 三\n",
      "fidelity-outline",
    );
  });

  test("悬停展开、点击钉住、Esc 收起", async ({ page }) => {
    const btn = page.locator('[data-testid="outline-btn"]');
    await btn.hover();
    await expect(page.locator('[data-testid="outline-menu"]')).toBeVisible();
    await btn.click();
    await moveThrough(page, [{ x: 600, y: 400 }]);
    await expect(page.locator('[data-testid="outline-menu"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="outline-menu"]')).toHaveCount(0);
  });

  // 已知缺口：按钮与面板之间的 6px 空隙会让浮层在指针到达前消失（#107）。
  test.fixme("指针穿过按钮与面板之间的空隙，浮层不消失（缺口 #107）", async ({
    page,
  }) => {
    await page.locator('[data-testid="outline-btn"]').hover();
    const panel = page.locator('[data-testid="outline-menu"]');
    await expect(panel).toBeVisible();
    const btnPoint = await centerOf(page, '[data-testid="outline-btn"]');
    const panelPoint = await centerOf(page, '[data-testid="outline-menu"]');
    await moveThrough(
      page,
      [btnPoint, { x: btnPoint.x, y: btnPoint.y + 30 }, panelPoint],
      {
        steps: 3,
        pauseMs: 120,
      },
    );
    await expect(panel).toBeVisible();
  });
});
