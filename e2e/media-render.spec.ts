import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");
const TINY_MP4_URL = "http://localhost:1420/e2e/fixtures/tiny.mp4";

/** media:// / asset: 在 mock 浏览器无处理器，重写为内置 tiny.mp4 的 data URL 才能真播放。 */
async function installRealVideo(page: Page): Promise<void> {
  await page.addInitScript((b64) => {
    const DATA = `data:video/mp4;base64,${b64}`;
    const proto = HTMLMediaElement.prototype as unknown as Record<
      string,
      unknown
    >;
    const desc = Object.getOwnPropertyDescriptor(proto, "src");
    if (!desc?.get || !desc.set) return;
    Object.defineProperty(proto, "src", {
      configurable: true,
      get: desc.get,
      set(this: HTMLMediaElement, value: string) {
        const next =
          typeof value === "string" &&
          (value.startsWith("media://") || value.startsWith("asset:"))
            ? DATA
            : value;
        desc.set?.call(this, next);
      },
    });
  }, TINY_MP4);
}

/**
 * 媒体引用渲染（#103 的后半段）：插进去只是第一步，还得看得见。
 *
 * `![x](assets/pic.png)` 是相对文档的，导航器按页面 base 解析会 404；
 * 必须落到文档目录再换成 asset:// / media://。这里断言的正是「换过之后
 * 的 src」，而不是「有一个 img 元素」——后者在 404 时同样成立。
 */

async function openPreview(
  page: import("@playwright/test").Page,
  doc: string,
  name: string,
) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ doc, name }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("preview");
    },
    { doc, name },
  );
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

async function openEditor(
  page: import("@playwright/test").Page,
  doc: string,
  name: string,
) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ doc, name }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

test("相对图片解析成 asset:// 再进 img.src", async ({ page }) => {
  await openPreview(page, "![pic](assets/pic.png)\n", "mimg");
  const img = page.locator(".preview-content img").first();
  await expect(img).toHaveCount(1);
  const src = await img.getAttribute("src");
  expect(src).toContain("asset://");
  expect(src).toContain("assets");
  expect(src).not.toBe("assets/pic.png");
});

test("相对视频渲染成播放器，src 走 media://", async ({ page }) => {
  await openPreview(page, "![clip](assets/clip.mp4)\n", "mvid");
  const video = page.locator(".preview-content video").first();
  await expect(video).toHaveCount(1);
  const src = await video.getAttribute("src");
  expect(src?.startsWith("media://")).toBe(true);
  // 不是裂图：markdown 的 ![] 对视频要出播放器，不能落在 img 里
  await expect(page.locator(".preview-content img")).toHaveCount(0);
});

test("远程图片保持原样，不被本地化", async ({ page }) => {
  await openPreview(page, "![r](https://example.com/a.png)\n", "mremote");
  await expect(page.locator(".preview-content img").first()).toHaveAttribute(
    "src",
    "https://example.com/a.png",
  );
});

test("拖动写入的宽度注释：预览尊重同一宽度，且不露注释文本", async ({
  page,
}) => {
  await openPreview(page, "![pic](assets/pic.png)<!--w=320-->\n", "mwidth");
  const img = page.locator(".preview-content img").first();
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute("width", "320");
  // 注释是持久化用的，不该变成一行可见文字
  const text = await page.locator(".preview-content").innerText();
  expect(text).not.toContain("w=320");
  expect(text).not.toContain("<!--");
});

test("编辑态：图片显示出来，宽度注释不露成文本", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)<!--w=320-->\n", "medit");
  await page.locator(".cm-content").click();
  await expect(page.locator('.cm-content img[src^="asset://"]')).toHaveCount(1);
  const text = await page.locator(".cm-content").innerText();
  expect(text).not.toContain("w=320");
  expect(text).not.toContain("<!--");
});

test("属性块宽度/高度落到 img 上，属性文本不露出来", async ({ page }) => {
  await openPreview(
    page,
    "![pic](assets/pic.png){width=420 height=200 align=left}\n",
    "mattr",
  );
  const img = page.locator(".preview-content img").first();
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute("width", "420");
  await expect(img).toHaveAttribute("height", "200");
  const box = await img.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(420);
  expect(Math.round(box?.height ?? 0)).toBe(200);
  const figureBox = await page
    .locator(".preview-content figure")
    .first()
    .boundingBox();
  expect(Math.abs((box?.x ?? 0) - (figureBox?.x ?? 0))).toBeLessThanOrEqual(2);
  const text = await page.locator(".preview-content").innerText();
  expect(text).not.toContain("width=420");
  expect(text).not.toContain("height=200");
  expect(text).not.toContain("align=left");
});

test("旧宽度注释与属性块共存：属性块优先，注释不露文本", async ({ page }) => {
  await openPreview(
    page,
    "![pic](assets/pic.png){width=420}<!--w=320-->\n",
    "mmixed",
  );
  const img = page.locator(".preview-content img").first();
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute("width", "420");
  const text = await page.locator(".preview-content").innerText();
  expect(text).not.toContain("w=320");
  expect(text).not.toContain("width=420");
  expect(text).not.toContain("<!--");
});

test("编辑态：属性块不露成文本，图片正常显示", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png){width=420}\n", "meditattr");
  await page.locator(".cm-content").click();
  await expect(page.locator('.cm-content img[src^="asset://"]')).toHaveCount(1);
  const text = await page.locator(".cm-content").innerText();
  expect(text).not.toContain("width=420");
  expect(text).not.toContain("{");
});

test("文件名带空格：视频仍渲染成播放器，不退化成正文", async ({ page }) => {
  const name = "克里斯 - 每天悬挂100秒丨小改变 大收获 - 001.mp4";
  await openPreview(page, `![${name}](<assets/${name}>)\n`, "mspace");
  await expect(page.locator(".preview-content video")).toHaveCount(1);
  const src = await page.locator(".preview-content video").getAttribute("src");
  expect(src?.startsWith("media://")).toBe(true);
  expect(src).toContain("%20");
  // 退化的典型症状：整段 markdown 源码变成正文
  const text = await page.locator(".preview-content").innerText();
  expect(text).not.toContain("![");
});

test("MD 嵌入视频渲染成带 controls 的 video 并可播放", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await installRealVideo(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/mdv/video.md",
      "![clip](assets/clip.mp4)\n",
      "video.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  const video = page.locator(".preview-content video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveJSProperty("controls", true);
  await expect(video).toHaveAttribute("src", /media:\/\//);

  await video.evaluate((el: HTMLVideoElement, url: string) => {
    el.src = url;
  }, TINY_MP4_URL);
  await video.evaluate((el: HTMLVideoElement) => el.play());
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
});

test("HTML 预览 iframe 内视频渲染成带 controls 的 video", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await installRealVideo(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    const doc =
      '<video controls preload="metadata" src="assets/clip.mp4"></video>';
    win.__biaoyue_openFile__("/tmp/htv/video.html", doc, "video.html");
    win.__biaoyue_store__.getState().setEditorMode("preview");
    // mock 环境 isTauriEnv 为真，标记 dirty 才会回退 srcdoc 加载重写后的视频。
    win.__biaoyue_store__.getState().updateContent(doc);
  });
  const frame = page.locator('iframe[title="HTML 预览"]');
  await frame.waitFor({ timeout: 10000 });
  const contentFrame = await frame
    .elementHandle()
    .then((h) => h?.contentFrame());
  expect(contentFrame).not.toBeNull();
  const video = contentFrame!.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveJSProperty("controls", true);
  const src = await video.getAttribute("src");
  expect(src).toBeTruthy();
  expect(src).not.toBe("assets/clip.mp4");

  await video.evaluate((el: HTMLVideoElement, url: string) => {
    el.src = url;
  }, TINY_MP4_URL);
  await video.evaluate((el: HTMLVideoElement) => el.play());
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
});

test("视频播放器音量/进度滑块 thumb 可见且与轨道有对比", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await installRealVideo(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/movies/ep1.mp4", "", "ep1.mp4");
  });
  const player = page.locator(".art-video-player").first();
  await player.waitFor({ timeout: 10000 });

  await page.locator(".art-control-volume").first().hover();
  const volumeThumb = page.locator(".art-volume-indicator").first();
  const volumeBox = await volumeThumb.boundingBox();
  expect(volumeBox?.width ?? 0).toBeGreaterThan(0);
  const colors = await page.evaluate(() => {
    const thumb = document.querySelector(
      ".art-volume-indicator",
    ) as HTMLElement;
    const track = document.querySelector(".art-volume-handle") as HTMLElement;
    return {
      thumb: getComputedStyle(thumb).backgroundColor,
      track: getComputedStyle(track).backgroundColor,
    };
  });
  expect(colors.thumb).not.toBe(colors.track);

  const progressBox = await page
    .locator(".art-progress-indicator")
    .first()
    .boundingBox();
  expect(progressBox?.width ?? 0).toBeGreaterThan(0);

  const video = page.locator(".art-video-player video").first();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
      timeout: 10000,
    })
    .toBeGreaterThan(0);

  const tabId = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const tab = Object.values(
      store.getState().tabs as Record<string, any>,
    ).find((t: any) => t.path === "/tmp/movies/ep1.mp4") as any;
    return tab?.id ?? "";
  });
  expect(tabId).not.toBe("");
  await page.evaluate((id) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().closeTab(id);
  }, tabId);
  await expect(page.locator(".art-video-player")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
});
