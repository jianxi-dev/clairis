import { test, expect, type Page } from "@playwright/test";

/**
 * 门户首屏（layout-portal 2.1 / #172）。
 *
 * 三类判据（本仓三种识图方法对应三层数据）：
 *  - 确定量：元素数量、文本、类型色 rgb、进度百分比 —— 直接从 DOM 取，不经模型
 *  - 感知：截图交 scripts/vision/analyze.py 算色板/亮度（免费且不会错）
 *  - 状态机：门户 → 网格 → Esc → 门户，无残留
 */

const FILES: Array<[string, string, string]> = [
  ["/lib/a.md", "a.md", "# 甲\n正文甲"],
  ["/lib/b.md", "b.md", "# 乙\n正文乙"],
  ["/lib/c.html", "c.html", "<html><body><h1>丙</h1></body></html>"],
  ["/lib/d.pdf", "d.pdf", "%PDF-1.4"],
];

async function seed(page: Page, files = FILES) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((list) => {
    const w = window as unknown as Record<string, any>;
    const store = w.__biaoyue_store__;
    store.setState({ recentFiles: [] });
    for (const [path, title, content] of list) {
      w.__biaoyue_openFile__(path, content, title);
    }
    // 回到门户：本票的门户是启动首屏
    store.getState().setScene("portal");
  }, files);
}

test("门户齐备：问候语/日期、hero、最近卡、8 磁贴、快速动作、⌘P，无「来源」", async ({
  page,
}) => {
  await seed(page);
  const portal = page.locator('[data-testid="portal"]');
  await expect(portal).toBeVisible();

  await expect(page.locator('[data-testid="portal-greeting"]')).not.toBeEmpty();
  await expect(page.locator('[data-testid="portal-date"]')).not.toBeEmpty();
  await expect(page.locator('[data-testid="portal-hero"]')).toHaveCount(1);

  const cards = page.locator("[data-recent-path]");
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThanOrEqual(4);
  expect(cardCount).toBeLessThanOrEqual(6);

  // 磁贴严格等于 8 个，且每类都有计数
  const tiles = page.locator("[data-tile-kind]");
  await expect(tiles).toHaveCount(8);
  const kinds = await tiles.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-tile-kind")),
  );
  expect(kinds).toEqual([
    "markdown",
    "html",
    "text",
    "pdf",
    "video",
    "image",
    "code",
    "audio",
  ]);

  await expect(page.locator('[data-testid="quick-new"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-open-file"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-ai"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-hint"]')).toContainText("⌘P");

  // 无「来源」概念
  const text = await portal.innerText();
  expect(text).not.toContain("来源");
});

test("空态：三动作，hero 与磁贴计数无残留", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().clearRecentFiles();
    w.__biaoyue_store__.getState().setScene("portal");
  });

  await expect(page.locator('[data-testid="portal-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="empty-new"]')).toBeVisible();
  await expect(page.locator('[data-testid="empty-open"]')).toBeVisible();
  await expect(page.locator('[data-testid="empty-import"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-hero"]')).toHaveCount(0);
  await expect(page.locator("[data-tile-kind]")).toHaveCount(0);
});

test("磁贴 → 网格并按类型过滤，Esc 回门户无残留", async ({ page }) => {
  await seed(page);
  await page.locator('[data-tile-kind="markdown"]').click();

  const grid = page.locator('[data-testid="grid"]');
  await expect(grid).toBeVisible();
  await expect(grid).toHaveAttribute("data-grid-filter", "markdown");

  const items = page.locator("[data-grid-item]");
  const paths = await items.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-grid-item")),
  );
  // 最近优先：后打开的排在前面
  expect(paths.sort()).toEqual(["/lib/a.md", "/lib/b.md"]);
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("2 项");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="portal"]')).toBeVisible();
  await expect(page.locator('[data-testid="grid"]')).toHaveCount(0);
  // 过滤条件不残留到下次进入
  await page.locator('[data-tile-kind="html"]').click();
  await expect(page.locator('[data-testid="grid"]')).toHaveAttribute(
    "data-grid-filter",
    "html",
  );
});

test("hero 卡进度严格等于实际阅读进度", async ({ page }) => {
  await seed(page);
  // hero 取最近打开的那一份（后打开的在前）
  const heroPath = await page
    .locator("[data-recent-path]")
    .first()
    .getAttribute("data-recent-path");
  await page.evaluate((path) => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.setState({
      scrollPositions: { [path]: { scrollPos: 250, contentHeight: 1000 } },
    });
  }, heroPath);
  await expect(page.locator('[data-testid="hero-progress"]')).toHaveText(
    "已读 25%",
  );
});

test("冷启动：持久化的最近记录带真摘要，不是占位", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  // 等配置加载完把 recentFiles 灌进 store
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as Record<string, any>
          ).__biaoyue_store__.getState().recentFiles.length,
      ),
    )
    .toBeGreaterThan(0);

  await expect(
    page.locator(
      '[data-testid="portal-recent"] [data-recent-path="/Users/test/测试文档.md"]',
    ),
  ).toContainText("真实开头");
  const text = await page.locator('[data-testid="portal"]').innerText();
  expect(text).not.toContain("（还没有内容）");
});

test("冷启动点 hero：真的按路径打开文件并进入工作区", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as Record<string, any>
          ).__biaoyue_store__.getState().recentFiles.length,
      ),
    )
    .toBeGreaterThan(0);

  await page.locator('[data-testid="portal-hero"]').click();
  // 场景切到工作区，并且真的有一个页签（不是空工作区）
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = (
          window as unknown as Record<string, any>
        ).__biaoyue_store__.getState();
        return { scene: s.scene, tabs: Object.keys(s.tabs).length };
      }),
    )
    .toEqual({ scene: "workspace", tabs: 1 });
  await expect(page.locator('[data-testid="portal"]')).toHaveCount(0);
});

test("门户里按 ⌘W 不会关掉背后的页签", async ({ page }) => {
  await seed(page);
  const before = await page.evaluate(
    () =>
      Object.keys(
        (window as unknown as Record<string, any>).__biaoyue_store__.getState()
          .tabs,
      ).length,
  );
  await page.keyboard.press("ControlOrMeta+w");
  await page.waitForTimeout(200);
  const after = await page.evaluate(
    () =>
      Object.keys(
        (window as unknown as Record<string, any>).__biaoyue_store__.getState()
          .tabs,
      ).length,
  );
  expect(after).toBe(before);
  await expect(page.locator('[data-testid="portal"]')).toBeVisible();
});

test("重启后 hero 是最新那份，且保留原始时间", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as Record<string, any>
          ).__biaoyue_store__.getState().recentFiles.length,
      ),
    )
    .toBe(2);

  const order = await page.evaluate(() =>
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .recentFiles.map((f: { path: string; openedAt: string }) => f.path),
  );
  // mock 里 10:00 的测试文档在 09:00 的另一个之前
  expect(order).toEqual(["/Users/test/测试文档.md", "/Users/test/另一个.md"]);

  const heroPath = await page
    .locator('[data-testid="portal-hero"]')
    .getAttribute("data-recent-path");
  expect(heroPath).toBe("/Users/test/测试文档.md");
  // openedAt 没被重写成「刚刚」
  await expect(page.locator('[data-testid="portal-hero"]')).not.toContainText(
    "刚刚",
  );
});

test("快速动作四项齐全，生成学习页会把意图填进 AI 输入框", async ({ page }) => {
  await seed(page);
  await expect(page.locator('[data-testid="quick-new"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-open-file"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-study"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-ai"]')).toBeVisible();

  // 点它要真的唤起 AI 浮层，且输入框里是这个意图（不是空按钮）
  await page.locator('[data-testid="quick-study"]').click();
  const input = page.locator("[data-ai-input]");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue(/学习页/);
});

test("最近卡片显示阅读进度，与 scrollPositions 严格一致", async ({ page }) => {
  await seed(page);
  const path = "/lib/a.md";
  await page.evaluate((p) => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.setState({
      scrollPositions: { [p]: { scrollPos: 500, contentHeight: 1000 } },
    });
  }, path);
  await expect(page.locator(`[data-card-progress="${path}"]`)).toHaveText(
    " · 已读 50%",
  );
});
