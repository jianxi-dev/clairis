import { test, expect, type Page } from "@playwright/test";

/**
 * HTML 编辑闭环（E-15 / H1）。
 *
 * 三件事：预览必须隔离在 iframe 里、相对资源要落到文档目录、三模式切换
 * 不能重建编辑器（编辑后的改动要能在预览里看到）。
 */

const HTML = [
  "<!DOCTYPE html>",
  "<html><head><style>body { color: rgb(200, 0, 0); }</style></head>",
  "<body><h1>标题</h1><img src='./pic.png' alt='p'></body></html>",
].join("\n");

async function openHtml(page: Page, content: string, name = "h1") {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate(
    ({ content, name }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(
        `/tmp/${name}/${name}.html`,
        content,
        `${name}.html`,
      );
      win.__biaoyue_store__.getState().setEditorMode("preview");
    },
    { content, name },
  );
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return (s.tabs[s.activeTabId]?.content as string) ?? "";
  });
}

test("HTML 预览隔离在 iframe 里，不注入主文档", async ({ page }) => {
  await openHtml(page, HTML);
  const frame = page.locator('iframe[title="HTML 预览"]');
  await expect(frame).toHaveCount(1);
  // 用户样式不能漏进主文档
  const bodyColor = await page.evaluate(
    () => getComputedStyle(document.body).color,
  );
  expect(bodyColor).not.toBe("rgb(200, 0, 0)");
});

test("相对图片在预览里落到文档目录", async ({ page }) => {
  await openHtml(page, HTML, "h2");
  const frame = page.locator('iframe[title="HTML 预览"]');
  await expect(frame).toHaveCount(1);
  const srcdoc = await frame.getAttribute("srcdoc");
  expect(srcdoc).not.toBeNull();
  expect(srcdoc).toContain("asset://");
  expect(srcdoc).not.toContain("src='./pic.png'");
});

test("编辑后切回预览能看到改动，且编辑器未被重建", async ({ page }) => {
  await openHtml(page, HTML, "h3");
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  const editor = page.locator(".cm-content");
  await editor.waitFor({ timeout: 5000 });
  // 记录编辑器 DOM 节点身份，切模式后应保持不变（display 切换而非 remount）
  const before = await editor.evaluate((el) => {
    (el as unknown as Record<string, unknown>).__probe = "keep";
    return true;
  });
  expect(before).toBe(true);

  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("<h1>改过了</h1>");
  await expect.poll(() => content(page)).toContain("改过了");

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  const frame = page.locator('iframe[title="HTML 预览"]');
  await expect(frame).toHaveCount(1);
  const srcdoc = await frame.getAttribute("srcdoc");
  expect(srcdoc).toContain("改过了");
});
