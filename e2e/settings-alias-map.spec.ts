import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 设置「别称映射」应用配置（#1024 / A-5.1～A-5.3）。
 *
 * 走 e2e/mocks/tauri-mock.js：save_config 持久化到 localStorage.__mock_config，
 * 面板读 editorStore.config.propAliasMap。真实设置页交互 + 真实文件打开路径。
 */

const APP_URL = "http://localhost:1424";

async function dpbRecord(
  page: Page,
  dir: string,
  state: string,
): Promise<void> {
  const ART = path.resolve(process.cwd(), `.artifacts/${dir}`);
  mkdirSync(ART, { recursive: true });
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: dir, states }, null, 2)}\n`,
  );
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
}

async function openDoc(
  page: Page,
  content: string,
  docPath: string,
): Promise<void> {
  await page.evaluate(
    (args) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
        }
      ).__biaoyue_openFile__(args.path, args.content, "alias.md");
    },
    { path: docPath, content },
  );
}

async function setVariant(page: Page, variant: "A" | "B"): Promise<void> {
  await page.evaluate((v) => {
    (
      window as unknown as {
        __biaoyue_doc_property__: {
          getState: () => { setVariant: (v: "A" | "B") => void };
        };
      }
    ).__biaoyue_doc_property__
      .getState()
      .setVariant(v);
  }, variant);
}

async function storedAliasMap(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("__mock_config");
    if (!raw) return null;
    return (JSON.parse(raw) as { propAliasMap?: unknown }).propAliasMap ?? null;
  });
}

const DATE_DOC = `---
title: 外部文件
customdate: 2026-11-17
createdate: 2026-11-14
---

# 正文
`;

const TEXT_DOC = `---
title: 外部文件
customdate: 高
createdate: 2026-11-14
---

# 正文
`;

test("别称映射：新增即时识别，恢复默认回落内置（#1024）", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await boot(page);
  await openSettings(page);

  // 内置默认只读列表可见（含 createdate）。
  const builtinRows = page.locator('[data-testid="alias-builtin-row"]');
  await expect(builtinRows.first()).toBeVisible();
  await expect(builtinRows.filter({ hasText: "createdate" })).toHaveCount(1);

  // 新增自定义映射 customdate → 日期。
  await page.locator('[data-testid="alias-add"]').click();
  await page.locator('[data-testid="alias-key-0"]').fill("customdate");
  await page.locator('[data-testid="alias-type-0"]').selectOption("date");
  await dpbRecord(page, "1024", "01-alias-added");

  await expect
    .poll(() => storedAliasMap(page))
    .toEqual({
      customdate: "date",
    });

  // 打开外部文件：customdate 自动识别为日期（日历图标），显示名保持原样；
  // 内置 createdate 仍识别为日期。
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
  await setVariant(page, "B");
  await openDoc(page, DATE_DOC, "/Users/test/alias.md");
  const dateRow = page.locator('[data-key="customdate"]');
  await expect(dateRow.locator(".dpb-b-type .dpb-ico-svg")).toHaveCount(1);
  await expect(dateRow.locator('[data-testid="dpb-label"]')).toHaveText(
    "customdate",
  );
  const builtinRow = page.locator('[data-key="createdate"]');
  await expect(builtinRow.locator(".dpb-b-type .dpb-ico-svg")).toHaveCount(1);
  await dpbRecord(page, "1024", "02-alias-applied");

  // 恢复默认：自定义映射清空。
  await openSettings(page);
  await page.locator('[data-testid="alias-reset"]').click();
  await dpbRecord(page, "1024", "03-alias-reset");
  await expect.poll(() => storedAliasMap(page)).toEqual({});

  // 重开非内置键 + 非日期字面量：自定义映射已失效 → "?"；内置 createdate 仍识别。
  await page.keyboard.press("Escape");
  await openDoc(page, TEXT_DOC, "/Users/test/alias2.md");
  const textRow = page.locator('[data-key="customdate"]');
  await expect(textRow.locator(".dpb-b-type .dpb-ico")).toHaveText("?");
  await expect(textRow.locator('[data-testid="dpb-label"]')).toHaveText(
    "customdate",
  );
  const builtinRow2 = page.locator('[data-key="createdate"]');
  await expect(builtinRow2.locator(".dpb-b-type .dpb-ico-svg")).toHaveCount(1);
  await dpbRecord(page, "1024", "04-alias-builtin-fallback");
});
