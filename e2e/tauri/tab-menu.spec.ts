// #1607 页签右键菜单：锚定指针 + 视口内钳制 + 菜单打开期间抑制页签信息窗。
// 覆盖四态：
//   1. menu-open-anchored      菜单锚定在指针附近（≤300px）
//   2. menu-open-clamped       右缘点击 → 菜单完整落在视口内
//   3. info-window-hover-normal 左键 hover 300ms+ → 信息窗出现
//   4. menu-open-info-hidden   菜单打开 → 信息窗不存在
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = process.env.TAB_MENU_APP_URL ?? "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1607");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

async function shot(target: Page, name: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  await target.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      name,
      "--screenshot",
      file,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
  return file;
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', {
    state: "attached",
    timeout: 15000,
  });
  await page.waitForFunction(
    () => typeof window.__biaoyue_openFile__ === "function",
    null,
    { timeout: 15000 },
  );
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/tab-menu/doc.md", "# 标题\n\n正文。", "doc.md");
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

async function menuBox(page: Page) {
  const menu = page.locator("[data-tab-menu]");
  await expect(menu).toHaveCount(1);
  const box = await menu.boundingBox();
  if (!box) throw new Error("菜单不可见");
  return box;
}

test.describe("#1607 页签右键菜单定位", () => {
  test("菜单锚定在指针附近（≤300px）", async ({ page }) => {
    await boot(page);
    const tab = page.locator('[role="tab"]').first();
    const tb = await tab.boundingBox();
    if (!tb) throw new Error("页签不可见");
    const cx = tb.x + tb.width / 2;
    const cy = tb.y + tb.height / 2;

    await tab.click({ button: "right" });
    const mb = await menuBox(page);
    const distance = Math.hypot(mb.x - cx, mb.y - cy);
    expect(distance).toBeLessThanOrEqual(300);
    await shot(page, "menu-open-anchored");
  });

  test("右缘点击菜单完整落在视口内", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 520 });
    await boot(page);
    const tab = page.locator('[role="tab"]').first();

    // 直接把 contextmenu 派发到页签、clientX 取视口右缘内一点，
    // 覆盖「指针靠近右缘」这一态（真实指针会被 pane-actions 挡住）。
    await page.evaluate(() => {
      const el = document.querySelector('[role="tab"]');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: window.innerWidth - 20,
          clientY: rect.top + rect.height / 2,
        }),
      );
    });
    const mb = await menuBox(page);
    expect(mb.x).toBeGreaterThanOrEqual(0);
    expect(mb.y).toBeGreaterThanOrEqual(0);
    expect(mb.x + mb.width).toBeLessThanOrEqual(700);
    expect(mb.y + mb.height).toBeLessThanOrEqual(520);
    await shot(page, "menu-open-clamped");
  });

  test("左键 hover 300ms+ 信息窗出现（不回归）", async ({ page }) => {
    await boot(page);
    const tab = page.locator('[role="tab"]').first();
    const info = page.locator('[data-testid="tab-info-popover"]');
    await expect(info).toHaveCount(0);
    await tab.hover();
    await expect(info).toBeVisible({ timeout: 3000 });
    await shot(page, "info-window-hover-normal");
  });

  test("菜单打开期间信息窗不存在，关闭后恢复 hover 行为", async ({
    page,
  }) => {
    await boot(page);
    const tab = page.locator('[role="tab"]').first();
    const info = page.locator('[data-testid="tab-info-popover"]');

    await tab.click({ button: "right" });
    await menuBox(page);
    // 菜单打开时悬停计时即便已armed也不得弹出。
    await expect(info).toHaveCount(0);
    await shot(page, "menu-open-info-hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-tab-menu]")).toHaveCount(0);

    // 关闭后移开再 hover，信息窗恢复既有 260ms 行为。
    await page.mouse.move(600, 500);
    await expect(info).toHaveCount(0);
    await tab.hover();
    await expect(info).toBeVisible({ timeout: 3000 });
  });
});
