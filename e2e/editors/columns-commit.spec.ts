import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

/**
 * #1352（change=editor-interaction-batch2/8.1）分栏内容匹配 + 冻结重建验收。
 *
 * 1. offset-shift-save：编辑期间前方插入新块使偏移改变，切走焦点后内容落回正确单元格且出现提示
 * 2. fallback-toast：内容匹配失败时 textarea 文本回填宿主、恰好一条可见 toast、源码不写
 * 3. single-editor：编辑期间位移后重复点击同一单元格，输入窗口节点数严格为 1
 * 4. esc-cancel：Esc 取消后无残留编辑器、源码逐字节不变
 */

const APP_URL = "http://localhost:1424";
const ART = ".artifacts/1352";
const EVIDENCE = "scripts/cw-evidence.sh";

const SOURCE = "::: {.col-2}\n\n左\n\n右\n\n:::\n\n正文";

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

async function shot(page: Page, name: string): Promise<void> {
  const file = `${ART}/${name}.png`;
  await page.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART,
      "--state",
      name,
      "--screenshot",
      file,
      "--assertion",
      "passed",
    ],
    { stdio: "ignore" },
  );
}

async function openColumnsDoc(page: Page): Promise<void> {
  await page.evaluate((c) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/columns-commit.md",
      c,
      "columns-commit.md",
    );
  }, SOURCE);
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
}

async function getSource(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return s.tabs[s.activeTabId]?.content as string;
  });
}

/** 编辑期间改文档（经页签内容同步进 CM6），等待新文本进入编辑器。 */
async function replaceDoc(
  page: Page,
  next: string,
  marker: string,
): Promise<void> {
  await page.evaluate((c) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    store.getState().updateContent(c);
  }, next);
  await page.waitForFunction(
    (text) =>
      (document.querySelector(".cm-content")?.textContent ?? "").includes(text),
    marker,
  );
}

async function blurEditor(page: Page): Promise<void> {
  await page
    .locator('[data-testid="cm-column-editor"]')
    .evaluate((el) => el.blur());
}

/** 等待页签源码包含子串（编辑器回写存储是异步的）。 */
async function waitForSource(page: Page, needle: string): Promise<void> {
  await page.waitForFunction(
    (text) =>
      ((window as unknown as Record<string, any>).__biaoyue_store__ as any)
        .getState()
        .tabs[
          (
            (window as unknown as Record<string, any>).__biaoyue_store__ as any
          ).getState().activeTabId
        ]?.content.includes(text),
    needle,
  );
}

test("offset-shift-save：位移后提交落回正确单元格并出现可见提示", async ({
  page,
}) => {
  await openColumnsDoc(page);
  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();
  await page.keyboard.type("X");

  const shifted = `新块\n\n${SOURCE}`;
  await replaceDoc(page, shifted, "新块");
  // 冻结：位移不改毁持有输入框的 widget。
  await expect(page.locator('[data-testid="cm-column-editor"]')).toHaveCount(1);
  expect(await area.inputValue()).toBe("左X");

  await blurEditor(page);
  await waitForSource(page, "左X");

  expect(await getSource(page)).toBe(
    "新块\n\n::: {.col-2}\n\n左X\n\n右\n\n:::\n\n正文",
  );
  const toast = page.locator(".column-commit-toast");
  await expect(toast).toHaveCount(1);
  await expect(toast).toBeVisible();
  await shot(page, "offset-shift-save");
});

test("fallback-toast：匹配失败回填宿主、恰好一条可见 toast、源码不写", async ({
  page,
}) => {
  await openColumnsDoc(page);
  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();
  await page.keyboard.type("Y");

  const mismatched = "::: {.col-2}\n\n完全不同\n\n右\n\n:::\n\n正文改";
  await replaceDoc(page, mismatched, "正文改");
  await expect(page.locator('[data-testid="cm-column-editor"]')).toHaveCount(1);

  await blurEditor(page);
  const toast = page.locator(".column-commit-toast");
  await expect(toast).toHaveCount(1);
  await expect(toast).toBeVisible();
  await expect(body).toContainText("左Y");
  expect(await getSource(page)).toBe(mismatched);
  await shot(page, "fallback-toast");
});

test("single-editor：位移后重复点击同一单元格，输入窗口节点数严格为 1", async ({
  page,
}) => {
  await openColumnsDoc(page);
  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  await expect(page.locator('[data-testid="cm-column-editor"]')).toHaveCount(1);

  await replaceDoc(page, `新块\n\n${SOURCE}`, "新块");
  await expect(page.locator('[data-testid="cm-column-editor"]')).toHaveCount(1);

  // 再次对同一栏触发打开路径：应复用既有输入框而非再开一个。
  await page
    .locator('.cm-column[data-col="0"] .cm-column-body')
    .evaluate((el) =>
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
    );
  await expect(page.locator('[data-testid="cm-column-editor"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="cm-column-editor"]')).toBeVisible();
  await shot(page, "single-editor");
});

test("esc-cancel：Esc 后无残留编辑器、源码逐字节不变", async ({ page }) => {
  await openColumnsDoc(page);
  const body = page.locator('.cm-column[data-col="0"] .cm-column-body');
  await body.click();
  const area = page.locator('[data-testid="cm-column-editor"]');
  await expect(area).toBeVisible();
  await page.keyboard.type("Z");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="cm-column-editor"]')).toHaveCount(0);
  expect(await getSource(page)).toBe(SOURCE);
  await shot(page, "esc-cancel");
});
