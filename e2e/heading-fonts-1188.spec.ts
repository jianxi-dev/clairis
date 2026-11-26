import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 标题字体自绘候选列表（#1188 / settings-font-picker 1.3）。
 *
 * 验收：聚焦开面板；候选显示本机 local化名；↑/↓ 移动高亮、Enter 选中写盘
 * 原始 family；Esc / 点击外部关闭；中文优先排序；暖色主题可读。
 * 走 e2e/mocks/tauri-mock.js，持久化经 localStorage.__config__ 往返。
 */

const ART = path.resolve(process.cwd(), ".artifacts/1188");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const SYSTEM_FONT_LOCALIZED = [
  "苹方-简",
  "冬青黑体-简",
  "宋体-简",
  "黑体-简",
  "华文黑体",
  "楷体-简",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Menlo",
  "SF Mono",
  "思源黑体 SC",
  "思源黑体 SC",
  "Noto Sans",
  "思源宋体 SC",
  "思源宋体 SC",
  "Inter",
  "JetBrains Mono",
  "Fira Code",
  "IBM Plex Sans",
  "微软雅黑",
  "宋体",
  "黑体",
];

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

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
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__?: {
        invoke?: (cmd: string, args?: unknown) => unknown;
      };
    };
    const internals = w.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== "function") return;
    const orig = internals.invoke;
    let merged = false;
    internals.invoke = async (cmd: string, args?: unknown) => {
      if (cmd === "load_config" && !merged) {
        merged = true;
        const res = (await orig(cmd, args)) as Record<string, unknown>;
        try {
          const raw = localStorage.getItem("__config__");
          if (raw) return { ...res, ...JSON.parse(raw) };
        } catch {
          /* localStorage 不可用时按缺省处理 */
        }
        return res;
      }
      if (cmd === "save_config") {
        const config = (
          args as { config?: Record<string, unknown> } | undefined
        )?.config;
        if (config) {
          try {
            localStorage.setItem("__config__", JSON.stringify(config));
          } catch {
            /* ignore */
          }
        }
      }
      return orig(cmd, args);
    };
  });
  await page.goto("http://localhost:1424", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
}

async function openAppearance(page: Page): Promise<void> {
  await page.locator('[data-settings-nav="appearance"]').click();
  await expect(
    page.locator("input[data-testid^='heading-font-h']"),
  ).toHaveCount(6);
}

async function openPanel(page: Page): Promise<void> {
  await page.locator('[data-testid="heading-font-h1"]').focus();
  await expect(
    page.locator('[data-testid="heading-font-options"] [role="option"]'),
  ).toHaveCount(SYSTEM_FONT_LOCALIZED.length);
}

function storedConfig(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("__config__");
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  });
}

async function persistedHeadingFonts(
  page: Page,
): Promise<Record<string, string>> {
  const cfg = await storedConfig(page);
  return (cfg?.headingFonts as Record<string, string>) ?? {};
}

function hexToRgb(hex: string): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  const num = parseInt(full, 16);
  return `rgb(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255})`;
}

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

test("聚焦输入框打开自绘候选面板", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  await expect(
    page.locator('[data-testid="heading-font-options"]'),
  ).toHaveCount(0);

  await openPanel(page);
  await expect(
    page.locator('[data-testid="heading-font-options"]'),
  ).toBeVisible();

  await shot(page, "panel-open", "panel-open");
});

test("候选显示本机 local化名且中文优先排序", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);
  await openPanel(page);

  const options = page.locator(
    '[data-testid="heading-font-options"] [role="option"]',
  );
  const labels = await options.evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).textContent ?? ""),
  );
  expect(labels).toEqual(SYSTEM_FONT_LOCALIZED);
  for (const label of labels.slice(0, 6)) {
    expect(CJK.test(label)).toBe(true);
  }
  expect(CJK.test(labels[6])).toBe(false);
  await shot(page, "localized-order", "localized-order");
});

test("↑↓ 移动高亮，Enter 选中写盘原始 family", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);
  await openPanel(page);

  const first = page
    .locator('[data-testid="heading-font-options"] [role="option"]')
    .first();
  await page.keyboard.press("ArrowDown");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await shot(page, "keyboard-highlight", "keyboard-highlight");

  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="heading-font-h1"]')).toHaveValue(
    "苹方-简",
  );
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h1)
    .toBe("PingFang SC");
  await shot(page, "selected-writes-family", "selected-writes-family");
});

test("Esc 关闭候选面板且不关闭设置", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);
  await openPanel(page);

  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-testid="heading-font-options"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
});

test("点击面板外部关闭", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);
  await openPanel(page);

  await page.locator('[data-testid="settings-heading-fonts"] h2').click();
  await expect(
    page.locator('[data-testid="heading-font-options"]'),
  ).toHaveCount(0);
});

test("暖色主题下候选面板可读", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  await page.locator('[data-testid="theme-option-warm"]').click();
  await expect(page.locator("html")).toHaveClass(/warm/);
  await openPanel(page);

  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const panel = document.querySelector(
      '[data-testid="heading-font-options"]',
    ) as HTMLElement;
    const option = panel.querySelector('[role="option"]') as HTMLElement;
    return {
      surface: root.getPropertyValue("--app-surface").trim(),
      text: root.getPropertyValue("--app-text").trim(),
      panelBg: getComputedStyle(panel).backgroundColor,
      optionColor: getComputedStyle(option).color,
    };
  });
  expect(tokens.panelBg).toBe(hexToRgb(tokens.surface));
  expect(tokens.optionColor).toBe(hexToRgb(tokens.text));
  await shot(page, "warm-theme-readable", "warm-theme-readable");
});
