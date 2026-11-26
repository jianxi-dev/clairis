import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1513";
mkdirSync(OUT, { recursive: true });

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: {
    getState: () => {
      setEditorMode: (m: string) => void;
      tabs: Record<string, { content: string }>;
      activeTabId: string;
    };
  };
}

const LINK_PATH = "/tmp/e32/assets/note.md";
const LINK_CONTENT = "# 链接目标\n\n这是悬浮窗里的真实内容。\n";
const DOC = "[打开笔记](assets/note.md)\n\n正文。\n";

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(({ p, c }) => {
    const internals = (window as unknown as Record<string, any>)
      .__TAURI_INTERNALS__;
    const original = internals.invoke;
    internals.invoke = function (cmd: string, args: Record<string, unknown>) {
      if (cmd === "open_file_direct" && args?.path === p) {
        return Promise.resolve({ content: c, path: p, file_size: c.length });
      }
      return original.call(this, cmd, args);
    };
  }, { p: LINK_PATH, c: LINK_CONTENT });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ p }) => {
      const w = window as unknown as BW;
      w.__biaoyue_openFile__("/tmp/e32/doc.md", "[打开笔记](assets/note.md)\n\n正文。\n", "doc.md");
      w.__biaoyue_store__.getState().setEditorMode("preview");
    },
    { p: LINK_PATH },
  );
  await page.locator(".preview-prose").waitFor({ timeout: 10000 });
}

function tabCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Object.keys(
        (window as unknown as Record<string, any>).__biaoyue_store__.getState()
          .tabs,
      ).length,
  );
}

test("预览态本地文档链接：点击打开；⌘+悬停出浮窗", async ({ page }) => {
  await setup(page);
  const link = page.locator('[data-local-doc="assets/note.md"]');
  await expect(link).toHaveCount(1);
  await page.screenshot({ path: `${OUT}/01-link.png` });

  const before = await tabCount(page);
  await link.click();
  await expect.poll(() => tabCount(page)).toBe(before + 1);
  await page.screenshot({ path: `${OUT}/02-clicked-open.png` });
});

test("⌘/Ctrl+悬停出浮窗；不按修饰键悬停不出", async ({ page }) => {
  await setup(page);
  const link = page.locator('[data-local-doc="assets/note.md"]');
  await link.hover();
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/03-plain-hover-no-window.png` });

  const box = (await link.boundingBox())!;
  await page.keyboard.down("Meta");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  await page.keyboard.up("Meta");
  const preview = page.locator('[data-testid="floating-preview"]');
  await expect(preview).toHaveCount(1, { timeout: 3000 });
  await page.screenshot({ path: `${OUT}/04-cmd-hover-window.png` });
});
