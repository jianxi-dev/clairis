import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { makePngDataUrl } from "../helpers/png";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1408 裁剪态视觉：角标颜色跟随主题 + 去掉整圈蓝色选中框。
 *
 * A-1 浅色主题下裁剪角标（4 角 SVG）计算 color === 该主题 --app-text 计算值。
 * A-2 裁剪框四边 border-top-width 均为 0px（蓝框已移除，边界交给角标 + 边柄）。
 * A-3 四边短柄 .image-crop-mark 计算 background-color 非白且非透明。
 * A-4 暗色主题下角标色与浅色主题不同（主题化生效）。
 */

const ART = ".artifacts/1408";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

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
        `.artifacts/1408/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

const IMG = makePngDataUrl(2000, 1400, [51, 102, 153]);

async function openCrop(page: Page): Promise<void> {
  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-crop").click();
  await expect(page.getByTestId("img-crop-frame")).toHaveCount(1);
}

/** 读根节点某主题变量计算值（不硬编码十六进制，QG-4）。 */
function rootToken(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }, token);
}

/** 把 #rrggbb / rgb() 归一为 rgb(r, g, b)，便于跨来源比较。 */
async function normalizedRgb(page: Page, value: string): Promise<string> {
  return page.evaluate((v) => {
    const probe = document.createElement("div");
    probe.style.color = v;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  }, value);
}

/** 读角标 SVG 计算 color。 */
function cornerColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const icon = document.querySelector<SVGSVGElement>(
      '.cm-image-crop-frame [data-handle="nw"] svg[data-icon]',
    );
    return icon ? getComputedStyle(icon).color : "";
  });
}

/** 读边柄 .image-crop-mark 计算 background-color。 */
function markBackground(page: Page): Promise<string> {
  return page.evaluate(() => {
    const mark = document.querySelector<HTMLElement>(
      '.cm-image-crop-frame [data-handle="n"] .image-crop-mark',
    );
    return mark ? getComputedStyle(mark).backgroundColor : "";
  });
}

/** 读裁剪框四边计算 border-*-width。 */
function frameBorders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(
      '[data-testid="img-crop-frame"]',
    );
    if (!frame) return [];
    const cs = getComputedStyle(frame);
    return [
      cs.borderTopWidth,
      cs.borderRightWidth,
      cs.borderBottomWidth,
      cs.borderLeftWidth,
    ];
  });
}

test("浅色主题：角标色等于 --app-text，裁剪框四边无边框，边柄非白非透明", async ({
  page,
}) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n`, "crop-visual-1408-light");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openCrop(page);

  const token = await rootToken(page, "--app-text");
  expect(token).not.toBe("");
  expect(await normalizedRgb(page, await cornerColor(page))).toBe(
    await normalizedRgb(page, token),
  );

  const borders = await frameBorders(page);
  expect(borders).toHaveLength(4);
  for (const width of borders) expect(width).toBe("0px");

  const bg = await markBackground(page);
  expect(bg).not.toBe("rgb(255, 255, 255)");
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bg).not.toBe("");

  await shot(page, "01-light-handles", "light-handles");
});

test("暗色主题：角标色与浅色主题不同（主题化生效）", async ({ page }) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n`, "crop-visual-1408-dark");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openCrop(page);
  const lightColor = await cornerColor(page);

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkColor = await cornerColor(page);
  expect(darkColor).not.toBe("");
  expect(darkColor).not.toBe(lightColor);
  // 暗色下 --app-text 同样跟随（浅底深 / 暗底浅）。
  expect(await normalizedRgb(page, darkColor)).toBe(
    await normalizedRgb(page, await rootToken(page, "--app-text")),
  );

  await shot(page, "02-dark-handles", "dark-handles");
});

test("裁剪态无整圈蓝框：裁剪框区域只有角标与边柄可见", async ({ page }) => {
  await openMarkdownInEdit(page, `![甲](${IMG})\n`, "crop-visual-1408-frame");
  await page.waitForFunction(() => {
    const img = document.querySelector(".cm-image-widget img") as
      | HTMLImageElement
      | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openCrop(page);

  // 蓝框移除后，裁剪框自身的 border 四边宽度为 0，且边框色不等于 accent
  // （宽度 0 时颜色仍解析为 currentColor，故颜色只作辅助证据）。
  const accent = await normalizedRgb(page, await rootToken(page, "--app-accent"));
  const borderColor = await normalizedRgb(
    page,
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>(
        '[data-testid="img-crop-frame"]',
      );
      return frame ? getComputedStyle(frame).borderTopColor : "";
    }),
  );
  expect(borderColor).not.toBe(accent);

  await shot(page, "03-no-blue-frame", "no-blue-frame");
});
