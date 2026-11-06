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
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
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

/** 在行的左缘 25% 召唤区里移动指针（D5：只有左 25% 召唤手柄）。 */
async function hoverLineLeft(page: Page, line: ReturnType<Page["locator"]>) {
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
}

test("悬停块时手柄淡入", async ({ page }) => {
  await openDoc(page, "/Users/test/bh-hover.md", "第一段\n\n第二段");
  await hoverLineLeft(
    page,
    page.locator(".cm-line").filter({ hasText: "第一段" }).first(),
  );

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
  await hoverLineLeft(page, second);
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

test("召唤区：左缘 25% 召唤，右缘 75% 不召唤", async ({ page }) => {
  await page.clock.install();
  await openDoc(page, "/Users/test/bh-zone.md", "第一段\n\n第二段");
  const geo = await page.evaluate(() => {
    const content = document.querySelector(".cm-content") as HTMLElement;
    const rect = content.getBoundingClientRect();
    const line = document.querySelector(".cm-line") as HTMLElement;
    const lineRect = line.getBoundingClientRect();
    return {
      left: rect.left,
      width: rect.width,
      lineTop: lineRect.top,
      lineHeight: lineRect.height,
    };
  });
  const lineY = geo.lineTop + geo.lineHeight / 2;
  const leftX = geo.left + geo.width * 0.1;
  const rightX = geo.left + geo.width * 0.9;

  await page.mouse.move(rightX, lineY);
  await page.clock.runFor(400);
  await expect(
    page.locator('[data-testid="block-handle"].cm-block-handle-visible'),
  ).toHaveCount(0);

  await page.mouse.move(leftX, lineY);
  await page.clock.runFor(400);
  await expect(
    page.locator('[data-testid="block-handle"].cm-block-handle-visible'),
  ).toHaveCount(1);
});

test("滑入手柄 60ms 内开出块菜单", async ({ page }) => {
  await page.clock.install();
  await openDoc(page, "/Users/test/bh-60ms.md", "第一段\n\n第二段");

  const line = page.locator(".cm-line").first();
  await hoverLineLeft(page, line);
  await page.clock.runFor(300);
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await page.clock.runFor(59);
  expect(await page.locator('[data-testid="block-menu"]').count()).toBe(0);
  await page.clock.runFor(1);
  expect(await page.locator('[data-testid="block-menu"]').count()).toBe(1);
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
