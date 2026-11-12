import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const WHEEL = '[data-testid="selection-roulette"]';
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const HOTKEY = `${MOD}+Shift+Space`;

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/regression-566.md",
      "# 标题\n\n正文。",
      "regression-566.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
}

async function openWheel(page: Page, lineIndex = 1) {
  await page.locator(".cm-line").nth(lineIndex).click({ clickCount: 3 });
  await page.keyboard.press(HOTKEY);
  const wheel = page.locator(WHEEL);
  await expect(wheel).toBeVisible({ timeout: 3000 });
  if ((await wheel.getAttribute("data-form")) === "hub") {
    await wheel.locator('[data-testid="roulette-center"]').dblclick();
  }
  return wheel;
}

test("三层展开后根扇区 opacity 为 0.9", async ({ page }) => {
  await boot(page);
  const wheel = await openWheel(page);
  await wheel.locator('[data-sector="convert"]').click();
  await wheel
    .locator('.sr-sec[data-band="2"][data-action="convert-heading-group"]')
    .click({ force: true });
  await expect(page.locator('.sr-sec[data-band="3"]')).toHaveCount(6);
  await expect(wheel.locator('[data-sector="convert"]')).toHaveCSS(
    "opacity",
    "0.9",
  );
});

test("关闭轮盘后无残留节点", async ({ page }) => {
  await boot(page);
  await openWheel(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(WHEEL)).toHaveCount(0, { timeout: 3000 });
});

test("证据：轮盘四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  const wheel = await openWheel(page);
  await page.screenshot({ path: `${dir}/wheel-default.png` });
  await wheel.locator('[data-sector="convert"]').click();
  await page.screenshot({ path: `${dir}/wheel-sub-open.png` });
  await wheel
    .locator('.sr-sec[data-band="2"][data-action="convert-heading-group"]')
    .click({ force: true });
  await page.screenshot({ path: `${dir}/wheel-third-open.png` });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/wheel-closed.png` });
});

test("历史分组顺序：复制 → 剪切（索引 2）→ 前进", async ({ page }) => {
  await boot(page);
  const wheel = await openWheel(page);
  await wheel.locator('[data-sector="history"]').click();
  const ids = await wheel
    .locator('.sr-sec[data-band="2"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-action")));
  expect(ids).toEqual([
    "history-undo",
    "history-copy",
    "history-cut",
    "history-redo",
    "history-delete",
  ]);
  expect(ids.indexOf("history-cut")).toBe(2);
});

test("剪切写剪贴板并删除所选块", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await boot(page);
  const wheel = await openWheel(page, 2);
  await wheel.locator('[data-sector="history"]').click();
  await wheel
    .locator('.sr-sec[data-action="history-cut"]')
    .click({ force: true });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe("正文。");
  await page.waitForFunction(
    (text) => {
      const state = window.__biaoyue_store__.getState();
      return !state.tabs[state.activeTabId]?.content.includes(text);
    },
    "正文。",
    { timeout: 3000 },
  );
});

test("颜色二级透明项：棋盘格可辨识、标签文字可读", async ({ page }) => {
  await boot(page);
  const wheel = await openWheel(page);
  await wheel.locator('[data-sector="color"]').click();

  const bare = wheel.locator(".sr-sec.sr-color.bare");
  await expect(bare).toHaveCount(2);
  await expect(wheel.locator("pattern#sr-checker")).toHaveCount(1);
  const fills = await bare.evaluateAll((nodes) =>
    nodes.map((n) => getComputedStyle(n).fill),
  );
  for (const fill of fills) expect(fill).toContain("sr-checker");

  const expected = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--app-text-2)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  const labelColor = await wheel
    .locator(".sr-color-A.none")
    .evaluate((el) => getComputedStyle(el).color);
  expect(labelColor).toBe(expected);
});

test("颜色面板关闭后无残留节点", async ({ page }) => {
  await boot(page);
  const wheel = await openWheel(page);
  await wheel.locator('[data-sector="color"]').click();
  await expect(wheel.locator(".sr-sec.sr-color")).toHaveCount(25);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(WHEEL)).toHaveCount(0, { timeout: 3000 });
});
