import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  // 记录窗口最大化切换：包一层 invoke，命中 toggle_maximize 时计数。
  await page.addInitScript(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__: {
        invoke: (cmd: string, args?: unknown) => unknown;
        metadata: Record<string, unknown>;
      };
      __toggleMaximizeCalls: number;
    };
    // getCurrentWindow() 读 metadata.currentWindow.label，mock 默认没有，补一个。
    w.__TAURI_INTERNALS__.metadata = {
      ...w.__TAURI_INTERNALS__.metadata,
      currentWindow: { label: "main" },
    };
    w.__toggleMaximizeCalls = 0;
    const original = w.__TAURI_INTERNALS__.invoke;
    w.__TAURI_INTERNALS__.invoke = (cmd, args) => {
      if (cmd === "plugin:window|toggle_maximize") {
        w.__toggleMaximizeCalls += 1;
        return Promise.resolve(null);
      }
      if (cmd === "plugin:window|is_maximized") {
        return Promise.resolve(w.__toggleMaximizeCalls % 2 === 1);
      }
      return original(cmd, args);
    };
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/e2e-ctx.md", "# 标题\n\n内容。", "ctx");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

test.describe("页签右键菜单图标（ui-polish-batch6 3.1）", () => {
  test("每一项都带图标", async ({ page }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const labels = ["向右分栏", "向下分栏", "关闭", "关闭其他"];
    for (const label of labels) {
      const item = page.getByRole("button", { name: label, exact: true });
      await expect(item).toBeVisible();
      expect(await item.locator("svg").count()).toBe(1);
    }
  });
});

test.describe("「关闭其他」图标可辨（shell-media-batch7 3.1）", () => {
  test("单一叉、无虚线、与「关闭」不同", async ({ page }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const svg = page
      .getByRole("button", { name: "关闭其他", exact: true })
      .locator("svg");
    expect(await svg.locator("[stroke-dasharray]").count()).toBe(0);

    const paths = await svg
      .locator("path")
      .evaluateAll((els) => els.map((e) => e.getAttribute("d") ?? ""));
    expect(paths).toHaveLength(3);
    expect((paths[0].match(/M/gi) ?? []).length).toBe(2);

    const closeD = await page
      .getByRole("button", { name: "关闭", exact: true })
      .locator("svg path")
      .first()
      .getAttribute("d");
    expect(paths.join("|")).not.toBe(closeD);
  });
});

test.describe("页签右键菜单「悬浮小窗」（ui-polish-batch8 6.1）", () => {
  test("首项为悬浮小窗，点击唤出同款预览", async ({ page }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const items = page.locator("[data-tab-menu] > button");
    await expect(items).toHaveCount(10);
    await expect(items.first()).toHaveText(/悬浮小窗/);
    expect(await items.first().locator("svg").count()).toBe(1);

    await items.first().click();
    const preview = page.locator('[data-testid="floating-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute(
      "data-preview-path",
      "/tmp/e2e-ctx.md",
    );

    await page.locator('[data-testid="preview-close"]').click();
    await expect(preview).toHaveCount(0);
  });
});

test.describe("页签右键菜单：复制路径与移动到（ui-polish-batch12 5.1）", () => {
  test("分隔线下方依次出现复制路径与移动到，复制路径写剪贴板", async ({
    page,
  }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const items = page.locator("[data-tab-menu] > button");
    await expect(items).toHaveCount(10);
    await expect(items.nth(4)).toHaveText(/复制路径/);
    await expect(items.nth(6)).toHaveText(/移动到…/);

    await page.evaluate(() => {
      const w = window as unknown as Record<string, any>;
      w.__copied = null;
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: (t: string) => {
          (window as unknown as Record<string, any>).__copied = t;
          return Promise.resolve();
        },
      });
    });
    await items.nth(4).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as Record<string, any>).__copied,
        ),
      )
      .toBe("/tmp/e2e-ctx.md");
  });

  test("移动到…选目录后页签路径与标题更新", async ({ page }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });
    const items = page.locator("[data-tab-menu] > button");
    await items.nth(6).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const store = (window as unknown as Record<string, any>)
            .__biaoyue_store__;
          const state = store.getState();
          return state.tabs[state.activeTabId]?.path ?? "";
        }),
      )
      .toBe("/Users/test/e2e-ctx.md");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const store = (window as unknown as Record<string, any>)
            .__biaoyue_store__;
          const state = store.getState();
          return state.tabs[state.activeTabId]?.title ?? "";
        }),
      )
      .toBe("e2e-ctx.md");
  });
});

test.describe("页签右键菜单文件动作（editor-surface-batch17 18.1）", () => {
  test("导出 < 复制路径 < 打开文件位置，刷新 < 关闭，三项各 1 次", async ({
    page,
  }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });

    const items = page.locator("[data-tab-menu] > button");
    await expect(items).toHaveCount(10);
    const labels = await items.allTextContents();
    const idx = (name: string) => labels.findIndex((t) => t.trim() === name);
    const exportIdx = idx("导出");
    const copyIdx = idx("复制路径");
    const revealIdx = idx("打开文件位置");
    const reloadIdx = idx("刷新");
    const closeIdx = idx("关闭");

    expect(exportIdx).toBeGreaterThanOrEqual(0);
    expect(revealIdx).toBeGreaterThanOrEqual(0);
    expect(reloadIdx).toBeGreaterThanOrEqual(0);
    expect(exportIdx).toBeLessThan(copyIdx);
    expect(copyIdx).toBeLessThan(revealIdx);
    expect(reloadIdx).toBeLessThan(closeIdx);

    for (const name of ["导出", "打开文件位置", "刷新"]) {
      expect(labels.filter((t) => t.trim() === name)).toHaveLength(1);
    }
    await expect(page.locator('[data-menu-item="export"]')).toHaveCount(1);
    await expect(page.locator('[data-menu-item="reveal"]')).toHaveCount(1);
    await expect(page.locator('[data-menu-item="reload"]')).toHaveCount(1);
  });

  test("点导出打开导出菜单，取消后无残留", async ({ page }) => {
    await boot(page);
    await page.locator('[role="tab"]').first().click({ button: "right" });
    await page.locator('[data-menu-item="export"]').click();

    await expect(
      page.locator('[data-testid="pane-export-submenu"]'),
    ).toHaveCount(1);
    await expect(page.locator("[data-tab-menu]")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-testid="pane-export-submenu"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(0);
    await expect(page.locator("[data-tab-menu]")).toHaveCount(0);
  });
});

test.describe("页签右键菜单关闭协议（editor-surface-batch17 1.1）", () => {
  test("外点 / Esc / 滚动后菜单节点数为 0，再打开→Esc 无残留", async ({
    page,
  }) => {
    await boot(page);
    const menu = page.locator("[data-tab-menu]");
    const tab = page.locator('[role="tab"]').first();

    // 外点关闭
    await tab.click({ button: "right" });
    await expect(menu).toHaveCount(1);
    const preview = page.locator(".preview-content");
    const box = await preview.boundingBox();
    if (!box) throw new Error("预览内容不可见");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(menu).toHaveCount(0);

    // Esc 关闭
    await tab.click({ button: "right" });
    await expect(menu).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // 再打开 → Esc → 无残留
    await tab.click({ button: "right" });
    await expect(menu).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(menu).toHaveCount(0);
  });

  test("滚动正文后菜单关闭", async ({ page }) => {
    await boot(page);
    const long = Array.from({ length: 60 }, (_, i) => `第 ${i + 1} 段。`).join(
      "\n\n",
    );
    await page.evaluate((content) => {
      window.__biaoyue_openFile__("/tmp/e2e-ctx-long.md", content, "long");
    }, `# 长文\n\n${long}`);
    await expect
      .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
      .toBeGreaterThan(0);

    const menu = page.locator("[data-tab-menu]");
    await page.locator('[role="tab"]').first().click({ button: "right" });
    await expect(menu).toHaveCount(1);

    await page.locator(".preview-content").hover();
    await page.mouse.wheel(0, 400);
    await expect(menu).toHaveCount(0);
  });

  test("失焦后菜单关闭，回页再点无残留", async ({ page }) => {
    await boot(page);
    const menu = page.locator("[data-tab-menu]");
    await page.locator('[role="tab"]').first().click({ button: "right" });
    await expect(menu).toHaveCount(1);

    // headless 无法真正切走应用，派发 blur 驱动既有失焦监听
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(menu).toHaveCount(0);

    await page.locator('[role="tab"]').first().click({ button: "right" });
    await expect(menu).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("「关闭其他」仍只关闭其它页签", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__biaoyue_openFile__(
        "/tmp/e2e-ctx-2.md",
        "# 第二篇\n\n内容。",
        "ctx2",
      );
    });
    await expect(page.locator('[role="tab"]')).toHaveCount(2);

    const firstTab = page.locator('[role="tab"]').first();
    const firstId = await firstTab.getAttribute("data-tab-id");
    await firstTab.click({ button: "right" });
    await page.getByRole("button", { name: "关闭其他", exact: true }).click();

    await expect(page.locator('[role="tab"]')).toHaveCount(1);
    await expect(page.locator(`[data-tab-id="${firstId}"]`)).toHaveCount(1);
  });
});

test.describe("页签空白双击切窗口最大化（editor-surface-batch17 17.1）", () => {
  test("双击空白切换最大化/还原，页签数量不变", async ({ page }) => {
    await boot(page);
    const tabsBefore = await page.locator('[role="tab"]').count();
    const strip = page.locator(".tab-strip").first();
    const box = await strip.boundingBox();
    if (!box) throw new Error("页签条不可见");
    const x = box.x + box.width - 8;
    const y = box.y + box.height / 2;

    await page.mouse.dblclick(x, y);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const w = window as unknown as { __toggleMaximizeCalls: number };
          return w.__toggleMaximizeCalls;
        }),
      )
      .toBe(1);

    await page.mouse.dblclick(x, y);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const w = window as unknown as { __toggleMaximizeCalls: number };
          return w.__toggleMaximizeCalls;
        }),
      )
      .toBe(2);

    expect(await page.locator('[role="tab"]').count()).toBe(tabsBefore);
  });
});

test.describe("更多菜单「新建文件」置顶（editor-surface-batch17 17.1）", () => {
  test("第一项为新建文件，点击新建页签且菜单关闭", async ({ page }) => {
    await boot(page);
    const tabsBefore = await page.locator('[role="tab"]').count();

    await page.locator('[data-testid="pane-menu-button"]').first().click();
    const menu = page.locator('[data-testid="pane-menu"]').first();
    await expect(menu).toBeVisible();

    const first = menu.locator("[data-menu-item]").first();
    await expect(first).toHaveText("新建文件", { exact: true });
    await expect(first).toHaveAttribute("data-menu-item", "new-file");

    await first.click();
    await expect(page.locator('[role="tab"]')).toHaveCount(tabsBefore + 1);
    await expect(menu).toHaveCount(0);
  });
});

test.describe("栏目更多操作菜单按视口边界翻转（ui-polish-batch15 11.1）", () => {
  test("收窄视口后菜单完整可见，resize 重算不越界，关闭无残留", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 700, height: 520 });
    await boot(page);

    const button = page.locator('[data-testid="pane-menu-button"]').first();
    const menu = page.locator('[data-testid="pane-menu"]').first();
    await button.click();
    await expect(menu).toBeVisible();

    const geometry = async () => {
      const m = await menu.boundingBox();
      if (!m) throw new Error("菜单不可见");
      return {
        left: m.x,
        top: m.y,
        right: m.x + m.width,
        bottom: m.y + m.height,
      };
    };

    let g = await geometry();
    expect(g.right).toBeLessThanOrEqual(700);
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.top).toBeGreaterThanOrEqual(0);
    expect(g.bottom).toBeLessThanOrEqual(520);

    await page.setViewportSize({ width: 640, height: 520 });
    await menu.hover();
    await expect
      .poll(async () => (await geometry()).right)
      .toBeLessThanOrEqual(640);
    g = await geometry();
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.top).toBeGreaterThanOrEqual(0);
    expect(g.bottom).toBeLessThanOrEqual(520);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    expect(await page.locator('[data-testid="pane-menu"]').count()).toBe(0);
    expect(
      await page.locator('[data-testid="pane-export-submenu"]').count(),
    ).toBe(0);
  });

  test("宽视口不误翻转：菜单在视口内正常向下展开", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await boot(page);

    const button = page.locator('[data-testid="pane-menu-button"]').first();
    const menu = page.locator('[data-testid="pane-menu"]').first();
    await button.click();
    await expect(menu).toBeVisible();

    const b = await button.boundingBox();
    const m = await menu.boundingBox();
    if (!b || !m) throw new Error("无法测量按钮或菜单");
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.x + m.width).toBeLessThanOrEqual(1400);
    expect(m.y).toBeGreaterThanOrEqual(0);
    expect(m.y + m.height).toBeLessThanOrEqual(900);
    expect(m.y).toBeGreaterThanOrEqual(b.y + b.height);
  });
});
