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

test("截图直接写剪贴板并弹胶囊提示，不调用另存为", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await withRealVideo(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__clipWrites = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async () => {
          w.__clipWrites += 1;
        },
      },
    });
  });
  await page.locator(".art-control[data-name='screenshot']").click();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as Record<string, number>).__clipWrites ?? 0,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown[]>)
          .__biaoyue_saved_binaries__?.length ?? 0,
    ),
  ).toBe(0);
  await expect(page.locator(".art-notice")).toContainText("截图已复制到剪贴板");
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

test("控制条高度 38px、自绘图标 22px、快捷键图标无外框", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  const height = await page
    .locator(".art-video-player")
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--art-control-height").trim(),
    );
  expect(height).toBe("38px");

  const icon = page.locator(".art-control-playlist svg").first();
  expect(await icon.getAttribute("width")).toBe("22");

  const hints = await page
    .locator(".art-control-hints svg path")
    .first()
    .getAttribute("d");
  expect(hints ?? "").not.toContain("h19v11");
});

test("进度条悬停显示当前位置缩略图，移开消失", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await withRealVideo(page);
  const progress = page.locator(".art-progress").first();
  const box = await progress.boundingBox();
  if (!box) throw new Error("进度条不可测量");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('[data-testid="video-thumb"]')).toHaveCount(1);
  await page.mouse.move(box.x + box.width / 2, box.y - 80);
  await expect(page.locator('[data-testid="video-thumb"]')).toHaveCount(0);
});

test("全屏态点击倍速不展开二级菜单", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await withRealVideo(page);
  await page.locator(".art-control-fullscreenWeb").click();
  await page.waitForTimeout(300);
  await page.locator(".art-control[data-name='rate']").click();
  await expect(page.locator(".rate-menu")).toHaveCount(0);
  await expect(page.locator(".art-notice")).toContainText("全屏下不可用");
});

test("快捷键总览含媒体家族条目", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await page.keyboard.press("Shift+Slash");
  const overlay = page.locator('[data-testid="shortcut-overlay"]');
  await expect(overlay).toBeVisible();
  expect(
    await page.locator('[data-shortcut-id^="media-"]').count(),
  ).toBeGreaterThanOrEqual(10);
});
