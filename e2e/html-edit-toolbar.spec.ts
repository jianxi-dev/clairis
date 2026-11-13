import { test, expect, type Page } from "@playwright/test";

/**
 * HTML 可视化编辑工具条（E-19）。
 *
 * 工具条画在主文档（portal 到 body），选中框画在 iframe 里，所以断言分两边：
 * 控件在主文档里找，被改的文档用 frameLocator 读。
 */

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif;min-height:600px;padding-top:0}",
  "h1{font-size:32px;margin:0;padding:8px}",
  "p{font-size:16px;margin:0;padding:24px}",
  "</style></head>",
  "<body><h1>标题</h1><p>第一段</p><p>第二段</p></body></html>",
].join("");

async function openVisual(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/tb/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(1);
  return page.frameLocator('iframe[title="HTML 可视化编辑"]');
}

/** 取当前页签的 content——工具条的改动都折算到这里 */
async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const state = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    const tabs = Object.values(state.tabs) as { content: string }[];
    return tabs[0]?.content ?? "";
  });
}

const TOOLBAR = ".html-edit-toolbar";

test("改字号与对齐：元素立刻变化", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("p").first().click();

  await page.locator(`${TOOLBAR} select[aria-label=字号]`).selectOption("24px");
  await page.locator(`${TOOLBAR} button[data-align=center]`).click();

  const target = frame.locator('[data-cm-node-id="p:0"]');
  await expect(target).toHaveCSS("font-size", "24px");
  await expect(target).toHaveCSS("text-align", "center");
  await expect(
    page.locator(`${TOOLBAR} button[data-align=center]`),
  ).toHaveAttribute("aria-pressed", "true");

  const html = await content(page);
  expect(html).toContain("font-size: 24px");
  expect(html).toContain("text-align: center");
});

test("工具条不压在选中元素上", async ({ page }) => {
  const frame = await openVisual(page);
  // 页面顶部的 h1：上方放不下，工具条应当翻到它下面
  await frame.locator("h1").click();
  const toolbar = page.locator(TOOLBAR);
  await expect(toolbar).toBeVisible();

  const el = await frame.locator('[data-cm-node-id="h1:0"]').boundingBox();
  const bar = await toolbar.boundingBox();
  expect(el).not.toBeNull();
  expect(bar).not.toBeNull();
  // 不重叠：工具条要么在元素上方、要么在下方，不许压在上面
  const overlaps = bar!.y + bar!.height > el!.y && bar!.y < el!.y + el!.height;
  expect(overlaps).toBe(false);
});

test("点空白处关闭工具条", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("h1").click();
  await expect(page.locator(TOOLBAR)).toBeVisible();

  // 点 body 底部空白：运行时上报 nodeId:null
  await frame.locator("body").click({ position: { x: 400, y: 500 } });
  await expect(page.locator(TOOLBAR)).toHaveCount(0);
});

const RICH_DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif;min-height:600px;padding-top:0}",
  "h1{font-size:32px;margin:0;padding:8px}",
  "</style></head>",
  "<body>",
  "<h1>标题</h1>",
  '<p style="font-size:16px;font-family:serif">第一段</p>',
  '<div class="wrap" style="padding:24px">区块</div>',
  "</body></html>",
].join("");

async function setColor(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  // 走原生 value setter：React 在实例上装了 value 追踪器，直接赋值会被判成无变化。
  await page.locator(selector).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test.describe("HTML 工具条当前值与图标化（editor-surface-batch17 8.1）", () => {
  async function openRich(page: Page) {
    await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="pane-header"]', {
      timeout: 10000,
    });
    await page.evaluate((doc) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__("/tmp/tb/rich.html", doc, "rich.html");
      win.__biaoyue_store__.getState().setEditorMode("edit");
    }, RICH_DOC);
    await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(
      1,
    );
    return page.frameLocator('iframe[title="HTML 可视化编辑"]');
  }

  test("选中文字：背景色/字体族各 1，字号 value=16px，截图与文字标签 0", async ({
    page,
  }) => {
    const frame = await openRich(page);
    await frame.locator("p").first().click();

    const bar = page.locator(`${TOOLBAR}[data-cm-node-kind="text"]`);
    await expect(bar).toBeVisible();
    await expect(bar.locator('input[aria-label="背景色"]')).toHaveCount(1);
    await expect(bar.locator('select[aria-label="字体"]')).toHaveCount(1);
    await expect(bar.locator('select[aria-label="字体"]')).toHaveValue("serif");
    await expect(bar.locator('select[aria-label="字号"]')).toHaveValue("16px");
    await expect(bar.locator('button[aria-label="截图"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "改写", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "链", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "截图", exact: true }),
    ).toHaveCount(0);
  });

  test("选中区块改边框色：border-color 等于所选值且补 1px solid", async ({
    page,
  }) => {
    const frame = await openRich(page);
    const wrap = await frame.locator('[data-cm-node-id="div:0"]').boundingBox();
    await page.mouse.click(
      wrap!.x + wrap!.width / 2,
      wrap!.y + wrap!.height - 20,
    );

    const bar = page.locator(`${TOOLBAR}[data-cm-node-kind="block"]`);
    await expect(bar).toBeVisible();
    await expect(bar.locator('input[aria-label="边框色"]')).toHaveCount(1);
    await setColor(
      page,
      `${TOOLBAR}[data-cm-node-kind="block"] input[aria-label="边框色"]`,
      "#ff0000",
    );

    await expect(frame.locator('[data-cm-node-id="div:0"]')).toHaveCSS(
      "border-top-color",
      "rgb(255, 0, 0)",
    );
    // border-color 与 border 简写同值时，CSSOM 序列化会并入简写。
    const html = await content(page);
    expect(html).toContain("border: 1px solid");
    expect(html).toContain("rgb(255, 0, 0)");
  });

  test("取消选中：工具条无残留控件", async ({ page }) => {
    const frame = await openRich(page);
    await frame.locator("p").first().click();
    await expect(page.locator(TOOLBAR)).toBeVisible();
    await frame.locator("body").click({ position: { x: 400, y: 500 } });
    await expect(page.locator(TOOLBAR)).toHaveCount(0);
  });
});

test("工具条归属：md 编辑态无 HTML 工具条，HTML 编辑态无 CM 工具条", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]');

  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/tb/text.md",
      "# 标题\n\n一段正文",
      "text.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await expect(page.locator('[data-testid="selection-roulette"]')).toHaveCount(
    1,
  );
  await expect(page.locator(".html-edit-toolbar")).toHaveCount(0);

  const frame = await openVisual(page);
  await frame.locator("h1").click();
  await expect(page.locator(".html-edit-toolbar")).toBeVisible();
  await expect(page.locator('[data-testid="selection-roulette"]')).toHaveCount(
    0,
  );
});
