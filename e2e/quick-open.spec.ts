import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 快速打开（reading-surface-refine 6.1 / #219）真实浏览器用例。
 *
 * ⌘P / Ctrl+P 拦截原生打印并打开 QuickOpen；面板跨页签 / 最近文件 / 命令三类
 * 联合过滤；Enter 执行命令；⌘⇧\ 与顶栏入口仍开网格。
 *
 * 走 e2e/mocks/tauri-mock.js，用 `window.__biaoyue_store__` 桥驱动状态。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/219");

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
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify({ task: "219-quick-open", states: [...byState.values()] }, null, 2)}\n`,
  );
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  // 记录原生打印：window.print 调用次数 + beforeprint 事件次数
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, number>;
    w.__printCalls = 0;
    w.__beforePrint = 0;
    window.print = () => {
      w.__printCalls += 1;
    };
    window.addEventListener("beforeprint", () => {
      w.__beforePrint += 1;
    });
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title?: string,
      ) => boolean;
      __biaoyue_store__: {
        setState: (patch: Record<string, unknown>) => void;
      };
    };
    w.__biaoyue_store__.setState({
      scene: "workspace",
      railState: "collapsed",
      recentFiles: [
        {
          path: "/lib/丙报告.md",
          title: "丙报告.md",
          openedAt: new Date().toISOString(),
          excerpt: "",
        },
      ],
    });
    w.__biaoyue_openFile__(
      "/lib/甲文档.md",
      "# 甲文档\n\n正文内容。",
      "甲文档.md",
    );
    w.__biaoyue_openFile__(
      "/lib/乙笔记.md",
      "# 乙笔记\n\n正文内容。",
      "乙笔记.md",
    );
  });
}

async function printCounters(
  page: Page,
): Promise<{ calls: number; before: number }> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, number>;
    return { calls: w.__printCalls ?? 0, before: w.__beforePrint ?? 0 };
  });
}

test("⌘P 打开快速打开，原生打印不触发", async ({ page }) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Meta+p");
  await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-open-input"]')).toBeFocused();

  const counters = await printCounters(page);
  expect(counters.calls).toBe(0);
  expect(counters.before).toBe(0);
  await record(page, "01-quick-open-workspace");
});

test("Ctrl+P 同样打开（非 macOS 键位）", async ({ page }) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Control+p");
  await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();

  const counters = await printCounters(page);
  expect(counters.calls).toBe(0);
  expect(counters.before).toBe(0);
});

test("输入联合过滤三类结果", async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.keyboard.press("Meta+p");

  const input = page.getByTestId("quick-open-input");
  const items = page.locator('[data-testid="quick-open-row"]');

  // 页签命中
  await input.fill("甲文档");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute("data-quick-kind", "tab");

  // 最近文件命中
  await input.fill("丙报告");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute("data-quick-kind", "recent");

  // 命令命中
  await input.fill("网格");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute("data-quick-kind", "command");
  await record(page, "02-filtered-results");

  // 无命中 → 空态
  await input.fill("zzz不存在");
  await expect(page.locator('[data-testid="quick-open-empty"]')).toBeVisible();
});

test("Enter 执行命令：设置与网格", async ({ page }) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Meta+p");
  await page.getByTestId("quick-open-input").fill("设置");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-open"]')).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await page.keyboard.press("Meta+p");
  await page.getByTestId("quick-open-input").fill("网格");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await expect(page.locator('[data-testid="quick-open"]')).toHaveCount(0);
  await record(page, "03-command-navigation");
});

test("↑↓ 选择后 Enter 打开页签", async ({ page }) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Meta+p");
  const items = page.locator('[data-testid="quick-open-row"]');

  // 首项（第一个页签）默认选中
  await expect(items.first()).toHaveAttribute("data-active", "true");

  // ↓ 移到第二项（第二个页签），Enter 打开它
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toHaveAttribute("data-active", "true");
  await expect(items.nth(1)).toHaveAttribute("data-quick-kind", "tab");

  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="quick-open"]')).toHaveCount(0);
  const activeTitle = await page.evaluate(
    () =>
      (
        window as unknown as {
          __biaoyue_store__: {
            getState: () => {
              activeTabId: string | null;
              tabs: Record<string, { title: string }>;
            };
          };
        }
      ).__biaoyue_store__.getState().tabs[
        (
          window as unknown as {
            __biaoyue_store__: {
              getState: () => { activeTabId: string | null };
            };
          }
        ).__biaoyue_store__.getState().activeTabId ?? ""
      ]?.title,
  );
  expect(activeTitle).toBe("乙笔记.md");
});

test("Esc 关闭快速打开", async ({ page }) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Meta+p");
  await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="quick-open"]')).toHaveCount(0);
});

test("⌘⇧\\ 与顶栏入口仍打开网格（回归）", async ({ page }) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();

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

  await page.locator('[data-testid="grid-entry"]').click();
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await record(page, "04-grid-regression");
});

test("点击遮罩关闭，零残留", async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.keyboard.press("Meta+p");
  await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();

  await page.mouse.click(8, 8);
  await expect(page.locator('[data-testid="quick-open"]')).toHaveCount(0);
});

test("门户场景按 ⌘P 也能打开快速打开", async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setScene: (s: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setScene("portal");
  });
  await expect(page.locator('[data-testid="portal"]')).toBeVisible();

  await page.keyboard.press("Meta+p");
  await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();
  await record(page, "05-portal-scene");
});

test("网格场景按 ⌘P 也能打开快速打开", async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setScene: (s: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setScene("grid");
  });
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();

  await page.keyboard.press("Meta+p");
  await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();
  await record(page, "06-grid-scene");
});

test("暗色主题下快速打开正常显示", async ({ page }) => {
  await boot(page);
  await seed(page);
  const themeToggle = page.getByTitle(/当前:/);
  for (let i = 0; i < 5; i++) {
    const title = await themeToggle.getAttribute("title");
    if (title?.includes("暗色")) break;
    await themeToggle.click();
    await page.waitForTimeout(100);
  }
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.keyboard.press("Meta+p");
  await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();
  await record(page, "07-quick-open-dark");
});
