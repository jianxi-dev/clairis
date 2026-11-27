import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { makePngDataUrl } from "../helpers/png";
import { revealStatusBar } from "../helpers/ui-probe";

/**
 * #1652 关爱界面缩放态：三类浮层 / 提示的锚点不再随倍率漂移。
 *
 * A-1 裁剪工具条按钮提示：提示中心 = 按钮中心（1.0 / 1.2 均 ≤1.5px）。
 * A-2 状态栏页面宽度浮窗：中心 = 宽度按钮中心（≤2px），间距 8±1px。
 * A-3 状态栏主题菜单：中心 = 主题按钮中心（≤2px）。
 * A-4 日期时间面板（已 portal 到 body）：左缘对齐输入槽左缘（≤1px），
 *    上缘 = 槽底 + 4（±1px）。
 *
 * 1.2 倍注入：等配置应用完成后再写 CSS 变量与 data 属性，模拟「运行中切到大档」。
 */

const ART = ".artifacts/1652";
const IMG = makePngDataUrl(800, 500, [51, 102, 153]);

const DOC = `---
title: 锚点
createdate: 2026-11-14
---

# 正文
`;

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

async function boxOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`找不到元素：${sel}`);
    const b = el.getBoundingClientRect();
    return {
      left: b.left,
      top: b.top,
      right: b.right,
      bottom: b.bottom,
      width: b.width,
      height: b.height,
    };
  }, selector);
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("http://localhost:1424", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openDoc(page: Page, content: string): Promise<void> {
  await page.evaluate((c) => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/anchor/doc.md", c, "doc.md");
    w.__biaoyue_store__.getState().setEditorMode("edit");
    w.__biaoyue_store__.getState().setScene("workspace");
  }, content);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

/** 状态栏（zoom 容器）的有效倍率：自身与祖先 zoom 的乘积。 */
async function barZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="status-bar"]');
    if (!el) return 1;
    let z = 1;
    let node: HTMLElement | null = el;
    while (node) {
      const v = getComputedStyle(node).zoom;
      if (v && v !== "normal") z *= parseFloat(v);
      node = node.parentElement;
    }
    return z;
  });
}

/** 运行中切档：写 CSS 变量与 data 属性，模拟 applyPaneScale（大档）。 */
async function applyScale(page: Page, factor: number): Promise<void> {
  await page.evaluate((f) => {
    const root = document.documentElement as HTMLElement;
    root.style.setProperty("--pane-scale-factor", String(f));
    if (f === 1) delete root.dataset.paneScaleActive;
    else root.dataset.paneScaleActive = "true";
  }, factor);
  await expect
    .poll(
      () =>
        page.evaluate(
          (want) =>
            ((document.documentElement as HTMLElement).dataset
              .paneScaleActive === "true") === want,
          factor !== 1,
        ),
      { timeout: 5000 },
    )
    .toBe(true);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

test("裁剪提示中心跟随按钮中心（1.0 与 1.2）", async ({ page }) => {
  await boot(page);
  await openDoc(page, `![甲](${IMG})\n`);
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await page.locator(".cm-image-widget").click();
  await expect(page.getByTestId("img-toolbar")).toBeVisible();

  for (const factor of [1, 1.2]) {
    await applyScale(page, factor);
    const btn = page.getByTestId("img-toolbar-crop");
    const tip = page.locator(".app-tip");
    await btn.hover();
    await expect(tip).toBeVisible({ timeout: 3000 });
    await expect
      .poll(
        async () => {
          const b = await boxOf(page, '[data-testid="img-toolbar-crop"]');
          const t = await boxOf(page, ".app-tip");
          return Math.abs(t.left + t.width / 2 - (b.left + b.width / 2));
        },
        { message: `提示中心与按钮中心差（scale ${factor}）` },
      )
      .toBeLessThanOrEqual(1.5);
    if (factor === 1.2) await shot(page, "01-tip-scale-1.2");
    await page.mouse.move(5, 5);
    await expect(tip).toHaveCount(0);
  }
});

test("页面宽度浮窗居中且间距 8px（1.0 与 1.2）", async ({ page }) => {
  await boot(page);
  await openDoc(page, "# 宽度\n\n正文。");

  for (const factor of [1, 1.2]) {
    await applyScale(page, factor);
    await revealStatusBar(page);
    await page.getByTestId("width-control").hover();
    const panel = page.getByTestId("width-panel");
    await expect(panel).toBeVisible();
    // scale 属性以 bottom center 为原点，故面板 rect 中心 = 未缩放中心；按钮 rect
    // 在 zoom 空间，需除回未缩放空间再比（#1652）。
    const zoom = await barZoom(page);
    const m = await page.evaluate((z) => {
      const b = document.querySelector('[data-testid="status-width"]')!;
      const p = document.querySelector('[data-testid="width-panel"]')!;
      const rb = b.getBoundingClientRect();
      const rp = p.getBoundingClientRect();
      return {
        btnCenter: (rb.left + rb.width / 2) / z,
        panelCenter: rp.left + rp.width / 2,
        btnTop: rb.top / z,
        panelBottom: rp.bottom,
      };
    }, zoom);
    expect(Math.abs(m.panelCenter - m.btnCenter)).toBeLessThanOrEqual(2);
    const gap = Math.abs(m.btnTop - m.panelBottom);
    expect(gap).toBeGreaterThanOrEqual(7);
    expect(gap).toBeLessThanOrEqual(9);
    if (factor === 1.2) await shot(page, "02-width-scale-1.2");
    await page.mouse.move(5, 5);
    await expect(panel).toHaveCount(0);
  }
});

test("主题菜单居中于主题按钮（1.0 与 1.2）", async ({ page }) => {
  await boot(page);
  await openDoc(page, "# 主题\n\n正文。");

  for (const factor of [1, 1.2]) {
    await applyScale(page, factor);
    await revealStatusBar(page);
    await page.getByTestId("theme-entry").hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });
    // 同上：按钮在 zoom 空间，菜单 rect 中心是未缩放中心。
    const zoom = await barZoom(page);
    const m = await page.evaluate((z) => {
      const b = document.querySelector('[data-testid="theme-entry"]')!;
      const p = document.querySelector('[data-testid="theme-menu"]')!;
      const rb = b.getBoundingClientRect();
      const rp = p.getBoundingClientRect();
      return {
        btnCenter: (rb.left + rb.width / 2) / z,
        menuCenter: rp.left + rp.width / 2,
        btnTop: rb.top / z,
        menuBottom: rp.bottom,
        vw: window.innerWidth,
        menuRight: rp.right,
      };
    }, zoom);
    // 主题按钮贴在状态栏右端，132 宽的菜单居中必然被右缘夹取；此时应贴右缘
    // 8px，否则与按钮中心对齐（误差 = 夹取量）。
    const centered = Math.abs(m.menuCenter - m.btnCenter);
    const rightGap = m.vw - m.menuRight;
    expect(centered <= 2 || (rightGap >= 7 && rightGap <= 9)).toBe(true);
    const gap = Math.abs(m.btnTop - m.menuBottom);
    expect(gap).toBeGreaterThanOrEqual(7);
    expect(gap).toBeLessThanOrEqual(9);
    if (factor === 1.2) await shot(page, "03-theme-scale-1.2");
    await page.mouse.move(5, 5);
    await expect(menu).toHaveCount(0);
  }
});

test("日期时间面板左缘对齐输入槽、上缘距槽底 4px（1.0 与 1.2）", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page, DOC);
  const row = page.locator('[data-key="createdate"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const editor = page.locator('[data-testid="dpb-datetime-editor"]');
  await expect(editor).toBeVisible();
  const panel = page.locator('[data-testid="dpb-datetime-panel"]');
  await expect(panel).toBeVisible();
  // 面板已 portal 到 body：不在编辑器 DOM 子树内。
  const nested = await page.evaluate(() => {
    const ed = document.querySelector('[data-testid="dpb-datetime-editor"]');
    const p = document.querySelector('[data-testid="dpb-datetime-panel"]');
    return Boolean(ed && p && ed.contains(p));
  });
  expect(nested).toBe(false);

  for (const factor of [1, 1.2]) {
    await applyScale(page, factor);
    const m = await page.evaluate(() => {
      const slot = document.querySelector(
        '[data-testid="dpb-datetime-editor"] .dpb-dt-input',
      )!;
      const p = document.querySelector('[data-testid="dpb-datetime-panel"]')!;
      const rs = slot.getBoundingClientRect();
      const rp = p.getBoundingClientRect();
      return {
        left: Math.abs(rp.left - rs.left),
        top: Math.abs(rp.top - (rs.bottom + 4)),
      };
    });
    expect(m.left).toBeLessThanOrEqual(1);
    expect(m.top).toBeLessThanOrEqual(1);
    if (factor === 1.2) await shot(page, "04-datetime-scale-1.2");
  }
});
