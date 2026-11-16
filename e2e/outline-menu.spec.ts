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
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
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

test("大纲按钮：默认透明底方形圆角，钉住后显示强调色背景", async ({ page }) => {
  await openDoc(page, "edit");

  const button = page.locator('[data-testid="outline-btn"]');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("data-pinned", "false");

  const background = () =>
    button.evaluate((el) => getComputedStyle(el).backgroundColor);
  const radius = () =>
    button.evaluate((el) => getComputedStyle(el).borderRadius);

  expect(await background()).toBe("rgba(0, 0, 0, 0)");
  expect(await radius()).toBe("8px");

  await button.click();
  await expect(button).toHaveAttribute("data-pinned", "true");
  await expect.poll(async () => background()).not.toBe("rgba(0, 0, 0, 0)");
});

test("条目去掉前导竖线，改为 H 等级徽标（#925）", async ({ page }) => {
  await openDoc(page, "edit");
  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible();

  // 前导竖线是 .biaoyue-outline-bar DOM 节点；移除后节点数必须为 0。
  expect(await menu.locator(".biaoyue-outline-bar").count()).toBe(0);

  const badges = menu.locator("[data-outline-level]");
  expect(await badges.count()).toBeGreaterThanOrEqual(1);
  await expect(badges.nth(0)).toHaveAttribute("data-outline-level", "H1");
  await expect(badges.nth(1)).toHaveAttribute("data-outline-level", "H2");
  await expect(badges.nth(2)).toHaveAttribute("data-outline-level", "H3");

  // 竖线也不是 CSS 画的：条目自身无左描边、无 ::before 伪元素内容。
  const style = await menu
    .locator('[data-testid="outline-item-0"]')
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      const before = getComputedStyle(el, "::before");
      return { borderLeftWidth: cs.borderLeftWidth, beforeContent: before.content };
    });
  console.log(
    `[925] item borderLeftWidth=${style.borderLeftWidth} ::before content=${style.beforeContent}`,
  );
  expect(style.borderLeftWidth).toBe("0px");
  expect(style.beforeContent).toBe("none");

  await page.screenshot({ path: ".artifacts/925/outline-level-badges.png" });
});

test("拖动条目调整显示顺序并持久化（#925）", async ({ page }) => {
  await openDoc(page, "edit");
  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible();

  const items = menu.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(4);
  const before = await items.allTextContents();
  await expect(items.nth(0)).toHaveText(/第一章/);
  await expect(items.nth(1)).toHaveText(/第一节/);

  const box0 = await items.nth(0).boundingBox();
  const box1 = await items.nth(1).boundingBox();
  if (!box0 || !box1) throw new Error("大纲条目无边界");
  const x = box0.x + box0.width / 2;

  await page.mouse.move(x, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box1.y + box1.height / 2 + 1, { steps: 4 });
  await page.mouse.up();

  await expect(items.nth(0)).toHaveText(/第一节/);
  await expect(items.nth(1)).toHaveText(/第一章/);
  const after = await items.allTextContents();
  expect(after).not.toEqual(before);

  // 拖完不得触发点击跳转：编辑器滚动位置保持不变。
  const scrollTop = await page
    .locator(".cm-scroller")
    .evaluate((el) => el.scrollTop);
  expect(scrollTop).toBe(0);

  const stored = await page.evaluate(
    () => localStorage.getItem("outline-order:/tmp/outline.md"),
  );
  expect(stored).not.toBeNull();
  expect(JSON.parse(stored as string)).toEqual([
    "2:第一节",
    "1:第一章",
    "3:小节 A",
    "2:第二节",
  ]);

  await page.screenshot({ path: ".artifacts/925/outline-drag-reorder.png" });
});
