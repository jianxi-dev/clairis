import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * #1148：窗口原生全屏（TabBar 空白双击）不得反向驱动视频网页全屏。
 *
 * 窗口级全屏只做窗口全屏，视频保持原位；用户显式入口（双击视频 / 全屏按钮）
 * 仍进网页全屏，退出方向不变。后台格（MediaPlayerHost 常驻）同样不被带动。
 *
 * mock 补桩（仅测试侧 initScript，不改 src / 不改 mock 本体）：
 *  - metadata.currentWindow.label（getCurrentWindow 需要）
 *  - __TAURI_INTERNALS__.transformCallback + id→fn 表（@tauri-apps/api event listen）
 *  - plugin:window|set_fullscreen / is_fullscreen / set_decorations（窗口全屏状态）
 *  - plugin:event|listen（捕获 tauri://resize 的 handler，供手动触发）
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1148");

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, any>;
    w.__TAURI_INTERNALS__.metadata = {
      ...w.__TAURI_INTERNALS__.metadata,
      currentWindow: { label: "main" },
    };
    w.__fullscreen__ = false;
    w.__fsCalls = [] as boolean[];
    w.__decorationCalls = [] as boolean[];
    w.__isFsCalls = 0;
    w.__resizeHandlers = [] as Array<(p: unknown) => void>;
    w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    // 真实 Tauri 里 transformCallback 返回 id，后端按 id 回调；mock 自建 id→fn 表。
    w.__cbMap = new Map<number, (...a: unknown[]) => void>();
    w.__TAURI_INTERNALS__.transformCallback = (cb: (...a: unknown) => void) => {
      w.__cbSeq = (w.__cbSeq || 0) + 1;
      w.__cbMap.set(w.__cbSeq, cb);
      return w.__cbSeq;
    };
    const orig = w.__TAURI_INTERNALS__.invoke;
    w.__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
      if (cmd === "plugin:window|set_fullscreen") {
        const value = !!(args && args.value);
        w.__fsCalls.push(value);
        w.__fullscreen__ = value;
        return Promise.resolve(null);
      }
      if (cmd === "plugin:window|is_fullscreen") {
        w.__isFsCalls += 1;
        return Promise.resolve(w.__fullscreen__);
      }
      if (cmd === "plugin:window|set_decorations") {
        w.__decorationCalls.push(!!(args && args.value));
        return Promise.resolve(null);
      }
      if (cmd === "plugin:event|listen") {
        if (args && args.event === "tauri://resize") {
          const fn = w.__cbMap.get(args.handler);
          if (fn) w.__resizeHandlers.push(fn);
        }
        return Promise.resolve(w.__resizeHandlers.length);
      }
      if (cmd === "plugin:event|unlisten") return Promise.resolve(null);
      return orig(cmd, args);
    };
    w.__resizeFireCount = 0;
    w.__fireResize = (width: number, height: number) => {
      w.__resizeFireCount += 1;
      const payload = { width, height };
      for (const h of w.__resizeHandlers.slice()) {
        h({ event: "tauri://resize", id: 1, payload, windowLabel: "main" });
      }
    };
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openVideo(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/movies/ep1.mp4",
      "",
      "ep1.mp4",
    );
  });
  await page.locator(".art-video-player").first().waitFor({ timeout: 10000 });
}

/** 双击页签条右端空白（窗口级动作，既有 tab-strip-dblclick 同款坐标）。 */
async function blankDblclick(page: Page): Promise<void> {
  const strip = page.locator(".tab-strip").first();
  await expect(strip).toBeVisible();
  const box = (await strip.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width - 16, box.y + box.height / 2);
}

async function snap(page: Page): Promise<{
  present: boolean;
  hasWebClass?: boolean;
  parentTag?: string | null;
  rect?: { x: number; y: number; w: number; h: number };
  fullscreen?: boolean;
  fsCalls?: number;
  fsCallValues?: boolean[];
  decorationCalls?: number;
  isFsCalls?: number;
  resizeFireCount?: number;
}> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const el = document.querySelector(
      ".art-video-player",
    ) as HTMLElement | null;
    if (!el) return { present: false };
    const r = el.getBoundingClientRect();
    return {
      present: true,
      hasWebClass: el.classList.contains("art-fullscreen-web"),
      parentTag: el.parentElement?.tagName ?? null,
      rect: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
      fullscreen: w.__fullscreen__ ?? false,
      fsCalls: (w.__fsCalls ?? []).length,
      fsCallValues: [...(w.__fsCalls ?? [])],
      decorationCalls: (w.__decorationCalls ?? []).length,
      isFsCalls: w.__isFsCalls ?? 0,
      resizeFireCount: w.__resizeFireCount ?? 0,
    };
  });
}

/** 截图 + 合并 state-coverage.json（IC-2 ≥4 态，随票入库）。 */
async function record(page: Page, state: string): Promise<void> {
  mkdirSync(ART, { recursive: true });
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1148", states }, null, 2)}\n`,
  );
}

test("双击页签条空白：窗口进全屏而视频保持原位（#1148）", async ({ page }) => {
  await boot(page);
  await openVideo(page);
  const before = await snap(page);
  expect(before.present).toBe(true);
  expect(before.hasWebClass).toBe(false);

  await blankDblclick(page);
  await expect
    .poll(async () => (await snap(page)).fullscreen, { timeout: 10000 })
    .toBe(true);

  // 真实环境里进入原生全屏时系统发出 resize；这里手动触发一次。
  await page.evaluate(() =>
    (window as unknown as Record<string, any>).__fireResize(1600, 1000),
  );
  // onResized 已跑到 isFullscreen()（第一次来自页签双击本身）。
  await expect
    .poll(async () => (await snap(page)).isFsCalls, { timeout: 10000 })
    .toBeGreaterThanOrEqual(2);

  const after = await snap(page);
  expect(after.fullscreen).toBe(true);
  expect(after.hasWebClass).toBe(false);
  expect(after.parentTag).not.toBe("BODY");
  // 只有窗口级一次 setFullscreen，没有视频回写、没有动装饰。
  expect(after.fsCallValues).toEqual([true]);
  expect(after.decorationCalls).toBe(0);
  await record(page, "01-window-fullscreen-video-in-place");
});

test("对照：仅窗口 resize、原生未全屏 → 视频不网页全屏", async ({ page }) => {
  await boot(page);
  await openVideo(page);

  await page.evaluate(() =>
    (window as unknown as Record<string, any>).__fireResize(1600, 1000),
  );
  await expect
    .poll(async () => (await snap(page)).isFsCalls, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);

  const after = await snap(page);
  expect(after.fullscreen).toBe(false);
  expect(after.hasWebClass).toBe(false);
  expect(after.fsCallValues).toEqual([]);
  expect(after.decorationCalls).toBe(0);
  await record(page, "02-resize-only-no-fullscreen");
});

test("用户显式入口保留：双击视频进网页全屏，再点全屏按钮退出", async ({
  page,
}) => {
  await boot(page);
  await openVideo(page);
  const player = page.locator(".art-video-player").first();
  const box = (await player.boundingBox())!;

  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(player).toHaveClass(/art-fullscreen-web/);
  // 网页 → 窗口 单向同步仍生效（显式入口才联动窗口）。
  await expect
    .poll(async () => (await snap(page)).fsCalls, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1);
  await record(page, "03-explicit-video-fullscreen");

  await page.locator('.art-control[data-name="fullscreen"]').click();
  await expect(player).not.toHaveClass(/art-fullscreen-web/);
  await record(page, "04-explicit-video-fullscreen-exit");
});

test("后台格：媒体移出视口后窗口全屏 + resize 也不带动（#1148）", async ({
  page,
}) => {
  await boot(page);
  await openVideo(page);
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/other.md",
      "# 其他\n",
      "other.md",
    );
  });
  // 媒体格转为不可见：宿主移出视口（left:-99999），实例仍常驻订阅。
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.querySelector(
            ".art-video-player",
          ) as HTMLElement | null;
          return el ? Math.round(el.getBoundingClientRect().x) : 0;
        }),
      { timeout: 10000 },
    )
    .toBeLessThan(0);

  await blankDblclick(page);
  await expect
    .poll(async () => (await snap(page)).fullscreen, { timeout: 10000 })
    .toBe(true);
  await page.evaluate(() =>
    (window as unknown as Record<string, any>).__fireResize(1600, 1000),
  );
  await expect
    .poll(async () => (await snap(page)).isFsCalls, { timeout: 10000 })
    .toBeGreaterThanOrEqual(2);

  const after = await snap(page);
  expect(after.hasWebClass).toBe(false);
  expect(after.rect!.x).toBeLessThan(0);
  await record(page, "05-background-pane-unaffected");
});
