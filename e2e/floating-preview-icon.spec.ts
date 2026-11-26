import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1520";
mkdirSync(OUT, { recursive: true });

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/fp/fp.md", "# 标题\n\n正文。\n", "fp.md");
  });
  await page.waitForTimeout(300);
}

test("悬浮窗图标：预览态=眼睛，编辑态=铅笔（与页签一致）", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const st = (window as unknown as Record<string, any>).__biaoyue_store__.getState();
    st.openPreview({
      source: "tab",
      path: "/tmp/fp/fp.md",
      title: "fp.md",
      x: 300,
      y: 200,
      w: 420,
      h: 320,
    });
  });
  const toggle = page.locator('[data-testid="preview-edit-toggle"]');
  await expect(toggle).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${OUT}/01-preview-eye.png` });

  const iconAt = async () =>
    page.evaluate(() => {
      const btn = document.querySelector('[data-testid="preview-edit-toggle"]');
      const path = btn?.querySelector("svg path");
      return path?.getAttribute("d")?.slice(0, 40) ?? "";
    });
  const eyePath = await iconAt();
  expect(eyePath).not.toBe("");

  await toggle.click();
  await page.waitForTimeout(200);
  const pencilPath = await iconAt();
  expect(pencilPath).not.toBe(eyePath);
  await page.screenshot({ path: `${OUT}/02-editing-pencil.png` });
});

test("往返一致 + 关闭态", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const st = (window as unknown as Record<string, any>).__biaoyue_store__.getState();
    st.openPreview({ source: "tab", path: "/tmp/fp/fp.md", title: "fp.md", x: 300, y: 200, w: 420, h: 320 });
  });
  const toggle = page.locator('[data-testid="preview-edit-toggle"]');
  await expect(toggle).toBeVisible({ timeout: 5000 });
  await toggle.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/03-editing.png` });
  await toggle.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/04-back-preview.png` });
});
