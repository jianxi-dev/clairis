import { test, expect, type Page } from "@playwright/test";

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif}div{padding:16px;border:1px solid #ddd}",
  "</style></head><body><div>区块内容</div></body></html>",
].join("");

async function openVisual(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/rz/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(1);
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    return (s.tabs[s.activeTabId]?.content as string) ?? "";
  });
}

test("选中区块后拖右下角手柄调整宽高", async ({ page }) => {
  await openVisual(page);
  const frame = page.frameLocator('iframe[title="HTML 可视化编辑"]');
  await frame.locator("div").first().click();

  const handle = page.locator('[data-testid="html-resize-se"]');
  await expect(handle).toHaveCount(1);
  const box = await handle.boundingBox();
  if (!box) throw new Error("手柄不可测量");
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + 74, box.y + 54, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => content(page)).toMatch(/width:\s*\d+px/);
  const next = await content(page);
  expect(next).toMatch(/height:\s*\d+px/);
  expect(next).not.toContain("data-cm-");
});
