import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 页签视觉与沉浸收纳（workspace-ux-batch4 / #273）。
 *
 * 三个断言面：
 * 1. 未选中页签透明、无胶囊；悬停才出胶囊（计算样式，不是元素存在）。
 * 2. 页签条容器透明，与栏目头/顶栏同色。
 * 3. 沉浸态顶栏与页签条高度归零；顶部热区唤出悬浮页签条，可切签、可退出。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/273");
mkdirSync(ART, { recursive: true });

type Store = {
  getState: () => {
    readingMode: boolean;
    immersiveChromeVisible: boolean;
    activeTabId: string | null;
    tabs: Record<string, { path: string | null }>;
    setReadingMode: (on: boolean) => void;
  };
};

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openTwoTabs(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
      __biaoyue_store__: Store;
    };
    w.__biaoyue_openFile__("/tmp/imm/a.md", "# A\n\n甲", "a.md");
    w.__biaoyue_openFile__("/tmp/imm/b.md", "# B\n\n乙", "b.md");
    const s = w.__biaoyue_store__.getState();
    s.setReadingMode(false);
  });
  await expect(page.locator('[data-pane-id="main"] [data-tab-id]')).toHaveCount(
    2,
  );
  await expect(page.locator(".preview-content")).toBeVisible();
}

function shot(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(ART, `${name}.png`) });
}

test("未选中页签透明无胶囊，悬停才出胶囊；页签条透明（#273）", async ({
  page,
}) => {
  await boot(page);
  await openTwoTabs(page);

  const tabs = page.locator('[data-pane-id="main"] [data-tab-id]');
  const inactive = tabs.nth(0);
  const active = tabs.nth(1);

  // 选中页签：胶囊
  expect(
    await active.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius),
    ),
  ).toBeGreaterThan(10);
  // 未选中页签：无胶囊、透明
  expect(
    await inactive.evaluate((el) => el.classList.contains("rounded-full")),
  ).toBe(false);
  expect(
    await inactive.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius),
    ),
  ).toBe(0);
  expect(
    await inactive.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");

  // 悬停才出胶囊
  await inactive.hover();
  await expect
    .poll(() =>
      inactive.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius),
      ),
    )
    .toBeGreaterThan(10);
  await shot(page, "tab-hover-capsule");

  // 移开后恢复透明、无胶囊
  await page.mouse.move(1000, 600);
  await expect
    .poll(() =>
      inactive.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius),
      ),
    )
    .toBe(0);

  // 页签条容器透明
  const stripBg = await inactive.evaluate(
    (el) => getComputedStyle(el.parentElement as Element).backgroundColor,
  );
  expect(stripBg).toBe("rgba(0, 0, 0, 0)");
  await shot(page, "tabs-transparent");
});

test("沉浸态顶栏收纳为 0，顶部热区唤出悬浮页签条并切签（#273）", async ({
  page,
}) => {
  await boot(page);
  await openTwoTabs(page);

  await page.locator('[data-testid="immersive-entry"]').click();
  // 流内顶栏与页签条高度归零
  await expect
    .poll(() =>
      page
        .locator("header")
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
    )
    .toBe(0);
  await expect
    .poll(() =>
      page
        .locator('[data-testid="pane-header"]')
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
    )
    .toBe(0);
  await shot(page, "immersive-collapsed");

  // 顶部热区 16px：停留 400ms 后出现悬浮页签条
  await page.mouse.move(400, 4);
  const bar = page.getByTestId("immersive-peek-bar");
  await expect(bar).toBeVisible({ timeout: 4000 });
  await shot(page, "immersive-peek-bar");

  // 悬浮条上切到 a.md，沉浸状态保持
  const barTabs = bar.locator("[data-tab-id]");
  await expect(barTabs).toHaveCount(2);
  await barTabs.nth(0).click();
  const state = await page.evaluate(() => {
    const w = window as unknown as { __biaoyue_store__: Store };
    const s = w.__biaoyue_store__.getState();
    return {
      activePath: s.tabs[s.activeTabId ?? ""]?.path ?? null,
      readingMode: s.readingMode,
    };
  });
  expect(state.activePath).toBe("/tmp/imm/a.md");
  expect(state.readingMode).toBe(true);
  await shot(page, "immersive-switched");

  // 离开热区与悬浮条 2s 后收起
  await page.mouse.move(1000, 600);
  await expect(bar).toHaveCount(0, { timeout: 5000 });

  // 再次唤出并退出沉浸：顶栏高度恢复
  await page.mouse.move(400, 4);
  await expect(bar).toBeVisible({ timeout: 4000 });
  await page.getByTestId("immersive-exit").click();
  await expect
    .poll(() =>
      page
        .locator("header")
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
    )
    .toBeGreaterThan(0);
});
