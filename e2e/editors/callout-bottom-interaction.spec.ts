import { test, expect, type Page } from "@playwright/test";

/**
 * #1691：长文档滚到文末后，末尾高亮块的内容编辑器与 emoji 取色器失效。
 *
 * 根因：`CalloutWidget.index` 是源码序号，而 `view.dom` 里只有当前视口渲染出
 * 的卡片。旧实现用 `querySelectorAll(".cm-callout")[index]` 取卡片，长文档末尾
 * 的序号越界 → 直接 return，两个交互全静默失效。
 *
 * 本文件构造 30 段正文 + 末尾 6 个高亮块（不依赖本机 Desktop 文件），滚到文末
 * 后逐个验证最后 3 张卡片，并断言取色器高度为 200px。
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

const PARAGRAPHS = Array.from(
  { length: 30 },
  (_, i) => `第 ${i + 1} 段正文，用于把高亮块推到视口之外。`,
).join("\n\n");

// 末尾 6 个高亮块：[!NOTE] / [!highlight] 交替，每块 2 行内容。
const CALLOUTS = Array.from({ length: 6 }, (_, i) => {
  const type = i % 2 === 0 ? "NOTE" : "highlight";
  return `> [!${type}] 末尾卡片 ${i + 1}\n> 第一行内容 ${i + 1}\n> 第二行内容 ${i + 1}`;
}).join("\n\n");

const DOC = `${PARAGRAPHS}\n\n${CALLOUTS}\n`;

async function openDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const win = window as unknown as BridgeWindow;
    win.__biaoyue_openFile__("/tmp/callout-bottom.md", body, "doc.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  // 滚到文末：让视口里只剩末尾几张卡片，源码序号与 DOM 序号不再对齐。
  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(300);
}

test("文末高亮块：内容编辑器与 emoji 取色器可用，取色器高度 200px", async ({
  page,
}) => {
  await openDoc(page);
  await page.evaluate(() => localStorage.clear());

  const cards = page.locator(".cm-callout");
  expect(await cards.count()).toBe(6);

  for (let i = 3; i < 6; i += 1) {
    const card = cards.nth(i);
    await expect(card).toBeVisible();

    // 点正文 → 卡片内出现就地编辑器。
    await card.locator(".cm-callout-content").click();
    await expect(
      card.locator('[data-testid="cm-callout-editor"]'),
    ).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(
      card.locator('[data-testid="cm-callout-editor"]'),
    ).toHaveCount(0);

    // 点 emoji → 取色器出现；选一个 emoji 后卡片 data-callout-emoji 变化。
    const before = await card.getAttribute("data-callout-emoji");
    await card.locator(".cm-callout-icon").click();
    const picker = card.locator('[data-testid="cm-callout-emoji-picker"]');
    await expect(picker).toHaveCount(1);

    const body = picker.locator(".cm-callout-emoji-body");
    expect(await body.evaluate((el) => getComputedStyle(el).height)).toBe(
      "200px",
    );

    // 取色器「常用」段首项是 📝，与 [!NOTE] 默认 emoji 相同；选第二项才能
    // 断言变化。
    const option = picker.locator('[data-testid="cm-callout-emoji-option"]').nth(1);
    const picked = await option.getAttribute("data-emoji");
    await option.click();
    await expect(picker).toHaveCount(0);
    expect(await card.getAttribute("data-callout-emoji")).toBe(picked);
  }

  // 「最近」与「动物」两个页签的 body 高度都是 200px。
  const last = cards.nth(5);
  await last.locator(".cm-callout-icon").click();
  const picker = last.locator('[data-testid="cm-callout-emoji-picker"]');
  await expect(picker).toBeVisible();
  const body = picker.locator(".cm-callout-emoji-body");
  expect(await body.evaluate((el) => getComputedStyle(el).height)).toBe(
    "200px",
  );

  const tabs = picker.locator('[data-testid="cm-callout-emoji-tab"]');
  await expect(tabs).toHaveCount(8);
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveClass(/cm-callout-emoji-tab-active/);
  expect(await body.evaluate((el) => getComputedStyle(el).height)).toBe(
    "200px",
  );
});
