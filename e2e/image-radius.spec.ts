import { test, expect, type Page } from "@playwright/test";

/**
 * #712 / D17：预览与编辑态图片四角统一 12px。
 *
 * 预览走 reader.css 的 `--reader-image-radius`；编辑态走 widget 内联
 * `clipPath`。两态必须一致，且取消选中后半径不变（无选中态专属样式）。
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

const ARTIFACTS = ".artifacts/712";
const RADIUS = "12px";

async function openDoc(page: Page, name: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((src: string) => {
    const win = window as unknown as Record<string, any>;
    win.__TAURI_INTERNALS__.convertFileSrc = () => src;
  }, PNG_DATA_URL);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ name }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(
        `/tmp/${name}/${name}.md`,
        "![pic](assets/pic.png)\n\n第二段\n",
        `${name}.md`,
      );
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function setMode(page: Page, mode: string): Promise<void> {
  await page.evaluate((m) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode(m);
  }, mode);
}

async function previewRadius(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector<HTMLElement>(".preview-content img");
    if (!img) return null;
    const cs = getComputedStyle(img);
    return {
      inline: img.style.borderRadius,
      shorthand: cs.borderRadius,
      topLeft: cs.borderTopLeftRadius,
      topRight: cs.borderTopRightRadius,
      bottomLeft: cs.borderBottomLeftRadius,
      bottomRight: cs.borderBottomRightRadius,
    };
  });
}

async function editClip(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector<HTMLElement>(".cm-image-widget img");
    if (!img) return null;
    const cs = getComputedStyle(img);
    return { inline: img.style.clipPath, computed: cs.clipPath };
  });
}

test("预览态：四角 border-radius 严格 12px", async ({ page }) => {
  await openDoc(page, "radiusPreview");
  await setMode(page, "preview");
  await page.locator(".preview-content img").waitFor({ timeout: 10000 });

  const radius = await previewRadius(page);
  expect(radius).not.toBeNull();
  expect(radius!.shorthand).toBe(RADIUS);
  expect(radius!.topLeft).toBe(RADIUS);
  expect(radius!.topRight).toBe(RADIUS);
  expect(radius!.bottomLeft).toBe(RADIUS);
  expect(radius!.bottomRight).toBe(RADIUS);

  await page.screenshot({ path: `${ARTIFACTS}/01-preview-corners.png` });
});

test("编辑态：widget clipPath 含 12px（内联 + 计算值）", async ({ page }) => {
  await openDoc(page, "radiusEdit");
  const img = page.locator(".cm-image-widget img");
  await img.waitFor({ timeout: 10000 });

  const clip = await editClip(page);
  expect(clip).not.toBeNull();
  expect(clip!.inline).toContain("12px");
  expect(clip!.computed).toContain("12px");

  await page.screenshot({ path: `${ARTIFACTS}/02-edit-corners.png` });
});

test("取消选中：两态半径保持 12px", async ({ page }) => {
  await openDoc(page, "radiusDeselect");

  // 编辑态选中 → 取消选中，clipPath 不变。
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  const selected = await editClip(page);
  expect(selected!.inline).toContain("12px");

  await page.mouse.click(600, 600);
  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);

  const deselectedEdit = await editClip(page);
  expect(deselectedEdit!.inline).toContain("12px");
  expect(deselectedEdit!.computed).toContain("12px");
  await page.screenshot({ path: `${ARTIFACTS}/03-deselected-edit.png` });

  // 预览态无选中概念，切过去半径仍是 12px。
  await setMode(page, "preview");
  await page.locator(".preview-content img").waitFor({ timeout: 10000 });
  const deselectedPreview = await previewRadius(page);
  expect(deselectedPreview!.shorthand).toBe(RADIUS);
  expect(deselectedPreview!.bottomLeft).toBe(RADIUS);
  expect(deselectedPreview!.bottomRight).toBe(RADIUS);
  await page.screenshot({ path: `${ARTIFACTS}/04-deselected-preview.png` });
});
