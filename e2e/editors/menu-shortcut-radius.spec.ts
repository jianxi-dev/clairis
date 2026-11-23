import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;
const ART = ".artifacts/1394";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

/** 断言通过后截图，并把该态记进 state-coverage.json（QG-5 manifest）。 */
function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

async function boot(page: Page, body = DOC) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((text) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/menu-shortcut.md", text, "menu-shortcut.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, body);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function hoverHandle(page: Page, lineIndex: number) {
  const line = page.locator(".cm-line").nth(lineIndex);
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
  const handle = page.locator(
    '[data-testid="block-handle"].cm-block-handle-visible',
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

async function openCapsule(page: Page) {
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_editor_store__: {
          getState: () => { setConfig: (c: Record<string, unknown>) => void };
        };
      }
    ).__biaoyue_editor_store__
      .getState()
      .setConfig({ selectionToolbar: "capsule" });
  });
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  const capsule = page.locator('[data-testid="selection-capsule"]');
  await expect(capsule).toBeVisible({ timeout: 3000 });
  return capsule;
}

async function openWheel(page: Page) {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator('[data-testid="selection-roulette"]');
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
  return wheel;
}

test.describe("菜单行快捷键区（editor-refine-batch1 5.1）", () => {
  test("块菜单每个动作行右侧有 kbd 区；有键位显示键名，无键位留白", async ({
    page,
  }) => {
    await boot(page);
    await hoverHandle(page, 2);

    const rows = page.locator('[data-testid="block-menu-action"]');
    await expect(rows).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      await expect(rows.nth(i).locator(".cm-menu-kbd")).toHaveCount(1);
    }

    const duplicate = page.locator(
      '[data-testid="block-menu-action"][data-action="duplicate"]',
    );
    await expect(duplicate.locator(".cm-menu-kbd")).toHaveText("⌘ + C");
    await expect(duplicate).toHaveAttribute("title", "复制块");
    await duplicate.hover();
    await shot(page, "01-block-menu-kbd-column", "block-menu-kbd-column");

    for (const action of ["cut", "move-up", "move-down", "delete"]) {
      const kbd = page.locator(
        `[data-testid="block-menu-action"][data-action="${action}"] .cm-menu-kbd`,
      );
      await expect(kbd).toHaveText("");
      const width = await kbd.evaluate(
        (el) => el.getBoundingClientRect().width,
      );
      expect(width).toBe(0);
    }
    await page.locator('[data-action="delete"]').hover();
    await shot(page, "02-no-shortcut-row-blank", "no-shortcut-row-blank");
  });

  test("浮条（胶囊）每个按钮带 kbd 区；有键位显示键名，无键位留白", async ({
    page,
  }) => {
    await boot(page);
    const capsule = await openCapsule(page);

    const buttons = capsule.locator(".capsule-btn[data-action]");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(buttons.nth(i).locator(".cm-menu-kbd")).toHaveCount(1);
    }

    await expect(
      capsule.locator(
        '.capsule-btn[data-action="format-underline"] .cm-menu-kbd',
      ),
    ).toHaveText("⌘ + U");
    await expect(
      capsule.locator('.capsule-btn[data-action="ai-translate"] .cm-menu-kbd'),
    ).toHaveText("⌘⇧T");
    await expect(
      capsule.locator('.capsule-btn[data-action="format-bold"] .cm-menu-kbd'),
    ).toHaveText("");
    await shot(page, "05-selection-capsule-kbd", "selection-capsule-kbd");
  });

  test("浮条（高亮块工具条）每个按钮带 kbd 区，无键位留白", async ({
    page,
  }) => {
    await boot(page, "> [!NOTE] 标题\n> 正文");
    const card = page.locator(".cm-callout").first();
    await expect(card).toBeVisible();
    await card.locator(".cm-callout-content").click();
    const bar = page.locator('[data-testid="callout-color-bar"]');
    await expect(bar).toBeVisible();

    const buttons = bar.locator(".cm-callout-bar-btn");
    await expect(buttons).toHaveCount(2);
    for (let i = 0; i < 2; i += 1) {
      const kbd = buttons.nth(i).locator(".cm-menu-kbd");
      await expect(kbd).toHaveCount(1);
      await expect(kbd).toHaveText("");
    }
  });

  test("轮盘筛选行沿用同一 kbd 字形且每行有键位", async ({ page }) => {
    await boot(page);
    await openWheel(page);
    await page.keyboard.press("Control+f");
    const filterInput = page.locator('[data-testid="sr-filter-input"]');
    await expect(filterInput).toBeVisible({ timeout: 3000 });
    await filterInput.fill("标题");

    const rows = page.locator(".sr-filter-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const kbd = rows.nth(i).locator(".cm-menu-kbd");
      await expect(kbd).toHaveCount(1);
      await expect(kbd).not.toHaveText("");
    }
    await expect(rows.first().locator(".cm-menu-kbd")).toHaveText("回车");
    await shot(
      page,
      "04-floating-and-roulette-kbd",
      "floating-and-roulette-kbd",
    );
  });

  test("文件名右键菜单圆角接菜单 token，且与块菜单容器一致", async ({
    page,
  }) => {
    await boot(page);
    await hoverHandle(page, 2);
    const blockRadius = await page
      .locator('[data-testid="block-menu"]')
      .evaluate((el) => getComputedStyle(el).borderRadius);
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);

    await page.locator('[role="tab"]').first().click({ button: "right" });
    const menu = page.locator("[data-tab-menu]");
    await expect(menu).toBeVisible();

    const tabRadius = await menu.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    );
    expect(tabRadius).toBe(blockRadius);
    expect(tabRadius).toBe("12px");

    const rowRadius = await menu
      .locator('[data-menu-item="print"]')
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(rowRadius).toBe("6px");
    await shot(page, "03-tab-menu-radius-token", "tab-menu-radius-token");

    const rows = menu.locator("> button");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i).locator(".cm-menu-kbd")).toHaveCount(1);
    }
  });

  test("开合往返后 kbd 区仍在，Esc 后无残留", async ({ page }) => {
    await boot(page);
    await hoverHandle(page, 2);
    await expect(
      page.locator('[data-action="duplicate"] .cm-menu-kbd'),
    ).toHaveText("⌘ + C");

    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);

    await hoverHandle(page, 2);
    await expect(
      page.locator('[data-action="duplicate"] .cm-menu-kbd'),
    ).toHaveText("⌘ + C");
    await page.keyboard.press("Escape");
    await expect(page.locator(".cm-menu-kbd")).toHaveCount(0);
  });
});
