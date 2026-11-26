import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 标题字体本机枚举（#1136 / shell-preview-refine 4.1）。
 *
 * 走 e2e/mocks/tauri-mock.js：list_system_fonts 返回本机字体数组；
 * __biaoyue_system_fonts_error__ 模拟枚举失败。持久化经 localStorage.__config__
 * 往返，模拟重启。
 */

const ART = path.resolve(process.cwd(), ".artifacts/1136");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const SYSTEM_FONT_OPTIONS = [
  "PingFang SC",
  "Hiragino Sans GB",
  "Songti SC",
  "Heiti SC",
  "STHeiti",
  "Kaiti SC",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Menlo",
  "SF Mono",
  "Noto Sans CJK SC",
  "Source Han Sans SC",
  "Noto Sans",
  "Noto Serif CJK SC",
  "Source Han Serif SC",
  "Inter",
  "JetBrains Mono",
  "Fira Code",
  "IBM Plex Sans",
  "Microsoft YaHei",
  "SimSun",
  "SimHei",
];

// 与 e2e/mocks/tauri-mock.js 的 DEFAULT_SYSTEM_FONTS localized 顺序一一对应。
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
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
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

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

test("设置面板标题字体候选来自本机枚举（非空、非写死常量）", async ({
  page,
}) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  await page.locator('[data-testid="heading-font-h1"]').focus();
  const optionLocator = page.locator(
    '[data-testid="heading-font-options"] [role="option"]',
  );
  await expect(optionLocator).toHaveCount(SYSTEM_FONT_LOCALIZED.length);
  const options = await optionLocator.evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).textContent ?? ""),
  );
  expect(options).toEqual(SYSTEM_FONT_LOCALIZED);
  await shot(page, "options-enumerated", "options-enumerated");
});

test("从候选选择字体后写入对应级别并落盘、生效", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  const h2 = page.locator('[data-testid="heading-font-h2"]');
  await h2.fill("Inter");
  await h2.press("Enter");

  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h2)
    .toBe("Inter");

  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/hf1136.md", "## 二级标题\n", "hf1136.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  const heading = page.locator(".cm-heading.cm-h2").first();
  await heading.waitFor({ timeout: 10000 });
  await expect
    .poll(async () =>
      heading.evaluate((el) => getComputedStyle(el as Element).fontFamily),
    )
    .toContain("Inter");
  await shot(page, "selected-persisted", "selected-persisted");
});

test("枚举失败降级手输并显示提示", async ({ page }) => {
  await page.addInitScript(() => {
    (
      window as unknown as Record<string, unknown>
    ).__biaoyue_system_fonts_error__ = true;
  });
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  await page.locator('[data-testid="heading-font-h3"]').focus();
  await expect(
    page.locator('[data-testid="heading-font-options"] [role="option"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid="heading-font-hint"]')).toHaveText(
    "字体枚举失败，请手动输入",
  );

  const h3 = page.locator('[data-testid="heading-font-h3"]');
  await h3.fill("ZzzManualFont777");
  await h3.press("Enter");
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h3)
    .toBe("ZzzManualFont777");
  await shot(page, "enum-failure-fallback", "enum-failure-fallback");
});

test("选择候选后重启仍保持（持久化往返）", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  const h4 = page.locator('[data-testid="heading-font-h4"]');
  await h4.fill("JetBrains Mono");
  await h4.press("Enter");
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h4)
    .toBe("JetBrains Mono");

  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]');
  await openSettings(page);
  await openAppearance(page);

  await expect(h4).toHaveValue("JetBrains Mono");
  await shot(page, "reload-persisted", "reload-persisted");
});

test("已选字体后再聚焦仍显示全量候选（显示值与搜索词分离）", async ({
  page,
}) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  const h1 = page.locator('[data-testid="heading-font-h1"]');
  await h1.focus();
  const optionLocator = page.locator(
    '[data-testid="heading-font-options"] [role="option"]',
  );
  const total = await optionLocator.count();
  expect(total).toBeGreaterThan(1);
  mkdirSync(".artifacts/1517", { recursive: true });
  await page.screenshot({ path: ".artifacts/1517/01-focus-all.png" });

  await h1.fill("Inter");
  await h1.press("Enter");
  await expect(h1).toHaveValue("Inter");

  await h1.blur();
  await h1.focus();
  await expect(optionLocator).toHaveCount(total);

  await page.screenshot({ path: ".artifacts/1517/02-selected.png" });
  await h1.fill("苹");
  const filteredCount = await optionLocator.count();
  await page.screenshot({ path: ".artifacts/1517/03-filtered.png" });
  expect(filteredCount).toBeLessThan(total);
  const texts = await optionLocator.evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).textContent ?? ""),
  );
  expect(texts.some((t) => t.includes("苹"))).toBe(true);

  await h1.fill("");
  await expect(optionLocator).toHaveCount(total);
  await page.screenshot({ path: ".artifacts/1517/04-cleared.png" });
});
