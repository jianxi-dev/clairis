import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1424";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/history.md",
      "# 标题\n\n正文。",
      "history.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
}

async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = window.__biaoyue_store__.getState();
    const tab = s.tabs[s.activeTabId];
    return tab ? tab.content : "";
  });
}

test("cmd+[ 不再触发撤销（D4 键位纠偏）", async ({ page }) => {
  await boot(page);
  await page.locator(".cm-line").nth(1).click();
  await page.keyboard.press("End");
  await page.keyboard.type("X");
  await expect.poll(() => content(page)).toContain("X");

  // Mod-[ 已交回 defaultKeymap 的缩进语义，不再撤销正文。
  const before = await content(page);
  await page.keyboard.press("Meta+[");
  await expect.poll(() => content(page)).toBe(before);
});

test("输入框聚焦时不劫持 cmd+[", async ({ page }) => {
  await boot(page);
  await page.locator(".cm-line").nth(1).click();
  await page.keyboard.press("End");
  await page.keyboard.type("Y");
  await expect.poll(() => content(page)).toContain("Y");

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "probe-input";
    document.body.appendChild(input);
    input.focus();
  });
  await page.keyboard.press("Meta+[");
  await expect.poll(() => content(page)).toContain("Y");
});

test("证据：历史四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  await page.locator(".cm-line").nth(1).click();
  await page.keyboard.press("End");
  await page.keyboard.type("X");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/typed.png` });
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/undone.png` });
  await page.keyboard.press("Meta+Shift+z");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/redone.png` });
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "probe-input-2";
    document.body.appendChild(input);
    input.focus();
  });
  await page.screenshot({ path: `${dir}/input-focused.png` });
});
