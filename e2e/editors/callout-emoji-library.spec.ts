import { test, expect, type Page } from "@playwright/test";

/**
 * #1657 票 1.4：emoji 库与取色器重构。
 *
 * 打开 NOTE 高亮块的取色器，验证：
 * - 8 个页签文字与顺序（最近 / 表情符号 / 动物 / 食物 / 活动 / 地点 / 物件 / 符号）
 * - 「最近」页签「常用」段 24 项
 * - 点一个 emoji 后重开，「最近」段可见刚选的
 * - 搜索「猫」结果非空
 * - 点「随机」后卡片 emoji 变化且取色器仍可见
 * - Esc 关闭后重开搜索词为空（无残留）
 */

interface BridgeState {
  setEditorMode: (mode: string) => void;
}

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => BridgeState };
}

const DOC = "> [!NOTE]\n> 正文\n";

async function openDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/callout-emoji-library.md", body, "doc.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openPicker(page: Page): Promise<void> {
  const icon = page.locator(".cm-callout-icon").first();
  await expect(icon).toBeVisible();
  await icon.dispatchEvent("mousedown", { bubbles: true, cancelable: true });
  await page.locator('[data-testid="cm-callout-emoji-picker"]').waitFor();
}

test("取色器：8 个页签、常用 24 项、最近写入、搜索、随机、Esc 复位", async ({
  page,
}) => {
  await openDoc(page);
  // 每个用例从干净 localStorage 开始。
  await page.evaluate(() => localStorage.clear());
  await openPicker(page);

  // 页签 8 个且顺序正确。
  const tabs = page.locator('[data-testid="cm-callout-emoji-tab"]');
  await expect(tabs).toHaveCount(8);
  await expect(tabs).toHaveText([
    "最近",
    "表情符号",
    "动物",
    "食物",
    "活动",
    "地点",
    "物件",
    "符号",
  ]);

  // 「最近」页签「常用」段项数与 CALLOUT_EMOJI_CHOICES 一致（当前 24）。
  const frequent = page.locator(".cm-callout-emoji-section").first();
  await expect(
    frequent.locator(".cm-callout-emoji-section-title"),
  ).toHaveText("常用");
  const freqCount = await frequent
    .locator('[data-testid="cm-callout-emoji-option"]')
    .count();
  expect(freqCount).toBeGreaterThan(0);
  expect(freqCount).toBe(24);

  // 点一个 emoji（🚀 在常用段里）→ 关闭 → 重开 → 「最近」段出现它。
  await frequent.locator('[data-testid="cm-callout-emoji-option"]').nth(15).click();
  const picked = await page
    .locator(".cm-callout")
    .first()
    .getAttribute("data-callout-emoji");
  expect(picked).toBeTruthy();
  await openPicker(page);
  const recent = page.locator(".cm-callout-emoji-section").nth(1);
  await expect(
    recent.locator(".cm-callout-emoji-section-title"),
  ).toHaveText("最近");
  await expect(
    recent.locator('[data-testid="cm-callout-emoji-option"]'),
  ).toHaveCount(1);
  await expect(
    recent.locator('[data-testid="cm-callout-emoji-option"]').first(),
  ).toHaveAttribute("data-emoji", picked ?? "");

  // 搜索「猫」结果非空。
  const search = page.locator('[data-testid="cm-callout-emoji-search"]');
  await search.fill("猫");
  const results = page.locator('[data-testid="cm-callout-emoji-option"]');
  expect(await results.count()).toBeGreaterThan(0);

  // 清空搜索恢复页签内容。
  await search.fill("");
  await expect(
    page.locator(".cm-callout-emoji-section").first(),
  ).toBeVisible();

  // 点「随机」→ 卡片 emoji 变化且取色器仍在。
  const before = await page
    .locator(".cm-callout")
    .first()
    .getAttribute("data-callout-emoji");
  await page.locator('[data-testid="cm-callout-emoji-random"]').click();
  const after = await page
    .locator(".cm-callout")
    .first()
    .getAttribute("data-callout-emoji");
  expect(after).not.toBe(before);
  await expect(
    page.locator('[data-testid="cm-callout-emoji-picker"]'),
  ).toBeVisible();

  // Esc 关闭后重开搜索词为空（无残留）。
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-testid="cm-callout-emoji-picker"]'),
  ).toHaveCount(0);
  await openPicker(page);
  await expect(search).toHaveValue("");
});
