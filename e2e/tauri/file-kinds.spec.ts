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

test("代码文件默认编辑模式且渲染 CM6 高亮容器", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/app.py", 'def hello():\n    print("hi")\n');
  await page.waitForTimeout(300);

  // 默认编辑模式 → CM6 编辑器挂载
  const cm = page.locator(".cm-editor");
  await expect(cm).toHaveCount(1);
  const contentText = await page.locator(".cm-content").innerText();
  expect(contentText).toContain('print("hi")');

  // store 中 editorMode 为 edit
  const mode = await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__clairis_store__ as {
      getState: () => {
        tabs: Record<string, { editorMode: string }>;
        activeTabId: string | null;
      };
    };
    const s = store.getState();
    return s.activeTabId ? s.tabs[s.activeTabId].editorMode : "";
  });
  expect(mode).toBe("edit");
});

test("图片文件预览渲染 img 且资源为 asset URL", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/pic.png", "");
  await page.waitForTimeout(300);

  const img = page.locator("img[src*='asset://localhost/Users/test/pic.png']");
  await expect(img).toHaveCount(1);
});

test("媒体文件不可切换到编辑模式（按钮隐藏 + store 拦截）", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/pic.png", "");
  await page.waitForTimeout(300);

  // store 层面拦截：直接调 setEditorMode 不生效
  const mode = await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__clairis_store__ as {
      getState: () => {
        setEditorMode: (m: string) => void;
        tabs: Record<string, { editorMode: string }>;
        activeTabId: string | null;
      };
    };
    const s = store.getState();
    s.setEditorMode("edit");
    const st = store.getState();
    return st.activeTabId ? st.tabs[st.activeTabId].editorMode : "";
  });
  expect(mode).toBe("preview");

  // 工具栏无"编辑"模式按钮（媒体时模式区隐藏）
  const editBtn = page.locator("button", { hasText: "编辑" });
  await expect(editBtn).toHaveCount(0);
});

test("PDF 文件预览渲染 iframe", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/doc.pdf", "");
  await page.waitForTimeout(300);

  const frame = page.locator(
    "iframe[src*='asset://localhost/Users/test/doc.pdf']",
  );
  await expect(frame).toHaveCount(1);
});
test("PDF 预览点击 iframe 后 Ctrl+= 缩放（焦点拉回父文档）", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/doc.pdf", "");
  await page.waitForTimeout(300);

  const frame = page.locator(
    "iframe[src*='asset://localhost/Users/test/doc.pdf']",
  );
  await expect(frame).toHaveCount(1);

  const readZoom = () =>
    frame.evaluate((el) => {
      const z = (el as HTMLElement).style.zoom || "1";
      return parseFloat(z) || 1;
    });

  // 点击 iframe 内部（焦点进入 iframe 文档），随后 Cmd/Ctrl+= 应仍缩放
  await frame.click({ force: true, position: { x: 10, y: 10 } });
  await page.waitForTimeout(500);

  const before = await readZoom();
  await page.keyboard.press("Meta+=");
  await page.waitForTimeout(300);
  const afterMeta = await readZoom();

  await page.keyboard.press("Control+0");
  await page.waitForTimeout(200);
  const resetZoom = await readZoom();
  await page.keyboard.press("Control+=");
  await page.waitForTimeout(300);
  const afterCtrl = await readZoom();

  expect(afterMeta).toBeGreaterThan(before);
  expect(afterCtrl).toBeGreaterThan(resetZoom);
});

test("编辑态长行自动换行（无水平滚动）", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  const longLine =
    "这是一个非常长的行，用于验证编辑模式自动换行功能。" +
    "内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充内容填充。";
  await openFile(page, "/Users/test/long.md", "# 标题\n\n" + longLine + "\n");
  await page.waitForTimeout(400);

  // 编辑模式（markdown 默认 preview → 切 edit）
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__clairis_store__ as {
      getState: () => { setEditorMode: (m: string) => void };
    };
    store.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(300);

  const noHScroll = await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller");
    if (!scroller) return null;
    return scroller.scrollWidth <= scroller.clientWidth + 1;
  });
  expect(noHScroll).toBe(true);
});

test("视频文件预览：media:// 协议直连（Range 流式）", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/clip.mp4", "");
  const video = page.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute(
    "src",
    "media://localhost/%2FUsers%2Ftest%2Fclip.mp4",
  );
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("autoPlay", "");
});

test("图片预览默认宽度 1180 且支持滚轮缩放", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/pic.png", "");
  const img = page.locator("img[src*='asset://localhost/Users/test/pic.png']");
  await expect(img).toHaveCount(1);

  // 默认宽度 1180
  const w1 = await img.evaluate((el) => (el as HTMLElement).style.width);
  expect(parseFloat(w1)).toBe(1180);

  // Ctrl+滚轮放大
  await img.dispatchEvent("wheel", { ctrlKey: true, deltaY: -100 });
  await page.waitForTimeout(200);
  const w2 = await img.evaluate((el) => (el as HTMLElement).style.width);
  expect(parseFloat(w2)).toBeGreaterThan(1180);
});
