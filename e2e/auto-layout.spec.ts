import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { revealStatusBar } from "./helpers/ui-probe";

const ART = path.resolve(process.cwd(), ".artifacts/1046");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

/** 截图并登记 state-coverage.json（同 843 证据约定）。 */
async function shot(target: Page, name: string): Promise<void> {
  const file = path.join(ART, `${name}.png`);
  await target.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      name,
      "--screenshot",
      file,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
}

// 原生 Tauri 拖放无法在浏览器 e2e 触发，故驱动 App 暴露的同一处理函数。
async function dropPaths(page: Page, paths: string[]): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as Record<string, unknown>)
        .__biaoyue_dropPaths__ === "function",
    undefined,
    { timeout: 15000 },
  );
  await page.evaluate((ps) => {
    const w = window as unknown as Record<string, any>;
    return w.__biaoyue_dropPaths__(ps);
  }, paths);
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/al/a.md", "# A\n\n正文。", "a.md");
    w.__biaoyue_openFile__("/tmp/al/b.md", "# B\n\n正文。", "b.md");
    w.__biaoyue_store__.getState().setScene("workspace");
  });
  await revealStatusBar(page);
}

async function panes(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-pane-id]")).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-pane-id"),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }),
  );
}

test("按钮紧邻主页，两栏点击后左右均分", async ({ page }) => {
  await boot(page);
  const order = await page.evaluate(() => {
    const home = document.querySelector('[data-testid="home-entry"]')!;
    const next = home.nextElementSibling as HTMLElement | null;
    return next?.getAttribute("data-testid") ?? null;
  });
  expect(order).toBe("auto-layout-entry");

  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().splitPane("row");
  });
  await page.waitForTimeout(300);

  await page.getByTestId("auto-layout-entry").click();
  await page.waitForTimeout(400);

  const list = await panes(page);
  expect(list.length).toBe(2);
  const total = list[0].w + list[1].w;
  expect(Math.abs(list[0].w - total / 2)).toBeLessThanOrEqual(2);
  await expect(page.locator('[data-testid="pane-header"]')).toHaveCount(2);
});

test("四栏点击后成 2×2，页签不丢", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const st = window as unknown as Record<string, any>;
    const s = st.__biaoyue_store__.getState();
    s.splitPane("row");
    s.splitPane("row");
    s.splitPane("row");
  });
  await page.waitForTimeout(400);

  const before = await page.locator('[role="tab"]').count();
  await page.getByTestId("auto-layout-entry").click();
  await page.waitForTimeout(500);

  const list = await panes(page);
  expect(list.length).toBe(4);
  const xs = new Set(list.map((p) => p.x));
  const ys = new Set(list.map((p) => p.y));
  expect(xs.size).toBe(2);
  expect(ys.size).toBe(2);
  expect(await page.locator('[role="tab"]').count()).toBe(before);
});

test("单栏点击不产生变化", async ({ page }) => {
  await boot(page);
  const before = await panes(page);
  await page.getByTestId("auto-layout-entry").click();
  await page.waitForTimeout(300);
  const after = await panes(page);
  expect(after).toEqual(before);
});

test("窗口按钮避让：未钉住留保留区，钉住页签条复位", async ({ page }) => {
  await boot(page);

  // e2e 在 Chromium 中运行，没有原生红黄绿灯；window-controls-reserve 是
  // 原生按钮占位的等价断言，原生按钮由 OS 绘制。
  const reserve = page.getByTestId("window-controls-reserve");
  await expect(reserve).toHaveCount(1);

  const unpinned = await page.evaluate(() => {
    const r = document
      .querySelector('[data-testid="window-controls-reserve"]')!
      .getBoundingClientRect();
    const strip = document.querySelector(".tab-strip")!.getBoundingClientRect();
    const tab = document.querySelector('[role="tab"]')!.getBoundingClientRect();
    return {
      reserveWidth: r.width,
      reserveRight: r.right,
      stripLeft: strip.left,
      tabLeft: tab.left,
    };
  });
  expect(unpinned.reserveWidth).toBeGreaterThan(0);
  expect(unpinned.tabLeft).toBeGreaterThanOrEqual(unpinned.reserveRight + 2);

  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setRailState("pinned");
  });
  await expect(reserve).toHaveCount(0);

  const pinned = await page.evaluate(() => {
    const rail = document
      .querySelector('[data-testid="rail-panel"]')!
      .getBoundingClientRect();
    const strip = document.querySelector(".tab-strip")!.getBoundingClientRect();
    return { railRight: rail.right, stripLeft: strip.left };
  });
  expect(Math.abs(pinned.stripLeft - pinned.railRight)).toBeLessThanOrEqual(2);

  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setRailState("collapsed");
  });
  await expect(reserve).toHaveCount(1);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setRailState("pinned");
  });
  await expect(reserve).toHaveCount(0);

  const again = await page.evaluate(() => {
    const rail = document
      .querySelector('[data-testid="rail-panel"]')!
      .getBoundingClientRect();
    const strip = document.querySelector(".tab-strip")!.getBoundingClientRect();
    return { railRight: rail.right, stripLeft: strip.left };
  });
  expect(Math.abs(again.stripLeft - again.railRight)).toBeLessThanOrEqual(2);
});

test("拖入 3 个文件全部打开并按既有规则布局，动效类出现一次后消失", async ({
  page,
}) => {
  await boot(page);
  await shot(page, "01-before-drop");
  expect((await panes(page)).length).toBe(1);

  await dropPaths(page, ["/tmp/al/c.md", "/tmp/al/d.md", "/tmp/al/e.md"]);

  const body = page.locator('[data-testid="workspace-body"]');
  await expect(body).toHaveClass(/magic-layout/, { timeout: 2000 });
  await shot(page, "03-animation-class-present");

  // A-8.1：N 个支持文件 → N 栏全开。
  await expect(page.locator("[data-pane-id]")).toHaveCount(3);
  await expect(page.locator('[data-testid="pane-header"]')).toHaveCount(3);
  await expect(page.locator('[role="tab"]')).toHaveCount(5);

  // A-8.4：栏形等于 autoLayoutPanes 的 N=3 规则（row 0.5，右列 col 均分）。
  const shape = await page.evaluate(() => {
    const root = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState().paneRoot;
    const count = (n: any): number =>
      n.type === "leaf" ? 1 : count(n.children[0]) + count(n.children[1]);
    return {
      rootType: root.type,
      dir: root.dir,
      count: count(root),
      rightType: root.type === "node" ? root.children[1].type : null,
      rightDir: root.type === "node" ? root.children[1].dir : null,
    };
  });
  expect(shape).toEqual({
    rootType: "node",
    dir: "row",
    count: 3,
    rightType: "node",
    rightDir: "col",
  });

  const list = await panes(page);
  const sorted = [...list].sort((a, b) => a.x - b.x);
  const left = sorted[0];
  const right = sorted.slice(1);
  expect(right.length).toBe(2);
  expect(Math.abs(left.w - right[0].w)).toBeLessThanOrEqual(2);
  expect(Math.abs(right[0].x - right[1].x)).toBeLessThanOrEqual(2);
  expect(Math.abs(right[0].x - (left.x + left.w))).toBeLessThanOrEqual(6);
  expect(Math.abs(right[0].h - right[1].h)).toBeLessThanOrEqual(2);
  expect(Math.abs(right[1].y - (right[0].y + right[0].h))).toBeLessThanOrEqual(
    6,
  );
  expect(Math.abs(left.h - (right[0].h + right[1].h))).toBeLessThanOrEqual(6);

  // A-8.3：动效类在 ≤1s 内移除且无残留。
  await expect(body).not.toHaveClass(/magic-layout/, { timeout: 3000 });
  const cls = await body.getAttribute("class");
  expect(cls ?? "").not.toContain("magic-layout");
  await shot(page, "02-after-magic-layout");
});

test("拖入 2 个文件其中 1 个失败时整体不打开", async ({ page }) => {
  await boot(page);
  const beforeTabs = await page.locator('[role="tab"]').count();
  expect((await panes(page)).length).toBe(1);

  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__biaoyue_fail_open_paths__ =
      ["/tmp/al/d.md"];
  });
  await dropPaths(page, ["/tmp/al/c.md", "/tmp/al/d.md"]);

  // A-8.2：任一不支持 → 0 打开，无部分页签/栏，无动效。
  await expect(page.locator("[data-pane-id]")).toHaveCount(1);
  expect(await page.locator('[role="tab"]')).toHaveCount(beforeTabs);
  const opened = await page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    return Object.values(s.tabs).map((t: any) => t.path);
  });
  expect(opened).not.toContain("/tmp/al/c.md");
  expect(opened).not.toContain("/tmp/al/d.md");
  const cls = await page
    .locator('[data-testid="workspace-body"]')
    .getAttribute("class");
  expect(cls ?? "").not.toContain("magic-layout");
  await shot(page, "04-rejected-all-or-nothing");
});
