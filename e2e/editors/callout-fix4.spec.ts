import { test, expect, type Page } from "@playwright/test";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1725 后续反馈：
 * - 相邻 `> [!TYPE]`（无空行）预览不能摊成一块；
 * - 高亮 emoji 写进首行属性，重开文档仍生效。
 */

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => void;
  __biaoyue_store__: {
    getState: () => {
      tabs: Record<string, { content: string }>;
      activeTabId: string;
      setEditorMode: (mode: string) => void;
    };
  };
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    const state = win.__biaoyue_store__.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function switchToPreview(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_store__.getState().setEditorMode("preview");
  });
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
}

test("H：相邻标注/高亮在预览态逐块渲染，不合并", async ({ page }) => {
  await openMarkdownInEdit(
    page,
    [
      "> [!INFO]{bg=yellow border=yellow}",
      "> 甲",
      "> [!highlight]{bg=red border=red text=contrast}",
      "> 乙一",
      "> 乙二",
      "> [!TIP]{bg=green border=green} 丙",
      "> 丙正文",
    ].join("\n"),
    "callout-fix4-preview",
  );
  await switchToPreview(page);
  const cards = page.locator(".preview-content .callout");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("data-callout", "info");
  await expect(cards.nth(1)).toHaveAttribute("data-callout", "highlight");
  await expect(cards.nth(2)).toHaveAttribute("data-callout", "tip");
  await expect(cards.nth(1)).toContainText("乙一");
  await expect(cards.nth(1)).toContainText("乙二");
  await expect(cards.nth(0)).not.toContainText("[!highlight]");
});

test("I：高亮 emoji 写回首行属性，重开文档仍生效", async ({ page }) => {
  const doc = "> [!highlight]\n> 正文";
  await openMarkdownInEdit(page, doc, "callout-fix4-emoji");

  const icon = page.locator(".cm-callout-icon").first();
  await expect(icon).toBeVisible();
  await icon.click();
  const options = page.locator('[data-testid="cm-callout-emoji-option"]');
  await expect(options.first()).toBeVisible({ timeout: 5000 });
  const count = await options.count();
  let picked = "";
  for (let i = 0; i < count; i += 1) {
    const text = (await options.nth(i).textContent()) ?? "";
    if (text.trim() !== "" && text !== "🖍") {
      picked = text.trim();
      await options.nth(i).click();
      break;
    }
  }
  expect(picked).not.toBe("");
  await expect.poll(() => storeContent(page)).toContain(`emoji=${picked}`);

  // 模拟重启：用新的文件路径重新打开同一段内容，只能靠首行属性恢复 emoji。
  const saved = await storeContent(page);
  await page.evaluate(
    ({ body }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__("/tmp/callout-fix4-reopen.md", body, "reopen.md");
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { body: saved },
  );
  await expect(page.locator(".cm-callout-icon").last()).toHaveText(picked, {
    timeout: 5000,
  });

  await switchToPreview(page);
  await expect(
    page.locator(".preview-content .callout-mark-icon").last(),
  ).toHaveText(picked, { timeout: 5000 });
});
