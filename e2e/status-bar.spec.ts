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

test("状态栏右侧四入口顺序为 网格 / AI / 主题 / 沉浸", async ({ page }) => {
  await boot(page);
  const order = await page.getByTestId("status-bar").evaluate((el) =>
    Array.from(el.querySelectorAll("button")).map((b) => {
      const testId = b.getAttribute("data-testid");
      if (testId) return testId;
      if (b.hasAttribute("data-ai-entry")) return "ai-entry";
      if (b.getAttribute("title")?.startsWith("当前:")) return "theme";
      return "?";
    }),
  );
  expect(order).toEqual(["grid-entry", "ai-entry", "theme", "immersive-entry"]);
});

test("点击状态栏沉浸入口进入沉浸模式，状态栏常驻", async ({ page }) => {
  await boot(page);
  await openDoc(page, "/tmp/sb/a.md", "# 标题\n\n正文内容");

  const entry = page.getByTestId("immersive-entry");
  await expect(entry).toHaveAttribute("aria-pressed", "false");
  await entry.click();
  await expect(entry).toHaveAttribute("aria-pressed", "true");

  const readingMode = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { readingMode: boolean };
        };
      }
    ).__biaoyue_store__.getState();
    return s.readingMode;
  });
  expect(readingMode).toBe(true);

  // 顶栏收拢为 0，状态栏仍在底部且可见
  await expect
    .poll(() =>
      page
        .getByRole("banner")
        .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
    )
    .toBe(0);
  const barBox = await page.getByTestId("status-bar").boundingBox();
  expect(barBox).not.toBeNull();
  expect(barBox!.height).toBeGreaterThan(0);
});
