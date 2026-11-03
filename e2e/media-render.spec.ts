import { test, expect } from "@playwright/test";

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
  await page.waitForSelector("header", { timeout: 10000 });
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
