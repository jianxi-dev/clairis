import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 颜色二级面板保持（#374）。
 *
 * 二级色板挂在编辑器根节点、与父面板隔 4px：指针从「颜色」行滑进色板时父面板
 * 会先收到 pointerleave。断言落在「指针真的走开之后色板还在不在」——只看
 * hover 当下出现，等于没测到这条路径。
 */

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const ART = path.resolve(process.cwd(), ".artifacts/374");
mkdirSync(ART, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/block-color.md",
      body,
      "block-color.md",
    );
    store.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function openColorPanel(page: Page) {
  const line = page.locator(".cm-line").nth(2);
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
  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible();
  return panel;
}

test("指针移出父菜单后色板关闭", async ({ page }) => {
  const panel = await openColorPanel(page);

  await page.mouse.move(20, 20);
  await page.waitForTimeout(600);

  await expect(panel).toHaveCount(0);
  await expect(page.locator("[data-block-flyout]")).toHaveCount(0);
  await page.screenshot({ path: path.join(ART, "01-close-on-leave.png") });
});

test("点击菜单外部后色板关闭且不留残骸", async ({ page }) => {
  const panel = await openColorPanel(page);

  await page.locator(".cm-line").nth(4).click();

  await expect(panel).toHaveCount(0);
  await expect(page.locator("[data-block-flyout]")).toHaveCount(0);
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
  await page.screenshot({ path: path.join(ART, "02-outside-click.png") });
});

test("选色后色板关闭且颜色写入源码", async ({ page }) => {
  const panel = await openColorPanel(page);

  await panel
    .locator(
      '[data-testid="color-swatch-font"][data-class-name="mdb-color-red"]',
    )
    .click();

  await expect(panel).toHaveCount(0);
  await expect
    .poll(() => storeContent(page))
    .toBe(
      '# 标题\n\n<span class="mdb-color-red">第一段正文</span>\n\n第二段正文\n',
    );
  await page.screenshot({ path: path.join(ART, "03-color-applied.png") });
});

test("关闭后再次召唤，色板仍能打开（状态往返无残留）", async ({ page }) => {
  const panel = await openColorPanel(page);
  await page.locator(".cm-line").nth(4).click();
  await expect(panel).toHaveCount(0);

  const reopened = await openColorPanel(page);
  await expect(reopened).toBeVisible();
  await expect(page.locator("[data-block-flyout]")).toHaveCount(1);
  await page.screenshot({ path: path.join(ART, "04-reopen.png") });
});
