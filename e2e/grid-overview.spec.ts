import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ART275 = path.resolve(process.cwd(), ".artifacts/275");
mkdirSync(ART275, { recursive: true });

/**
 * 网格概览（layout-portal 10.1）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 `window.__biaoyue_store__` 桥驱动
 * 状态。⌘ 用 Control 代替（App 判定 metaKey || ctrlKey）。每个 state 截图落
 * `.artifacts/180/`，收尾写 state-coverage.json（≥6 passed）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/180");

mkdirSync(ART, { recursive: true });

type Assertion = "passed" | "failed" | "untested";
interface StateRow {
  state: string;
  screenshot: string;
  assertion: Assertion;
  recorded_at: string;
  runner: string;
}
const states: StateRow[] = [];

async function record(
  page: Page,
  state: string,
  assertion: Assertion = "passed",
): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion,
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
}

test.afterAll(() => {
  const byState = new Map<string, StateRow>();
  for (const row of states) byState.set(row.state, row);
  const payload = {
    task: "180-grid-overview",
    states: [...byState.values()],
  };
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

/** 播种：跨 今天/昨天/本周/更早 四桶 + 多类型（供缩略图与尺寸分型）。 */
async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        setState: (s: Record<string, unknown>) => void;
      };
    };
    const now = Date.now();
    const DAY = 86_400_000;
    const ref = new Date(now);
    const startToday = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate(),
    ).getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const files = [
      {
        path: "/lib/today.md",
        title: "今天的甲.md",
        openedAt: iso(startToday + 3 * 3_600_000),
        excerpt:
          "# 今天的甲\n\n这是今天打开的第一份文档正文，用来验证真实摘要渲染。",
      },
      {
        path: "/lib/cover.md",
        title: "有封面的丁.md",
        openedAt: iso(startToday + 2 * 3_600_000),
        excerpt: "![封面](./cover.png)\n# 有封面\n\n带首图的 Markdown 文档。",
      },
      {
        path: "/lib/shot.png",
        title: "截图.png",
        openedAt: iso(startToday + 1 * 3_600_000),
        excerpt: "",
      },
      {
        path: "/lib/yesterday.html",
        title: "昨天的乙.html",
        openedAt: iso(startToday - 3 * 3_600_000),
        excerpt: "<html><body>昨天的页面</body></html>",
      },
      {
        path: "/lib/week.md",
        title: "本周的丙.md",
        openedAt: iso(startToday - 3 * DAY),
        excerpt: "# 本周的丙\n\n本周打开，摘要两到三行。",
      },
      {
        path: "/lib/plain.txt",
        title: "纯文本.txt",
        openedAt: iso(startToday - 2 * DAY),
        excerpt: "",
      },
      {
        path: "/lib/older.pdf",
        title: "更早的戊.pdf",
        openedAt: iso(startToday - 30 * DAY),
        excerpt: "",
      },
    ];
    w.__biaoyue_store__.setState({
      recentFiles: files,
      scrollPositions: {
        "/lib/today.md": { scrollPos: 50, contentHeight: 100 },
      },
      scene: "workspace",
    });
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

async function enterGridWithShortcut(page: Page): Promise<void> {
  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
}

async function enterGridViaTile(page: Page, kind: string): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setScene: (s: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setScene("portal");
  });
  await page.locator(`[data-tile-kind="${kind}"]`).click();
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
}

test("⌘⇧\\ 打开网格：搜索框未聚焦、第一张卡为选中态", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  // 搜索框未聚焦
  const searchFocused = await page.evaluate(
    () => document.activeElement?.hasAttribute("data-grid-search") ?? false,
  );
  expect(searchFocused).toBe(false);

  // 恰好一张选中，且是 DOM 顺序里的第一张卡
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  const firstPath = await page
    .locator("[data-grid-item]")
    .first()
    .getAttribute("data-grid-item");
  const selectedPath = await page
    .locator('[data-selected="true"]')
    .getAttribute("data-grid-item");
  expect(selectedPath).toBe(firstPath);
  expect(selectedPath).toBe("/lib/today.md");

  await record(page, "01-open-select");
});

test("门户磁贴点击进入后列表严格等于该类型文件", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridViaTile(page, "markdown");

  await expect(page.locator('[data-testid="grid"]')).toHaveAttribute(
    "data-grid-filter",
    "markdown",
  );
  const items = page.locator("[data-grid-item]");
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(items.nth(i)).toHaveAttribute("data-tile-kind", "markdown");
  }
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("3 项");

  await record(page, "02-portal-type-filter");
});

test("顶部排序/分组/收藏为原生下拉；类型筛选为 hover 自定义菜单", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  // 排序/分组/收藏仍是原生 SELECT
  const selects = page.locator('[data-testid="grid-toolbar"] select');
  await expect(selects).toHaveCount(3);
  const selectTags = await selects.evaluateAll((els) =>
    els.map((el) => el.tagName),
  );
  expect(selectTags).toEqual(["SELECT", "SELECT", "SELECT"]);

  // 每个下拉都是真下拉：至少两个可选项
  const optionCounts = await selects.evaluateAll((els) =>
    els.map((el) => el.querySelectorAll("option").length),
  );
  expect(optionCounts).toHaveLength(3);
  for (const n of optionCounts) expect(n).toBeGreaterThanOrEqual(2);

  // 类型筛选改为按钮 + 受控菜单
  const typeTrigger = page.locator("[data-grid-type-select]");
  await expect(typeTrigger).toHaveAttribute("aria-haspopup", "menu");
  await expect(typeTrigger).toHaveAttribute("aria-expanded", "false");

  // 网格/列表是两颗各自定值的按钮：恰好 grid / list，各自带 aria-pressed
  const toggles = page.locator("[data-grid-mode-toggle] button");
  await expect(toggles).toHaveCount(2);
  const toggleState = await toggles.evaluateAll((els) =>
    els.map((el) => ({
      mode: el.getAttribute("data-grid-mode"),
      pressed: el.getAttribute("aria-pressed"),
    })),
  );
  expect(toggleState).toEqual([
    { mode: "grid", pressed: "true" },
    { mode: "list", pressed: "false" },
  ]);

  // 下拉真的生效：选 markdown 后只剩该类型，计数同步
  await page.locator("[data-grid-type-select]").hover();
  await page.locator('[data-grid-type-option="markdown"]').click();
  const items = page.locator("[data-grid-item]");
  const n = await items.count();
  expect(n).toBe(3);
  for (let i = 0; i < n; i += 1) {
    await expect(items.nth(i)).toHaveAttribute("data-tile-kind", "markdown");
  }

  // 排序下拉：切到名称，首项按标题升序
  await page.locator("[data-grid-type-select]").hover();
  await page.locator('[data-grid-type-option="all"]').click();
  await page.locator("[data-grid-sort-select]").selectOption("name");

  // AI 视图规格「网格按类型分组」仍真的改变网格（9.1 → 10.1 桥接，不空操作）
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            applyViewSpec: (p: { gridGrouping: string }) => void;
          };
        };
      }
    ).__biaoyue_store__
      .getState()
      .applyViewSpec({ gridGrouping: "type" });
  });
  await expect(page.locator("[data-grid-group-head]").first()).toHaveText(
    "Markdown",
  );

  await record(page, "03-dropdowns");
});

test("tile 三型：2×2 / 2×1 / 1×1 跨度、2px 类型色顶条、4:3 缩略图", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const large = page.locator('[data-grid-item="/lib/today.md"]');
  const medium = page.locator('[data-grid-item="/lib/shot.png"]');
  const small = page.locator('[data-grid-item="/lib/plain.txt"]');

  await expect(large).toHaveAttribute("data-tile-size", "large");
  await expect(medium).toHaveAttribute("data-tile-size", "medium");
  await expect(small).toHaveAttribute("data-tile-size", "small");

  const lb = (await large.boundingBox())!;
  const mb = (await medium.boundingBox())!;
  const sb = (await small.boundingBox())!;
  const gap = 12;
  // 跨度：大 = 2 列 × 2 行；中 = 2 列 × 1 行；小 = 1 × 1
  expect(Math.abs(lb.width - (2 * sb.width + gap))).toBeLessThanOrEqual(2);
  expect(Math.abs(lb.height - (2 * sb.height + gap))).toBeLessThanOrEqual(2);
  expect(Math.abs(mb.width - (2 * sb.width + gap))).toBeLessThanOrEqual(2);
  expect(Math.abs(mb.height - sb.height)).toBeLessThanOrEqual(2);
  expect(lb.height).toBeGreaterThan(sb.height);

  // 2px 类型色顶条：computed height 严格 2px，颜色 = markdown 类型色
  const bar = large.locator("[data-tile-topbar]");
  const barStyle = await bar.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { height: cs.height, bg: cs.backgroundColor };
  });
  expect(barStyle.height).toBe("2px");
  expect(barStyle.bg).toBe("rgb(99, 102, 241)");

  // 4:3 缩略图（bounding box 宽高比 ≈ 1.333）
  const thumb = large.locator("[data-tile-thumb]");
  await expect(thumb).toHaveCount(1);
  const tb = (await thumb.boundingBox())!;
  expect(Math.abs(tb.width / tb.height - 4 / 3)).toBeLessThanOrEqual(0.02);

  // 中/小两型同样是 2px 顶条 + 4:3 缩略图
  for (const tile of [medium, small]) {
    const h = await tile
      .locator("[data-tile-topbar]")
      .evaluate((el) => getComputedStyle(el).height);
    expect(h).toBe("2px");
    const b = (await tile.locator("[data-tile-thumb]").boundingBox())!;
    expect(Math.abs(b.width / b.height - 4 / 3)).toBeLessThanOrEqual(0.02);
  }

  // 大 tile 的阅读进度是真实数据（scrollPositions 50/100 → 已读 50%，轨高 2px）
  const progress = large.locator("[data-tile-progress]");
  await expect(progress).toBeVisible();
  const trackHeight = await progress
    .locator("span")
    .first()
    .evaluate((el) => getComputedStyle(el).height);
  expect(trackHeight).toBe("2px");
  await expect(progress).toContainText("已读 50%");

  // 网格滚动容器不得出现横向溢出
  const overflow = await page
    .locator('[data-testid="grid"]')
    .evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  await record(page, "04-tile-sizes");
});

test("收藏 → 大 tile；取消收藏后大 tile 无残留", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const target = page.locator('[data-grid-item="/lib/week.md"]');
  await expect(target).toHaveAttribute("data-tile-size", "medium");

  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { togglePinnedPath: (p: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .togglePinnedPath("/lib/week.md");
  });

  await expect(target).toHaveAttribute("data-tile-size", "large");
  const pinnedSpan = await target.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { col: cs.gridColumnStart, row: cs.gridRowStart };
  });
  expect(pinnedSpan.col).toBe("span 2");
  expect(pinnedSpan.row).toBe("span 2");
  await record(page, "05-pin-large");

  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { togglePinnedPath: (p: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .togglePinnedPath("/lib/week.md");
  });
  await expect(target).toHaveAttribute("data-tile-size", "medium");
});

test("时间粘性分组头（今天/昨天/本周/更早），滚动后仍有头贴顶", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const heads = page.locator("[data-grid-group-head]");
  await expect(heads).toHaveCount(4);
  const labels = (await heads.allInnerTexts()).map((t) => t.trim());
  expect(labels).toEqual(["今天", "昨天", "本周", "更早"]);

  const positions = await heads.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).position),
  );
  expect(positions).toEqual(["sticky", "sticky", "sticky", "sticky"]);

  const grid = page.locator('[data-testid="grid"]');
  await grid.evaluate((el) => {
    el.scrollTop = 420;
  });
  const gb = (await grid.boundingBox())!;
  const headBoxes = await heads.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().top),
  );
  const minDelta = Math.min(...headBoxes.map((top) => Math.abs(top - gb.y)));
  expect(minDelta).toBeLessThanOrEqual(2);

  // A-4.2：滚动后可见的分组头之间不得互相压住
  const visible = await heads.evaluateAll((els) =>
    els
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.bottom > 0 && r.top < window.innerHeight)
      .map((r) => ({ top: r.top, bottom: r.bottom })),
  );
  expect(visible.length).toBeGreaterThan(0);
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i];
      const b = visible[j];
      expect(
        a.bottom <= b.top + 1 || b.bottom <= a.top + 1,
        `分组头垂直重叠：${JSON.stringify({ a, b })}`,
      ).toBe(true);
    }
  }

  await record(page, "06-sticky-headers");
});

test("点击档：贴卡右缘 +12 弹出真内容预览；Esc 关闭无残留", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const card = page.locator('[data-grid-item="/lib/today.md"]');
  const cb = (await card.boundingBox())!;
  await card.locator("[data-tile-thumb]").click();

  const preview = page.locator('[data-testid="floating-preview"]');
  await expect(preview).toBeVisible();
  await expect(page.locator('[data-testid="preview-doc"]')).toBeVisible();
  await expect(preview).toHaveAttribute("data-flipped-x", "false");

  const pb = (await preview.boundingBox())!;
  const expectedX = Math.round(cb.x + cb.width) + 12;
  expect(Math.abs(pb.x - expectedX)).toBeLessThanOrEqual(1);

  await record(page, "07-click-preview");

  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
});

test("搜索：/ 聚焦、输入过滤列表、× 清除恢复计数", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("7 项");

  await page.keyboard.press("/");
  const focused = await page.evaluate(
    () => document.activeElement?.hasAttribute("data-grid-search") ?? false,
  );
  expect(focused).toBe(true);

  await page.keyboard.type("本周");
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("1 项");
  await expect(page.locator("[data-grid-item]")).toHaveCount(1);
  await record(page, "08-search-filter");

  await page.locator("[data-grid-search-clear]").click();
  await expect(page.locator("[data-grid-search]")).toHaveValue("");
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("7 项");

  // SELECT 聚焦时 / 不抢焦点
  await page.locator("[data-grid-sort-select]").focus();
  await page.keyboard.press("/");
  const focusedOnSelect = await page.evaluate(
    () => document.activeElement?.hasAttribute("data-grid-search") ?? false,
  );
  expect(focusedOnSelect).toBe(false);
});

test("网格/列表切换：列表单列渲染、网格恢复，viewSpec.gridMode 同步", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const grid = page.locator('[data-testid="grid"]');
  await expect(grid).toHaveAttribute("data-grid-mode", "grid");
  await expect(page.locator('[data-tile-size="row"]')).toHaveCount(0);

  await page.locator('[data-grid-mode-toggle] [data-grid-mode="list"]').click();
  await expect(grid).toHaveAttribute("data-grid-mode", "list");
  await expect(page.locator('[data-tile-size="row"]')).toHaveCount(7);
  await expect(page.locator("[data-tile-size='large']")).toHaveCount(0);
  const mode = await page.evaluate(
    () =>
      (
        window as unknown as {
          __biaoyue_store__: {
            getState: () => { viewSpec: { gridMode: string } };
          };
        }
      ).__biaoyue_store__.getState().viewSpec.gridMode,
  );
  expect(mode).toBe("list");
  await record(page, "09-list-mode");

  await page.locator('[data-grid-mode-toggle] [data-grid-mode="grid"]').click();
  await expect(grid).toHaveAttribute("data-grid-mode", "grid");
  await expect(page.locator('[data-tile-size="row"]')).toHaveCount(0);
});

test("收藏筛选：仅收藏只剩该条并计数 1 项，切回全部恢复 7 项", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { togglePinnedPath: (p: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .togglePinnedPath("/lib/week.md");
  });
  await expect(page.locator('[data-grid-item="/lib/week.md"]')).toHaveAttribute(
    "data-tile-size",
    "large",
  );

  await page.locator("[data-grid-pinned-select]").selectOption("pinned");
  const items = page.locator("[data-grid-item]");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute("data-grid-item", "/lib/week.md");
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("1 项");
  await record(page, "10-pinned-filter");

  await page.locator("[data-grid-pinned-select]").selectOption("all");
  await expect(items).toHaveCount(7);
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("7 项");
});

test("hover 操作区：显形、tile 抬起，打开动作进入工作区", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const tile = page.locator('[data-grid-item="/lib/today.md"]');
  await tile.hover();

  const actions = tile.locator("[data-tile-actions]");
  await expect
    .poll(() => actions.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  await expect
    .poll(() => tile.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe("none");
  await record(page, "11-hover-actions");

  await tile.locator('[data-tile-action="open"]').click();
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

  await expect(page.locator('[data-testid="grid"]')).toHaveCount(0);
  await record(page, "12-open-from-hover");
});

test("PDF 卡片不渲染悬停工具条，其他类型保持三个动作（#275）", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const pdf = page.locator('[data-grid-item="/lib/older.pdf"]');
  await pdf.hover();
  await expect(pdf.locator("[data-tile-actions]")).toHaveCount(0);
  await page.screenshot({
    path: path.join(ART275, "grid-pdf-no-actions.png"),
  });

  const md = page.locator('[data-grid-item="/lib/today.md"]');
  await md.hover();
  await expect(md.locator("[data-tile-actions] button")).toHaveCount(3);
  await page.screenshot({
    path: path.join(ART275, "grid-md-actions.png"),
  });
});
