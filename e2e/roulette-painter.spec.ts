import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;
const DOC = [
  '**<span class="mdb-color-green">彩色段落</span>**',
  "",
  "第一段正文",
  "",
  "第二段正文",
  "",
].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/roulette-painter.md", body, "painter.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

test("格式刷把加粗与字色刷到另一段", async ({ page }) => {
  await page.locator(".cm-line").nth(0).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  await page.locator('[data-testid="roulette-center"]').click({ force: true });
  await expect(page.locator('[data-testid="roulette-center"]')).toHaveAttribute(
    "data-painter",
    "true",
  );

  const viewport = page.viewportSize()!;
  const farX = viewport.width - 40;
  const line2 = (await page.locator(".cm-line").nth(2).boundingBox())!;
  await page.mouse.click(farX, line2.y + line2.height / 2, { clickCount: 3 });

  await expect
    .poll(() => content(page))
    .toContain('**<span class="mdb-color-green">第一段正文</span>**');
  const source = await content(page);
  expect(source).toContain("mdb-color-green");
  expect(source).toContain("**<span");
});

test("格式刷不把目标段本来已有的同色再包一层", async ({ page }) => {
  await page.locator(".cm-line").nth(0).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  await page.locator('[data-testid="roulette-center"]').click({ force: true });

  const viewport = page.viewportSize()!;
  const farX = viewport.width - 40;
  const line0 = (await page.locator(".cm-line").nth(0).boundingBox())!;
  await page.mouse.click(farX, line0.y + line0.height / 2, { clickCount: 3 });
  await page.waitForTimeout(400);

  const source = await content(page);
  const spans = source.match(/mdb-color-green/g)?.length ?? 0;
  expect(spans).toBe(1);
});
