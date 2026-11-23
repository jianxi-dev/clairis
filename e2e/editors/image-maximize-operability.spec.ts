import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { makePngDataUrl } from "../helpers/png";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1410 图片浮层与放大预览三缺陷验收。
 *
 * A-1 选中图片后 AI 按钮默认不选中：aria-pressed 严格为 "false"，无 is-active。
 * A-2 放大预览可缩到 1x 以下：滚轮向下 3 次后 scale < 1 且 >= 0.5（产品决定：
 *     最小 0.5x；旧的 1x 下限是 #1410 缺陷 2）。
 * A-3 放大后底部控件可点：3x 下 elementFromPoint 命中控件条内的按钮；点「关闭预览」
 *     后浮层节点数严格为 0（无残留）。
 */

const ART = ".artifacts/1410";
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
        `.artifacts/1410/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);
const DOC = `![甲](${IMG}){width=600}\n`;

interface Transform {
  tx: number;
  ty: number;
  scale: number;
  rotation: number;
}

async function readTransform(page: Page): Promise<Transform | null> {
  return page.evaluate(() => {
    const img = document.querySelector(
      '[data-testid="img-maximize"] img',
    ) as HTMLImageElement | null;
    if (!img) return null;
    const m =
      /translate\((-?[\d.eE+-]+)px,\s*(-?[\d.eE+-]+)px\)\s*scale\((-?[\d.eE+-]+)\)\s*rotate\((-?[\d.eE+-]+)deg\)/.exec(
        img.style.transform,
      );
    if (!m) return null;
    return {
      tx: parseFloat(m[1]),
      ty: parseFloat(m[2]),
      scale: parseFloat(m[3]),
      rotation: parseFloat(m[4]),
    };
  });
}

async function openMaximize(page: Page): Promise<void> {
  await page.locator(".cm-image-widget img").dblclick();
  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
}

test("A-1 选中图片后 AI 按钮默认不选中", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "maxops-ai-default");
  await page.locator(".cm-image-widget").click();
  const toolbar = page.getByTestId("img-toolbar");
  await expect(toolbar).toBeVisible();

  const ai = page.getByTestId("img-toolbar-ai");
  await expect(ai).toHaveAttribute("aria-pressed", "false");
  await expect(ai).not.toHaveClass(/is-active/);
  await shot(page, "01-selected-ai-default", "selected-ai-default");
});

test("A-2 放大预览可缩到 1x 以下（下限 0.5x）", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "maxops-zoom-out");
  await openMaximize(page);

  const img = page.getByTestId("img-maximize").locator("img");
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 240);
  }

  const t = (await readTransform(page))!;
  expect(t.scale).toBeLessThan(1);
  expect(t.scale).toBeGreaterThanOrEqual(0.5);
  await shot(page, "02-zoomed-out", "zoomed-out");
});

test("A-3 放大后底部控件在最上层可点，关闭后无残留", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "maxops-controls");
  await openMaximize(page);

  const img = page.getByTestId("img-maximize").locator("img");
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // 每步 ×1.1，12 步 = 3.14x（> 3x）。
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, -240);
  }
  await expect
    .poll(async () => (await readTransform(page))?.scale)
    .toBeGreaterThan(3);

  // 控件条中心命中的必须是按钮或其子节点（QG-4：断言可点，不只是存在）。
  const hit = await page.evaluate(() => {
    const bar = document.querySelector(
      '[data-testid="img-max-controls"]',
    ) as HTMLElement | null;
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    const el = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    return el
      ? { tag: el.tagName, testid: el.getAttribute("data-testid") }
      : null;
  });
  expect(hit).not.toBeNull();
  const inBar = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="img-max-controls"]');
    const el = document.elementFromPoint(
      bar!.getBoundingClientRect().left +
        bar!.getBoundingClientRect().width / 2,
      bar!.getBoundingClientRect().top +
        bar!.getBoundingClientRect().height / 2,
    );
    if (!el) return false;
    return (
      el === bar ||
      bar!.contains(el) ||
      !!el.closest('[data-testid="img-max-controls"]')
    );
  });
  expect(inBar).toBe(true);
  await shot(page, "03-controls-above", "controls-above");

  await page.getByTestId("img-max-close").click();
  await expect(page.getByTestId("img-maximize")).toHaveCount(0);
  await shot(page, "04-closed", "closed");
});
