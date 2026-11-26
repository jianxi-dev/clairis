import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 左边栏固定隐藏（editor-surface-batch19 C3 / D14 / #857）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js；save_config 把整份配置写进 localStorage.__mock_config，
 * reload 后 load_config 原样返回，因此 railPinHidden 的「重启保持」真实往返。
 * ⌘ 用 Control 代替（App 判定 metaKey || ctrlKey）。
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/857");

mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__("/tmp/rr/design.md", "# 设计", "设计笔记");
    w.__biaoyue_openFile__("/tmp/rr/spec.html", "<p>设计</p>", "设计规范");
    w.__biaoyue_openFile__("/tmp/rr/plain.txt", "随笔内容", "随笔");
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

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

function railCounts(page: Page): Promise<{ edge: number; panel: number }> {
  return page.evaluate(() => ({
    edge: document.querySelectorAll('[data-testid="rail-edge"]').length,
    panel: document.querySelectorAll('[data-testid="rail-panel"]').length,
  }));
}

function storedRailPinHidden(page: Page): Promise<boolean | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("__mock_config");
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    return typeof cfg.railPinHidden === "boolean"
      ? (cfg.railPinHidden as boolean)
      : null;
  });
}

test("⌘⇧X 固定隐藏：箭头节点 0、滑入不显示；再按取消固定：箭头恢复、滑入显示", async ({
  page,
}) => {
  await boot(page);
  await seed(page);

  expect(await railCounts(page)).toEqual({ edge: 1, panel: 0 });
  await shot(page, "01-collapsed-arrow");

  await page.keyboard.press("Control+Shift+X");
  await expect.poll(() => railCounts(page)).toEqual({ edge: 0, panel: 0 });

  await page.mouse.move(1000, 500);
  await page.mouse.move(6, 400);
  await page.waitForTimeout(450);
  expect(await railCounts(page)).toEqual({ edge: 0, panel: 0 });
  await shot(page, "02-pinned-hidden-no-arrow");

  await page.keyboard.press("Control+Shift+X");
  await expect.poll(() => railCounts(page)).toEqual({ edge: 1, panel: 0 });

  await page.mouse.move(1000, 500);
  await page.mouse.move(6, 400);
  await expect.poll(() => railCounts(page)).toEqual({ edge: 0, panel: 1 });
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "hover",
  );
  await shot(page, "03-unpinned-hover-show");
});

test("设置开关写入 rail_pin_hidden 并即时生效、重启保持", async ({ page }) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="reading"]').click();

  const toggle = page.locator('[data-testid="rail-pin-hidden"]');
  await expect(toggle).not.toBeChecked();

  await toggle.check();
  await expect.poll(() => storedRailPinHidden(page)).toBe(true);
  await expect.poll(() => railCounts(page)).toEqual({ edge: 0, panel: 0 });
  await shot(page, "04-settings-pin-hidden");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  expect(await railCounts(page)).toEqual({ edge: 0, panel: 0 });

  await page.keyboard.press("Meta+,");
  await page.locator('[data-settings-nav="reading"]').click();
  await page.locator('[data-testid="rail-pin-hidden"]').uncheck();
  await expect.poll(() => storedRailPinHidden(page)).toBe(false);
  await expect.poll(() => railCounts(page)).toEqual({ edge: 1, panel: 0 });
});

test("隐藏态下 ⌘\\ 与 ⌘⌥\\ 仍恢复并固定（不破坏既有快捷键）", async ({
  page,
}) => {
  await boot(page);
  await seed(page);

  await page.keyboard.press("Control+Shift+X");
  await expect.poll(() => railCounts(page)).toEqual({ edge: 0, panel: 0 });

  await page.keyboard.press("Control+\\");
  await expect.poll(() => railCounts(page)).toEqual({ edge: 0, panel: 1 });
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "pinned",
  );
  await expect.poll(() => storedRailPinHidden(page)).toBe(false);

  await page.keyboard.press("Control+Shift+X");
  await expect.poll(() => railCounts(page)).toEqual({ edge: 0, panel: 0 });

  await page.keyboard.press("Control+Alt+\\");
  await expect.poll(() => railCounts(page)).toEqual({ edge: 0, panel: 1 });
  await expect(page.locator('[data-testid="rail-panel"]')).toHaveAttribute(
    "data-rail-state",
    "pinned",
  );
  await expect.poll(() => storedRailPinHidden(page)).toBe(false);
});

test("[#924] 网格概览打开时 ⌘⇧X 仍切换固定隐藏", async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible({
    timeout: 5000,
  });

  const hidden = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __biaoyue_editor_store__: {
              getState: () => { config: { railPinHidden?: boolean } };
            };
          }
        ).__biaoyue_editor_store__.getState().config.railPinHidden ?? false,
    );

  expect(await hidden()).toBe(false);
  await page.keyboard.press("Control+Shift+X");
  await expect.poll(hidden).toBe(true);
  expect(
    await page.evaluate(
      () => (window as unknown as { __biaoyue_store__: { getState: () => { scene: string } } }).__biaoyue_store__.getState().scene,
    ),
  ).toBe("grid");

  await page.keyboard.press("Control+Shift+X");
  await expect.poll(hidden).toBe(false);
});
