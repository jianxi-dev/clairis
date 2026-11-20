import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ART274 = path.resolve(process.cwd(), ".artifacts/274");
mkdirSync(ART274, { recursive: true });

const ART913 = path.resolve(process.cwd(), ".artifacts/913");
const EVIDENCE913 = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
mkdirSync(ART913, { recursive: true });

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
  ).toHaveCount(4);
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
    .locator(".preview-prose > p")
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

test("行宽滑块 480–1400 连续可调，并与预设同步（#274 / #573）", async ({
  page,
}) => {
  await boot(page);
  await openPreviewDoc(page);
  await openSettings(page);
  await page.locator('[data-settings-nav="reading"]').click();

  const range = page.locator('[data-testid="reader-width-range"]');
  await expect(range).toHaveAttribute("min", "480");
  await expect(range).toHaveAttribute("max", "1400");

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
        .locator(".preview-prose > p")
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

async function openEditDoc913(page: Page): Promise<void> {
  await page.evaluate((body) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (p: string, c: string, t: string) => void;
      __biaoyue_store__: {
        getState: () => { setEditorMode: (m: string) => void };
      };
    };
    w.__biaoyue_openFile__("/tmp/skin-parity.md", body, "skin-parity.md");
    w.__biaoyue_store__.getState().setEditorMode("edit");
  }, "# 一级标题\n\n正文段落，用于确认正文色不随配色变化。");
  await expect(page.locator(".cm-heading.cm-h1")).toBeVisible();
}

async function setMode913(page: Page, mode: "edit" | "preview"): Promise<void> {
  await page.evaluate((m) => {
    const w = window as unknown as {
      __biaoyue_store__: {
        getState: () => { setEditorMode: (x: string) => void };
      };
    };
    w.__biaoyue_store__.getState().setEditorMode(m);
  }, mode);
}

async function chooseTone913(page: Page, tone: string): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="reading"]').click();
  await page.locator(`[data-testid="reader-tone-${tone}"]`).click();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
}

async function editH1Color(page: Page): Promise<string> {
  return page
    .locator(".cm-heading.cm-h1")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
}

async function editBodyColor(page: Page): Promise<string> {
  return page
    .locator(".cm-content .cm-line:not(:has(.cm-heading))")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
}

async function previewH1Color(page: Page): Promise<string> {
  return page
    .locator(".preview-content h1")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
}

async function previewBodyColor(page: Page): Promise<string> {
  return page
    .locator(".preview-prose > p")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
}

function shot913(page: Page, name: string): Promise<string> {
  return page.screenshot({ path: path.join(ART913, `${name}.png`) });
}

function record913(state: string, screenshot: string, assertion: string): void {
  execFileSync(
    EVIDENCE913,
    [
      "record-state",
      ART913,
      "--state",
      state,
      "--screenshot",
      screenshot,
      "--assertion",
      assertion,
    ],
    { stdio: "ignore" },
  );
}

test("配色同时驱动编辑态与预览态标题色，正文不串色（#913）", async ({
  page,
}) => {
  await boot(page);
  await openEditDoc913(page);

  const paperEditH1 = await editH1Color(page);
  const paperEditBody = await editBodyColor(page);
  await shot913(page, "paper-edit");
  await setMode913(page, "preview");
  const paperPreviewH1 = await previewH1Color(page);
  const paperPreviewBody = await previewBodyColor(page);
  await shot913(page, "paper-preview");

  await setMode913(page, "edit");
  await chooseTone913(page, "indigo");
  const indigoEditH1 = await editH1Color(page);
  const indigoEditBody = await editBodyColor(page);
  await shot913(page, "indigo-edit");
  await setMode913(page, "preview");
  const indigoPreviewH1 = await previewH1Color(page);
  const indigoPreviewBody = await previewBodyColor(page);
  await shot913(page, "indigo-preview");

  await setMode913(page, "edit");
  await chooseTone913(page, "moss");
  const mossEditH1 = await editH1Color(page);
  const mossEditBody = await editBodyColor(page);
  await shot913(page, "moss-edit");
  await setMode913(page, "preview");
  const mossPreviewH1 = await previewH1Color(page);
  const mossPreviewBody = await previewBodyColor(page);
  await shot913(page, "moss-preview");

  await setMode913(page, "edit");
  await chooseTone913(page, "paper");
  const backEditH1 = await editH1Color(page);
  await shot913(page, "paper-back-edit");
  await setMode913(page, "preview");
  const backPreviewH1 = await previewH1Color(page);

  const parityOk =
    indigoEditH1 === indigoPreviewH1 &&
    mossEditH1 === mossPreviewH1 &&
    paperEditH1 === paperPreviewH1 &&
    backEditH1 === backPreviewH1;
  const verdict = parityOk ? "passed" : "failed";
  console.log(
    "913-measure " +
      JSON.stringify({
        paperEditH1,
        paperPreviewH1,
        paperEditBody,
        paperPreviewBody,
        indigoEditH1,
        indigoPreviewH1,
        indigoEditBody,
        indigoPreviewBody,
        mossEditH1,
        mossPreviewH1,
        mossEditBody,
        mossPreviewBody,
        backEditH1,
        backPreviewH1,
      }),
  );

  record913("paper-edit", ".artifacts/913/paper-edit.png", verdict);
  record913("indigo-edit", ".artifacts/913/indigo-edit.png", verdict);
  record913("indigo-preview", ".artifacts/913/indigo-preview.png", verdict);
  record913("moss-edit", ".artifacts/913/moss-edit.png", verdict);
  record913("moss-preview", ".artifacts/913/moss-preview.png", verdict);
  record913("paper-back-edit", ".artifacts/913/paper-back-edit.png", verdict);

  expect(indigoEditH1).toBe(indigoPreviewH1);
  expect(mossEditH1).toBe(mossPreviewH1);
  expect(paperEditH1).toBe(paperPreviewH1);
  expect(paperEditH1).toBe("rgb(215, 58, 73)");
  expect(backEditH1).toBe(paperEditH1);
  expect(backPreviewH1).toBe(paperPreviewH1);
  expect(indigoEditH1).not.toBe(mossEditH1);
  expect(indigoPreviewH1).not.toBe(mossPreviewH1);
  expect(indigoEditBody).toBe(paperEditBody);
  expect(mossEditBody).toBe(paperEditBody);
  expect(indigoPreviewBody).toBe(paperPreviewBody);
  expect(mossPreviewBody).toBe(paperPreviewBody);
  expect(indigoPreviewBody).not.toBe(indigoPreviewH1);

  // 维护者裁定（#913 方案 A，2026-11-16）：暖色主题复用亮色色板——
  // 切暖色不改变标题色；纸墨维持配置标题色。此处钉死，防止将来误加暖色变体。
  await setMode913(page, "edit");
  await chooseTone913(page, "indigo");
  await page.evaluate(() => {
    const root = document.documentElement;
    root.classList.add("warm");
    root.classList.remove("dark");
  });
  const warmEditH1 = await editH1Color(page);
  expect(warmEditH1, "暖色 + 靛蓝应沿用亮色色板").toBe(indigoEditH1);
  await shot913(page, "warm-indigo-edit");
  record913(
    "warm-indigo-edit",
    ".artifacts/913/warm-indigo-edit.png",
    "passed",
  );
});
