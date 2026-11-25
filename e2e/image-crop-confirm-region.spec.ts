import { test, expect, type Page } from "@playwright/test";

/**
 * #1437 第 1 项：带 {width=…} 的图片裁剪确认后，显示区域必须与拖拽预览一致。
 *
 * 旧实现在 crop + width 分支里把旧的全图显示宽当作可见裁剪宽，确认后盒宽与
 * 内容都不缩放，看到的是更大的区域。本用例比较确认前后可见盒的宽高比，并
 * 校验内图缩放关系。
 */

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: {
    getState: () => {
      setEditorMode: (mode: string) => void;
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
  };
}

async function openLargeImageEditor(page: Page): Promise<void> {
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
    ctx.fillStyle = "#f0b622";
    ctx.fillRect(0, 0, 700, 500);
    return canvas.toDataURL("image/png");
  });
  await page.evaluate(
    ({ src }) => {
      const win = window as unknown as BridgeWindow;
      const doc = `![地图](${src}){width=600}\n`;
      win.__biaoyue_openFile__(
        "/tmp/crop-confirm/crop-confirm.md",
        doc,
        "crop.md",
      );
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { src },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
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

async function boxOf(
  page: Page,
  selector: string,
): Promise<{ width: number; height: number }> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
}

async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

test("带 width 的图片裁剪确认后显示区域与预览一致", async ({ page }) => {
  await openLargeImageEditor(page);
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  await dragHandle(page, "nw", 180, 120);
  const preview = await boxOf(page, ".cm-image-crop-frame");
  expect(preview.width).toBeLessThan(590);
  await page.screenshot({ path: ".artifacts/1437/05-crop-preview.png" });

  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await page.screenshot({ path: ".artifacts/1437/06-crop-confirmed.png" });

  const win = await boxOf(page, ".image-crop-window");
  expect(Math.abs(win.width / preview.width - 1)).toBeLessThanOrEqual(0.02);
  expect(Math.abs(win.height / preview.height - 1)).toBeLessThanOrEqual(0.02);

  await expect.poll(() => content(page)).toContain("crop=");
  const final = await content(page);
  const crop = /\bcrop=(\d+),(\d+),(\d+),(\d+)/.exec(final);
  expect(crop).not.toBeNull();
  const cropWidth = Number(crop![3]);
  const widthAttr = /\bwidth=(\d+)/.exec(final);
  expect(widthAttr).not.toBeNull();
  const width = Number(widthAttr![1]);

  const internals = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      ".cm-image-widget img",
    )!;
    const scale = /scale\(([\d.]+)\)/.exec(img.style.transform);
    return {
      objectFit: getComputedStyle(img).objectFit,
      objectPosition: img.style.objectPosition,
      scale: scale ? Number(scale[1]) : 0,
      naturalWidth: img.naturalWidth,
    };
  });
  expect(internals.objectFit).toBe("none");
  expect(internals.objectPosition).toBe(
    `${-Number(crop![1])}px ${-Number(crop![2])}px`,
  );
  // width 跟进为可见裁剪显示宽；scale = 可见宽 / 裁剪矩形自然宽。
  expect(Math.abs(width - win.width)).toBeLessThanOrEqual(2);
  expect(internals.scale).toBeCloseTo(width / cropWidth, 3);
});

test("无 width 图片：进入裁剪不撑高，确认不跳滚动且缩放不变", async ({
  page,
}) => {
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
    ctx.fillStyle = "#f0b622";
    ctx.fillRect(0, 0, 700, 500);
    return canvas.toDataURL("image/png");
  });
  const filler = Array.from(
    { length: 40 },
    (_, i) => `后文段落 ${i + 1}，用于观察裁剪引起的布局位移。`,
  ).join("\n");
  await page.evaluate(
    ({ src, filler }) => {
      const win = window as unknown as BridgeWindow;
      const doc = `第一段正文。\n\n![地图](${src})\n\n${filler}\n`;
      win.__biaoyue_openFile__(
        "/tmp/crop-noattr/crop-noattr.md",
        doc,
        "crop-noattr.md",
      );
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { src, filler },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });

  // 滚到图片块顶之上：点击图片的光标 reveal（块比视口高时对齐块顶）就
  // 无事可做，断言不再依赖 reveal 的到达时机。
  await page.evaluate(() => {
    const widget = document.querySelector(".cm-image-widget") as HTMLElement;
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    scroller.scrollTop =
      Math.round(widget.getBoundingClientRect().top + scroller.scrollTop) + 40;
  });

  const state = () =>
    page.evaluate(() => {
      const scroller = document.querySelector(".cm-scroller") as HTMLElement;
      const widget = document.querySelector(".cm-image-widget") as HTMLElement;
      const rect = widget.getBoundingClientRect();
      return {
        scrollTop: Math.round(scroller.scrollTop),
        widgetDocTop: Math.round(rect.top + scroller.scrollTop),
        widgetHeight: Math.round(rect.height),
      };
    });

  const before = await state();

  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await page.waitForTimeout(100);
  const inCrop = await state();
  // 进入裁剪：widget 高度不变（裁剪框不扩大显示区域）。
  expect(
    Math.abs(inCrop.widgetHeight - before.widgetHeight),
  ).toBeLessThanOrEqual(1);

  const frameBox = await page.locator(".cm-image-crop-frame").boundingBox();
  await dragHandle(page, "e", -80, 0);
  const preview = await page.locator(".cm-image-crop-frame").boundingBox();
  expect(preview!.width).toBeLessThan(frameBox!.width - 40);

  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await page.waitForTimeout(120);
  const after = await state();

  // 确认不改变滚动位置（CM6 scroll anchoring 不吃过渡帧高度差）。
  // 与进入裁剪后（inCrop）对比：点击图片本身的光标 reveal 滚动是既有行为。
  expect(Math.abs(after.scrollTop - inCrop.scrollTop)).toBeLessThanOrEqual(2);
  expect(
    Math.abs(after.widgetDocTop - inCrop.widgetDocTop),
  ).toBeLessThanOrEqual(2);

  // 确认前后缩放一致：写入的 width = 预览框宽；win 渲染宽 = width。
  await expect.poll(() => content(page)).toContain("crop=");
  const final = await content(page);
  const widthAttr = /\bwidth=(\d+)/.exec(final);
  expect(widthAttr).not.toBeNull();
  expect(Math.abs(Number(widthAttr![1]) - preview!.width)).toBeLessThanOrEqual(
    2,
  );
  const winBox = await boxOf(page, ".image-crop-window");
  expect(Math.abs(winBox.width - preview!.width)).toBeLessThanOrEqual(2);
});
