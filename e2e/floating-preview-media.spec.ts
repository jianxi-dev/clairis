import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const TALL_PNG =
  "data:image/png;base64," +
  readFileSync(path.resolve(process.cwd(), "e2e/fixtures/tall.png")).toString(
    "base64",
  );

async function boot(page: Page, recordDirect = false): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((png) => {
    const w = window as unknown as Record<string, any>;
    w.__TAURI_INTERNALS__.convertFileSrc = () => png;
  }, TALL_PNG);
  if (recordDirect) {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, any>;
      w.__opened_directly__ = [];
      const orig = w.__TAURI_INTERNALS__.invoke;
      w.__TAURI_INTERNALS__.invoke = (cmd: string, args: unknown) => {
        if (cmd === "open_file_direct") {
          w.__opened_directly__.push((args as { path?: string })?.path ?? "");
        }
        return orig(cmd, args);
      };
    });
  }
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/fp/doc.md", "# 文档\n\n正文。", "doc.md");
  });
}

async function openPreview(
  page: Page,
  path: string,
  w = 360,
  h = 300,
): Promise<void> {
  await page.evaluate(
    ({ path, w, h }) => {
      const st = window as unknown as Record<string, any>;
      st.__biaoyue_store__.getState().openPreview({
        path,
        title: path.split("/").pop(),
        x: 400,
        y: 100,
        w,
        h,
        flippedX: false,
        flippedY: false,
        source: "rail",
        narrow: false,
      });
    },
    { path, w, h },
  );
  await page
    .locator('[data-testid="floating-preview"]')
    .waitFor({ timeout: 3000 });
}

test("长图按内容区宽度铺开并可纵向滚动", async ({ page }) => {
  await boot(page);
  await openPreview(page, "/tmp/fp/tall.png");

  const img = page.locator('[data-testid="preview-media"] img');
  await expect(img).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => {
    const image = document.querySelector(
      '[data-testid="preview-media"] img',
    ) as HTMLImageElement;
    const box = image.parentElement as HTMLElement;
    return {
      imgW: image.getBoundingClientRect().width,
      imgH: image.getBoundingClientRect().height,
      boxW: box.clientWidth,
      scrollH: box.scrollHeight,
      clientH: box.clientHeight,
    };
  });
  expect(Math.abs(m.imgW - m.boxW)).toBeLessThanOrEqual(2);
  expect(m.imgH).toBeGreaterThan(m.clientH);
  expect(m.scrollH).toBeGreaterThan(m.clientH);
});

test("HTML 悬浮窗用本地地址直载并允许脚本", async ({ page }) => {
  await boot(page);
  await openPreview(page, "/tmp/fp/page.html");

  const frame = page.locator('[data-testid="preview-html"]');
  await expect(frame).toBeVisible({ timeout: 3000 });
  expect(await frame.getAttribute("srcdoc")).toBeNull();
  const src = (await frame.getAttribute("src")) ?? "";
  expect(src).toContain("page.html");
  const sandbox = (await frame.getAttribute("sandbox")) ?? "";
  expect(sandbox).toContain("allow-scripts");

  const directReads = await page.evaluate(
    () =>
      (
        (window as unknown as Record<string, string[]>).__opened_directly__ ??
        []
      ).length,
  );
  expect(directReads).toBe(0);
});

test("图片与 HTML 预览不预读文件内容", async ({ page }) => {
  await boot(page, true);
  await openPreview(page, "/tmp/fp/tall.png");
  await expect(page.locator('[data-testid="preview-media"] img')).toBeVisible({
    timeout: 3000,
  });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, string[]>).__opened_directly__,
    ),
  ).toEqual([]);
});
