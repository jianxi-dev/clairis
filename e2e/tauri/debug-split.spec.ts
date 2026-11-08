import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test("DEBUG: split panels — capture pageerror + console", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  console.log("✅ header visible after setup");

  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__(
      "/Users/test/文件A.md",
      "# 文件A\n\n这是第一个文件的内容。\n\n## A的第二节\n\n文件A特有内容。",
      "文件A.md",
    );
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/Users/test/文件B.md",
      "# 文件B\n\n这是第二个文件的内容，完全不同。\n\n## B的第二节\n\n文件B特有内容。",
      "文件B.md",
    );
  });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const tabs = store.getState().tabs;
    const tabB = Object.values(tabs).find(
      (t: any) => t.title === "文件B.md",
    ) as any;
    if (tabB) store.getState().splitTab(tabB.id, "horizontal");
  });
  await page.waitForTimeout(500);

  const body = await page.locator("body").innerHTML();
  console.log("DEBUG body length:", body.length);
  console.log("DEBUG body head:", body.slice(0, 300));
  console.log("DEBUG pageErrors:", JSON.stringify(pageErrors, null, 2));
  console.log("DEBUG consoleErrors:", JSON.stringify(consoleErrors, null, 2));

  // 断言失败也打印，但先看日志
  expect(pageErrors).toHaveLength(0);
});
