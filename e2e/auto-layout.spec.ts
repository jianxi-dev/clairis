import { test, expect, type Page } from "@playwright/test";

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
