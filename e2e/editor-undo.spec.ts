import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 文档撤销/重做恢复（#321 / shell-editor-batch5 4.4）。
 *
 * 三条验收：
 *  1. 预览后切到编辑，一次撤销不会把正文清空；
 *  2. 三次编辑后三次撤销逐步回退、三次重做逐步恢复；
 *  3. 撤销不跨页签：A 页签的编辑不会让 B 页签的撤销退回 A 的内容。
 *
 * 走 e2e/mocks/tauri-mock.js 与 `window.__biaoyue_store__` 桥；全部是真实
 * 键盘/鼠标事件，断言落在 `.cm-content` 文本或 store 的 `tab.content`。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/321");
const MOD = process.platform === "darwin" ? "Meta" : "Control";

mkdirSync(ART, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openFile(page: Page, p: string, content: string): Promise<void> {
  await page.evaluate(
    ({ file, text }) => {
      const w = window as unknown as {
        __biaoyue_openFile__: (
          path: string,
          content: string,
          title: string,
        ) => void;
      };
      w.__biaoyue_openFile__(file, text, "doc");
    },
    { file: p, text: content },
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

function storeContent(page: Page, tabPath: string): Promise<string> {
  return page.evaluate((p) => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            tabs: Record<string, { path: string | null; content: string }>;
          };
        };
      }
    ).__biaoyue_store__.getState();
    const tab = Object.values(s.tabs).find((t) => t.path === p);
    return tab?.content ?? "";
  }, tabPath);
}

async function ensureEditMode(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="pane-mode"]').first();
  await expect(btn).toBeVisible();
  if ((await btn.getAttribute("data-mode")) !== "edit") {
    await btn.click();
  }
  await expect(btn).toHaveAttribute("data-mode", "edit");
}

function cmContent(page: Page): Promise<string> {
  return page
    .locator(".cm-content")
    .first()
    .evaluate((el) => el.textContent ?? "");
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

test("预览后切到编辑，一次撤销不会把正文清空", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/undo/a.md", "# 标题\n\n正文内容。");
  await ensureEditMode(page);

  const cm = page.locator(".cm-content");
  await expect(cm).toContainText("正文内容");
  await shot(page, "01-preview-to-edit");

  await cm.click();
  await page.keyboard.press(`${MOD}+z`);

  // 正文既不被清空，也仍等于同步进来的文档
  await expect(cm).toContainText("正文内容");
  const text = await cmContent(page);
  expect(text.trim().length).toBeGreaterThan(0);
  expect(text).toContain("正文内容");
});

test("三次编辑后三次撤销逐步回退，三次重做逐步恢复", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/undo/b.md", "# 标题\n\n第一段。\n\n第二段。");
  await ensureEditMode(page);

  const cm = page.locator(".cm-content");
  await expect(cm).toContainText("第一段");

  // 三次编辑落在不同行：CM6 的撤销组按「相邻且 500ms 内」合并，不同行必然
  // 是三个独立的撤销步，回退/恢复才谈得上「逐步」。
  await page.locator(".cm-line").nth(0).click();
  await page.keyboard.type("甲");
  await page.locator(".cm-line").nth(2).click();
  await page.keyboard.type("乙");
  await page.locator(".cm-line").nth(4).click();
  await page.keyboard.type("丙");

  const content = () => storeContent(page, "/tmp/undo/b.md");
  await expect.poll(async () => (await content()).includes("甲")).toBe(true);
  await expect.poll(async () => (await content()).includes("乙")).toBe(true);
  await expect.poll(async () => (await content()).includes("丙")).toBe(true);
  await shot(page, "02-three-edits");

  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await content()).includes("丙")).toBe(false);
  expect(await content()).toContain("甲");
  expect(await content()).toContain("乙");

  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await content()).includes("乙")).toBe(false);
  expect(await content()).toContain("甲");

  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await content()).includes("甲")).toBe(false);
  await shot(page, "03-undone");

  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect.poll(async () => (await content()).includes("甲")).toBe(true);

  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect.poll(async () => (await content()).includes("乙")).toBe(true);

  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect.poll(async () => (await content()).includes("丙")).toBe(true);
  await shot(page, "04-redone");
});

test("撤销不跨页签：A 编辑后切到 B，撤销不动 B 的内容", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/undo/a.md", "# A 标题\n\nA 内容。");
  await ensureEditMode(page);
  await openFile(page, "/tmp/undo/b.md", "# B 标题\n\nB 内容。");
  await ensureEditMode(page);

  // 切回 A 编辑
  await page.locator('[data-tab-id][title="a.md"]').click();
  const cm = page.locator(".cm-content");
  await expect(cm).toContainText("A 内容");
  await cm.click();
  await page.keyboard.type("AAA");
  await expect
    .poll(() => storeContent(page, "/tmp/undo/a.md"))
    .toContain("AAA");

  // 切到 B 后撤销：B 的历史是空的，内容不该变成 A 的
  await page.locator('[data-tab-id][title="b.md"]').click();
  await expect(cm).toContainText("B 内容");
  await cm.click();
  await page.keyboard.press(`${MOD}+z`);

  const b = await storeContent(page, "/tmp/undo/b.md");
  expect(b).toContain("B 内容");
  expect(b).not.toContain("A 内容");
  expect(b).not.toContain("AAA");
  // A 的内容也不受影响
  expect(await storeContent(page, "/tmp/undo/a.md")).toContain("AAA");
  await shot(page, "05-no-cross-tab-undo");
});
