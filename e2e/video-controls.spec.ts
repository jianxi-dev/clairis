import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");

async function openMedia(
  page: Page,
  file: string,
  mediaDir?: string[],
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (mediaDir) {
    await page.addInitScript((files) => {
      const w = window as unknown as Record<string, any>;
      const orig = w.__TAURI_INTERNALS__.invoke;
      w.__TAURI_INTERNALS__.invoke = (cmd: string, args: unknown) => {
        if (cmd === "list_media_in_dir") {
          return files.map((p) => {
            const name = p.split("/").pop() ?? p;
            const ext = (name.split(".").pop() ?? "").toLowerCase();
            const kind = ["mp3", "m4a", "wav", "flac", "ogg"].includes(ext)
              ? "audio"
              : "video";
            return {
              path: p,
              name,
              kind,
              target: name.replace(/\.[^.]+$/, ""),
            };
          });
        }
        return orig(cmd, args);
      };
    }, mediaDir);
  }
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((p) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(p, "", p.split("/").pop() ?? p);
  }, file);
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
}

async function withRealVideo(page: Page): Promise<void> {
  await page.evaluate(async (b64) => {
    const video = document.querySelector(
      ".art-video-player video",
    ) as HTMLVideoElement;
    video.src = `data:video/mp4;base64,${b64}`;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
  }, TINY_MP4);
  await page.waitForTimeout(200);
}

test("控制条顺序：上下集夹住播放键，截图在全屏前、画中画在其后", async ({
  page,
}) => {
  await openMedia(page, "/Users/test/clip.mp4");

  const left = await page
    .locator(".art-controls-left .art-control")
    .evaluateAll((els) => els.map((el) => el.className));
  const right = await page
    .locator(".art-controls-right .art-control")
    .evaluateAll((els) => els.map((el) => el.className));

  const at = (list: string[], sub: string) =>
    list.findIndex((cls) => cls.includes(sub));
  expect(at(left, "art-control-prev")).toBeLessThan(
    at(left, "art-control-playAndPause"),
  );
  expect(at(left, "art-control-playAndPause")).toBeLessThan(
    at(left, "art-control-next"),
  );
  expect(at(right, "art-control-note")).toBeLessThan(
    at(right, "art-control-screenshot"),
  );
  expect(at(right, "art-control-screenshot")).toBeLessThan(
    at(right, "art-control-fullscreenWeb"),
  );
  expect(at(right, "art-control-fullscreenWeb")).toBeLessThan(
    at(right, "art-control-pip"),
  );
});

test("截图写出 PNG，默认名带视频名与时间码", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await withRealVideo(page);
  await page.locator(".art-control[data-name='screenshot']").click();

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as Record<string, { defaultName: string }[]>)
              .__biaoyue_saved_binaries__?.length ?? 0,
        ),
      { timeout: 5000 },
    )
    .toBe(1);

  const saved = await page.evaluate(
    () =>
      (
        window as unknown as Record<
          string,
          { defaultName: string; base64: string }[]
        >
      ).__biaoyue_saved_binaries__[0],
  );
  expect(saved.defaultName).toMatch(/^clip-\d{2}m\d{2}s\.png$/);
  expect(saved.base64.length).toBeGreaterThan(100);
});

test("上一集与下一集可点击且不打断播放器", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openMedia(page, "/Users/test/clip.mp4");
  await page.locator(".art-control[data-name='next']").click();
  await page.locator(".art-control[data-name='prev']").click();
  await expect(page.locator(".art-video-player")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("音频文件不显示截图与画中画", async ({ page }) => {
  await openMedia(page, "/Users/test/song.mp3");
  await expect(
    page.locator(".art-control[data-name='screenshot']"),
  ).toBeHidden();
  await expect(page.locator(".art-control[data-name='pip']")).toBeHidden();
});
