import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 宫格响应式（#1366 / change editor-batch3-lowcost 3.1）真实浏览器用例。
 *
 * 列数由 [data-grid-grid] 内容宽驱动（非视口宽）：1440 → 5、1024 → 4、
 * 800 → 3、窄于下限 → 1；gap 16；hover 3px 中性环（不上浮）；tile 跨度不变。
 * 走 e2e/mocks/tauri-mock.js + window.__biaoyue_store__ 桥，不依赖真实文件系统。
 */

const APP_URL = process.env.GRID_APP_URL ?? "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1366");

mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

/** 12 张卡：首张为「继续阅读」→ 大；其余按摘要有无出中/小，供跨度断言。全部落在今天，保证单组单网格、用例不随运行时刻漂移。 */
async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        setState: (s: Record<string, unknown>) => void;
      };
    };
    const ref = new Date();
    const startToday = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate(),
    ).getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const files = Array.from({ length: 12 }, (_, i) => ({
      path: `/lib/doc-${i}.md`,
      title: `文档 ${i}.md`,
      openedAt: iso(startToday + (i + 1) * 3_600_000),
      excerpt: i % 3 === 0 ? "" : `第 ${i} 份文档的摘要正文。`,
    }));
    w.__biaoyue_store__.setState({ recentFiles: files, scene: "workspace" });
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

async function enterGrid(page: Page): Promise<void> {
  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await expect(page.locator("[data-grid-item]")).toHaveCount(12);
}

async function columnsOf(page: Page): Promise<number> {
  return page.locator("[data-grid-grid]").first().evaluate((el) => {
    // 读组件写入的显式列数：1 列时 2 跨 tile 会生成隐式轨道，不能按计算轨道数推断。
    const m = /repeat\(\s*(\d+)/.exec(el.style.gridTemplateColumns);
    return m ? Number(m[1]) : 0;
  });
}

async function setGridWidth(page: Page, width: number): Promise<void> {
  await page.locator("[data-grid-grid]").first().evaluate(
    (el, w) => {
      el.style.width = `${w}px`;
    },
    width,
  );
}

test("列数随容器内容宽：1440→5、1024→4、800→3、窄于下限→1；gap 16", async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await enterGrid(page);

  const grid = page.locator("[data-grid-grid]").first();
  await expect(grid).toBeVisible();

  for (const [width, expected] of [
    [1440, 5],
    [1024, 4],
    [800, 3],
    [300, 1],
  ] as const) {
    await setGridWidth(page, width);
    await expect
      .poll(() => columnsOf(page), { message: `内容宽 ${width} 应为 ${expected} 列` })
      .toBe(expected);

    const metrics = await grid.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        gap: cs.gap,
        gridAutoRows: cs.gridAutoRows,
        gridAutoFlow: cs.gridAutoFlow,
      };
    });
    expect(metrics.gap, `内容宽 ${width} 的 gap`).toBe("16px");
    expect(metrics.gridAutoRows).toBe("168px");
    expect(metrics.gridAutoFlow).toBe("dense");
  }

  await page.screenshot({ path: path.join(ART, "responsive-columns.png") });
});

test("hover 出 3px 中性环、移开无残留，不上浮", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGrid(page);

  const tile = page.locator('[data-grid-item="/lib/doc-1.md"]');
  await expect(tile).toBeVisible();

  const rest = await tile.evaluate((el) => ({
    boxShadow: getComputedStyle(el).boxShadow,
    transform: getComputedStyle(el).transform,
  }));
  expect(rest.boxShadow).toBe("none");

  await tile.hover();
  await expect
    .poll(() => tile.evaluate((el) => getComputedStyle(el).boxShadow))
    .toContain("3px");
  const hovered = await tile.evaluate((el) => ({
    boxShadow: getComputedStyle(el).boxShadow,
    transform: getComputedStyle(el).transform,
  }));
  expect(hovered.transform).toBe("none");
  await page.screenshot({ path: path.join(ART, "hover-ring.png") });

  await page.mouse.move(4, 4);
  await expect
    .poll(() => tile.evaluate((el) => getComputedStyle(el).boxShadow))
    .toBe("none");
});

test("tile 跨度保持 1×1 / 2×1 / 2×2", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGrid(page);

  const spans = await page.locator("[data-grid-item]").evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      return {
        size: el.getAttribute("data-tile-size"),
        col: cs.gridColumnStart,
        row: cs.gridRowStart,
      };
    }),
  );

  const bySize = (size: string) => spans.filter((s) => s.size === size);
  expect(bySize("large").length).toBeGreaterThan(0);
  expect(bySize("medium").length).toBeGreaterThan(0);
  expect(bySize("small").length).toBeGreaterThan(0);

  for (const s of spans) {
    if (s.size === "large") {
      expect(s.col).toBe("span 2");
      expect(s.row).toBe("span 2");
    } else if (s.size === "medium") {
      expect(s.col).toBe("span 2");
      expect(s.row).toBe("span 1");
    } else {
      expect(s.col).toBe("span 1");
      expect(s.row).toBe("span 1");
    }
  }
});
