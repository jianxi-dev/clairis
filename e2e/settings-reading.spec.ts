import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ART274 = path.resolve(process.cwd(), ".artifacts/274");
mkdirSync(ART274, { recursive: true });

/**
 * 设置迁移（reading-surface-refine 5.1 / #218）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC；另加一次性持久化 initScript：
 * 首次 load_config 合并 localStorage.__config__，save_config 写回，模拟重启往返。
 */

const APP_URL = "http://localhost:1420";

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
          const stored = localStorage.getItem("__config__");
          if (stored) return { ...res, ...JSON.parse(stored) };
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
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openPreviewDoc(page: Page): Promise<void> {
  await page.evaluate((body) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => void;
      __biaoyue_store__: {
        getState: () => { setEditorMode: (m: string) => void };
      };
    };
    w.__biaoyue_openFile__(
      "/tmp/settings-reading.md",
      body,
      "settings-reading.md",
    );
    w.__biaoyue_store__.getState().setEditorMode("preview");
  }, "# 标题\n\n正文段落，用于验证行宽与字号设置。");
  await expect(page.locator(".preview-content")).toBeVisible();
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

test("正文右上角不再有阅读设置入口", async ({ page }) => {
  await boot(page);
  await openPreviewDoc(page);

  expect(await page.locator(".reader-settings").count()).toBe(0);
  expect(await page.locator('[aria-label="阅读设置"]').count()).toBe(0);
});

test("设置阅读空间区：行宽/配色/字号可改并持久化生效", async ({ page }) => {
  await boot(page);
  await openPreviewDoc(page);
  await openSettings(page);

  await page.locator('[data-settings-nav="reading"]').click();
  await expect(
    page.locator('button[data-testid^="reader-width-"]'),
  ).toHaveCount(3);
  await expect(page.locator('[data-testid^="reader-tone-"]')).toHaveCount(4);

  await page.locator('[data-testid="reader-width-720"]').click();
  await expect
    .poll(() => storedConfig(page).then((c) => c?.readerWidth))
    .toBe(720);

  await page.locator('[data-testid="reader-tone-indigo"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "indigo");
  await expect
    .poll(() => storedConfig(page).then((c) => c?.readerSkin))
    .toBe("indigo");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  const paraWidth = await page
    .locator(".preview-content > p")
    .first()
    .evaluate((el) => getComputedStyle(el).maxWidth);
  expect(paraWidth).toBe("720px");

  await openSettings(page);
  await page.locator('[data-settings-nav="appearance"]').click();
  await page.locator('[data-testid="font-size-19"]').click();
  await expect
    .poll(() => storedConfig(page).then((c) => c?.readerFontSize))
    .toBe(19);

  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page
        .locator(".preview-content")
        .evaluate((el) => getComputedStyle(el).fontSize),
    )
    .toBe("19px");
});

test("窄窗设置内容可滚动到底且不越界", async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 700 });
  await boot(page);
  await openSettings(page);

  // 展开完整快捷键列表，让内容高于视口
  await page.locator('[data-settings-nav="shortcuts"]').click();
  await page.locator('[data-testid="shortcuts-full-toggle"]').click();
  await expect(page.locator('[data-testid="shortcuts-full"]')).toBeVisible();

  const content = page.locator('[data-testid="settings-scene"] > div').first();
  const before = await content.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

  await content.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const after = await content.evaluate((el) => ({
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  expect(after.scrollTop + after.clientHeight).toBeGreaterThanOrEqual(
    after.scrollHeight - 1,
  );

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("矮窗设置导航独立滚动", async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 300 });
  await boot(page);
  await openSettings(page);

  const nav = page.locator('[data-testid="settings-nav"]');
  const before = await nav.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

  await nav.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const after = await nav.evaluate((el) => ({
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  expect(after.scrollTop + after.clientHeight).toBeGreaterThanOrEqual(
    after.scrollHeight - 1,
  );
});

test("行宽滑块 480–2400 连续可调，并与预设同步（#274）", async ({ page }) => {
  await boot(page);
  await openPreviewDoc(page);
  await openSettings(page);
  await page.locator('[data-settings-nav="reading"]').click();

  const range = page.locator('[data-testid="reader-width-range"]');
  await expect(range).toHaveAttribute("min", "480");
  await expect(range).toHaveAttribute("max", "2400");

  // React 受控 range：走原生 setter 再派发 input，才能触发 onChange
  await range.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, 1400);

  await expect(page.locator('[data-testid="reader-width-value"]')).toHaveText(
    "1400px",
  );
  await page.screenshot({
    path: path.join(ART274, "reader-width-slider-1400.png"),
  });
  await expect
    .poll(() =>
      page
        .locator(".preview-content > p")
        .first()
        .evaluate((el) => getComputedStyle(el).maxWidth),
    )
    .toBe("1400px");

  // 预设与滑块同步
  await page.locator('[data-testid="reader-width-1200"]').click();
  await expect(range).toHaveValue("1200");
  await expect(page.locator('[data-testid="reader-width-value"]')).toHaveText(
    "1200px",
  );
  await page.screenshot({
    path: path.join(ART274, "reader-width-preset-1200.png"),
  });
});
