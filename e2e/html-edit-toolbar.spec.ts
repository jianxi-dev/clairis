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

test("点选元素后出现工具条，标签显示的是真值", async ({ page }) => {
  const frame = await openVisual(page);
  await expect(page.locator(TOOLBAR)).toHaveCount(0);

  await frame.locator("h1").click();
  const toolbar = page.locator(TOOLBAR);
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator("select[aria-label=标签]")).toHaveValue("h1");
});

test("换标签：渲染与 content 同步，工具条保持选中", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("h1").click();
  await page.locator(`${TOOLBAR} select[aria-label=标签]`).selectOption("h3");

  // 渲染层换掉了
  await expect(frame.locator("h3")).toHaveCount(1);
  await expect(frame.locator("h1")).toHaveCount(0);
  await expect(frame.locator("h3")).toContainText("标题");

  // content 里也是 h3，且没有编辑期痕迹
  const html = await content(page);
  expect(html).toContain("<h3>标题</h3>");
  expect(html).not.toContain("data-cm-");
  expect(html).not.toContain("cmid");

  // 工具条没有因为 id 变化而消失
  await expect(
    page.locator(TOOLBAR).locator("select[aria-label=标签]"),
  ).toHaveValue("h3");
});

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

test("class 写入后元素带上，清空后属性整条消失", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("p").first().click();

  const input = page.locator(`${TOOLBAR} input[aria-label=class]`);
  await input.fill("lead");
  await input.press("Tab");

  await expect(frame.locator('[data-cm-node-id="p:0"]')).toHaveAttribute(
    "class",
    "lead",
  );

  await input.fill("");
  await input.press("Tab");

  const html = await content(page);
  expect(html).not.toContain('class="lead"');
  // 清空即删除，不许留 class=""
  expect(html).not.toContain('class=""');
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
