import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 图片裁剪坐标系 + 加载门 + 保存双入口（#1349 / E-44 / change editor-interaction-batch2 6.1）。
 *
 * 单一显示坐标系：框选、拖动、保存都在显示矩形（CSS px）里进行，写回只换算
 * 一次。加载门：图片未加载完给出可见提示且不静默返回。保存双入口：显式保存
 * 按钮 + window 级 pointerup（裁剪框被装饰重建销毁后仍兜底），Esc 取消不写回。
 */

const ART = ".artifacts/1349";
const EVIDENCE = "scripts/cw-evidence.sh";

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

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

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
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  const src = await largeImageSrc(page);
  await page.evaluate(
    ({ doc: d, name: n, src }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(
        `/tmp/${n}/${n}.md`,
        d.replaceAll("@SRC@", src),
        `${n}.md`,
      );
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, name, src },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page
    .locator(".cm-image-widget img")
    .first()
    .waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
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
}

async function imgBox(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    if (!img) return { width: 0, height: 0 };
    const rect = img.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
}

test("裁剪缩放不跳变：保存前后图片显示宽度严格相等且框与 crop 一一对应", async ({
  page,
}) => {
  await openEditor(page, "![pic](@SRC@)\n", "crop-ratio");
  const before = await imgBox(page);
  const natural = await page.evaluate(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return img ? { w: img.naturalWidth, h: img.naturalHeight } : { w: 0, h: 0 };
  });
  const scale = before.width / natural.w;
  expect(scale).toBeGreaterThan(0);

  await openCrop(page);
  await shot(page, "01-crop-open");

  // 拖拽中（未松手）量显示宽度：框选/拖动与写回同一坐标系。
  const handle = page.locator('.cm-image-crop-frame [data-handle="e"]');
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 40,
    handleBox.y + handleBox.height / 2,
    { steps: 4 },
  );
  const during = await imgBox(page);
  const frameBox = (await page.getByTestId("img-crop-frame").boundingBox())!;
  await shot(page, "02-crop-drag");

  // window 级 pointerup 入口保存。
  await page.mouse.up();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await shot(page, "03-crop-saved");

  const after = await imgBox(page);
  // 保存前后图片显示宽度严格相等（同一套显示坐标系，无跳变）。
  expect(after.width).toBe(during.width);
  expect(after.height).toBe(during.height);

  const final = await content(page);
  const match = /\{crop=(\d+),(\d+),(\d+),(\d+)\}/.exec(final);
  expect(match).not.toBeNull();
  const [l, t, w, h] = match!.slice(1).map(Number);
  // 裁剪框矩形与 crop 值一一对应（显示尺寸 = crop × scale）。
  expect(Math.abs(frameBox.width - w * scale)).toBeLessThan(0.5);
  expect(Math.abs(frameBox.height - h * scale)).toBeLessThan(0.5);
  const objPos = await page.evaluate(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    const [x, y] = (img?.style.objectPosition ?? "")
      .split(" ")
      .map((value) => parseFloat(value));
    return { x, y };
  });
  expect(Math.abs(objPos.x + l)).toBeLessThan(0.5);
  expect(Math.abs(objPos.y + t)).toBeLessThan(0.5);
  expect(natural.w).toBe(2000);
  expect(natural.h).toBe(1400);
});

test("保存按钮入口：显式点击保存写回裁剪矩形", async ({ page }) => {
  await openEditor(page, "![pic](@SRC@)\n", "crop-save-button");
  await openCrop(page);
  await page.getByTestId("img-crop-save").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  const final = await content(page);
  const match = /\{crop=(\d+),(\d+),(\d+),(\d+)\}/.exec(final);
  expect(match).not.toBeNull();
  // 默认 80% 居中矩形（2000×1400 → 1600×1120 @ (200,140)）。
  expect(match!.slice(1).map(Number)).toEqual([200, 140, 1600, 1120]);
  await shot(page, "07-crop-save-button");
});

test("加载门：图片未加载完给出可见提示且不静默返回", async ({ page }) => {
  // 挂起图片请求，让 img 一直停在未加载状态，触发 2s 超时提示。
  await page.route("**/slow-crop.png", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.abort();
  });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__(
      "/tmp/crop-slow/crop-slow.md",
      "![pic](http://example.test/slow-crop.png)\n",
      "crop-slow.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator(".cm-image-widget img").waitFor({ timeout: 10000 });

  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();

  const toast = page.locator(".image-crop-toast");
  await expect(toast).toBeVisible({ timeout: 4000 });
  await expect(toast).toContainText("加载");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await shot(page, "04-crop-loading-gate");
});

test("加载门：延迟加载完成后可正常进入裁剪", async ({ page }) => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/slow-crop-ok.png", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({ status: 200, contentType: "image/png", body: png });
  });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__(
      "/tmp/crop-slow-ok/crop-slow-ok.md",
      "![pic](http://example.test/slow-crop-ok.png)\n",
      "crop-slow-ok.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator(".cm-image-widget img").waitFor({ timeout: 10000 });

  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1, {
    timeout: 4000,
  });
  await shot(page, "08-crop-after-load");
});

test("保存不随裁剪框销毁丢失：装饰重建后再松手仍写回", async ({ page }) => {
  await openEditor(page, "![pic](@SRC@)\n", "crop-rebuild");
  await openCrop(page);

  const el = page.locator('.cm-image-crop-frame [data-handle="e"]');
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, {
    steps: 3,
  });

  // 触发一次装饰重建：切到预览再切回编辑，裁剪框随 widget 销毁。
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });

  await page.mouse.up();
  await expect.poll(() => content(page)).toContain("{crop=");
  const final = await content(page);
  const match = /\{crop=(\d+),(\d+),(\d+),(\d+)\}/.exec(final);
  expect(match).not.toBeNull();
  await shot(page, "05-crop-rebuilt-save");
});

test("Esc 取消：无残留裁剪框、无窗口、源码不含 crop", async ({ page }) => {
  await openEditor(page, "![pic](@SRC@)\n", "crop-esc");
  const doc = await content(page);
  await openCrop(page);

  const el = page.locator('.cm-image-crop-frame [data-handle="e"]');
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, {
    steps: 3,
  });
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect(page.locator(".image-crop-window")).toHaveCount(0);
  expect(await content(page)).toBe(doc);
  const restored = await page.evaluate(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return {
      objectPosition: img?.style.objectPosition ?? "",
      transform: img?.style.transform ?? "",
    };
  });
  expect(restored.objectPosition).toBe("");
  expect(restored.transform).toBe("");
  await shot(page, "06-crop-esc-clear");
});

test("裁剪圆角在显示域承载：不随 scale 缩小，被缩放 img 不裁圆角", async ({
  page,
}) => {
  await openEditor(
    page,
    "![plain](@SRC@)\n\n![cropped](@SRC@){crop=200,140,1600,1120}\n",
    "crop-radius",
  );
  const radius = await page.evaluate(() => {
    const roundOf = (el: HTMLElement | null): number | null => {
      if (!el) return null;
      const match = /round\s+([\d.]+)px/.exec(getComputedStyle(el).clipPath);
      return match ? Number(match[1]) : null;
    };
    const plain = document.querySelector<HTMLElement>(".cm-image-widget img");
    const win = document.querySelector<HTMLElement>(".image-crop-window");
    const croppedImg = win?.querySelector<HTMLElement>("img") ?? null;
    return {
      plain: roundOf(plain),
      wrapper: roundOf(win),
      croppedImgClip: croppedImg ? getComputedStyle(croppedImg).clipPath : null,
    };
  });
  expect(radius.plain).not.toBeNull();
  expect(radius.wrapper).toBe(radius.plain);
  expect(radius.croppedImgClip).toBe("none");
});

test("工具条再点退出：恢复显示、不写回、widget 不塌陷", async ({ page }) => {
  await openEditor(page, "![pic](@SRC@)\n", "crop-toolbar-exit");
  const doc = await content(page);
  await openCrop(page);

  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect(page.locator(".image-crop-window")).toHaveCount(0);
  expect(await content(page)).toBe(doc);

  const restored = await page.evaluate(() => {
    const img = document.querySelector<HTMLElement>(".cm-image-widget img");
    const widget = document.querySelector<HTMLElement>(".cm-image-widget");
    return {
      position: img ? getComputedStyle(img).position : "",
      transform: img ? getComputedStyle(img).transform : "",
      widgetHeight: widget ? widget.getBoundingClientRect().height : 0,
    };
  });
  expect(restored.position).not.toBe("absolute");
  expect(restored.transform).toBe("none");
  expect(restored.widgetHeight).toBeGreaterThan(0);
});
