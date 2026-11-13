import { test, expect, type Page } from "@playwright/test";

/**
 * #710：默认居中、工具条对齐态、已裁剪图锚点不进裁剪。
 *
 * 三张断言各自钉住 D15 的一个根因：
 * - toDOM 从不读 attrs.align → 新图不居中、工具条无 active。
 * - beginResize 见 _crop 就转 beginCropResize → 已裁剪图拖锚点调裁剪而非缩放。
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

test("默认居中：data-align=center、左右外边距对称、居中按钮 pressed", async ({
  page,
}) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "aligncenter",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await expect(widget).toHaveCount(1);
  await expect(widget).toHaveAttribute("data-align", "center");

  const margins = await widget.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      left: parseFloat(cs.marginLeft),
      right: parseFloat(cs.marginRight),
    };
  });
  expect(margins.left).toBeGreaterThan(0);
  expect(margins.right).toBeGreaterThan(0);
  expect(Math.abs(margins.left - margins.right)).toBeLessThan(1);

  await widget.click();
  await expect(page.getByTestId("img-toolbar-align-center")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("img-toolbar-align-left")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByTestId("img-toolbar-align-right")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await page.screenshot({ path: ".artifacts/710/01-default-center.png" });
});

test("对齐按下态有可测色差", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n",
    "alignPressed",
    PNG_DATA_URL,
  );
  await page.locator(".cm-image-widget").click();

  const center = page.getByTestId("img-toolbar-align-center");
  const left = page.getByTestId("img-toolbar-align-left");
  await expect(center).toHaveAttribute("aria-pressed", "true");
  await expect(left).toHaveAttribute("aria-pressed", "false");

  const backgrounds = await page.evaluate(() => {
    const read = (testid: string) => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      return el ? getComputedStyle(el).backgroundColor : "";
    };
    return {
      pressed: read("img-toolbar-align-center"),
      idle: read("img-toolbar-align-left"),
    };
  });
  const channelSum = (value: string) =>
    (value.match(/\d+/g) ?? [])
      .slice(0, 3)
      .reduce((sum, n) => sum + Number(n), 0);
  expect(channelSum(backgrounds.pressed)).not.toBe(
    channelSum(backgrounds.idle),
  );
});

test("切左对齐：仅左按钮 pressed，data-align=left，markdown 写 align=left", async ({
  page,
}) => {
  await openEditor(page, "![pic](assets/pic.png)\n", "alignleft", PNG_DATA_URL);
  const widget = page.locator(".cm-image-widget");
  await widget.click();

  await page.getByTestId("img-toolbar-align-left").click();

  await expect(widget).toHaveAttribute("data-align", "left");
  await expect(page.getByTestId("img-toolbar-align-left")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("img-toolbar-align-center")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByTestId("img-toolbar-align-right")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect.poll(() => content(page)).toContain("align=left");

  await page.screenshot({ path: ".artifacts/710/02-left-align.png" });
});

test("已裁剪图拖角部锚点：不进裁剪浮层，走缩放并写入 width", async ({
  page,
}) => {
  await openEditor(
    page,
    `![示例](${PNG_DATA_URL}){crop=3,3,26,26}\n`,
    "cropanchor",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  const img = widget.locator("img");
  const before = await img.evaluate((el) => el.getBoundingClientRect().width);

  const handle = page.locator('[data-handle="se"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 80,
    {
      steps: 6,
    },
  );
  // 预览期宽度已变，且裁剪浮层始终不存在。
  const during = await img.evaluate((el) => el.getBoundingClientRect().width);
  expect(during).toBeGreaterThan(before);
  await expect(page.locator(".cm-image-crop-rect")).toHaveCount(0);
  await page.screenshot({ path: ".artifacts/710/03-cropped-anchor-drag.png" });

  await page.mouse.up();
  await expect(page.locator(".cm-image-crop-rect")).toHaveCount(0);

  const final = await content(page);
  expect(final).toContain("crop=3,3,26,26");
  expect(final).toMatch(/width=\d+ height=\d+/);
});

test("取消选中：工具条移除，无残留 pressed", async ({ page }) => {
  await openEditor(
    page,
    "![pic](assets/pic.png)\n\n第二段\n",
    "alignDeselect",
    PNG_DATA_URL,
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await expect(page.getByTestId("img-toolbar-align-center")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.mouse.click(600, 600);

  await expect(page.getByTestId("img-toolbar")).toHaveCount(0);
  await expect(
    page.locator('.cm-image-toolbar button[aria-pressed="true"]'),
  ).toHaveCount(0);
  await page.screenshot({ path: ".artifacts/710/04-deselected.png" });
});
