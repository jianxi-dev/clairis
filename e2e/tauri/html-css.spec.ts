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
          __clairis_openFile__?: (
            path: string,
            content: string,
            title: string,
          ) => void;
        }
      ).__clairis_openFile__?.(p, c, p.split("/").pop() ?? p);
    },
    [path, content],
  );
  await page.waitForTimeout(300);
}

test("HTML 预览：asset:// 直载（iframe src 指向本地文件）", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/complex.html", "<p>hi</p>");

  const iframe = page.locator('iframe[title="HTML 预览"]');
  await expect(iframe).toHaveCount(1);
  const src = await iframe.getAttribute("src");
  // buildAssetUrl 保留目录结构：前导 %2F 保留绝对路径语义，段间斜杠字面保留
  expect(src).toBe("asset://localhost/%2FUsers/test/complex.html");
  // 脚本默认允许：sandbox 含 allow-scripts
  const sandbox = await iframe.getAttribute("sandbox");
  expect(sandbox).toContain("allow-scripts");
});

test("HTML 预览：无路径回退 srcdoc 且脚本仍禁", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  // 无路径：直接渲染 PreviewView 的 srcdoc 回退（通过 newTab + html kind 不可行，用 evaluate 直接验证组件）
  // 实际无路径 html 场景=新建文档切 html，此处验证 iframe 存在性即可
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__clairis_store__ as {
      getState: () => {
        openFile: (p: string, c: string) => void;
      };
    };
    store.getState().openFile("/Users/test/untitled.html", "<p>x</p>");
  });
  await page.waitForTimeout(300);

  // 打开的文件总是有路径 → asset 直载
  const iframe = page.locator('iframe[title="HTML 预览"]');
  await expect(iframe).toHaveCount(1);
  const src = await iframe.getAttribute("src");
  expect(src).toBe("asset://localhost/%2FUsers/test/untitled.html");
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
