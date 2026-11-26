import { test, expect, type Page } from "@playwright/test";
import { summonAddHandle } from "./helpers/block-handle";

/**
 * 第十批：MD 编辑态不再出现「AI / 背景 / 边框 / 删除」块工具条。
 * 该工具条归属 HTML 非文字区块；MD 选区继续使用轮盘。
 */

const APP_URL = "http://localhost:1424";
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;
const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/block-toolbar.md",
      body,
      "block-toolbar.md",
    );
    store.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
});

test("MD 点击块内不出现块工具条", async ({ page }) => {
  await page.locator(".cm-line").nth(2).click();
  await expect(page.locator('[data-testid="block-toolbar"]')).toHaveCount(0);
});

test("MD 选中文字后快捷键召唤选区轮盘，块工具条不出现", async ({ page }) => {
  const line = page.locator(".cm-line").nth(2);
  const box = (await line.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press(HOTKEY);

  await expect(
    page.locator('[data-testid="selection-roulette"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="block-toolbar"]')).toHaveCount(0);
});

test("空行 + 手柄悬停不弹转换菜单（#105）", async ({ page }) => {
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    store.getState().updateTabContent(state.activeTabId, "# 标题\n\n\n");
  });
  const handle = page.locator(
    '[data-testid="block-handle"][data-empty="true"]',
  );
  await expect(handle.first()).toBeVisible({ timeout: 5000 });
  // 隐藏态 pointer-events:none，先召唤再悬停（同 #800）。
  await summonAddHandle(page, handle.first().locator(".cm-block-handle-add"));
  await handle.first().hover();
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="block-menu"]')).toHaveCount(0);
});

test("全角斜杠与顿号不触发命令（#318）", async ({ page }) => {
  await page.locator(".cm-content").click();
  await page.keyboard.press("Meta+End");
  await page.keyboard.type("／");
  await page.keyboard.type("、");
  await expect(page.locator('[data-testid="slash-menu"]')).toHaveCount(0);
  // 内容快照走 300ms 防抖（ADR 0003），store 收敛需要轮询。
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const store = (window as unknown as Record<string, any>)
          .__biaoyue_store__;
        const state = store.getState();
        return state.tabs[state.activeTabId]?.content ?? "";
      }),
    )
    .toContain("／、");
});

test("[#921] 文本文件工具条只保留复制，编辑态与预览态一致", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/921.txt",
      "第一行\n第二行\n第三行\n",
      "921.txt",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(400);

  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  const bar = page.locator('[data-testid="selection-toolbar"]');
  await expect(bar).toBeVisible({ timeout: 3000 });
  await expect(bar.locator("button")).toHaveCount(1);
  await expect(bar.locator("button")).toHaveAttribute("data-action", "copy");
  await expect(bar.locator("button")).toHaveAttribute("title", "复制");
  await bar.locator("button").click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("第二行");

  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await expect(bar).toBeHidden();

  const copy = page.locator(".preview-content .code-copy");
  await expect(copy).toHaveCount(1);
  await expect(copy).toHaveText("复制");
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("第一行");
});
