import { test, expect, type Page } from "@playwright/test";

/**
 * 工具条按节点类型分化（E-22）。
 *
 * 文本块给排版操作（字号 / 粗体 / 斜体 / 下划线 / 删除线 / 对齐 / 文字色），
 * 区块容器给容器操作（对齐 / 背景 / 边框）。两套都带 class/id、截图、删除。
 */

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif;min-height:600px}",
  "h1{font-size:32px;margin:0;padding:8px}",
  "p{font-size:16px;margin:0;padding:24px}",
  ".wrap{padding:24px 24px 160px}",
  "</style></head>",
  "<body><div class='wrap'><h1>标题</h1><p>第一段</p></div></body></html>",
].join("");

async function openVisual(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/kind/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(1);
  return page.frameLocator('iframe[title="HTML 可视化编辑"]');
}

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

test("选中段落：给文字排版控件，不给背景/边框", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("p").first().click();

  const bar = page.locator(`${TOOLBAR}[data-cm-node-kind="text"]`);
  await expect(bar).toBeVisible();
  await expect(bar.locator('button[aria-label="粗体"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="斜体"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="下划线"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="删除线"]')).toBeVisible();
  await expect(bar.locator('select[aria-label="字号"]')).toBeVisible();
  await expect(bar.locator('input[aria-label="文字颜色"]')).toBeVisible();

  await expect(bar.locator('input[aria-label="背景色"]')).toHaveCount(0);
  await expect(bar.locator('button[aria-label="边框"]')).toHaveCount(0);
});

test("选中容器：给背景/边框控件，不给粗斜体", async ({ page }) => {
  const frame = await openVisual(page);
  // 点 .wrap 底部留白（那里命中容器本身，不会落到子元素上）
  const wrap = await frame.locator('[data-cm-node-id="div:0"]').boundingBox();
  await page.mouse.click(
    wrap!.x + wrap!.width / 2,
    wrap!.y + wrap!.height - 20,
  );

  const bar = page.locator(`${TOOLBAR}[data-cm-node-kind="block"]`);
  await expect(bar).toBeVisible();
  await expect(bar.locator('input[aria-label="背景色"]')).toBeVisible();
  await expect(bar.locator('button[aria-label="边框"]')).toBeVisible();

  await expect(bar.locator('button[aria-label="粗体"]')).toHaveCount(0);
  await expect(bar.locator('select[aria-label="字号"]')).toHaveCount(0);
});

test("粗体可开可关，改动进 content", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("p").first().click();

  const bold = page.locator(`${TOOLBAR} button[aria-label="粗体"]`);
  await bold.click();
  await expect(frame.locator('[data-cm-node-id="p:0"]')).toHaveCSS(
    "font-weight",
    "700",
  );
  await expect(bold).toHaveAttribute("aria-pressed", "true");

  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  expect(await content(page)).not.toContain("font-weight");
});

test("下划线与删除线可以同时存在", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("p").first().click();

  await page.locator(`${TOOLBAR} button[aria-label="下划线"]`).click();
  await page.locator(`${TOOLBAR} button[aria-label="删除线"]`).click();

  const html = await content(page);
  expect(html).toContain("underline");
  expect(html).toContain("line-through");

  const deco = await frame
    .locator('[data-cm-node-id="p:0"]')
    .evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(deco).toContain("underline");
  expect(deco).toContain("line-through");
});

test("区块加边框后真正画出来", async ({ page }) => {
  const frame = await openVisual(page);
  const wrap = await frame.locator('[data-cm-node-id="div:0"]').boundingBox();
  await page.mouse.click(
    wrap!.x + wrap!.width / 2,
    wrap!.y + wrap!.height - 20,
  );

  const border = page.locator(`${TOOLBAR} button[aria-label="边框"]`);
  await border.click();
  await expect(border).toHaveAttribute("aria-pressed", "true");

  const width = await frame
    .locator('[data-cm-node-id="div:0"]')
    .evaluate((el) => getComputedStyle(el).borderTopWidth);
  expect(width).toBe("1px");
  expect(await content(page)).toContain("border");
});

test("删除元素：渲染层与 content 同步消失", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("p").first().click();

  await page.locator(`${TOOLBAR} button[aria-label="删除元素"]`).click();

  await expect(frame.locator("p")).toHaveCount(0);
  await expect(page.locator(TOOLBAR)).toHaveCount(0);
  const html = await content(page);
  expect(html).not.toContain("第一段");
  expect(html).not.toContain("data-cm-");
});
