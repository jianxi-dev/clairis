import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 格头页签条 + 右侧三件（layout-portal 4.1）。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 App 暴露的
 * `window.__biaoyue_store__` 桥与 `__biaoyue_openFile__` 驱动状态。
 *
 * ⌘ 会被宿主 chrome 抢走，用 Control 作 meta 修饰键（App 判定 metaKey || ctrlKey）。
 */

const APP_URL = "http://localhost:1420";
const SPLIT_RIGHT = "Control+Alt+ArrowRight";
const ART = path.resolve(process.cwd(), ".artifacts/174");

mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openFile(page: Page, p: string): Promise<void> {
  await page.evaluate((file) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__(file, `# ${file.split("/").pop()}\n\n内容。`, "doc");
  }, p);
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

function focusedId(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __biaoyue_store__: { getState: () => { focusedPaneId: string } };
        }
      ).__biaoyue_store__.getState().focusedPaneId,
  );
}

function tabCount(page: Page, paneId: string): Promise<number> {
  return page.locator(`[data-pane-id="${paneId}"] [data-tab-id]`).count();
}

function paneCount(page: Page): Promise<number> {
  return page.locator("[data-pane-id]").count();
}

function tabOrder(page: Page, paneId: string): Promise<(string | null)[]> {
  return page
    .locator(`[data-pane-id="${paneId}"] [data-tab-id]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-tab-id")));
}

async function pressMeta(page: Page, key: string): Promise<void> {
  await page.keyboard.press(`Control+${key}`);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

test("⌘T ×2 再 ⌘W ×3：页签 1→2→3→2→1→0，最后一签关格且兄弟扩展", async ({
  page,
}) => {
  await boot(page);
  await openFile(page, "/tmp/ph/a.md");

  // 分裂出一格并给它一个页签，使「最后一签关闭」发生在非根格
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneCount(page)).toBe(2);
  await openFile(page, "/tmp/ph/b.md");
  const holding = await focusedId(page);
  expect(holding).not.toBe("main");
  await expect.poll(() => tabCount(page, holding)).toBe(1);

  await pressMeta(page, "t");
  await pressMeta(page, "t");
  await expect.poll(() => tabCount(page, holding)).toBe(3);
  await shot(page, "tabs-multi");

  await pressMeta(page, "w");
  await expect.poll(() => tabCount(page, holding)).toBe(2);
  await pressMeta(page, "w");
  await expect.poll(() => tabCount(page, holding)).toBe(1);
  await pressMeta(page, "w");

  await expect.poll(() => paneCount(page)).toBe(1);
  await expect(page.locator('[data-testid="pane-header"]')).toHaveCount(1);
  await expect(page.locator('[data-pane-id="main"]')).toBeVisible();
});

test("拖动页签换位：顺序严格等于落点；Esc 取消不留占位", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ph/a.md");
  await pressMeta(page, "t");
  await pressMeta(page, "t");
  await expect.poll(() => tabCount(page, "main")).toBe(3);

  const stripTabs = page.locator('[data-pane-id="main"] [data-tab-id]');
  const before = await tabOrder(page, "main");
  const firstTitle = (await stripTabs.nth(0).getAttribute("title")) ?? "";
  const first = await stripTabs.nth(0).boundingBox();
  const last = await stripTabs.nth(2).boundingBox();
  if (!first || !last) throw new Error("页签不可测量");

  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    first.x + first.width / 2 + 12,
    first.y + first.height / 2,
    {
      steps: 3,
    },
  );
  await page.mouse.move(last.x + last.width - 2, last.y + last.height / 2, {
    steps: 6,
  });
  await expect(
    page.locator('[data-testid="tab-drag-placeholder"]'),
  ).toHaveCount(1);
  const ghost = page.locator('[data-testid="tab-drag-ghost"]');
  await expect(ghost).toHaveCount(1);
  await expect(ghost).toContainText(firstTitle);
  await shot(page, "tab-drag-indicator");
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);

  await expect
    .poll(() => tabOrder(page, "main"))
    .toEqual([before[1], before[2], before[0]]);

  // Esc 取消：顺序不变，无残留占位
  const order = await tabOrder(page, "main");
  const box0 = await page
    .locator('[data-pane-id="main"] [data-tab-id]')
    .nth(0)
    .boundingBox();
  const box2 = await page
    .locator('[data-pane-id="main"] [data-tab-id]')
    .nth(2)
    .boundingBox();
  if (!box0 || !box2) throw new Error("页签不可测量");
  await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box0.x + box0.width / 2 + 12,
    box0.y + box0.height / 2,
    {
      steps: 3,
    },
  );
  await page.mouse.move(box2.x + box2.width - 2, box2.y + box2.height / 2, {
    steps: 6,
  });
  await expect(
    page.locator('[data-testid="tab-drag-placeholder"]'),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-testid="tab-drag-placeholder"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid="tab-drag-ghost"]')).toHaveCount(0);
  await page.mouse.up();
  expect(await tabOrder(page, "main")).toEqual(order);
});

test("⋯ 菜单恰好 7 项、每项带图标、无全屏项", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ph/m.md");

  await page.locator('[data-testid="pane-menu-button"]').click();
  const menu = page.locator('[data-testid="pane-menu"]');
  await expect(menu).toBeVisible();
  const items = menu.locator("[data-menu-item]");
  await expect(items).toHaveCount(7);

  const labels = (await items.allInnerTexts()).map((t) => t.trim());
  expect(labels).toEqual([
    "导出",
    "分享",
    "右分",
    "下分",
    "源码模式",
    "定位",
    "复制路径",
  ]);

  const n = await items.count();
  for (let i = 0; i < n; i++) {
    await expect(items.nth(i).locator("svg")).toHaveCount(1);
  }
  await expect(menu.getByText("全屏", { exact: false })).toHaveCount(0);
  await shot(page, "pane-menu-open");
});

test("模式图标在预览↔编辑间切换，编辑态 EditorView 实例不重建", async ({
  page,
}) => {
  await boot(page);
  await openFile(page, "/tmp/ph/a.md");

  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  await expect(modeBtn).toHaveAttribute("data-mode", "preview");

  await modeBtn.click();
  await expect(modeBtn).toHaveAttribute("data-mode", "edit");

  // 记录当前 EditorView 的 DOM 节点身份
  await page.evaluate(() => {
    (window as unknown as { __cmRef1__: Element | null }).__cmRef1__ =
      document.querySelector(".cm-editor");
  });

  await page.locator(".cm-content").click();
  await page.keyboard.type("HELLO");
  await expect(page.locator(".cm-content")).toContainText("HELLO");
  await shot(page, "mode-toggled-edit");

  await modeBtn.click();
  await expect(modeBtn).toHaveAttribute("data-mode", "preview");
  await modeBtn.click();
  await expect(modeBtn).toHaveAttribute("data-mode", "edit");

  const sameInstance = await page.evaluate(
    () =>
      (window as unknown as { __cmRef1__: Element | null }).__cmRef1__ ===
      document.querySelector(".cm-editor"),
  );
  expect(sameInstance).toBe(true);
  await expect(page.locator(".cm-content")).toContainText("HELLO");
});

test("页签图标颜色严格等于文件类型色（data-tab-color）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ph/note.md");

  const tab = page.locator('[data-pane-id="main"] [data-tab-color]').first();
  const colorExpr = await tab.getAttribute("data-tab-color");
  expect(colorExpr).toBeTruthy();

  const [resolved, tokenColor, fill] = await page.evaluate((expr) => {
    const probe = document.createElement("span");
    probe.style.color = expr as string;
    document.body.appendChild(probe);
    const resolvedColor = getComputedStyle(probe).color;
    probe.style.color = "var(--type-markdown)";
    const token = getComputedStyle(probe).color;
    probe.remove();
    const svg = document.querySelector(
      '[data-pane-id="main"] [data-tab-color] svg',
    );
    return [
      resolvedColor,
      token,
      svg ? getComputedStyle(svg).fill : "",
    ] as const;
  }, colorExpr);

  expect(fill).toBe(resolved);
  expect(fill).toBe(tokenColor);
});

test("双击页签名改名：回车提交、Esc 取消、路径不变", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ph/a.md");
  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  await expect(tab).toHaveCount(1);

  const pathBefore = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            activeTabId: string | null;
            tabs: Record<string, { path: string | null }>;
          };
        };
      }
    ).__biaoyue_store__.getState();
    return s.activeTabId ? s.tabs[s.activeTabId].path : null;
  });

  await tab.locator("span").first().dblclick();
  const input = page.getByTestId("tab-title-input");
  await expect(input).toBeVisible();
  await input.fill("新名字");
  await input.press("Enter");
  await expect(tab).toHaveAttribute("title", "新名字");

  const pathAfter = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            activeTabId: string | null;
            tabs: Record<string, { path: string | null }>;
          };
        };
      }
    ).__biaoyue_store__.getState();
    return s.activeTabId ? s.tabs[s.activeTabId].path : null;
  });
  expect(pathAfter).toBe(pathBefore);

  await tab.locator("span").first().dblclick();
  await expect(page.getByTestId("tab-title-input")).toBeVisible();
  await page.getByTestId("tab-title-input").fill("不该生效");
  await page.getByTestId("tab-title-input").press("Escape");
  await expect(page.getByTestId("tab-title-input")).toHaveCount(0);
  await expect(tab).toHaveAttribute("title", "新名字");
});

test("全屏按钮默认隐藏，悬停与全屏态显示", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ph/full.md");
  const pane = page.locator('[data-pane-id="main"]');
  const btn = pane.locator('[data-testid="pane-fullscreen"]');

  const away = async () =>
    page.mouse.move(2, Math.round((await page.viewportSize())!.height / 2));
  await away();
  await expect
    .poll(() => btn.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("0");

  await pane.hover();
  await expect
    .poll(() => btn.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");

  await btn.click();
  await away();
  await expect
    .poll(() => btn.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
});
