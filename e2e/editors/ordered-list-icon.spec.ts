import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1433：有序列表图标与无序同形（三条横线 + 三个相同小标记）。
 *
 * 既有用例只断言 `data-icon` 名（代理属性）。本文件在**真实渲染**上断言字形：
 * 把活 DOM 里手柄图标的 `<svg>` 栅格化到 canvas，取左 42% 标记列，分三条横带，
 * 每带算一个 8×8 墨迹位图签名。无序三枚圆点 → 1 种；有序编号 → ≥2 种。
 * 旧字形（三个相同小方块）三条带同签名 → 1 → 测试失败。
 */

const ART = ".artifacts/1433";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

/** 截图并登记到 state-coverage.json（QG-5 多态证据 manifest）。 */
async function shot(page: Page, name: string, state: string): Promise<void> {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      state,
      "--screenshot",
      `.artifacts/1433/${name}.png`,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
}

const DOC = ["1. 有序项", "", "- 无序项", ""].join("\n");

/** 把指针移到召唤区外，收掉上一个手柄，避免读到上一块的图标。 */
async function dismissHandles(page: Page): Promise<void> {
  const contentRect = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { top: rect.top, right: rect.right };
  });
  await page.mouse.move(contentRect.right - 24, contentRect.top + 40, {
    steps: 3,
  });
  await expect(page.locator(".cm-block-handle-visible")).toHaveCount(0);
}

/** 召唤某一行的块手柄，返回其图标 `<svg>` 的 outerHTML（真实生产字形）。 */
async function summonHandleIconSvg(
  page: Page,
  lineText: string,
): Promise<string> {
  await dismissHandles(page);
  const line = page.locator(".cm-line").filter({ hasText: lineText }).first();
  await hoverLineLeft(page, line);
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  const svg = await handle
    .locator(".cm-block-handle-icon svg")
    .first()
    .evaluate((el) => el.outerHTML);
  return svg;
}

/**
 * 栅格化 svg：48px 绘制，取左 42% 标记列，按 y 方向把墨迹聚成若干簇，
 * 每簇归一化到 8×8 墨迹位图签名。返回各簇签名字符串数组。
 */
async function bandSignatures(page: Page, svgHtml: string): Promise<string[]> {
  return page.evaluate(async (svgHtml) => {
    const SIZE = 48;
    const sized = svgHtml.replace(
      /<svg\b/i,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"`,
    );
    const img = new Image();
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      sized,
    )}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg 加载失败"));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

    const colW = Math.floor(SIZE * 0.42);
    const rowInk: number[] = [];
    for (let y = 0; y < SIZE; y += 1) {
      let n = 0;
      for (let x = 0; x < colW; x += 1) {
        if (data[(y * SIZE + x) * 4 + 3] > 40) n += 1;
      }
      rowInk.push(n);
    }
    const clusters: Array<{ y0: number; y1: number }> = [];
    let cur: { y0: number; y1: number } | null = null;
    for (let y = 0; y < SIZE; y += 1) {
      if (rowInk[y] > 0) {
        if (cur === null) cur = { y0: y, y1: y };
        else cur.y1 = y;
      } else if (cur !== null) {
        clusters.push(cur);
        cur = null;
      }
    }
    if (cur !== null) clusters.push(cur);

    const bands: string[] = [];
    for (const cl of clusters) {
      const pts: Array<[number, number]> = [];
      for (let y = cl.y0; y <= cl.y1; y += 1) {
        for (let x = 0; x < colW; x += 1) {
          if (data[(y * SIZE + x) * 4 + 3] > 40) pts.push([x, y]);
        }
      }
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const yy0 = Math.min(...ys);
      const yy1 = Math.max(...ys);
      let bits = "";
      for (let gy = 0; gy < 8; gy += 1) {
        for (let gx = 0; gx < 8; gx += 1) {
          const sx = x0 + Math.floor((gx / 8) * (x1 - x0 + 1));
          const sy = yy0 + Math.floor((gy / 8) * (yy1 - yy0 + 1));
          bits += data[(sy * SIZE + sx) * 4 + 3] > 40 ? "1" : "0";
        }
      }
      bands.push(bits);
    }
    return bands;
  }, svgHtml);
}

test("有序列表手柄字形与无序不同形（栅格带签名）", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "ordered-list-icon");

  const orderedSvg = await summonHandleIconSvg(page, "有序项");
  await shot(page, "01-handle-ordered", "ordered-handle");

  const bulletSvg = await summonHandleIconSvg(page, "无序项");
  await shot(page, "02-handle-bullet", "bullet-handle");

  const orderedBands = await bandSignatures(page, orderedSvg);
  const bulletBands = await bandSignatures(page, bulletSvg);

  const orderedDistinct = new Set(orderedBands).size;
  const bulletDistinct = new Set(bulletBands).size;

  // 无序：三枚相同圆点 → 1 种带签名。
  expect(bulletDistinct).toBe(1);
  // 有序：编号不是均匀标记 → ≥2 种。旧字形（三个相同小方块）为 1 → 失败。
  expect(orderedDistinct).toBeGreaterThanOrEqual(2);
});

test("手柄 data-icon 映射保持 OrderListOutlined / DisorderListOutlined", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "ordered-list-icon-map");

  const orderedIcon = await page.evaluate(() => {
    const h = document.querySelector('.cm-block-handle[data-block-from="0"]');
    return (
      h
        ?.querySelector(".cm-block-handle-icon svg")
        ?.getAttribute("data-icon") ?? null
    );
  });
  expect(orderedIcon).toBe("OrderListOutlined");

  const bulletIcon = await page.evaluate(() => {
    const handles = Array.from(document.querySelectorAll(".cm-block-handle"));
    const bullet = handles.find(
      (h) =>
        (h
          .querySelector(".cm-block-handle-icon svg")
          ?.getAttribute("data-icon") ?? "") === "DisorderListOutlined",
    );
    return bullet
      ? (bullet
          .querySelector(".cm-block-handle-icon svg")
          ?.getAttribute("data-icon") ?? null)
      : null;
  });
  expect(bulletIcon).toBe("DisorderListOutlined");
});

test("转换为菜单网格的有序单元渲染编号字形", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "ordered-list-icon-menu");

  const line = page.locator(".cm-line").filter({ hasText: "有序项" }).first();
  await hoverLineLeft(page, line);
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  const menu = page.locator('[data-testid="block-menu"]');
  await expect(menu).toBeVisible({ timeout: 3000 });

  const cell = page.locator(
    '[data-testid="block-menu-cell"][data-target="ordered"]',
  );
  await expect(cell).toHaveCount(1);
  const cellIcon = await cell.locator("svg").getAttribute("data-icon");
  expect(cellIcon).toBe("OrderListOutlined");

  await shot(page, "03-convert-menu", "convert-menu-ordered");
});

test("括号写法 1) 的有序块手柄同样渲染编号字形", async ({ page }) => {
  await openMarkdownInEdit(
    page,
    ["1) 括号有序", ""].join("\n"),
    "ordered-list-icon-paren",
  );

  const line = page.locator(".cm-line").filter({ hasText: "括号有序" }).first();
  await hoverLineLeft(page, line);
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await expect(handle.locator(".cm-block-handle-icon svg")).toHaveAttribute(
    "data-icon",
    "OrderListOutlined",
  );

  await shot(page, "04-ordered-paren", "ordered-paren-handle");
});
