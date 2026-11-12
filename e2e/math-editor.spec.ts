import { expect, test, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 编辑态公式",
  "",
  "行内 $E=mc^2$ 与块级",
  "",
  "$$\\int_0^1 x\\,dx$$",
  "",
  "正文",
].join("\n");

const CURRENCY_DOC = "价格 $5 和 US$6";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 打开 markdown 页签并切到编辑模式，返回编辑器容器。 */
async function openInEdit(page: Page, body: string, name: string) {
  await page.evaluate(
    ({ body, name }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        `/tmp/${name}`,
        body,
        name,
      );
    },
    { body, name },
  );
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  return editor;
}

test("非活跃公式出 KaTeX，光标进入块级显示源码，离开恢复，货币写法不渲染", async ({
  page,
}) => {
  const editor = await openInEdit(page, DOC, "math-editor.md");
  const katex = page.locator(".cm-content .katex");

  // 状态 1：光标停在正文行（公式非活跃），行内与块级各一个 KaTeX。
  await editor.getByText("正文").click();
  await expect(katex).toHaveCount(2);
  await page.screenshot({
    path: ".artifacts/702/01-inline-block-rendered.png",
  });

  // 状态 2：光标进入块级公式 → 块级 widget 撤掉、原始 $$ 源码可见，行内仍渲染。
  await page.locator(".cm-content .katex-display").click();
  await expect(katex).toHaveCount(1);
  await expect(editor).toContainText("$$");
  await page.screenshot({ path: ".artifacts/702/02-cursor-inside-source.png" });

  // 状态 3：光标回到正文行 → 块级恢复渲染，无残留 / 无重复 widget。
  await editor.getByText("正文").click();
  await expect(katex).toHaveCount(2);
  await expect(editor).not.toContainText("$$");
  await page.screenshot({ path: ".artifacts/702/03-cursor-out-restored.png" });
});

test("货币写法 $5 / US$6 不渲染公式", async ({ page }) => {
  const editor = await openInEdit(page, CURRENCY_DOC, "math-currency.md");
  await editor.getByText("价格").click();
  await expect(page.locator(".cm-content .katex")).toHaveCount(0);
  await page.screenshot({ path: ".artifacts/702/04-currency-negative.png" });
});
