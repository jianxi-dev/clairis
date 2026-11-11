import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 打开一个 markdown 页签、切到编辑模式，光标停在文末正文（块非活跃）。 */
async function openDoc(page: Page, path: string, content: string) {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: path, c: content },
  );
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  return editor;
}

test("高亮块渲染出图标、标题与内容", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-render.md",
    "> [!NOTE] 重要提醒\n> 记得带伞\n\n正文",
  );

  const card = page.locator(".cm-callout").first();
  await expect(card).toBeVisible();
  await expect(card.locator(".cm-callout-icon")).toHaveText("📝");
  await expect(card.locator(".cm-callout-title")).toHaveText("重要提醒");
  await expect(card.locator(".cm-callout-content")).toContainText("记得带伞");
});

test("非活跃高亮块不显示 > [!note] 源标记", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-inactive.md",
    "> [!NOTE] 标题\n> 内容\n\n正文",
  );

  const content = page.locator(".cm-content");
  await expect(content).not.toContainText("> [!NOTE]");
  await expect(content).not.toContainText("[!NOTE]");
  // 卡片内容仍在，只是源码标记被 widget 取代。
  await expect(content).toContainText("标题");
  await expect(content).toContainText("内容");
});

test("点击标题出现行内编辑", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-title.md",
    "> [!NOTE] 旧标题\n> 内容\n\n正文",
  );

  const title = page.locator(".cm-callout-title").first();
  await expect(title).toBeVisible();
  await title.click();

  const input = page.locator('[data-testid="cm-callout-title-editor"]');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("旧标题");
});

test("分栏渲染为多列", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/col-render.md",
    "::: {.col-2}\n左栏内容\n\n右栏内容\n:::\n\n正文",
  );

  const columns = page.locator('[data-testid="cm-columns"]').first();
  await expect(columns).toBeVisible();
  await expect(columns.locator(".cm-column")).toHaveCount(2);
  await expect(columns.locator(".cm-column").first()).toContainText("左栏内容");
  await expect(columns.locator(".cm-column").nth(1)).toContainText("右栏内容");
});

test("高亮块图标与标题间距不超过 2px（#658）", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-gap.md",
    "> [!NOTE] 重要提醒\n> 记得带伞\n\n正文",
  );
  const header = page.locator(".cm-callout-header").first();
  const metrics = await header.evaluate((el) => {
    const icon = el.querySelector(".cm-callout-icon") as HTMLElement;
    const title = el.querySelector(".cm-callout-title") as HTMLElement;
    const ir = icon.getBoundingClientRect();
    const tr = title.getBoundingClientRect();
    return { gap: tr.left - ir.right };
  });
  expect(metrics.gap).toBeLessThanOrEqual(2);
  expect(metrics.gap).toBeGreaterThanOrEqual(0);
});

test("无标题高亮块头部不留空白槽（#658）", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-empty-gap.md",
    "> [!NOTE]\n> 无标题正文\n\n段落",
  );
  const header = page.locator(".cm-callout-header").first();
  const metrics = await header.evaluate((el) => {
    const title = el.querySelector(".cm-callout-title") as HTMLElement;
    return {
      titleWidth: title.getBoundingClientRect().width,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    };
  });
  expect(metrics.titleWidth).toBeLessThan(metrics.fontSize);
});

test("相邻同类型高亮块改图标互不影响（#658）", async ({ page }) => {
  await openDoc(
    page,
    "/Users/test/co-adjacent.md",
    "> [!NOTE] 第一个\n> 甲\n\n> [!NOTE] 第二个\n> 乙\n\n段落",
  );
  const cards = page.locator(".cm-callout");
  await expect(cards).toHaveCount(2);
  const before = await cards.nth(1).getAttribute("data-callout-emoji");

  await cards.nth(0).locator(".cm-callout-icon").click();
  const options = page.locator('[data-testid="cm-callout-emoji-option"]');
  await expect(options.first()).toBeVisible({ timeout: 2000 });
  const count = await options.count();
  for (let i = 0; i < count; i += 1) {
    const emoji = await options.nth(i).getAttribute("data-emoji");
    if (emoji && emoji !== "📝") {
      await options.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(200);
  await expect(cards.nth(0).locator(".cm-callout-icon")).not.toHaveText("📝");
  expect(await cards.nth(1).getAttribute("data-callout-emoji")).toBe(before);
});

test("空标题高亮块点击头部仍可进入标题编辑", async ({ page }) => {
  await openDoc(page, "/Users/test/co-empty.md", "> [!NOTE]\n> 正文\n\n段落");
  const card = page.locator(".cm-callout").first();
  await card
    .locator(".cm-callout-header")
    .click({ position: { x: 60, y: 10 } });
  await expect(
    page.locator('[data-testid="cm-callout-title-editor"]'),
  ).toBeVisible();
});

// QG-5 证据探针（#641）：EVIDENCE_DIR 设置时采集四态截图，平时跳过。
// skip 必须写在测试体内——文件顶层 test.skip 会跳过整文件（含既有回归测试）。
test("evidence: 高亮块四态", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await openDoc(
    page,
    "/Users/test/co-evidence.md",
    "> [!NOTE] 重要提醒\n> 记得带伞\n\n正文",
  );
  const card = page.locator(".cm-callout").first();

  await expect(card).toBeVisible();
  await card.screenshot({ path: `${dir}/callout-edit-gap.png` });

  const icon = card.locator(".cm-callout-icon");
  await icon.hover();
  await expect(icon).toHaveCSS("background-color", "rgba(127, 127, 127, 0.18)");
  await card.screenshot({ path: `${dir}/callout-icon-hover.png` });

  await card.locator(".cm-callout-title").click();
  await expect(
    page.locator('[data-testid="cm-callout-title-editor"]'),
  ).toBeVisible();
  await card.screenshot({ path: `${dir}/callout-title-edit.png` });
  await page.keyboard.press("Escape");

  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "preview")
    await modeBtn.click();
  const previewCallout = page.locator(".preview-content .callout").first();
  await expect(previewCallout).toBeVisible();
  await previewCallout.screenshot({ path: `${dir}/callout-preview-mode.png` });
});
