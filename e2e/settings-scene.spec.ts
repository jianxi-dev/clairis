import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 设置场景（layout-portal 12.1 / #182）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 `window.__biaoyue_store__` 桥
 * 驱动状态。每个 state 截图落 `.artifacts/182/`，收尾写 state-coverage.json。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/182");

mkdirSync(ART, { recursive: true });

type Assertion = "passed" | "failed" | "untested";
interface StateRow {
  state: string;
  screenshot: string;
  assertion: Assertion;
  recorded_at: string;
  runner: string;
}
const states: StateRow[] = [];

async function record(
  page: Page,
  state: string,
  assertion: Assertion = "passed",
): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion,
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
}

test.afterAll(() => {
  const byState = new Map<string, StateRow>();
  for (const row of states) byState.set(row.state, row);
  const payload = {
    task: "182-settings",
    states: [...byState.values()],
  };
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
}

function sceneOf(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __biaoyue_store__: { getState: () => { scene: string } };
        }
      ).__biaoyue_store__.getState().scene,
  );
}

test("⌘, 打开设置场景：10 个分区、切换高亮、Esc 返回原场景", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setScene: (s: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setScene("workspace");
  });
  const prevScene = await sceneOf(page);

  await openSettings(page);

  const items = page.locator('[data-testid="settings-nav-item"]');
  await expect(items).toHaveCount(10);
  expect(await items.allInnerTexts()).toEqual([
    "外观",
    "编辑器",
    "阅读空间",
    "网格概览",
    "悬浮预览",
    "AI 服务",
    "扩展",
    "快捷键",
    "数据与备份",
    "关于",
  ]);
  await expect(
    page.locator('[data-settings-nav="appearance"]'),
  ).toHaveAttribute("data-active", "true");
  await record(page, "01-scene-open");

  await page.locator('[data-settings-nav="editor"]').click();
  await expect(page.locator('[data-settings-nav="editor"]')).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(
    page.locator('[data-settings-nav="appearance"]'),
  ).toHaveAttribute("data-active", "false");
  await record(page, "02-nav-editor");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
  expect(await sceneOf(page)).toBe(prevScene);
  await record(page, "03-esc-closed");
});

test("外观：3 个主题选项、跟随系统默认开、暖色 token 生效", async ({
  page,
}) => {
  await boot(page);
  await openSettings(page);

  await expect(page.locator('[data-testid^="theme-option-"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="follow-system"]')).toBeChecked();
  await record(page, "04-theme-default");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await record(page, "05-system-dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.locator('[data-testid="theme-option-warm"]').click();
  await expect(page.locator("html")).toHaveClass(/warm/);
  const warmBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--app-bg")
      .trim(),
  );
  expect(warmBg).toBe("#f2e9da");
  await record(page, "06-warm");

  await page.locator('[data-testid="theme-option-light"]').click();
  await expect(page.locator("html")).not.toHaveClass(/warm/);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const lightBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--app-bg")
      .trim(),
  );
  expect(lightBg).toBe("#f7f7f6");
  await record(page, "07-light");
});

test("外观：字号调整即时作用于阅读排版", async ({ page }) => {
  await boot(page);
  await page.evaluate((body) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => void;
      __biaoyue_store__: {
        getState: () => { setEditorMode: (m: string) => void };
      };
    };
    w.__biaoyue_openFile__("/tmp/settings-font.md", body, "settings-font.md");
    w.__biaoyue_store__.getState().setEditorMode("preview");
  }, "# 字号\n\n正文内容。");
  await expect(page.locator(".preview-content")).toBeVisible();

  await openSettings(page);

  await page.locator('[data-testid="font-size-19"]').click();
  await expect
    .poll(() =>
      page
        .locator(".preview-content")
        .evaluate((el) => getComputedStyle(el).fontSize),
    )
    .toBe("19px");
  await record(page, "08-font-19");

  await page.locator('[data-testid="font-size-15"]').click();
  await expect
    .poll(() =>
      page
        .locator(".preview-content")
        .evaluate((el) => getComputedStyle(el).fontSize),
    )
    .toBe("15px");
  await record(page, "09-font-15");
});

test("悬浮预览：关闭网格点击档后不再弹预览，切回点击档恢复", async ({
  page,
}) => {
  await boot(page);
  const now = new Date().toISOString();
  await page.evaluate((openedAt) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          setState: (s: Record<string, unknown>) => void;
        };
      }
    ).__biaoyue_store__.setState({
      recentFiles: [
        { path: "/lib/a.md", title: "甲.md", openedAt, excerpt: "# 甲" },
        { path: "/lib/b.md", title: "乙.md", openedAt, excerpt: "# 乙" },
      ],
      scene: "workspace",
    });
  }, now);

  await openSettings(page);
  await page.locator('[data-settings-nav="preview"]').click();

  await page.locator('[data-testid="preview-rail-hover"]').uncheck();
  await page.locator('[data-testid="grid-mode-off"]').click();

  const off = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { previewSettings: Record<string, unknown> };
        };
      }
    ).__biaoyue_store__.getState();
    return { ...s.previewSettings };
  });
  expect(off).toEqual({ railHover: false, gridMode: "off", enabled: true });
  await record(page, "10-preview-off");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await page.locator("[data-grid-item]").first().click();
  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(0);
  await record(page, "11-grid-no-preview");

  await openSettings(page);
  await page.locator('[data-settings-nav="preview"]').click();
  await page.locator('[data-testid="grid-mode-click"]').click();
  await record(page, "12-preview-click");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await page.locator("[data-grid-item]").first().click();
  await expect(page.locator('[data-testid="floating-preview"]')).toBeVisible();
  await record(page, "13-grid-preview-restored");
});

test("快捷键：核心 7 条 + 完整列表展开", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await page.locator('[data-settings-nav="shortcuts"]').click();

  await expect(page.locator('[data-testid="shortcut-core"]')).toHaveCount(7);
  await expect(page.locator('[data-testid="shortcuts-full"]')).toHaveCount(0);
  await record(page, "14-shortcuts-core");

  await page.locator('[data-testid="shortcuts-full-toggle"]').click();
  await expect(page.locator('[data-testid="shortcuts-full"]')).toBeVisible();
  const rows = await page.locator('[data-testid="shortcut-full-row"]').count();
  expect(rows).toBeGreaterThan(7);
  await record(page, "15-shortcuts-full");
});
