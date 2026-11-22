import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 输入节流（#1336 / change editor-foundation-batch1 1.2）。
 *
 * 三条验收，全部走真实键盘 + store 桥 + tauri mock：
 *  (a) 200ms 内连打 10 次：内容快照更新次数 ≤ 2，且首次键入后立即 dirty；
 *  (b) 键入后 50ms 内 Cmd+S：落盘内容与编辑器全文差异字符数为 0（读到的是
 *      flush 后的 live 全文，不是节流窗口里的旧快照）；
 *  (c) 键入后等 >2100ms：store 快照与编辑器全文差异字符数为 0，无旧内容残留。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1336");
const MOD = process.platform === "darwin" ? "Meta" : "Control";

mkdirSync(ART, { recursive: true });

interface StoreTab {
  id: string;
  path: string | null;
  content: string;
  dirty: boolean;
  contentRevision?: number;
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openFile(page: Page, p: string, content: string): Promise<void> {
  await page.evaluate(
    ({ file, text }) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (
            path: string,
            content: string,
            title: string,
          ) => void;
        }
      ).__biaoyue_openFile__(file, text, "doc");
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

async function ensureEditMode(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="pane-mode"]').first();
  await expect(btn).toBeVisible();
  if ((await btn.getAttribute("data-mode")) !== "edit") {
    await btn.click();
  }
  await expect(btn).toHaveAttribute("data-mode", "edit");
}

function storeTab(page: Page, tabPath: string): Promise<StoreTab | null> {
  return page.evaluate((p) => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { tabs: Record<string, StoreTab> };
        };
      }
    ).__biaoyue_store__.getState();
    return Object.values(s.tabs).find((t) => t.path === p) ?? null;
  }, tabPath);
}

/** 编辑器全文：按行读取 `.cm-line` 再用换行拼回，避开块级 textContent 丢换行。 */
function editorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const cm = document.querySelector(".cm-content");
    if (!cm) return "";
    const lines = Array.from(cm.querySelectorAll(".cm-line"));
    return lines.map((l) => l.textContent ?? "").join("\n");
  });
}

/** 差异字符数：公共前后缀之外的字符总量（0 = 严格相等）。 */
function charDiff(a: string, b: string): number {
  let start = 0;
  const limit = Math.min(a.length, b.length);
  while (start < limit && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return endA - start + (endB - start);
}

test("连打 10 次：快照更新 ≤ 2 次且立即 dirty", async ({ page }) => {
  await boot(page);
  const p = "/tmp/1336/throttle.md";
  await openFile(page, p, "# 标题\n\n起点。\n");
  await ensureEditMode(page);

  const cm = page.locator(".cm-content").first();
  await expect(cm).toContainText("起点");
  await page.screenshot({ path: path.join(ART, "1-edit-idle.png") });

  const before = await storeTab(page, p);
  expect(before).not.toBeNull();
  const revBefore = before!.contentRevision ?? 0;

  await cm.click();
  await page.keyboard.press(`${MOD}+End`);
  await page.keyboard.type("abcdefghij", { delay: 12 });

  const after = await storeTab(page, p);
  expect(after).not.toBeNull();
  // 首键立即标脏。
  expect(after!.dirty).toBe(true);
  // 快照更新次数 ≤ 2（防抖窗口内大多数键入不写）。
  expect((after!.contentRevision ?? 0) - revBefore).toBeLessThanOrEqual(2);
  await page.screenshot({
    path: path.join(ART, "2-fast-typing-throttled.png"),
  });
});

test("键入后 50ms 内保存：落盘与编辑器全文差异 0", async ({ page }) => {
  await boot(page);
  const p = "/tmp/1336/save.md";
  await openFile(page, p, "# 标题\n\n正文。\n");
  await ensureEditMode(page);

  const cm = page.locator(".cm-content").first();
  await expect(cm).toContainText("正文");
  await cm.click();
  await page.keyboard.press(`${MOD}+End`);
  await page.keyboard.type("刚敲进去的字", { delay: 10 });
  // 立即保存：节流窗口还没收敛，保存必须先 flush。
  await page.keyboard.press(`${MOD}+s`);

  await expect
    .poll(async () => {
      const saved = await page.evaluate((filePath) => {
        const w = window as unknown as {
          __saved_files__: Record<string, string>;
        };
        return w.__saved_files__?.[filePath];
      }, p);
      return saved ?? null;
    })
    .not.toBeNull();

  const [saved, editor] = await Promise.all([
    page.evaluate((filePath) => {
      const w = window as unknown as {
        __saved_files__: Record<string, string>;
      };
      return w.__saved_files__[filePath];
    }, p),
    editorText(page),
  ]);
  expect(charDiff(saved, editor)).toBe(0);
  expect(saved).toContain("刚敲进去的字");
  await page.screenshot({ path: path.join(ART, "3-save-after-typing.png") });
});

test("键入后等 >2100ms：store 快照与编辑器全文差异 0", async ({ page }) => {
  await boot(page);
  const p = "/tmp/1336/converge.md";
  await openFile(page, p, "# 标题\n\n起点。\n");
  await ensureEditMode(page);

  const cm = page.locator(".cm-content").first();
  await expect(cm).toContainText("起点");
  await cm.click();
  await page.keyboard.press(`${MOD}+End`);
  await page.keyboard.type("截止收敛的内容", { delay: 10 });

  // 2s 硬截止 + 300ms 防抖：>2100ms 后必然已收敛。
  await expect
    .poll(
      async () => {
        const tab = await storeTab(page, p);
        return tab ? charDiff(tab.content, await editorText(page)) : 1;
      },
      { timeout: 6000 },
    )
    .toBe(0);

  const tab = await storeTab(page, p);
  expect(tab!.content).toContain("截止收敛的内容");
  expect(charDiff(tab!.content, await editorText(page))).toBe(0);
  await page.screenshot({ path: path.join(ART, "4-deadline-converged.png") });
});
