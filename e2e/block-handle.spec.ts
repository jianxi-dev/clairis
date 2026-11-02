import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

async function openDoc(page: Page, path: string, content: string) {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: path, c: content },
  );
  await page.locator("button").filter({ hasText: "编辑" }).first().click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  return editor;
}

async function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return (state.tabs[state.activeTabId]?.content as string) ?? "";
  });
}

test("悬停块时手柄淡入", async ({ page }) => {
  await openDoc(page, "/Users/test/bh-hover.md", "第一段\n\n第二段");
  await page.locator(".cm-line").filter({ hasText: "第一段" }).first().hover();

  const handle = page.locator('.cm-block-handle[data-block-from="0"]');
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  // 42×26 药丸
  const box = await handle.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
});

test("拖第 2 段到第 1 段之前，源码只换序", async ({ page }) => {
  const doc = "第一段\n\n第二段";
  await openDoc(page, "/Users/test/bh-drag.md", doc);
  const second = page.locator(".cm-line").filter({ hasText: "第二段" }).first();
  await second.hover();
  const handle = page.locator('.cm-block-handle[data-block-from="5"]');
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });

  const from = await handle.boundingBox();
  const target = await page
    .locator(".cm-line")
    .filter({ hasText: "第一段" })
    .first()
    .boundingBox();
  if (!from || !target) throw new Error("missing layout box");

  await page.mouse.move(from.x + from.width - 6, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width - 6, from.y - 20, { steps: 4 });
  await page.mouse.move(target.x + 40, target.y + 4, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => storeContent(page)).toBe("第二段\n\n第一段");
});

test("空行「+」打开插入菜单", async ({ page }) => {
  await openDoc(page, "/Users/test/bh-add.md", "第一段\n\n\n第二段");
  const add = page.locator(".cm-block-handle-add").first();
  await add.hover();
  await expect(
    page.locator('.cm-block-handle[data-empty="true"]').first(),
  ).toHaveClass(/cm-block-handle-visible/, { timeout: 3000 });
  await add.click();
  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1);
});
