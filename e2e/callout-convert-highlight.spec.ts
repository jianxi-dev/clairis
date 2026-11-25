import { test, expect, type Page } from "@playwright/test";

const APP_URL = process.env.MENU_APP_URL ?? "http://localhost:1420";

const DOC = ["# 标题", "", "第一段正文", ""].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/convert-highlight.md", body, "convert-highlight.md");
    w.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (window as unknown as Record<string, any>).__biaoyue_store__;
    const st = s.getState();
    return st.tabs[st.activeTabId]?.content ?? "";
  });
}

async function hoverHandle(page: Page, lineIndex: number) {
  const line = page.locator(".cm-line").nth(lineIndex);
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
}

test("转换菜单点「高亮」写入 [!highlight] 而不是 [!NOTE]", async ({ page }) => {
  await hoverHandle(page, 0);
  const cells = page.locator('[data-testid="block-menu-cell"][data-target="callout"]');
  await expect(cells).toHaveCount(2);
  await cells.first().click();
  await expect
    .poll(async () => (await storeContent(page)).toLowerCase(), { timeout: 3000 })
    .toContain("[!highlight]");
  const body = (await storeContent(page)).toLowerCase();
  expect(body).not.toContain("[!note]");
});

test("块菜单颜色行图标为 A 字形", async ({ page }) => {
  await hoverHandle(page, 2);
  const row = page.locator('[data-testid="block-menu-color"]');
  await expect(row).toBeVisible();
  const html = await row.innerHTML();
  expect(html).toContain("A");
  expect(html).not.toContain("FontcolorOutlined");
});

test("QG-5 四态证据采集", async ({ page }) => {
  const { mkdirSync } = await import("node:fs");
  const OUT = ".artifacts/1510";
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/01-before.png` });
  await hoverHandle(page, 0);
  await page.screenshot({ path: `${OUT}/02-menu.png` });
  const cells = page.locator('[data-testid="block-menu-cell"][data-target="callout"]');
  await expect(cells).toHaveCount(2);
  await cells.first().click();
  await expect(page.locator(".cm-callout-mark").first()).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: `${OUT}/03-converted.png` });
  await hoverHandle(page, 0);
  await expect(page.locator('[data-testid="block-menu-color"]')).toBeVisible();
  await page.screenshot({ path: `${OUT}/04-color-row-icon.png` });
});
