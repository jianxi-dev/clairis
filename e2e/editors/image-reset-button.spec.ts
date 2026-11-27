import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1561（change=editor-surface-batch23/1.3）重置按钮条件显示（E-39）。
 *
 * 三态：未裁剪图选中 → 工具条无「重置图片」（计算样式 display:none）；
 * 裁剪确认后选中该图 → 按钮出现；拖回整图重置后再次选中 → 按钮消失。
 * 放大层（查看）**永不含**「重置图片」（#1603 九轮用户裁定：多图切换时
 * 它会顶掉切换按钮位置造成左右跑位；重置能力只在编辑态工具条提供）。
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

async function resetDisplay(page: Page): Promise<string> {
  return page
    .getByTestId("img-toolbar-reset")
    .evaluate((el) => getComputedStyle(el as HTMLElement).display);
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
    win.__biaoyue_openFile__("/tmp/reset-button/three.md", body, "three.md");
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

async function selectWidget(page: Page, index: number): Promise<void> {
  const widget = page.locator(".cm-image-widget").nth(index);
  await widget.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await widget.click();
  await page.getByTestId("img-toolbar").waitFor({ state: "visible" });
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

async function cropOnce(page: Page, index: number): Promise<void> {
  await selectWidget(page, index);
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await dragHandle(page, "nw", 30, 20);
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
}

test("未裁剪图选中：工具条无「重置图片」（计算样式 display:none）", async ({
  page,
}) => {
  await openThreeImages(page);
  await selectWidget(page, 0);
  await expect(page.getByTestId("img-toolbar-reset")).toHaveCount(1);
  expect(await resetDisplay(page)).toBe("none");
});

test("裁剪确认后选中该图：按钮出现；拖回整图重置后再次选中：按钮消失", async ({
  page,
}) => {
  await openThreeImages(page);

  await cropOnce(page, 0);
  await expect.poll(() => content(page)).toContain("crop=");

  await selectWidget(page, 0);
  expect(await resetDisplay(page)).not.toBe("none");

  // 拖回整图：crop 属性移除。
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await dragHandle(page, "nw", -400, -300);
  await page.getByTestId("img-crop-frame").dblclick();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect.poll(() => content(page)).not.toContain("crop=");

  await selectWidget(page, 0);
  expect(await resetDisplay(page)).toBe("none");
});

test("放大层永无「重置图片」（裁剪图也一样，避免切换按钮跑位）", async ({
  page,
}) => {
  await openThreeImages(page);

  await page.locator(".cm-image-widget").nth(0).dblclick();
  await expect(page.locator('[data-testid="img-maximize"]')).toBeVisible();
  await expect(page.getByTestId("img-max-clear-crop")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="img-maximize"]')).toBeHidden();

  await cropOnce(page, 1);
  await expect.poll(() => content(page)).toContain("crop=");

  await page.locator(".cm-image-widget").nth(1).dblclick();
  await expect(page.locator('[data-testid="img-maximize"]')).toBeVisible();
  // 裁剪过的图也不出现重置图片：切换 1↔2 时按钮组宽度恒定
  await expect(page.getByTestId("img-max-clear-crop")).toHaveCount(0);
  const w1 = await page
    .locator('[data-testid="img-max-controls"]')
    .boundingBox();
  await page.getByTestId("img-max-prev").click();
  await page.waitForTimeout(120);
  const w2 = await page
    .locator('[data-testid="img-max-controls"]')
    .boundingBox();
  expect(Math.round(w1!.width)).toBe(Math.round(w2!.width));
});
