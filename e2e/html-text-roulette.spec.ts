import { test, expect, type Page } from "@playwright/test";

/**
 * HTML 可视化编辑的文字选区工具条（第十批）。
 *
 * 选中文字 → 横向文字工具条；单击元素 → 同款横向工具条（节点模式）。
 */

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif}p{font-size:16px;margin:0;padding:24px}",
  "</style></head><body><p>第一段文字</p><p>第二段</p></body></html>",
].join("");

async function openVisual(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/hr/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  const frame = page.frameLocator('iframe[title="HTML 可视化编辑"]');
  await expect(frame.locator("p").first()).toBeVisible();
  return frame;
}

async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const state = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    return (Object.values(state.tabs)[0] as { content: string }).content;
  });
}

/** 在 iframe 内选中第一段的文字（等价于拖选，避免 dblclick 进入编辑态）。 */
async function selectText(frame: ReturnType<Page["frameLocator"]>) {
  await frame
    .locator("p")
    .first()
    .evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = getSelection();
      if (!sel) throw new Error("no selection");
      sel.removeAllRanges();
      sel.addRange(range);
    });
}

const WHEEL = '[data-testid="selection-roulette"]';
const TOOLBAR = ".html-edit-toolbar";

test("选中文字出现横向文字工具条，轮盘不出现", async ({ page }) => {
  const frame = await openVisual(page);
  await selectText(frame);
  const bar = page.locator(`${TOOLBAR}[data-cm-range-toolbar="true"]`);
  await expect(bar).toBeVisible({ timeout: 3000 });
  await expect(bar.locator('button[aria-label="粗体"]')).toBeVisible();
  await expect(bar.locator('select[aria-label="字号"]')).toBeVisible();
  await expect(page.locator(WHEEL)).toHaveCount(0);
});

test("文字工具条加粗只作用于选区并写回 content", async ({ page }) => {
  const frame = await openVisual(page);
  await selectText(frame);
  await page.locator(`${TOOLBAR} button[aria-label="粗体"]`).click();
  await expect.poll(() => content(page)).toMatch(/font-weight:\s*bold|<b>/i);
  await expect(
    page.locator(`${TOOLBAR}[data-cm-range-toolbar="true"]`),
  ).toBeVisible();
});

test("单击元素仍是元素工具条，不弹轮盘", async ({ page }) => {
  const frame = await openVisual(page);
  await frame.locator("p").first().click();
  await expect(page.locator(TOOLBAR)).toBeVisible();
  await expect(page.locator(WHEEL)).toHaveCount(0);
});
