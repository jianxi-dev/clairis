import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { HEADING_FONT_STACK } from "../src/lib/headingFonts";

/**
 * 标题字体配置字段与设置 UI（#853 / C1a）。
 *
 * 走 e2e/mocks/tauri-mock.js：list_system_fonts 返回固定已安装列表；
 * 另加一次性持久化 initScript：首次 load_config 合并 localStorage.__config__，
 * save_config 写回，模拟重启往返。
 *
 * 本票只做配置字段 + 校验 + 设置 UI + 持久化；编辑态 / 预览态套用字体是 #854。
 */

const ART = path.resolve(process.cwd(), ".artifacts/853");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

// 镜像 e2e/mocks/tauri-mock.js 的默认字体列表（#1136 起命令返回字符串数组）。
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

async function boot(
  page: Page,
  stored?: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (stored) {
    await page.addInitScript((cfg) => {
      try {
        localStorage.setItem("__config__", JSON.stringify(cfg));
      } catch {
        /* localStorage 不可用时按缺省处理 */
      }
    }, stored);
  }
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

async function openAppearance(page: Page): Promise<void> {
  await page.locator('[data-settings-nav="appearance"]').click();
  await expect(
    page.locator("input[data-testid^='heading-font-h']"),
  ).toHaveCount(6);
}

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

test("设置面板含 6 个逐级入口，未配置级别显示「默认」占位", async ({
  page,
}) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  for (const level of LEVELS) {
    const input = page.locator(`[data-testid="heading-font-${level}"]`);
    await expect(input).toHaveValue("");
    await expect(input).toHaveAttribute("placeholder", "默认");
  }

  // mock 默认返回本机字体数组；枚举失败降级见下方用例。
  const options = await page
    .locator("#heading-font-options option")
    .evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(options).toEqual(SYSTEM_FONT_OPTIONS);

  // 触发一次落盘：未配置时不应写任何显式级别（不填默认栈）。
  await page.locator('[data-testid="font-size-17"]').click();
  await expect
    .poll(async () => Object.keys(await persistedHeadingFonts(page)).length)
    .toBe(0);

  await shot(page, "settings-heading-fonts-6", "settings-heading-fonts-6");
});

test("枚举失败降级手输并显示提示（#1136）", async ({ page }) => {
  await page.addInitScript(() => {
    (
      window as unknown as Record<string, unknown>
    ).__biaoyue_system_fonts_error__ = true;
  });
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  await expect(page.locator("#heading-font-options option")).toHaveCount(0);
  await expect(page.locator('[data-testid="heading-font-hint"]')).toHaveText(
    "字体枚举失败，请手动输入",
  );

  // 枚举失败不阻塞手输：合法字体直接落盘。
  const h1 = page.locator('[data-testid="heading-font-h1"]');
  await h1.fill("ZzzNoSuchFont909");
  await h1.press("Enter");
  await expect(page.locator('[data-testid="heading-font-hint"]')).toHaveCount(
    0,
  );
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h1)
    .toBe("ZzzNoSuchFont909");
});

test("改某级字体后只持久化该级显式配置", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  const h1 = page.locator('[data-testid="heading-font-h1"]');
  await h1.fill("Songti SC");
  await h1.press("Enter");

  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h1)
    .toBe("Songti SC");

  const fonts = await persistedHeadingFonts(page);
  expect(Object.keys(fonts).sort()).toEqual(["h1"]);
  expect(fonts.h2).toBeUndefined();
  expect(fonts.h6).toBeUndefined();

  await shot(page, "changed-h1", "changed-h1");
});

test("非法字体被拒绝并回落默认，不落盘", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  const h2 = page.locator('[data-testid="heading-font-h2"]');
  await h2.fill("ZzzNoSuchFont909");
  await h2.press("Enter");

  await expect(page.locator('[data-testid="heading-font-hint"]')).toBeVisible();
  await expect(h2).toHaveValue("");

  // 触发一次无关保存：非法值不得被写进配置
  await page.locator('[data-testid="font-size-17"]').click();
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h2)
    .toBeUndefined();

  await shot(page, "invalid-rejected", "invalid-rejected");
});

test("重启后标题字体保持（持久化往返）", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  const h1 = page.locator('[data-testid="heading-font-h1"]');
  await h1.fill("Songti SC");
  await h1.press("Enter");
  const h3 = page.locator('[data-testid="heading-font-h3"]');
  await h3.fill("Menlo");
  await h3.press("Enter");

  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h1)
    .toBe("Songti SC");
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h3)
    .toBe("Menlo");

  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]');
  await openSettings(page);
  await openAppearance(page);

  await expect(h1).toHaveValue("Songti SC");
  await expect(h3).toHaveValue("Menlo");
  await shot(page, "persisted-after-reload", "persisted-after-reload");
});

test("非法配置值加载时被拒绝，合法值保留", async ({ page }) => {
  await boot(page, {
    headingFonts: { h1: "Bad{Font}", h2: "Songti SC" },
  });
  await openSettings(page);
  await openAppearance(page);

  await expect(page.locator('[data-testid="heading-font-h1"]')).toHaveValue("");
  await expect(page.locator('[data-testid="heading-font-h2"]')).toHaveValue(
    "Songti SC",
  );

  await page.locator('[data-testid="font-size-17"]').click();
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h1)
    .toBeUndefined();
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h2)
    .toBe("Songti SC");
});

test("历史「6 级全默认栈」配置加载后显示「默认」且渲染不变", async ({
  page,
}) => {
  await boot(page, {
    headingFonts: Object.fromEntries(
      LEVELS.map((level) => [level, HEADING_FONT_STACK]),
    ),
  });
  await openSettings(page);
  await openAppearance(page);

  for (const level of LEVELS) {
    await expect(
      page.locator(`[data-testid="heading-font-${level}"]`),
    ).toHaveValue("");
  }
  await shot(
    page,
    "legacy-all-stack-placeholder",
    "legacy-all-stack-placeholder",
  );
});
