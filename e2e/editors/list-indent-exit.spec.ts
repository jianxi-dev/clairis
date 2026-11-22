import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1350";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = `${ART}/${name}.png`;
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

async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const tab = state.tabs[state.activeTabId];
    return (tab?.content as string) ?? "";
  });
}

async function listCount(page: Page): Promise<number> {
  return page.locator(".cm-line.cm-list").count();
}

test("Tab 逐层缩进：5 次到第 5 层，第 6 次到第 6 层后封顶", async ({
  page,
}) => {
  await openMarkdownInEdit(page, "- 项目", "list-tab-depth");
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");

  for (let i = 0; i < 5; i += 1) await page.keyboard.press("Tab");
  await expect.poll(() => content(page)).toBe("          - 项目");
  await expect(page.locator(".cm-line.cm-list-depth-5")).toHaveCount(1);
  await shot(page, "01-tab-depth5", "tab-depth5");

  await page.keyboard.press("Tab");
  await expect.poll(() => content(page)).toBe("            - 项目");
  await expect(page.locator(".cm-line.cm-list-depth-6")).toHaveCount(1);

  await page.keyboard.press("Tab");
  await expect.poll(() => content(page)).toBe("            - 项目");
  await expect(page.locator(".cm-line.cm-list-depth-6")).toHaveCount(1);
  await shot(page, "02-depth6-cap", "depth6-cap");
});

test("Shift-Tab 列表项退一层", async ({ page }) => {
  await openMarkdownInEdit(page, "    - 子项", "list-shift-tab");
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");

  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => content(page)).toBe("  - 子项");
  await expect(page.locator(".cm-line.cm-list-depth-1")).toHaveCount(1);
  await shot(page, "03-shift-tab-outdent", "outdent");
});

test("非列表行 Shift-Tab 文本严格不变", async ({ page }) => {
  await openMarkdownInEdit(page, "普通段落", "list-plain-shift-tab");
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");
  const before = await content(page);

  await page.keyboard.press("Shift+Tab");
  expect(await content(page)).toBe(before);
  await shot(page, "04-plain-shift-tab", "plain-shift-tab-unchanged");

  await openMarkdownInEdit(page, "", "list-empty-shift-tab");
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("Shift+Tab");
  expect(await content(page)).toBe("");
});

test("有子项的空项回车退一层，列表项数不变", async ({ page }) => {
  await openMarkdownInEdit(page, "- 父\n  - \n    - 孙", "list-empty-child");
  await page.locator(".cm-line").nth(1).click();
  await page.keyboard.press("End");
  const before = await listCount(page);

  await page.keyboard.press("Enter");
  await expect.poll(() => content(page)).toBe("- 父\n- \n    - 孙");
  expect(await listCount(page)).toBe(before);
  await shot(page, "05-empty-child-outdent", "empty-child-outdent");
});

test("无子项的空项回车退出列表，列表项数减 1", async ({ page }) => {
  await openMarkdownInEdit(page, "- 甲\n- \n- 乙", "list-empty-exit");
  await page.locator(".cm-line").nth(1).click();
  await page.keyboard.press("End");
  const before = await listCount(page);

  await page.keyboard.press("Enter");
  await expect.poll(() => content(page)).toBe("- 甲\n\n- 乙");
  expect(await listCount(page)).toBe(before - 1);
  await shot(page, "06-empty-exit-list", "exit-list");
});

test("首层有子项的空项回车退出列表，子项留在原位", async ({ page }) => {
  await openMarkdownInEdit(page, "- \n  - 子", "list-empty-top-child");
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");
  const before = await listCount(page);

  await page.keyboard.press("Enter");
  await expect.poll(() => content(page)).toBe("\n  - 子");
  expect(await listCount(page)).toBe(before - 1);
  await shot(page, "07-top-level-empty-exit", "top-level-empty-exit");
});
