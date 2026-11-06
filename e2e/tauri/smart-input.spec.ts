import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

async function storeContent(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const tab = state.tabs[state.activeTabId];
    return (tab?.content as string) ?? "";
  });
}

test("行首输入 - 后自动成为列表（源码出现标记）", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__biaoyue_openFile__(
      "/Users/test/smart.md",
      "正文",
      "smart.md",
    );
  });
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const content = page.locator(".cm-content");
  await content.click();
  await page.keyboard.press("Meta+ArrowUp");
  await page.keyboard.type("- ");
  await page.keyboard.type("项");

  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toContain("- 项");
});

test("行首输入 # 后成为标题（源码出现 #）", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__biaoyue_openFile__(
      "/Users/test/smart2.md",
      "正文",
      "smart2.md",
    );
  });
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const content = page.locator(".cm-content");
  await content.click();
  await page.keyboard.press("Meta+ArrowUp");
  await page.keyboard.type("# ");
  await page.keyboard.type("标题");

  await expect
    .poll(() => storeContent(page), { timeout: 5000 })
    .toContain("# 标题");
});
