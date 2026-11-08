import { test, expect, type Page } from "@playwright/test";
import { moveThrough } from "./helpers/ui-probe";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

test.describe("状态栏高度与显隐（ui-polish-batch6 4.1）", () => {
  test("状态栏高度不超过 26px", async ({ page }) => {
    await boot(page);
    const height = await page
      .getByTestId("status-bar")
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(26);
  });

  test("双击隐藏，指针进入底部热区 500ms 内显现，移出后隐藏", async ({
    page,
  }) => {
    await boot(page);
    const bar = page.getByTestId("status-bar");
    await bar.locator("span").first().dblclick();
    await expect(bar).toHaveCount(0);

    const zone = page.getByTestId("status-hotzone");
    await expect(zone).toHaveCount(1);

    await zone.hover();
    await expect(bar).toBeVisible({ timeout: 2000 });

    await bar.hover();
    await page.mouse.move(400, 200);
    await page.mouse.move(400, 260);
    await expect(bar).toHaveCount(0, { timeout: 3000 });
  });
});

test.describe("主题下拉弹窗（ui-polish-batch6 5.1）", () => {
  test("悬停弹出四项，点击暗色后切换并关闭", async ({ page }) => {
    await boot(page);
    await page.getByTestId("theme-entry").hover();

    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });
    await expect(menu.locator("button")).toHaveCount(4);

    await page.getByTestId("theme-option-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(menu).toHaveCount(0);
  });
});

test.describe("主页入口（ui-polish-batch6 6.1）", () => {
  test("点击主页回到启动页", async ({ page }) => {
    await boot(page);
    await page.getByTestId("home-entry").click();
    await expect(page.getByTestId("portal")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("页面宽度调整面板（ui-polish-batch6 6.2）", () => {
  test("三档预设与滑块，选择后宽度同步", async ({ page }) => {
    await boot(page);
    const widthText = page.getByTestId("status-width");
    await expect(widthText).toHaveText(/^\d+px$/);

    await widthText.click();
    const panel = page.getByTestId("width-panel");
    await expect(panel).toBeVisible({ timeout: 3000 });
    await expect(panel.locator("button")).toHaveCount(3);
    await expect(page.getByTestId("width-slider")).toHaveCount(1);

    await page.getByTestId("width-preset-720").click();
    await expect(widthText).toHaveText("720px");

    const slider = page.getByTestId("width-slider");
    expect(await slider.getAttribute("max")).toBe("1400");

    const sliderBox = (await slider.boundingBox())!;
    const barsBox = (await page.getByTestId("width-bars").boundingBox())!;
    expect(sliderBox.width).toBeGreaterThan(barsBox.width);

    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(1440);
  });
});

test.describe("主题按钮去三角与图标区分（ui-polish-batch6 18.1）", () => {
  test("按钮只有一个图标；亮色与暖色图形不同", async ({ page }) => {
    await boot(page);
    const btn = page.getByTestId("theme-entry");
    await expect(btn.locator("svg")).toHaveCount(1);

    const paths = await page.evaluate(async () => {
      const mod = await import("/src/ui/icons.ts");
      const icons = (
        mod as unknown as { ICONS: Record<string, { s?: string }> }
      ).ICONS;
      return { bright: icons.sunBright?.s ?? "", warm: icons.sunWarm?.s ?? "" };
    });
    expect(paths.bright).not.toBe(paths.warm);
    const rays = (d: string) => (d.match(/M/g) ?? []).length - 1;
    expect(rays(paths.bright)).toBe(6);
    expect(rays(paths.warm)).toBe(4);
  });
});

test.describe("主题弹层生命周期与点击循环（shell-media-batch7 1.1）", () => {
  const ORDER = ["跟随系统", "亮色", "暗色", "暖色"] as const;

  async function themeTitle(page: Page): Promise<string> {
    return (await page.getByTestId("theme-entry").getAttribute("title")) ?? "";
  }

  test("指针缓慢横越间隙时面板不消失，仍可点选", async ({ page }) => {
    await boot(page);
    const btn = page.getByTestId("theme-entry");
    await btn.hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });

    const btnBox = (await btn.boundingBox())!;
    const menuBox = (await menu.boundingBox())!;
    const gapY = (menuBox.y + menuBox.height + btnBox.y) / 2;

    // 先停在按钮与面板之间的空隙 200ms（旧实现 150ms 关闭定时器会在此触发）
    await moveThrough(
      page,
      [
        { x: btnBox.x + btnBox.width / 2, y: gapY },
        { x: menuBox.x + menuBox.width / 2, y: menuBox.y + menuBox.height / 2 },
      ],
      { steps: 4, pauseMs: 200 },
    );

    await expect(menu).toBeVisible({ timeout: 1000 });
    await page.waitForTimeout(500);
    await expect(menu).toBeVisible();

    await page.getByTestId("theme-option-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(menu).toHaveCount(0);
  });

  test("单击图标按固定次序循环切换主题", async ({ page }) => {
    await boot(page);
    const btn = page.getByTestId("theme-entry");
    const initial = await themeTitle(page);
    const start = ORDER.findIndex((label) => initial.endsWith(label));
    expect(start).toBeGreaterThanOrEqual(0);

    let expected = start;
    for (let i = 1; i <= 4; i += 1) {
      await btn.click();
      expected = (expected + 1) % ORDER.length;
      await expect(btn).toHaveAttribute("title", `当前: ${ORDER[expected]}`);
    }
    await expect(btn).toHaveAttribute("title", `当前: ${ORDER[start]}`);
  });

  test("面板打开时单击图标仍循环且面板保持", async ({ page }) => {
    await boot(page);
    const btn = page.getByTestId("theme-entry");
    await btn.hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });

    const before = await themeTitle(page);
    await btn.click();
    await expect(btn).not.toHaveAttribute("title", before);
    await expect(menu).toBeVisible();
    await expect(
      menu.locator('[role="menuitemradio"][aria-checked="true"]'),
    ).toHaveCount(1);
  });

  test("Esc 与外部点击关闭面板", async ({ page }) => {
    await boot(page);
    const menu = page.getByTestId("theme-menu");
    await page.getByTestId("theme-entry").hover();
    await expect(menu).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    await page.mouse.move(600, 300);
    await page.getByTestId("theme-entry").hover();
    await expect(menu).toBeVisible({ timeout: 3000 });
    await page.mouse.click(600, 300);
    await expect(menu).toHaveCount(0);
  });

  test("可访问性属性：haspopup / expanded / menu / menuitemradio", async ({
    page,
  }) => {
    await boot(page);
    const btn = page.getByTestId("theme-entry");
    await expect(btn).toHaveAttribute("aria-haspopup", "menu");
    await expect(btn).toHaveAttribute("aria-expanded", "false");

    await btn.hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await expect(menu.locator('[role="menu"]')).toHaveCount(1);
    await expect(menu.locator('[role="menuitemradio"]')).toHaveCount(4);
    await expect(
      menu.locator('[role="menuitemradio"][aria-checked="true"]'),
    ).toHaveCount(1);
  });

  test("状态栏隐藏后经底部热区唤出，移向面板时面板不丢", async ({ page }) => {
    await boot(page);
    const bar = page.getByTestId("status-bar");
    await bar.locator("span").first().dblclick();
    await expect(bar).toHaveCount(0);

    await page.getByTestId("status-hotzone").hover();
    await expect(bar).toBeVisible({ timeout: 3000 });
    await page.getByTestId("theme-entry").hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });

    const menuBox = (await menu.boundingBox())!;
    await moveThrough(
      page,
      [{ x: menuBox.x + menuBox.width / 2, y: menuBox.y + 10 }],
      { steps: 4, pauseMs: 300 },
    );
    await expect(menu).toBeVisible({ timeout: 1000 });
    await page.getByTestId("theme-option-warm").click();
    await expect(page.locator("html")).toHaveClass(/warm/);
  });

  test("宽度面板按 Esc 关闭", async ({ page }) => {
    await boot(page);
    await page.getByTestId("status-width").click();
    const panel = page.getByTestId("width-panel");
    await expect(panel).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await page.getByTestId("status-width").click();
    await expect(panel).toBeVisible({ timeout: 3000 });
    await page.mouse.click(600, 300);
    await expect(panel).toHaveCount(0);
  });
});

test.describe("弹层生命周期回归（评审修正）", () => {
  test("隐藏态下弹层自动关闭时，指针仍在状态栏上则不卸载状态栏", async ({
    page,
  }) => {
    await boot(page);
    const bar = page.getByTestId("status-bar");
    await bar.locator("span").first().dblclick();
    await expect(bar).toHaveCount(0);

    await page.getByTestId("status-hotzone").hover();
    await expect(bar).toBeVisible({ timeout: 3000 });

    await page.getByTestId("theme-entry").hover();
    await expect(page.getByTestId("theme-menu")).toBeVisible({
      timeout: 3000,
    });

    const lines = (await page.getByTestId("status-lines").boundingBox())!;
    await moveThrough(
      page,
      [{ x: lines.x + lines.width / 2, y: lines.y + lines.height / 2 }],
      { steps: 4 },
    );
    await expect(page.getByTestId("theme-menu")).toHaveCount(0, {
      timeout: 3000,
    });
    await page.waitForTimeout(700);
    await expect(bar).toBeVisible();
  });

  test("从面板移回触发器后，面板不应自行关闭", async ({ page }) => {
    await boot(page);
    const btn = page.getByTestId("theme-entry");
    await btn.hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });

    const menuBox = (await menu.boundingBox())!;
    await moveThrough(
      page,
      [{ x: menuBox.x + menuBox.width / 2, y: menuBox.y + menuBox.height / 2 }],
      { steps: 4, pauseMs: 400 },
    );
    await expect(menu).toBeVisible();

    const btnBox = (await btn.boundingBox())!;
    await moveThrough(
      page,
      [{ x: btnBox.x + btnBox.width / 2, y: btnBox.y + btnBox.height / 2 }],
      { steps: 4 },
    );
    await page.waitForTimeout(500);
    await expect(menu).toBeVisible();
  });

  test("Esc 只关闭弹层，不触发全局退出沉浸", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__biaoyue_store__?.getState?.().setReadingMode(true);
    });
    await page.getByTestId("theme-entry").hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    expect(
      await page.evaluate(
        () => window.__biaoyue_store__?.getState?.().readingMode,
      ),
    ).toBe(true);
  });

  test("键盘可打开面板、方向键移动、Esc 归还焦点", async ({ page }) => {
    await boot(page);
    const btn = page.getByTestId("theme-entry");
    await btn.focus();
    await page.keyboard.press("ArrowDown");

    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[role="menuitemradio"]:focus')).toHaveCount(1);
    const firstFocused = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? "",
    );

    await page.keyboard.press("ArrowDown");
    const secondFocused = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? "",
    );
    expect(secondFocused).not.toBe(firstFocused);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("data-testid"),
      ),
    ).toBe("theme-entry");
  });

  test("主题面板右缘不超出视口", async ({ page }) => {
    await boot(page);
    await page.getByTestId("theme-entry").hover();
    const menu = page.getByTestId("theme-menu");
    await expect(menu).toBeVisible({ timeout: 3000 });
    const box = (await menu.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(1200 - 8 + 1);
  });
});
