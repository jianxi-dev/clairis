import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hoverLineLeft, openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1389";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const MOD = process.platform === "darwin" ? "Meta" : "Control";

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        file,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

/**
 * 1.2 层级联动转换 + 列表外套高亮。
 *
 * 行手柄触发转换走子树语义：上级行联同下级一起转换（2 级按自身层级编号规则
 * 排号），末级行只转当前行（兄弟与上级零变化）；列表转高亮在外套 callout、
 * 列表标记保留。一次转换一个 undo 步。
 */

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.content ?? "";
  });
}

async function openLineMenu(page: Page, lineIndex: number): Promise<void> {
  await hoverLineLeft(page, page.locator(".cm-line").nth(lineIndex));
  const handle = page.locator(
    ".cm-block-handle[data-line-from].cm-block-handle-visible",
  );
  await expect(handle).toHaveCount(1, { timeout: 3000 });
  await handle.hover();
  await expect(page.locator('[data-testid="block-menu"]')).toBeVisible({
    timeout: 3000,
  });
}

async function clickCell(page: Page, target: string): Promise<void> {
  await page
    .locator(`[data-testid="block-menu-cell"][data-target="${target}"]`)
    .click();
}

async function undoOnce(page: Page): Promise<void> {
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${MOD}+z`);
}

test("上级行转为有序：1 级与 2 级都变、2 级从 1 起连续，一步撤销还原", async ({
  page,
}) => {
  const doc = ["- 甲", "  - 甲一", "  - 甲二", "- 乙"].join("\n");
  await openMarkdownInEdit(page, doc, "line-convert-parent");
  await openLineMenu(page, 0);
  await clickCell(page, "ordered");

  const converted = ["1. 甲", "  1. 甲一", "  2. 甲二", "- 乙"].join("\n");
  await expect.poll(() => content(page)).toBe(converted);
  await shot(page, "01-parent-subtree-linked", "parent-subtree-linked");

  await undoOnce(page);
  await expect.poll(() => content(page)).toBe(doc);
});

test("末级行转为有序：只转当前行，兄弟与上级零变化，一步撤销还原", async ({
  page,
}) => {
  const doc = ["- 甲", "  - 甲一", "  - 甲二", "- 乙"].join("\n");
  await openMarkdownInEdit(page, doc, "line-convert-leaf");
  await openLineMenu(page, 1);
  await clickCell(page, "ordered");

  const converted = ["- 甲", "  1. 甲一", "  - 甲二", "- 乙"].join("\n");
  await expect.poll(() => content(page)).toBe(converted);
  await shot(page, "02-leaf-line-only", "leaf-line-only");

  await undoOnce(page);
  await expect.poll(() => content(page)).toBe(doc);
});

test("列表转为标注：外套 [!note]、列表标记与缩进保留，一步撤销还原", async ({
  page,
}) => {
  const doc = ["- 甲", "  - 甲一", "- 乙"].join("\n");
  await openMarkdownInEdit(page, doc, "line-convert-callout");
  await openLineMenu(page, 0);
  await page
    .locator('[data-testid="block-menu-cell"][data-target="callout"][data-has-children="true"]')
    .click();
  await page.locator('[data-testid="block-menu-convert-option"]').first().click();

  const converted = ["> [!NOTE]", "> - 甲", ">   - 甲一", "> - 乙"].join("\n");
  await expect.poll(() => content(page)).toBe(converted);
  await shot(
    page,
    "03-list-wrap-callout-keep-marker",
    "list-wrap-callout-keep-marker",
  );

  await undoOnce(page);
  await expect.poll(() => content(page)).toBe(doc);
  await shot(page, "04-one-undo-step-restore", "one-undo-step-restore");
});
