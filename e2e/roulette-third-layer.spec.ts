import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const WHEEL = '[data-testid="selection-roulette"]';

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/roulette-third.md", body, "roulette.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

async function openWheel(page: Page) {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await expect(page.locator(WHEEL)).toBeVisible({ timeout: 3000 });
}

async function openConvertGroup(page: Page) {
  await page.locator('[data-sector="convert"]').click({ force: true });
  await page
    .locator('path[data-band="2"][data-action="convert-callout-group"]')
    .click({
      force: true,
    });
}

test("颜色扇区使用水滴图标", async ({ page }) => {
  await openWheel(page);
  const icon = page.locator('[data-sector-label="color"] .sr-root-icon');
  await expect(icon).toHaveAttribute("data-icon", "droplet");
});

test("三层展开后轮盘降到 90%，默认高亮一格并随指针同向移动", async ({
  page,
}) => {
  await openWheel(page);
  await openConvertGroup(page);

  const rootSector = page.locator('[data-sector="convert"]');
  await expect(rootSector).toHaveCSS("opacity", "0.9");
  const third = page.locator('.sr-sec[data-band="3"]');
  expect(await third.count()).toBeGreaterThan(1);
  await expect(page.locator('.sr-sec[data-band="3"].hot')).toHaveCount(1);

  const box = await page.locator(WHEEL).boundingBox();
  if (!box) throw new Error("轮盘不可测量");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = 105;
  const indexes: number[] = [];
  for (const deg of [-35, -20, -5, 10, 25]) {
    const rad = ((deg - 90) * Math.PI) / 180;
    await page.mouse.move(
      cx + Math.cos(rad) * radius,
      cy + Math.sin(rad) * radius,
    );
    await page.waitForTimeout(60);
    const hot = page.locator('.sr-sec[data-band="3"].hot').first();
    indexes.push(Number(await hot.getAttribute("data-idx")));
  }
  for (let i = 1; i < indexes.length; i += 1) {
    expect(indexes[i]).toBeGreaterThanOrEqual(indexes[i - 1]);
  }
});

test("提示只保留圆心操作说明", async ({ page }) => {
  await openWheel(page);
  await page.locator('[data-sector="smart"]').hover();
  await page.waitForTimeout(700);
  await expect(page.locator(".app-tip")).toHaveCount(0);

  await page.clock.install();
  await page.locator('[data-testid="roulette-center"]').hover();
  await page.clock.fastForward(60_000);
  await expect(page.locator(".app-tip")).toContainText("格式刷");
});
