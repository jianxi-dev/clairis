import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * HTML 可视化编辑的文档级撤销/重做（#321 / shell-editor-batch5 4.4）。
 *
 * iframe 里没有可用的撤销栈（每次按键都已提交回主侧，原生 contenteditable
 * 的撤销在文档重建时丢失），Ctrl/Cmd+Z 由运行时转发成 undoRequest，主侧按
 * 快照回退。每次恢复都会重建 iframe，所以要重新聚焦再按下一次。
 */

const ART = path.resolve(process.cwd(), ".artifacts/321");
const MOD = process.platform === "darwin" ? "Meta" : "Control";

mkdirSync(ART, { recursive: true });

const DOC = [
  "<!DOCTYPE html><html><head><style>",
  "body{margin:0;font-family:serif}p{font-size:16px;margin:0;padding:16px}",
  "</style></head><body><h1>标题</h1><p>第一段</p></body></html>",
].join("");

async function openVisual(page: Page): Promise<FrameLocator> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/undo/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  const iframe = page.locator('iframe[title="HTML 可视化编辑"]');
  await expect(iframe).toHaveCount(1);
  return page.frameLocator('iframe[title="HTML 可视化编辑"]');
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    return (s.tabs[s.activeTabId]?.content as string) ?? "";
  });
}

/** 恢复快照会重建 iframe；重新点回段落，把键盘焦点放回 iframe 内。 */
async function refocus(frame: FrameLocator): Promise<void> {
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await expect(p).toBeVisible();
  await p.click();
}

test("HTML 可视化编辑：多步撤销与重做，且不留编辑痕迹", async ({ page }) => {
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();
  await expect(p).toHaveAttribute("contenteditable", "true");
  await page.keyboard.type("甲乙丙");
  await expect.poll(() => content(page)).toContain("甲乙丙");
  await page.screenshot({ path: path.join(ART, "06-html-three-chars.png") });

  const current = () => content(page);

  await refocus(frame);
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await current()).includes("丙")).toBe(false);
  expect(await current()).toContain("甲乙");

  await refocus(frame);
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await current()).includes("乙")).toBe(false);
  expect(await current()).toContain("甲");

  await refocus(frame);
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await current()).includes("甲")).toBe(false);
  await page.screenshot({ path: path.join(ART, "07-html-undone.png") });

  await refocus(frame);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect.poll(async () => (await current()).includes("甲")).toBe(true);

  await refocus(frame);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect.poll(async () => (await current()).includes("乙")).toBe(true);

  await refocus(frame);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect.poll(async () => (await current()).includes("丙")).toBe(true);

  const final = await current();
  expect(final).toContain("甲乙丙");
  expect(final).not.toContain("data-cm-");
  expect(final).not.toContain("contenteditable");
  await page.screenshot({ path: path.join(ART, "08-html-redone.png") });
});
