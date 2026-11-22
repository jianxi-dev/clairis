import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 回灌收口（#1335 / change editor-foundation-batch1 1.1）。
 *
 * 两条验收：
 *  1. 双面板同页签：A 连续输入 5 次后，B 的文本与 A 严格相等（差异字符数 0）。
 *  2. 外部回灌后按一次撤销，正文不被清空（长度 ≥ 1），且回灌不进历史
 *     （撤销不会把回灌内容退掉）。
 *
 * 全部走真实键盘与 store 桥，断言落在 `.cm-content` 文本与 store 的
 * `tab.content` 上，不直接调内部函数。
 *
 * 双面板同页签在 UI 上不可达：`splitPane` 建空叶，`splitPaneWithTab` 会把页签
 * 从原格搬走（先加后删会让同一 tabId 短暂出现在两格）。所以这里用
 * `restorePaneLayout` 注入「两格都持有同一 tabId」的布局，其余链路都是真实的。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1335");
const MOD = process.platform === "darwin" ? "Meta" : "Control";

mkdirSync(ART, { recursive: true });

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

/** 注入「两个叶都持有同一 tabId」的布局（UI 不可达，见文件头说明）。 */
async function injectSameTabTwoPanes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_store__: {
        getState: () => {
          splitPane: (dir: "col" | "row") => void;
          restorePaneLayout: (root: unknown, focusedId: string) => void;
          paneRoot: unknown;
          activeTabId: string | null;
        };
      };
    };
    const store = w.__biaoyue_store__;
    // splitPane 会把扁平 activeTabId 置成新空叶的 null，所以先记下页签 id
    const tabId = store.getState().activeTabId;
    store.getState().splitPane("col");
    const st = store.getState();
    type Node = {
      type: "leaf" | "node";
      id: string;
      children?: [Node, Node];
      tabs?: string[];
      activeTabId?: string | null;
      editorMode?: string;
    };
    const clone = (n: Node): Node =>
      n.type === "leaf"
        ? { ...n }
        : { ...n, children: [clone(n.children![0]), clone(n.children![1])] };
    const root = clone(st.paneRoot as Node);
    const leaves: Node[] = [];
    const walk = (n: Node): void => {
      if (n.type === "leaf") {
        leaves.push(n);
        return;
      }
      const [a, b] = n.children as [Node, Node];
      walk(a);
      walk(b);
    };
    walk(root);
    if (!tabId) throw new Error("没有活动页签");
    for (const leaf of leaves) {
      leaf.tabs = [tabId];
      leaf.activeTabId = tabId;
      leaf.editorMode = "edit";
    }
    store.getState().restorePaneLayout(root, leaves[0].id);
  });
}

test("双面板同页签：A 连续输入 5 次后 B 与 A 严格相等", async ({ page }) => {
  await boot(page);
  const p = "/tmp/1335/mirror.md";
  await openFile(page, p, "# 标题\n\n第一段。\n");
  await ensureEditMode(page);

  await injectSameTabTwoPanes(page);

  const panes = page.locator("[data-pane-id]");
  await expect(panes).toHaveCount(2);
  const cmA = panes.nth(0).locator(".cm-content");
  const cmB = panes.nth(1).locator(".cm-content");
  await expect(cmA).toContainText("第一段");
  await expect(cmB).toContainText("第一段");

  await cmA.click();
  await page.keyboard.press("Control+End");
  for (const ch of ["1", "2", "3", "4", "5"]) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(80);
  }
  await expect.poll(() => storeContent(page, p)).toContain("12345");

  const textA = await cmA.evaluate((el) => el.textContent ?? "");
  const textB = await cmB.evaluate((el) => el.textContent ?? "");
  expect(charDiff(textA, textB)).toBe(0);
  expect(textB).toBe(textA);
  await page.screenshot({ path: path.join(ART, "two-pane-mirror.png") });
});

test("外部回灌后一次撤销不清空正文，且回灌不进历史", async ({ page }) => {
  await boot(page);
  const p = "/tmp/1335/external.md";
  await openFile(page, p, "# 标题\n\n正文内容。");
  await ensureEditMode(page);

  const cm = page.locator(".cm-content").first();
  await expect(cm).toContainText("正文内容");

  // 对照：用户输入确实可撤销（证明撤销键本身是活的）
  await cm.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("用户输入");
  await expect.poll(() => storeContent(page, p)).toContain("用户输入");
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(() => storeContent(page, p)).not.toContain("用户输入");

  // 外部回灌：与标题改写 / 可视化回写 / 磁盘刷新同一条协议
  const next = "# 标题\n\n正文内容。外部回灌的句子。";
  await page.evaluate(
    ({ filePath, content }) => {
      const s = (
        window as unknown as {
          __biaoyue_store__: {
            getState: () => {
              updateTabContent: (
                tabId: string,
                content: string,
                writer?: string,
              ) => number;
              tabs: Record<string, { path: string | null; id: string }>;
            };
          };
        }
      ).__biaoyue_store__.getState();
      const tab = Object.values(s.tabs).find((t) => t.path === filePath);
      if (!tab) throw new Error("找不到页签");
      s.updateTabContent(tab.id, content, "external");
    },
    { filePath: p, content: next },
  );

  // 回灌内容已进 store，也被同步 effect 灌进了编辑器
  await expect.poll(() => storeContent(page, p)).toBe(next);
  await expect(cm).toContainText("外部回灌的句子");

  // 一次撤销：回灌不进历史 → 正文不被清空，回灌内容也不被退掉
  await cm.click();
  await page.keyboard.press(`${MOD}+z`);
  const after = await cm.evaluate((el) => el.textContent ?? "");
  expect(after.length).toBeGreaterThanOrEqual(1);
  expect(after).toContain("外部回灌的句子");
  expect(await storeContent(page, p)).toBe(next);
  await page.screenshot({ path: path.join(ART, "external-undo.png") });
});
