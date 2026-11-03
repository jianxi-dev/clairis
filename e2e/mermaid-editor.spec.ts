import { expect, test, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 编辑态图表",
  "",
  "```mermaid",
  "flowchart LR",
  "  开始 --> 结束",
  "```",
  "",
  "正文",
].join("\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
});

/** 打开 markdown 页签并切到编辑模式，光标停在文末正文行（mermaid 块非活跃）。
 *  用点击正文而不是 Control+End：macOS Chromium 没有把 Ctrl+End 绑到「跳到
 *  文档末」，CM6 默认键表也没有它，按下是空操作。 */
async function openInEdit(page: Page) {
  await page.evaluate((body) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/mermaid-editor.md",
      body,
      "mermaid-editor.md",
    );
  }, DOC);
  await page.locator("button").filter({ hasText: "编辑" }).first().click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.getByText("正文").click();
  return editor;
}

/** 切根节点 class：主题在应用里就是 `html.dark` 的作用域。 */
async function enableDark(page: Page) {
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(page.locator("html")).toHaveClass(/dark/);
}

test("非活跃 mermaid 块出图，光标进入显示围栏，离开恢复出图", async ({
  page,
}) => {
  const editor = await openInEdit(page);
  const block = page.locator(".cm-mermaid-block");
  await expect(block.locator(".mermaid-view svg")).toBeVisible();
  await expect(editor).not.toContainText("```mermaid");

  // 进入块：widget 撤掉，原始围栏源码可见
  await block.click();
  await expect(page.locator(".cm-mermaid-block")).toHaveCount(0);
  await expect(editor).toContainText("```mermaid");

  // 离开：光标点到文末正文行，块恢复出图
  await editor.getByText("正文").click();
  await expect(
    page.locator(".cm-mermaid-block .mermaid-view svg"),
  ).toBeVisible();
  await expect(editor).not.toContainText("```mermaid");
});

test("深色切换：--pele-fg 跟随 CSS 变量，svg 节点不被替换", async ({
  page,
}) => {
  await openInEdit(page);
  const view = page.locator(".cm-mermaid-block .mermaid-view");
  await expect(view.locator("svg")).toBeVisible();

  // 打标记属性作为稳定身份：主题切换后标记还在，说明是同一个 <svg>
  await view
    .locator("svg")
    .evaluate((el) => el.setAttribute("data-identity", "pele-editor-svg"));
  const before = await view.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--pele-fg").trim(),
  );

  await enableDark(page);

  const after = await view.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--pele-fg").trim(),
  );
  expect(before).not.toBe("");
  expect(after).not.toBe("");
  expect(after).not.toBe(before);

  await expect(
    view.locator("svg[data-identity='pele-editor-svg']"),
  ).toBeVisible();
  await expect(view.locator("svg")).toHaveCount(1);
});

test("反复进出同一块：图表容器只有一个，svg 不叠加", async ({ page }) => {
  await openInEdit(page);
  const editor = page.locator(".cm-content");
  const block = page.locator(".cm-mermaid-block");
  for (let i = 0; i < 3; i += 1) {
    await block.click();
    await expect(page.locator(".cm-mermaid-block")).toHaveCount(0);
    await editor.getByText("正文").click();
    await expect(page.locator(".cm-mermaid-block .mermaid-view")).toHaveCount(
      1,
    );
  }
  await expect(page.locator(".cm-mermaid-block .mermaid-view svg")).toHaveCount(
    1,
  );
});
