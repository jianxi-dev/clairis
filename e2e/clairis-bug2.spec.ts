import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * clairis-bug2（#242/#244）格头与页签交互验收：
 * - 单栏显示全屏按钮、隐藏关闭按钮
 * - 页签关闭 × 仅悬停页签时显现
 * - 页签右键菜单收窄到 132px，且不再提供导出
 * - 导出收敛到格头「更多 → 导出」二级菜单（含 ZIP）
 * - 跨格拖拽把页签搬到另一格，paneRoot 同步
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 App 暴露的
 * `window.__biaoyue_store__` 桥驱动与断言状态。
 * ⌘ 会被宿主 chrome 抢走，用 Control 作 meta 修饰键。
 */

const APP_URL = "http://localhost:1420";
const SPLIT_RIGHT = "Control+Alt+ArrowRight";
const ART = path.resolve(process.cwd(), ".artifacts/bug2");

mkdirSync(ART, { recursive: true });

type Store = {
  getState: () => {
    scene: string;
    focusedPaneId: string;
    paneRoot: unknown;
    tabs: Record<string, { path: string | null }>;
  };
};

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
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
            window as unknown as { __biaoyue_store__: Store }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

function paneCount(page: Page): Promise<number> {
  return page.locator("[data-pane-id]").count();
}

function tabCount(page: Page, paneId: string): Promise<number> {
  return page.locator(`[data-pane-id="${paneId}"] [data-tab-id]`).count();
}

function focusedId(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __biaoyue_store__: Store }
      ).__biaoyue_store__.getState().focusedPaneId,
  );
}

function leafTabs(page: Page, paneId: string): Promise<number> {
  return page.evaluate((id) => {
    const st = (
      window as unknown as { __biaoyue_store__: Store }
    ).__biaoyue_store__.getState();
    type Leaf = { type: string; id: string; tabs: string[] };
    type Node = { type: string; children: [unknown, unknown] };
    const find = (node: unknown): Leaf | null => {
      const n = node as Leaf | Node;
      if (n.type === "leaf") return (n as Leaf).id === id ? (n as Leaf) : null;
      const br = n as Node;
      return find(br.children[0]) ?? find(br.children[1]);
    };
    return find(st.paneRoot)?.tabs.length ?? -1;
  }, paneId);
}

function shot(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(ART, `${name}.png`) });
}

test("单栏：格头出现全屏按钮、不出现关闭按钮", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/bug2/fullscreen.md");

  await expect(page.locator('[data-testid="pane-fullscreen"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="pane-close"]')).toHaveCount(0);
  await shot(page, "single-pane-fullscreen");
});

test("页签关闭 × 默认透明，悬停页签后显现", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/bug2/hover.md");

  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  const closeBtn = tab.locator('button[title^="关闭"]');
  await expect(closeBtn).toHaveCSS("opacity", "0");
  await tab.hover();
  await expect(closeBtn).toHaveCSS("opacity", "1");
});

test("页签右键菜单收窄到 132px 且不再提供导出", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/bug2/ctx.md");

  await page
    .locator('[data-pane-id="main"] [data-tab-id]')
    .first()
    .click({ button: "right" });
  const menu = page.locator("[data-tab-menu]");
  await expect(menu).toBeVisible();

  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(150);
  expect(await menu.innerText()).not.toContain("导出");
});

test("格头更多 → 导出：二级菜单 5 项且 ZIP 可用", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/bug2/menu.md");

  await page.locator('[data-testid="pane-menu-button"]').first().click();
  await expect(page.locator('[data-testid="pane-menu"]')).toBeVisible();

  await page.locator('[data-menu-item="export"]').click();
  const submenu = page.locator('[data-testid="pane-export-submenu"]');
  await expect(submenu).toBeVisible();
  await expect(submenu.locator("[data-export-item]")).toHaveCount(5);
  await expect(
    submenu.locator('[data-export-item="exportZip"]'),
  ).not.toBeDisabled();
  await shot(page, "export-submenu");
});

test("跨格拖拽：页签从左格搬到右格，paneRoot 同步", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/bug2/drag.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneCount(page)).toBe(2);

  const rightPaneId = await focusedId(page);
  expect(rightPaneId).not.toBe("main");
  expect(await tabCount(page, "main")).toBe(1);
  expect(await tabCount(page, rightPaneId)).toBe(0);

  const tab = page.locator('[data-pane-id="main"] [data-tab-id]').first();
  const from = await tab.boundingBox();
  const target = await page
    .locator(`[data-pane-id="${rightPaneId}"]`)
    .boundingBox();
  if (!from || !target) throw new Error("页签或目标格不可测量");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 12,
    from.y + from.height / 2 + 6,
    { steps: 3 },
  );
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();

  await expect.poll(() => tabCount(page, "main")).toBe(0);
  await expect.poll(() => tabCount(page, rightPaneId)).toBe(1);
  await expect.poll(() => leafTabs(page, "main")).toBe(0);
  await expect.poll(() => leafTabs(page, rightPaneId)).toBe(1);
  await shot(page, "cross-pane-drag");
});
