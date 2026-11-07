import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { moveThrough } from "./helpers/ui-probe";

/**
 * 悬浮预览窗（layout-portal 8.1）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 `window.__biaoyue_store__` 桥
 * 驱动状态。锚定坐标走状态机断言：x 恒 = 栏右缘 + 12、y 跟随悬停行；横向移动
 * 指针不得让窗口左右跳。⌘ 用 Control 代替（App 判定 metaKey || ctrlKey）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/260");
const ART275 = path.resolve(process.cwd(), ".artifacts/275");

mkdirSync(ART, { recursive: true });
mkdirSync(ART275, { recursive: true });

const PREVIEW = '[data-testid="floating-preview"]';
const RECENT_ROWS = '[data-section="recent"] [data-testid="rail-item"]';

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => void;
      __biaoyue_store__: {
        getState: () => {
          setRailDensity: (d: string) => void;
          scene: string;
        };
      };
    };
    for (let i = 1; i <= 10; i += 1) {
      w.__biaoyue_openFile__(
        `/tmp/fp/doc${i}.md`,
        `# 文件${i}\n\n这是第 ${i} 份文档的真实正文，用来验证预览渲染的是真内容。\n\n> 引用\n\n- 列表项\n\n\`\`\`js\nconst n = ${i};\n\`\`\``,
        `文件${i}`,
      );
    }
    // 紧凑密度：10 行全在视口内，row3 / row8 都可直接悬停，无需滚动
    w.__biaoyue_store__.getState().setRailDensity("compact");
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

async function railRows(page: Page) {
  return page.locator(RECENT_ROWS);
}

/** 悬停边缘条展开 → 点钉住：钉住态阅读空间常驻，行始终渲染。 */
async function pinRail(page: Page): Promise<void> {
  const edge = page.locator('[data-testid="rail-edge"]');
  if (await edge.isVisible().catch(() => false)) {
    await edge.hover();
  }
  const panel = page.locator('[data-testid="rail-panel"]');
  await expect(panel).toBeVisible();
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(panel).toHaveAttribute("data-rail-state", "pinned");
}

async function storeState<T>(page: Page, pick: string): Promise<T> {
  return page.evaluate((key) => {
    const s = (
      window as unknown as {
        __biaoyue_store__: { getState: () => Record<string, unknown> };
      }
    ).__biaoyue_store__.getState();
    return s[key] as never;
  }, pick) as Promise<T>;
}

async function closePreview(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: { getState: () => { closePreview: () => void } };
      }
    ).__biaoyue_store__
      .getState()
      .closePreview();
  });
}

async function dragBy(
  page: Page,
  selector: string,
  dx: number,
  dy: number,
): Promise<void> {
  const b = await page.locator(selector).boundingBox();
  if (!b) throw new Error(`不可测量: ${selector}`);
  const cx = b.x + Math.min(30, b.width / 2);
  const cy = b.y + Math.min(b.height - 3, b.height * 0.6);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 12 });
  await page.mouse.up();
}

async function dragHandle(
  page: Page,
  edge: string,
  dx: number,
  dy: number,
): Promise<void> {
  const sel = `[data-testid="preview-handle-${edge}"]`;
  const b = await page.locator(sel).boundingBox();
  if (!b) throw new Error(`手柄不可测量: ${sel}`);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
}

/** 打开悬浮预览（悬停第 1 行，等 250ms 延时触发）。 */
async function openPreview(page: Page): Promise<void> {
  const rows = await railRows(page);
  await rows.first().hover();
  await expect(page.locator(PREVIEW)).toBeVisible({ timeout: 3000 });
}

/** 经 store 桥开非窄预览（默认 320 宽），用于验证默认窗缩放钳到 260×200。 */
async function openPreviewNonNarrow(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            openPreview: (p: {
              path: string;
              title: string;
              x: number;
              y: number;
              w: number;
              h: number;
              flippedX: boolean;
              flippedY: boolean;
              source: "rail" | "grid";
              narrow: boolean;
            }) => void;
          };
        };
      }
    ).__biaoyue_store__
      .getState()
      .openPreview({
        path: "/tmp/fp/doc1.md",
        title: "文件1",
        x: 400,
        y: 100,
        w: 320,
        h: 300,
        flippedX: false,
        flippedY: false,
        source: "rail",
        narrow: false,
      });
  });
  await expect(page.locator(PREVIEW)).toBeVisible();
  await page.locator('[data-testid="preview-pin"]').click();
}

async function previewBox(page: Page) {
  const b = await page.locator(PREVIEW).boundingBox();
  if (!b) throw new Error("悬浮预览窗不可测量");
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
}

/** 悬停最近段某类型行的右半区（触发区）。 */
async function hoverRowRightHalf(page: Page, kind: string): Promise<void> {
  const row = page
    .locator(
      `[data-section="recent"] [data-testid="rail-item"][data-kind="${kind}"]`,
    )
    .first();
  const b = await row.boundingBox();
  if (!b) throw new Error(`行不可测量: ${kind}`);
  await page.mouse.move(b.x + Math.round(b.width * 0.75), b.y + b.height / 2);
}

/** 悬停最近段某类型行的左半区（非触发区）。 */
async function hoverRowLeftHalf(page: Page, kind: string): Promise<void> {
  const row = page
    .locator(
      `[data-section="recent"] [data-testid="rail-item"][data-kind="${kind}"]`,
    )
    .first();
  const b = await row.boundingBox();
  if (!b) throw new Error(`行不可测量: ${kind}`);
  await page.mouse.move(b.x + Math.round(b.width * 0.25), b.y + b.height / 2);
}

async function seedMedia(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => void;
      __biaoyue_store__: {
        getState: () => { setRailDensity: (d: string) => void; scene: string };
      };
    };
    w.__biaoyue_openFile__("/tmp/media/pic.png", "x", "图片");
    w.__biaoyue_openFile__("/tmp/media/clip.mp4", "x", "视频");
    w.__biaoyue_openFile__("/tmp/media/song.mp3", "x", "音频");
    w.__biaoyue_openFile__("/tmp/media/doc.pdf", "x", "文档");
    w.__biaoyue_store__.getState().setRailDensity("compact");
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

test("阅读空间锚定：x 恒=栏右缘+12、y 跟随悬停行、横向不随鼠标", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await pinRail(page);

  const rows = await railRows(page);
  const row3 = rows.nth(2);
  const row8 = rows.nth(7);
  const r3 = (await row3.boundingBox())!;
  const r8 = (await row8.boundingBox())!;

  // 悬停第 3 行 → 250ms 后弹出，x = 行右缘 + 12、y = 行顶
  await row3.hover();
  const preview = page.locator(PREVIEW);
  await expect(preview).toBeVisible({ timeout: 3000 });
  const b3 = await previewBox(page);
  expect(
    Math.abs(b3.x - (Math.round(r3.x + r3.width) + 12)),
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(b3.y - Math.round(r3.y))).toBeLessThanOrEqual(1);
  // 真内容渲染（markdown 标题/引用/列表/代码）
  await expect(page.locator('[data-testid="preview-doc"]')).toBeVisible();
  await page.screenshot({ path: path.join(ART, "preview-rail-anchored.png") });

  // 钉住预览，保证跨行切换时窗口不关
  await page.locator('[data-testid="preview-pin"]').click();
  await expect(preview).toHaveAttribute("data-pinned", "true");

  // 悬停第 8 行 → x 不变，y 跟随到第 8 行
  await row8.hover();
  await expect
    .poll(async () => (await previewBox(page)).y)
    .toBe(Math.round(r8.y));
  const b8 = await previewBox(page);
  expect(b8.x).toBe(b3.x);

  // 横向抖动指针：x 不得变化
  await page.mouse.move(r8.x + r8.width - 8, r8.y + r8.height / 2);
  await page.waitForTimeout(120);
  expect((await previewBox(page)).x).toBe(b8.x);
});

test("缩放：四边 + 一角拖到最小，尺寸严格钳到 260×200", async ({ page }) => {
  await boot(page);
  await seed(page);
  await pinRail(page);

  const preview = page.locator(PREVIEW);

  // 东/西：宽度钳到 260
  await openPreviewNonNarrow(page);
  expect((await previewBox(page)).w).toBe(320);
  await dragHandle(page, "e", -600, 0);
  expect((await previewBox(page)).w).toBe(260);

  await closePreview(page);
  await openPreviewNonNarrow(page);
  await dragHandle(page, "w", 600, 0);
  expect((await previewBox(page)).w).toBe(260);

  // 南/北：高度钳到 200
  await closePreview(page);
  await openPreviewNonNarrow(page);
  await dragHandle(page, "s", 0, -600);
  expect((await previewBox(page)).h).toBe(200);

  await closePreview(page);
  await openPreviewNonNarrow(page);
  await dragHandle(page, "n", 0, 600);
  expect((await previewBox(page)).h).toBe(200);

  // 一角（东南）：两轴同时到底 → 严格 260×200
  await closePreview(page);
  await openPreviewNonNarrow(page);
  await dragHandle(page, "se", -600, -600);
  const min = await previewBox(page);
  expect(min.w).toBe(260);
  expect(min.h).toBe(200);
  await page.screenshot({ path: path.join(ART, "preview-resized-min.png") });
});

test("贴边翻转：拖到窗口边缘后锚定边互换", async ({ page }) => {
  await boot(page);
  await seed(page);
  await pinRail(page);
  await openPreview(page);

  const preview = page.locator(PREVIEW);
  await expect(preview).toHaveAttribute("data-flipped-x", "false");
  await expect(preview).toHaveAttribute("data-flipped-y", "false");

  // 把标题栏拖到右下角：越过右缘与下缘
  await dragBy(page, '[data-testid="preview-titlebar"]', 900, 560);
  await expect(preview).toHaveAttribute("data-flipped-x", "true");
  await expect(preview).toHaveAttribute("data-flipped-y", "true");
  await page.screenshot({ path: path.join(ART, "preview-flipped-edge.png") });
});

test("拖动后关闭再触发：回默认锚定，不保留旧坐标", async ({ page }) => {
  await boot(page);
  await seed(page);
  await pinRail(page);
  await openPreview(page);

  const preview = page.locator(PREVIEW);
  const base = await previewBox(page);

  // 拖动到新位置
  await dragBy(page, '[data-testid="preview-titlebar"]', 180, 150);
  const moved = await previewBox(page);
  expect(moved.x).not.toBe(base.x);

  // × 关闭
  await page.locator('[data-testid="preview-close"]').click();
  await expect(preview).toHaveCount(0);

  // 重新触发：回到默认锚定而非关闭前位置
  await closePreview(page);
  await openPreview(page);
  const again = await previewBox(page);
  expect(again.x).toBe(base.x);
  expect(again.y).toBe(base.y);
});

test("⌘⇧V 开关：关闭后悬停不再弹，开启后 250ms 弹出；两开关独立", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await pinRail(page);

  const preview = page.locator(PREVIEW);
  const rows = await railRows(page);

  // 关闭总开关
  await page.keyboard.press("Control+Shift+V");
  await expect
    .poll(
      async () =>
        (await storeState<{ enabled: boolean }>(page, "previewSettings"))
          .enabled,
    )
    .toBe(false);

  // 悬停行也不弹（等超过 250ms 延时）
  await rows.first().hover();
  await page.waitForTimeout(600);
  await expect(preview).toHaveCount(0);
  await page.screenshot({ path: path.join(ART, "preview-disabled.png") });

  // 再按恢复：先把指针移开，再悬停 → 250ms 后弹出
  await page.mouse.move(700, 400);
  await page.keyboard.press("Control+Shift+V");
  await expect
    .poll(
      async () =>
        (await storeState<{ enabled: boolean }>(page, "previewSettings"))
          .enabled,
    )
    .toBe(true);
  await rows.first().hover();
  await expect(preview).toBeVisible({ timeout: 3000 });

  // 双开关独立：关阅读空间悬停不动网格模式与总开关
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            setPreviewSettings: (p: { railHover: boolean }) => void;
          };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setPreviewSettings({ railHover: false });
  });
  const settings = await storeState<{
    railHover: boolean;
    gridMode: string;
    enabled: boolean;
  }>(page, "previewSettings");
  expect(settings).toEqual({
    railHover: false,
    gridMode: "click",
    enabled: true,
  });

  // 悬停不再弹（阅读空间开关关）：移开指针后重悬停
  await closePreview(page);
  await page.mouse.move(700, 400);
  await rows.first().hover();
  await page.waitForTimeout(600);
  await expect(preview).toHaveCount(0);
});

test("右半触发窄窗 + 底部按钮区悬停重显三按钮", async ({ page }) => {
  await boot(page);
  await seed(page);
  await pinRail(page);

  const preview = page.locator(PREVIEW);
  const actions = page.locator('[data-testid="preview-actions"]');

  // 右半区触发 → 窄窗：≈缩略图 72 + 内边距 24 = 96，严格 < 320
  await hoverRowRightHalf(page, "markdown");
  await expect(preview).toBeVisible({ timeout: 3000 });
  const narrow = await previewBox(page);
  expect(narrow.w).toBeLessThan(320);
  expect(Math.abs(narrow.w - 96)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: path.join(ART, "preview-narrow.png") });

  // 指针在阅读空间行上（未进入窗口底部带）→ 动作区隐藏
  await expect(actions).toHaveCount(0);

  // 钉住，避免指针移动途中离窗关闭
  await page.locator('[data-testid="preview-pin"]').click();
  await expect(preview).toHaveAttribute("data-pinned", "true");

  // 窄窗拖拽：宽钳到窄窗最小 96、高钳到 200
  await dragHandle(page, "e", -600, 0);
  expect((await previewBox(page)).w).toBe(96);
  await dragHandle(page, "s", 0, -600);
  expect((await previewBox(page)).h).toBe(200);

  // 分步把指针移入窗口底部按钮高度带 → 动作区出现
  const pb = await previewBox(page);
  const bandY = pb.y + pb.h - 16;
  await moveThrough(
    page,
    [
      { x: pb.x + pb.w / 2, y: pb.y + pb.h / 2 },
      { x: pb.x + pb.w / 2, y: bandY },
    ],
    { steps: 8 },
  );
  await expect(actions).toBeVisible();
  await expect(page.locator('[data-testid="preview-action"]')).toHaveCount(4);
  await page.screenshot({ path: path.join(ART, "preview-actions-hover.png") });

  // 移回窗口中部 → 动作区隐藏
  await moveThrough(page, [{ x: pb.x + pb.w / 2, y: pb.y + pb.h / 2 }], {
    steps: 8,
  });
  await expect(actions).toHaveCount(0);
});

test("触发区：左半区不打开；右半区 250ms 打开（时钟推进）", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await pinRail(page);
  await page.clock.install();

  const preview = page.locator(PREVIEW);
  await hoverRowLeftHalf(page, "markdown");
  await page.clock.runFor(400);
  await expect(preview).toHaveCount(0);

  await hoverRowRightHalf(page, "markdown");
  await page.clock.runFor(250);
  await expect(preview).toBeVisible();
  await page.screenshot({ path: path.join(ART, "preview-right-half.png") });
});

test("左半区关闭已打开的 rail 预览（未钉住）", async ({ page }) => {
  await boot(page);
  await seed(page);
  await pinRail(page);
  await page.clock.install();

  const preview = page.locator(PREVIEW);
  await hoverRowRightHalf(page, "markdown");
  await page.clock.runFor(250);
  await expect(preview).toBeVisible();

  await hoverRowLeftHalf(page, "markdown");
  await expect(preview).toHaveCount(0);
});

test("离窗 180ms 防抖关闭；179ms 内保持", async ({ page }) => {
  await boot(page);
  await seed(page);
  await pinRail(page);
  await page.clock.install();
  // 暂停真实时间流：install 后 Date.now 随真实时间前进，runFor(179) 会被真实
  // 时间漏过 180ms 边界。pauseAt 冻结后 runFor 只推进 fake clock，边界才确定。
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

  const preview = page.locator(PREVIEW);
  await hoverRowRightHalf(page, "markdown");
  await page.clock.runFor(250);
  await expect(preview).toBeVisible();

  await page.mouse.move(700, 780);
  await page.clock.runFor(179);
  await expect(preview).toBeVisible();
  await page.clock.runFor(1);
  await expect(preview).toHaveCount(0);
});

test("媒体真实渲染：图片 img / 视频 video / 音频 audio / PDF iframe", async ({
  page,
}) => {
  await boot(page);
  await seedMedia(page);
  await pinRail(page);
  await page.clock.install();

  await hoverRowRightHalf(page, "image");
  await page.clock.runFor(250);
  const img = page.locator('[data-testid="preview-media"] img');
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src", /asset:\/\//);

  await hoverRowRightHalf(page, "video");
  const video = page.locator('[data-testid="preview-media"] video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("src", /media:\/\//);
  await expect(video).toHaveJSProperty("controls", true);

  await hoverRowRightHalf(page, "audio");
  const audio = page.locator('[data-testid="preview-media"] audio');
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute("src", /media:\/\//);
  await expect(audio).toHaveJSProperty("controls", true);

  await hoverRowRightHalf(page, "pdf");
  await expect(page.locator('[data-testid="preview-pdf"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="preview-media-placeholder"]'),
  ).toHaveCount(0);
  await page.screenshot({ path: path.join(ART, "preview-media-kinds.png") });
});

test("PDF 悬浮预览：asset iframe 带 #toolbar=0 且无 sandbox", async ({
  page,
}) => {
  await boot(page);
  await seedMedia(page);
  await pinRail(page);
  await page.clock.install();

  await hoverRowRightHalf(page, "pdf");
  await page.clock.runFor(250);

  const pdf = page.locator(
    '[data-testid="floating-preview"] [data-testid="preview-pdf"]',
  );
  await expect(pdf).toBeVisible();
  await expect(pdf).toHaveAttribute("src", /#toolbar=0/);
  await expect(pdf).not.toHaveAttribute("sandbox");
  await page.screenshot({ path: path.join(ART, "preview-pdf.png") });
});

function previewY(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { preview: { y: number } | null };
        };
      }
    ).__biaoyue_store__.getState();
    return s.preview?.y ?? null;
  });
}

test("拖动标题栏经过 iframe 内容区仍持续跟手（#275）", async ({ page }) => {
  await boot(page);
  await seed(page);
  // 追加一个 HTML 行：悬浮窗内容是 iframe，正是旧实现丢 pointermove 的场景
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => void;
    };
    w.__biaoyue_openFile__(
      "/tmp/fp/page.html",
      "<html><body><p>iframe 内容</p></body></html>",
      "page.html",
    );
  });
  await pinRail(page);

  const row = page.locator('[data-rail-path="/tmp/fp/page.html"]').first();
  await row.hover();
  await expect(page.locator(PREVIEW)).toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-testid="preview-html"]')).toBeVisible();

  const b = await previewBox(page);
  // 标题栏可拖区：标题 span 起点固定在图标+内边距之后（b.x+31），取 b.x+33；
  // 纵向避开顶部 resize 手柄（顶边 8–16px），取 b.y+18
  const startX = b.x + 33;
  const startY = b.y + 18;
  await page.mouse.move(startX, startY);
  await page.mouse.down();

  // 第一次移动：指针已进入 iframe 区域
  await page.mouse.move(startX, startY + 60, { steps: 6 });
  await expect(page.locator(PREVIEW)).toHaveAttribute("data-dragging", "true");
  const y1 = await previewY(page);
  // 第二次移动：没有指针捕获时这里会冻结在 y1
  await page.mouse.move(startX, startY + 120, { steps: 6 });
  const y2 = await previewY(page);
  await page.screenshot({
    path: path.join(ART275, "preview-drag-over-iframe.png"),
  });
  await page.mouse.up();

  expect(y1 ?? 0).toBeGreaterThan(b.y + 20);
  expect(y2 ?? 0).toBeGreaterThan((y1 ?? 0) + 20);
  await expect(page.locator(PREVIEW)).toHaveAttribute("data-dragging", "false");
});
