import { test, expect, type Page } from "@playwright/test";

/**
 * #1453 复测（用户走查）：
 * 1. 多次裁剪后第二张图点「裁剪」无反应——旧实现用全局 `isImageCropActive()`
 *    判断，任何图上的框都会吃掉这次点击（确认一个不在文档里的框），框不出现。
 * 2. 裁剪指针与图片缩放指针同形，拖拽意图混淆。
 * 3. 确认后不得残留裁剪态 DOM / 内联样式。
 * 4. 进入与确认裁剪不改视口（滚动位置），含瞬时跳变。
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

const PNG_DATA_URL_2000x1400 = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 2000;
  canvas.height = 1400;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#336699";
  ctx.fillRect(0, 0, 2000, 1400);
  return canvas.toDataURL("image/png");
};

const para = (n: number) =>
  Array.from({ length: n }, (_, i) => `第${i}段 正文用于撑开文档高度。`).join(
    "\n\n",
  );

async function openTwoImages(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  const dataUrl = await page.evaluate(PNG_DATA_URL_2000x1400);
  // 预览按 URL 判种类（data: 会被当成附件卡），用同源 http 路径 + 路由回放
  // 真实 PNG 字节，编辑态与预览态拿到同一份图片。
  const base64 = dataUrl.split(",")[1];
  await page.route("**/test-assets/crop.png", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(base64, "base64"),
    }),
  );
  const src = `${new URL(page.url()).origin}/test-assets/crop.png`;
  const doc = [
    para(3),
    `![甲](${src}){width=500}`,
    para(3),
    `![乙](${src}){width=620 height=380}`,
    para(5),
  ].join("\n\n");
  await page.evaluate((doc) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/crop-session/session.md", doc, "session.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, doc);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function centerImage(page: Page, alt: string): Promise<void> {
  await page.evaluate((alt) => {
    const img = document.querySelector(`.cm-image-widget img[alt="${alt}"]`);
    (
      img?.closest(".cm-image-widget") as HTMLElement | undefined
    )?.scrollIntoView({
      block: "center",
    });
  }, alt);
  await page.waitForTimeout(200);
  await page.waitForFunction((alt) => {
    const img = document.querySelector(
      `.cm-image-widget img[alt="${alt}"]`,
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  }, alt);
}

async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

test("跨图再裁剪：别的图挂着裁剪框时，点本图裁剪第一下就出框", async ({
  page,
}) => {
  await openTwoImages(page);

  // 甲图进入裁剪（不拖），框一直挂着。
  await centerImage(page, "甲");
  await page.locator('.cm-image-widget img[alt="甲"]').click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  // 直接去乙图点裁剪：第一下必须出乙图的框（旧实现会吃掉这次点击）。
  await centerImage(page, "乙");
  await page.locator('.cm-image-widget img[alt="乙"]').click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  // 框只在乙图上：甲图无裁剪态。
  const state = await page.evaluate(() => {
    const widgets = [
      ...document.querySelectorAll(".cm-image-widget"),
    ] as HTMLElement[];
    return widgets.map((w) => ({
      alt: w.querySelector("img")?.getAttribute("alt"),
      crop: w.classList.contains("cm-image-crop-active"),
      frames: w.querySelectorAll(".cm-image-crop-frame").length,
    }));
  });
  expect(state).toEqual([
    { alt: "甲", crop: false, frames: 0 },
    { alt: "乙", crop: true, frames: 1 },
  ]);

  // 未拖动就确认 = 取消：不写 crop，框退出。
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  expect(await content(page)).not.toContain("crop=");
});

test("裁剪指针与图片缩放指针不同形", async ({ page }) => {
  await openTwoImages(page);
  await centerImage(page, "乙");
  await page.locator('.cm-image-widget img[alt="乙"]').click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  const cursors = await page.evaluate(() => {
    const crop = [
      ...document.querySelectorAll(".cm-image-crop-frame [data-handle]"),
    ].map((el) => getComputedStyle(el).cursor);
    const resize = [
      ...document.querySelectorAll(".cm-image-widget > .cm-image-handle"),
    ].map((el) => getComputedStyle(el).cursor);
    return {
      crop,
      resize,
      frame: getComputedStyle(document.querySelector(".cm-image-crop-frame")!)
        .cursor,
    };
  });

  // 8 个裁剪控制点统一用自定义裁剪指针（白描边 + 黑括号），不再是方向箭头。
  expect(cursors.crop).toHaveLength(8);
  for (const c of cursors.crop) {
    expect(c).toContain("url(");
    expect(c).toContain("crosshair");
  }
  // 缩放把手仍是方向箭头，两种拖拽一眼可分。
  expect(cursors.resize.length).toBeGreaterThan(0);
  for (const c of cursors.resize) {
    expect(["ew-resize", "ns-resize", "nesw-resize", "nwse-resize"]).toContain(
      c,
    );
  }
  expect(cursors.resize).not.toContain(cursors.crop[0]);

  // 角 / 边两族字形，逐方向自旋转（按 DOM 顺序取 8 个控制点）。
  const ordered = await page.evaluate(() => {
    const frame = document.querySelector(".cm-image-crop-frame")!;
    return [...frame.querySelectorAll("[data-handle]")].map(
      (el) => getComputedStyle(el).cursor,
    );
  });
  // DOM 顺序 = HANDLE_AXES 键序：e, w, n, s, ne, nw, se, sw。
  const [e, w, n, s, nw, ne, se, sw] = ordered;
  expect(new Set([nw, ne, se, sw]).size).toBe(4);
  expect(new Set([e, w, n, s]).size).toBe(4);
  const edgeSet = new Set([e, w, n, s]);
  for (const c of [nw, ne, se, sw]) expect(edgeSet.has(c)).toBe(false);
});

test("确认裁剪后无残留：无裁剪框 DOM、无裁剪内联样式、无裁剪态类", async ({
  page,
}) => {
  await openTwoImages(page);
  await centerImage(page, "乙");
  await page.locator('.cm-image-widget img[alt="乙"]').click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  const box = (await page
    .locator('.cm-image-crop-frame [data-handle="se"]')
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 - 120,
    box.y + box.height / 2 - 60,
    {
      steps: 6,
    },
  );
  await page.mouse.up();
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await page.waitForTimeout(120);

  const leftovers = await page.evaluate(() => {
    const img = document.querySelector(
      '.cm-image-widget img[alt="乙"]',
    ) as HTMLImageElement;
    const win = img.closest(".image-crop-window") as HTMLElement | null;
    return {
      frames: document.querySelectorAll(".cm-image-crop-frame").length,
      active: document.querySelectorAll(".cm-image-crop-active").length,
      handles: document.querySelectorAll(".cm-image-crop-frame [data-handle]")
        .length,
      winW: win ? Math.round(win.getBoundingClientRect().width) : null,
      transform: img.style.transform,
      visibility: img.style.visibility,
    };
  });
  expect(leftovers.frames).toBe(0);
  expect(leftovers.active).toBe(0);
  expect(leftovers.handles).toBe(0);
  // 确认后仍是裁剪显示（合法）：可见框宽 = 写回的 width，内图按裁剪矩形缩放。
  const final = await content(page);
  expect(final).toContain("crop=");
  const w = /\bwidth=(\d+)/.exec(final);
  expect(w).not.toBeNull();
  expect(Math.abs(leftovers.winW! - Number(w![1]))).toBeLessThanOrEqual(2);
  expect(leftovers.transform).toMatch(/^scale\(/);
  // 裁剪显示会显式置 visible；残留的表现是同「卡在 hidden」，不是这一项。
  expect(leftovers.visibility).not.toBe("hidden");
});

test("进入与确认裁剪不改视口（含瞬时跳变）", async ({ page }) => {
  await openTwoImages(page);
  await centerImage(page, "乙");

  // 记录每一次滚动事件，捕捉瞬时跳变后回弹的情况。
  await page.evaluate(() => {
    const w = window as unknown as { __trace: number[] };
    w.__trace = [];
    const sc = document.querySelector(".cm-scroller") as HTMLElement;
    sc.addEventListener("scroll", () =>
      w.__trace.push(Math.round(sc.scrollTop)),
    );
  });

  const scrollNow = () =>
    page.evaluate(() =>
      Math.round(
        (document.querySelector(".cm-scroller") as HTMLElement).scrollTop,
      ),
    );

  const before = await scrollNow();
  await page.locator('.cm-image-widget img[alt="乙"]').click();
  await page.waitForTimeout(100);
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await page.waitForTimeout(150);
  expect(Math.abs((await scrollNow()) - before)).toBeLessThanOrEqual(1);

  const box = (await page
    .locator('.cm-image-crop-frame [data-handle="se"]')
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  const beforeConfirm = await scrollNow();
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await page.waitForTimeout(200);
  expect(Math.abs((await scrollNow()) - beforeConfirm)).toBeLessThanOrEqual(1);

  // 滚动轨迹里不应出现远离锚点的瞬时值。
  const trace = await page.evaluate(
    () => (window as unknown as { __trace: number[] }).__trace,
  );
  for (const v of trace) {
    expect(Math.abs(v - before)).toBeLessThanOrEqual(2);
  }
});

test("预览态裁剪显示与编辑态调整后的几何一致", async ({ page }) => {
  await openTwoImages(page);
  await centerImage(page, "乙");
  await page.locator('.cm-image-widget img[alt="乙"]').click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);

  const box = (await page
    .locator('.cm-image-crop-frame [data-handle="se"]')
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 - 140,
    box.y + box.height / 2 - 70,
    { steps: 6 },
  );
  await page.mouse.up();
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await page.waitForTimeout(150);

  const edit = await page.evaluate(() => {
    const img = document.querySelector(
      '.cm-image-widget img[alt="乙"]',
    ) as HTMLImageElement;
    const win = img.closest(".image-crop-window") as HTMLElement;
    const r = win.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      transform: img.style.transform,
    };
  });
  expect(edit.w).toBeGreaterThan(50);

  // 切到预览：同一份文档，显示盒与缩放必须一致。
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await page.waitForSelector(".preview-img-crop", { timeout: 10000 });
  await page.waitForTimeout(200);

  const preview = await page.evaluate(() => {
    const wrap = document.querySelector(".preview-img-crop") as HTMLElement;
    const img = wrap?.querySelector("img") as HTMLImageElement | null;
    const r = wrap?.getBoundingClientRect();
    return {
      w: r ? Math.round(r.width) : 0,
      h: r ? Math.round(r.height) : 0,
      transform: img?.style.transform ?? "",
      visibleOffsets: img ? img.style.objectPosition : null,
    };
  });

  expect(Math.abs(preview.w - edit.w)).toBeLessThanOrEqual(2);
  expect(Math.abs(preview.h - edit.h)).toBeLessThanOrEqual(2);
  // 用缩放平移，不是 1:1 偏移（object-position 不缩放，区域会与编辑态不同）。
  expect(preview.transform).toMatch(/^translate\(.*\) scale\(/);
  const [, sx] = /scale\(([\d.]+)/.exec(preview.transform) ?? [];
  const [, ex] = /scale\(([\d.]+)/.exec(edit.transform) ?? [];
  expect(Number(sx)).toBeCloseTo(Number(ex), 2);
});
