import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/im/a.md", "# A\n\n正文。", "a.md");
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
}

async function setImmersive(page: Page, on: boolean): Promise<void> {
  await page.evaluate((v) => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setReadingMode(v);
  }, on);
  await page.waitForTimeout(400);
}

test("进入沉浸隐藏状态栏与未钉住的阅读空间，退出恢复", async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId("status-bar")).toBeVisible();
  await expect(page.getByTestId("rail-edge")).toHaveCount(1);

  await setImmersive(page, true);
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  await expect(page.getByTestId("status-hotzone")).toHaveCount(1);
  await expect(page.getByTestId("rail-edge")).toHaveCount(0);
  await expect(page.getByTestId("rail-panel")).toHaveCount(0);

  await setImmersive(page, false);
  await expect(page.getByTestId("status-bar")).toBeVisible();
  await expect(page.getByTestId("rail-edge")).toHaveCount(1);
});

test("沉浸态底部热区 500ms 唤出状态栏", async ({ page }) => {
  await boot(page);
  await setImmersive(page, true);
  await expect(page.getByTestId("status-bar")).toHaveCount(0);

  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });

  await page.mouse.move(600, 300);
  await expect(page.getByTestId("status-bar")).toHaveCount(0, {
    timeout: 3000,
  });
});

test("钉住的阅读空间在沉浸态保持可见", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setRailState("pinned");
  });
  await expect(page.getByTestId("rail-panel")).toHaveCount(1);

  await setImmersive(page, true);
  await expect(page.getByTestId("rail-panel")).toHaveCount(1);
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
});

test("顶栏无产品名，左栏无「阅读空间」可见文本", async ({ page }) => {
  await boot(page);

  const headerText = await page.getByTestId("pane-header").first().innerText();
  expect(headerText).not.toContain("标月");
  expect(headerText).not.toContain("Biaoyue");

  // 未钉住：折叠边缘只有图标，无可见标题
  const edge = page.getByTestId("rail-edge");
  await expect(edge).toHaveCount(1);
  expect(await edge.innerText()).not.toContain("阅读空间");

  // 钉住：左栏头部不再显示「阅读空间」标题
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setRailState("pinned");
  });
  await expect(page.getByTestId("rail-panel")).toHaveCount(1);
  expect(await page.getByTestId("rail-panel").innerText()).not.toContain(
    "阅读空间",
  );
});
