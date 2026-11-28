import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revealStatusBar } from "./helpers/ui-probe";

/**
 * Q1 交互条款守护（ui-quality-gate-v1 / 票 #1648）。
 *
 * 条款见 docs/design/system/interaction.md：
 *   禁用而非隐藏（三条）+ Esc 只退场（逐层）。
 * 走 e2e/mocks/tauri-mock.js，用 __biaoyue_store__ / __biaoyue_editor_store__
 * 与 __biaoyue_openFile__ 驱动真实 UI；断言落到计算属性与 DOM 状态。
 */

const ART = path.resolve(process.cwd(), ".artifacts/1648");

mkdirSync(ART, { recursive: true });

type Assertion = "passed" | "failed" | "untested";
interface StateRow {
  state: string;
  screenshot: string;
  assertion: Assertion;
  recorded_at: string;
  runner: string;
}

// `.pane-actions` 的 opacity 过渡（150ms）期间菜单近乎透明且层叠上下文压住 z-50 菜单，截图须等过渡结束。
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const running = document
      .getAnimations()
      .filter((a) => a.playState === "running");
    await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
  });
}

async function record(page: Page, state: string): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  await settle(page);
  await page.screenshot({ path: file });
  const manifest = path.join(ART, "state-coverage.json");
  let states: StateRow[] = [];
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
  writeFileSync(manifest, `${JSON.stringify({ task: "1648", states }, null, 2)}\n`);
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

/** 打开一篇已落盘文档（有路径）并切到编辑态。 */
async function openSavedDoc(page: Page, p: string, body: string): Promise<void> {
  await page.evaluate(
    ({ file, content }) => {
      const w = window as unknown as {
        __biaoyue_openFile__: (path: string, content: string, title: string) => void;
        __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
      };
      w.__biaoyue_openFile__(file, content, "doc.md");
      w.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { file: p, content: body },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

/** 新建无路径页签（未保存）。门户首屏的「新建文档」→ 工作区无路径页签。 */
async function newUnsavedTab(page: Page): Promise<void> {
  await page.locator('[data-testid="quick-new"]').click();
  await expect(page.locator(".cm-content")).toBeVisible();
}

function editorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        getState: () => { tabs: Record<string, { content: string }>; activeTabId: string | null };
      };
    };
    const s = w.__biaoyue_store__.getState();
    return s.tabs[s.activeTabId ?? ""]?.content ?? "";
  });
}

test.describe("禁用而非隐藏：页签无路径时导出项保留可见且禁用", () => {
  test("无路径页签的「导出」可见 + disabled + 原因提示", async ({ page }) => {
    await boot(page);
    await newUnsavedTab(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const item = page.locator('[data-menu-item="export"]');
    await expect(item).toHaveCount(1);
    await expect(item).toBeVisible();
    await expect(item).toBeDisabled();
    await expect(item).toHaveAttribute("title", /无路径/);
    await record(page, "01-tab-export-disabled-no-path");
  });

  test("有路径页签的「导出」可见且可用（对照）", async ({ page }) => {
    await boot(page);
    await openSavedDoc(page, "/tmp/ig/saved.md", "# 标题\n\n正文。");
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const item = page.locator('[data-menu-item="export"]');
    await expect(item).toHaveCount(1);
    await expect(item).toBeEnabled();
    await record(page, "02-tab-export-enabled-with-path");
  });
});

test.describe("禁用而非隐藏：格头「定位」无路径时保留可见且禁用", () => {
  test("无路径页签的「定位」可见 + disabled + 原因提示", async ({ page }) => {
    await boot(page);
    await newUnsavedTab(page);
    await page.locator('[data-testid="pane-menu-button"]').first().click();

    const item = page.locator('[data-menu-item="locate"]');
    await expect(item).toHaveCount(1);
    await expect(item).toBeVisible();
    await expect(item).toBeDisabled();
    await expect(item).toHaveAttribute("title", /无路径/);
    await expect(page.locator(".pane-actions").first()).toHaveCSS("opacity", "1");
    await record(page, "03-pane-locate-disabled-no-path");
  });

  test("有路径页签的「定位」可见且可用（对照）", async ({ page }) => {
    await boot(page);
    await openSavedDoc(page, "/tmp/ig/locate.md", "# 标题\n\n正文。");
    await page.locator('[data-testid="pane-menu-button"]').first().click();

    const item = page.locator('[data-menu-item="locate"]');
    await expect(item).toHaveCount(1);
    await expect(item).toBeEnabled();
    await expect(page.locator(".pane-actions").first()).toHaveCSS("opacity", "1");
    await record(page, "04-pane-locate-enabled-with-path");
  });
});

test.describe("禁用而非隐藏：AI 空输入时发送按钮保留可见且禁用", () => {
  test("空输入发送按钮可见 + disabled + 原因提示；输入后转可用", async ({
    page,
  }) => {
    await boot(page);
    await openSavedDoc(page, "/tmp/ig/ai.md", "# 标题\n\n正文。");
    await revealStatusBar(page);
    await page.locator("[data-ai-entry]").click();
    await expect(page.locator("[data-ai-bubble]")).toBeVisible();

    const send = page.locator("[data-ai-send]");
    await expect(send).toHaveCount(1);
    await expect(send).toBeVisible();
    await expect(send).toBeDisabled();
    await expect(send).toHaveAttribute("title", /先输入/);
    await record(page, "05-ai-send-disabled-empty");

    await page.locator("[data-ai-input]").fill("换成深色主题");
    await expect(send).toBeEnabled();
    await record(page, "06-ai-send-enabled-with-input");
  });
});

test.describe("层叠：格头菜单打开即可命中", () => {
  test("菜单不被文档属性卡遮挡（打开瞬间即可点）", async ({ page }) => {
    await boot(page);
    await newUnsavedTab(page);
    await page.locator('[data-testid="pane-menu-button"]').first().click();
    await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(1);
    const hitsMenu = await page.evaluate(() => {
      const menu = document.querySelector('[data-testid="pane-menu"]');
      if (!menu) return false;
      const b = menu.getBoundingClientRect();
      const el = document.elementFromPoint(
        b.x + b.width / 2,
        b.y + b.height / 2,
      );
      return Boolean(el && el.closest('[data-testid="pane-menu"]'));
    });
    expect(hitsMenu).toBe(true);
  });
});

test.describe("Esc 只退场：逐层关闭且文档内容不变", () => {
  test("逐层 Esc 只关最上层，全部关闭后编辑器内容严格相等", async ({
    page,
  }) => {
    await boot(page);
    await openSavedDoc(page, "/tmp/ig/esc.md", "# 标题\n\n正文内容。");

    const before = await editorText(page);
    expect(before).toContain("正文内容");

    // 阅读态（最底层）
    await page.evaluate(() => {
      const w = window as unknown as {
        __biaoyue_store__: { getState: () => { setReadingMode: (v: boolean) => void } };
      };
      w.__biaoyue_store__.getState().setReadingMode(true);
    });
    await expect(page.locator('[data-testid="pane-header"]')).toBeVisible();

    // 全屏（store 驱动，避免阅读态热区遮挡指针）
    await page.evaluate(() => {
      const w = window as unknown as {
        __biaoyue_store__: { getState: () => { toggleFullscreenPane: () => void } };
      };
      w.__biaoyue_store__.getState().toggleFullscreenPane();
    });
    await expect(page.locator("[data-pane-id][data-fullscreen='true']")).toHaveCount(1);

    // hardcore 临时显现
    await page.evaluate(() => {
      const w = window as unknown as {
        __biaoyue_editor_store__: {
          getState: () => { setConfig: (c: Record<string, unknown>) => void };
        };
      };
      w.__biaoyue_editor_store__.getState().setConfig({ paneMode: "hardcore" });
    });
    await page.keyboard.press("Meta+Shift+U");
    await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();

    // AI 小窗 + 待确认卡
    await revealStatusBar(page);
    await page.locator("[data-ai-entry]").click();
    await expect(page.locator("[data-ai-bubble]")).toBeVisible();
    await page.locator("[data-ai-input]").fill("换成深色主题");
    await page.locator("[data-ai-send]").click();
    await expect(page.locator("[data-ai-confirm-card]")).toBeVisible();

    // 快捷键总览（最上层）
    await page.keyboard.press("Shift+/");
    await expect(page.locator('[data-testid="shortcut-overlay"]')).toBeVisible();

    // 逐层关闭：总览 → 待确认 → AI 小窗 → 临时显现 → 全屏 → 阅读态
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="shortcut-overlay"]')).toHaveCount(0);
    await expect(page.locator("[data-ai-confirm-card]")).toBeVisible();
    await expect(page.locator("[data-ai-bubble]")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-ai-confirm-card]")).toHaveCount(0);
    await expect(page.locator("[data-ai-bubble]")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-ai-bubble]")).toHaveCount(0);
    await expect(page.locator("[data-pane-id][data-fullscreen='true']")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-pane-id][data-fullscreen='true']")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.locator(".cm-content")).toBeVisible();

    // 无残留浮层
    await expect(page.locator("[data-ai-overlay]")).toHaveCount(0);
    await expect(page.locator("[data-ai-bubble]")).toHaveCount(0);
    await expect(page.locator('[data-testid="shortcut-overlay"]')).toHaveCount(0);

    // 文档内容严格相等（无保存 / 删除副作用）
    const after = await editorText(page);
    expect(after).toBe(before);
    await record(page, "07-esc-layered-content-unchanged");
  });
});
