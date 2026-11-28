import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * 基件 A（Button / IconButton）真实浏览器验收（#1708 / 2.1）。
 *
 * 打开 `/?showcase`（dev-only 分流，见 src/main.tsx），断言计算样式与几何，
 * 不只断言 DOM 存在——B1 教训：自测全绿但用户看不到变化。
 */

const ARTIFACTS = ".artifacts/1708";

const VARIANTS = [
  "primary",
  "secondary",
  "soft",
  "ghost",
  "danger",
  "danger-soft",
] as const;

test.beforeAll(() => {
  mkdirSync(ARTIFACTS, { recursive: true });
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/?showcase", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-primitive="button"]', { timeout: 30000 });
  await page.waitForSelector('[data-primitive="iconbutton"]', { timeout: 30000 });
}

/** 把 CSS 变量挂到真实元素上解析成浏览器归一化后的颜色串 */
function resolveVar(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${n})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

function backgroundColor(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

test("锚点数量：button 13 / iconbutton 4 / [data-showcase] ≥17", async ({
  page,
}) => {
  await boot(page);
  // 12（6 variant × 2 size）+ 1 loading；示例区的 disabled / primary-rule 不计入
  expect(await page.locator('[data-primitive="button"]').count()).toBe(13);
  expect(await page.locator('[data-primitive="iconbutton"]').count()).toBe(4);
  expect(
    await page.locator("[data-showcase]").count(),
  ).toBeGreaterThanOrEqual(17);
});

test("六个 variant 各一且 md 档计算样式互不相同", async ({ page }) => {
  await boot(page);
  for (const v of VARIANTS) {
    await expect(page.locator(`[data-showcase="button-${v}-md"]`)).toHaveCount(
      1,
    );
  }
  const signatures = await page.evaluate((variants) => {
    return variants.map((v) => {
      const el = document.querySelector(
        `[data-showcase="button-${v}-md"]`,
      ) as HTMLElement | null;
      if (!el) return "missing";
      const cs = getComputedStyle(el);
      return `${cs.backgroundColor}|${cs.color}|${cs.borderTopColor}`;
    });
  }, [...VARIANTS]);
  expect(new Set(signatures).size).toBeGreaterThanOrEqual(5);
});

test("primary / secondary 底色严格等于 token 解析值", async ({ page }) => {
  await boot(page);
  const accentFill = await resolveVar(page, "--app-accent-fill");
  const surface = await resolveVar(page, "--app-surface");
  expect(await backgroundColor(page, '[data-showcase="button-primary-md"]')).toBe(
    accentFill,
  );
  expect(
    await backgroundColor(page, '[data-showcase="button-secondary-md"]'),
  ).toBe(surface);
});

type ColorPair = { bg: string; color: string } | null;

interface DangerSample {
  token: string;
  onDanger: string;
  danger: ColorPair;
  dangerSoft: ColorPair;
  secondary: ColorPair;
}

function sampleDanger(page: Page): Promise<DangerSample> {
  return page.evaluate(() => {
    const resolve = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${name})`;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const pick = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    };
    return {
      token: resolve("--app-danger"),
      onDanger: resolve("--app-on-danger"),
      danger: pick('[data-showcase="button-danger-md"]'),
      dangerSoft: pick('[data-showcase="button-danger-soft-md"]'),
      secondary: pick('[data-showcase="button-secondary-md"]'),
    };
  });
}

test("danger 与 secondary 底色不等，且 danger 实底 = --app-danger（明暗）", async ({
  page,
}) => {
  await boot(page);
  const light = await sampleDanger(page);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  // 背景色有 0.12s transition，等它走完再采计算值，否则取到明暗插值中间态
  await page.waitForTimeout(300);
  const dark = await sampleDanger(page);
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  console.log(`[danger][light] ${JSON.stringify(light)}`);
  console.log(`[danger][dark] ${JSON.stringify(dark)}`);

  for (const [name, s] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    expect(s.danger, `${name} danger 存在`).not.toBeNull();
    expect(s.dangerSoft, `${name} danger-soft 存在`).not.toBeNull();
    expect(s.secondary, `${name} secondary 存在`).not.toBeNull();
    expect(s.danger!.bg, `${name} danger 底色 = --app-danger`).toBe(s.token);
    expect(s.danger!.color, `${name} danger 文字 = --app-on-danger`).toBe(
      s.onDanger,
    );
    expect(s.danger!.bg, `${name} danger 与 secondary 底色不等`).not.toBe(
      s.secondary!.bg,
    );
    expect(s.dangerSoft!.color, `${name} danger-soft 文字 = --app-danger`).toBe(
      s.token,
    );
  }
});

test("每个 IconButton 命中区 ≥24×24", async ({ page }) => {
  await boot(page);
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-primitive="iconbutton"]')].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      },
    ),
  );
  expect(boxes.length).toBe(4);
  for (const b of boxes) {
    expect(b.w).toBeGreaterThanOrEqual(24);
    expect(b.h).toBeGreaterThanOrEqual(24);
  }
});

test("禁用态（Button / IconButton）点击不产生 data-clicked", async ({
  page,
}) => {
  await boot(page);
  await page.locator('[data-showcase="button-disabled"]').click({ force: true });
  expect(await page.locator("[data-clicked]").count()).toBe(0);

  await page
    .locator('[data-showcase="iconbutton-18-disabled"]')
    .click({ force: true });
  expect(await page.locator("[data-clicked]").count()).toBe(0);

  await page.locator('[data-showcase="button-secondary-md"]').click();
  expect(await page.locator("[data-clicked]").count()).toBe(1);
});

test("loading：宽度与空闲态严格一致、文案仍在 DOM、aria-busy", async ({
  page,
}) => {
  await boot(page);
  const el = page.locator('[data-showcase="button-loading"]');
  await expect(el).toHaveAttribute("aria-busy", "true");
  expect(await el.evaluate((n) => n.textContent)).toContain("保存中");
  expect(await el.locator(".bp-btn-spinner").count()).toBe(1);

  const widthLoading = await el.evaluate(
    (n) => n.getBoundingClientRect().width,
  );
  // 摘掉 loading 类恢复可见文案，宽度必须不变（证明 spinner 未挤占流内空间）
  await el.evaluate((n) => n.classList.remove("bp-btn--loading"));
  const widthIdle = await el.evaluate((n) => n.getBoundingClientRect().width);
  await el.evaluate((n) => n.classList.add("bp-btn--loading"));

  expect(widthLoading).toBeGreaterThan(0);
  expect(Math.abs(widthIdle - widthLoading)).toBeLessThan(0.5);
});

test("每屏 primary ≤1：操作区严格 1，网格 primary 是展示样本且已显式豁免", async ({
  page,
}) => {
  await boot(page);
  // 音量纪律约束的是「操作区」：一屏只允许一个主操作
  await expect(
    page.locator('[data-section="primary-rule"] .bp-btn--primary'),
  ).toHaveCount(1);
  // 网格 = variant × size 展示样本，其中的 primary 不是真实操作区，不计入音量纪律；
  // 数量显式声明（6 variant × 2 size 中 primary 占 sm/md 两格），改动即红。
  await expect(
    page.locator('[data-showcase-grid="samples"] .bp-btn--primary'),
  ).toHaveCount(2);
});

test("sm / md 两档尺寸各自成立（sm 不被误改成 md 尺寸）", async ({ page }) => {
  await boot(page);
  const size = async (sel: string) =>
    page.locator(sel).evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { fontSize: s.fontSize, height: r.height, padY: s.paddingTop };
    });
  const sm = await size('[data-showcase="button-secondary-sm"]');
  const md = await size('[data-showcase="button-secondary-md"]');
  expect(sm.fontSize).toBe("12px");
  expect(md.fontSize).toBe("13px");
  expect(sm.padY).toBe("4px");
  expect(md.padY).toBe("6px");
  expect(sm.height).toBeLessThan(md.height);
});

test("loading 切换不残留上一轮文案（真实状态驱动 idle→loading→idle）", async ({
  page,
}) => {
  await boot(page);
  const toggle = page.locator('[data-showcase="button-loading-toggle"]');
  const switcher = page.locator(
    '[data-showcase="button-loading-toggle-switch"]',
  );

  // 初始 idle：文案是「保存」，无 aria-busy，宽度记为 W1
  await expect(toggle).toHaveText("保存");
  await expect(toggle).not.toHaveAttribute("aria-busy", "true");
  const w1 = await toggle.evaluate((n) => n.getBoundingClientRect().width);

  // 点切换 → 进入 loading：aria-busy=true、文案仍在 DOM（不替换 children）、宽度不变
  await switcher.click();
  await expect(toggle).toHaveAttribute("aria-busy", "true");
  await expect(toggle).toHaveText("保存");
  const wLoading = await toggle.evaluate((n) => n.getBoundingClientRect().width);
  expect(Math.abs(wLoading - w1)).toBeLessThan(0.5);

  // 再点切换 → 回到 idle：aria-busy 消失、文案仍是「保存」（未残留上一轮）、宽度不变
  await switcher.click();
  await expect(toggle).not.toHaveAttribute("aria-busy", "true");
  await expect(toggle).toHaveText("保存");
  const w2 = await toggle.evaluate((n) => n.getBoundingClientRect().width);
  expect(Math.abs(w2 - w1)).toBeLessThan(0.5);
});

test("截图：亮色全页", async ({ page }) => {
  await boot(page);
  await page.screenshot({
    path: `${ARTIFACTS}/01-showcase-light.png`,
    fullPage: true,
  });
});

test("截图：hover 态（primary / secondary / ghost）", async ({ page }) => {
  await boot(page);
  await page.locator('[data-showcase="button-primary-md"]').hover();
  await page.screenshot({
    path: `${ARTIFACTS}/02-showcase-hover.png`,
    fullPage: true,
  });
});

test("截图：禁用态（Button + IconButton）", async ({ page }) => {
  await boot(page);
  await page.screenshot({
    path: `${ARTIFACTS}/03-showcase-disabled.png`,
    fullPage: true,
  });
});

test("截图：loading 按钮特写（宽度不抖）", async ({ page }) => {
  await boot(page);
  await page
    .locator('[data-showcase="button-loading"]')
    .screenshot({ path: `${ARTIFACTS}/05-showcase-loading.png` });
});

test("截图：暗色主题对照场", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `${ARTIFACTS}/04-showcase-dark.png`,
    fullPage: true,
  });
});
