import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/247");
const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
);

mkdirSync(ART, { recursive: true });

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
  await page.waitForTimeout(400);
}

async function injectMediaDir(
  page: import("@playwright/test").Page,
  files: string[],
) {
  await page.addInitScript({
    content: `
      window.__biaoyue_media_dir__ = ${JSON.stringify(files)};
      (function () {
        var internals = window.__TAURI_INTERNALS__;
        if (!internals) return;
        var orig = internals.invoke;
        internals.invoke = function (cmd, args) {
          if (cmd === "list_media_in_dir") {
            return (window.__biaoyue_media_dir__ || []).map(function (p) {
              var name = String(p).split("/").pop();
              var ext = (name.split(".").pop() || "").toLowerCase();
              var kind = (ext === "mp3" || ext === "m4a" || ext === "wav" || ext === "flac" || ext === "ogg") ? "audio" : "video";
              return { path: String(p), name: name, kind: kind, target: name.replace(/\\.[^.]+$/, "") };
            });
          }
          return orig.call(this, cmd, args);
        };
      })();
    `,
  });
}

test("打开视频 → 全尺寸播放器挂载，无迷你条", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/clip.mp4", "");

  // 全尺寸 ArtPlayer 挂载
  const art = page.locator(".art-video-player");
  await expect(art).toHaveCount(1);
  // 全尺寸层在视口内（left: 0）
  const left = await art
    .locator("xpath=ancestor::div[contains(@style,'position: absolute')][1]")
    .evaluate((el) => (el as HTMLElement).style.left);
  expect(left).toBe("0px");
  // 无迷你条（没有「回到播放」按钮）
  const mini = page.locator("button", { hasText: "回到播放" });
  await expect(mini).toHaveCount(0);

  await page.screenshot({ path: path.join(ART, "video-in-pane.png") });
});

test("打开视频 → 打开非音视频文件 → 播放器保留（离屏继续播放），无迷你条", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/clip.mp4", "");
  const art = page.locator(".art-video-player");
  await expect(art).toHaveCount(1);

  // 打开 md 文件（非音视频）→ 播放器仍挂载（移出视口继续播放），无迷你条
  await openFile(page, "/Users/test/笔记/周报.md", "# 周报");
  await page.waitForTimeout(400);
  await expect(art).toHaveCount(1);
  const left = await art
    .locator("xpath=ancestor::div[contains(@style,'position: absolute')][1]")
    .evaluate((el) => (el as HTMLElement).style.left);
  expect(left).toBe("-99999px");
  const mini = page.locator("button", { hasText: "回到播放" });
  await expect(mini).toHaveCount(0);
  // 切回视频 tab → 恢复全尺寸
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__ as {
      getState: () => {
        tabs: Record<string, { path: string; id: string }>;
        switchTab: (id: string) => void;
      };
    };
    const s = store.getState();
    const videoTab = Object.values(s.tabs).find((t) => t.path.includes(".mp4"));
    if (videoTab) s.switchTab(videoTab.id);
  });
  await page.waitForTimeout(400);
  const left2 = await art
    .locator("xpath=ancestor::div[contains(@style,'position: absolute')][1]")
    .evaluate((el) => (el as HTMLElement).style.left);
  expect(left2).toBe("0px");
});

test("打开视频 A → 再打开视频 B → B 全尺寸显示且播放源切换", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/clip.mp4", "");
  const art = page.locator(".art-video-player");
  await expect(art).toHaveCount(1);

  // 打开同目录另一视频（切换播放源）→ video.src 应更新为 clip2
  await openFile(page, "/Users/test/clip2.mp4", "");
  await page.waitForTimeout(400);
  const video = page.locator("video.art-video");
  await expect(video).toHaveAttribute(
    "src",
    "media://localhost/Users/test/clip2.mp4",
  );
  // 仍全尺寸显示，无迷你条
  const left = await art
    .locator("xpath=ancestor::div[contains(@style,'position: absolute')][1]")
    .evaluate((el) => (el as HTMLElement).style.left);
  expect(left).toBe("0px");
  const mini = page.locator("button", { hasText: "回到播放" });
  await expect(mini).toHaveCount(0);
});

test("播放列表切集 → 页签标题同步为新文件名", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await injectMediaDir(page, ["/Users/test/clip.mp4", "/Users/test/clip2.mp4"]);
  await page.route("**/*", async (route) => {
    if (route.request().url().startsWith("media://")) {
      await route.fulfill({
        status: 200,
        contentType: "video/mp4",
        body: TINY_MP4,
      });
      return;
    }
    await route.continue();
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/clip.mp4", "");

  const tabTitle = page.locator(".tab-strip [data-tab-id] span.max-w-44");
  await expect(tabTitle).toHaveText("clip.mp4");

  await page.locator(".art-video-player").hover();
  await page.locator(".art-control-playlist").click();
  await page.getByText("clip2.mp4", { exact: true }).waitFor();
  await page.getByText("clip2.mp4", { exact: true }).click();

  await expect(tabTitle).toHaveText("clip2.mp4");
});
