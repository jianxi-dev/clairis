import { test, expect, type Page } from "@playwright/test";

/**
 * 点选与高亮框（E-16 切片 3 / 票 164）。
 *
 * 框画在 iframe 里面（跨源，主文档画不上去），所以断言必须进 frame 取
 * 计算样式与几何，而不是在主文档里找节点。
 */

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif;min-height:600px}",
  "h1{font-size:32px;margin:0;padding:8px}",
  "p{font-size:16px;margin:0;padding:24px}",
  "</style></head>",
  "<body><h1>标题</h1><p>第一段</p><p>第二段</p></body></html>",
].join("");

async function openVisual(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/sel/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  const iframe = page.locator('iframe[title="HTML 可视化编辑"]');
  await expect(iframe).toHaveCount(1);
  return page.frameLocator('iframe[title="HTML 可视化编辑"]');
}

const HL = '[data-cm-internal="highlight"]';

test("点选元素后高亮框出现，且框住的就是它", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("h1").click();

  const box = frame.locator(HL);
  await expect(box).toBeVisible();
  await expect(box).toHaveAttribute("data-cm-hl-for", "h1:0");

  // 断言几何：框与元素基本重合（2px 内）。
  // 注意不能从主文档取 contentDocument —— 沙箱 iframe 是跨源，恒为 null，
  // 那样断言就会静默跳过（这条一开始就写错过）。用 frame 内的 boundingBox 比。
  const elBox = await frame.locator('[data-cm-node-id="h1:0"]').boundingBox();
  const hlBox = await box.boundingBox();
  expect(elBox).not.toBeNull();
  expect(hlBox).not.toBeNull();
  expect(Math.abs((elBox?.x ?? 0) - (hlBox?.x ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((elBox?.y ?? 0) - (hlBox?.y ?? 0))).toBeLessThanOrEqual(2);
  const border = await box.evaluate(
    (el) => getComputedStyle(el).borderTopWidth,
  );
  expect(border).toBe("2px");
});

test("换选另一个元素，框跟着走且旧位置不留残影", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("h1").click();
  const box = frame.locator(HL);
  await expect(box).toHaveAttribute("data-cm-hl-for", "h1:0");

  const before = await box.boundingBox();
  await frame.locator("p").first().click();
  await expect(box).toHaveAttribute("data-cm-hl-for", "p:0");

  // 框跟着换了位置：只断言 count(1) 是恒真的（框是单一复用节点），证明不了任何事
  const after = await box.boundingBox();
  expect(after?.y ?? 0).not.toBe(before?.y ?? 0);
  await expect(frame.locator(HL)).toHaveCount(1);
});

test("点空白处高亮消失", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("h1").click();
  await expect(frame.locator(HL)).toBeVisible();

  // 点 html/body 等于点空白：运行时上报 nodeId:null，高亮应当清掉
  await frame.locator("body").click({ position: { x: 5, y: 500 } });
  await expect(frame.locator(HL)).toBeHidden();
});
