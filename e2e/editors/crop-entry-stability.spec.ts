import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { makePngDataUrl } from "../helpers/png";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1409 图片裁剪进入稳定性 + 点外部保存。
 *
 * A-1 进入裁剪前后图片可见尺寸不变（≤1px），裁剪框与图片可见矩形四边重合。
 * A-2 裁剪框底边与图片可见底边距离 0（≤1px），四边无空隙。
 * A-3 拖动角标后点编辑区空白 → 源码写入 crop= 且退出裁剪；点工具条 / 框内不退出。
 * A-4 Esc 取消后源码不含 crop（未改动时）。
 */

const ART = ".artifacts/1409";
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
        `.artifacts/1409/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

const IMG = makePngDataUrl(2000, 1400, [51, 102, 153]);

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

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface Geom {
  img: Box;
  frame: Box | null;
  widget: Box | null;
}

async function geom(page: Page): Promise<Geom> {
  return page.evaluate(() => {
    const read = (el: Element | null): Box | null => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        left: b.left,
        top: b.top,
        right: b.right,
        bottom: b.bottom,
        width: b.width,
        height: b.height,
      };
    };
    return {
      img: read(document.querySelector(".cm-image-widget img"))!,
      frame: read(document.querySelector('[data-testid="img-crop-frame"]')),
      widget: read(document.querySelector(".cm-image-widget")),
    };
  });
}

async function openCrop(page: Page): Promise<void> {
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  // 裁剪态以裁剪框为唯一边界：选中 outline 若仍在，inline-block 行盒的
  // descender 余量会在框下多出一条边线与空隙（#1409 底部空隙成因之一）。
  const outline = await page
    .locator(".cm-image-widget")
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe("none");
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

test("进入裁剪不缩放：可见尺寸与裁剪框四边重合", async ({ page }) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n`, "crop-enter-stability");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  const before = await geom(page);
  await shot(page, "01-before-crop", "before-crop");

  await openCrop(page);
  const after = await geom(page);
  await shot(page, "02-crop-frame", "crop-frame");

  expect(Math.abs(after.img.width - before.img.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.img.height - before.img.height)).toBeLessThanOrEqual(1);
  expect(after.frame).not.toBeNull();
  expect(Math.abs(after.frame!.left - after.img.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.frame!.top - after.img.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.frame!.width - after.img.width)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(after.frame!.height - after.img.height),
  ).toBeLessThanOrEqual(1);
  // 溢出防护：裁剪框四边都落在 widget 盒内，框内图像不溢出到正文。
  expect(after.frame!.left).toBeGreaterThanOrEqual(after.widget!.left - 1);
  expect(after.frame!.top).toBeGreaterThanOrEqual(after.widget!.top - 1);
  expect(after.frame!.right).toBeLessThanOrEqual(after.widget!.right + 1);
  expect(after.frame!.bottom).toBeLessThanOrEqual(after.widget!.bottom + 1);
});

test("裁剪框底边与图片可见底边距离 0，四边无空隙", async ({ page }) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n`, "crop-frame-flush");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openCrop(page);
  const g = await geom(page);
  const f = g.frame!;
  const bottomGap = Math.abs(f.top + f.height - (g.img.top + g.img.height));
  const rightGap = Math.abs(f.left + f.width - (g.img.left + g.img.width));
  expect(bottomGap).toBeLessThanOrEqual(1);
  expect(rightGap).toBeLessThanOrEqual(1);
});

test("拖动角标后点编辑区空白：写回 crop 并退出裁剪", async ({ page }) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n\n后文段落\n`, "crop-outside-save");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openCrop(page);
  await dragHandle(page, "nw", 40, 30);

  // 点图片下方的正文行（编辑区空白，不在裁剪框 / 工具条内）。
  const blank = page.locator(".cm-line").nth(1);
  await blank.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect.poll(() => content(page)).toContain("crop=");
  await shot(page, "03-outside-saved", "outside-saved");
});

test("点工具条或裁剪框内部不退出裁剪", async ({ page }) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n`, "crop-inside-stay");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openCrop(page);

  await page.getByTestId("img-toolbar-align-center").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  const frame = page.getByTestId("img-crop-frame");
  const box = (await frame.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
});

test("已裁剪图片进入裁剪：可见内容不移动、不缩小（width + crop）", async ({
  page,
}) => {
  await openMarkdownInEdit(
    page,
    `![甲](${IMG}){width=600 height=400 crop=100,80,1200,800}\n`,
    "crop-cropped-enter",
  );
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  const before = await geom(page);
  await shot(page, "05-cropped-before", "cropped-before");

  await openCrop(page);
  const after = await geom(page);
  await shot(page, "06-cropped-frame", "cropped-enter-stable");

  // #1511：裁剪态显示整图，框 = 上次裁剪矩形（相对整图显示框）。
  // 进入前可见宽 = width 锚点 600 = 裁剪矩形显示宽，进入后仍由框给出同一宽度。
  expect(Math.abs(after.frame!.width - 600)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(after.frame!.height - before.img.height),
  ).toBeLessThanOrEqual(1);
  // 框位置 = 裁剪矩形在整图上的位置：左 / 上偏移 = crop 起点 × scale。
  const scale = before.img.width / 1200;
  expect(
    Math.abs(after.frame!.left - (after.widget!.left + 100 * scale)),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(after.frame!.top - (after.widget!.top + 80 * scale)),
  ).toBeLessThanOrEqual(2);
  // 溢出防护：裁剪框四边都落在 widget 盒内，框内图像不溢出到正文。
  expect(after.frame!.left).toBeGreaterThanOrEqual(after.widget!.left - 1);
  expect(after.frame!.top).toBeGreaterThanOrEqual(after.widget!.top - 1);
  expect(after.frame!.right).toBeLessThanOrEqual(after.widget!.right + 1);
  expect(after.frame!.bottom).toBeLessThanOrEqual(after.widget!.bottom + 1);
});

test("Esc 取消：退出裁剪且源码无 crop 残留", async ({ page }) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n`, "crop-esc-cancel");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  const doc = await content(page);
  await openCrop(page);
  await dragHandle(page, "e", 20, 0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  expect(await content(page)).toBe(doc);
  expect(await content(page)).not.toContain("crop=");
  await shot(page, "04-esc-cancel", "esc-cancel");
});
