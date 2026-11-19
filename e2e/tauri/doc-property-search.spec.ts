import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = `---
title: 集成走查
tags:
  - 甲
count: 1234567
---

# 正文

属性面板与搜索浮窗同在。

属性面板可以配置。
`;

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openDoc(page: Page): Promise<void> {
  await page.evaluate(
    (args) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
        }
      ).__biaoyue_openFile__(args.path, args.content, "集成走查.md");
    },
    { path: "/Users/test/集成走查.md", content: DOC },
  );
}

async function setMode(page: Page, mode: "preview" | "edit" | "source") {
  await page.evaluate((m) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setEditorMode: (m: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setEditorMode(m as "preview" | "edit" | "source");
  }, mode);
}

test.beforeEach(async ({ page }) => {
  await boot(page);
  await openDoc(page);
  await setMode(page, "edit");
});

test("属性面板：编辑态渲染字段行，⌘⇧Y 隐藏并恢复", async ({ page }) => {
  const a = page.locator('[data-testid="dpb-a"]');
  await expect(a).toBeVisible();
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(2);

  await page.keyboard.press("Meta+Shift+Y");
  await expect(a).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-hidden-note"]')).toBeVisible();

  await page.keyboard.press("Meta+Shift+Y");
  await expect(a).toBeVisible();
});

test("搜索浮窗：⌘F 打开、输入命中、⌘2 直达、Esc 关闭", async ({ page }) => {
  await page.keyboard.press("Meta+f");
  const float = page.locator('[data-testid="search-float"]');
  await expect(float).toBeVisible();

  const input = page.locator('[data-testid="search-float-input"]');
  await expect(input).toBeFocused();
  await input.fill("属性");

  const rows = page.locator('[data-testid="search-float-hit"]');
  await expect(rows).toHaveCount(2);

  await page.keyboard.press("Meta+2");
  const selectedKey = rows.nth(1).locator(".search-float-key");
  await expect(selectedKey).toHaveText("↵");
  await expect(selectedKey).toHaveAttribute("aria-label", "回车");
  await expect(rows.nth(0).locator(".search-float-key")).toHaveText("⌘1");

  await page.keyboard.press("Escape");
  await expect(float).toBeHidden();
});
