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
      .__biaoyue_store__ as {
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

  const img = page.locator(
    "img[src*='asset://localhost/%2FUsers%2Ftest%2Fpic.png']",
  );
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
      .__biaoyue_store__ as {
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

test("PDF 文件预览渲染查看器（无 iframe，位图渲染）", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/doc.pdf", "");
  await page.waitForTimeout(300);

  // 查看器挂载：embedpdf-container 自定义元素（渲染在 shadow DOM 内）
  const viewer = page.locator("embedpdf-container");
  await expect(viewer).toHaveCount(1);

  // 无 iframe（旧 FramePreview 已由 PdfViewer 取代；查看器内部 shadow DOM 的
  // about:blank 隐藏 iframe 属实现细节，不计入）
  const lightIframes = await page.evaluate(
    () => document.querySelectorAll("iframe").length,
  );
  expect(lightIframes).toBe(0);
  await expect(page.locator("iframe[src*='asset://']")).toHaveCount(0);

  // 页面位图渲染：shadow DOM 内 blob 位图 ≥ 1（2 页 PDF，含 buffer 预渲染共 4 张）
  await expect
    .poll(() => viewer.locator("img[src^='blob:']").count())
    .toBeGreaterThanOrEqual(1);
});

test("PDF 下 Cmd/Ctrl+= 不触发全局字号变化，查看器放大按钮生效", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/doc.pdf", "");
  const viewer = page.locator("embedpdf-container");
  await expect(viewer).toHaveCount(1);

  const readFontSize = () =>
    page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--editor-font-size"),
    );

  // PDF 时 App 层 early return：Ctrl+= 不落字号分支，inline 变量保持未设置
  const before = await readFontSize();
  await page.keyboard.press("Control+=");
  await page.waitForTimeout(300);
  expect(await readFontSize()).toBe(before);

  // 查看器自带放大按钮生效（缩放输入 84% → 94%）
  const zoomInput = viewer.locator("input[aria-label='Set zoom']");
  const zoomBefore = parseFloat(await zoomInput.inputValue());
  await viewer.locator("button[aria-label='放大']").click();
  await expect
    .poll(async () => parseFloat(await zoomInput.inputValue()))
    .toBeGreaterThan(zoomBefore);

  // markdown 下 Ctrl+= 仍走字号分支（回归固化：非 PDF 语义不变）。
  // mock load_config fontSize=16，故首次按 16→17，二次 17→18，断言递增即可
  await openFile(page, "/Users/test/note.md", "# 标题\n\n正文\n");
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+=");
  await page.waitForTimeout(300);
  const mdAfter1 = parseFloat(await readFontSize());
  await page.keyboard.press("Control+=");
  await page.waitForTimeout(300);
  const mdAfter2 = parseFloat(await readFontSize());
  expect(mdAfter2).toBeGreaterThan(mdAfter1);
});

test("PDF 查看器翻页与搜索", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/doc.pdf", "");
  const viewer = page.locator("embedpdf-container");
  await expect(viewer).toHaveCount(1);

  // 翻页：当前页 input 1 → 2（总页数 span 为 2）
  const pageInput = viewer.locator("input[type='text']:not([aria-label])");
  await expect(pageInput).toHaveValue("1");
  await viewer.locator("button[aria-label='下一页']").click();
  await expect(pageInput).toHaveValue("2");

  // 搜索：唤起搜索框 → 输入 mini.pdf 内嵌词 → 结果面板命中 ≥ 1
  await viewer.locator("button[aria-label='搜索']").click();
  const searchInput = viewer.locator("input[placeholder='搜索']");
  await expect(searchInput).toHaveCount(1);
  await searchInput.fill("BiaoyuePDFTest");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector("embedpdf-container")?.shadowRoot
            ?.textContent ?? "",
      ),
    )
    .toContain("1 个结果");
});

test("PDF 查看器隐藏未启用功能（无批注/导出/全屏等，打印弹窗无包含批注）", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/doc.pdf", "");
  const viewer = page.locator("embedpdf-container");
  await expect(viewer).toHaveCount(1);
  await expect
    .poll(() => viewer.locator("img[src^='blob:']").count())
    .toBeGreaterThanOrEqual(1);

  // shadow root 内按 data-epdf-i 判断 item 是否可见（display:none / 0 尺寸视为隐藏）
  const isItemHidden = (itemId: string) =>
    page.evaluate((id) => {
      const sr = document.querySelector("embedpdf-container")?.shadowRoot;
      const el = sr?.querySelector<HTMLElement>(`[data-epdf-i="${id}"]`);
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return (
        r.width === 0 ||
        r.height === 0 ||
        getComputedStyle(el).display === "none"
      );
    }, itemId);

  const visibleShadowText = () =>
    page.evaluate(() => {
      const sr = document.querySelector("embedpdf-container")?.shadowRoot;
      if (!sr) return "";
      const parts: string[] = [];
      const walk = (root: Element) => {
        for (const el of Array.from(root.querySelectorAll("*"))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (el as HTMLElement).innerText) {
            parts.push((el as HTMLElement).innerText);
          }
        }
      };
      walk(sr);
      return parts.join("\n");
    });

  // 范围外功能全部不可见：批注/形状/插入/表单/遮蔽模式标签、「评论」按钮
  for (const id of [
    "annotate-mode",
    "shapes-mode",
    "insert-mode",
    "form-mode",
    "redact-mode",
    "comment-button",
  ]) {
    expect(await isItemHidden(id), `应隐藏 ${id}`).toBe(true);
  }

  // 文件选项菜单：保留 打印，无 导出/全屏/安全/截图
  await viewer.locator("button[aria-label='文件选项']").click();
  await page.waitForTimeout(400);
  const docMenuVisible = await visibleShadowText();
  expect(docMenuVisible).toContain("打印");
  for (const forbidden of ["导出", "全屏", "安全", "截图"]) {
    expect(docMenuVisible, `文件菜单不应含「${forbidden}」`).not.toContain(
      forbidden,
    );
  }
  await page.screenshot({ path: "./test-results/f4-doc-menu.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 页面设置菜单：保留 旋转/滚动，无 全屏/双页
  await viewer.locator("button[aria-label='页面设置']").click();
  await page.waitForTimeout(400);
  const pageMenuVisible = await visibleShadowText();
  expect(pageMenuVisible).toContain("顺时针旋转");
  expect(pageMenuVisible).toContain("垂直滚动");
  for (const forbidden of ["全屏", "双页"]) {
    expect(pageMenuVisible, `页面设置不应含「${forbidden}」`).not.toContain(
      forbidden,
    );
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 打印设置弹窗：无「包含批注」复选框（F4 指名证据），其余控件仍在
  await page.keyboard.press("Control+p");
  await page.waitForTimeout(1500);
  const printVisible = await visibleShadowText();
  expect(printVisible).toContain("打印设置");
  expect(printVisible).toContain("所有页");
  expect(printVisible).toContain("打印");
  expect(printVisible).not.toContain("包含批注");
  // 打印弹窗内不应存在可见的 checkbox input
  const visibleCheckbox = await page.evaluate(() => {
    const sr = document.querySelector("embedpdf-container")?.shadowRoot;
    if (!sr) return 0;
    return Array.from(
      sr.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
    ).filter((i) => {
      const r = i.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).length;
  });
  expect(visibleCheckbox).toBe(0);
  await page.screenshot({ path: "./test-results/f4-print-modal.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // 保留功能仍可用：搜索、旋转、缩略图侧栏
  await viewer.locator("button[aria-label='搜索']").click();
  const searchInput = viewer.locator("input[placeholder='搜索']");
  await expect(searchInput).toHaveCount(1);
  await searchInput.fill("BiaoyuePDFTest");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector("embedpdf-container")?.shadowRoot
            ?.textContent ?? "",
      ),
    )
    .toContain("1 个结果");
  await page.screenshot({ path: "./test-results/f4-search.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 旋转：顺时针旋转后页面容器由纵向变为横向（w>h），T10 断言法
  const pageOrient = () =>
    page.evaluate(() => {
      const sr = document.querySelector("embedpdf-container")?.shadowRoot;
      if (!sr) return null;
      const imgs = Array.from(sr.querySelectorAll("img")).filter((i) =>
        i.src.startsWith("blob:"),
      );
      if (!imgs.length) return null;
      const img = imgs.reduce((a, b) =>
        (a as HTMLElement).getBoundingClientRect().width >
        (b as HTMLElement).getBoundingClientRect().width
          ? a
          : b,
      );
      const r = (img as HTMLElement).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
  expect(await pageOrient()).toMatchObject({ w: expect.any(Number) });
  const portrait = (await pageOrient())!;
  expect(portrait.w).toBeLessThan(portrait.h);
  await viewer.locator("button[aria-label='页面设置']").click();
  await page.waitForTimeout(300);
  await viewer.getByText("顺时针旋转", { exact: true }).click();
  await page.waitForTimeout(900);
  const landscape = (await pageOrient())!;
  expect(landscape.w).toBeGreaterThan(landscape.h);

  // 缩略图侧栏：大纲与书签 → sidebar-panel 渲染 blob 缩略图
  await viewer.locator("button[aria-label='大纲与书签']").click();
  await page.waitForTimeout(600);
  const thumbImgs = await page.evaluate(() => {
    const sr = document.querySelector("embedpdf-container")?.shadowRoot;
    if (!sr) return 0;
    return Array.from(sr.querySelectorAll("img")).filter(
      (i) => (i as HTMLElement).getBoundingClientRect().width > 20,
    ).length;
  });
  expect(thumbImgs).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: "./test-results/f4-thumbnails.png" });
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
      .__biaoyue_store__ as {
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

test("视频文件预览：media:// 协议直连（ArtPlayer 常驻播放器）", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/clip.mp4", "");
  const art = page.locator(".art-video-player");
  await expect(art).toHaveCount(1);
  // 全尺寸播放器挂载，video 直连 media://（斜杠保留，Range 流式）
  const video = art.locator("video");
  await expect(video).toHaveAttribute(
    "src",
    "media://localhost/Users/test/clip.mp4",
  );
  await expect(video).toHaveAttribute("autoplay", "");
});

test("图片预览默认宽度 1180 且支持滚轮缩放", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/pic.png", "");
  const img = page.locator(
    "img[src*='asset://localhost/%2FUsers%2Ftest%2Fpic.png']",
  );
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
