import { test, expect, type Page } from "@playwright/test";

/**
 * 图片属性块编辑（#651）：拖拽改宽写入 `{width=N}`，路径里的 `(1)` 不被破坏。
 *
 * 旧实现把 `<!--w=N-->` 写在 `)` 后面，但 `[^)]+` 正则会在路径里的 `(1)`
 * 处截断，注释落进 URL。这里用真实拖拽验证：路径完整 + 属性块写对位置。
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

async function openEditor(
  page: Page,
  doc: string,
  name: string,
  imageSrc?: string,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (imageSrc) {
    // Chromium 解不了 asset://，换成可解码的小图，图片才有真实尺寸。
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

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

test("拖拽改宽：路径含括号的图片保持路径完整并写入 {width=", async ({
  page,
}) => {
  // alt 取长一点：悬停工具条压在容器左上角，图片太窄时把手会被工具条盖住
  // （既有 UI 限制，与本票无关），拖不到。
  await openEditor(
    page,
    "![带括号的图片实例](assets/image%20(1).png)\n",
    "imgparen",
  );
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);
  await expect(page.locator('.cm-content img[src^="asset://"]')).toHaveCount(1);

  const handle = page.locator('[data-testid="cm-image-resize"]');
  await expect(handle).toHaveCount(1);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();

  await expect.poll(() => content(page)).toContain("{width=");
  const final = await content(page);
  expect(final).toContain("assets/image%20(1).png");
  expect(final).not.toContain("assets/image%20(1)<!--");
  expect(final).toMatch(
    /!\[带括号的图片实例\]\(assets\/image%20\(1\)\.png\)\{width=\d+\}/,
  );
});

test("拖拽改宽保留已有 height/align，只改宽度", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png){width=200 height=120 align=left}\n",
    "imgkeep",
  );
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);

  const handle = page.locator('[data-testid="cm-image-resize"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, {
    steps: 4,
  });
  await page.mouse.up();

  await expect.poll(() => content(page)).toContain("{width=");
  const final = await content(page);
  expect(final).toContain("height=120");
  expect(final).toContain("align=left");
  expect(final).not.toContain("width=200");
});

test("点击选中：data-selected + 4 个角点", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgselect", PNG_DATA_URL);
  const widget = page.locator(".cm-image-widget");
  await expect(widget).toHaveCount(1);
  await expect(widget).toHaveAttribute("data-selected", "false");

  await widget.click();

  await expect(widget).toHaveAttribute("data-selected", "true");
  await expect(widget.locator(".cm-image-corner")).toHaveCount(4);
});

test("工具条 9 按钮，水平居中于图片（±2px）", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "imgtoolbar",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();

  const toolbar = page.getByTestId("img-toolbar");
  await expect(toolbar).toBeVisible();
  const testids = [
    "img-toolbar-ai",
    "img-toolbar-crop",
    "img-toolbar-comment",
    "img-toolbar-align-left",
    "img-toolbar-align-center",
    "img-toolbar-align-right",
    "img-toolbar-cut",
    "img-toolbar-copy",
    "img-toolbar-delete",
  ];
  for (const id of testids) {
    await expect(page.getByTestId(id)).toHaveCount(1);
  }

  const widgetBox = (await widget.boundingBox())!;
  const toolbarBox = (await toolbar.boundingBox())!;
  const widgetCenter = widgetBox.x + widgetBox.width / 2;
  const toolbarCenter = toolbarBox.x + toolbarBox.width / 2;
  expect(Math.abs(widgetCenter - toolbarCenter)).toBeLessThanOrEqual(2);
});

test("裁剪按钮禁用并提示后续票实现", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgcrop", PNG_DATA_URL);
  await page.locator(".cm-image-widget").click();
  const crop = page.getByTestId("img-toolbar-crop");
  await expect(crop).toBeDisabled();
  await expect(crop).toHaveAttribute("title", "裁剪（后续票实现）");
});

test("图片圆角 8px", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgradius", PNG_DATA_URL);
  const img = page.locator(".cm-image-widget img");
  await expect(img).toHaveCount(1);
  const clip = await img.evaluate((el) => getComputedStyle(el).clipPath);
  expect(clip).toContain("8px");
});

test("双击放大：浮层出现，Esc 关闭，文档不变", async ({ page }) => {
  const doc = "![pic](assets/pic.png)\n";
  await openEditor(page, doc, "imgmax", PNG_DATA_URL);
  const img = page.locator(".cm-image-widget img");
  await img.dblclick();

  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
  expect(await content(page)).toBe(doc);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
  expect(await content(page)).toBe(doc);
});

test("点击外部取消选中", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n\n第二段\n",
    "imgdeselect",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await expect(widget).toHaveAttribute("data-selected", "true");

  await page.mouse.click(600, 600);

  await expect(widget).toHaveAttribute("data-selected", "false");
  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);
});

test("居中清除 align 属性", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png){align=left}\n",
    "imgalign",
    PNG_DATA_URL,
  );
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-align-center").click();
  await expect.poll(() => content(page)).toBe("![pic](assets/pic.png)\n");
});

test("复制把图片 markdown（含属性块）写入剪贴板", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png){width=100}\n",
    "imgcopy",
    PNG_DATA_URL,
  );
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    win.__clipboard__ = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (win.__clipboard__ as string[]).push(text);
          return Promise.resolve();
        },
      },
    });
  });
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-copy").click();
  const clipped = await page.evaluate(
    () => (window as unknown as Record<string, string[]>).__clipboard__,
  );
  expect(clipped).toEqual(["![pic](assets/pic.png){width=100}"]);
});

test("删除移除图片行", async ({ page }) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "imgdelete", PNG_DATA_URL);
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-delete").click();
  await expect.poll(() => content(page)).toBe("");
  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);
});
