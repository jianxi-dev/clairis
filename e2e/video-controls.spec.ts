import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

test("倍速菜单收窄到 88px，旋转按钮逆时针 90°", async ({ page }) => {
  await openMedia(page, "/Users/test/clip.mp4");
  await withRealVideo(page);

  await page.locator('.art-control[data-name="rate"]').click();
  const menu = page.locator(".rate-menu");
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(Math.round(box.width)).toBe(88);

  await page.keyboard.press("Escape");
  await page.locator('.art-control[data-name="rotate"]').click();
  const rotation = await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>(
      ".art-video-player video",
    );
    return video?.style.transform ?? "";
  });
  expect(rotation).toMatch(/rotate\((?:-90|270)deg\)/);
});

test("全屏下指针滑入底部显示按钮栏与浮层，画面无 letterbox", async ({
  page,
}) => {
  const evidenceDir = path.resolve(process.cwd(), ".artifacts/699");
  mkdirSync(evidenceDir, { recursive: true });
  const shot = async (name: string): Promise<void> => {
    await page.screenshot({ path: path.join(evidenceDir, name) });
  };

  // media:// 是 Tauri 自定义协议，mock 浏览器无处理器；重写为内置 tiny.mp4，
  // 让视频真实播放，控制条才能按 ArtPlayer 的 3s 自动隐藏逻辑收起。
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
          typeof value === "string" && value.startsWith("media://")
            ? DATA
            : value;
        desc.set?.call(this, next);
      },
    });
  }, TINY_MP4);

  await openMedia(page, "/Users/test/clip.mp4");

  const player = page.locator(".art-video-player").first();
  const rate = page.locator(".art-control[data-name='rate']");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const v = document.querySelector(
          ".art-video-player video",
        ) as HTMLVideoElement | null;
        return v ? !v.paused && v.readyState > 2 : false;
      }),
    )
    .toBe(true, { timeout: 10000 });

  await page.mouse.move(600, 400);
  await expect(player).toHaveClass(/art-control-show/);
  await shot("01-non-fullscreen-bar.png");

  await page.locator(".art-control-fullscreen").click();
  await expect(player).toHaveClass(/art-fullscreen-web/);
  await page.mouse.move(600, 40);
  await expect(player).not.toHaveClass(/art-control-show/, { timeout: 8000 });
  await shot("02-fullscreen-before-move.png");

  const viewport = { width: 900, height: 700 };
  await page.setViewportSize(viewport);

  await page.mouse.move(viewport.width / 2, viewport.height - 20);
  await expect(player).toHaveClass(/art-control-show/);
  await shot("03-fullscreen-after-move.png");

  await rate.hover();
  await expect(page.locator(".rate-menu")).toHaveCount(1);
  await shot("04-popover-open.png");

  const box = (await player.boundingBox())!;
  expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.height - viewport.height)).toBeLessThanOrEqual(1);

  writeFileSync(
    path.join(evidenceDir, "state-coverage.json"),
    JSON.stringify(
      {
        states: [
          {
            state: "non-fullscreen-bar",
            screenshot: "01-non-fullscreen-bar.png",
            assertion: "指针滑入后 .art-video-player 含 art-control-show",
          },
          {
            state: "fullscreen-before-move",
            screenshot: "02-fullscreen-before-move.png",
            assertion: "进入网页全屏后按钮栏自动收起（无 art-control-show）",
          },
          {
            state: "fullscreen-after-move",
            screenshot: "03-fullscreen-after-move.png",
            assertion: "resize 后指针滑入底部，按钮栏重新出现",
          },
          {
            state: "popover-open",
            screenshot: "04-popover-open.png",
            assertion: "悬停倍速打开恰好 1 个 .rate-menu",
          },
          {
            state: "no-letterbox",
            screenshot: "03-fullscreen-after-move.png",
            assertion: "播放器宽高均等于视口尺寸（±1px）",
          },
        ],
      },
      null,
      2,
    ),
  );
});
