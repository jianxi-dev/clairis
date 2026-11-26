import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 标题字体默认占位语义与值来源区分（#1177 / settings-font-picker 1.1）。
 *
 * 走 e2e/mocks/tauri-mock.js：list_system_fonts 返回固定已安装列表；
 * 持久化经 localStorage.__config__ 往返，模拟重启。
 *
 * 验收：未配置级别显示「默认」占位；清空提交 = 取消该级显式配置并回落
 * --type-font-sans；显式设置显示字体名并持久化。
 */

const ART = path.resolve(process.cwd(), ".artifacts/1177");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

function norm(value: string): string {
  return value
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/^["']+|["']+$/g, "")
        .toLowerCase(),
    )
    .filter((part) => part.length > 0)
    .join(",");
}

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

async function openDoc(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/hf1177.md", "## 二级标题\n", "hf1177.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-heading.cm-h2").first().waitFor({ timeout: 10000 });
}

async function h2Family(page: Page): Promise<string> {
  return page
    .locator(".cm-heading.cm-h2")
    .first()
    .evaluate((el) => getComputedStyle(el as Element).fontFamily);
}

async function sansFamily(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.createElement("div");
    el.style.fontFamily = getComputedStyle(
      document.querySelector(".cm-editor") as Element,
    ).getPropertyValue("--type-font-sans");
    document.body.appendChild(el);
    const value = getComputedStyle(el).fontFamily;
    el.remove();
    return value;
  });
}

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

test("未配置级别显示「默认」占位而非整串字体栈", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
    const input = page.locator(`[data-testid="heading-font-${level}"]`);
    await expect(input).toHaveValue("");
    await expect(input).toHaveAttribute("placeholder", "默认");
  }
  await shot(page, "unconfigured-placeholder", "unconfigured-placeholder");
});

test("显式设置后显示字体名并持久化，重启仍在", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await openAppearance(page);

  const h2 = page.locator('[data-testid="heading-font-h2"]');
  await h2.fill("Menlo");
  await h2.press("Enter");

  await expect(h2).toHaveValue("Menlo");
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h2)
    .toBe("Menlo");
  await shot(page, "explicit-set", "explicit-set");

  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]');
  await openSettings(page);
  await openAppearance(page);
  await expect(h2).toHaveValue("Menlo");
  await shot(page, "persisted-after-reload", "persisted-after-reload");
});

test("清空提交后该级配置消失、显示「默认」、渲染回落 --type-font-sans", async ({
  page,
}) => {
  await boot(page);
  await openDoc(page);

  await openSettings(page);
  await openAppearance(page);
  const h2 = page.locator('[data-testid="heading-font-h2"]');
  await h2.fill("Menlo");
  await h2.press("Enter");
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h2)
    .toBe("Menlo");

  await page.keyboard.press("Escape");
  await expect.poll(async () => norm(await h2Family(page))).toBe(norm("Menlo"));

  await openSettings(page);
  await openAppearance(page);
  await h2.fill("");
  await h2.press("Enter");

  await expect(h2).toHaveValue("");
  await expect(h2).toHaveAttribute("placeholder", "默认");
  await expect
    .poll(async () => (await persistedHeadingFonts(page)).h2)
    .toBeUndefined();

  await page.keyboard.press("Escape");
  await expect
    .poll(async () => norm(await h2Family(page)))
    .toBe(norm(await sansFamily(page)));
  await shot(page, "cleared-fallback", "cleared-fallback");
});
