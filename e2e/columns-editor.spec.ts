import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 打开一个 markdown 页签、切到编辑模式，光标停在文末正文（分栏块非活跃）。 */
async function openColumnsDoc(page: Page, path: string, content: string) {
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

/** 焦点仍在分栏内容区输入框。 */
async function focusInEditorArea(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    return (
      el instanceof HTMLElement && el.dataset.testid === "cm-column-editor"
    );
  });
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

test("A-4.1 分栏内容区输入 / 打开斜杠菜单：锚定 textarea、焦点保持、源码不变", async ({
  page,
}) => {
  const source = "::: {.col-2}\n\n左\n\n右\n\n:::";
  await openColumnsDoc(page, "/tmp/col-slash-open.md", source);

  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await expect(body).toBeVisible();
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();
  await expect(area).toHaveValue("左");

  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await expect(menu).toHaveCount(1);

  // 菜单锚定 textarea 矩形（矩形距离 ≤ 8px）
  const areaBox = (await area.boundingBox())!;
  const menuBox = (await menu.boundingBox())!;
  expect(rectDistance(areaBox, menuBox)).toBeLessThanOrEqual(8);

  // 焦点仍在 textarea；过滤词活在 textarea 里，源码逐字节不变
  expect(await focusInEditorArea(page)).toBe(true);
  expect(await getSource(page)).toBe(source);
});

test("A-4.1 过滤跟随：输入不存在的词菜单仍开（空态）、焦点不丢、源码不变", async ({
  page,
}) => {
  const source = "::: {.col-2}\n\n左\n\n右\n\n:::";
  await openColumnsDoc(page, "/tmp/col-slash-filter.md", source);

  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();

  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });

  await page.keyboard.type("zz");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".mdb-slash-empty")).toHaveCount(1);
  expect(await focusInEditorArea(page)).toBe(true);
  expect(await getSource(page)).toBe(source);
});

test("A-4.2/A-4.5 「+」手柄出现、点击开同一菜单（把手模式）、Esc 无残留", async ({
  page,
}) => {
  const source = "::: {.col-2}\n\n左\n\n右\n\n:::";
  await openColumnsDoc(page, "/tmp/col-handle.md", source);

  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await expect(body).toBeVisible();
  const handle = page.locator(".cm-columns-add-handle").first();

  // 悬停内容区：手柄淡入；滑出隐藏。
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await body.hover();
  expect(await handle.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  await handle.click();
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await expect(menu).toHaveCount(1);
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();

  // 把手模式菜单同样锚定 textarea（矩形距离 ≤ 8px）
  const areaBox = (await area.boundingBox())!;
  const menuBox = (await menu.boundingBox())!;
  expect(rectDistance(areaBox, menuBox)).toBeLessThanOrEqual(8);

  // Esc 关菜单；把手模式无斜杠可回滚，textarea 保持原值
  expect(await focusInEditorArea(page)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveCount(1);
  expect(await area.inputValue()).toBe("左");
  expect(await getSource(page)).toBe(source);
});

test("A-4.3 Esc/外点：菜单关、无 / 残留、源码逐字节不变", async ({ page }) => {
  const source = "::: {.col-2}\n\n左\n\n右\n\n:::\n\n正文";
  await openColumnsDoc(page, "/tmp/col-slash-esc.md", source);

  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();

  await page.keyboard.type("/");
  await page.keyboard.type("图");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });

  // Esc：只关菜单，输入框保留且无 / 残留
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveCount(1);
  expect(await area.inputValue()).toBe("左");
  expect(await getSource(page)).toBe(source);

  // 外点：失焦 commit 前兜底回滚，菜单关、输入框移除、源码逐字节不变
  await page.keyboard.type("/");
  await expect(menu).toBeVisible({ timeout: 3000 });
  const columnsBox = (await page
    .locator('[data-testid="cm-columns"]')
    .first()
    .boundingBox())!;
  await page.mouse.click(
    columnsBox.x + columnsBox.width / 2,
    columnsBox.y + columnsBox.height + 24,
  );
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveCount(0);
  expect(await getSource(page)).toBe(source);
});

test("A-4.2 分栏内容区选单后插入内容落进分栏文本，其余字节不变", async ({
  page,
}) => {
  // 片段注入必须在应用加载前（编辑器创建时读取 list_extensions）。
  await page.addInitScript(() => {
    (
      window as unknown as { __biaoyue_extensions__?: unknown }
    ).__biaoyue_extensions__ = {
      snippets: [
        {
          id: "t-snippet",
          label: "测试片段",
          keywords: [],
          body: "SNIPPET-X",
        },
      ],
      templates: [],
      theme: { tokens: {}, warnings: [] },
      warnings: [],
    };
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 10000,
  });

  const source = "::: {.col-2}\n\n左\n\n右\n\n:::";
  await openColumnsDoc(page, "/tmp/col-slash-insert.md", source);
  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();

  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible({ timeout: 3000 });
  await expect(menu.locator("text=测试片段")).toHaveCount(1);

  // 用片段 code 过滤到唯一行，回车选中（首行是「标题」父行，不过滤会开浮层）。
  await page.keyboard.type("t-snippet");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(area).toHaveValue("左SNIPPET-X");

  // 选中只写回 textarea；再按 Enter 经 commit 路径落文档。
  await page.keyboard.press("Enter");
  await expect(area).toHaveCount(0);

  expect(await getSource(page)).toBe(
    "::: {.col-2}\n\n左SNIPPET-X\n\n右\n\n:::",
  );
});

test("#742 回归：分栏菜单选「表格」不走主文档 dispatch（数据不损坏）", async ({
  page,
}) => {
  const source = "::: {.col-2}\n\n左\n\n右\n\n:::\n\n正文段落";
  await openColumnsDoc(page, "/tmp/col-grid-guard.md", source);
  const firstBody = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await firstBody.click();
  const area = page.locator(".cm-column-editor");
  await area.waitFor({ state: "visible", timeout: 5000 });
  await area.click();
  // /t3 = 表格 3 列（TABLE_SIZE_QUERY 直达 applyTableSize——被修的函数）
  await page.keyboard.type("/t3");
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({ timeout: 3000 });
  await page.keyboard.press("Enter");
  // 关键断言 1：菜单关闭前主文档未被 dispatch 吞掉（前缀仍在）
  const afterApply = await getSource(page);
  expect(afterApply.startsWith("::: {.col-2}")).toBe(true);
  expect(afterApply).toContain("正文段落");
  // 关键断言 2：表格落进 textarea（context 写回），提交后进入分栏体
  const areaValue = await area.inputValue();
  expect(areaValue).toContain("|");
  await page.keyboard.press("Enter");
  const committed = await getSource(page);
  expect(committed.startsWith("::: {.col-2}")).toBe(true);
  expect(committed).toContain("正文段落");
});

test("#742 回归：菜单开着时点「+」不把 /query 漏进文档（复用回滚）", async ({
  page,
}) => {
  const source = "::: {.col-2}\n\n左\n\n右\n\n:::";
  await openColumnsDoc(page, "/tmp/col-reuse-rollback.md", source);
  const firstBody = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await firstBody.click();
  const area = page.locator(".cm-column-editor");
  await area.waitFor({ state: "visible", timeout: 5000 });
  await area.click();
  await page.keyboard.type("/abc");
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({ timeout: 3000 });
  // 菜单开着时点「+」手柄（复用路径）
  const handle = page.locator(".cm-columns-add-handle").first();
  await handle.click({ force: true });
  await expect(page.locator(".mdb-slash-menu")).toBeVisible({ timeout: 3000 });
  // Esc 关菜单，Enter 提交 → 文档里不得出现 /abc
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  const after = await getSource(page);
  expect(after).not.toContain("/abc");
  expect(after.startsWith("::: {.col-2}")).toBe(true);
});

test("#742 A-4.5：「+」手柄贴内容区左缘外侧、纵向居中（D7 定位）", async ({
  page,
}) => {
  const source = "::: {.col-2}\n\n左栏\n\n右栏\n\n:::";
  await openColumnsDoc(page, "/tmp/col-handle-position.md", source);
  const columns = page.locator(".cm-columns");
  await columns.hover();
  const handle = page.locator(".cm-columns-add-handle").first();
  await expect(handle).toHaveCount(1);
  const handleBox = (await handle.boundingBox())!;
  const body = page.locator('.cm-column[data-col="0"] .cm-column-body').first();
  const bodyBox = (await body.boundingBox())!;
  // 左缘外侧：手柄右缘 ≤ 内容区左缘 + 2
  expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(bodyBox.x + 2);
  // 纵向居中：中心差 ≤ 2px
  const handleCenter = handleBox.y + handleBox.height / 2;
  const bodyCenter = bodyBox.y + bodyBox.height / 2;
  expect(Math.abs(handleCenter - bodyCenter)).toBeLessThanOrEqual(2);
});
