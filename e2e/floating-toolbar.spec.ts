import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/370");
mkdirSync(ART, { recursive: true });
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

const TEXT_ACTIONS = [
  "rewrite",
  "translate",
  "polish",
  "font-size",
  "toggle-bold",
  "toggle-italic",
  "toggle-underline",
  "toggle-strikethrough",
  "toggle-link",
  "align",
  "color",
  "delete",
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/floating-toolbar.md",
      body,
      "floating-toolbar.md",
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

async function openDoc(page: Page, path: string, body: string): Promise<void> {
  await page.evaluate(
    ({ p, b }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(p, b, p.split("/").pop());
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { p: path, b: body },
  );
  await page.locator(".cm-content").waitFor({ timeout: 5000 });
}

async function dragSelectLine(page: Page, lineIndex: number): Promise<void> {
  const line = page.locator(".cm-line").nth(lineIndex);
  const box = (await line.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(box.width - 3, 60), y, { steps: 6 });
  await page.mouse.up();
}

async function selectLine(page: Page, lineIndex: number): Promise<void> {
  await dragSelectLine(page, lineIndex);
  await expect(page.locator('[data-testid="floating-toolbar"]')).toBeVisible({
    timeout: 3000,
  });
}

test("选中文字出现文字工具条，控件集合恰为 md-bundle 12 项", async ({
  page,
}) => {
  await selectLine(page, 2);

  const toolbar = page.locator('[data-testid="floating-toolbar"]');
  const actions = toolbar.locator("[data-action]");
  await expect(actions).toHaveCount(12);

  const names = await actions.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-action")),
  );
  expect(names).toEqual(TEXT_ACTIONS);
});

test("文字工具条每个控件都是图标按钮（SVG）", async ({ page }) => {
  await selectLine(page, 2);

  const buttons = page.locator(
    '[data-testid="floating-toolbar"] > [data-action] button.cm-toolbar-btn, [data-testid="floating-toolbar"] > button.cm-toolbar-btn',
  );
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(buttons.nth(i).locator("svg")).toHaveCount(1);
  }
});

test("字号控件显示当前值", async ({ page }) => {
  await selectLine(page, 2);

  const value = page.locator(".cm-toolbar-font-size-value");
  await expect(value).toBeVisible();
  expect(Number(await value.textContent())).toBeGreaterThan(0);
});

test("字号控件改字号并显示新值", async ({ page }) => {
  await selectLine(page, 2);

  const value = page.locator(".cm-toolbar-font-size-value");
  const before = Number(await value.textContent());

  await page.locator('[data-action="font-size"]').hover();
  await page.locator('[data-option="font-size-24"]').click();

  await expect
    .poll(async () => Number(await value.textContent()))
    .not.toBe(before);
  expect(Number(await value.textContent())).toBe(24);
});

const AI_ACTIONS: ReadonlyArray<readonly [string, string]> = [
  ["rewrite", "改写"],
  ["translate", "翻译"],
  ["polish", "润色"],
];

for (const [action, keyword] of AI_ACTIONS) {
  test(`${keyword}打开 AI 浮层，指令与选区文本都预填`, async ({ page }) => {
    await selectLine(page, 2);
    const selected = await page.evaluate(
      () => window.getSelection()?.toString() ?? "",
    );
    expect(selected.length).toBeGreaterThan(0);

    await page
      .locator(`[data-testid="floating-toolbar"] [data-action="${action}"]`)
      .click();

    await expect(page.locator("[data-ai-overlay]")).toBeVisible();
    const inputValue = await page.locator("[data-ai-input]").inputValue();
    expect(inputValue).toContain(keyword);
    expect(inputValue).toContain(selected.slice(0, 4));
    await page.screenshot({
      path: path.join(
        ART,
        `0${2 + AI_ACTIONS.findIndex(([a]) => a === action)}-${action}.png`,
      ),
    });
  });
}

test("md 工具条里没有任何 html 专属按钮", async ({ page }) => {
  await selectLine(page, 2);

  const toolbar = page.locator('[data-testid="floating-toolbar"]');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator(".html-edit-toolbar__btn")).toHaveCount(0);
  await expect(toolbar.locator(".html-edit-toolbar")).toHaveCount(0);
  await page.screenshot({ path: path.join(ART, "01-md-toolbar.png") });
});

test("加粗作用于选区，未选中部分不受影响", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-action="toggle-bold"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n**第一段**正文\n\n第二段正文\n");
});

test("斜体作用于选区", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-action="toggle-italic"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n*第一段*正文\n\n第二段正文\n");
});

test("下划线作用于选区", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-action="toggle-underline"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n<u>第一段</u>正文\n\n第二段正文\n");
});

test("删除线作用于选区", async ({ page }) => {
  await selectLine(page, 2);
  await page.locator('[data-action="toggle-strikethrough"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n~~第一段~~正文\n\n第二段正文\n");
});

test("文字颜色把选区包进 mdb-color-*", async ({ page }) => {
  await selectLine(page, 2);

  await page.locator('[data-action="color"]').hover();
  await page
    .locator(
      '[data-testid="color-swatch-font"][data-class-name="mdb-color-red"]',
    )
    .click();

  await expect
    .poll(() => storeContent(page))
    .toBe(
      '# 标题\n\n<span class="mdb-color-red">第一段</span>正文\n\n第二段正文\n',
    );
});

test("对齐作用于整个块（Pandoc 围栏 div）", async ({ page }) => {
  await selectLine(page, 2);

  await page.locator('[data-action="align"]').hover();
  await page.locator('[data-option="align-center"]').click();

  await expect
    .poll(() => storeContent(page))
    .toBe("# 标题\n\n::: {.align-center}\n第一段正文\n:::\n\n第二段正文\n");
});

test("对齐可取消：再次应用同一对齐拆掉包裹", async ({ page }) => {
  await openDoc(
    page,
    "/tmp/floating-toolbar-align.md",
    "# 标题\n\n::: {.align-center}\n第一段正文\n:::\n\n第二段正文\n",
  );

  await selectLine(page, 2);
  await page.locator('[data-action="align"]').hover();
  await page.locator('[data-option="align-center"]').click();

  await expect.poll(() => storeContent(page)).toBe(DOC);
});

test("删除作用于整个块", async ({ page }) => {
  await selectLine(page, 2);

  await page
    .locator('[data-testid="floating-toolbar"] [data-action="delete"]')
    .click();

  await expect.poll(() => storeContent(page)).toBe("# 标题\n\n第二段正文\n");
});

test("取消选区后工具条消失", async ({ page }) => {
  await selectLine(page, 2);
  await expect(page.locator('[data-testid="floating-toolbar"]')).toBeVisible();

  await page.locator(".cm-line").nth(0).click();
  await expect(page.locator('[data-testid="floating-toolbar"]')).toBeHidden();
});

const HTML_DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif;min-height:600px}",
  "h1{font-size:32px;margin:0;padding:8px}",
  "</style></head><body><h1>标题</h1></body></html>",
].join("");

test("切到 html 编辑态只留 html 工具条，md 浮动条不残留", async ({ page }) => {
  // 先在 markdown 编辑态把浮动条装出来，再切 html 页签——这条路径正是
  // 装饰隔层不跟随 fileKind 时漏出双条的地方。
  await selectLine(page, 2);
  await expect(page.locator('[data-testid="floating-toolbar"]')).toBeVisible();

  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/tb/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, HTML_DOC);

  const frame = page.frameLocator('iframe[title="HTML 可视化编辑"]');
  await frame.locator("h1").click();

  await expect(page.locator(".html-edit-toolbar")).toBeVisible();
  await expect(page.locator('[data-testid="floating-toolbar"]')).toHaveCount(0);
  await page.screenshot({ path: path.join(ART, "05-html-only.png") });
});
