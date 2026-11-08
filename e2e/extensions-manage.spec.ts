import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 设置·扩展管理（layout-portal 14.1 / #184）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 的内存扩展包列表；每个 state 截图落 `.artifacts/184/`，
 * 收尾写 state-coverage.json（≥4 states）。无固定 sleep：等待 locator 出现/消失。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/184");

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
    task: "184-extensions",
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
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
}

async function openExtensions(page: Page): Promise<void> {
  await page.locator('[data-settings-nav="extensions"]').click();
  await expect(page.locator('[data-testid="extension-row"]')).toHaveCount(2);
}

interface MockExtensionPackage {
  id: string;
  name: string;
  enabled: boolean;
  source: string;
}

function mockExtension(
  page: Page,
  id: string,
): Promise<MockExtensionPackage | undefined> {
  return page.evaluate((target) => {
    const list = (
      window as unknown as {
        __biaoyue_extension_packages__: MockExtensionPackage[];
      }
    ).__biaoyue_extension_packages__;
    return list.find((p) => p.id === target);
  }, id);
}

function mockEnabled(page: Page, id: string): Promise<boolean | undefined> {
  return mockExtension(page, id).then((p) => p?.enabled);
}

test("扩展管理：内置列表、导入、开关、卸载、导出、预览", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await boot(page);
  await openSettings(page);
  await openExtensions(page);

  const rows = page.locator('[data-testid="extension-row"]');
  await expect(rows).toHaveCount(2);
  const badges = page.locator('[data-testid="extension-source"]');
  await expect(badges).toHaveCount(2);
  for (const badge of await badges.all()) {
    await expect(badge).toContainText("内置");
  }
  await expect(
    page.locator('[data-testid="extension-toggle"]').first(),
  ).toBeDisabled();
  await expect(
    page.locator('[data-testid="extension-remove"]').first(),
  ).toBeDisabled();
  await record(page, "01-builtins");

  await page.locator('[data-testid="extensions-import-folder"]').click();
  await expect(rows).toHaveCount(3);
  const userRow = page.locator(
    '[data-testid="extension-row"][data-extension-id="demo"]',
  );
  await expect(userRow).toBeVisible();
  await expect(
    userRow.locator('[data-testid="extension-source"]'),
  ).toContainText("用户导入");
  await expect(
    userRow.locator('[data-testid="extension-toggle"]'),
  ).toBeChecked();
  await record(page, "02-imported");

  await userRow.locator('[data-testid="extension-toggle"]').click();
  await expect.poll(() => mockEnabled(page, "demo")).toBe(false);
  await expect(
    userRow.locator('[data-testid="extension-toggle"]'),
  ).not.toBeChecked();
  await userRow.locator('[data-testid="extension-toggle"]').click();
  await expect.poll(() => mockEnabled(page, "demo")).toBe(true);
  await expect(
    userRow.locator('[data-testid="extension-toggle"]'),
  ).toBeChecked();
  await record(page, "03-toggled");

  await userRow.locator('[data-testid="extension-export"]').click();
  await expect(page.locator('[data-testid="extension-notice"]')).toContainText(
    "/tmp/extensions-export/",
  );
  await record(page, "04-exported");

  await userRow.locator('[data-testid="extension-preview"]').click();
  await expect(
    userRow.locator('[data-testid="extension-skill"]'),
  ).toContainText("用户导入的扩展");
  await record(page, "05-preview");

  await userRow.locator('[data-testid="extension-remove"]').click();
  await expect(rows).toHaveCount(2);
  await expect(
    page.locator('[data-testid="extension-row"][data-extension-id="demo"]'),
  ).toHaveCount(0);
  await record(page, "06-removed");

  await page.locator('[data-testid="extensions-import-folder"]').click();
  await expect(rows).toHaveCount(3);
  await expect(
    page.locator('[data-testid="extension-row"][data-extension-id="demo"]'),
  ).toBeVisible();
  await record(page, "07-reimported");
});

test("扩展 AI 生成：生成中→新卡默认启用；取消不产卡", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await boot(page);
  await openSettings(page);
  await openExtensions(page);

  const rows = page.locator('[data-testid="extension-row"]');
  const prompt = "生成一个把 Markdown 转成周报的扩展";
  await page.locator('[data-testid="ai-extension-prompt"]').fill(prompt);
  await page.locator('[data-testid="ai-extension-generate"]').click();
  await expect(
    page.locator('[data-testid="ai-extension-generating"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="ai-extension-cancel"]'),
  ).toBeVisible();
  await record(page, "08-generating");

  await expect(
    page.locator('[data-testid="ai-extension-generating"]'),
  ).toHaveCount(0);
  await expect(rows).toHaveCount(3);
  const aiRow = page.locator('[data-testid="extension-row"]', {
    has: page.locator('[data-testid="extension-source"]', {
      hasText: "AI 生成",
    }),
  });
  await expect(aiRow).toHaveCount(1);
  await expect(aiRow.locator('[data-testid="extension-toggle"]')).toBeChecked();
  await record(page, "09-ai-row");

  await aiRow.locator('[data-testid="extension-preview"]').click();
  await expect(aiRow.locator('[data-testid="extension-skill"]')).toContainText(
    prompt,
  );
  await record(page, "10-ai-preview");

  await page
    .locator('[data-testid="ai-extension-prompt"]')
    .fill("取消这个生成");
  await page.locator('[data-testid="ai-extension-generate"]').click();
  await expect(
    page.locator('[data-testid="ai-extension-generating"]'),
  ).toBeVisible();
  await page.locator('[data-testid="ai-extension-cancel"]').click();
  await expect(
    page.locator('[data-testid="ai-extension-generating"]'),
  ).toHaveCount(0);
  await expect(rows).toHaveCount(3);
  // 取消后后端也不得残留半生成包
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_extension_packages__: Array<{ id: string }>;
            }
          ).__biaoyue_extension_packages__.filter(
            (p) => !p.id.startsWith("builtin-"),
          ).length,
      ),
    )
    .toBe(1);
  await record(page, "11-cancelled");
});
