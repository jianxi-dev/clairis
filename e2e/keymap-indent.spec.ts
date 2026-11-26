import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1424";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    window.__biaoyue_openFile__(
      "/tmp/keymap-indent.md",
      "",
      "keymap-indent.md",
    );
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").click();
}

async function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = window.__biaoyue_store__.getState();
    const tab = s.tabs[s.activeTabId];
    return tab ? tab.content : "";
  });
}

async function typeIndentedOrderedItem(page: Page): Promise<void> {
  // 一个缩进一级（2 空格）的有序列表项。
  await page.keyboard.type("  1. 第一项");
  await expect.poll(() => content(page)).toBe("  1. 第一项");
}

test("Mod-[ 减少缩进一级且正文不回退，Mod-z 仍可撤销", async ({ page }) => {
  await boot(page);
  await typeIndentedOrderedItem(page);

  // CM6 把「相邻且 500ms 内」的 input.type 与 delete.dedent 合并成同一撤销组；
  // 等过这个窗口，Mod-[ 才是独立一步，Mod-z 才谈得上只回退缩进。
  await page.waitForTimeout(600);

  // Mod-[：缩进减少一级（2 空格），正文必须原样保留（不再触发撤销）。
  await page.keyboard.press("Meta+[");
  await expect.poll(() => content(page)).toBe("1. 第一项");

  // Mod-z 仍由 historyKeymap 承载：回退上一步缩进。
  await page.keyboard.press("Meta+z");
  await expect.poll(() => content(page)).toBe("  1. 第一项");
});

test("证据：键位纠偏四态截图", async ({ page }) => {
  const dir = process.env.EVIDENCE_DIR;
  test.skip(!dir, "EVIDENCE_DIR 未设置");
  await boot(page);
  await page.screenshot({ path: `${dir}/edit-idle.png` });

  await typeIndentedOrderedItem(page);
  await page.screenshot({ path: `${dir}/list-before-mod-bracket.png` });

  // 同主用例：等过 500ms 撤销合并窗口，Mod-[ 才是独立一步。
  await page.waitForTimeout(600);
  await page.keyboard.press("Meta+[");
  await expect.poll(() => content(page)).toBe("1. 第一项");
  await page.screenshot({ path: `${dir}/after-mod-bracket-outdent.png` });

  await page.keyboard.press("Meta+z");
  await expect.poll(() => content(page)).toBe("  1. 第一项");
  await page.screenshot({ path: `${dir}/after-mod-z-undo.png` });
});
