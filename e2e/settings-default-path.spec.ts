import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function openFilesSection(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.keyboard.press("Meta+,");
  await page.getByTestId("settings-nav-item").nth(2).click();
  await expect(page.getByTestId("default-save-path")).toBeVisible();
}

test("设置默认保存路径并写入配置", async ({ page }) => {
  await openFilesSection(page);
  await expect(page.getByTestId("default-save-path")).toHaveText(/未设置/);

  await page.getByTestId("default-save-pick").click();
  await expect(page.getByTestId("default-save-path")).toHaveText("/Users/test");
  await expect(page.getByTestId("default-save-clear")).toBeEnabled();
});

test("重启后默认路径仍在（load_config 恢复）", async ({ page }) => {
  await openFilesSection(page);
  await page.getByTestId("default-save-pick").click();
  await expect(page.getByTestId("default-save-path")).toHaveText("/Users/test");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.keyboard.press("Meta+,");
  await page.getByTestId("settings-nav-item").nth(2).click();
  await expect(page.getByTestId("default-save-path")).toHaveText("/Users/test");
});

test("清除默认路径回到未设置", async ({ page }) => {
  await openFilesSection(page);
  await page.getByTestId("default-save-pick").click();
  await expect(page.getByTestId("default-save-path")).toHaveText("/Users/test");
  await page.getByTestId("default-save-clear").click();
  await expect(page.getByTestId("default-save-path")).toHaveText(/未设置/);
  await expect(page.getByTestId("default-save-clear")).toBeDisabled();
});

test("未落盘页签 Cmd+S 走另存为：初始目录=默认路径，文件名预填标题", async ({
  page,
}) => {
  await openFilesSection(page);
  await page.getByTestId("default-save-pick").click();
  await expect(page.getByTestId("default-save-path")).toHaveText("/Users/test");

  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/ev544.md", "# 已有文件", "ev544.md");
    win.__biaoyue_store__.getState().newTab();
  });
  await expect(page.locator('[role="tab"]')).toHaveCount(2);

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__lastSaveAs = null;
  });
  await page.keyboard.press("Meta+s");

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as Record<string, any>).__lastSaveAs,
      ),
    )
    .not.toBeNull();
  const saveAs = await page.evaluate(
    () => (window as unknown as Record<string, any>).__lastSaveAs,
  );
  expect(saveAs.defaultDir).toBe("/Users/test");
  expect(saveAs.defaultName).toBe("未命名.md");
  // P-7：新建文档默认仅标题占位 + 自动托管的创建/修改日期，正文为空。
  expect(saveAs.content).toMatch(
    /^---\ntitle: ""\ncreated: \d{4}-\d{2}-\d{2}\nupdated: \d{4}-\d{2}-\d{2}\n---\n$/,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = (window as unknown as Record<string, any>)
          .__biaoyue_store__;
        const state = store.getState();
        return state.tabs[state.activeTabId]?.path ?? "";
      }),
    )
    .toBe("/Users/test/未命名.md");
});
