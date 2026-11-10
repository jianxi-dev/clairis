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

test("证据：四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  await openBar(page);
  await page.screenshot({ path: `${dir}/default-13.png` });
  await page.keyboard.press("Escape");

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
  await openBar(page);
  await page.screenshot({ path: `${dir}/removed-bold-12.png` });
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    window.__biaoyue_editor_store__
      .getState()
      .setConfig({ htmlToolbarItems: ["format-italic", "align-right"] });
  });
  await openBar(page);
  await page.screenshot({ path: `${dir}/reordered.png` });
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    window.__biaoyue_editor_store__
      .getState()
      .setConfig({ htmlToolbarItems: ["bogus"] });
  });
  await openBar(page);
  await page.screenshot({ path: `${dir}/unknown-fallback-13.png` });
});

async function openSettingsEditor(page: Page) {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
}

async function closeSettings(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0, {
    timeout: 3000,
  });
}

test("设置取消勾选粗体后工具条为 12 个动作", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page
    .locator('[data-testid="toolbar-item-toggle-format-bold"]')
    .uncheck();
  await page.waitForTimeout(300);
  await closeSettings(page);
  const bar = await openBar(page);
  await expect(bar.locator("[data-action]")).toHaveCount(12);
});

test("设置上移一项改变工具条顺序", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page.locator('[data-testid="toolbar-item-up-format-italic"]').click();
  await page.waitForTimeout(300);
  await closeSettings(page);
  const bar = await openBar(page);
  const order = await bar
    .locator("[data-action]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
  expect(order.indexOf("format-italic")).toBeLessThan(
    order.indexOf("format-bold"),
  );
});

test("设置恢复默认后回到 13 个可点控件", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page
    .locator('[data-testid="toolbar-item-toggle-format-bold"]')
    .uncheck();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="toolbar-item-reset"]').click();
  await page.waitForTimeout(300);
  await closeSettings(page);
  const bar = await openBar(page);
  await expect(bar.locator("[data-action]")).toHaveCount(13);
});

test("取消勾选后重启仍保持", async ({ page }) => {
  await boot(page);
  await openSettingsEditor(page);
  await page
    .locator('[data-testid="toolbar-item-toggle-format-bold"]')
    .uncheck();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/slots2.css",
      "body { color: red; }\n.second { color: blue; }",
      "slots2.css",
    );
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(300);
  const bar = await openBar(page);
  await expect(bar.locator("[data-action]")).toHaveCount(12);
});

test("证据：设置四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  await openSettingsEditor(page);
  await page.screenshot({ path: `${dir}/settings-default.png` });
  await page
    .locator('[data-testid="toolbar-item-toggle-format-bold"]')
    .uncheck();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/settings-unchecked-bold.png` });
  await closeSettings(page);
  await openBar(page);
  await page.screenshot({ path: `${dir}/bar-12.png` });
  await page.keyboard.press("Escape");
  await openSettingsEditor(page);
  await page.locator('[data-testid="toolbar-item-up-format-italic"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/settings-reordered.png` });
  await page.locator('[data-testid="toolbar-item-reset"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/settings-reset.png` });
});
