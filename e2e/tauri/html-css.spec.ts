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

// 已保存且未编辑：asset 直载（脚本/相对路径由文档自身解析，A-3）；
// 未保存改动：回退 srcdoc，相对引用由 rewriteHtmlPaths 重写，脚本被 CSP 禁掉。
test("HTML 预览：已保存文件 asset 直载；改动后回退 srcdoc 并重写", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });

  await openFile(page, "/Users/test/complex.html", "<p>hi</p>");

  const iframe = page.locator('iframe[title="HTML 预览"]');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", /asset:\/\//);
  expect(await iframe.getAttribute("srcdoc")).toBeNull();

  // 标脏 → srcdoc 回退
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__ as {
      getState: () => {
        activeTabId: string;
        updateTabContent: (id: string, content: string) => void;
      };
    };
    const s = store.getState();
    s.updateTabContent(s.activeTabId, '<p>hi</p><img src="./pic.png">');
  });
  await expect
    .poll(async () => await iframe.getAttribute("srcdoc"))
    .not.toBeNull();
  const srcdoc = await iframe.getAttribute("srcdoc");
  expect(srcdoc).toContain("<p>hi</p>");
  expect(srcdoc).toContain("asset://");
  // 未保存内容不可信：CSP script-src 'none'
  expect(srcdoc).toContain("script-src 'none'");
});

test("HTML 预览：无路径文档走 srcdoc", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__ as {
      getState: () => {
        openFile: (p: string, c: string) => void;
        newTab: () => void;
        updateTabContent: (id: string, content: string) => void;
        activeTabId: string;
      };
    };
    store.getState().openFile("/Users/test/untitled.html", "<p>x</p>");
    const s = store.getState();
    // 模拟未保存文档：路径无法直载时走 srcdoc
    s.updateTabContent(s.activeTabId, "<p>x</p>");
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
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });

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
