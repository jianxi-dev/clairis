import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/ip/a.md", "# A\n\n正文。", "a.md");
    w.__biaoyue_store__.getState().setScene("workspace");
  });
}

async function twoPanes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().splitPane("row");
  });
  await page.waitForTimeout(300);
}

async function headerHeights(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-pane-id]")).map((pane) => {
      const id = pane.getAttribute("data-pane-id");
      const header = pane.querySelector<HTMLElement>(
        '[data-testid="pane-header"]',
      );
      return {
        id,
        h: header ? Math.round(header.getBoundingClientRect().height) : -1,
        paneW: Math.round(pane.getBoundingClientRect().width),
        headerW: header ? Math.round(header.getBoundingClientRect().width) : -1,
      };
    }),
  );
}

test("沉浸态每栏独立展开：只显示指针所在栏的页签条", async ({ page }) => {
  await boot(page);
  await twoPanes(page);
  await page.evaluate(() =>
    window.__biaoyue_store__.getState().setReadingMode(true),
  );
  await page.waitForTimeout(500);

  const collapsed = await headerHeights(page);
  expect(collapsed.length).toBe(2);
  expect(collapsed.every((p) => p.h === 0)).toBe(true);
  await expect(page.getByTestId("immersive-peek-zone")).toHaveCount(0);

  const left = collapsed[0];
  await page.locator(`[data-pane-hotzone="${left.id}"]`).hover();
  await expect
    .poll(async () => (await headerHeights(page))[0].h, { timeout: 3000 })
    .toBeGreaterThan(0);

  const opened = await headerHeights(page);
  expect(opened[0].h).toBeGreaterThan(0);
  expect(opened[1].h).toBe(0);
  expect(Math.abs(opened[0].headerW - opened[0].paneW)).toBeLessThanOrEqual(2);

  const right = collapsed[1];
  await page.locator(`[data-pane-hotzone="${right.id}"]`).hover();
  await expect
    .poll(
      async () => {
        const s = await headerHeights(page);
        return s[0].h === 0 && s[1].h > 0;
      },
      { timeout: 3000 },
    )
    .toBe(true);
});

test("退出沉浸后所有栏页签条恢复显示", async ({ page }) => {
  await boot(page);
  await twoPanes(page);
  await page.evaluate(() =>
    window.__biaoyue_store__.getState().setReadingMode(true),
  );
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    window.__biaoyue_store__.getState().setReadingMode(false),
  );
  await page.waitForTimeout(400);
  const heights = await headerHeights(page);
  expect(heights.every((p) => p.h > 0)).toBe(true);
});

test("沉浸态页签条为浮层：absolute 定位且不改变正文高度", async ({ page }) => {
  await boot(page);
  await page.evaluate(() =>
    window.__biaoyue_store__.getState().setReadingMode(true),
  );
  await page.waitForTimeout(500);

  const bodyBoxBefore = await page.evaluate(() => {
    const pane = document.querySelector("[data-pane-id]") as HTMLElement;
    const content = pane.querySelector(".cm-editor") as HTMLElement | null;
    const el = content ?? pane;
    return Math.round(el.getBoundingClientRect().height);
  });

  const paneId = await page.evaluate(() =>
    document.querySelector("[data-pane-id]")?.getAttribute("data-pane-id"),
  );
  await page.locator(`[data-pane-hotzone="${paneId}"]`).hover();
  await page.waitForTimeout(500);

  const probe = await page.evaluate(() => {
    const pane = document.querySelector("[data-pane-id]") as HTMLElement;
    const header = pane.querySelector<HTMLElement>(".app-chrome");
    const content = pane.querySelector(".cm-editor") as HTMLElement | null;
    const el = content ?? pane;
    return {
      position: header ? getComputedStyle(header).position : "missing",
      visible: header ? getComputedStyle(header).opacity : "missing",
      bodyHeight: Math.round(el.getBoundingClientRect().height),
    };
  });
  expect(probe.position).toBe("absolute");
  expect(probe.visible).toBe("1");
  expect(probe.bodyHeight).toBe(bodyBoxBefore);
});
