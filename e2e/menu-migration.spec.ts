import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 文件动作迁移到页签右键菜单（issue #806 / editor-surface-batch18 D1）。
 *
 * 断言：菜单 11 个可点行、导出就地展开 6 项子菜单、打印紧邻导出、
 * 格头 ⋯ 菜单恰好 6 项、Esc / 外点后无残留。
 * 截图落 `.artifacts/806/`，由 `scripts/cw-evidence.sh record-state` 汇总。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/806");

test.beforeAll(() => {
  mkdirSync(ART, { recursive: true });
});

async function shot(page: Page, state: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${state}.png`) });
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__("/tmp/806.md", "# 标题\n\n正文。", "806");
  });
  await page.waitForTimeout(300);
}

/** 顶层可点项 + 导出行容器，按文档顺序。 */
function menuRows(page: Page) {
  return page.locator(
    "[data-tab-menu] > button, [data-tab-menu] > [data-export-row]",
  );
}

async function openTabMenu(page: Page): Promise<void> {
  await page.locator('[role="tab"]').first().click({ button: "right" });
  await expect(page.locator("[data-tab-menu]")).toHaveCount(1);
}

test.describe("页签右键菜单：11 项与顺序", () => {
  test("顶层恰好 11 项，导出 < 打印+1 < 复制路径 < 打开文件位置，刷新 < 关闭", async ({
    page,
  }) => {
    await boot(page);
    await openTabMenu(page);

    await expect(menuRows(page)).toHaveCount(11);

    const labels = await menuRows(page).evaluateAll((els) =>
      els.map((el) => el.textContent?.trim() ?? ""),
    );
    expect(labels).toEqual([
      "悬浮小窗",
      "向右分栏",
      "向下分栏",
      "导出",
      "打印",
      "复制路径",
      "打开文件位置",
      "移动到…",
      "刷新",
      "关闭",
      "关闭其他",
    ]);

    const idx = (name: string) => labels.indexOf(name);
    const exportIdx = idx("导出");
    const printIdx = idx("打印");
    expect(exportIdx).toBeGreaterThanOrEqual(0);
    expect(printIdx).toBe(exportIdx + 1);
    expect(exportIdx).toBeLessThan(idx("复制路径"));
    expect(idx("复制路径")).toBeLessThan(idx("打开文件位置"));
    expect(idx("刷新")).toBeLessThan(idx("关闭"));

    await shot(page, "tab-menu-open");
  });
});

test.describe("导出子菜单就地展开", () => {
  test("点击导出后同一菜单出现 6 项子菜单且不关菜单、不跳格头", async ({
    page,
  }) => {
    await boot(page);
    await openTabMenu(page);
    await page.locator('[data-menu-item="export"]').click();

    await expect(page.locator("[data-tab-menu]")).toHaveCount(1);
    const submenu = page.locator('[data-testid="pane-export-submenu"]');
    await expect(submenu).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="pane-menu"]')).toHaveCount(0);

    const order = await submenu
      .locator("[data-export-item]")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-export-item")),
      );
    expect(order).toEqual([
      "exportDocx",
      "exportMdpkg",
      "exportPng",
      "exportPdf",
      "exportHtml",
      "exportZip",
    ]);
    expect(order).not.toContain("print");

    const box = await submenu.boundingBox();
    expect(box).not.toBeNull();
    const vw = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw.width);

    await shot(page, "export-submenu-open");
  });
});

test.describe("格头 ⋯ 菜单只剩格级动作", () => {
  test("恰好 6 项且不含导出 / 刷新 / 打开文件位置", async ({ page }) => {
    await boot(page);
    await page.locator('[data-testid="pane-menu-button"]').first().click();
    const menu = page.locator('[data-testid="pane-menu"]');
    await expect(menu).toBeVisible();

    const items = menu.locator("[data-menu-item]");
    await expect(items).toHaveCount(6);
    const labels = (await items.allInnerTexts()).map((t) => t.trim());
    expect(labels).toEqual([
      "新建文件",
      "分享",
      "右分",
      "下分",
      "源码模式",
      "定位",
    ]);

    await shot(page, "pane-menu-open");
  });
});

test.describe("打印独立项", () => {
  test("与导出同级紧邻，点击调用 window.print 恰好一次", async ({ page }) => {
    await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
    await page.addInitScript(() => {
      const w = window as unknown as { __printCalls?: number };
      w.__printCalls = 0;
      window.print = () => {
        w.__printCalls = (w.__printCalls ?? 0) + 1;
      };
    });
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="pane-header"]', {
      timeout: 15000,
    });
    await page.evaluate(() => {
      window.__biaoyue_openFile__("/tmp/806-print.md", "# 标题", "print");
    });
    await page.waitForTimeout(300);

    await openTabMenu(page);
    await page.locator('[data-menu-item="print"]').click();

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __printCalls?: number }).__printCalls ??
              0,
          ),
        { timeout: 5000 },
      )
      .toBe(1);
    await expect(page.locator("[data-tab-menu]")).toHaveCount(0);
  });
});

test.describe("关闭协议无残留", () => {
  test("Esc 同时关掉子菜单与菜单", async ({ page }) => {
    await boot(page);
    await openTabMenu(page);
    await page.locator('[data-menu-item="export"]').click();
    await expect(
      page.locator('[data-testid="pane-export-submenu"]'),
    ).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-testid="pane-export-submenu"]'),
    ).toHaveCount(0);
    await expect(page.locator("[data-tab-menu]")).toHaveCount(0);
    await shot(page, "menu-closed");
  });

  test("点击外部后菜单与子菜单均消失", async ({ page }) => {
    await boot(page);
    await openTabMenu(page);
    await page.locator('[data-menu-item="export"]').click();
    await expect(
      page.locator('[data-testid="pane-export-submenu"]'),
    ).toHaveCount(1);

    const preview = page.locator(".preview-content");
    const box = await preview.boundingBox();
    if (!box) throw new Error("预览内容不可见");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator("[data-tab-menu]")).toHaveCount(0);
    await expect(
      page.locator('[data-testid="pane-export-submenu"]'),
    ).toHaveCount(0);
  });
});
