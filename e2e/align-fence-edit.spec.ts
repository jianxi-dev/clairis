import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * #668：块对齐围栏标记（`::: {.align-*}` … `:::`）在编辑态用装饰隐藏，
 * 源码态保留，预览仍按对齐渲染；取消对齐后编辑态无残留标记与空行。
 */

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const DOC_LINES = ["# 标题", "", "第一段正文", "", "第二段正文", ""];

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content:
      '.cm-block-handle[data-empty="true"] { display: none !important; }' +
      ".cm-block-handle:not(.cm-block-handle-visible) { pointer-events: none !important; }",
  });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/align-fence-edit.md",
      body,
      "align-fence-edit.md",
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

function setMode(page: Page, mode: string): Promise<void> {
  return page.evaluate((m) => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode(m);
  }, mode);
}

/**
 * 编辑态可见行（每行 textContent）。
 *
 * 不用 innerText：CM6 的空行是 `<br>`，innerText 会把它多算一个换行，
 * 与块边界换行叠加成三连换行，断言会假失败。
 */
function visibleLines(page: Page): Promise<string[]> {
  return page
    .locator(".cm-content .cm-line")
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
}

async function hoverLine(page: Page, line: Locator): Promise<void> {
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

async function applyAlign(
  page: Page,
  line: Locator,
  alignment: string,
): Promise<void> {
  await hoverLine(page, line);
  await page.locator('[data-testid="block-menu-align"]').hover();
  await page
    .locator('[data-testid="block-menu-align-panel"]')
    .locator(`[data-alignment="${alignment}"]`)
    .click();
}

test("编辑态隐藏对齐围栏，源码态保留，预览仍居中", async ({ page }) => {
  const paragraph = page
    .locator(".cm-line")
    .filter({ hasText: "第一段正文" })
    .first();

  await applyAlign(page, paragraph, "center");
  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n::: {.align-center}\n第一段正文\n:::\n\n第二段正文\n");

  // 编辑态：围栏整行隐藏，可见行结构与无围栏时一致。
  await expect.poll(() => visibleLines(page)).toEqual(DOC_LINES);

  // 源码态：围栏标记仍在。
  await setMode(page, "source");
  await expect.poll(() => visibleLines(page)).toContain("::: {.align-center}");

  // 切回编辑态：装饰重新装回，标记重新隐藏。
  await setMode(page, "edit");
  await expect.poll(() => visibleLines(page)).toEqual(DOC_LINES);

  // 预览态：仍按对齐渲染。
  await setMode(page, "preview");
  await expect(
    page.locator(".preview-content .layout-align-center"),
  ).toBeVisible();
});

test("取消对齐后编辑态无残留标记与空行", async ({ page }) => {
  const paragraph = page
    .locator(".cm-line")
    .filter({ hasText: "第一段正文" })
    .first();

  await applyAlign(page, paragraph, "center");
  await expect.poll(() => storeContent(page)).toContain("::: {.align-center}");

  // 再点一次同对齐 = 取消。
  await applyAlign(page, paragraph, "center");
  await expect.poll(() => storeContent(page)).toBe(DOC);

  // 编辑态无标记，也没有因删围栏多出的空行。
  await expect.poll(() => visibleLines(page)).toEqual(DOC_LINES);
});

test("多组围栏共存：都隐藏，中间正文可见", async ({ page }) => {
  const DOC_WITH_TRAILING_PARAGRAPH = [
    "# 标题",
    "",
    "第一段正文",
    "",
    "第二段正文",
    "",
    "结尾",
    "",
  ].join("\n");
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/align-fence-edit-multi.md",
      body,
      "align-fence-edit-multi.md",
    );
    store.getState().setEditorMode("edit");
  }, DOC_WITH_TRAILING_PARAGRAPH);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });

  const first = page
    .locator(".cm-line")
    .filter({ hasText: "第一段正文" })
    .first();
  await applyAlign(page, first, "center");

  const second = page
    .locator(".cm-line")
    .filter({ hasText: "第二段正文" })
    .first();
  await applyAlign(page, second, "right");

  await expect
    .poll(() => storeContent(page))
    .toBe(
      "# 标题\n\n::: {.align-center}\n第一段正文\n:::\n\n::: {.align-right}\n第二段正文\n:::\n\n结尾\n",
    );

  // 两组围栏都隐藏，正文与空行结构不变。
  await expect
    .poll(() => visibleLines(page))
    .toEqual(["# 标题", "", "第一段正文", "", "第二段正文", "", "结尾", ""]);
});
