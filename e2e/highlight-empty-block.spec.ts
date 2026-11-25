import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const APP_URL = process.env.MENU_APP_URL ?? "http://localhost:1420";
const OUT = ".artifacts/1509";
mkdirSync(OUT, { recursive: true });

const DOC = "> [!highlight]\n> \n";

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (window as unknown as Record<string, any>).__biaoyue_store__;
    const st = s.getState();
    return st.tabs[st.activeTabId]?.content ?? "";
  });
}

async function openDoc(page: Page, body: string, name: string) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ body, name }) => {
      const w = window as unknown as Record<string, any>;
      w.__biaoyue_openFile__(`/tmp/${name}.md`, body, `${name}.md`);
      w.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { body, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

test.describe("空高亮块可输入", () => {
  test("高度 ≥44px 且点击可输入", async ({ page }) => {
    await openDoc(page, DOC, "empty-highlight");
    const block = page.locator(".cm-callout-mark").first();
    await expect(block).toBeVisible();

    const box = (await block.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${OUT}/01-empty-height.png` });

    await block.click({ position: { x: 60, y: box.height / 2 } });
    const editor = page.locator(".cm-callout-editor").first();
    await expect(editor).toBeVisible({ timeout: 3000 });
    await editor.fill("可输入");
    await page.locator('[data-testid="pane-header"]').click();
    await expect
      .poll(() => storeContent(page), { timeout: 4000 })
      .toContain("可输入");
    await page.screenshot({ path: `${OUT}/02-typed.png` });

    const after = (await block.boundingBox())!;
    expect(after.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${OUT}/03-typed-stable.png` });
  });

  test("有内容时高度随内容增长且保持边框圆角", async ({ page }) => {
    await openDoc(page, "> [!highlight]\n> 一行内容\n", "filled-highlight");
    const block = page.locator(".cm-callout-mark").first();
    await expect(block).toBeVisible();
    const styles = await block.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        radius: cs.borderTopLeftRadius,
        border: cs.borderTopWidth,
        height: el.getBoundingClientRect().height,
      };
    });
    expect(styles.border).toBe("1px");
    expect(parseFloat(styles.radius)).toBeGreaterThan(0);
    expect(styles.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${OUT}/04-filled.png` });
  });
});
