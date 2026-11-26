import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = ".artifacts/1512";
mkdirSync(OUT, { recursive: true });

interface BW extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
}

const MD_PATH = "/tmp/e3v/assets/note.md";
const MD_CONTENT = "# 内嵌标题\n\n正文内容。\n\n" + "占位\n\n".repeat(20);

async function setup(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(({ mdPath, mdContent }) => {
    const internals = (window as unknown as Record<string, any>)
      .__TAURI_INTERNALS__;
    const original = internals.invoke;
    internals.invoke = function (cmd: string, args: Record<string, unknown>) {
      if (cmd === "open_file_direct" && args?.path === mdPath) {
        return Promise.resolve({ content: mdContent, path: mdPath, file_size: mdContent.length });
      }
      return original.call(this, cmd, args);
    };
  }, { mdPath: MD_PATH, mdContent: MD_CONTENT });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ mdPath }) => {
      const w = window as unknown as BW;
      w.__biaoyue_openFile__("/tmp/e3v/doc.md", `![note](assets/note.md)\n`, "doc.md");
      w.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { mdPath: MD_PATH },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
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

test("卡片态单击区块不出新页签；面板三图标可切换三视图", async ({ page }) => {
  await setup(page);
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-embed-state", "embed");

  await widget.click();
  const before = await tabCount(page);

  await page.locator('[data-testid="embed-panel-state-preview"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "preview");
  await page.screenshot({ path: `${OUT}/01-card-selected.png` });

  await page.mouse.click(8, 8);
  await page.waitForTimeout(200);

  await widget.locator(".cm-embed-name-text").click();
  await page.waitForTimeout(400);
  expect(await tabCount(page)).toBe(before);
  await expect(widget).toHaveAttribute("data-embed-state", "preview");
  await page.screenshot({ path: `${OUT}/02-click-no-open.png` });

  await widget.locator(".cm-embed-name-text").click();
  await expect.poll(() => tabCount(page)).toBe(before + 1);
  await page.screenshot({ path: `${OUT}/03-second-click-open.png` });
});

test("文本视图与预览视图形态可区分", async ({ page }) => {
  await setup(page);
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await widget.click();
  await page.locator('[data-testid="embed-panel-state-card"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "card");
  await expect(widget.locator(".cm-embed-name")).toBeVisible();
  await page.screenshot({ path: `${OUT}/04-text-view.png` });

  await page.locator('[data-testid="embed-panel-state-embed"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "embed");
  await expect(widget.locator(".cm-embed-name")).toBeHidden();
  await page.screenshot({ path: `${OUT}/05-preview-view.png` });
});
