import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { makePngDataUrl } from "../helpers/png";
import { openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1392";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        `.artifacts/1392/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

/**
 * #1392（change=editor-refine-batch1/3.1）图片裁剪 Quiet 对标。
 *
 * A-4.1 角标加大：四角命中区 10px → 18px，角标视觉 4px 括号 → 20px 裁剪图标
 * A-4.4 拖动柄图标键名与工具条「裁剪」按钮一致（CropOutlined）
 * A-4.2 常驻：进入裁剪后拖动边界一次，裁剪态保持、不弹回普通选中态
 * A-4.3 裁剪区下方无「保存」文字
 */

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);
const DOC = `![甲](${IMG}){width=600}\n`;

interface BridgeState {
  setEditorMode: (mode: string) => void;
  tabs: Record<string, { content: string }>;
  activeTabId: string;
}

interface BridgeWindow extends Window {
  __biaoyue_store__: { getState: () => BridgeState };
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function openCrop(page: Page): Promise<void> {
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
    { steps: 4 },
  );
  await page.mouse.up();
}

test("角标加大且使用裁剪样式图标（A-4.1 / A-4.4）", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "crop-quiet-marks");
  await openCrop(page);

  const corner = page.locator('.cm-image-crop-frame [data-handle="nw"]');
  const hit = (await corner.boundingBox())!;
  expect(hit.width).toBeGreaterThanOrEqual(18);
  expect(hit.height).toBeGreaterThanOrEqual(18);

  const icon = corner.locator("svg[data-icon]");
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("data-icon", "CropOutlined");

  // 四个角都是同一裁剪图标；四边短柄同步加大（宽 16px）。
  for (const handle of ["ne", "se", "sw"]) {
    await expect(
      page
        .locator(
          `.cm-image-crop-frame [data-handle="${handle}"] svg[data-icon]`,
        )
        .first(),
    ).toHaveAttribute("data-icon", "CropOutlined");
  }
  const edgeMark = page.locator(
    '.cm-image-crop-frame [data-handle="n"] .image-crop-mark',
  );
  expect((await edgeMark.boundingBox())!.width).toBeGreaterThanOrEqual(16);

  // 键名关系：裁剪把手图标与工具条「裁剪」按钮同源（差 0）。
  const toolbarKey = await page
    .getByTestId("img-toolbar-crop")
    .locator("svg[data-icon]")
    .getAttribute("data-icon");
  expect(await icon.getAttribute("data-icon")).toBe(toolbarKey);
  await shot(page, "01-corner-icon-enlarged", "corner-icon-enlarged");
});

test("裁剪态常驻：拖动边界一次不弹回普通选中态（A-4.2）", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "crop-quiet-persistent");
  await openCrop(page);
  await dragHandle(page, "nw", 6, 6);

  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await expect(page.getByTestId("img-toolbar-crop")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".cm-image-widget")).toHaveAttribute(
    "data-selected",
    "true",
  );
  const cropped = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      ".cm-image-widget img",
    );
    return img?.style.objectPosition ?? "";
  });
  expect(cropped).not.toBe("");
  await shot(page, "02-crop-persist-after-drag", "crop-persist-after-drag");
});

test("裁剪区下方无「保存」文字，确认走双击/工具条（A-4.3）", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "crop-quiet-no-save-text");
  await openCrop(page);
  const frame = page.getByTestId("img-crop-frame");

  await expect(page.getByTestId("img-crop-save")).toHaveCount(0);
  expect(await frame.locator("text=保存").count()).toBe(0);
  await shot(page, "03-no-save-text", "no-save-text");

  await dragHandle(page, "e", -8, 0);
  await frame.dblclick();
  await expect(frame).toHaveCount(0);
  expect(await content(page)).toMatch(/\{[^}]*crop=\d+,\d+,\d+,\d+\}/);
});

test("Esc 取消：裁剪态退出且源码无改动", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "crop-quiet-esc");
  const doc = await content(page);
  await openCrop(page);
  await dragHandle(page, "e", 12, 0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  expect(await content(page)).toBe(doc);
  await shot(
    page,
    "04-esc-cancel-no-source-change",
    "esc-cancel-no-source-change",
  );
});
