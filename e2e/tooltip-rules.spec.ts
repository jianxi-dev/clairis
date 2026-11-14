import { test, expect, type Page } from "@playwright/test";

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
