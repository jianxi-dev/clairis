import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/slots.css",
      "body { color: red; }\n.second { color: blue; }",
      "slots.css",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
}

async function openBar(page: Page) {
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  const bar = page.locator('[data-testid="selection-toolbar"]');
  await expect(bar).toBeVisible({ timeout: 3000 });
  return bar;
}

async function hideBar(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

test("默认工具条 13 个可点控件", async ({ page }) => {
  await boot(page);
  const bar = await openBar(page);
  await expect(bar.locator("[data-action]")).toHaveCount(13);
});

test("配置去掉粗体后少一个按钮", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_editor_store__.getState().setConfig({
      htmlToolbarItems: [
        "ai-rewrite",
        "ai-translate",
        "ai-polish",
        "format-italic",
        "format-underline",
        "format-strike",
        "format-code",
        "format-link",
        "align-left",
        "align-center",
        "align-right",
      ],
    });
  });
  const bar = await openBar(page);
  await expect(bar.locator("[data-action]")).toHaveCount(12);
  await expect(bar.locator('[data-action="format-bold"]')).toHaveCount(0);
});

test("配置顺序决定首个按钮", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_editor_store__
      .getState()
      .setConfig({ htmlToolbarItems: ["format-italic", "align-right"] });
  });
  const bar = await openBar(page);
  await expect(bar.locator("[data-action]").first()).toHaveAttribute(
    "data-action",
    "format-italic",
  );
});

test("未知 id 回落默认 13 个", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__biaoyue_editor_store__
      .getState()
      .setConfig({ htmlToolbarItems: ["bogus"] });
  });
  const bar = await openBar(page);
  await expect(bar.locator("[data-action]")).toHaveCount(13);
});

test("关闭工具条后无残留节点", async ({ page }) => {
  await boot(page);
  await openBar(page);
  await hideBar(page);
  await expect(page.locator('[data-testid="selection-toolbar"]')).toHaveCount(
    0,
  );
});
