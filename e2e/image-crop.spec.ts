import { test, expect, type Page } from "@playwright/test";

/**
 * 图片内联裁剪（#779 / change editor-surface-batch17 21.1）：
 * 裁剪框覆盖在图片 widget 上，无对话框与确认/取消/还原按钮；拖 handle 实时
 * 改显示（object-fit:none + object-position），松手写回 crop；拖回整图移除
 * crop；Esc 取消并恢复裁剪前状态。
 */

interface BridgeState {
  setEditorMode: (mode: string) => void;
  tabs: Record<string, { content: string }>;
  activeTabId: string;
}

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => BridgeState };
}

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=";

const ARTIFACTS = ".artifacts/709";

async function openEditor(
  page: Page,
  doc: string,
  name: string,
  imageSrc?: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (imageSrc) {
    await page.addInitScript((src: string) => {
      const win = window as unknown as Record<string, any>;
      win.__TAURI_INTERNALS__.convertFileSrc = () => src;
    }, imageSrc);
  }
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ doc, name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openEditorWithLargeImage(
  page: Page,
  doc: (src: string) => string,
  name: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2000;
    canvas.height = 1400;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#336699";
    ctx.fillRect(0, 0, 2000, 1400);
    return canvas.toDataURL("image/png");
  });
  await page.evaluate(
    ({ doc, name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc: doc(src), name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function openCropFrame(page: Page): Promise<void> {
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
}

async function dragHandle(
  page: Page,
  handle: string,
  dx: number,
  dy: number,
): Promise<void> {
  const el = page.locator(`.cm-image-crop-frame [data-handle="${handle}"]`);
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dx,
    box.y + box.height / 2 + dy,
    {
      steps: 4,
    },
  );
  await page.mouse.up();
}

async function blankBelow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const widget = document.querySelector(".cm-image-widget");
    const line = widget?.closest(".cm-line");
    if (!widget || !line) return Infinity;
    return (
      line.getBoundingClientRect().bottom -
      widget.getBoundingClientRect().bottom
    );
  });
}

async function imgBox(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const img = document.querySelector(".cm-image-widget img");
    if (!img) return { width: 0, height: 0 };
    const rect = img.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
}

test("裁剪清除旧宽度注释：可见文本无 `<!--w=` 且图片下方无空白", async ({
  page,
}) => {
  await openEditorWithLargeImage(
    page,
    (src) => `![示例图片](${src})<!--w=811—>`,
    "crop-leak",
  );
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);

  await openCropFrame(page);
  await page.screenshot({ path: `${ARTIFACTS}/01-crop-open.png` });
  await dragHandle(page, "e", 20, 0);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  await expect.soft(page.locator(".cm-content")).not.toContainText("<!--w=");
  const final = await content(page);
  expect.soft(final).not.toContain("<!--w=");
  expect.soft(final).toContain("{crop=");

  const blank = await blankBelow(page);
  expect(blank).toBeLessThanOrEqual(8);
  await page.screenshot({ path: `${ARTIFACTS}/04-after-confirm.png` });
});

test("跨行宽度注释裁剪后可见文本无 `<!--w=`", async ({ page }) => {
  await openEditorWithLargeImage(
    page,
    (src) => `![示例图片](${src})\n<!--w=811—>`,
    "crop-multiline",
  );
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);

  await openCropFrame(page);
  await dragHandle(page, "e", 20, 0);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  await expect.soft(page.locator(".cm-content")).not.toContainText("<!--w=");
  const final = await content(page);
  expect.soft(final).not.toContain("<!--w=");
  expect.soft(final).toContain("{crop=");
});

test("点裁剪后：无确认/取消/还原按钮与对话框", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "crop-nodialog",
    PNG_DATA_URL,
  );
  await openCropFrame(page);
  await expect(page.getByTestId("img-crop-overlay")).toHaveCount(0);
  await expect(page.getByTestId("img-crop-confirm")).toHaveCount(0);
  await expect(page.getByTestId("img-crop-cancel")).toHaveCount(0);
  await expect(page.getByTestId("img-crop-restore")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
});

test("拖动裁剪框：显示区域与 crop 数值一致且下方空白 ≤8px", async ({
  page,
}) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "crop-geom", PNG_DATA_URL);
  await openCropFrame(page);
  await dragHandle(page, "e", 3, 0);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  const final = await content(page);
  const match = /\{crop=(\d+),(\d+),(\d+),(\d+)\}/.exec(final);
  expect(match).not.toBeNull();
  const [l, t, w, h] = match!.slice(1).map(Number);
  const after = await imgBox(page);
  expect(Math.abs(after.width - w)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.height - h)).toBeLessThanOrEqual(2);
  const offset = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      ".cm-image-widget img",
    );
    const [x, y] = (img?.style.objectPosition ?? "").split(" ").map(parseFloat);
    return { x, y };
  });
  expect(Math.abs(offset.x + l)).toBeLessThanOrEqual(2);
  expect(Math.abs(offset.y + t)).toBeLessThanOrEqual(2);
  expect(await blankBelow(page)).toBeLessThanOrEqual(8);
});

test("拖左上角向右下：裁剪框宽度变小", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "crop-nw", PNG_DATA_URL);
  await openCropFrame(page);
  await dragHandle(page, "nw", 10, 10);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  const final = await content(page);
  const match = /\{crop=(\d+),(\d+),(\d+),(\d+)\}/.exec(final);
  expect(match).not.toBeNull();
  const [l, t, w, h] = match!.slice(1).map(Number);
  expect(w).toBe(16);
  expect(h).toBe(16);
  expect(l).toBe(13);
  expect(t).toBe(13);
});

test("8 个控制点：方向光标 + 裁剪角标", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "crop-handles",
    PNG_DATA_URL,
  );
  await openCropFrame(page);
  const handles = page.locator(".cm-image-crop-frame [data-handle]");
  await expect(handles).toHaveCount(8);
  await page.screenshot({ path: `${ARTIFACTS}/02-handles.png` });

  const directional = new Set([
    "nwse-resize",
    "nesw-resize",
    "ew-resize",
    "ns-resize",
  ]);
  const probe = await handles.evaluateAll((els) =>
    els.map((el) => {
      const mark = el.querySelector(".image-crop-mark");
      const markBox = mark?.getBoundingClientRect();
      return {
        cursor: getComputedStyle(el).cursor,
        hasMark: mark !== null,
        markSize:
          markBox && markBox.width > 0 && markBox.height > 0 ? true : false,
      };
    }),
  );
  const semantic = probe.filter(
    (p) => directional.has(p.cursor) && p.hasMark && p.markSize,
  );
  expect(semantic.length).toBeGreaterThanOrEqual(6);
});

test("拖裁剪框本体：crop 值随矩形移动", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "crop-body", PNG_DATA_URL);
  await openCropFrame(page);
  const frame = page.getByTestId("img-crop-frame");
  const before = (await frame.boundingBox())!;
  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 4, cy + 4, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  const final = await content(page);
  const match = /\{crop=(\d+),(\d+),(\d+),(\d+)\}/.exec(final);
  expect(match).not.toBeNull();
  const [l, t, w, h] = match!.slice(1).map(Number);
  // 默认 (3,3,26,26)：本体拖动只移位、不改尺寸（指针取整容 1px）。
  expect(l).toBeGreaterThan(3);
  expect(l).toBeLessThanOrEqual(7);
  expect(t).toBeGreaterThan(3);
  expect(t).toBeLessThanOrEqual(7);
  expect(w).toBe(26);
  expect(h).toBe(26);
});

test("拖回整图：crop 属性移除", async ({ page }) => {
  const doc = "![pic](assets/pic.png)\n";
  await openEditor(page, doc, "crop-full", PNG_DATA_URL);

  await openCropFrame(page);
  await dragHandle(page, "nw", -20, -20);
  await expect.poll(() => content(page)).toContain("{crop=");

  await openCropFrame(page);
  await dragHandle(page, "se", 40, 40);
  await expect.poll(() => content(page)).toBe(doc);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  const after = await imgBox(page);
  expect(after.width).toBe(32);
  expect(after.height).toBe(32);
});

test("Esc 取消裁剪：无残留且文档不变", async ({ page }) => {
  const doc = "![pic](assets/pic.png)\n";
  await openEditor(page, doc, "crop-esc", PNG_DATA_URL);
  await openCropFrame(page);

  const handle = page.locator('.cm-image-crop-frame [data-handle="e"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2, {
    steps: 3,
  });
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  expect(await content(page)).toBe(doc);
  const after = await imgBox(page);
  expect(after.width).toBe(32);
  expect(after.height).toBe(32);
});
