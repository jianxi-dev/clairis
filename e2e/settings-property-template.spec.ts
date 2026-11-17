import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 设置「属性模板」字段列表 UI 与内置模板可编辑（#1023 / A-4.1～A-4.3）。
 *
 * 走 e2e/mocks/tauri-mock.js：save_config 持久化到 localStorage.__mock_config，
 * 模板菜单读 editorStore.config.propTemplates。真实设置页交互，不直写 store。
 */

const APP_URL = "http://localhost:1420";

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

async function newDoc(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: { getState: () => { newTab: () => void } };
      }
    ).__biaoyue_store__
      .getState()
      .newTab();
  });
}

async function applyTemplate(page: Page, name: string): Promise<void> {
  await page.locator('[data-testid="dpb-template"]').click();
  await page.locator(`[data-name="${name}"]`).click();
}

test("内置模板字段类型可编辑并恢复默认（#1023）", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await boot(page);
  await openSettings(page);

  // 编辑内置「会议记录」的「参会人」字段：文本 → 日期，并给日期预设值。
  // 选「参会人」而非「通用」的字段，因为后者键名命中别称表（category→select、
  // author→text、status→select），套用行为不变时类型由别称决定，无法体现模板类型。
  await page.locator('[data-testid="tpl-edit-会议记录"]').click();
  await expect(page.locator('[data-testid="tpl-editing"]')).toContainText(
    "会议记录",
  );
  await page.locator('[data-testid="tpl-field-type-1"]').selectOption("date");
  await page.locator('[data-testid="tpl-field-value-1"]').fill("2026-11-17");
  await page.locator('[data-testid="tpl-save"]').click();
  await expect(
    page.locator('[data-testid="tpl-restore-会议记录"]'),
  ).toBeVisible();
  await dpbRecord(page, "1023", "01-template-edited");

  // 覆盖层已落库：持久化配置含同名「会议记录」条目，字段类型为 date。
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("__mock_config");
        if (!raw) return null;
        const cfg = JSON.parse(raw) as {
          propTemplates?: Array<{
            name: string;
            fields: Array<{ key: string; type: string }>;
          }>;
        };
        return (
          cfg.propTemplates
            ?.find((t) => t.name === "会议记录")
            ?.fields.find((f) => f.key === "参会人")?.type ?? null
        );
      }),
    )
    .toBe("date");

  // 新文档套用「会议记录」→「参会人」显示日期类型（日历图标）。
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
  await newDoc(page);
  await applyTemplate(page, "会议记录");
  const dateRow = page.locator('[data-key="参会人"]');
  await expect(
    dateRow.locator('[data-testid="dpb-type"] .dpb-ico-svg'),
  ).toHaveCount(1);
  await dpbRecord(page, "1023", "02-template-applied-date");

  // 恢复默认：移除覆盖层，按钮消失。
  await openSettings(page);
  await page.locator('[data-testid="tpl-restore-会议记录"]').click();
  await expect(
    page.locator('[data-testid="tpl-restore-会议记录"]'),
  ).toHaveCount(0);
  await dpbRecord(page, "1023", "03-template-restored");

  // 再次套用 → 回落内置定义（非日期）。
  await page.keyboard.press("Escape");
  await newDoc(page);
  await applyTemplate(page, "会议记录");
  await expect(
    dateRow.locator('[data-testid="dpb-type"] .dpb-ico-svg'),
  ).toHaveCount(0);
  await expect(dateRow.locator('[data-testid="dpb-type"] .dpb-ico')).toHaveText(
    "?",
  );
  await dpbRecord(page, "1023", "04-template-applied-builtin");
});
