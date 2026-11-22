import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { openMarkdownInEdit } from "../helpers/ui-probe";

const ART = ".artifacts/1351";
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

async function markers(page: Page): Promise<string[]> {
  return page.locator(".cm-list-marker").allTextContents();
}

test("两个有序项之间插入新项：显示与源码都重算为 1、2、3", async ({ page }) => {
  await openMarkdownInEdit(page, "1. 甲\n2. 乙", "list-insert-middle");
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("End");

  await page.keyboard.press("Enter");
  await expect.poll(() => content(page)).toBe("1. 甲\n2. \n3. 乙");
  expect(await markers(page)).toEqual(["1. ", "2. ", "3. "]);
  await shot(page, "01-insert-middle", "insert-middle");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Meta+z");
  await expect.poll(() => content(page)).toBe("1. 甲\n2. 乙");
});

test("删除中间项后剩余项重算，无空态残留", async ({ page }) => {
  await openMarkdownInEdit(page, "1. 甲\n2. 乙\n3. 丙", "list-delete-middle");
  await page.locator(".cm-line").nth(1).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Backspace");

  await expect.poll(() => content(page)).toBe("1. 甲\n2. 丙");
  expect(await markers(page)).toEqual(["1. ", "2. "]);
  await shot(page, "02-delete-middle", "delete-middle");
});

test("缩进一项使其进入子段：两段各自从 1 重排", async ({ page }) => {
  await openMarkdownInEdit(page, "1. 甲\n2. 乙\n3. 丙", "list-indent-split");
  await page.locator(".cm-line").nth(1).click();
  await page.keyboard.press("End");

  await page.keyboard.press("Tab");
  await expect.poll(() => content(page)).toBe("1. 甲\n  1. 乙\n2. 丙");
  expect(await markers(page)).toEqual(["1. ", "1. ", "2. "]);
  await shot(page, "03-indent-split", "indent-split");

  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => content(page)).toBe("1. 甲\n2. 乙\n3. 丙");
  expect(await markers(page)).toEqual(["1. ", "2. ", "3. "]);
});

test("无序/任务项不参与编号、不被改写", async ({ page }) => {
  await openMarkdownInEdit(
    page,
    "- 无序\n1. 甲\n- [ ] 任务\n2. 乙",
    "list-mixed",
  );
  await page.locator(".cm-line").nth(3).click();
  await page.keyboard.press("End");
  await page.keyboard.type("x");

  // 普通键入行数不变，源码字面量留待下一次结构变化同步；显示序号仍按段重算。
  await expect
    .poll(() => content(page))
    .toBe("- 无序\n1. 甲\n- [ ] 任务\n2. 乙x");
  expect(await markers(page)).toEqual(["1. ", "1. "]);
  await shot(page, "04-mixed-list", "mixed-list");
});
