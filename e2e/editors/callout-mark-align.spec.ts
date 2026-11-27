import { test, expect, type Page } from "@playwright/test";

/**
 * #1655 ticket 1.2：编辑态纯高亮（`> [!highlight]`）emoji 与正文同行悬挂对齐。
 *
 * - emoji 独占第 1 列，正文占第 2 列；正文换行后左缘仍在第 2 列（悬挂缩进）。
 * - emoji 顶缘与正文首行顶缘差 ≤2px。
 * - 空块仍显示 emoji 且卡片高度 ≥44px。
 */

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (mode: string) => void } };
}

const DOC = [
  "> [!highlight]",
  "> 第一行文字第一行文字第一行文字",
  "> 第二行文字第二行文字",
  "",
  "> [!highlight]",
  "",
].join("\n");

async function openDoc(page: Page, body: string, name: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ b, n }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__(`/tmp/${n}.md`, b, `${n}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { b: body, n: name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

interface MarkGeometry {
  display: string;
  iconTop: number;
  firstLineTop: number;
  iconRight: number;
  firstLineLeft: number;
  secondLineLeft: number;
  height: number;
}

function readGeometry(page: Page, card: ReturnType<Page["locator"]>): Promise<MarkGeometry> {
  return card.evaluate((el) => {
    const icon = el.querySelector<HTMLElement>(".cm-callout-icon");
    const lines = el.querySelectorAll<HTMLElement>(".cm-callout-content .cm-callout-line");
    const first = lines[0];
    const second = lines[1];
    const cardRect = el.getBoundingClientRect();
    const iconRect = icon ? icon.getBoundingClientRect() : null;
    const firstRect = first ? first.getBoundingClientRect() : null;
    const secondRect = second ? second.getBoundingClientRect() : null;
    return {
      display: getComputedStyle(el).display,
      iconTop: iconRect ? iconRect.top : NaN,
      firstLineTop: firstRect ? firstRect.top : NaN,
      iconRight: iconRect ? iconRect.right : NaN,
      firstLineLeft: firstRect ? firstRect.left : NaN,
      secondLineLeft: secondRect ? secondRect.left : NaN,
      height: cardRect.height,
    };
  });
}

test("编辑态纯高亮：emoji 与正文首行同行、换行悬挂对齐", async ({ page }) => {
  await openDoc(page, DOC, "mark-align");

  const card = page.locator(".cm-callout.cm-callout-mark").first();
  await expect(card).toBeVisible();

  const geo = await readGeometry(page, card);
  expect(geo.display).toBe("grid");
  expect(Math.abs(geo.iconTop - geo.firstLineTop)).toBeLessThanOrEqual(2);
  expect(geo.iconRight).toBeLessThan(geo.firstLineLeft);
  expect(Math.abs(geo.secondLineLeft - geo.firstLineLeft)).toBeLessThanOrEqual(1);
  expect(geo.height).toBeGreaterThanOrEqual(44);
});

test("空纯高亮块仍显示 emoji 且高度 ≥44px", async ({ page }) => {
  await openDoc(page, DOC, "mark-align-empty");

  const cards = page.locator(".cm-callout.cm-callout-mark");
  await expect(cards).toHaveCount(2);
  const empty = cards.nth(1);

  await expect(empty.locator(".cm-callout-icon")).toBeVisible();
  const height = await empty.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  expect(height).toBeGreaterThanOrEqual(44);
});
