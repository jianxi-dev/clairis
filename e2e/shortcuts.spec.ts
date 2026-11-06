import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SHORTCUTS } from "../src/lib/shortcuts";

/**
 * 快捷键家族与总览（layout-portal 15.1 / #185）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js，用 `window.__biaoyue_store__` 驱动状态。
 * 每个 state 截图落 `.artifacts/185/`，收尾写 state-coverage.json。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/185");

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
    task: "185-shortcuts",
    states: [...byState.values()],
  };
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
});

interface StoreSnapshot {
  scene: string;
  readingMode: boolean;
  railState: string;
  railChip: string;
  railSection: string;
  gridTypeFilter: string | null;
  previewSettings: { enabled: boolean };
  activeTabId: string | null;
  tabs: Record<string, { path: string | null; editorMode: string }>;
}

function storeState(page: Page): Promise<StoreSnapshot> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => StoreSnapshot;
        };
      }
    ).__biaoyue_store__.getState();
    return {
      scene: s.scene,
      readingMode: s.readingMode,
      railState: s.railState,
      railChip: s.railChip,
      railSection: s.railSection,
      gridTypeFilter: s.gridTypeFilter,
      previewSettings: s.previewSettings,
      activeTabId: s.activeTabId,
      tabs: s.tabs,
    };
  });
}

function editorMode(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            activeTabId: string | null;
            tabs: Record<string, { editorMode: string }>;
          };
        };
      }
    ).__biaoyue_store__.getState();
    const tab = s.activeTabId ? s.tabs[s.activeTabId] : null;
    return tab?.editorMode ?? null;
  });
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

test("? 打开总览：全表与注册表严格相等，Esc 关闭无残留", async ({ page }) => {
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

  await page.keyboard.press("Shift+/");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toBeVisible();

  const rows = page.locator('[data-testid="shortcut-row"]');
  await expect(rows).toHaveCount(SHORTCUTS.length);
  const ids = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-shortcut-id")),
  );
  expect(new Set(ids)).toEqual(new Set(SHORTCUTS.map((s) => s.id)));

  const decisionCount = SHORTCUTS.filter((s) => s.decision).length;
  await expect(page.locator('[data-testid="shortcut-decision"]')).toHaveCount(
    decisionCount,
  );
  await record(page, "01-overlay-open");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toHaveCount(0);
  await record(page, "02-overlay-closed");
});

test("输入态不触发总览", async ({ page }) => {
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
  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await page.locator("[data-grid-search]").focus();
  await page.keyboard.press("Shift+/");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toHaveCount(0);

  // 输入态按 ⌥4 不得改动网格类型过滤（只作为字符输入）
  await page.keyboard.press("Alt+4");
  await expect(page.locator('[data-testid="grid"]')).toHaveAttribute(
    "data-grid-filter",
    "all",
  );
  await record(page, "19-typing-guard");
});

test("设置开着时 Esc 先关总览，不关下面的设置", async ({ page }) => {
  await boot(page);
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();

  await page.keyboard.press("Shift+/");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
  await record(page, "20-esc-layering");
});

test("全局 9 条逐一触发均生效（严格 9 项）", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          setState: (patch: Record<string, unknown>) => void;
        };
      }
    ).__biaoyue_store__.setState({
      scene: "workspace",
      readingMode: false,
      immersiveChromeVisible: false,
      railState: "collapsed",
      recentFiles: [
        {
          path: "/lib/a.md",
          title: "甲.md",
          openedAt: new Date().toISOString(),
          excerpt: "# 甲",
        },
      ],
    });
  });

  let observed = 0;

  await page.keyboard.press("Meta+p");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await expect(page.locator("[data-grid-search]")).toBeFocused();
  observed += 1;
  await record(page, "03-cmd-p-search");
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

  await page.keyboard.press("Meta+\\");
  await expect
    .poll(async () => (await storeState(page)).readingMode)
    .toBe(true);
  observed += 1;
  await record(page, "04-cmd-backslash-immersive");
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setReadingMode: (v: boolean) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setReadingMode(false);
  });

  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  observed += 1;
  await record(page, "05-cmd-shift-backslash-grid");
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

  await page.keyboard.press("Meta+k");
  await expect(page.locator("[data-ai-overlay]")).toBeVisible();
  observed += 1;
  await record(page, "06-cmd-k-ai-overlay");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ai-overlay]")).toHaveCount(0);

  await page.keyboard.press("Meta+Shift+a");
  await expect(page.locator("[data-ai-bubble]")).toBeVisible();
  observed += 1;
  await record(page, "07-cmd-shift-a-bubble");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ai-bubble]")).toHaveCount(0);

  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  observed += 1;
  await record(page, "08-cmd-comma-settings");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  const before = (await storeState(page)).previewSettings.enabled;
  await page.keyboard.press("Meta+Shift+v");
  await expect
    .poll(async () => (await storeState(page)).previewSettings.enabled)
    .toBe(!before);
  observed += 1;
  await record(page, "09-cmd-shift-v-preview");
  await page.keyboard.press("Meta+Shift+v");

  await page.keyboard.press("Shift+/");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toBeVisible();
  observed += 1;
  await record(page, "10-question-overlay");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toHaveCount(0);
  observed += 1;
  await record(page, "11-esc-closed");

  expect(observed).toBe(9);
});

test("⌥4 / ⌥0 类型过滤：阅读空间与网格同语义", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const files = [
      { path: "/lib/a.md", title: "甲.md", openedAt: now, excerpt: "" },
      { path: "/lib/b.html", title: "乙.html", openedAt: now, excerpt: "" },
      { path: "/lib/c.txt", title: "丙.txt", openedAt: now, excerpt: "" },
      { path: "/lib/d.pdf", title: "丁.pdf", openedAt: now, excerpt: "" },
      { path: "/lib/e.mp4", title: "戊.mp4", openedAt: now, excerpt: "" },
      { path: "/lib/f.png", title: "己.png", openedAt: now, excerpt: "" },
      { path: "/lib/g.ts", title: "庚.ts", openedAt: now, excerpt: "" },
      { path: "/lib/h.mp3", title: "辛.mp3", openedAt: now, excerpt: "" },
    ];
    (
      window as unknown as {
        __biaoyue_store__: {
          setState: (patch: Record<string, unknown>) => void;
        };
      }
    ).__biaoyue_store__.setState({
      scene: "workspace",
      railState: "pinned",
      railChip: "all",
      railSection: "recent",
      recentFiles: files,
      gridTypeFilter: null,
    });
  });

  const categoryItems = page.locator(
    '[data-testid="rail-section"][data-section="category"] [data-testid="rail-item"]',
  );

  await page.keyboard.press("Alt+4");
  await expect.poll(async () => (await storeState(page)).railChip).toBe("pdf");
  expect((await storeState(page)).railSection).toBe("category");
  await expect(categoryItems).toHaveCount(1);
  await expect(categoryItems.first()).toHaveAttribute("data-kind", "pdf");
  await record(page, "12-rail-alt-4-pdf");

  await page.keyboard.press("Alt+0");
  await expect.poll(async () => (await storeState(page)).railChip).toBe("all");
  await expect(categoryItems).toHaveCount(8);
  await record(page, "13-rail-alt-0-all");

  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await page.keyboard.press("Alt+4");
  await expect(page.locator('[data-testid="grid"]')).toHaveAttribute(
    "data-grid-filter",
    "pdf",
  );
  await record(page, "14-grid-alt-4-pdf");
  await page.keyboard.press("Alt+0");
  await expect(page.locator('[data-testid="grid"]')).toHaveAttribute(
    "data-grid-filter",
    "all",
  );
  await record(page, "15-grid-alt-0-all");
});

test("⌘⇧M 循环预览 / 编辑 / 源码，编辑状态不重建", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_openFile__: (
          path: string,
          content: string,
          title?: string,
        ) => boolean;
      }
    ).__biaoyue_openFile__("/lib/mode.md", "# 标题\n\n正文内容。", "mode.md");
  });
  await expect(page.locator(".cm-editor-container")).toHaveCount(1);
  expect(await editorMode(page)).toBe("preview");

  await page.keyboard.press("Meta+Shift+m");
  await expect.poll(() => editorMode(page)).toBe("edit");
  await page.keyboard.press("Meta+Shift+m");
  await expect.poll(() => editorMode(page)).toBe("source");
  await page.keyboard.press("Meta+Shift+m");
  await expect.poll(() => editorMode(page)).toBe("preview");

  await expect(page.locator(".cm-editor-container")).toHaveCount(1);
  const text = await page.locator(".cm-editor-container").textContent();
  expect(text).toContain("标题");
  await record(page, "16-mode-cycle");
});

test("tooltip 显示键位：AI 星芒 / 模式 / 阅读含键位，主题按钮无键位段", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_openFile__: (
          path: string,
          content: string,
          title?: string,
        ) => boolean;
      }
    ).__biaoyue_openFile__("/lib/tip.md", "# 标题\n\n正文。", "tip.md");
  });

  const aiTitle = await page.locator("[data-ai-entry]").getAttribute("title");
  expect(aiTitle).toContain("⌘⇧A");

  const modeTitle = await page
    .locator('[data-testid="pane-mode"]')
    .first()
    .getAttribute("title");
  expect(modeTitle).toContain("⌘⇧M");

  const readingTitle = await page
    .locator('[data-testid="immersive-entry"]')
    .getAttribute("title");
  expect(readingTitle).toContain("⌘⇧F");

  const themeTitle = await page
    .locator('[title^="当前:"]')
    .getAttribute("title");
  expect(themeTitle).not.toContain("⌘");
  await record(page, "17-tooltips");
});

test("注册表规则：无三修饰键；裁定项在总览中全部呈现", async ({ page }) => {
  await boot(page);
  const three = SHORTCUTS.filter(
    (s) => s.keys.includes("⌘") && s.keys.includes("⌥") && s.keys.includes("⇧"),
  );
  expect(three).toHaveLength(0);

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
  await page.keyboard.press("Shift+/");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toBeVisible();

  const expected = SHORTCUTS.filter((s) => s.decision);
  await expect(page.locator('[data-testid="shortcut-decision"]')).toHaveCount(
    expected.length,
  );
  const decisionIds = await page
    .locator('[data-testid="shortcut-decision"]')
    .evaluateAll((els) =>
      els.map((el) =>
        el.closest("[data-shortcut-id]")?.getAttribute("data-shortcut-id"),
      ),
    );
  expect(new Set(decisionIds)).toEqual(new Set(expected.map((s) => s.id)));
  await record(page, "18-registry-rules");
});
