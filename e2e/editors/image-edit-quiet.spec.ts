import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { makePngDataUrl } from "../helpers/png";
import { moveThrough, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1391";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

/** 断言通过后截图，并把该态记进 state-coverage.json（QG-5 manifest）。 */
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
        `.artifacts/1391/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

/**
 * #1391（change=editor-refine-batch1/2.1）图片编辑 Quiet 对标。
 *
 * A-3.1 进入图片编辑态后编辑按钮呈选中态，且与未选中态有可测色差
 * A-3.2 编辑态图片渲染宽度严格等于进入编辑前宽度（不缩小）
 * A-3.3 描述区默认隐藏 → 按钮切换显隐 → 裁剪态强制隐藏 → 退出恢复
 * A-3.4 多张图片逐张召唤，手柄缺失数 0
 */

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);

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

function openDoc(page: Page, doc: string, name: string): Promise<void> {
  return openMarkdownInEdit(page, doc, name);
}

/** 多张图片 + 图片间夹杂其他块（含 title / crop / 仅 width 三种属性形态）。 */
const MULTI_DOC = [
  "前文段落",
  "",
  `![甲](${IMG}){width=600 height=400}`,
  "",
  "夹杂段落一",
  "",
  `![乙](${IMG} "已有描述"){width=500}`,
  "",
  "夹杂段落二",
  "",
  `![丙](${IMG})`,
  "",
  "后文段落",
].join("\n");

async function imgBox(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      ".cm-image-widget img",
    );
    if (!img) return { width: 0, height: 0 };
    const rect = img.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
}

async function hoverLeftZone(page: Page, y: number): Promise<void> {
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await moveThrough(page, [{ x: content.left + content.width * 0.1, y }], {
    steps: 4,
  });
  await page.waitForTimeout(420);
}

test("AI 按钮默认不选中（#1410 产品决定：选中不再高亮 AI）", async ({
  page,
}) => {
  await openDoc(page, `![甲](${IMG}){width=600}\n`, "quiet-edit-selected");
  await page.locator(".cm-image-widget").click();
  const toolbar = page.getByTestId("img-toolbar");
  await expect(toolbar).toBeVisible();

  const edit = page.getByTestId("img-toolbar-ai");
  await expect(edit).not.toHaveClass(/is-active/);
  await expect(edit).toHaveAttribute("aria-pressed", "false");

  // 取消选中后工具条整体收起。
  await page.mouse.click(600, 600);
  await expect(toolbar).toHaveCount(0);
});

test("编辑态图片宽度严格等于进入编辑前宽度（不缩小）", async ({ page }) => {
  await openDoc(
    page,
    `![甲](${IMG}){width=600 height=400}\n`,
    "quiet-no-shrink",
  );
  await page.locator(".cm-image-widget img").waitFor();
  const before = await imgBox(page);

  await page.locator(".cm-image-widget").click();
  await expect(page.getByTestId("img-toolbar")).toBeVisible();
  const after = await imgBox(page);

  expect(Math.abs(after.width - before.width)).toBe(0);
  await shot(page, "02-edit-width-unchanged", "edit-width-unchanged");
});

test("描述区默认隐藏，按钮切换显隐，裁剪态强制隐藏，退出恢复", async ({
  page,
}) => {
  await openDoc(page, `![甲](${IMG}){width=600}\n`, "quiet-caption");
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  const caption = page.getByTestId("img-caption");
  const comment = page.getByTestId("img-toolbar-comment");

  await expect(caption).toHaveCSS("display", "none");
  await expect(comment).not.toHaveClass(/is-active/);

  await comment.click();
  await expect(caption).not.toHaveCSS("display", "none");
  await expect(comment).toHaveClass(/is-active/);

  // 进入裁剪态：描述区强制隐藏，按钮态保留。
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
  await expect(caption).toHaveCSS("display", "none");
  await expect(comment).toHaveClass(/is-active/);
  await shot(
    page,
    "03-caption-toggle-and-crop-force-hide",
    "caption-toggle-and-crop-force-hide",
  );

  // 退出裁剪态：描述区恢复由按钮控制，无残留。
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(0);
  await expect(caption).not.toHaveCSS("display", "none");

  // 再点按钮收起，回到默认隐藏。
  await comment.click();
  await expect(caption).toHaveCSS("display", "none");
  await expect(comment).not.toHaveClass(/is-active/);
});

test("多张图片逐张召唤，手柄缺失数 0", async ({ page }) => {
  await openDoc(page, MULTI_DOC, "quiet-handles");
  await page.locator(".cm-image-widget").first().waitFor();

  const froms = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".cm-image-widget")).map(
      (el) => el.dataset.imageFrom,
    ),
  );
  expect(froms.length).toBe(3);

  let missing = 0;
  for (const from of froms) {
    const widget = page.locator(`.cm-image-widget[data-image-from="${from}"]`);
    await widget.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const box = (await widget.boundingBox())!;
    await hoverLeftZone(
      page,
      Math.min(Math.max(box.y + box.height / 2, 60), 740),
    );
    const visible = await page
      .locator(`.cm-block-handle[data-block-from="${from}"]`)
      .evaluate((el) => el.classList.contains("cm-block-handle-visible"));
    if (!visible) missing += 1;
  }
  expect(missing).toBe(0);
  await shot(
    page,
    "04-multi-image-handle-zero-missing",
    "multi-image-handle-zero-missing",
  );
});

test("选中图片滚出视口再滚回，缩放把手不丢失", async ({ page }) => {
  await openDoc(
    page,
    [`![甲](${IMG}){width=600}`, "", "正文"].join("\n") +
      "\n\n" +
      Array.from({ length: 30 }, (_, i) => `第 ${i} 段`).join("\n\n") +
      "\n",
    "quiet-scroll-handle",
  );
  const widget = page.locator(".cm-image-widget");
  await widget.click();
  await expect(widget.locator(".cm-image-handle")).toHaveCount(8);

  await page.evaluate(() => {
    (document.querySelector(".cm-scroller") as HTMLElement).scrollTop = 2000;
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    (document.querySelector(".cm-scroller") as HTMLElement).scrollTop = 0;
  });
  await page.waitForTimeout(400);

  await expect(widget).toHaveAttribute("data-selected", "true");
  await expect(widget.locator(".cm-image-handle")).toHaveCount(8);
  await expect(page.getByTestId("img-toolbar")).toBeVisible();
});
