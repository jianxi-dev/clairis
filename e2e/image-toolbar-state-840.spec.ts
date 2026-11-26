import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * #840（change=editor-surface-batch19/7.1）图片工具条状态验收。
 *
 * A-7.1 点「裁剪」→ 裁剪按钮呈选中态（is-active class 存在）
 * A-7.2 裁剪后显示尺寸与裁剪矩形比例相符，且不自动缩小（保留 width 缩放锚点）
 * A-7.3 「添加描述」默认描述区 display = none；点击后非 none
 * A-7.4 「添加描述」图标 path 与旧值（TextEditOutlined）不同
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/840");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

/** 旧「添加描述」图标（TextEditOutlined）的首段 path，作为 A-7.4 的对照。 */
const OLD_COMMENT_PATH = "M3 4h9v2H3zM3 8h9v2H3zM3 12h5v2H3z";

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

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 写真实截图并登记到 state-coverage.json（ui-surface 证据面）。 */
async function shot(page: Page, name: string): Promise<void> {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      name,
      "--screenshot",
      file,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
}

/** 2000×1400 纯色大图：保证裁剪把手与缩放锚点可测。 */
async function largeImageSrc(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2000;
    canvas.height = 1400;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#336699";
    ctx.fillRect(0, 0, 2000, 1400);
    return canvas.toDataURL("image/png");
  });
}

async function openEditor(
  page: Page,
  doc: string,
  name: string,
): Promise<void> {
  const src = await largeImageSrc(page);
  await page.evaluate(
    ({ doc: d, name: n, src }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(
        `/tmp/${n}/${n}.md`,
        d.replace("@SRC@", src),
        `${n}.md`,
      );
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, name, src },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator(".cm-image-widget img").waitFor({ timeout: 10000 });
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar").waitFor({ timeout: 10000 });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function imgBox(
  page: Page,
): Promise<{ width: number; height: number; ratio: number }> {
  return page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      ".cm-image-widget img",
    );
    if (!img) return { width: 0, height: 0, ratio: 0 };
    const rect = img.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      ratio: rect.width / rect.height,
    };
  });
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

test("A-7.1 点「裁剪」后裁剪按钮呈选中态", async ({ page }) => {
  await openEditor(page, "![pic](@SRC@)\n", "a71-crop-selected");
  const crop = page.getByTestId("img-toolbar-crop");
  await expect(crop).not.toHaveClass(/is-active/);
  await expect(crop).toHaveAttribute("aria-pressed", "false");

  await crop.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await expect(crop).toHaveClass(/is-active/);
  await expect(crop).toHaveAttribute("aria-pressed", "true");
  await shot(page, "01-crop-selected");

  // 再次点击退出裁剪态，选中态随之消失（开关语义）。
  await crop.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect(crop).not.toHaveClass(/is-active/);
});

test("A-7.2 裁剪后比例与裁剪矩形相符且不自动缩小", async ({ page }) => {
  await openEditor(page, "![pic](@SRC@){width=1200}\n", "a72-crop-no-shrink");
  const before = await imgBox(page);

  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await dragHandle(page, "e", -100, 0);
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  const final = await content(page);
  const match = /crop=(\d+),(\d+),(\d+),(\d+)/.exec(final);
  expect(match).not.toBeNull();
  const [, , w, h] = match!.slice(1).map(Number);
  const after = await imgBox(page);

  // 显示盒比例 = 裁剪矩形比例。
  expect(Math.abs(after.ratio - w / h)).toBeLessThanOrEqual(0.02);
  // 裁剪掉右侧 100px：可见盒宽按预览同比例缩小 100px，内容缩放不变。
  expect(Math.abs(before.width - after.width - 100)).toBeLessThanOrEqual(2);
  // width 属性跟进为可见裁剪宽（二次裁剪的缩放基准），不再保留旧全图宽。
  const widthAttr = /\bwidth=(\d+)/.exec(final);
  expect(widthAttr).not.toBeNull();
  expect(Math.abs(Number(widthAttr![1]) - after.width)).toBeLessThanOrEqual(2);
  await shot(page, "02-crop-no-shrink");
});

test("A-7.3 「添加描述」默认隐藏，点击后显示", async ({ page }) => {
  await openEditor(page, "![pic](@SRC@)\n", "a73-caption-toggle");
  const comment = page.getByTestId("img-toolbar-comment");
  const input = page.getByTestId("img-caption-input");

  await expect(input).toHaveCSS("display", "none");
  await expect(comment).not.toHaveClass(/is-active/);
  await shot(page, "03-desc-default-hidden");

  await comment.click();
  await expect(input).not.toHaveCSS("display", "none");
  await expect(comment).toHaveClass(/is-active/);
  await shot(page, "04-desc-revealed");

  // 再次点击收起，回到默认未选中。
  await comment.click();
  await expect(input).toHaveCSS("display", "none");
  await expect(comment).not.toHaveClass(/is-active/);
});

test("A-7.4 「添加描述」图标换成 ic-image-caption 语义图形", async ({
  page,
}) => {
  await openEditor(page, "![pic](@SRC@)\n", "a74-caption-icon");
  const icon = page.getByTestId("img-toolbar-comment").locator("svg");
  await expect(icon).toHaveAttribute("data-icon", "ImageCaptionOutlined");
  const d = await icon.locator("path").first().getAttribute("d");
  expect(d).not.toBe(OLD_COMMENT_PATH);
  await shot(page, "05-caption-icon");
});
