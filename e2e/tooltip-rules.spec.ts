import { test, expect, type Locator, type Page } from "@playwright/test";
import { revealStatusBar } from "./helpers/ui-probe";

/**
 * 悬停提示规则（#634 / #763）：
 * 会弹菜单/浮层的按钮不再叠加提示；其余提示按配置「提示时长」出现
 * （未配置回退 400ms）。
 */

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      "/tmp/note.md",
      "# 标题\n\n正文。",
      "note.md",
    );
  });
  await page.locator("[data-tab-id]").first().waitFor({ timeout: 5000 });
  await revealStatusBar(page);
}

test("菜单触发按钮悬停：弹菜单但不出提示", async ({ page }) => {
  await boot(page);
  const theme = page.locator('[data-testid="theme-entry"]');
  await theme.hover();
  await expect(page.locator('[data-testid="theme-menu"]')).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".app-tip")).toHaveCount(0);
});

test("页面宽度控件悬停：弹面板但不出提示", async ({ page }) => {
  await boot(page);
  await page.locator('[data-testid="width-control"]').hover();
  await expect(page.locator('[data-testid="width-panel"]')).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".app-tip")).toHaveCount(0);
});

test("普通 title 元素悬停：未配置时 400ms 出现提示，移出后消失", async ({
  page,
}) => {
  await boot(page);
  await page.locator('[data-testid="status-lines"]').hover();
  await page.waitForTimeout(150);
  await expect(page.locator(".app-tip")).toHaveCount(0);
  await page.waitForTimeout(250);
  await expect(page.locator(".app-tip")).toHaveCount(1);
  await page.mouse.move(5, 5);
  await expect(page.locator(".app-tip")).toHaveCount(0);
});

test("配置提示时长 1.0 秒：1100ms 处出现提示，移出后消失", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const store = w.__biaoyue_editor_store__ as {
      getState: () => {
        setConfig: (patch: { noticeDuration: number }) => void;
      };
    };
    store.getState().setConfig({ noticeDuration: 1.0 });
  });
  await page.locator('[data-testid="status-lines"]').hover();
  await page.waitForTimeout(900);
  await expect(page.locator(".app-tip")).toHaveCount(0);
  await page.waitForTimeout(200);
  await expect(page.locator(".app-tip")).toHaveCount(1);
  await page.mouse.move(5, 5);
  await expect(page.locator(".app-tip")).toHaveCount(0);
});

test("视频浮层按钮不再叠加 ArtPlayer 原生提示", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
      "/Users/test/clip.mp4",
      "",
      "clip.mp4",
    );
  });
  const playlist = page.locator(".art-control[data-name='playlist']");
  await playlist.waitFor({ timeout: 10000 });
  await playlist.hover();
  await page.waitForTimeout(1200);

  await expect(playlist).not.toHaveClass(/hint--/);
  await expect(playlist).not.toHaveAttribute("aria-label", /播放列表/);
  await expect(page.locator(".app-tip")).toHaveCount(0);
});

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
}

test("弹层打开期间不放行原生 title：菜单项 title 被接管", async ({ page }) => {
  await boot(page);
  const tab = page.locator("[data-tab-id]").first();
  await tab.click({ button: "right" });
  const menu = page.locator("[data-tab-menu]");
  await expect(menu).toBeVisible();

  const exportItem = menu.locator('[data-menu-item="export"]');
  await exportItem.hover();
  // 弹层打开期间原生 title 被摘除，系统矩形无从出现；且不补胶囊。
  await expect(exportItem).not.toHaveAttribute("title", /.+/);
  await expect(page.locator(".app-tip")).toHaveCount(0);

  // 关闭菜单后：aria-expanded 控件同样被接管——自绘胶囊出现、原生 title 摘除。
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  const outline = page.getByTestId("outline-btn");
  await outline.hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });
  await expect(tip.locator(".app-tip__text")).toHaveText("大纲");
  await expect(outline).not.toHaveAttribute("title", /.+/);
});

test("状态栏右侧按钮提示出现在图标正上方（水平居中 ±4px）", async ({
  page,
}) => {
  await boot(page);
  const btn = page.getByTestId("home-entry");
  await btn.hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });
  await expect(tip).toHaveClass(/app-tip--above/);

  const [t, b] = await Promise.all([boxOf(tip), boxOf(btn)]);
  expect(t.bottom).toBeLessThanOrEqual(b.top + 1);
  const dx = Math.abs((t.left + t.right) / 2 - (b.left + b.right) / 2);
  expect(dx).toBeLessThanOrEqual(4);
});

test("视口左侧控件提示优先上/下，不左右弹", async ({ page }) => {
  await boot(page);
  await page.getByTestId("status-lines").hover();
  const tip = page.locator(".app-tip");
  await expect(tip).toBeVisible({ timeout: 3000 });
  const cls = (await tip.getAttribute("class")) ?? "";
  expect(cls).toMatch(/app-tip--(above|below)/);
  expect(cls).not.toMatch(/app-tip--(left|right)/);
});

test("页签信息窗响应时间跟随全局「提示时长」", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const store = w.__biaoyue_editor_store__ as {
      getState: () => {
        setConfig: (patch: { noticeDuration: number }) => void;
      };
    };
    store.getState().setConfig({ noticeDuration: 1.0 });
  });

  const info = page.getByTestId("tab-info-popover");
  await page.locator("[data-tab-id]").first().hover();
  await page.waitForTimeout(900);
  await expect(info).toHaveCount(0);
  await page.waitForTimeout(200);
  await expect(info).toBeVisible({ timeout: 3000 });
});
