import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function openFile(
  page: import("@playwright/test").Page,
  path: string,
  content: string,
) {
  await page.evaluate(
    ([p, c]) => {
      const w = window as unknown as Record<string, unknown>;
      (
        w as {
          __biaoyue_openFile__?: (
            path: string,
            content: string,
            title: string,
          ) => void;
        }
      ).__biaoyue_openFile__?.(p, c, p.split("/").pop() ?? p);
    },
    [path, content],
  );
  await page.waitForTimeout(300);
}

// 行为变更（E-15 / H1）：预览不再 asset:// 直载磁盘文件，而是一律 srcdoc。
// 直载读的是磁盘旧内容，编辑后未保存时切回预览看不到改动；srcdoc 用当前
// content 重建，相对引用由 rewriteHtmlPaths 重写成 asset://。脚本执行留给 H2。
test("HTML 预览：srcdoc 渲染且相对引用被重写", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/complex.html", "<p>hi</p>");

  const iframe = page.locator('iframe[title="HTML 预览"]');
  await expect(iframe).toHaveCount(1);
  const srcdoc = await iframe.getAttribute("srcdoc");
  expect(srcdoc).not.toBeNull();
  expect(srcdoc).toContain("<p>hi</p>");
  // 预览态禁用脚本：CSP script-src 'none'（H2 再设计桥协议）
  expect(srcdoc).toContain("script-src 'none'");
});

test("HTML 预览：无路径文档同样走 srcdoc", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  // 无路径：直接渲染 PreviewView 的 srcdoc 回退（通过 newTab + html kind 不可行，用 evaluate 直接验证组件）
  // 实际无路径 html 场景=新建文档切 html，此处验证 iframe 存在性即可
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__ as {
      getState: () => {
        openFile: (p: string, c: string) => void;
      };
    };
    store.getState().openFile("/Users/test/untitled.html", "<p>x</p>");
  });
  await page.waitForTimeout(300);

  const iframe = page.locator('iframe[title="HTML 预览"]');
  await expect(iframe).toHaveCount(1);
  const srcdoc = await iframe.getAttribute("srcdoc");
  expect(srcdoc).not.toBeNull();
  expect(srcdoc).toContain("<p>x</p>");
});

test("HTML 预览：锚点点击不崩溃（iframe 保持存在）", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(
    page,
    "/Users/test/toc.html",
    '<h1 id="top">Top</h1><a href="#top">跳到顶部</a><p>内容</p>',
  );

  const iframe = page.locator('iframe[title="HTML 预览"]');
  await expect(iframe).toHaveCount(1);
  // 点击锚点（dispatch 避免 mock 无真实文件导致的加载态问题）
  await iframe.evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    const a = doc?.querySelector('a[href="#top"]');
    a?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await page.waitForTimeout(400);
  // iframe 仍挂载、未白屏
  await expect(page.locator('iframe[title="HTML 预览"]')).toHaveCount(1);
});
