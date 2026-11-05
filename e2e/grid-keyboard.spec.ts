import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/181");

mkdirSync(ART, { recursive: true });

test.use({ viewport: { width: 1200, height: 500 } });

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
    task: "181-grid-keyboard",
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
  await page.waitForSelector("header", { timeout: 15000 });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        setState: (s: Record<string, unknown>) => void;
      };
    };
    const now = Date.now();
    const ref = new Date(now);
    const startToday = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate(),
    ).getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const files = [];
    for (let i = 0; i < 16; i += 1) {
      const isSecond = i === 1;
      const ext = isSecond ? "png" : "txt";
      files.push({
        path: `/lib/kb-${String(i).padStart(2, "0")}.${ext}`,
        title: `键盘${String(i).padStart(2, "0")}.${ext}`,
        openedAt: iso(startToday + (16 - i) * 3_600_000),
        excerpt: i === 0 ? "# 键盘导航\n\n第一份文档正文。" : "",
      });
    }
    w.__biaoyue_store__.setState({
      recentFiles: files,
      scrollPositions: {},
      scene: "workspace",
    });
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

async function enterGridWithShortcut(page: Page): Promise<void> {
  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
}

async function selectedPath(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      document
        .querySelector('[data-selected="true"]')
        ?.getAttribute("data-grid-item") ?? null,
  );
}

async function topInContainer(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-selected="true"]');
    const grid = document.querySelector('[data-testid="grid"]');
    if (!el || !grid) return -1;
    return el.getBoundingClientRect().top - grid.getBoundingClientRect().top;
  });
}

async function settleFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function firstNumberedPath(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const badge = document.querySelector('[data-grid-number="1"]');
    const item = badge?.closest("[data-grid-item]");
    return item?.getAttribute("data-grid-item") ?? null;
  });
}

interface PaneLeaf {
  id: string;
  tabs: (string | null)[];
}

interface PaneState {
  scene: string;
  dir: string | null;
  focusedPaneId: string;
  leaves: PaneLeaf[];
}

async function paneState(page: Page): Promise<PaneState> {
  return page.evaluate(() => {
    const st = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            scene: string;
            paneRoot: {
              type: string;
              id?: string;
              dir?: string;
              tabs?: string[];
              children?: unknown[];
            };
            focusedPaneId: string;
            tabs: Record<string, { path: string | null }>;
          };
        };
      }
    ).__biaoyue_store__.getState();
    const leaves: PaneLeaf[] = [];
    const walk = (node: {
      type: string;
      id?: string;
      tabs?: string[];
      children?: unknown[];
    }) => {
      if (node.type === "leaf") {
        leaves.push({
          id: node.id ?? "",
          tabs: (node.tabs ?? []).map((id) => st.tabs[id]?.path ?? null),
        });
      } else if (node.children) {
        for (const child of node.children) {
          walk(child as Parameters<typeof walk>[0]);
        }
      }
    };
    walk(st.paneRoot);
    return {
      scene: st.scene,
      dir: st.paneRoot.type === "node" ? (st.paneRoot.dir ?? null) : null,
      focusedPaneId: st.focusedPaneId,
      leaves,
    };
  });
}

test("j/k 整行上下、h/l 行内左右，选中与键盘位置一致", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  expect(await selectedPath(page)).toBe("/lib/kb-00.txt");
  await settleFrame(page);
  const startTop = await topInContainer(page);

  await page.keyboard.press("j");
  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-04.txt");
  await settleFrame(page);
  const afterJTop = await topInContainer(page);
  expect(afterJTop).toBeGreaterThan(startTop + 40);
  await record(page, "01-j-next-row");

  await page.keyboard.press("k");
  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-00.txt");
  await settleFrame(page);
  const afterKTop = await topInContainer(page);
  expect(afterKTop).toBeLessThan(afterJTop - 40);

  await page.keyboard.press("l");
  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-01.png");
  await settleFrame(page);
  expect(
    Math.abs((await topInContainer(page)) - afterKTop),
  ).toBeLessThanOrEqual(8);
  await record(page, "02-l-same-row");

  await page.keyboard.press("h");
  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-00.txt");
  await settleFrame(page);
  expect(
    Math.abs((await topInContainer(page)) - afterKTop),
  ).toBeLessThanOrEqual(8);
});

test("Home/End 落首尾卡", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await page.keyboard.press("End");
  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-15.txt");
  await record(page, "03-end");

  await page.keyboard.press("Home");
  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-00.txt");
  await record(page, "04-home");
});

test("PageDown 一次滚动严格等于容器高 − 24px", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const grid = page.locator('[data-testid="grid"]');
  await grid.evaluate((el) => {
    el.scrollTop = 0;
  });
  const before = await grid.evaluate((el) => ({
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));

  await page.keyboard.press("PageDown");

  const after = await grid.evaluate((el) => ({
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
  }));
  const delta = after.scrollTop - before.scrollTop;
  const expected = after.clientHeight - 24;
  expect(Math.abs(delta - expected)).toBeLessThanOrEqual(1);
  await record(page, "05-page-down");
});

test("按住 ⌘ 显示视口编号 1..N，翻页后重算，松开即消失", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const grid = page.locator('[data-testid="grid"]');
  await grid.evaluate((el) => {
    el.scrollTop = 0;
  });

  await page.keyboard.down("Control");
  await expect(page.locator("[data-grid-number]")).toHaveCount(8);

  const numbers = await page
    .locator("[data-grid-number]")
    .evaluateAll((els) => els.map((el) => Number(el.textContent)));
  expect(numbers).toEqual(Array.from({ length: 8 }, (_, i) => i + 1));
  expect(numbers.length).toBeLessThanOrEqual(9);

  const firstBefore = await firstNumberedPath(page);
  expect(firstBefore).toBe("/lib/kb-00.txt");
  await record(page, "06-numbers");

  await page.keyboard.press("PageDown");
  await expect.poll(() => firstNumberedPath(page)).not.toBe(firstBefore);
  await record(page, "07-numbers-after-page");

  await page.keyboard.up("Control");
  await expect(page.locator("[data-grid-number]")).toHaveCount(0);
});

test("⌘3 在当前格打开第 3 张编号卡", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await page.keyboard.down("Control");
  await expect(page.locator('[data-grid-number="3"]')).toHaveCount(1);
  const thirdPath = await page.evaluate(() => {
    const badge = document.querySelector('[data-grid-number="3"]');
    return (
      badge?.closest("[data-grid-item]")?.getAttribute("data-grid-item") ?? null
    );
  });
  expect(thirdPath).toBe("/lib/kb-02.txt");

  await page.keyboard.press("3");
  await page.keyboard.up("Control");

  await expect
    .poll(() => paneState(page).then((s) => s.scene))
    .toBe("workspace");
  const state = await paneState(page);
  const focused = state.leaves.find((l) => l.id === state.focusedPaneId);
  expect(focused?.tabs).toContain(thirdPath);
  await record(page, "08-digit-open");
});

test("⌘⇧3 右分打开第 3 张，原格不含该卡", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await page.keyboard.down("Control");
  await expect(page.locator('[data-grid-number="3"]')).toHaveCount(1);
  const thirdPath = await page.evaluate(() => {
    const badge = document.querySelector('[data-grid-number="3"]');
    return (
      badge?.closest("[data-grid-item]")?.getAttribute("data-grid-item") ?? null
    );
  });

  await page.keyboard.down("Shift");
  await page.keyboard.press("3");
  await page.keyboard.up("Shift");
  await page.keyboard.up("Control");

  await expect.poll(() => paneState(page).then((s) => s.dir)).toBe("row");
  const state = await paneState(page);
  const focused = state.leaves.find((l) => l.id === state.focusedPaneId);
  const other = state.leaves.find((l) => l.id !== state.focusedPaneId);
  expect(focused?.tabs).toContain(thirdPath);
  expect(other?.tabs ?? []).not.toContain(thirdPath);
  await record(page, "09-digit-split-right");
});

test("⌘⇧1 右分已打开的卡：新格含卡，原格不含", async ({ page }) => {
  await boot(page);
  await seed(page);
  // 先打开 kb-00，再进网格
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_openFile__: (
          path: string,
          content: string,
          title?: string,
        ) => boolean;
      }
    ).__biaoyue_openFile__(
      "/lib/kb-00.txt",
      "# 键盘导航\n\n第一份文档正文。",
      "键盘00.txt",
    );
  });
  await enterGridWithShortcut(page);

  await page.keyboard.down("Control");
  await expect(page.locator('[data-grid-number="1"]')).toHaveCount(1);
  await page.keyboard.down("Shift");
  await page.keyboard.press("1");
  await page.keyboard.up("Shift");
  await page.keyboard.up("Control");

  await expect.poll(() => paneState(page).then((s) => s.dir)).toBe("row");
  const state = await paneState(page);
  const focused = state.leaves.find((l) => l.id === state.focusedPaneId);
  const other = state.leaves.find((l) => l.id !== state.focusedPaneId);
  expect(focused?.tabs).toContain("/lib/kb-00.txt");
  expect(other?.tabs ?? []).not.toContain("/lib/kb-00.txt");
  await record(page, "19-split-existing");
});

test("⌘⌥3 下分打开第 3 张（根方向 col）", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await page.keyboard.down("Control");
  await expect(page.locator('[data-grid-number="3"]')).toHaveCount(1);
  const thirdPath = await page.evaluate(() => {
    const badge = document.querySelector('[data-grid-number="3"]');
    return (
      badge?.closest("[data-grid-item]")?.getAttribute("data-grid-item") ?? null
    );
  });

  await page.keyboard.down("Alt");
  await page.keyboard.press("3");
  await page.keyboard.up("Alt");
  await page.keyboard.up("Control");

  await expect.poll(() => paneState(page).then((s) => s.dir)).toBe("col");
  const state = await paneState(page);
  const focused = state.leaves.find((l) => l.id === state.focusedPaneId);
  expect(focused?.tabs).toContain(thirdPath);
  await record(page, "10-digit-split-down");
});

test("⇧↵ 定位到阅读空间并高亮匹配卡", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-00.txt");
  await page.keyboard.press("Shift+Enter");

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
  await expect(page.locator('[data-testid="rail-panel"]')).toBeVisible();
  await expect(
    page.locator('[data-rail-path="/lib/kb-00.txt"]').first(),
  ).toHaveAttribute("data-located", "true");
  await record(page, "11-locate-rail");
});

test("Enter 打开选中卡", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-00.txt");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => paneState(page).then((s) => s.scene))
    .toBe("workspace");
  const state = await paneState(page);
  const focused = state.leaves.find((l) => l.id === state.focusedPaneId);
  expect(focused?.tabs).toContain("/lib/kb-00.txt");
  await record(page, "15-enter-open");
});

test("⌘↵ 右分打开选中卡", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await expect.poll(() => selectedPath(page)).toBe("/lib/kb-00.txt");
  await page.keyboard.press("Control+Enter");

  await expect.poll(() => paneState(page).then((s) => s.dir)).toBe("row");
  const state = await paneState(page);
  const focused = state.leaves.find((l) => l.id === state.focusedPaneId);
  expect(focused?.tabs).toContain("/lib/kb-00.txt");
  await record(page, "16-cmd-enter-split");
});

test("Tab/Shift+Tab 在非输入态循环筛选控件", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const focusIndex = () =>
    page.evaluate(() => {
      const controls = [
        "[data-grid-search]",
        "[data-grid-type-select]",
        "[data-grid-sort-select]",
        "[data-grid-group-select]",
        "[data-grid-pinned-select]",
      ].map((selector) => document.querySelector(selector));
      return controls.indexOf(document.activeElement as Element);
    });

  await page.keyboard.press("Tab");
  await expect.poll(focusIndex).toBe(0);

  await page.locator('[data-grid-mode="list"]').focus();
  await page.keyboard.press("Shift+Tab");
  await expect.poll(focusIndex).toBe(4);
  await record(page, "17-tab-cycle");
});

test("输入时导航键 inert，PageDown 仍滚动", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  const grid = page.locator('[data-testid="grid"]');
  await grid.evaluate((el) => {
    el.scrollTop = 0;
  });

  await page.keyboard.press("/");
  await page.keyboard.type("键");
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("16 项");
  expect(await selectedPath(page)).toBe("/lib/kb-00.txt");

  await page.keyboard.press("j");
  await expect(page.locator("[data-grid-search]")).toHaveValue("键j");
  expect(await selectedPath(page)).not.toBe("/lib/kb-04.txt");

  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __biaoyue_store__: { getState: () => { scene: string } };
          }
        ).__biaoyue_store__.getState().scene,
    ),
  ).toBe("grid");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();

  await page.locator("[data-grid-search-clear]").click();
  await page.locator("[data-grid-search]").focus();
  const beforeScroll = await grid.evaluate((el) => el.scrollTop);
  await page.keyboard.press("PageDown");
  const afterScroll = await grid.evaluate((el) => el.scrollTop);
  expect(afterScroll).toBeGreaterThan(beforeScroll);
  await record(page, "18-typing-inert");
});

test("Esc 分层：先清搜索（网格仍在），再退回门户", async ({ page }) => {
  await boot(page);
  await seed(page);
  await enterGridWithShortcut(page);

  await page.keyboard.press("/");
  await page.keyboard.type("00");
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("1 项");
  await record(page, "12-esc-typed");

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-grid-search]")).toHaveValue("");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await expect(page.locator('[data-testid="grid-count"]')).toHaveText("16 项");
  await record(page, "13-esc-clear-query");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="grid"]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("portal");
  await record(page, "14-esc-close-grid");
});
