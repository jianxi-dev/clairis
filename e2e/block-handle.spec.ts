import { test, expect, type Page } from "@playwright/test";
import { moveThrough } from "./helpers/ui-probe";
import { mkdirSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/372");
mkdirSync(ART, { recursive: true });
const ART698 = path.resolve(process.cwd(), ".artifacts/698");
mkdirSync(ART698, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
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

test("指针从正文分步滑入手柄即开块菜单（gate 未开也要开）", async ({
  page,
}) => {
  await openDoc(page, "/Users/test/bh-slide.md", "第一段\n\n第二段");
  const line = page.locator(".cm-line").first();
  const lineBox = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  // 手柄 opacity 0 但已布局，boundingBox 可测。
  const handle = page.locator(
    '[data-testid="block-handle"][data-block-from="0"]',
  );
  const handleBox = (await handle.boundingBox())!;
  // 从行中心（非召唤区）分步滑入召唤区再滑入手柄：pointerenter 落在 gate 的
  // 300ms 显现延迟内，旧实现会因为 gate 未开而直接 return，菜单永远不开。
  await moveThrough(
    page,
    [
      {
        x: lineBox.x + lineBox.width * 0.5,
        y: lineBox.y + lineBox.height / 2,
      },
      {
        x: content.left + content.width * 0.1,
        y: lineBox.y + lineBox.height / 2,
      },
      {
        x: handleBox.x + handleBox.width / 2,
        y: handleBox.y + handleBox.height / 2,
      },
    ],
    { steps: 3 },
  );
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
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

test("指针滑到空行「+」即打开插入菜单，不需点击", async ({ page }) => {
  await openDoc(page, "/Users/test/bh-add-hover.md", "第一段\n\n\n第二段");
  const add = page.locator(".cm-block-handle-add").first();
  await add.hover();

  await expect(page.locator(".mdb-slash-menu")).toHaveCount(1, {
    timeout: 3000,
  });
  await page.screenshot({ path: path.join(ART, "01-hover-open.png") });
});

test("菜单跟随指针：两个空行的菜单坐标不同", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const doc = Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 段正文`).join(
    "\n\n",
  );
  await openDoc(page, "/Users/test/bh-add-follow.md", doc);

  const tops = await page
    .locator(".cm-block-handle-add")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  const nearest = (target: number) =>
    tops.reduce(
      (best, top, index) =>
        Math.abs(top - target) < Math.abs(tops[best] - target) ? index : best,
      0,
    );
  const upper = nearest(160);
  const lower = nearest(560);
  expect(lower).not.toBe(upper);

  const menu = page.locator(".mdb-slash-menu");
  const readTop = async () =>
    menu.evaluate((el) => (el as HTMLElement).style.top);

  await page.locator(".cm-block-handle-add").nth(upper).hover();
  await expect(menu).toHaveCount(1, { timeout: 3000 });
  const firstTop = await readTop();

  await page.mouse.move(20, 20);
  await expect(menu).toHaveCount(0, { timeout: 2000 });

  await page.locator(".cm-block-handle-add").nth(lower).hover();
  await expect(menu).toHaveCount(1, { timeout: 3000 });
  const secondTop = await readTop();

  expect(secondTop).not.toBe(firstTop);
  await page.screenshot({ path: path.join(ART, "02-follow-pointer.png") });
});

test("指针从「+」移进菜单，菜单不消失", async ({ page }) => {
  await openDoc(page, "/Users/test/bh-add-enter.md", "第一段\n\n\n第二段");
  const add = page.locator(".cm-block-handle-add").first();
  await add.hover();
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1, { timeout: 3000 });

  await menu.hover();
  await page.waitForTimeout(400);
  await expect(menu).toHaveCount(1);
  await page.screenshot({ path: path.join(ART, "03-enter-menu.png") });
});

test("指针离开后 120ms 宽限期结束才收起", async ({ page }) => {
  await openDoc(page, "/Users/test/bh-add-leave.md", "第一段\n\n\n第二段");
  const add = page.locator(".cm-block-handle-add").first();
  await add.hover();
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toHaveCount(1, { timeout: 3000 });

  await page.mouse.move(20, 20);
  await expect(menu).toHaveCount(0, { timeout: 2000 });
  await page.screenshot({ path: path.join(ART, "04-after-leave.png") });
});

test("图片块与高亮块的块手柄按真实块型取图标（#649）", async ({ page }) => {
  const stateDir = path.resolve(process.cwd(), ".artifacts/650");
  mkdirSync(stateDir, { recursive: true });
  const doc =
    "![图片](photo.png)\n\n> [!NOTE] 高亮标题\n> 高亮正文\n\n普通段落";
  await openDoc(page, "/Users/test/bh-blocktypes.md", doc);

  const probe = await page.evaluate((text) => {
    const handles = Array.from(document.querySelectorAll(".cm-block-handle"));
    return {
      imageAt: 0,
      calloutAt: text.indexOf("> [!NOTE]"),
      icons: handles.map((h) => ({
        from: Number(h.getAttribute("data-block-from")),
        icon:
          h
            .querySelector(".cm-block-handle-icon svg")
            ?.getAttribute("data-icon") ?? null,
      })),
    };
  }, doc);

  const iconAt = (from: number) =>
    probe.icons.find((entry) => entry.from === from)?.icon ?? null;
  expect(iconAt(probe.imageAt)).toBe("ImageOutlined");
  expect(iconAt(probe.calloutAt)).toBe("CalloutOutlined");

  await hoverLineLeft(page, page.locator(".cm-line").first());
  await page.screenshot({ path: path.join(stateDir, "image-handle.png") });

  await hoverLineLeft(page, page.locator(".cm-line").nth(2));
  await page.screenshot({ path: path.join(stateDir, "callout-handle.png") });

  await hoverLineLeft(page, page.locator(".cm-line").first());
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  const menu = page.locator('[data-testid="block-menu"]');
  await expect(menu).toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-testid="block-menu-grid"]')).toHaveCount(0);
  await expect(
    page.locator('[data-testid="block-menu-action"]'),
  ).not.toHaveCount(0);
  await page.screenshot({ path: path.join(stateDir, "image-block-menu.png") });

  await page.mouse.move(20, 20);
  await hoverLineLeft(page, page.locator(".cm-line").last());
  await page.screenshot({ path: path.join(stateDir, "paragraph-handle.png") });
  await page.screenshot({ path: path.join(ART, "05-block-type-icons.png") });
});

test("拖第 3 段到第 1 段上方：拖拽期间指示线恰 1 条，松手后首段是原第三段", async ({
  page,
}) => {
  const doc = "第一段\n\n第二段\n\n第三段";
  await openDoc(page, "/Users/test/bh-indicator-drop.md", doc);
  const third = page.locator(".cm-line").filter({ hasText: "第三段" }).first();
  await hoverLineLeft(page, third);
  const handle = page.locator('.cm-block-handle[data-block-from="10"]');
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

  const indicator = page.locator('[data-testid="block-insert-indicator"]');
  await expect(indicator).toHaveCount(1);
  await expect(indicator).toBeVisible();
  await page.screenshot({
    path: path.join(ART698, "indicator-above-target.png"),
  });

  await page.mouse.up();

  await expect
    .poll(() => storeContent(page))
    .toBe("第三段\n\n第一段\n\n第二段");
  await expect(indicator).toHaveCount(0);
  await page.screenshot({ path: path.join(ART698, "after-drop.png") });
});

test("拖拽中按 Esc 取消：指示线消失且文档不变", async ({ page }) => {
  const doc = "第一段\n\n第二段\n\n第三段";
  await openDoc(page, "/Users/test/bh-indicator-escape.md", doc);
  const third = page.locator(".cm-line").filter({ hasText: "第三段" }).first();
  await hoverLineLeft(page, third);
  const handle = page.locator('.cm-block-handle[data-block-from="10"]');
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });

  const from = await handle.boundingBox();
  const second = await page
    .locator(".cm-line")
    .filter({ hasText: "第二段" })
    .first()
    .boundingBox();
  if (!from || !second) throw new Error("missing layout box");

  await page.mouse.move(from.x + from.width - 6, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width - 6, from.y - 20, { steps: 4 });
  await page.mouse.move(second.x + 40, second.y + 4, { steps: 4 });

  const indicator = page.locator('[data-testid="block-insert-indicator"]');
  await expect(indicator).toHaveCount(1);
  await page.screenshot({ path: path.join(ART698, "drag-start.png") });

  await page.keyboard.press("Escape");

  await expect(indicator).toHaveCount(0);
  await expect.poll(() => storeContent(page)).toBe(doc);
  await page.screenshot({ path: path.join(ART698, "escape-cancel.png") });
});
