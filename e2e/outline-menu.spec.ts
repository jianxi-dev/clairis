import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 第一章",
  "",
  "开场。",
  "",
  "```md",
  "# 代码里的井号",
  "```",
  "",
  "## 第一节",
  "",
  "正文。",
  "",
  "### 小节 A",
  "",
  ...Array.from({ length: 24 }, (_, i) => `填充段落 ${i + 1}。`).flatMap(
    (line) => [line, ""],
  ),
  "## 第二节",
  "",
  ...Array.from({ length: 24 }, (_, i) => `尾段 ${i + 1}。`).flatMap((line) => [
    line,
    "",
  ]),
].join("\n");

async function openDoc(page: Page, mode: "edit" | "preview") {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
  await page.evaluate(
    ({ body, mode }) => {
      const store = (window as unknown as Record<string, any>)
        .__biaoyue_store__;
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        "/tmp/outline.md",
        body,
        "outline.md",
      );
      store.getState().setEditorMode(mode);
    },
    { body: DOC, mode },
  );
  if (mode === "preview") {
    await page.locator(".preview-content").waitFor({ timeout: 10000 });
  } else {
    await page.locator(".cm-content").waitFor({ timeout: 10000 });
  }
  await page.waitForTimeout(400);
}

test("编辑态大纲按钮：列出真实标题并跳过代码块", async ({ page }) => {
  await openDoc(page, "edit");

  const button = page.locator('[data-testid="outline-btn"]');
  await expect(button).toBeVisible();

  await button.hover();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible({ timeout: 3000 });

  const items = menu.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toHaveText(/第一章/);
  await expect(items.nth(1)).toHaveText(/第一节/);
  await expect(items.nth(2)).toHaveText(/小节 A/);
  await expect(items.nth(3)).toHaveText(/第二节/);
  await expect(menu).not.toContainText("代码里的井号");
});

test("点击大纲项滚动到标题，Esc 收起", async ({ page }) => {
  await openDoc(page, "edit");

  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible();

  await menu.locator('[data-testid="outline-item-3"]').click();

  const scroller = page.locator(".cm-scroller");
  await expect
    .poll(async () => scroller.evaluate((el) => el.scrollTop), {
      timeout: 3000,
    })
    .toBeGreaterThan(0);

  const distance = await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    const line = [...document.querySelectorAll(".cm-line")].find((el) =>
      (el.textContent ?? "").includes("第二节"),
    ) as HTMLElement | undefined;
    if (!line) return Number.POSITIVE_INFINITY;
    return Math.abs(
      line.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
    );
  });
  expect(distance).toBeLessThan(80);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("预览态大纲列出 DOM 标题", async ({ page }) => {
  await openDoc(page, "preview");
  await page.locator(".preview-content").waitFor({ timeout: 10000 });

  await page.locator('[data-testid="outline-btn"]').hover();
  const items = page.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(4, { timeout: 3000 });
  await expect(items.nth(0)).toHaveText(/第一章/);
});

test("切换页签后大纲跟随当前文档", async ({ page }) => {
  await openDoc(page, "edit");

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/other.md",
      "# 另一篇\n\n## 另一节\n",
      "other.md",
    );
  });
  await page.waitForTimeout(400);

  await page.locator('[data-testid="outline-btn"]').hover();
  const items = page.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(2, { timeout: 3000 });
  await expect(items.nth(0)).toHaveText(/另一篇/);
});
