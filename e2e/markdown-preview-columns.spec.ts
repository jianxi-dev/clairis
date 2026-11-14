import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function openDoc(
  page: Page,
  path: string,
  content: string,
  title: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ([p, c, t]) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(p, c, t);
    },
    [path, content, title],
  );
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

test("A-5.1 ::: {.col-2} 渲染为两栏网格（editor-surface-batch17 5.1）", async ({
  page,
}) => {
  await openDoc(
    page,
    "/tmp/col-preview.md",
    "::: {.col-2}\n# 左栏\n\n# 右栏\n:::",
    "col-preview.md",
  );

  const container = page.locator(".preview-content .layout-col-2");
  await expect(container).toHaveCount(1);

  const text = await page.locator(".preview-content").innerText();
  expect(text).not.toContain(":::");

  const xs = await container.evaluate((el) =>
    Array.from(el.children).map((c) => c.getBoundingClientRect().x),
  );
  expect(xs.length).toBeGreaterThan(1);
  expect(Math.abs(xs[1] - xs[0])).toBeGreaterThan(0);
});

test("无 col 的 ::: 围栏保持原样、不吞内容", async ({ page }) => {
  await openDoc(
    page,
    "/tmp/note-preview.md",
    "::: {.note}\n正文\n:::",
    "note-preview.md",
  );

  expect(await page.locator(".preview-content .layout-col-2").count()).toBe(0);
  const text = await page.locator(".preview-content").innerText();
  expect(text).toContain(":::");
  expect(text).toContain("正文");
});
