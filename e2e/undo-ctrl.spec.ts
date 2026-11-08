import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function bootAndEdit(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/undo.md", "# 标题\n\n原始内容\n", "undo");
  });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.locator('[data-testid="pane-mode"]').click();
  await page.locator(".cm-content").click();
  await page.keyboard.type("追加");
}

async function text(page: Page): Promise<string> {
  return page.locator(".cm-content").innerText();
}

test.describe("撤销重做支持 Ctrl 与 Cmd（ui-polish-batch6 17.1）", () => {
  test("Control+z 与 Meta+z 都能撤销，Control+Shift+z 重做", async ({
    page,
  }) => {
    await bootAndEdit(page);
    const typed = await text(page);
    expect(typed).toContain("追加");

    await page.keyboard.press("Control+z");
    const afterCtrl = await text(page);
    expect(afterCtrl).not.toContain("追加");

    await page.keyboard.press("Meta+z");
    const afterMeta = await text(page);
    expect(afterMeta).toBe(afterCtrl);

    await page.keyboard.press("Control+Shift+z");
    expect(await text(page)).toContain("追加");
  });
});
