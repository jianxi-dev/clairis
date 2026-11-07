import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #259：「更多操作」菜单 / 阅读空间设置菜单在三主题下必须等于所在容器的
 * --app-surface / --app-border / --app-sunken，不得残留纯白。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/259");

mkdirSync(ART, { recursive: true });

type Theme = "light" | "dark" | "warm";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((t) => {
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    root.classList.toggle("warm", t === "warm");
  }, theme);
}

async function openRailMenu(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (
      window as unknown as {
        __biaoyue_store__: {
          setState: (s: Record<string, unknown>) => void;
          getState: () => { setRailState: (s: string) => void };
        };
      }
    ).__biaoyue_store__;
    store.setState({ scene: "workspace" });
    store.getState().setRailState("pinned");
  });
  await expect(page.locator('[data-testid="rail-settings"]')).toBeVisible();
  await page.locator('[data-testid="rail-settings"]').click();
  await expect(page.locator('[data-testid="rail-menu"]')).toBeVisible();
}

function readMenuColors(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--app-surface)";
    probe.style.borderTopColor = "var(--app-border)";
    probe.style.color = "var(--app-sunken)";
    document.body.appendChild(probe);
    const probeStyle = getComputedStyle(probe);
    const surface = probeStyle.backgroundColor;
    const border = probeStyle.borderTopColor;
    const sunken = probeStyle.color;
    probe.remove();

    const menu = document.querySelector<HTMLElement>(
      '[data-testid="rail-menu"]',
    );
    const menuStyle = menu ? getComputedStyle(menu) : null;
    return {
      surface,
      border,
      sunken,
      menuBg: menuStyle?.backgroundColor ?? null,
      menuBorder: menuStyle?.borderTopColor ?? null,
    };
  });
}

for (const theme of ["light", "dark", "warm"] as Theme[]) {
  test(`阅读空间设置菜单跟随主题：${theme}`, async ({ page }) => {
    await boot(page);
    await setTheme(page, theme);
    await openRailMenu(page);

    const colors = await readMenuColors(page);
    expect(colors.menuBg).toBe(colors.surface);
    expect(colors.menuBorder).toBe(colors.border);

    // 菜单项 hover 背景 = --app-sunken
    const item = page.locator('[data-testid="rail-layout-tabs"]');
    await item.hover();
    const hoverBg = await item.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(hoverBg).toBe(colors.sunken);

    await page.screenshot({ path: path.join(ART, `rail-menu-${theme}.png`) });
  });
}
