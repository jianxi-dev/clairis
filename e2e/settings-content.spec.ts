import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 设置内容区补全（layout-portal 13.1 / #183）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC；另加一次性持久化 initScript：
 * 首次 load_config 合并 localStorage.__config__，save_config 写回，模拟重启往返。
 * 每个 state 截图落 `.artifacts/183/`，收尾写 state-coverage.json（≥4 states）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/183");

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
    task: "183-settings-content",
    states: [...byState.values()],
  };
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
});

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

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
}

interface DefaultsState {
  railLayout: string;
  railDensity: string;
  gridGroup: string;
  gridSort: string;
  mode: string;
}

function defaultsOf(page: Page): Promise<DefaultsState> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            railLayout: string;
            railDensity: string;
            gridGroup: string;
            gridSort: string;
            viewSpec: { gridMode: string };
          };
        };
      }
    ).__biaoyue_store__.getState();
    return {
      railLayout: s.railLayout,
      railDensity: s.railDensity,
      gridGroup: s.gridGroup,
      gridSort: s.gridSort,
      mode: s.viewSpec.gridMode,
    };
  });
}

test("阅读空间/网格概览默认值保存后重启严格相等", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await boot(page);
  await openSettings(page);

  await page.locator('[data-settings-nav="reading"]').click();
  await page.locator('[data-testid="rail-default-layout-tabs"]').click();
  await page
    .locator('[data-testid="rail-default-density-comfortable"]')
    .click();
  await expect(
    page.locator('[data-testid="rail-default-card-height"]'),
  ).toBeDisabled();

  await page.locator('[data-settings-nav="grid"]').click();
  await page.locator('[data-testid="grid-default-group-type"]').click();
  await page.locator('[data-testid="grid-default-sort-name"]').click();
  await page.locator('[data-testid="grid-default-mode-list"]').click();

  await expect
    .poll(() => defaultsOf(page))
    .toEqual({
      railLayout: "tabs",
      railDensity: "comfortable",
      gridGroup: "type",
      gridSort: "name",
      mode: "list",
    });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("__config__");
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      }),
    )
    .toMatchObject({
      railViewSpec: { layout: "tabs", density: "comfortable" },
      aiViewSpec: { gridGrouping: "type", gridSort: "name", gridMode: "list" },
    });
  await record(page, "01-defaults-set");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });

  await expect
    .poll(() => defaultsOf(page))
    .toEqual({
      railLayout: "tabs",
      railDensity: "comfortable",
      gridGroup: "type",
      gridSort: "name",
      mode: "list",
    });
  await record(page, "02-defaults-reloaded");
});

test("AI 服务区：8 提供方 + 2 规划中；key 只进钥匙串", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await page.locator('[data-settings-nav="ai"]').click();

  await expect(page.locator('[data-testid="ai-provider"]')).toHaveCount(8);
  await expect(page.locator('[data-testid="ai-planned"]')).toHaveCount(2);
  await expect(
    page.locator('[data-testid="ai-planned"]').first(),
  ).toContainText("本地 LLM（Ollama）");
  await expect(page.locator('[data-testid="ai-planned"]').nth(1)).toContainText(
    "多 agent 协同",
  );
  for (const row of await page.locator('[data-testid="ai-planned"]').all()) {
    await expect(row).toContainText("规划中");
  }
  await record(page, "03-ai-providers");

  await page
    .locator('[data-testid="ai-provider"][data-provider="deepseek"]')
    .click();
  await expect(page.locator('[data-testid="ai-endpoint-input"]')).toHaveValue(
    "https://api.deepseek.com",
  );
  await expect(page.locator('[data-testid="ai-model-input"]')).toHaveValue(
    "deepseek-chat",
  );

  const sentinel = "sk-settings-secret-183";
  await page.locator('[data-testid="ai-key-input"]').fill(sentinel);
  await page.locator('[data-testid="ai-key-save"]').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as Record<string, string>).__biaoyue_keyring__[
            "biaoyue:openai"
          ],
      ),
    )
    .toBe(sentinel);
  await expect(page.locator('[data-testid="ai-key-input"]')).toHaveValue("");
  await expect(page.locator('[data-testid="ai-key-status"]')).toContainText(
    "已配置",
  );
  await record(page, "04-ai-key-saved");

  // 重复点击当前分区不得把状态打回「读取中」
  await page.locator('[data-settings-nav="ai"]').click();
  await expect(page.locator('[data-testid="ai-key-status"]')).toContainText(
    "已配置",
  );

  const leakAfterSave = await page.evaluate((key) => {
    const raw = localStorage.getItem("__config__") ?? "";
    const cfg = (
      window as unknown as {
        __biaoyue_ai_config__: () => Record<string, unknown> | null;
      }
    ).__biaoyue_ai_config__();
    return { raw, cfg: JSON.stringify(cfg) };
  }, sentinel);
  expect(leakAfterSave.raw).not.toContain(sentinel);
  expect(leakAfterSave.cfg).not.toContain(sentinel);

  await page.locator('[data-settings-nav="appearance"]').click();
  await page.locator('[data-testid="theme-option-light"]').click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("__config__")))
    .toContain("light");

  const leakAfterSaveConfig = await page.evaluate((key) => {
    const raw = localStorage.getItem("__config__") ?? "";
    const cfg = (
      window as unknown as {
        __biaoyue_ai_config__: () => Record<string, unknown> | null;
      }
    ).__biaoyue_ai_config__();
    return { raw, cfg: JSON.stringify(cfg) };
  }, sentinel);
  expect(leakAfterSaveConfig.raw).not.toContain(sentinel);
  expect(leakAfterSaveConfig.cfg).not.toContain(sentinel);
  await record(page, "05-ai-key-not-leaked");
});

test("数据与备份：快照列表、取消无变更、确认恢复", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_ai_theme__: (theme: string) => void;
      }
    ).__biaoyue_ai_theme__("dark");
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_ai_config__: () => { theme?: string } | null;
            }
          ).__biaoyue_ai_config__()?.theme,
      ),
    )
    .toBe("dark");

  await openSettings(page);
  await page.locator('[data-settings-nav="data"]').click();
  expect(
    await page.locator('[data-testid="snapshot-item"]').count(),
  ).toBeGreaterThanOrEqual(2);
  await record(page, "06-snapshots-listed");

  // 重复点击当前分区不得把列表打回「读取中」
  await page.locator('[data-settings-nav="data"]').click();
  expect(
    await page.locator('[data-testid="snapshot-item"]').count(),
  ).toBeGreaterThan(0);

  await page
    .locator('[data-testid="snapshot-item"]')
    .first()
    .locator('[data-testid="snapshot-restore"]')
    .click();
  await expect(page.locator('[data-testid="snapshot-confirm"]')).toBeVisible();
  await page.locator('[data-testid="snapshot-cancel"]').click();
  await expect(page.locator('[data-testid="snapshot-confirm"]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_ai_config__: () => { theme?: string } | null;
            }
          ).__biaoyue_ai_config__()?.theme,
      ),
    )
    .toBe("dark");
  await record(page, "07-restore-cancelled");

  await page
    .locator('[data-testid="snapshot-item"]')
    .first()
    .locator('[data-testid="snapshot-restore"]')
    .click();
  await page.locator('[data-testid="snapshot-confirm-ok"]').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_ai_config__: () => { theme?: string } | null;
            }
          ).__biaoyue_ai_config__()?.theme,
      ),
    )
    .toBe("system");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark")),
    )
    .toBe(false);
  expect(
    await page.locator('[data-testid="snapshot-item"]').count(),
  ).toBeGreaterThan(0);
  await record(page, "08-restore-confirmed");
});

test("关于：版本号来自 package.json", async ({ page }) => {
  await boot(page);
  await openSettings(page);
  await page.locator('[data-settings-nav="about"]').click();
  await expect(page.locator('[data-testid="about-version"]')).toContainText(
    "0.4.0",
  );
  await record(page, "09-about");
});
