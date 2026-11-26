import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1516";
mkdirSync(OUT, { recursive: true });

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: {
    getState: () => { setEditorMode: (m: string) => void };
  };
}

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(() => {
    const w = window as unknown as BW;
    w.__biaoyue_openFile__("/tmp/source/source.md", "# 标题\n\n正文\n", "source.md");
    w.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openMenu(page: Page) {
  await page.locator('[data-testid="pane-menu-button"]').click();
  await expect(page.locator('[data-testid="pane-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

test("源码模式：选中显示对勾与 aria-pressed，再点取消", async ({ page }) => {
  await setup(page);
  await openMenu(page);
  await page.screenshot({ path: `${OUT}/01-menu-before.png` });

  const item = page.locator('[data-menu-item="source"]');
  await expect(item).toHaveAttribute("aria-pressed", "false");
  await item.click();
  await expect(page.locator('[data-testid="pane-menu"]')).toBeHidden();

  await openMenu(page);
  const item2 = page.locator('[data-menu-item="source"]');
  await expect(item2).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-testid="pane-menu-source-check"]')).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-source-pressed.png` });

  await item2.click();
  await expect(page.locator('[data-testid="pane-menu"]')).toBeHidden();
  await openMenu(page);
  await expect(page.locator('[data-menu-item="source"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator('[data-testid="pane-menu-source-check"]')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/03-cancelled.png` });

  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${OUT}/04-closed.png` });
});
