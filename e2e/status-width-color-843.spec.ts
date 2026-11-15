import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { moveThrough } from "./helpers/ui-probe";
import { EDITOR_ANCHORS } from "./fixtures/editor-anchors";

/**
 * #843（change=editor-surface-batch19/12.1）状态栏页面宽度弹窗配色。
 *
 * A-12.1 选中档进度条与色块计算色相等
 * A-12.2 未选中档与选中档同色相且可辨
 * 色值取设计系统 §6 语义色 --app-accent，不新增色板。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/843");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const PRESETS = [720, 960, 1080, 1200] as const;

const { unselectedFillOpacityMax, hueToleranceDeg } = EDITOR_ANCHORS.widthPanel;

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

async function boot(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/width.md", "# width", "width.md");
  });
  await page.waitForTimeout(300);
}

/**
 * 悬停开屏：指针路径分步跨过触发器与面板之间的 6px 空隙并在过渡区停顿，
 * 不用一步 hover 瞬移（ui-test-matrix 规则 4）。
 */
async function openPanel(page: Page): Promise<Locator> {
  await boot(page);
  const control = page.getByTestId("width-control");
  const panel = page.getByTestId("width-panel");
  const box = (await control.boundingBox())!;
  const cx = box.x + box.width / 2;
  await moveThrough(
    page,
    [
      { x: cx, y: box.y + box.height / 2 },
      { x: cx, y: box.y - 3 },
      { x: cx, y: box.y - 14 },
    ],
    { steps: 4, pauseMs: 60 },
  );
  await expect(panel).toBeVisible();
  return panel;
}

/** 写真实截图并登记到 state-coverage.json（ui-surface 证据面）。 */
async function shot(target: Page | Locator, name: string): Promise<void> {
  const file = path.join(ART, `${name}.png`);
  await target.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      name,
      "--screenshot",
      file,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
}

/** 读取当前选中档的三处计算色：色块底、色块填充、进度条。 */
function readSelectedColors(page: Page) {
  return page.evaluate(() => {
    const active = document.querySelector(".width-bar.is-active")!;
    const fill = active.querySelector(".width-bar-fill")!;
    const slider = document.querySelector(".width-slider")!;
    return {
      block: getComputedStyle(active).backgroundColor,
      fill: getComputedStyle(fill).backgroundColor,
      bar: getComputedStyle(slider).accentColor,
    };
  });
}

/** 色块底色有 120ms 过渡，等它落到与填充同色再断言。 */
async function expectBlockMatchesFill(page: Page, fill: string): Promise<void> {
  await expect
    .poll(() => readSelectedColors(page).then((c) => c.block), {
      timeout: 2000,
    })
    .toBe(fill);
}

function hexToRgb(hex: string): string | null {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

interface BarColor {
  fill: string;
  opacity: number;
  active: boolean;
  composite: string;
  compositeHue: number;
}

/** 读取四档填充的计算色，并按各自不透明度合成到面板底色上求可辨性与色相。 */
function readBars(page: Page) {
  return page.locator(".width-bar").evaluateAll((els) => {
    const surface = getComputedStyle(
      document.querySelector(".width-panel")!,
    ).backgroundColor;
    const parse = (s: string) => {
      const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      return m
        ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
        : { r: 0, g: 0, b: 0, a: 1 };
    };
    const hueOf = (r: number, g: number, b: number) => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d === 0) return 0;
      let h =
        max === r
          ? ((g - b) / d) % 6
          : max === g
            ? (b - r) / d + 2
            : (r - g) / d + 4;
      h *= 60;
      return h < 0 ? h + 360 : h;
    };
    const surf = parse(surface);
    return els.map((el) => {
      const f = el.querySelector(".width-bar-fill")!;
      const fs = getComputedStyle(f);
      const c = parse(fs.backgroundColor);
      const a = Number(fs.opacity);
      const comp = {
        r: Math.round(c.r * a + surf.r * (1 - a)),
        g: Math.round(c.g * a + surf.g * (1 - a)),
        b: Math.round(c.b * a + surf.b * (1 - a)),
      };
      return {
        fill: fs.backgroundColor,
        opacity: a,
        active: el.classList.contains("is-active"),
        composite: `rgb(${comp.r}, ${comp.g}, ${comp.b})`,
        compositeHue: Math.round(hueOf(comp.r, comp.g, comp.b) * 10) / 10,
      };
    });
  }) as Promise<BarColor[]>;
}

test("选中档进度条与色块计算色相等", async ({ page }) => {
  for (const value of PRESETS) {
    const panel = await openPanel(page);
    await page.locator(`[data-testid="width-preset-${value}"]`).click();

    const colors = await readSelectedColors(page);
    expect(colors.bar).toBe(colors.fill);

    const accentVar = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--app-accent")
        .trim(),
    );
    expect(colors.fill).toBe(hexToRgb(accentVar));

    await expectBlockMatchesFill(page, colors.fill);

    if (value === 720 || value === 1200) {
      await shot(
        panel,
        `option-${value === 720 ? "compact" : "loose"}-selected`,
      );
    }
  }
});

test("未选中档与选中档同色相且可辨", async ({ page }) => {
  const panel = await openPanel(page);
  const bars = await readBars(page);

  expect(bars).toHaveLength(4);
  const active = bars.find((b) => b.active);
  expect(active).toBeDefined();
  const unselected = bars.filter((b) => !b.active);
  expect(unselected).toHaveLength(3);

  for (const bar of bars) {
    expect(
      Math.abs(bar.compositeHue - active!.compositeHue),
    ).toBeLessThanOrEqual(hueToleranceDeg);
  }

  expect(active!.opacity).toBe(1);
  for (const bar of unselected) {
    expect(bar.opacity).toBeLessThanOrEqual(unselectedFillOpacityMax);
    expect(bar.composite).not.toBe(active!.composite);
  }

  await shot(panel, "unselected-distinct");

  await page.locator('[data-testid="width-preset-960"]').click();
  const colors = await readSelectedColors(page);
  expect(colors.bar).toBe(colors.fill);
  await expectBlockMatchesFill(page, colors.fill);

  await shot(panel, "bar-matches-block");
});
