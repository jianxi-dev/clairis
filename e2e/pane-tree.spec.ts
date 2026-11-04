import { test, expect, type Page } from "@playwright/test";

/**
 * 工作区 pane 递归树（layout-portal 3.1）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 App 暴露的
 * `window.__biaoyue_store__` 桥驱动状态。另加一层 initScript：把
 * save_config 里的 paneLayout 落到 localStorage，reload 后回灌给
 * load_config——这样「重启恢复」在 mock 环境下也能真实往返。
 */

const APP_URL = "http://localhost:1420";

// 用 Control 作 meta 修饰键：真机 ⌘⇧↵ / ⌘⌥→ 会被浏览器 chrome 抢走，
// 而 App 的 meta 判定是 `metaKey || ctrlKey`，Control 语义等价且不触发宿主快捷键。
const SPLIT_RIGHT = "Control+Alt+ArrowRight";
const SPLIT_DOWN = "Control+Alt+ArrowDown";
const FULLSCREEN = "Control+Shift+Enter";

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
    internals.invoke = async (cmd: string, args?: unknown) => {
      if (cmd === "load_config") {
        const res = (await orig(cmd, args)) as Record<string, unknown>;
        try {
          const stored = localStorage.getItem("__pane_layout__");
          if (stored) return { ...res, paneLayout: stored };
        } catch {
          /* localStorage 不可用时按缺省处理 */
        }
        return res;
      }
      if (cmd === "save_config") {
        const config = (
          args as { config?: Record<string, unknown> } | undefined
        )?.config;
        if (config && "paneLayout" in config) {
          try {
            localStorage.setItem(
              "__pane_layout__",
              String(config.paneLayout ?? ""),
            );
          } catch {
            /* ignore */
          }
        }
      }
      return orig(cmd, args);
    };
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openFile(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__(p, `# ${p.split("/").pop()}\n\n内容。`, "doc");
  }, path);
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

function paneCount(page: Page): Promise<number> {
  return page.locator("[data-pane-id]").count();
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

function layoutJson(page: Page): Promise<string> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __biaoyue_store__: { getState: () => { paneLayoutJson: () => string } };
      }
    ).__biaoyue_store__
      .getState()
      .paneLayoutJson(),
  );
}

test("⌘⌥→ 与 ⌘⌥↓ 各一次后出现三格，新格获得焦点", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pt/a.md");

  // 单格时根就是 leaf：格头不出现关闭按钮
  await expect(page.locator('[data-testid="pane-close"]')).toHaveCount(0);

  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneCount(page)).toBe(2);
  // 分裂后根变成分支，两个 leaf 各自可关闭
  await expect(page.locator('[data-testid="pane-close"]')).toHaveCount(2);
  const firstFocus = await focusedId(page);
  expect(firstFocus).not.toBe("main");

  await page.keyboard.press(SPLIT_DOWN);
  await expect.poll(() => paneCount(page)).toBe(3);
  const secondFocus = await focusedId(page);
  expect(secondFocus).not.toBe("main");
  expect(secondFocus).not.toBe(firstFocus);

  await expect(page.locator(`[data-pane-id="${secondFocus}"]`)).toHaveAttribute(
    "data-focused",
    "true",
  );
});

test("拖分隔条至左边界，左格被钳制在 240px", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pt/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneCount(page)).toBe(2);

  const divider = page.locator('[data-testid="pane-divider"]').first();
  const box = await divider.boundingBox();
  if (!box) throw new Error("divider 不可测量");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();

  const left = await page.locator('[data-pane-id="main"]').boundingBox();
  if (!left) throw new Error("左格不可测量");
  expect(left.width).toBeGreaterThanOrEqual(240);
  expect(Math.abs(left.width - 240)).toBeLessThanOrEqual(1);
});

test("关闭非根格最后一签：删格、兄弟扩展、无残留空格", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pt/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await openFile(page, "/tmp/pt/b.md");
  await expect.poll(() => paneCount(page)).toBe(2);

  const holdingPane = await focusedId(page);
  expect(holdingPane).not.toBe("main");

  // 右键该格页签 → 菜单「关闭」
  await page
    .locator(`[data-pane-id="${holdingPane}"] [data-tab-id]`)
    .first()
    .click({ button: "right" });
  const menu = page.locator("[data-tab-menu]");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "关闭", exact: true }).click();

  await expect.poll(() => paneCount(page)).toBe(1);
  const remaining = page.locator("[data-pane-id]");
  await expect(remaining).toHaveCount(1);
  await expect(page.locator('[data-pane-id="main"]')).toBeVisible();

  // 兄弟扩展：根格占满内容区（远大于半屏）
  const mainBox = await page.locator('[data-pane-id="main"]').boundingBox();
  if (!mainBox) throw new Error("根格不可测量");
  expect(mainBox.width).toBeGreaterThan(600);
});

test("⌘⇧↵ 全屏当前格隐藏其他格与分隔条，Esc/再按均恢复", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pt/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await expect.poll(() => paneCount(page)).toBe(2);
  await expect(page.locator('[data-testid="pane-divider"]')).toHaveCount(1);

  await page.keyboard.press(FULLSCREEN);
  await expect(page.locator('[data-testid="pane-divider"]')).toHaveCount(0);
  await expect(page.locator('[data-pane-id="main"]')).toBeHidden();

  // 再按一次 ⌘⇧↵ 恢复
  await page.keyboard.press(FULLSCREEN);
  await expect(page.locator('[data-testid="pane-divider"]')).toHaveCount(1);
  await expect(page.locator('[data-pane-id="main"]')).toBeVisible();

  // 全屏后按 Esc 恢复
  await page.keyboard.press(FULLSCREEN);
  await expect(page.locator('[data-testid="pane-divider"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="pane-divider"]')).toHaveCount(1);
  await expect(page.locator('[data-pane-id="main"]')).toBeVisible();
  await expect.poll(() => paneCount(page)).toBe(2);
});

test("布局树持久化：reload 后结构/比例/活动页签严格相等", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/pt/a.md");
  await page.keyboard.press(SPLIT_RIGHT);
  await openFile(page, "/tmp/pt/b.md");
  await expect.poll(() => paneCount(page)).toBe(2);

  // 调比例到 ~0.35
  const branch = page.locator("[data-pane-branch]").first();
  const cbox = await branch.boundingBox();
  const dbox = await page
    .locator('[data-testid="pane-divider"]')
    .first()
    .boundingBox();
  if (!cbox || !dbox) throw new Error("拖拽目标不可测量");
  const y = dbox.y + dbox.height / 2;
  await page.mouse.move(cbox.x + cbox.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(cbox.x + cbox.width * 0.35, y, { steps: 6 });
  await page.mouse.up();

  const before = JSON.parse(await layoutJson(page));
  expect(before.root.type).toBe("node");

  // 等真正落盘：存下来的必须等于当前布局（不能只等「有值」——首次保存
  // 可能发生在分裂之前，那时存的是单格布局）
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("__pane_layout__") ?? ""),
    )
    .toBe(JSON.stringify(before));

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
  await expect.poll(() => paneCount(page)).toBe(2);

  const after = JSON.parse(await layoutJson(page));
  expect(after).toEqual(before);
});
