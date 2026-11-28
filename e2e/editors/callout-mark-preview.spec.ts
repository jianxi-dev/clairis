import { test, expect, type Page } from "@playwright/test";

/**
 * #1653 ticket 1.1：阅读态纯高亮与编辑态同貌。
 *
 * - `> [!highlight]`：四边 1px 细边、4px 圆角、强荧光底；emoji 内联在
 *   正文首行前，换行缩进对齐到文字（悬挂缩进）；不印「纯高亮」。
 * - `> [!NOTE]`（空标题）：不补默认名「注释」，只留空标题槽（图标由 per-type
 *   ::before glyph 提供）。
 */

interface BridgeState {
  setEditorMode: (mode: string) => void;
}

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => BridgeState };
}

const DOC = [
  "> [!highlight]",
  "> 第一行文字",
  "> 第二行文字",
  "",
  "> [!NOTE]",
  "> 正文",
  "",
].join("\n");

async function openDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/callout-mark-preview.md", body, "doc.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function switchToPreview(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

test("阅读态纯高亮：四边 1px / 4px 圆角 / emoji 内联", async ({
  page,
}) => {
  await openDoc(page);
  await switchToPreview(page);

  const mark = page.locator(".preview-content .callout.callout-mark").first();
  await expect(mark).toBeVisible();

  const styles = await mark.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      left: cs.borderInlineStartWidth,
      top: cs.borderTopWidth,
      right: cs.borderInlineEndWidth,
      bottom: cs.borderBottomWidth,
      radius: cs.borderRadius,
    };
  });
  expect(styles.left).toBe("1px");
  expect(styles.top).toBe("1px");
  expect(styles.right).toBe("1px");
  expect(styles.bottom).toBe("1px");
  expect(styles.radius).toBe("4px");

  // 纯高亮四边都有 1px 边、不建标题槽、不印「纯高亮」。
  await expect(mark.locator(".callout-title")).toHaveCount(0);
  await expect(mark).not.toContainText("纯高亮");

  // emoji 内联在正文首行前。
  const icon = mark.locator(".callout-mark-icon").first();
  await expect(icon).toBeVisible();
  await expect(icon).toHaveText("🖍️");

  // 悬挂缩进：emoji 与正文同属 grid，正文左缘在 emoji 右缘之后。
  const geometry = await mark.evaluate((el) => {
    const iconEl = el.querySelector<HTMLElement>(".callout-mark-icon");
    const bodyEl = el.querySelector<HTMLElement>(".callout-mark-body");
    if (!iconEl || !bodyEl) return null;
    const iconRect = iconEl.getBoundingClientRect();
    const bodyRect = bodyEl.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      iconRight: iconRect.right,
      bodyLeft: bodyRect.left,
      sameParent: iconEl.parentElement === bodyEl.parentElement,
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.display).toBe("grid");
  expect(geometry!.sameParent).toBe(true);
  expect(geometry!.bodyLeft).toBeGreaterThan(geometry!.iconRight);
});

test("空标题标注块不补默认名，只留空标题槽", async ({ page }) => {
  await openDoc(page);
  await switchToPreview(page);

  const note = page
    .locator('.preview-content .callout[data-callout="note"]')
    .first();
  await expect(note).toBeVisible();
  const title = note.locator(".callout-title").first();
  await expect(title).toBeVisible();
  expect((await title.textContent()) ?? "").toBe("");
  await expect(note).not.toContainText("注释");
  await expect(page.locator(".preview-content")).not.toContainText("注释");
});

test("编辑态改过的 emoji 在预览态可见，恢复默认后回到 🖍️", async ({
  page,
}) => {
  await openDoc(page);

  const card = page.locator(".cm-callout").first();
  await expect(card).toHaveAttribute("data-callout-emoji", "🖍️");

  await card.locator(".cm-callout-icon").click();
  const options = page.locator('[data-testid="cm-callout-emoji-option"]');
  await expect(options.first()).toBeVisible({ timeout: 2000 });
  const count = await options.count();
  let picked = "";
  for (let i = 0; i < count; i += 1) {
    const emoji = await options.nth(i).getAttribute("data-emoji");
    if (emoji && emoji !== "🖍️") {
      picked = emoji;
      await options.nth(i).click();
      break;
    }
  }
  expect(picked).not.toBe("");
  await expect(card).toHaveAttribute("data-callout-emoji", picked);

  await switchToPreview(page);
  const mark = page.locator(".preview-content .callout-mark").first();
  await expect(mark.locator(".callout-mark-icon")).toHaveText(picked);
  await expect(mark).toHaveAttribute("data-callout-emoji", picked);

  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });

  const cardAgain = page.locator(".cm-callout").first();
  await cardAgain.locator(".cm-callout-icon").click();
  await page
    .locator('[data-testid="cm-callout-emoji-reset"]')
    .click({ timeout: 2000 });

  await switchToPreview(page);
  const markAfter = page.locator(".preview-content .callout-mark").first();
  await expect(markAfter.locator(".callout-mark-icon")).toHaveText("🖍️");
  await expect(
    page.locator(".preview-content .callout-mark .callout-title"),
  ).toHaveCount(0);
});
