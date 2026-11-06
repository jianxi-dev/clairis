import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 阅读空间密度与卡片（layout-portal 7.1）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC；save_config 里的 railViewSpec
 * 落到 localStorage，reload 后回灌 load_config，让「设为默认 → 重启」真实往返。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/177");

mkdirSync(ART, { recursive: true });

const FILES: Array<{ path: string; content: string }> = [
  {
    path: "/tmp/rc/cover.md",
    content:
      "![封面](./cover.png)\n\n# 封面笔记\n\n这是从文件里截下来的真实开头，用来验证卡片摘要不是占位文案。",
  },
  {
    path: "/tmp/rc/nocover.md",
    content: "# 无图笔记\n\n只有文字，没有任何图片引用。",
  },
  {
    path: "/tmp/rc/page.html",
    content: "<html><body><h1>页面</h1><p>HTML 预览</p></body></html>",
  },
  {
    path: "/tmp/rc/report.pdf",
    content: "PDF document content",
  },
  {
    path: "/tmp/rc/movie.mp4",
    content: "video",
  },
  {
    path: "/tmp/rc/shot.png",
    content: "image",
  },
  {
    path: "/tmp/rc/voice.mp3",
    content: "audio",
  },
  {
    path: "/tmp/rc/plain.txt",
    content: "这是纯文本内容，没有任何勾选框，也没有缩略图。",
  },
  {
    path: "/tmp/rc/tasks.md",
    content: "- [x] 已完成\n- [ ] 待办一\n- [ ] 待办二\n\n正文。",
  },
];

async function boot(
  page: Page,
  scanDocs?: Array<Record<string, unknown>>,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (scanDocs) {
    await page.addInitScript((docs) => {
      (
        window as unknown as Record<string, unknown>
      ).__biaoyue_recent_documents__ = docs;
    }, scanDocs);
  }
  await page.addInitScript(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__?: {
        invoke?: (cmd: string, args?: unknown) => unknown;
      };
    };
    const internals = w.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") return;
    const orig = internals.invoke;
    internals.invoke = async (cmd: string, args?: unknown) => {
      if (cmd === "load_config") {
        const res = (await orig(cmd, args)) as Record<string, unknown>;
        try {
          const stored = localStorage.getItem("__rail_view_spec__");
          if (stored) return { ...res, railViewSpec: JSON.parse(stored) };
        } catch {
          /* localStorage 不可用时按缺省处理 */
        }
        return res;
      }
      if (cmd === "save_config") {
        const config = (
          args as { config?: Record<string, unknown> } | undefined
        )?.config;
        if (config && "railViewSpec" in config) {
          try {
            localStorage.setItem(
              "__rail_view_spec__",
              JSON.stringify(config.railViewSpec),
            );
          } catch {
            /* ignore */
          }
        }
      }
      return orig(cmd, args);
    };
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate((files) => {
    const w = window as unknown as {
      __biaoyue_store__: {
        getState: () => {
          openFile: (p: string, content: string) => void;
          scene: string;
        };
      };
    };
    const store = w.__biaoyue_store__.getState();
    for (const f of files) store.openFile(f.path, f.content);
  }, FILES);
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

async function openPinnedRail(page: Page): Promise<void> {
  await page.hover('[data-testid="rail-edge"]');
  await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "pinned",
  );
}

function recentItem(page: Page, filePath: string): Locator {
  return page.locator(
    `[data-section="recent"] [data-testid="rail-item"][data-rail-path="${filePath}"]`,
  );
}

function recentFirst(page: Page): Locator {
  return page
    .locator('[data-section="recent"] [data-testid="rail-item"]')
    .first();
}

async function heightOf(target: Locator): Promise<number> {
  const box = await target.boundingBox();
  if (!box) throw new Error("目标元素不可测量");
  return Math.round(box.height);
}

async function boxOf(target: Locator): Promise<{ w: number; h: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error("目标元素不可测量");
  return { w: Math.round(box.width), h: Math.round(box.height) };
}

async function setSlider(page: Page, value: number): Promise<void> {
  const slider = page.locator('[data-testid="rail-card-height"]');
  await slider.evaluate((el, next) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

test("默认卡片 112px + 堆叠；滑杆 88/160；三档行高严格 32/56/112 且舒适档第二行含父路径与时间", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await openPinnedRail(page);

  await expect(
    page.locator('[data-testid="rail-layout-stacked"]'),
  ).toBeVisible();
  const first = recentFirst(page);
  await expect(first).toHaveAttribute("data-density", "card");
  await expect.poll(() => heightOf(first)).toBe(112);
  await shot(page, "rail-density-card-default");

  await page.locator('[data-testid="rail-settings"]').click();
  await expect(page.locator('[data-testid="rail-menu"]')).toBeVisible();

  await setSlider(page, 88);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: {
                getState: () => { railCardHeight: number };
              };
            }
          ).__biaoyue_store__.getState().railCardHeight,
      ),
    )
    .toBe(88);
  await expect.poll(() => heightOf(first)).toBe(88);

  await setSlider(page, 160);
  await expect.poll(() => heightOf(first)).toBe(160);
  await expect(
    page.locator('[data-testid="rail-card-height-value"]'),
  ).toHaveText("160px");
  await shot(page, "rail-card-height-160");

  await setSlider(page, 112);
  await expect.poll(() => heightOf(first)).toBe(112);

  await page.locator('[data-testid="rail-density-comfortable"]').click();
  await expect(first).toHaveAttribute("data-density", "comfortable");
  await expect.poll(() => heightOf(first)).toBe(56);
  const sub = first.locator('[data-testid="rail-item-sub"]');
  await expect(sub).toContainText("rc");
  await expect(sub).toContainText(/刚刚|分钟前|小时前|昨天|天前/);
  await shot(page, "rail-density-comfortable");

  await page.locator('[data-testid="rail-density-compact"]').click();
  await expect(first).toHaveAttribute("data-density", "compact");
  await expect.poll(() => heightOf(first)).toBe(32);
  await shot(page, "rail-density-compact");

  await page.locator('[data-testid="rail-density-card"]').click();
  await expect.poll(() => heightOf(first)).toBe(112);
});

test("六类缩略图均为 72×54（4:3）；纯文本与无图 MD 零缩略图节点且摘要通栏", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await openPinnedRail(page);

  const cases: Array<[string, string]> = [
    ["/tmp/rc/cover.md", "md-cover"],
    ["/tmp/rc/page.html", "html-page"],
    ["/tmp/rc/report.pdf", "pdf-page"],
    ["/tmp/rc/movie.mp4", "video-poster"],
    ["/tmp/rc/shot.png", "image"],
    ["/tmp/rc/voice.mp3", "audio-wave"],
  ];
  for (const [filePath, kind] of cases) {
    const thumb = recentItem(page, filePath).locator(
      '[data-testid="rail-thumb"]',
    );
    await expect(thumb).toHaveCount(1);
    await expect(thumb).toHaveAttribute("data-thumb-kind", kind);
    const box = await boxOf(thumb);
    expect(box).toEqual({ w: 72, h: 54 });
    expect(box.w / box.h).toBeCloseTo(4 / 3, 2);
  }

  for (const filePath of ["/tmp/rc/plain.txt", "/tmp/rc/nocover.md"]) {
    const card = recentItem(page, filePath);
    await expect(card.locator('[data-testid="rail-thumb"]')).toHaveCount(0);
    await expect(
      card.locator('[data-testid="rail-card-excerpt"]'),
    ).toBeVisible();
  }

  const plainExcerpt = await boxOf(
    recentItem(page, "/tmp/rc/plain.txt").locator(
      '[data-testid="rail-card-excerpt"]',
    ),
  );
  const withThumbExcerpt = await boxOf(
    recentItem(page, "/tmp/rc/cover.md").locator(
      '[data-testid="rail-card-excerpt"]',
    ),
  );
  expect(plainExcerpt.w).toBeGreaterThan(withThumbExcerpt.w + 30);

  const plainMeta = recentItem(page, "/tmp/rc/plain.txt").locator(
    '[data-testid="rail-card-meta"]',
  );
  await expect(plainMeta).toHaveAttribute("data-meta-kind", "none");
  await expect(
    recentItem(page, "/tmp/rc/plain.txt").locator(
      '[data-testid="rail-meta-progress"]',
    ),
  ).toHaveCount(0);
  expect(await plainMeta.innerText()).not.toMatch(/\d+\/\d+/);

  await expect(
    recentItem(page, "/tmp/rc/tasks.md").locator(
      '[data-testid="rail-card-meta"]',
    ),
  ).toHaveAttribute("data-meta-kind", "task");
  await expect(
    recentItem(page, "/tmp/rc/tasks.md").locator(
      '[data-testid="rail-meta-progress"]',
    ),
  ).toHaveText("1/3");

  await shot(page, "rail-card-thumbnails");
});

test("缩略图居中、动作按钮位于其下方且不重叠；路径只显示父文件夹名并触发 reveal_in_finder", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await openPinnedRail(page);

  const card = recentItem(page, "/tmp/rc/cover.md");
  const thumb = card.locator('[data-testid="rail-thumb"]');
  const actions = card.locator('[data-testid="rail-card-actions"]');
  await expect(actions).toHaveCSS("opacity", "0");
  await card.hover();
  await expect(actions).toHaveCSS("opacity", "1");

  const thumbBox = await thumb.boundingBox();
  const actionsBox = await actions.boundingBox();
  if (!thumbBox || !actionsBox) throw new Error("目标元素不可测量");
  // 动作按钮在缩略图下方：顶边不高于缩略图底边（允许 1px 取整误差）
  expect(actionsBox.y).toBeGreaterThanOrEqual(thumbBox.y + thumbBox.height - 1);
  // 同一右列内居中：两者水平中心对齐
  const thumbCenter = thumbBox.x + thumbBox.width / 2;
  const actionsCenter = actionsBox.x + actionsBox.width / 2;
  expect(Math.abs(thumbCenter - actionsCenter)).toBeLessThan(2);

  const buttons = card.locator('[data-testid="rail-card-action"]');
  await expect(buttons).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(buttons.nth(i)).toBeVisible();
  await expect(buttons.nth(0)).toHaveAttribute("data-action", "open");
  await expect(buttons.nth(1)).toHaveAttribute("data-action", "split-right");
  await expect(buttons.nth(2)).toHaveAttribute("data-action", "split-down");

  expect(await boxOf(thumb)).toEqual({ w: 72, h: 54 });
  await shot(page, "rail-card-hover-actions");

  const path = card.locator('[data-testid="rail-card-path"]');
  await expect(path).toContainText("rc");
  await expect(path).not.toHaveAttribute("title");
  await path.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __reveal_calls__?: string[];
            }
          ).__reveal_calls__ ?? [],
      ),
    )
    .toContain("/tmp/rc");
});

test("HTML 卡片：中性占位缩略图 + 去标签摘要（无 <tag> 源码）", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await openPinnedRail(page);

  const card = recentItem(page, "/tmp/rc/page.html");
  const thumb = card.locator('[data-testid="rail-thumb"]');
  await expect(thumb).toHaveCount(1);
  await expect(thumb).toHaveAttribute("data-thumb-kind", "html-page");
  await expect(thumb.locator('[data-icon="html"]')).toHaveCount(1);
  await expect(thumb.locator(".rail-thumb-line")).toHaveCount(0);

  const excerpt = card.locator('[data-testid="rail-card-excerpt"]');
  await expect(excerpt).toContainText("页面");
  await expect(excerpt).toContainText("HTML 预览");
  await expect(excerpt).not.toContainText("<");
});

test("启动即合并本机最近文件：recent 含扫描结果且按时间倒序", async ({
  page,
}) => {
  await boot(page, [
    {
      path: "/Users/test/Documents/本地笔记.md",
      title: "本地笔记.md",
      openedAt: "2020-02-03T10:00:00.000Z",
      excerpt: "本机扫描到的最近文档，启动即出现在阅读空间。",
    },
    {
      path: "/Users/test/Desktop/桌面速记.html",
      title: "桌面速记.html",
      openedAt: "2020-02-02T10:00:00.000Z",
    },
    {
      path: "/Users/test/Downloads/下载文档.md",
      title: "下载文档.md",
      openedAt: "2020-02-01T10:00:00.000Z",
      excerpt: "下载目录里的文档。",
    },
  ]);
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__("/tmp/scan-seed.md", "# 种子", "种子");
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
  await openPinnedRail(page);

  // 扫描合并完成后：种子刚打开排最前，其余按 openedAt（= 本机 mtime）倒序
  await expect
    .poll(() =>
      page
        .locator('[data-section="recent"] [data-testid="rail-item"]')
        .evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-rail-path")),
        ),
    )
    .toEqual([
      "/tmp/scan-seed.md",
      "/Users/test/Documents/本地笔记.md",
      "/Users/test/Desktop/桌面速记.html",
      "/Users/test/Downloads/下载文档.md",
      "/Users/test/测试文档.md",
      "/Users/test/另一个.md",
    ]);
});

test("滑杆改到 160 后设为默认：重启回来 railViewSpec 与保存值严格相等", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await openPinnedRail(page);

  await page.locator('[data-testid="rail-settings"]').click();
  await expect(page.locator('[data-testid="rail-menu"]')).toBeVisible();
  await setSlider(page, 160);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: {
                getState: () => { railCardHeight: number };
              };
            }
          ).__biaoyue_store__.getState().railCardHeight,
      ),
    )
    .toBe(160);
  await page.locator('[data-testid="rail-save-default"]').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("__rail_view_spec__");
        if (!raw) return null;
        return JSON.parse(raw) as { cardHeight?: number };
      }),
    )
    .toEqual({ layout: "stacked", density: "card", cardHeight: 160 });
  const stored = await page.evaluate(() =>
    localStorage.getItem("__rail_view_spec__"),
  );
  expect(JSON.parse(stored ?? "null")).toEqual({
    layout: "stacked",
    density: "card",
    cardHeight: 160,
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
  const state = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            railLayout: string;
            railDensity: string;
            railCardHeight: number;
            railViewSpec: unknown;
          };
        };
      }
    ).__biaoyue_store__.getState();
    return {
      layout: s.railLayout,
      density: s.railDensity,
      cardHeight: s.railCardHeight,
      spec: s.railViewSpec,
    };
  });
  expect(state.layout).toBe("stacked");
  expect(state.density).toBe("card");
  expect(state.cardHeight).toBe(160);
  expect(state.spec).toEqual({
    layout: "stacked",
    density: "card",
    cardHeight: 160,
  });
});
