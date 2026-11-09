import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 第一章",
  "",
  "开场白。",
  "",
  "## 第一节",
  "",
  "正文一。",
  "",
  "### 小节 A",
  "",
  "小节内容。",
  "",
  "## 第二节",
  "",
  "正文二。",
  "",
  "# 无下级标题",
  "",
].join("\n");

async function openDoc(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/fold.md",
      body,
      "fold.md",
    );
    store.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
}

test("有下级的标题渲染折叠三角，无下级的标题不渲染", async ({ page }) => {
  await openDoc(page);

  await expect(page.locator(".cm-fold-toggle")).toHaveCount(4);
  await expect(page.locator('[data-fold-line="1"]')).toHaveCount(1);
  await expect(page.locator('[data-fold-line="5"]')).toHaveCount(1);
  await expect(page.locator('[data-fold-line="9"]')).toHaveCount(1);
  await expect(page.locator('[data-fold-line="13"]')).toHaveCount(1);
  await expect(page.locator('[data-fold-line="17"]')).toHaveCount(0);
});

test("点击三角折叠隐藏下级内容，再点展开", async ({ page }) => {
  await openDoc(page);

  const toggle = page.locator('[data-fold-line="1"]');
  await expect(toggle).toHaveAttribute("data-folded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("data-folded", "true");

  // 标题到下一同级标题（# 无下级标题）之间的内容全部隐藏。
  await expect(page.locator(".cm-line", { hasText: "开场白。" })).toHaveCount(
    0,
  );
  await expect(page.locator(".cm-line", { hasText: "第一节" })).toHaveCount(0);
  await expect(page.locator(".cm-line", { hasText: "小节内容。" })).toHaveCount(
    0,
  );
  await expect(page.locator(".cm-line", { hasText: "正文二。" })).toHaveCount(
    0,
  );
  // 下一同级标题本身仍可见。
  await expect(page.locator(".cm-line", { hasText: "无下级标题" })).toHaveCount(
    1,
  );

  // 光标移到别处触发装饰重建，折叠态保持。
  await page.keyboard.press("End");
  await expect(page.locator(".cm-line", { hasText: "开场白。" })).toHaveCount(
    0,
  );

  // 再点展开，内容回到文档里。
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-folded", "false");
  await expect(page.locator(".cm-line", { hasText: "开场白。" })).toHaveCount(
    1,
  );
  await expect(page.locator(".cm-line", { hasText: "正文二。" })).toHaveCount(
    1,
  );
});

test("折叠子章节只隐藏到下一个同级或更高级标题", async ({ page }) => {
  await openDoc(page);

  await page.locator('[data-fold-line="5"]').click();
  await expect(page.locator('[data-fold-line="5"]')).toHaveAttribute(
    "data-folded",
    "true",
  );

  // ## 第一节 到 ## 第二节 之间（含 ### 小节 A）隐藏。
  await expect(page.locator(".cm-line", { hasText: "正文一。" })).toHaveCount(
    0,
  );
  await expect(page.locator(".cm-line", { hasText: "小节 A" })).toHaveCount(0);
  // ## 第二节 及其内容仍可见。
  await expect(page.locator(".cm-line", { hasText: "第二节" })).toHaveCount(1);
  await expect(page.locator(".cm-line", { hasText: "正文二。" })).toHaveCount(
    1,
  );
});

test("切换页签后折叠态清空，不误折叠新文档", async ({ page }) => {
  await openDoc(page);

  await page.locator('[data-fold-line="1"]').click();
  await expect(page.locator('[data-fold-line="1"]')).toHaveAttribute(
    "data-folded",
    "true",
  );

  await page.evaluate((body) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/fold-other.md",
      body,
      "fold-other.md",
    );
    // 新页签默认预览态；切到编辑态触发内容同步（整篇替换），折叠态应清空。
    store.getState().setEditorMode("edit");
  }, "# 另一篇\n\n另一篇内容。\n\n## 另一节\n\n另一节内容。");
  await page.waitForTimeout(500);

  await expect(page.locator('[data-fold-line="1"]')).toHaveAttribute(
    "data-folded",
    "false",
  );
  await expect(
    page.locator(".cm-line", { hasText: "另一篇内容。" }),
  ).toHaveCount(1);
});

test("折叠三角 20px、默认隐藏、左侧 25% 召唤区显示", async ({ page }) => {
  await openDoc(page);

  const toggle = page.locator('[data-fold-line="1"]');
  const box = await toggle.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBe(20);
  expect(Math.round(box!.height)).toBe(20);

  // 指针在正文右侧 75%：三角不可见
  await page.mouse.move(900, 300);
  await page.waitForTimeout(200);
  expect(await toggle.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");

  // 指针进入 .cm-content 左缘 25%：三角可见
  const content = await page.locator(".cm-content").boundingBox();
  expect(content).not.toBeNull();
  const lineBox = await page.locator(".cm-line").first().boundingBox();
  const summonX = (lineBox?.x ?? content!.x) + 8;
  const summonY = (lineBox?.y ?? box!.y) + (lineBox?.height ?? 20) / 2;
  await page.mouse.move(summonX, summonY);
  await page.waitForTimeout(300);
  expect(await toggle.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  // 只显示指针所在行：把指针移到第二个标题行，第一个标题的三角应隐藏
  const second = page.locator('[data-fold-line="5"]');
  const secondBox = await second.boundingBox();
  if (secondBox) {
    await page.mouse.move(secondBox.x + 4, secondBox.y + secondBox.height / 2);
    await page.waitForTimeout(200);
    expect(await toggle.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "0",
    );
  }
});

test("四个相邻标题全部折叠后仍各占一行", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__(
      "/tmp/fold-adjacent.md",
      "# A\na content\n# B\nb content\n# C\nc content\n# D\nd content",
      "fold-adjacent.md",
    );
    w.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);

  for (const line of [1, 3, 5, 7]) {
    await page.locator(`[data-fold-line="${line}"]`).click();
    await page.waitForTimeout(120);
  }

  const headingLines = page.locator(".cm-line", {
    hasText: /^#? ?[ABCD]$/,
  });
  await expect(headingLines).toHaveCount(4);
  const texts = await page.locator(".cm-line").allInnerTexts();
  expect(texts.join("\n")).not.toContain("# A# B");
});

test("预览态标题折叠：按钮显隐与点击隐藏后续内容", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/fold-preview.md", body, "fold-preview.md");
    win.__biaoyue_store__.getState().setEditorMode("preview");
  }, DOC);
  await page.locator(".preview-content").waitFor({ timeout: 10000 });

  const folds = page.locator(".preview-heading-fold");
  await expect(folds.first()).toBeVisible();
  expect(await folds.count()).toBeGreaterThanOrEqual(2);

  const first = page
    .locator(".preview-heading", { hasText: "第一章" })
    .locator(".preview-heading-fold");
  await first.click();
  await expect(first).toHaveAttribute("data-folded", "true");
  await expect(
    page.locator(".preview-content p", { hasText: "开场白" }),
  ).toBeHidden();
  await expect(
    page.locator(".preview-content h2", { hasText: "第一节" }),
  ).toBeHidden();
  // 同级标题「无下级标题」不能被一起折叠
  await expect(
    page.locator(".preview-content h1", { hasText: "无下级标题" }),
  ).toBeVisible();

  await first.click();
  await expect(
    page.locator(".preview-content p", { hasText: "开场白" }),
  ).toBeVisible();
});
