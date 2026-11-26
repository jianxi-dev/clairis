import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1559（change=editor-surface-batch23/1.1）裁剪清理同步化与标识线必现。
 *
 * 1. 多轮裁剪零残留：连续 5 次裁剪确认后，页面裁剪框 / 角标 / 边柄 / 蒙层
 *    DOM 计数全为 0（旧实现把 frame.remove() 推迟到下一帧，跨会话残留）。
 * 2. 已加载图片标识线必现：点「裁剪」后不依赖任何等待即有框。
 * 3. 未加载完成有反馈：挂起图片请求时点「裁剪」先出加载提示，加载完成后
 *    自动挂框，不再「点了没反应」。
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

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

function cropResidue(page: Page): Promise<{
  frames: number;
  handles: number;
  shades: number;
  active: number;
}> {
  return page.evaluate(() => ({
    frames: document.querySelectorAll(".cm-image-crop-frame").length,
    handles: document.querySelectorAll(".cm-image-crop-frame [data-handle]")
      .length,
    shades: document.querySelectorAll(".cm-image-crop-shade").length,
    active: document.querySelectorAll(".cm-image-widget.cm-image-crop-active")
      .length,
  }));
}

async function openThreeImages(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  const doc = [
    `![甲](${IMG}){width=300}`,
    `![乙](${IMG}){width=260}`,
    `![丙](${IMG}){width=220}`,
  ].join("\n\n");
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/crop-sync/three.md", body, "three.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, doc);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const imgs = [
      ...document.querySelectorAll(".cm-image-widget img"),
    ] as HTMLImageElement[];
    return (
      imgs.length === 3 && imgs.every((i) => i.complete && i.naturalWidth > 0)
    );
  });
}

async function clickCropButton(page: Page): Promise<void> {
  const button = page.getByTestId("img-toolbar-crop");
  await button.waitFor({ state: "visible", timeout: 10000 });
  await button.click();
}

async function openCropOn(page: Page, index: number): Promise<void> {
  const widget = page.locator(".cm-image-widget").nth(index);
  await widget.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await widget.click();
  await clickCropButton(page);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
}

async function cropOnce(page: Page, index: number): Promise<void> {
  await openCropOn(page, index);
  // nw 在框左上角，滚到图中心后仍在视口内（se 会落到视口外，拖拽终点
  // 落到框外会触发「点框外=确认」路径，框提前消失）。
  const handle = page.locator('.cm-image-crop-frame [data-handle="nw"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 30,
    box.y + box.height / 2 + 20,
    { steps: 4 },
  );
  await page.mouse.up();
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
}

test("多轮裁剪零残留：连续 5 次确认后裁剪标识节点计数全为 0", async ({
  page,
}) => {
  await openThreeImages(page);

  for (let round = 0; round < 5; round += 1) {
    await cropOnce(page, round % 3);
  }

  const residue = await cropResidue(page);
  expect(residue).toEqual({ frames: 0, handles: 0, shades: 0, active: 0 });

  const text = await content(page);
  expect(text.match(/crop=\d+,\d+,\d+,\d+/g) ?? []).toHaveLength(3);
});

test("已加载图片标识线必现：点裁剪后立即有框", async ({ page }) => {
  await openThreeImages(page);
  await page
    .locator(".cm-image-widget")
    .first()
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.locator(".cm-image-widget").first().click();
  await clickCropButton(page);
  expect(await page.getByTestId("img-crop-frame").count()).toBe(1);
  expect(await page.locator(".cm-image-crop-frame [data-handle]").count()).toBe(
    8,
  );
});

test("未加载完成有反馈：先出加载提示，加载完成后自动挂框", async ({ page }) => {
  // 外部可控 gate：route handler 挂起图片响应，直到测试显式 release()。
  // 这样「图片未加载完成」是确定性状态，不再与挂起时长/断言时机耦合。
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/pending-crop.png", async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__(
      "/tmp/crop-pending/pending.md",
      "![pic](http://example.test/pending-crop.png)\n",
      "pending.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });

  await page.waitForSelector(".cm-image-widget img", {
    state: "attached",
    timeout: 10000,
  });
  // gate 未释放，img 必然未加载完成——确定性状态，不依赖任何计时。
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && !img.complete;
  });
  // 未加载完成时 img 高度为 0，Playwright 判其不可见、click() 会一直重试到
  // 超时；选中态由容器 click 监听驱动，dispatchEvent 直接派发到 img 即可。
  await page.locator(".cm-image-widget img").dispatchEvent("click");
  await page.getByTestId("img-toolbar-crop").click({ timeout: 10000 });

  const toast = page.locator(".image-crop-toast");
  await expect(toast).toBeVisible({ timeout: 2000 });
  await expect(toast).toContainText("加载");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);

  release();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1, {
    timeout: 12000,
  });
});

test("裁剪中偏移漂移不误杀会话", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  // 一行文本 + 一张图：在文本行末尾键入会让图片的文档偏移下移。
  await page.evaluate((img) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__(
      "/tmp/crop-sync/drift.md",
      `前文行\n\n![甲](${img}){width=300}\n`,
      "drift.md",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, IMG);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });

  // 光标落到文本行末尾，键入若干字符（产生 undo 历史，图片偏移下移）。
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type("追加文字");
  await expect.poll(() => content(page)).toContain("前文行追加文字");

  const widgetFrom = () =>
    page
      .locator(".cm-image-widget")
      .evaluate((el) => Number(el.dataset.imageFrom));
  const fromBefore = await widgetFrom();

  // 进入裁剪：框挂到图片宿主上。
  await page.locator(".cm-image-widget").click();
  await clickCropButton(page);
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await expect(page.locator(".cm-image-crop-shade")).toHaveCount(4);

  // 撤销刚才的键入：图片偏移回退 → widget 复用（updateDOM）而非重建。
  await page.keyboard.press("Meta+z");
  await expect.poll(() => content(page)).not.toContain("追加文字");
  await expect.poll(widgetFrom).not.toBe(fromBefore);

  // 守卫生效：活会话的框 / 蒙层 / 裁剪态类都还在。
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await expect(page.locator(".cm-image-crop-shade")).toHaveCount(4);
  await expect(
    page.locator(".cm-image-widget.cm-image-crop-active"),
  ).toHaveCount(1);

  // 会话可正常退出，无死锁。
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect(page.locator(".cm-image-crop-shade")).toHaveCount(0);
});
