import { test, expect, type Page } from "@playwright/test";

/**
 * 图片裁剪正确性（#709 / change editor-surface-batch16 14.1）：
 * 旧宽度注释不泄漏、左/上拖拽方向正确、控制点有裁剪标识、矩形本体可拖、
 * 二次保存按新矩形写回。
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

async function openCropOverlay(page: Page): Promise<void> {
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-overlay")).toHaveCount(1);
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

  await openCropOverlay(page);
  await page.screenshot({ path: `${ARTIFACTS}/01-crop-open.png` });
  await page.getByTestId("img-crop-confirm").click();
  await expect(page.getByTestId("img-crop-overlay")).toHaveCount(0);

  await expect.soft(page.locator(".cm-content")).not.toContainText("<!--w=");
  const final = await content(page);
  expect.soft(final).not.toContain("<!--w=");
  expect.soft(final).toContain("{crop=");

  const blank = await page.evaluate(() => {
    const widget = document.querySelector(".cm-image-widget");
    const line = widget?.closest(".cm-line");
    if (!widget || !line) return Infinity;
    return (
      line.getBoundingClientRect().bottom -
      widget.getBoundingClientRect().bottom
    );
  });
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

  await openCropOverlay(page);
  await page.getByTestId("img-crop-confirm").click();
  await expect(page.getByTestId("img-crop-overlay")).toHaveCount(0);

  await expect.soft(page.locator(".cm-content")).not.toContainText("<!--w=");
  const final = await content(page);
  expect.soft(final).not.toContain("<!--w=");
  expect.soft(final).toContain("{crop=");
});

test("拖左上角向右下：裁剪框宽度变小", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "crop-nw", PNG_DATA_URL);
  await openCropOverlay(page);
  const rect = page.locator(".cm-image-crop-rect");
  const before = (await rect.boundingBox())!;

  const handle = page.locator('.cm-image-crop-rect [data-handle="nw"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 10,
    box.y + box.height / 2 + 10,
    {
      steps: 4,
    },
  );
  await page.mouse.up();
  await page.screenshot({ path: `${ARTIFACTS}/03-top-left-drag.png` });

  const after = (await rect.boundingBox())!;
  expect(after.width).toBeLessThan(before.width);
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
});

test("8 个控制点：方向光标 + 裁剪角标", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "crop-handles",
    PNG_DATA_URL,
  );
  await openCropOverlay(page);
  const handles = page.locator(".cm-image-crop-rect [data-handle]");
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

test("再次打开裁剪拖矩形本体：确认后 crop 值等于新矩形", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "crop-body", PNG_DATA_URL);
  await openCropOverlay(page);
  await page.getByTestId("img-crop-confirm").click();
  await expect.poll(() => content(page)).toContain("{crop=");

  await openCropOverlay(page);
  const rect = page.locator(".cm-image-crop-rect");
  const stage = page.locator(".cm-image-crop-stage");
  const stageBox = (await stage.boundingBox())!;
  const scale = await page.evaluate(() => {
    const img = document.querySelector(".cm-image-crop-stage img");
    return img
      ? img.getBoundingClientRect().width / (img.naturalWidth || 1)
      : 1;
  });
  const before = (await rect.boundingBox())!;

  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 10, cy + 10, { steps: 4 });
  await page.mouse.up();
  await page.screenshot({ path: `${ARTIFACTS}/05-re-crop-body.png` });

  const after = (await rect.boundingBox())!;
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);

  await page.getByTestId("img-crop-confirm").click();
  await expect(page.getByTestId("img-crop-overlay")).toHaveCount(0);

  const final = await content(page);
  const match = /\{crop=(\d+),(\d+),(\d+),(\d+)\}/.exec(final);
  expect(match).not.toBeNull();
  const [l, t, w, h] = match!.slice(1).map(Number);
  expect(l).toBe(Math.round((after.x - stageBox.x) / scale));
  expect(t).toBe(Math.round((after.y - stageBox.y) / scale));
  expect(w).toBe(Math.round(after.width / scale));
  expect(h).toBe(Math.round(after.height / scale));
});

test("Esc 取消裁剪：无残留浮层且文档不变", async ({ page }) => {
  const doc = "![pic](assets/pic.png)\n";
  await openEditor(page, doc, "crop-esc", PNG_DATA_URL);
  await openCropOverlay(page);

  const rect = page.locator(".cm-image-crop-rect");
  const before = (await rect.boundingBox())!;
  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 8, cy + 8, { steps: 3 });
  await page.mouse.up();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-crop-overlay")).toHaveCount(0);
  expect(await content(page)).toBe(doc);
});
