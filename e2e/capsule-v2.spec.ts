import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const CAPSULE = '[data-testid="selection-capsule"]';

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/capsule.md",
      "# 标题\n\n正文。",
      "capsule.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
    window.__biaoyue_editor_store__
      .getState()
      .setConfig({ selectionToolbar: "capsule" });
  });
}

async function openCapsule(page: Page) {
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  const capsule = page.locator(CAPSULE);
  await expect(capsule).toBeVisible({ timeout: 3000 });
  return capsule;
}

test("胶囊为单行圆角矩形", async ({ page }) => {
  await boot(page);
  const capsule = await openCapsule(page);
  const row = capsule.locator(".capsule-row-single");
  await expect(row).toHaveCount(1);
  const radius = await row.evaluate((el) => {
    const cs = getComputedStyle(el);
    return parseFloat(cs.borderRadius);
  });
  expect(radius).toBeLessThanOrEqual(12);
});

test("胶囊承载轮盘全量动作且高频在前", async ({ page }) => {
  await boot(page);
  const capsule = await openCapsule(page);
  const actions = capsule.locator(".capsule-btn[data-action]");
  expect(await actions.count()).toBeGreaterThanOrEqual(40);
  await expect(actions.first()).toHaveAttribute("data-action", "format-bold");
});

test("胶囊格式动作可执行", async ({ page }) => {
  await boot(page);
  const capsule = await openCapsule(page);
  await capsule.locator('.capsule-btn[data-action="format-bold"]').click();
  const content = await page.evaluate(() => {
    const s = window.__biaoyue_store__.getState();
    const tab = s.tabs[s.activeTabId];
    return tab ? tab.content : "";
  });
  expect(content).toContain("**");
});

test("证据：胶囊四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  const first = await openCapsule(page);
  await page.screenshot({ path: `${dir}/capsule-open.png` });
  await first.locator('.capsule-btn[data-action="format-bold"]').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/capsule-executed.png` });
  const second = await openCapsule(page);
  await page.screenshot({ path: `${dir}/capsule-reopened.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/capsule-closed.png` });
  void second;
});
