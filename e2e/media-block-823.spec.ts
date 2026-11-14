import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * MD 编辑态媒体块 8 项缺陷（#823）的浏览器可观测回归。
 *
 * 图片统一走 data URL 真实像素（convertFileSrc 覆写），视频把 media:// 重写成
 * 内置 tiny.mp4 的 data URL，资产 URL 来源用 <img>/video 的 src setter 覆写。
 */

const TINY_MP4 = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/tiny.mp4"),
).toString("base64");
const MP4_DATA = `data:video/mp4;base64,${TINY_MP4}`;

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=";

const ARTIFACTS = ".artifacts/823";

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

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(
    ({ mp4, png }: { mp4: string; png: string }) => {
      const win = window as unknown as Record<string, any>;
      // 视频 widget 用 setAttribute 写 src，绕过 setter；这里统一把 media:// 重写成真实 mp4。
      const mediaProto = HTMLMediaElement.prototype as unknown as Record<
        string,
        unknown
      >;
      const mediaSet = mediaProto.setAttribute;
      mediaProto.setAttribute = function (name: string, value: string) {
        if (
          name === "src" &&
          typeof value === "string" &&
          value.startsWith("media://")
        ) {
          value = mp4;
        }
        return mediaSet.call(this, name, value);
      };
      // 资产 URL 来源：asset:// 在浏览器解不了，重写成真实 PNG。
      const imgProto = HTMLImageElement.prototype as unknown as Record<
        string,
        unknown
      >;
      const imgDesc = Object.getOwnPropertyDescriptor(imgProto, "src");
      if (imgDesc?.get && imgDesc?.set) {
        Object.defineProperty(imgProto, "src", {
          configurable: true,
          get: imgDesc.get,
          set(this: HTMLImageElement, value: string) {
            imgDesc.set?.call(
              this,
              typeof value === "string" && value.startsWith("asset:")
                ? png
                : value,
            );
          },
        });
      }
      win.__TAURI_INTERNALS__.convertFileSrc = () => png;
    },
    { mp4: MP4_DATA, png: PNG_DATA_URL },
  );
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
}

async function openDoc(
  page: Page,
  name: string,
  doc: string,
  mode: "edit" | "preview",
): Promise<void> {
  await page.evaluate(
    ({ name, doc, mode }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/${name}/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode(mode);
    },
    { name, doc, mode },
  );
  await page
    .locator(mode === "edit" ? ".cm-content" : ".preview-content")
    .waitFor({ timeout: 10000 });
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function blockHandleIcons(
  page: Page,
  blockFrom: string,
): Promise<string[]> {
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  const line = page.locator(".cm-line").first();
  const lineBox = (await line.boundingBox())!;
  // 指针锚在块首行顶部：媒体行很高，行中心会落进 replace widget 里，
  // `posAtCoords` 取不到块位置（对齐既有 media-render 用例的可用路径）。
  await page.mouse.move(
    Math.max(lineBox.x, content.left + content.width * 0.1),
    lineBox.y + 12,
  );
  const handle = page.locator(
    `.cm-block-handle[data-block-from="${blockFrom}"]`,
  );
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  return handle.evaluate((el) =>
    Array.from(el.querySelectorAll("svg[data-icon]")).map((svg) =>
      svg.getAttribute("data-icon"),
    ),
  );
}

test("编辑态图片真实渲染：相对/绝对/资产 URL 三种来源都出图", async ({
  page,
}) => {
  await boot(page);
  await openDoc(
    page,
    "m823img",
    "![相对](assets/pic.png)\n\n![绝对](/tmp/m823img/assets/pic.png)\n\n" +
      "![资产](asset://localhost/%2Ftmp%2Fm823img%2Fassets%2Fpic.png)\n",
    "edit",
  );
  const widgets = page.locator(".cm-image-widget");
  await expect(widgets).toHaveCount(3);
  await expect(page.locator(".cm-media-file")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    const img = widgets.nth(i).locator("img");
    await expect(img).toHaveCount(1);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    const box = await img.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
  }
  await page.screenshot({ path: `${ARTIFACTS}/edit-image-visible.png` });
});

test("heic 图片不再退化成文件卡片（#823 缺陷 3）", async ({ page }) => {
  await boot(page);
  await openDoc(page, "m823heic", "![heic](assets/photo.heic)\n", "edit");
  await expect(page.locator(".cm-image-widget")).toHaveCount(1);
  await expect(page.locator(".cm-media-file")).toHaveCount(0);
  const img = page.locator(".cm-image-widget img");
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: `${ARTIFACTS}/edit-heic-visible.png` });
});

test("mkv 视频渲染成播放器、点击可播放、手柄为视频图标（#823 缺陷 1/2/3）", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page, "m823mkv", "![mkv](assets/movie.mkv)\n", "edit");
  const container = page.locator('.cm-media-widget[data-media-kind="video"]');
  await expect(container).toHaveCount(1);
  await expect(page.locator(".cm-media-file")).toHaveCount(0);

  const video = container.locator("video");
  await expect(video).toHaveJSProperty("controls", true);
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState), {
      timeout: 10000,
    })
    .toBeGreaterThanOrEqual(1);

  const box = (await video.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
      timeout: 8000,
    })
    .toBeGreaterThan(0);
  await page.screenshot({ path: `${ARTIFACTS}/edit-video-playing.png` });
});

test("块手柄按真实块型取图标：mkv / mp4 都是 VideoOutlined（#823 缺陷 2）", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page, "m823mkvhandle", "![mkv](assets/movie.mkv)\n", "edit");
  expect(await blockHandleIcons(page, "0")).toEqual(["VideoOutlined"]);
});

test("裁剪按钮进入选中态，再次点击 / Esc 退出（#823 缺陷 4）", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page, "m823crop", "![pic](assets/pic.png)\n", "edit");
  await page.locator(".cm-image-widget").click();
  const crop = page.getByTestId("img-toolbar-crop");
  await expect(crop).toHaveAttribute("aria-pressed", "false");

  await crop.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await expect(crop).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: `${ARTIFACTS}/crop-pressed.png` });

  await crop.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect(crop).toHaveAttribute("aria-pressed", "false");

  await crop.click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect(crop).toHaveAttribute("aria-pressed", "false");
});

test("「添加描述」只留图标，aria-label 保留（#823 缺陷 5）", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page, "m823desc", "![pic](assets/pic.png)\n", "edit");
  await page.locator(".cm-image-widget").click();
  const desc = page.getByTestId("img-toolbar-comment");
  await expect(desc.locator("svg")).toHaveCount(1);
  await expect(desc.locator(".cm-image-toolbar-label")).toHaveCount(0);
  expect((await desc.innerText()).trim()).toBe("");
  await expect(desc).toHaveAttribute("aria-label", "添加描述");
  await expect(desc).toHaveAttribute("title", "添加描述");
});

test("描述文本点击折叠/展开，有 aria-expanded（#823 缺陷 6）", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page, "m823cap", `![pic](assets/pic.png "标题")\n`, "edit");
  await page.locator(".cm-image-widget").click();
  const caption = page.locator('[data-testid="img-caption"]');
  await expect(caption).toHaveText("标题");
  await expect(caption).toHaveAttribute("aria-expanded", "true");

  await caption.click();
  await expect(caption).toHaveAttribute("aria-expanded", "false");
  await expect(caption).toHaveText("显示描述");
  await expect.poll(() => content(page)).toContain('"标题"');
  await page.screenshot({ path: `${ARTIFACTS}/caption-collapsed.png` });

  await caption.click();
  await expect(caption).toHaveAttribute("aria-expanded", "true");
  await expect(caption).toHaveText("标题");
  await page.screenshot({ path: `${ARTIFACTS}/caption-expanded.png` });
});

test("剪切图标统一为剪刀（#823 缺陷 7）", async ({ page }) => {
  await boot(page);
  await openDoc(page, "m823cut", "![pic](assets/pic.png)\n", "edit");
  await page.locator(".cm-image-widget").click();
  const cut = page.getByTestId("img-toolbar-cut");
  await expect(cut.locator('svg[data-icon="ScissorsOutlined"]')).toHaveCount(1);
  const pathsOf = (el: import("@playwright/test").Locator) =>
    el.evaluate((node) =>
      Array.from(node.querySelectorAll("path"))
        .map((p) => p.getAttribute("d"))
        .join("|"),
    );
  expect(await pathsOf(cut)).not.toBe(
    await pathsOf(page.getByTestId("img-toolbar-crop")),
  );
});

test("预览态阅读宽度变化时图片等比缩放（#823 缺陷 8）", async ({ page }) => {
  await boot(page);
  await openDoc(
    page,
    "m823width",
    "![pic](assets/pic.png){width=900 height=600}\n",
    "preview",
  );
  const img = page.locator(".preview-content img");
  await expect(img).toHaveCount(1);
  const measure = () =>
    page.evaluate(() => {
      const el = document.querySelector(
        ".preview-content img",
      ) as HTMLImageElement;
      const rect = el.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    });

  const wide = await measure();
  await page.screenshot({ path: `${ARTIFACTS}/preview-wide.png` });

  await page
    .getByTestId("status-width")
    .evaluate((el) => (el as HTMLElement).click());
  await page.getByTestId("width-slider").fill("520");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(
          document.querySelector(".preview-content") as HTMLElement,
        )
          .getPropertyValue("--type-measure")
          .trim(),
      ),
    )
    .toBe("520px");

  const narrow = await measure();
  await page.screenshot({ path: `${ARTIFACTS}/preview-narrow.png` });

  expect(narrow.w).toBeLessThan(wide.w);
  expect(Math.abs(narrow.w / narrow.h - wide.w / wide.h)).toBeLessThan(0.02);
});
