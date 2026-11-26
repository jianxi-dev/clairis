import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1565（change=editor-surface-batch23/3.1）预览态图片双击查看。
 *
 * 预览模式双击图片 → 复用编辑态放大层（含该图）；再次双击 / Esc 退出且无残留；
 * 预览容器自身缩放不被图片双击复位；预览态放大层无「重置图片」（只读渲染）。
 */

const IMG_A = makePngDataUrl(1200, 800, [90, 140, 200]);
const IMG_B = makePngDataUrl(1200, 800, [200, 90, 90]);
const DOC = `段落一\n\n![甲](assets/a.png)\n\n段落二\n\n![乙](assets/b.png)\n\n段落三\n`;

interface BridgeState {
  setEditorMode: (mode: string) => void;
}
interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => BridgeState };
}

async function openPreview(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  // asset:// 在 mock 浏览器无处理器：把 convertFileSrc 重写成真实 data URL，
  // 图片才加载得出来（放大层要呈现该图）。
  await page.addInitScript((src: string) => {
    const win = window as unknown as Record<string, any>;
    win.__TAURI_INTERNALS__.convertFileSrc = () => src;
  }, IMG_A);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((doc) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/preview-dblclick/doc.md", doc, "doc.md");
    win.__biaoyue_store__.getState().setEditorMode("preview");
  }, DOC);
  await page.locator(".preview-shell").waitFor({ timeout: 10000 });
}

/** 预览容器 zoom（行内样式，复位语义的直接读数）。 */
async function previewZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector(".preview-shell") as HTMLElement | null;
    return el ? Number(el.style.zoom) : 0;
  });
}

/** 等缩放稳定：连续两次 poll 读数一致才返回，避免后续滚轮事件仍在改值。 */
async function waitForStableZoom(page: Page): Promise<number> {
  let prev = 0;
  await expect
    .poll(async () => {
      const next = await previewZoom(page);
      const stable = next === prev;
      prev = next;
      return stable ? next : 0;
    })
    .toBeGreaterThan(0);
  return prev;
}

async function openPreviewImage(page: Page, index: number): Promise<void> {
  const img = page.locator(".preview-content figure img").nth(index);
  await img.scrollIntoViewIfNeeded();
  await img.dblclick();
  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await openPreview(page);
  await page.waitForFunction(() => {
    const imgs = [
      ...document.querySelectorAll(".preview-content figure img"),
    ] as HTMLImageElement[];
    return (
      imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0)
    );
  });
});

test("预览态双击图片打开放大层且呈现该图", async ({ page }) => {
  await openPreviewImage(page, 0);

  const shown = page.getByTestId("img-maximize").locator("img");
  await expect(shown).toHaveCount(1);
  await expect(shown).toHaveAttribute("alt", "甲");

  await page.getByTestId("img-max-close").click();
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
});

test("再次双击 / Esc 退出且无遮罩残留", async ({ page }) => {
  await openPreviewImage(page, 0);
  await expect(page.locator(".cm-image-maximize")).toHaveCount(1);

  // 放大层内再次双击：恢复原始尺寸，不关闭（design D16）。
  const box = (await page.getByTestId("img-maximize").boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("img-maximize")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
  await expect(page.locator(".cm-image-maximize")).toHaveCount(0);
  await expect(page.getByTestId("img-max-controls")).toHaveCount(0);
});

test("预览态放大层无「重置图片」按钮", async ({ page }) => {
  await openPreviewImage(page, 0);
  await expect(page.getByTestId("img-max-clear-crop")).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("双击图片不复位预览容器缩放；双击空白复位", async ({ page }) => {
  // Ctrl+滚轮放大预览容器（preview-zoom 默认开启）。
  const shell = page.locator(".preview-shell");
  const box = (await shell.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -240);
    await page.keyboard.up("Control");
  }
  await expect.poll(async () => previewZoom(page)).toBeGreaterThan(1);
  const zoomed = await waitForStableZoom(page);

  await openPreviewImage(page, 0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
  expect(await previewZoom(page)).toBe(zoomed);

  // 双击正文段落（非图片、在 shell 内）复位；缩放改变布局，重新取几何。
  const para = page.locator(".preview-content p").first();
  await para.scrollIntoViewIfNeeded();
  const pb = (await para.boundingBox())!;
  await page.mouse.dblclick(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await expect.poll(async () => previewZoom(page)).toBe(1);
});
