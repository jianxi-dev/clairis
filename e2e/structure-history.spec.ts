import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 结构命令历史分组（#1338 / ADR 0012 三原则）。
 *
 * 真实键盘走 e2e/mocks/tauri-mock.js 与 `window.__biaoyue_store__` 桥：
 *  1. 一次标题降级（Tab，H1→H2）后一次 ⌘Z，文档与操作前严格相等（差异字符数 0）；
 *  2. 连续两次降级（H1→H2→H3）后一次 ⌘Z，只回退最后一次（回到 H2，不是 H1）。
 *
 * 断言落在 store 的 `tab.content`（源码全文），四态截图落在 `.artifacts/1338/`。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1338");
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const ORIGINAL = "# 标题\n\n正文。";

mkdirSync(ART, { recursive: true });

/** 逐位置差异字符数（等长即汉明距离；长度差计入）。 */
function charDiff(a: string, b: string): number {
  let diff = Math.abs(a.length - b.length);
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff;
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
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

async function focusHeadingLine(page: Page): Promise<void> {
  const cm = page.locator(".cm-content").first();
  await expect(cm).toContainText("标题");
  await page.locator(".cm-line").first().click();
}

async function shot(page: Page, name: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

test("一次标题降级后一次 ⌘Z 与操作前严格相等", async ({ page }) => {
  await boot(page);
  const p = "/tmp/structure-history/one-tab.md";
  await openFile(page, p, ORIGINAL);
  await ensureEditMode(page);
  await focusHeadingLine(page);
  await shot(page, "01-h1-initial");

  await page.keyboard.press("Tab");
  await expect.poll(() => storeContent(page, p)).toBe("## 标题\n\n正文。");
  await shot(page, "02-h2-after-one-tab");

  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(() => storeContent(page, p)).toBe(ORIGINAL);
  await shot(page, "03-h1-after-undo");

  expect(charDiff(await storeContent(page, p), ORIGINAL)).toBe(0);
});

test("连续两次降级后一次 ⌘Z 只回退最后一次", async ({ page }) => {
  await boot(page);
  const p = "/tmp/structure-history/two-tab.md";
  await openFile(page, p, ORIGINAL);
  await ensureEditMode(page);
  await focusHeadingLine(page);

  await page.keyboard.press("Tab");
  await expect.poll(() => storeContent(page, p)).toBe("## 标题\n\n正文。");
  await page.keyboard.press("Tab");
  await expect.poll(() => storeContent(page, p)).toBe("### 标题\n\n正文。");

  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(() => storeContent(page, p)).toBe("## 标题\n\n正文。");
  await shot(page, "04-h2-after-one-undo");

  // 第一次降级（H1→H2）必须保留，不被这一次撤销带走。
  expect(await storeContent(page, p)).not.toBe(ORIGINAL);
});
