import { mkdirSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { revealStatusBar } from "./helpers/ui-probe";

/**
 * editor-surface-batch19 / R-26（#871）：提示胶囊指向气泡与内容规则。
 *
 * 锚点：A-26.1 箭头节点存在且指向触发元素；
 *       A-26.2 图标+文字菜单项「复制」提示文本仅快捷键 `⌘ + C`；
 *       A-26.3 纯图标按钮「下划线」提示文本 `下划线 (⌘ + U)` + markdown 用法。
 */

const APP_URL = "http://localhost:1424";
const ART = ".artifacts/871";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(ART, { recursive: true });
  await page.screenshot({ path: `${ART}/${name}.png` });
}

async function boot(page: Page, path: string, content: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ([p, c]) => {
      const w = window as unknown as Record<string, unknown>;
      (w.__biaoyue_openFile__ as (a: string, b: string, t: string) => void)(
        p,
        c,
        p.split("/").pop() ?? p,
      );
    },
    [path, content],
  );
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (
      w.__biaoyue_store__ as {
        getState: () => { setEditorMode: (m: string) => void };
      }
    )
      .getState()
      .setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openWheel(page: Page): Promise<void> {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });
}

/** 箭头四条边的计算宽度（0 = 该边无描边）。 */
async function arrowBorders(page: Page): Promise<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}> {
  return page.locator(".app-tip__arrow").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      top: parseFloat(cs.borderTopWidth),
      right: parseFloat(cs.borderRightWidth),
      bottom: parseFloat(cs.borderBottomWidth),
      left: parseFloat(cs.borderLeftWidth),
    };
  });
}

/** 断言箭头节点存在，其尖角朝向触发元素（尖角 = 两条描边边的交角）。 */
async function expectArrowToward(trigger: Locator): Promise<void> {
  const page = trigger.page();
  const tip = page.locator(".app-tip");
  const arrow = tip.locator(".app-tip__arrow");
  await expect(arrow).toHaveCount(1);
  const [t, a, g, b] = await Promise.all([
    boxOf(tip),
    boxOf(arrow),
    boxOf(trigger),
    arrowBorders(page),
  ]);
  const cls = (await tip.getAttribute("class")) ?? "";
  const tipCenter = { x: t.left + t.width / 2, y: t.top + t.height / 2 };
  const arrowCenter = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const on = (n: number) => n > 0;
  if (cls.includes("app-tip--above")) {
    // 朝下：右边 + 下边交于右下尖角
    expect(on(b.right) && on(b.bottom)).toBe(true);
    expect(on(b.top) || on(b.left)).toBe(false);
    expect(arrowCenter.y).toBeGreaterThan(tipCenter.y);
    expect(t.bottom).toBeLessThanOrEqual(g.top + 1);
  } else if (cls.includes("app-tip--below")) {
    // 朝上：左边 + 上边交于左上尖角
    expect(on(b.top) && on(b.left)).toBe(true);
    expect(on(b.right) || on(b.bottom)).toBe(false);
    expect(arrowCenter.y).toBeLessThan(tipCenter.y);
    expect(t.top).toBeGreaterThanOrEqual(g.bottom - 1);
  } else if (cls.includes("app-tip--right")) {
    // 朝左：下边 + 左边交于左下尖角
    expect(on(b.bottom) && on(b.left)).toBe(true);
    expect(on(b.top) || on(b.right)).toBe(false);
    expect(arrowCenter.x).toBeLessThan(tipCenter.x);
    expect(t.left).toBeGreaterThanOrEqual(g.right - 1);
  } else if (cls.includes("app-tip--left")) {
    // 朝右：上边 + 右边交于右上尖角
    expect(on(b.top) && on(b.right)).toBe(true);
    expect(on(b.bottom) || on(b.left)).toBe(false);
    expect(arrowCenter.x).toBeGreaterThan(tipCenter.x);
    expect(t.right).toBeLessThanOrEqual(g.left + 1);
  } else {
    throw new Error(`未知弹出方位: ${cls}`);
  }
}

test("纯图标按钮「下划线」提示名称 + 快捷键 + markdown 用法，箭头指向触发元素", async ({
  page,
}) => {
  await boot(
    page,
    "/tmp/tip-underline.md",
    ["# 标题", "", "第一段正文", ""].join("\n"),
  );
  await openWheel(page);

  // 根扇区提示也带箭头（回归 #835 的扇区提示行为）
  const formatSector = page.locator('[data-sector="format"]');
  await formatSector.hover();
  const sectorTip = page.locator(".app-tip");
  await expect(sectorTip).toBeVisible({ timeout: 3000 });
  await expect(sectorTip.locator(".app-tip__text")).toHaveText("格式");
  await expectArrowToward(formatSector);
  await shot(page, "tip-arrow-sector");
  await page.mouse.move(5, 5);
  await expect(sectorTip).toHaveCount(0, { timeout: 3000 });

  await formatSector.click({ force: true });
  const underline = page.locator('path[data-action="format-underline"]');
  await expect(underline).toHaveCount(1);
  await underline.hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });
  await expect(tip.locator(".app-tip__text")).toHaveText("下划线 (⌘ + U)");
  await expect(tip.locator(".app-tip__hint")).toContainText(
    "Markdown: ~文本~ 空格",
  );
  await expectArrowToward(underline);
  await shot(page, "tip-arrow-above");
  await shot(page, "tip-name-and-shortcut");
});

test("图标+文字菜单项「复制」提示仅快捷键，箭头指向触发元素", async ({
  page,
}) => {
  await boot(page, "/tmp/tip-copy.md", "![图片](photo.png)\n\n普通段落");
  const line = page.locator(".cm-line").first();
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });

  const copyRow = page.locator(
    '[data-testid="block-menu-action"][data-action="duplicate"]',
  );
  await expect(copyRow).toHaveCount(1);
  await expect(copyRow).toContainText("复制");
  await copyRow.hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });
  await expect(tip.locator(".app-tip__text")).toHaveText("⌘ + C");
  await expect(tip).not.toContainText("复制");
  await expectArrowToward(copyRow);
  await shot(page, "tip-arrow-right");
  await shot(page, "tip-shortcut-only");
});

test("底部状态栏按钮提示上弹、箭头朝下（方位规则回归）", async ({ page }) => {
  await boot(page, "/tmp/tip-below.md", "第一段正文\n");
  await revealStatusBar(page);
  const home = page.getByTestId("home-entry");
  await home.hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });
  await expect(tip.locator(".app-tip__text")).not.toBe("");
  await expectArrowToward(home);
  await shot(page, "tip-arrow-above-statusbar");
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0, { timeout: 3000 });
});
