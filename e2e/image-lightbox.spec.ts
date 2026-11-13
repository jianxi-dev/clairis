import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 双击预览浮层（#711 / design D16）：滚轮缩放、放大后拖动、旋转、复位、
 * 下载、Esc 与关闭按钮。浮层控件用 data-testid 定位，变换读 img.style.transform。
 */

const ART = path.resolve(process.cwd(), ".artifacts/711");
mkdirSync(ART, { recursive: true });

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=";

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

interface Transform {
  tx: number;
  ty: number;
  scale: number;
  rotation: number;
}

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

async function openLightbox(page: Page): Promise<void> {
  await page.locator(".cm-image-widget img").dblclick();
  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
}

async function readTransform(page: Page): Promise<Transform | null> {
  return page.evaluate(() => {
    const img = document.querySelector(
      '[data-testid="img-maximize"] img',
    ) as HTMLImageElement | null;
    if (!img) return null;
    const m =
      /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)\s*rotate\((-?[\d.]+)deg\)/.exec(
        img.style.transform,
      );
    if (!m) return null;
    return {
      tx: parseFloat(m[1]),
      ty: parseFloat(m[2]),
      scale: parseFloat(m[3]),
      rotation: parseFloat(m[4]),
    };
  });
}

async function readLayout(page: Page): Promise<{ cw: number; ch: number }> {
  return page.evaluate(() => {
    const img = document.querySelector(
      '[data-testid="img-maximize"] img',
    ) as HTMLImageElement | null;
    return { cw: img?.clientWidth ?? 0, ch: img?.clientHeight ?? 0 };
  });
}

async function zoomIn(page: Page): Promise<void> {
  const img = page.getByTestId("img-maximize").locator("img");
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  await expect
    .poll(async () => (await readTransform(page))?.scale)
    .toBeGreaterThan(1);
}

test("双击打开浮层：滚轮放大后 scale > 1", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "lightbox-open",
    PNG_DATA_URL,
  );
  await openLightbox(page);
  await page.screenshot({ path: path.join(ART, "01-overlay.png") });

  await zoomIn(page);

  const t = (await readTransform(page))!;
  expect(t.scale).toBeGreaterThan(1);
  expect(t.scale).toBeLessThanOrEqual(8);
  await page.screenshot({ path: path.join(ART, "02-zoomed.png") });
});

test("放大后拖动：平移变化且不越界", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "lightbox-pan",
    PNG_DATA_URL,
  );
  await openLightbox(page);
  const img = page.getByTestId("img-maximize").locator("img");
  const box = (await img.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await zoomIn(page);
  const before = (await readTransform(page))!;
  const layout = await readLayout(page);

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 60, { steps: 5 });
  await page.mouse.up();

  const after = (await readTransform(page))!;
  expect(Number.isNaN(after.tx)).toBe(false);
  expect(Number.isNaN(after.ty)).toBe(false);
  expect(after.tx).not.toBe(before.tx);
  expect(after.ty).not.toBe(before.ty);

  const boundX = (layout.cw * after.scale) / 2;
  const boundY = (layout.ch * after.scale) / 2;
  expect(Math.abs(after.tx)).toBeLessThanOrEqual(boundX + 0.5);
  expect(Math.abs(after.ty)).toBeLessThanOrEqual(boundY + 0.5);
  await page.screenshot({ path: path.join(ART, "03-panned.png") });
});

test("旋转 90° 后复位：回到 scale 1 / translate 0 / rotation 0", async ({
  page,
}) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "lightbox-rotate",
    PNG_DATA_URL,
  );
  await openLightbox(page);
  await zoomIn(page);

  await page.getByTestId("img-max-rotate").click();
  await expect.poll(async () => (await readTransform(page))?.rotation).toBe(90);
  await page.screenshot({ path: path.join(ART, "04-rotated.png") });

  await page.getByTestId("img-max-reset").click();
  const t = (await readTransform(page))!;
  expect(t.scale).toBe(1);
  expect(t.tx).toBe(0);
  expect(t.ty).toBe(0);
  expect(t.rotation).toBe(0);
  await page.screenshot({ path: path.join(ART, "05-reset.png") });
});

test("下载按钮：恰好触发一次下载", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "lightbox-download",
    PNG_DATA_URL,
  );
  await openLightbox(page);

  let downloads = 0;
  page.on("download", () => {
    downloads++;
  });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("img-max-download").click(),
  ]);
  expect(download.suggestedFilename()).toBeTruthy();
  await expect(page.getByTestId("img-maximize")).toBeVisible();
  expect(downloads).toBe(1);
});

test("Esc 与关闭按钮：关闭后重开仍可用", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "lightbox-esc",
    PNG_DATA_URL,
  );
  await openLightbox(page);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);

  await openLightbox(page);
  await zoomIn(page);
  await page.getByTestId("img-max-close").click();
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);

  await openLightbox(page);
  await zoomIn(page);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
});
