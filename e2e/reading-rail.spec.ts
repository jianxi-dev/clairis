import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 阅读空间竖排栏（layout-portal 6.1）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 `window.__biaoyue_store__` 桥驱动状态。
 * 另加 initScript：把 save_config 里的 paneLayout / railViewSpec 落到 localStorage，
 * reload 后回灌给 load_config——「重启恢复」在 mock 环境下也真实往返。
 * ⌘ 用 Control 代替（App 判定 metaKey || ctrlKey）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/176");
const ART274 = path.resolve(process.cwd(), ".artifacts/274");

mkdirSync(ART, { recursive: true });
mkdirSync(ART274, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
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
          const aiStored = localStorage.getItem("__ai_view_spec__");
          return {
            ...res,
            ...(stored ? { railViewSpec: JSON.parse(stored) } : null),
            ...(aiStored ? { aiViewSpec: JSON.parse(aiStored) } : null),
          };
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
        if (config && "aiViewSpec" in config) {
          try {
            localStorage.setItem(
              "__ai_view_spec__",
              JSON.stringify(config.aiViewSpec),
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
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__("/tmp/rr/design.md", "# 设计", "设计笔记");
    w.__biaoyue_openFile__("/tmp/rr/spec.html", "<p>设计</p>", "设计规范");
    w.__biaoyue_openFile__("/tmp/rr/page.html", "<p>页面</p>", "页面");
    w.__biaoyue_openFile__("/tmp/rr/plain.txt", "随笔内容", "随笔");
    w.__biaoyue_openFile__("/tmp/rr/shot.png", "x", "截图");
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

async function bodyWidth(page: Page): Promise<number> {
  const box = await page
    .locator('[data-testid="workspace-body"]')
    .boundingBox();
  if (!box) throw new Error("workspace-body 不可测量");
  return Math.round(box.width);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

function shot274(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(ART274, `${name}.png`) });
}

async function openHover(page: Page): Promise<void> {
  await page.hover('[data-testid="rail-edge"]');
  await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();
}

test("折叠边缘严格 12px；悬停浮层 240px 且正文宽度不变；移开 300ms 收回无残留", async ({
  page,
}) => {
  await boot(page);
  await seed(page);

  const edge = page.locator('[data-testid="rail-edge"]');
  await expect(edge).toBeVisible();
  const ebox = await edge.boundingBox();
  if (!ebox) throw new Error("rail-edge 不可测量");
  expect(Math.round(ebox.width)).toBe(12);
  expect(await edge.getAttribute("data-rail-state")).toBe("collapsed");
  const edgeBg = await edge.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(edgeBg).toBe("rgba(0, 0, 0, 0)");
  await shot(page, "rail-collapsed");

  const bodyBefore = await bodyWidth(page);

  // 悬停边缘条，250ms 内不移开 → 240px 浮层展开，正文不挤压
  await openHover(page);
  const panel = page.locator('[data-testid="rail-panel"]');
  await expect(panel).toHaveAttribute("data-rail-state", "hover");
  await expect
    .poll(async () => {
      const b = await panel.boundingBox();
      return b ? Math.round(b.width) : -1;
    })
    .toBe(240);
  expect(await bodyWidth(page)).toBe(bodyBefore);
  await shot(page, "rail-hover-overlay");

  // 移开指针：300ms 后收回折叠态，浮层节点不残留
  await page.mouse.move(1000, 500);
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveCount(0);
  await expect(edge).toBeVisible();
  expect(
    await edge.boundingBox().then((b) => (b ? Math.round(b.width) : -1)),
  ).toBe(12);
});

test("钉住后正文变窄；⌘\\ 收回折叠态正文恢复满宽，无残留", async ({ page }) => {
  await boot(page);
  await seed(page);

  const collapsedW = await bodyWidth(page);

  await openHover(page);
  await page.locator('[data-testid="rail-pin"]').click();
  const panel = page.locator('[data-testid="rail-panel"]');
  await expect(panel).toHaveAttribute("data-rail-state", "pinned");

  const pinnedW = await bodyWidth(page);
  expect(pinnedW).toBeLessThan(collapsedW - 200);
  expect(Math.abs(collapsedW - pinnedW - 240)).toBeLessThanOrEqual(2);
  await shot(page, "rail-pinned-stacked");

  // ⌘\ → 折叠，正文恢复满宽，浮层不残留
  await page.keyboard.press("Control+\\");
  await expect(page.locator('[data-testid="rail-edge"]')).toBeVisible();
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveCount(0);
  await expect.poll(() => bodyWidth(page)).toBe(collapsedW);
});

test("堆叠↔标签切换段结构；分类 chips 恰好 9 个；HTML chip 只留 HTML 条目", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await openHover(page);

  // 默认堆叠布局：4 个段，分类段 9 个 chip
  await expect(
    page.locator('[data-testid="rail-layout-stacked"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="rail-layout-tabs"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="rail-section"]')).toHaveCount(4);
  const sectionLabels = await page
    .locator('[data-testid="rail-section"] h3')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  expect(sectionLabels).toEqual(["现在", "收藏", "最近", "分类"]);
  const railText = await page.locator('[data-testid="rail-panel"]').innerText();
  expect(railText).not.toContain("置顶");
  await expect(
    page.locator('[data-section="category"] [data-testid="rail-chip"]'),
  ).toHaveCount(9);

  // 切到标签布局：分段页签 + 单列表
  await page.locator('[data-testid="rail-mode-tabs"]').click();
  await expect(page.locator('[data-testid="rail-layout-tabs"]')).toBeVisible();
  await expect(page.locator('[data-testid="rail-layout-stacked"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-testid="rail-tab"]')).toHaveCount(4);

  await page
    .locator('[data-testid="rail-tab"][data-section="category"]')
    .click();
  await expect(
    page.locator('[data-testid="rail-list"] [data-testid="rail-chip"]'),
  ).toHaveCount(9);
  await shot(page, "rail-tabs-category");

  // HTML chip：列表不含任何非 HTML 条目
  await page.locator('[data-testid="rail-chip"][data-chip="html"]').click();
  const items = page.locator(
    '[data-testid="rail-list"] [data-testid="rail-item"]',
  );
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await expect(items.nth(i)).toHaveAttribute("data-kind", "html");
  }
});

test("搜索即时过滤并高亮；× 清空保持聚焦；Esc 先清后收", async ({ page }) => {
  await boot(page);
  await seed(page);
  await openHover(page);
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "pinned",
  );

  const input = page.locator('[data-testid="rail-search-input"]');
  await input.click();
  await input.fill("设计");

  const hits = page.locator('[data-testid="rail-hit"]');
  await expect(hits.first()).toBeVisible();
  await expect(hits.first()).toHaveText("设计");
  await expect(page.locator('[data-testid="rail-item"]').first()).toBeVisible();
  await shot(page, "rail-search-highlight");

  // × 清空：输入框保持聚焦，无残留过滤
  await page.locator('[data-testid="rail-search-clear"]').click();
  await expect(input).toHaveValue("");
  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute("data-testid") ?? "",
  );
  expect(focused).toBe("rail-search-input");
  await expect(hits).toHaveCount(0);

  // Esc（空查询）→ 先清后收：收起栏为折叠态
  await input.press("Escape");
  await expect(page.locator('[data-testid="rail-edge"]')).toBeVisible();
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveCount(0);
});

test("本机检索：正文命中高亮；类型与时间筛选生效", async ({ page }) => {
  await boot(page);
  await seed(page);
  await openHover(page);
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "pinned",
  );

  const now = Date.now();
  const older = now - 10 * 86_400_000;
  await page.evaluate(
    ([nowMs, olderMs]) => {
      const w = window as unknown as {
        __biaoyue_search_documents__: unknown[];
      };
      w.__biaoyue_search_documents__ = [
        {
          path: "/Users/test/Documents/架构笔记.md",
          title: "架构笔记",
          openedAt: new Date(nowMs).toISOString(),
          excerpt: "…正文片段包含关键词…",
          matchedIn: "content",
        },
        {
          path: "/Users/test/Documents/会议纪要.md",
          title: "会议纪要",
          openedAt: new Date(olderMs).toISOString(),
          excerpt: "关键词出现在这里。",
          matchedIn: "content",
        },
        {
          path: "/Users/test/Desktop/页面.html",
          title: "页面",
          openedAt: new Date(nowMs).toISOString(),
          excerpt: "HTML 里的关键词。",
          matchedIn: "content",
        },
      ];
    },
    [now, older],
  );

  const input = page.locator('[data-testid="rail-search-input"]');
  await input.click();
  await input.fill("关键词");

  const results = page.locator('[data-testid="rail-search-results"]');
  await expect(results).toBeVisible();
  await expect(page.locator('[data-testid="rail-search-count"]')).toHaveText(
    "3 条",
  );
  const marks = results.locator('[data-testid="rail-hit"]');
  await expect(marks.first()).toBeVisible();
  await expect(marks.first()).toHaveText("关键词");
  await shot(page, "rail-search-local");

  // 类型筛选：Markdown → 2 条
  await results
    .locator('[data-testid="rail-chip"][data-chip="markdown"]')
    .click();
  await expect(results.locator('[data-testid="rail-item"]')).toHaveCount(2);
  await shot(page, "rail-search-type-filter");

  // 时间筛选：今天 → 只剩架构笔记
  await results
    .locator('[data-testid="rail-search-time"][data-time="today"]')
    .click();
  await expect(results.locator('[data-testid="rail-item"]')).toHaveCount(1);
  await expect(
    results.locator('[data-testid="rail-item"]').first(),
  ).toHaveAttribute("data-rail-path", "/Users/test/Documents/架构笔记.md");

  // 无命中 → 空态
  await input.fill("不存在的词");
  await expect(page.locator('[data-testid="rail-search-empty"]')).toBeVisible();
});

test("设为默认后重启：rail 视图规格与所设严格相等", async ({ page }) => {
  await boot(page);
  await seed(page);
  await openHover(page);
  await page.locator('[data-testid="rail-pin"]').click();

  await page.locator('[data-testid="rail-settings"]').click();
  await expect(page.locator('[data-testid="rail-menu"]')).toBeVisible();
  await page.locator('[data-testid="rail-layout-tabs"]').click();
  await page.locator('[data-testid="rail-density-compact"]').click();
  await page.locator('[data-testid="rail-save-default"]').click();

  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("__rail_view_spec__") ?? ""),
    )
    .toContain("tabs");
  const stored = await page.evaluate(() =>
    localStorage.getItem("__rail_view_spec__"),
  );
  expect(JSON.parse(stored ?? "null")).toEqual({
    layout: "tabs",
    density: "compact",
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  const spec = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            railLayout: string;
            railDensity: string;
            railViewSpec: unknown;
          };
        };
      }
    ).__biaoyue_store__.getState();
    return {
      layout: s.railLayout,
      density: s.railDensity,
      spec: s.railViewSpec,
    };
  });
  expect(spec.layout).toBe("tabs");
  expect(spec.density).toBe("compact");
  expect(spec.spec).toEqual({ layout: "tabs", density: "compact" });
});

test("三点菜单切换布局/密度后列表回顶", async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => void;
    };
    for (let i = 1; i <= 9; i += 1) {
      w.__biaoyue_openFile__(`/tmp/rr/extra${i}.md`, `# 额外${i}`, `额外${i}`);
    }
  });
  await openHover(page);
  await page.locator('[data-testid="rail-pin"]').click();
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "pinned",
  );

  const scroll = page.locator('[data-testid="rail-scroll"]');
  const scrollTop = () => scroll.evaluate((el) => el.scrollTop);
  const scrollTo = (top: number) =>
    page.evaluate((t) => {
      const el = document.querySelector('[data-testid="rail-scroll"]');
      if (el) el.scrollTop = t;
    }, top);

  await page.locator('[data-testid="rail-settings"]').click();
  await expect(page.locator('[data-testid="rail-menu"]')).toBeVisible();

  await scrollTo(300);
  await expect.poll(scrollTop).toBe(300);
  await page.locator('[data-testid="rail-layout-tabs"]').click();
  await expect.poll(scrollTop).toBe(0);

  await scrollTo(300);
  await expect.poll(scrollTop).toBe(300);
  await page.locator('[data-testid="rail-density-compact"]').click();
  await expect.poll(scrollTop).toBe(0);
  await shot(page, "rail-scroll-reset");
});

test("悬浮态可拖宽并持久化，拖动中不被收起（#274）", async ({ page }) => {
  await boot(page);
  await seed(page);
  await openHover(page);

  const panel = page.locator('[data-testid="rail-panel"]');
  await expect(panel).toHaveAttribute("data-rail-state", "hover");
  const handle = page.locator('[data-testid="rail-resize-handle"]');
  await expect(handle).toHaveCount(1);
  const hb = await handle.boundingBox();
  if (!hb) throw new Error("手柄不可测量");
  const x = hb.x + hb.width / 2;
  const y = hb.y + hb.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => (await panel.boundingBox())?.width ?? 0)
    .toBeGreaterThan(280);
  // 拖完仍在悬浮态（没有被 hover-leave 收起）
  await expect(panel).toHaveAttribute("data-rail-state", "hover");
  await shot274(page, "rail-hover-resized");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("__ai_view_spec__");
        return raw
          ? (JSON.parse(raw) as { railPinnedWidth?: number }).railPinnedWidth
          : null;
      }),
    )
    .toBeGreaterThan(280);

  // 重启恢复：reload 后悬停展开，宽度仍是拖过的值
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await seed(page);
  await openHover(page);
  await expect
    .poll(async () =>
      Math.round(
        (await page.locator('[data-testid="rail-panel"]').boundingBox())
          ?.width ?? 0,
      ),
    )
    .toBeGreaterThan(280);
  await shot274(page, "rail-width-restored");
});
