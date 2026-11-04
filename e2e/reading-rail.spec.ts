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

mkdirSync(ART, { recursive: true });

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
  await page.waitForSelector("header", { timeout: 15000 });
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
