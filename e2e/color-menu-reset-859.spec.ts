import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * #859 / A-25.1 + A-25.2：颜色菜单背景色下方「恢复默认」。
 *
 * 真实路径：真实选区（块手柄 hover 召唤）+ 真实点击（色板项 → 恢复默认）。
 * 断言落点：项存在且位于背景色行下方、与色板行同宽；点击后源码里
 * `mdb-color-*` 与 `mdb-bg-*` 节点数归零。
 */

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const ART = path.resolve(process.cwd(), ".artifacts/859");
mkdirSync(ART, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/color-menu-reset.md",
      body,
      "color-menu-reset.md",
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

/** 写截图到 `.artifacts/859/<name>.png`，返回相对路径（供 evidence manifest）。 */
async function shot(page: Page, name: string): Promise<string> {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(ART, file) });
  return `.artifacts/859/${file}`;
}

/** 在左缘召唤区悬停第 `lineIndex` 行，唤出块菜单。 */
async function hoverHandle(page: Page, lineIndex: number): Promise<void> {
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

async function openColorPanel(page: Page) {
  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-color"]').hover();
  const panel = page.locator('[data-testid="block-menu-color-panel"]');
  await expect(panel).toBeVisible({ timeout: 3000 });
  return panel;
}

/** 真实点击一个色板项（点击后色板关闭）。 */
async function pickColor(page: Page, kind: string, className: string) {
  const panel = await openColorPanel(page);
  await panel
    .locator(
      `[data-testid="color-swatch-${kind}"][data-class-name="${className}"]`,
    )
    .click();
  await expect(panel).toHaveCount(0);
}

test("「恢复默认」在背景色行下方，且与色板行同宽", async ({ page }) => {
  const panel = await openColorPanel(page);

  const reset = panel.locator('[data-testid="color-reset"]');
  await expect(reset).toBeVisible();
  await expect(reset).toHaveText("恢复默认");

  const bgRow = panel.locator('.cm-color-row[data-kind="background"]');
  const bgRowBox = (await bgRow.boundingBox())!;
  const resetBox = (await reset.boundingBox())!;

  // 位置：紧在背景色行下方（允许 1px 取整误差）。
  expect(resetBox.y).toBeGreaterThanOrEqual(bgRowBox.y + bgRowBox.height - 1);
  // 同宽：按钮宽度 == 色板行宽度。
  expect(resetBox.width).toBeCloseTo(bgRowBox.width, 0);

  await shot(page, "menu-with-reset");

  // 标注截图：给背景色行与恢复默认各描一边，直观看到两者等宽。
  await page.evaluate(() => {
    const panelEl = document.querySelector(
      '[data-testid="block-menu-color-panel"]',
    ) as HTMLElement;
    const row = panelEl?.querySelector(
      '.cm-color-row[data-kind="background"]',
    ) as HTMLElement;
    const resetEl = panelEl?.querySelector(".cm-color-reset") as HTMLElement;
    if (row) row.style.outline = "1px solid #6366f1";
    if (resetEl) resetEl.style.outline = "1px solid #f0000e";
  });
  await shot(page, "reset-button-width");
});

test("点击「恢复默认」清除字色与背景色标记（真实点击）", async ({ page }) => {
  // 先字色、后背景色：得到背景色包字色的嵌套结构（两族互相嵌套）。
  await pickColor(page, "font", "mdb-color-red");
  await pickColor(page, "background", "mdb-bg-blue");

  await expect
    .poll(() => storeContent(page))
    .toBe(
      "# 标题\n\n" +
        '<span class="mdb-bg-blue"><span class="mdb-color-red">第一段正文</span></span>\n\n' +
        "第二段正文\n",
    );
  await shot(page, "before-colored");

  const panel = await openColorPanel(page);
  await panel.locator('[data-testid="color-reset"]').click();

  await expect(panel).toHaveCount(0);
  await expect.poll(() => storeContent(page)).toBe(DOC);
  await shot(page, "after-reset");
});

test("无颜色块点击「恢复默认」无副作用", async ({ page }) => {
  const panel = await openColorPanel(page);
  await panel.locator('[data-testid="color-reset"]').click();

  await expect(panel).toHaveCount(0);
  await expect.poll(() => storeContent(page)).toBe(DOC);
});
