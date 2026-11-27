import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1603 修复 B：放大层「调整大小后缩放自动回 100%」探针。
 *
 * 真机签名：滚轮 / 手势调整大小之后，缩放自动还原 100%（不是 reset 按钮后
 * 弹回——是调整动作本身被覆盖）。headless 先复现：rAF 逐帧采样
 * `img.style.transform` 的 scale，标记每次变化；调整后 2 秒内若出现
 * 「非用户发起的 scale 回落到 1」即为缺陷。
 *
 * 同时覆盖两个调整入口：滚轮（maximizeOnWheel）与 ± 按钮（maximizeZoom）。
 */

const IMG = makePngDataUrl(1200, 800, [90, 140, 200]);
const DOC = `![甲](${IMG}){width=600}\n`;

interface ScaleSample {
  t: number;
  scale: number;
}

function installSampler(page: Page): void {
  page.on("console", (msg) => {
    if (msg.type() === "log") console.log(`[browser] ${msg.text()}`);
  });
}

async function readScale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const img = document.querySelector(
      '[data-testid="img-maximize"] img',
    ) as HTMLImageElement | null;
    if (!img) return 0;
    const m = /scale\((-?[\d.eE+-]+)\)/.exec(img.style.transform);
    return m ? parseFloat(m[1]) : 0;
  });
}

/** 在页面内 rAF 逐帧采样 scale，返回整段原始时序。 */
async function sampleScale(page: Page, ms: number): Promise<ScaleSample[]> {
  return page.evaluate(async (windowMs) => {
    const img = document.querySelector(
      '[data-testid="img-maximize"] img',
    ) as HTMLImageElement | null;
    if (!img) throw new Error("放大层无 img");
    const out: ScaleSample[] = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = (): void => {
        const m = /scale\((-?[\d.eE+-]+)\)/.exec(img.style.transform);
        const scale = m ? parseFloat(m[1]) : 0;
        const last = out[out.length - 1];
        if (!last || Math.abs(last.scale - scale) > 1e-6) {
          out.push({ t: Math.round(performance.now() - start), scale });
        }
        if (performance.now() - start >= windowMs) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return out;
  }, ms);
}

async function openMaximize(page: Page): Promise<void> {
  await page.locator(".cm-image-widget img").dblclick();
  await expect(page.getByTestId("img-maximize")).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "max-zoom-persist");
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".cm-image-widget img",
    ) as HTMLImageElement | null;
    return !!img && img.complete && img.naturalWidth > 0;
  });
  await openMaximize(page);
});

test("滚轮调整大小后：2 秒内 scale 不自动回落到 1", async ({ page }) => {
  installSampler(page);
  const img = page.getByTestId("img-maximize").locator("img");
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -240);
  }
  const adjusted = await readScale(page);
  expect(adjusted).toBeGreaterThan(1);

  const samples = await sampleScale(page, 2000);
  console.log(`MAX-ZOOM-PERSIST wheel samples: ${JSON.stringify(samples)}`);

  // 用户调整后的 2 秒内，scale 只能保持或继续变化，不能回落到 1。
  const last = samples[samples.length - 1];
  expect(last.scale).toBeGreaterThan(1);
  const dip = samples.find((s) => s.scale <= 1 + 1e-6);
  expect(dip).toBeUndefined();
});

test("± 按钮调整大小后：2 秒内 scale 不自动回落到 1", async ({ page }) => {
  installSampler(page);
  await page.getByTestId("img-max-zoom-in").click();
  await page.getByTestId("img-max-zoom-in").click();
  const adjusted = await readScale(page);
  expect(adjusted).toBeGreaterThan(1);

  const samples = await sampleScale(page, 2000);
  console.log(`MAX-ZOOM-PERSIST button samples: ${JSON.stringify(samples)}`);

  const last = samples[samples.length - 1];
  expect(last.scale).toBeGreaterThan(1);
  const dip = samples.find((s) => s.scale <= 1 + 1e-6);
  expect(dip).toBeUndefined();
});

test("用户缩放后立刻 reset / 双击背景 / 切下一张：显式复位必须生效", async ({
  page,
}) => {
  installSampler(page);
  await page.getByTestId("img-max-zoom-in").click();
  await page.getByTestId("img-max-zoom-in").click();
  expect(await readScale(page)).toBeGreaterThan(1);
  await page.getByTestId("img-max-reset").click();
  expect(await readScale(page)).toBe(1);
  await expect(page.getByTestId("img-max-scale")).toHaveText("100%");

  await page.getByTestId("img-max-zoom-in").click();
  expect(await readScale(page)).toBeGreaterThan(1);
  const box = (await page.getByTestId("img-maximize").boundingBox())!;
  await page.mouse.dblclick(box.x + 20, box.y + 20);
  expect(await readScale(page)).toBe(1);
});

test("拖拽平移后：scale 不自动回落到 1", async ({ page }) => {
  installSampler(page);
  const img = page.getByTestId("img-maximize").locator("img");
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 2; i++) {
    await page.mouse.wheel(0, -240);
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, {
    steps: 4,
  });
  await page.mouse.up();

  const samples = await sampleScale(page, 2000);
  console.log(`MAX-ZOOM-PERSIST pan samples: ${JSON.stringify(samples)}`);
  const last = samples[samples.length - 1];
  expect(last.scale).toBeGreaterThan(1);
});
