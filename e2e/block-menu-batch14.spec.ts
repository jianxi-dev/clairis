import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page, body: string, path = "/tmp/b14-block.md") {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ p, b }) => {
      const w = window as unknown as Record<string, unknown>;
      (w.__biaoyue_openFile__ as (p: string, c: string, t: string) => void)(
        p,
        b,
        "b14-block.md",
      );
      (
        w.__biaoyue_store__ as {
          getState: () => { setEditorMode: (m: string) => void };
        }
      )
        .getState()
        .setEditorMode("edit");
    },
    { p: path, b: body },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = window.__biaoyue_store__.getState();
    return store.tabs[store.activeTabId]?.content ?? "";
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

test("同级无序列表转有序自动编号", async ({ page }) => {
  await boot(page, ["- 甲", "- 乙", "- 丙", ""].join("\n"));
  await hoverHandle(page, 0);
  await page
    .locator('[data-testid="block-menu-cell"][data-target="ordered"]')
    .click();
  const content = await storeContent(page);
  expect(content).toContain("1. 甲\n2. 乙\n3. 丙");
});

test("轮盘任务项转换落为任务列表而非高亮", async ({ page }) => {
  await boot(page, "正文段落。\n", "/tmp/b14-roulette.md");
  await page.locator(".cm-line").nth(0).click({ clickCount: 3 });
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  await wheel.locator('[data-sector="convert"]').click();
  await wheel
    .locator('.sr-sec[data-band="2"][data-action="convert-list-group"]')
    .click({ force: true });
  await wheel.locator('[data-action="convert-todo"]').first().click({
    force: true,
  });
  const content = await storeContent(page);
  expect(content).toContain("- [ ]");
  expect(content).not.toContain("> [!");
});

test("证据：列表转换四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page, ["- 甲", "- 乙", "- 丙", ""].join("\n"));
  await page.screenshot({ path: `${dir}/list-before.png` });
  await hoverHandle(page, 0);
  await page.screenshot({ path: `${dir}/menu-open.png` });
  await page
    .locator('[data-testid="block-menu-cell"][data-target="ordered"]')
    .click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/list-converted.png` });
  await boot(page, "正文段落。\n", "/tmp/b14-roulette-2.md");
  await page.locator(".cm-line").nth(0).click({ clickCount: 3 });
  await page.screenshot({ path: `${dir}/roulette-selected.png` });
});

test("对齐二级菜单滑出后隐藏", async ({ page }) => {
  await boot(page, "# 标题\n\n正文。\n", "/tmp/b14-flyout.md");
  await hoverHandle(page, 2);
  const row = page.locator('[data-testid="block-menu-align"]');
  await row.hover();
  const panel = page.locator('[data-testid="block-menu-align-panel"]');
  await expect(panel).toHaveCount(1, { timeout: 3000 });
  await page.mouse.move(20, 20);
  await page.waitForTimeout(600);
  await expect(panel).toHaveCount(0);
  const dir = process.env.EVIDENCE_DIR;
  if (dir) {
    await page.screenshot({ path: `${dir}/flyout-hidden.png` });
  }
});

test("「转为」网格只显示图标，不显示文字（#649）", async ({ page }) => {
  await boot(page, "# 标题\n\n正文段落\n");
  await hoverHandle(page, 2);
  const cells = page.locator('[data-testid="block-menu-cell"]');
  await expect(cells).toHaveCount(10);
  const texts = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="block-menu-cell"]'),
    ).map((cell) => (cell.textContent ?? "").trim()),
  );
  expect(texts).toHaveLength(10);
  expect(texts.filter((t) => /[\u4e00-\u9fa5]/.test(t))).toEqual([]);
  const iconHeights = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="block-menu-cell"] svg'),
    ).map((svg) => Math.round(svg.getBBox().height * 10) / 10),
  );
  expect(iconHeights).toHaveLength(10);
  expect(iconHeights.every((h) => h > 0)).toBe(true);
});

test("对齐与缩进行及其子项图标真实有面积（#649）", async ({ page }) => {
  await boot(page, "# 标题\n\n正文段落\n");
  await hoverHandle(page, 2);
  const row = page.locator('[data-testid="block-menu-align"]');
  const rowPath = row.locator("svg path").first();
  const rowBBox = await rowPath.evaluate((n) => {
    const b = (n as SVGPathElement).getBBox();
    return { w: b.width, h: b.height };
  });
  expect(rowBBox.w).toBeGreaterThan(0);
  expect(rowBBox.h).toBeGreaterThan(0);

  await row.hover();
  const panel = page.locator('[data-testid="block-menu-align-panel"]');
  await expect(panel).toBeVisible({ timeout: 2000 });
  await expect(panel.locator("button")).toHaveCount(5);
  const optionBoxes = await panel.evaluate((p) =>
    Array.from(p.querySelectorAll("button svg path")).map((n) => {
      const b = (n as SVGPathElement).getBBox();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    }),
  );
  expect(optionBoxes.length).toBeGreaterThanOrEqual(5);
  expect(optionBoxes.every((b) => b.w > 0 && b.h > 0)).toBe(true);
});

test("二级面板互斥：打开一个会收掉另一个", async ({ page }) => {
  await boot(page, "# 标题\n\n正文段落\n");
  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-color"]').hover();
  await expect(
    page.locator('[data-testid="block-menu-color-panel"]'),
  ).toHaveCount(1, { timeout: 2000 });
  await page.locator('[data-testid="block-menu-align"]').hover();
  await expect(
    page.locator('[data-testid="block-menu-align-panel"]'),
  ).toHaveCount(1, { timeout: 2000 });
  await expect(
    page.locator('[data-testid="block-menu-color-panel"]'),
  ).toHaveCount(0);
  await page.mouse.move(900, 500);
  await expect(page.locator(".cm-block-menu-flyout")).toHaveCount(0, {
    timeout: 2000,
  });
});

test("滚动页面关闭二级面板，父菜单不残留（#649）", async ({ page }) => {
  await boot(page, "# 标题\n\n正文段落\n\n" + "长文\n\n".repeat(30));
  await hoverHandle(page, 2);
  await page.locator('[data-testid="block-menu-align"]').hover();
  await expect(
    page.locator('[data-testid="block-menu-align-panel"]'),
  ).toHaveCount(1, { timeout: 2000 });
  await page.evaluate(() => {
    document.querySelector(".cm-scroller")?.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator(".cm-block-menu-flyout")).toHaveCount(0, {
    timeout: 2000,
  });
});
