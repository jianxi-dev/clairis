import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * 基件 B（Menu + useAnchoredPosition + useLayerDismiss + PortalScope）真实浏览器验收（#1709 / 2.2）。
 *
 * 断言矩形是否越界（含 8px 留白）、side 朝向、栈语义与 hover token，
 * 不只断言 DOM 存在——B1 教训：元素存在等于没测。
 */

const ARTIFACTS = ".artifacts/1709";
const MARGIN = 8;
const TOL = 0.5;

test.beforeAll(() => {
  mkdirSync(ARTIFACTS, { recursive: true });
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/?showcase", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-showcase="menu-open"]', { timeout: 30000 });
}

interface MenuBox {
  x: number;
  y: number;
  right: number;
  bottom: number;
  side: string;
}

async function menuBox(locator: ReturnType<Page["locator"]>): Promise<MenuBox> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left,
      y: r.top,
      right: r.right,
      bottom: r.bottom,
      side: el.getAttribute("data-side") ?? "",
    };
  });
}

function resolveVar(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${n})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

test("打开菜单后可见 3 项，disabled 项不可聚焦", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-open"]').click();
  const menu = page.locator('[data-testid="showcase-menu"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[role="menuitem"]')).toHaveCount(3);
  const disabled = menu.locator('[role="menuitem"][disabled]');
  await expect(disabled).toHaveCount(1);
  await disabled.focus({ timeout: 1000 }).catch(() => {});
  const focusedDisabled = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.hasAttribute("disabled") ?? false;
  });
  expect(focusedDisabled).toBe(false);
});

test("四角各自翻到对侧，且四边都留 ≥8px 在视口内", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-corner-toggle"]').click();
  const expectSide: Record<string, string> = {
    "menu-corner-tl": "below-start",
    "menu-corner-tr": "below-end",
    "menu-corner-bl": "above-start",
    "menu-corner-br": "above-end",
  };
  const viewport = page.viewportSize() ?? { width: 1200, height: 800 };
  for (const [corner, side] of Object.entries(expectSide)) {
    await page.locator(`[data-showcase="${corner}"]`).click();
    const menu = page.locator('[data-testid="showcase-menu"]').first();
    await expect(menu).toBeVisible();
    const box = await menuBox(menu);
    expect(box.side, `${corner} side`).toBe(side);
    expect(box.x, `${corner} 左缘 ≥ ${MARGIN}`).toBeGreaterThanOrEqual(MARGIN - TOL);
    expect(box.y, `${corner} 上缘 ≥ ${MARGIN}`).toBeGreaterThanOrEqual(MARGIN - TOL);
    expect(box.right, `${corner} 右缘 ≤ ${viewport.width - MARGIN}`).toBeLessThanOrEqual(
      viewport.width - MARGIN + TOL,
    );
    expect(box.bottom, `${corner} 下缘 ≤ ${viewport.height - MARGIN}`).toBeLessThanOrEqual(
      viewport.height - MARGIN + TOL,
    );
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="showcase-menu"]')).toHaveCount(0);
  }
});

test("层栈：无 pointerdown 开第二层，Esc 只关栈顶", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-open"]').click();
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();
  // 用 DOM click 开第二层，绕开 pointerdown（否则会先关掉 A）
  await page.evaluate(() => {
    (document.querySelector('[data-showcase="menu-open-b"]') as HTMLElement).click();
  });
  await expect(page.locator('[data-testid="showcase-menu-b"]')).toBeVisible();
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();
  expect(await page.locator(".bp-menu").count()).toBe(2);

  await page.screenshot({ path: `${ARTIFACTS}/03-menu-two-layers.png`, fullPage: true });

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="showcase-menu-b"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="showcase-menu"]')).toHaveCount(0);
  expect(await page.locator(".bp-menu").count()).toBe(0);
});

test("点外部关闭后不残留任何菜单节点（portal 宿主是共享空壳）", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-open"]').click();
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();
  expect(await page.locator("[data-portal-root]").count()).toBeGreaterThan(0);

  await page.mouse.click(5, 5);
  await expect(page.locator('[data-testid="showcase-menu"]')).toHaveCount(0);
  expect(await page.locator(".bp-menu").count()).toBe(0);
  // 宿主按设计延迟回收（StrictMode 双挂载下同步删除会让浮层渲进游离 DOM，见
  // PortalScope 注释），故此处断言的是「不留内容」而不是「宿主不存在」：
  // 空壳可以被下一个浮层复用，残留的菜单节点才是真回归。
  const portalChildren = await page
    .locator("[data-portal-root]")
    .evaluateAll((els) => els.reduce((n, el) => n + el.childElementCount, 0));
  expect(portalChildren).toBe(0);
});

test("窄容器：菜单右缘不溢出容器（#1017 回归）", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-narrow-anchor"]').click();
  const menu = page.locator('[data-testid="showcase-menu-narrow"]');
  await expect(menu).toBeVisible();
  const box = await menuBox(menu);
  const container = await page
    .locator("[data-showcase-narrow-container]")
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right };
    });
  const viewport = page.viewportSize() ?? { width: 1200, height: 800 };
  expect(box.right).toBeLessThanOrEqual(container.right - MARGIN + TOL);
  expect(box.x).toBeGreaterThanOrEqual(container.left - TOL);
  expect(box.right).toBeLessThanOrEqual(viewport.width - MARGIN + TOL);
});

test("hover 项：底色 = --app-accent-soft，文字 = --app-accent", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-open"]').click();
  const item = page.locator('[data-testid="showcase-menu"] [role="menuitem"]').first();
  await item.hover();
  const accentSoft = await resolveVar(page, "--app-accent-soft");
  const accent = await resolveVar(page, "--app-accent");
  await expect(item).toHaveCSS("background-color", accentSoft);
  await expect(item).toHaveCSS("color", accent);
});

test("截图：菜单展开（全页）", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-open"]').click();
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/01-menu-open.png`, fullPage: true });
});

test("截图：四角翻转（左上 / 右下）", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-corner-toggle"]').click();
  await page.locator('[data-showcase="menu-corner-tl"]').click();
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/02-menu-flipped-tl.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await page.locator('[data-showcase="menu-corner-br"]').click();
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/02-menu-flipped-br.png`, fullPage: true });
});

test("截图：窄容器", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-narrow-anchor"]').click();
  await expect(page.locator('[data-testid="showcase-menu-narrow"]')).toBeVisible();
  await page.screenshot({ path: `${ARTIFACTS}/04-menu-narrow-container.png`, fullPage: true });
});

test("截图：暗色主题菜单", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="menu-open"]').click();
  await expect(page.locator('[data-testid="showcase-menu"]')).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACTS}/05-menu-dark.png`, fullPage: true });
});
