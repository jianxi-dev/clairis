import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/250");
mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openFile(page: Page, p: string): Promise<void> {
  await page.evaluate((file) => {
    (
      window as unknown as {
        __biaoyue_openFile__: (
          path: string,
          content: string,
          title: string,
        ) => void;
      }
    ).__biaoyue_openFile__(file, "# 标题\n\n正文。", "doc");
  }, p);
  await expect
    .poll(() => page.locator("[data-pane-id]").count())
    .toBeGreaterThan(0);
}

test("分割线默认可见，且颜色走主题变量", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/batch2/divider.md");
  await page.keyboard.press("Control+Alt+ArrowRight");
  await expect(page.locator('[data-testid="pane-divider"]')).toHaveCount(1);

  const bg = await page
    .locator('[data-testid="pane-divider"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bg).not.toBe("transparent");
  await page.screenshot({ path: path.join(ART, "divider.png") });
});

test("聚焦栏不绘制强调色内描边（navigation:109）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/batch2/focus.md");
  await page.keyboard.press("Control+Alt+ArrowRight");
  const panes = page.locator("[data-pane-id]");
  await expect(panes).toHaveCount(2);
  await panes.first().click({ position: { x: 20, y: 20 } });
  await expect
    .poll(async () => {
      const shadows = await page
        .locator('[data-pane-id][data-focused="true"]')
        .evaluateAll((els) => els.map((e) => getComputedStyle(e).boxShadow));
      // 规格：聚焦语义由页签与内容表达，禁止 1.5px 强调色内描边（拖拽落区环除外）。
      return shadows.every((s) => s === "none" || !/inset/.test(s));
    })
    .toBe(true);
  await page.screenshot({ path: path.join(ART, "focus.png") });
});

test("暖色主题下菜单表面跟随主题色", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/batch2/warm.md");

  const themeBtn = page.locator(
    '[data-testid="status-bar"] button[title^="当前"]',
  );
  for (let i = 0; i < 5; i++) {
    if ((await themeBtn.getAttribute("title"))?.includes("暖色")) break;
    await themeBtn.click();
    await page.waitForTimeout(120);
  }
  await expect(themeBtn).toHaveAttribute("title", /暖色/);

  await page.locator('[data-testid="pane-menu-button"]').first().hover();
  const menu = page.locator('[data-testid="pane-menu"]');
  await expect(menu).toBeVisible();
  const bg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
  // 暖色 --app-surface = #fbf4e8
  expect(bg).toBe("rgb(251, 244, 232)");
  await page.screenshot({ path: path.join(ART, "warm-menu.png") });
});

test("页签拖到另一栏时目标栏出现落区属性", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/batch2/drop.md");
  await page.keyboard.press("Control+Alt+ArrowRight");
  const panes = page.locator("[data-pane-id]");
  await expect(panes).toHaveCount(2);

  const focusedId = await page.evaluate(() => {
    const st = (
      window as unknown as {
        __biaoyue_store__: { getState: () => { focusedPaneId: string } };
      }
    ).__biaoyue_store__.getState();
    return st.focusedPaneId;
  });
  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  const target = page.locator(`[data-pane-id="${focusedId}"]`);
  const from = await tab.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("无法测量");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + 10, {
    steps: 4,
  });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 10,
  });
  await expect
    .poll(() =>
      page
        .locator(`[data-pane-id="${focusedId}"][data-tab-drop="true"]`)
        .count(),
    )
    .toBe(1);
  await page.mouse.up();
  await page.screenshot({ path: path.join(ART, "tab-drop.png") });
});
