import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="status-bar"]', { timeout: 10000 });
}

async function openDoc(
  page: Page,
  path: string,
  content: string,
): Promise<void> {
  await page.evaluate(
    ([p, c]) => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_openFile__(p, c, p.split("/").pop());
    },
    [path, content],
  );
}

test("状态栏左侧读出当前页签的行数 / 字数 / 进度 / 宽度", async ({ page }) => {
  await boot(page);
  await openDoc(page, "/tmp/sb/a.md", "# 标题\n\n正文内容");

  const bar = page.getByTestId("status-bar");
  await expect(bar.getByTestId("status-lines")).toHaveText("行 3");
  await expect(bar.getByTestId("status-words")).toHaveText("6 字");
  await expect(bar.getByTestId("status-progress")).toHaveText("0%");
  await expect(bar.getByTestId("status-width")).toHaveText("1080px");
});

test("状态栏右侧六入口顺序为 主页 / 自动布局 / 网格 / AI / 主题 / 沉浸", async ({
  page,
}) => {
  await boot(page);
  const order = await page.getByTestId("status-bar").evaluate((el) => {
    const ids = [
      "home-entry",
      "auto-layout-entry",
      "grid-entry",
      "ai-entry",
      "theme-entry",
      "immersive-entry",
    ];
    return ids.filter((id) => el.querySelector(`[data-testid="${id}"]`));
  });
  expect(order).toEqual([
    "home-entry",
    "auto-layout-entry",
    "grid-entry",
    "ai-entry",
    "theme-entry",
    "immersive-entry",
  ]);
  // 宽度控件在六入口之前，不参与入口顺序。
  const widthBeforeHome = await page
    .getByTestId("status-bar")
    .evaluate((el) => {
      const width = el.querySelector('[data-testid="status-width"]');
      const home = el.querySelector('[data-testid="home-entry"]');
      return (
        !!width &&
        !!home &&
        !!(
          width.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING
        )
      );
    });
  expect(widthBeforeHome).toBe(true);
});

test("点击状态栏沉浸入口进入沉浸模式，状态栏自动隐藏、底部热区出现", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page, "/tmp/sb/a.md", "# 标题\n\n正文内容");

  const entry = page.getByTestId("immersive-entry");
  await expect(entry).toHaveAttribute("aria-pressed", "false");
  await entry.click();

  const readingMode = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: { getState: () => { readingMode: boolean } };
      }
    ).__biaoyue_store__.getState();
    return s.readingMode;
  });
  expect(readingMode).toBe(true);

  // 规格 application-shell:339：沉浸态状态栏自动隐藏（不占位），底部热区接管。
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  await expect(page.getByTestId("status-hotzone")).toHaveCount(1);

  // 页签条同时收拢为 0（顶栏让位给正文）。
  await expect
    .poll(() =>
      page
        .locator('[data-testid="pane-header"]')
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
    )
    .toBe(0);
});
