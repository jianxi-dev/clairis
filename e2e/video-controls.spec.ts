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

test("控制条顺序：上下集夹住播放键，截图→画中画→全屏自绘按钮", async ({
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
    at(right, "art-control-pip"),
  );
  expect(at(right, "art-control-pip")).toBeLessThan(
    at(right, "art-control-fullscreen"),
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
  const toast = page.locator('[data-testid="shot-toast"]');
  await expect(toast).toContainText("截图已复制到剪贴板");
  const toastBox = await toast.boundingBox();
  const shotBox = await page
    .locator(".art-control[data-name='screenshot']")
    .boundingBox();
  expect(toastBox).not.toBeNull();
  expect(shotBox).not.toBeNull();
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(shotBox!.y - 4);
});

test("切换文件后缩略图源跟随新视频", async ({ page }) => {
  await openMedia(page, "/Users/test/a.mp4");
  await withRealVideo(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/Users/test/b.mp4", "", "b.mp4");
  });
  await expect
    .poll(() =>
      page.locator('[data-testid="video-thumb-source"]').getAttribute("src"),
    )
    .toContain("b.mp4");
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

test("控制条 38px、右侧按钮与图标统一尺寸", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  const height = await page
    .locator(".art-video-player")
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--art-control-height").trim(),
    );
  expect(height).toBe("38px");

  const controls = await page
    .locator(".art-controls-right .art-control")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height)];
      }),
    );
  for (const [w, h] of controls) {
    expect(w).toBe(38);
    expect(h).toBe(38);
  }

  const iconDetails = await page
    .locator(".art-controls-right .art-control")
    .evaluateAll((els) =>
      els.map((el) => {
        const ic = el.querySelector(".art-icon");
        const r = ic?.getBoundingClientRect();
        return {
          name: (el as HTMLElement).dataset.name || "",
          cls: el.className,
          w: r ? Math.round(r.width) : -1,
          h: r ? Math.round(r.height) : -1,
        };
      }),
    );
  const icons = iconDetails.map((d) => [d.w, d.h]);
  for (const [w, h] of icons) {
    expect(w).toBe(24);
    expect(h).toBe(24);
  }

  const svgDetails = await page
    .locator(".art-controls-right .art-control")
    .evaluateAll((els) =>
      els.map((el) => {
        const sv = el.querySelector(".art-icon svg");
        const r = sv?.getBoundingClientRect();
        return {
          name: (el as HTMLElement).dataset.name || "",
          w: r ? Math.round(r.width) : -1,
          h: r ? Math.round(r.height) : -1,
          html: sv ? sv.outerHTML.slice(0, 80) : "none",
        };
      }),
    );
  const svgs = svgDetails.map((d) => [d.w, d.h]);
  for (const [w, h] of svgs) {
    expect(w).toBe(22);
    expect(h).toBe(22);
  }

  const hints = await page
    .locator(".art-control[data-name='hints'] svg path")
    .first()
    .getAttribute("d");
  expect(hints ?? "").toContain("h15");
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

test("全屏态仍有二级菜单", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await withRealVideo(page);
  await page.locator(".art-control-fullscreen").click();
  await page.waitForTimeout(300);
  await page.locator(".art-control[data-name='rate']").hover();
  await expect(page.locator(".rate-menu")).toHaveCount(1);
  await page.locator(".art-control-fullscreen").click();
});

test("二级菜单 hover 显隐且以鼠标为中心，快捷键浮层 168px", async ({
  page,
}) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await withRealVideo(page);

  const subtitle = page.locator(".art-control[data-name='subtitle']");
  const sbox = await subtitle.boundingBox();
  if (!sbox) throw new Error("字幕按钮不可测量");
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
  const menu = page.locator('div[style*="width: 230px"]').first();
  await expect(menu).toBeVisible({ timeout: 2000 });
  const mbox = (await menu.boundingBox())!;
  expect(
    Math.abs(mbox.x + mbox.width / 2 - (sbox.x + sbox.width / 2)),
  ).toBeLessThanOrEqual(2);

  await page.mouse.move(200, 300);
  await expect(menu).toHaveCount(0, { timeout: 2000 });

  const hints = page.locator(".art-control[data-name='hints']");
  await hints.hover();
  const hintsPanel = page.getByTestId("hints-panel");
  await expect(hintsPanel).toBeVisible({ timeout: 2000 });
  expect(Math.round((await hintsPanel.boundingBox())!.width)).toBe(168);
  await page.mouse.move(200, 300);
  await expect(hintsPanel).toHaveCount(0, { timeout: 2000 });
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
