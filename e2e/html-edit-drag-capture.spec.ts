import { test, expect, type Page } from "@playwright/test";

/**
 * 拖拽移动（E-20）与区域截图（E-21）。
 *
 * 两个手势都发生在 iframe 内，所以用 `page.mouse` 在页面坐标上真拖——
 * 事件会穿透到 iframe 里的运行时。断言仍分两边：主文档看工具条与提示，
 * frameLocator 看文档，`__biaoyue_saved_binaries__` 看落盘产物。
 */

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif;min-height:600px;background:#fff}",
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
    win.__biaoyue_openFile__("/tmp/dc/doc.html", content, "doc.html");
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

test("把第二段拖到第一段之前：顺序同步到 content", async ({ page }) => {
  const frame = await openVisual(page);
  const second = await frame.locator('[data-cm-node-id="p:1"]').boundingBox();
  const first = await frame.locator('[data-cm-node-id="p:0"]').boundingBox();
  expect(second).not.toBeNull();
  expect(first).not.toBeNull();

  // 从第二段中部按下，拖到第一段上半部（落点判定用垂直中线）
  await page.waitForTimeout(300);
  await page.mouse.move(second!.x + 40, second!.y + 20);
  await page.mouse.down();
  await page.mouse.move(first!.x + 40, first!.y + 4, { steps: 10 });
  await page.mouse.up();

  // 判据自己带比较：外部先取一次 index 再当期望值，会和"内容已变"错拍
  await expect
    .poll(
      async () => {
        const html = await content(page);
        return html.indexOf("第二段") < html.indexOf("第一段");
      },
      { timeout: 10000 },
    )
    .toBe(true);

  const html = await content(page);
  expect(html).not.toContain("data-cm-");
  expect(html).not.toContain("cmid");
});

test("位移不到阈值算点击，不移动文档", async ({ page }) => {
  const frame = await openVisual(page);
  const before = await content(page);
  const second = await frame.locator('[data-cm-node-id="p:1"]').boundingBox();

  await page.mouse.move(second!.x + 40, second!.y + 20);
  await page.mouse.down();
  await page.mouse.move(second!.x + 42, second!.y + 22);
  await page.mouse.up();

  // 内容不变；点选语义仍在（高亮框出现）
  expect(await content(page)).toBe(before);
});

test("截图模式：拖出区域后产出 PNG 并落盘", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("h1").click();

  await page.locator('.html-edit-toolbar button[aria-label="截图"]').click();
  await expect(page.locator(".html-capture-hint")).toBeVisible();

  const iframe = await page
    .locator('iframe[title="HTML 可视化编辑"]')
    .boundingBox();
  expect(iframe).not.toBeNull();
  await page.mouse.move(iframe!.x + 20, iframe!.y + 20);
  await page.mouse.down();
  await page.mouse.move(iframe!.x + 320, iframe!.y + 160, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as Record<string, any>)
              .__biaoyue_saved_binaries__?.length ?? 0,
        ),
      { timeout: 20000 },
    )
    .toBe(1);

  const call = await page.evaluate(
    () =>
      (window as unknown as Record<string, any>).__biaoyue_saved_binaries__[0],
  );
  // PNG 签名（iVBORw0KGgo…）
  expect(String(call.base64).startsWith("iVBORw0KGgo")).toBe(true);
  expect(String(call.defaultName)).toContain("截图");

  // 截图不污染文档
  const html = await content(page);
  expect(html).not.toContain("data-cm-");
});
