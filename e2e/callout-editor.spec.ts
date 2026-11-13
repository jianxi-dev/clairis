import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 打开一个 markdown 页签、切到编辑模式，光标停在文末正文（高亮块非活跃）。 */
async function openCalloutDoc(page: Page, path: string, content: string) {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: path, c: content },
  );
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  return editor;
}

/** 读当前页签源码（逐字节断言用）。 */
async function getSource(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return s.tabs[s.activeTabId]?.content as string;
  });
}

/** 焦点仍在高亮块正文输入框。 */
async function focusInCalloutEditor(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    return (
      el instanceof HTMLElement && el.dataset.testid === "cm-callout-editor"
    );
  });
}

/** 把正文编辑器光标移到行末（点击内容按点击位置放光标，输入 / 需先在末尾）。 */
async function moveCaretToEnd(page: Page): Promise<void> {
  await page.keyboard.press("End");
}

/** 两个矩形的最短距离（重叠为 0）。 */
function rectDistance(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  return Math.max(
    a.y - (b.y + b.height),
    b.y - (a.y + a.height),
    a.x - (b.x + b.width),
    b.x - (a.x + a.width),
  );
}

const SOURCE = "> [!NOTE] 重要提醒\n> 记得带伞\n\n正文";

test("A-4.3 高亮块正文输入 / 打开统一斜杠菜单：锚定 textarea、焦点保持、源码不变", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-slash-open.md", SOURCE);

  const content = page.locator(".cm-callout-content").first();
  await expect(content).toBeVisible();
  await content.click();
  const area = page.locator('[data-testid="cm-callout-editor"]');
  await expect(area).toBeVisible();
  await expect(area).toHaveValue("记得带伞");
  await moveCaretToEnd(page);

  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await expect(menu).toHaveCount(1);

  // 菜单锚定 textarea 矩形（矩形距离 ≤ 8px）
  const areaBox = (await area.boundingBox())!;
  const menuBox = (await menu.boundingBox())!;
  expect(rectDistance(areaBox, menuBox)).toBeLessThanOrEqual(8);

  // 焦点仍在 textarea；过滤词活在 textarea 里，源码逐字节不变
  expect(await focusInCalloutEditor(page)).toBe(true);
  expect(await getSource(page)).toBe(SOURCE);
});

test("A-4.3 过滤跟随：输入不存在的词菜单仍开（空态）、焦点不丢、源码不变", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-slash-filter.md", SOURCE);

  const content = page.locator(".cm-callout-content").first();
  await content.click();
  const area = page.locator('[data-testid="cm-callout-editor"]');
  await expect(area).toBeVisible();
  await moveCaretToEnd(page);

  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });

  await page.keyboard.type("zz");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".mdb-slash-empty")).toHaveCount(1);
  expect(await focusInCalloutEditor(page)).toBe(true);
  expect(await getSource(page)).toBe(SOURCE);
});

test("A-4.6/A-4.4 独立片段菜单退役，高亮片段命令在统一菜单中可见", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-snippet.md", SOURCE);

  const content = page.locator(".cm-callout-content").first();
  await content.click();
  const area = page.locator('[data-testid="cm-callout-editor"]');
  await expect(area).toBeVisible();
  await moveCaretToEnd(page);

  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });

  // 独立片段菜单容器不再出现
  await expect(
    page.locator('[data-testid="cm-callout-insert-menu"]'),
  ).toHaveCount(0);
  await expect(page.locator(".cm-callout-insert-menu")).toHaveCount(0);

  // 高亮片段命令在统一菜单中可见
  await expect(
    menu.locator(".mdb-slash-item-label", { hasText: "链接" }),
  ).toHaveCount(1);
});

test("A-4.5 「+」手柄出现、点击开同一菜单（把手模式）、Esc 无残留", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-handle.md", SOURCE);

  const content = page.locator(".cm-callout-content").first();
  await expect(content).toBeVisible();
  const handle = page.locator(".cm-callout-add-handle").first();

  // 悬停内容区：手柄淡入；滑出隐藏。
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await content.hover();
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  await handle.click();
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await expect(menu).toHaveCount(1);
  const area = page.locator('[data-testid="cm-callout-editor"]');
  await expect(area).toBeVisible();

  // 把手模式菜单同样锚定 textarea（矩形距离 ≤ 8px）
  const areaBox = (await area.boundingBox())!;
  const menuBox = (await menu.boundingBox())!;
  expect(rectDistance(areaBox, menuBox)).toBeLessThanOrEqual(8);

  // Esc 关菜单；把手模式无斜杠可回滚，textarea 保持原值
  expect(await focusInCalloutEditor(page)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveCount(1);
  expect(await area.inputValue()).toBe("记得带伞");
  expect(await getSource(page)).toBe(SOURCE);
});

test("A-4.3 Esc/外点：菜单关、无 / 残留、源码逐字节不变", async ({ page }) => {
  await openCalloutDoc(page, "/tmp/co-slash-esc.md", SOURCE);

  const content = page.locator(".cm-callout-content").first();
  await content.click();
  const area = page.locator('[data-testid="cm-callout-editor"]');
  await expect(area).toBeVisible();
  await moveCaretToEnd(page);

  await page.keyboard.type("/");
  await page.keyboard.type("图");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });

  // Esc：只关菜单，输入框保留且无 / 残留
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveCount(1);
  expect(await area.inputValue()).toBe("记得带伞");
  expect(await getSource(page)).toBe(SOURCE);

  // 外点：失焦 commit 前兜底回滚，菜单关、输入框移除、源码逐字节不变
  await page.keyboard.type("/");
  await expect(menu).toBeVisible({ timeout: 3000 });
  const cardBox = (await page.locator(".cm-callout").first().boundingBox())!;
  await page.mouse.click(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height + 24,
  );
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveCount(0);
  expect(await getSource(page)).toBe(SOURCE);
});

test("A-4.2 高亮块正文选单后插入内容落进高亮块文本，其余字节不变", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-slash-insert.md", SOURCE);

  const content = page.locator(".cm-callout-content").first();
  await content.click();
  const area = page.locator('[data-testid="cm-callout-editor"]');
  await expect(area).toBeVisible();
  await moveCaretToEnd(page);

  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await expect(
    menu.locator(".mdb-slash-item-label", { hasText: "链接" }),
  ).toHaveCount(1);

  // 用片段 label 过滤到唯一行，回车选中。
  await page.keyboard.type("链接");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveValue("记得带伞[](url)");

  // 选中只写回 textarea；失焦 commit 后落文档。
  const cardBox = (await page.locator(".cm-callout").first().boundingBox())!;
  await page.mouse.click(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height + 24,
  );
  await expect(area).toHaveCount(0);
  expect(await getSource(page)).toBe(
    "> [!NOTE] 重要提醒\n> 记得带伞[](url)\n\n正文",
  );
});

test("A-4.5 「+」手柄贴内容区左缘外侧、纵向居中（D7 定位）", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-handle-position.md", SOURCE);

  const content = page.locator(".cm-callout-content").first();
  await content.hover();
  const handle = page.locator(".cm-callout-add-handle").first();
  await expect(handle).toHaveCount(1);
  const handleBox = (await handle.boundingBox())!;
  const contentBox = (await content.boundingBox())!;
  // 左缘外侧：手柄右缘 ≤ 内容区左缘 + 2
  expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(contentBox.x + 2);
  // 纵向居中：中心差 ≤ 2px
  const handleCenter = handleBox.y + handleBox.height / 2;
  const contentCenter = contentBox.y + contentBox.height / 2;
  expect(Math.abs(handleCenter - contentCenter)).toBeLessThanOrEqual(2);
});

test("#743 回归：高亮块菜单标签无重复（片段与全局命令去重）", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-dedupe.md", SOURCE);
  const content = page.locator(".cm-callout-content").first();
  await content.click();
  const area = page.locator('[data-testid="cm-callout-editor"]');
  await expect(area).toBeVisible();
  await moveCaretToEnd(page);
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  const labels = await menu.locator(".mdb-slash-item-label").allTextContents();
  expect(labels.length).toBeGreaterThan(0);
  const unique = new Set(labels);
  expect(unique.size).toBe(labels.length);
  await page.keyboard.press("Escape");
});

test("#743 D7：「+」手柄形态 16×16 / 圆角 3px / AddOutlined", async ({
  page,
}) => {
  await openCalloutDoc(page, "/tmp/co-handle-form.md", SOURCE);
  const card = page.locator(".cm-callout").first();
  await card.hover();
  const handle = page.locator(".cm-callout-add-handle").first();
  await expect(handle).toHaveCount(1);
  await expect
    .poll(() => handle.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  const style = await handle.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      width: cs.width,
      height: cs.height,
      radius: cs.borderRadius,
    };
  });
  expect(style.width).toBe("16px");
  expect(style.height).toBe("16px");
  expect(style.radius).toBe("3px");
  const icon = await handle.locator("svg").getAttribute("data-icon");
  expect(icon).toBe("AddOutlined");
});
