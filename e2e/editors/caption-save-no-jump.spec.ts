import { test, expect, type Page } from "@playwright/test";
import { makePngDataUrl } from "../helpers/png";

/**
 * #1603 十四轮真机：录入描述保存后画面会「首跳」一下（CM6 重排 + 滚动锚定）。
 * 断言：保存前后视口 scrollTop 不变（±2px）。
 *
 * 已知局限：该跳动在 headless Chromium 上**不可复现**（回退修复此用例照样通过），
 * 只出现在 WKWebView 真机。本用例是**防退化守卫**，真机有效性由手动验收确认。
 */

const PNG = makePngDataUrl(600, 400, [90, 140, 200]);

async function openLongDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript((src: string) => {
    const win = window as unknown as Record<string, any>;
    win.__convertedMediaPaths__ = [];
    win.__TAURI_INTERNALS__.convertFileSrc = (p: string) => {
      win.__convertedMediaPaths__.push(p);
      return src;
    };
  }, PNG);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 30000 });
  const body =
    Array.from({ length: 14 }, (_, i) => `第 ${i} 段正文`).join("\n\n") +
    `\n\n![示例](${PNG})\n\n` +
    Array.from({ length: 20 }, (_, i) => `后 ${i} 段正文`).join("\n\n") +
    "\n";
  await page.evaluate((doc: string) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/capjump/capjump.md", doc, "capjump.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, body);
  await page.locator(".cm-content").waitFor({ timeout: 30000 });
  await page.locator(".cm-image-widget").waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () => {
      const img = document.querySelector(
        ".cm-image-widget img",
      ) as HTMLImageElement | null;
      return !!img && img.complete && img.naturalWidth > 0;
    },
    undefined,
    { timeout: 30000 },
  );
}

test("保存描述后视口不跳（scrollTop 保持不变）", async ({ page }) => {
  await openLongDoc(page);
  // 把图片滚到视口中部
  await page.evaluate(() => {
    const widget = document.querySelector(".cm-image-widget") as HTMLElement;
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    const top =
      widget.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      120;
    scroller.scrollTop = Math.max(0, top);
  });
  await page.waitForTimeout(200);

  await page.locator(".cm-image-widget").click();
  await page.getByTestId("img-toolbar-comment").click();
  await page
    .locator('[data-testid="img-caption-input"]:visible')
    .fill("首跳验证描述");

  const before = await page.evaluate(
    () => (document.querySelector(".cm-scroller") as HTMLElement).scrollTop,
  );
  // 点图片外的正文空白处保存
  const box = (await page.locator(".cm-content").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 80);
  await page.waitForTimeout(400);
  const after = await page.evaluate(
    () => (document.querySelector(".cm-scroller") as HTMLElement).scrollTop,
  );
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
  // 内容确实写回了（不是靠"没保存"通过）
  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as Record<string, any>;
        const s = win.__biaoyue_store__.getState();
        return s.tabs[s.activeTabId]?.content ?? "";
      }),
    )
    .toContain('"首跳验证描述"');
});
