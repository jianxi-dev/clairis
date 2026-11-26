import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 内嵌文件名称态、悬浮预览与新标签页（#852 / B5c）。
 *
 * 在 #850 内嵌渲染之上加三件事：
 * - 名称态 / 内容态切换（右上角按钮），两态节点形态可断言区分；
 * - 名称态滑入弹出既有悬浮预览窗（复用 FloatingPreview，读真实内容）；
 * - 点击名称态里的链接文件在本产品新标签页打开（open_file_direct → openFile）。
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/852");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const EMBED_URL = `${APP_URL}/e2e/fixtures/embed-page.html`;
const DOC_PATH = "/tmp/e852/doc.md";
const MD_PATH = "/tmp/e852/assets/note.md";

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
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

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(
    ({ embedUrl, mdPath, mdContent }) => {
      const win = window as unknown as Record<string, any>;
      const iframeProto = HTMLIFrameElement.prototype as unknown as Record<
        string,
        unknown
      >;
      const iframeSet = iframeProto.setAttribute;
      iframeProto.setAttribute = function (name: string, value: string) {
        if (
          name === "src" &&
          typeof value === "string" &&
          value.startsWith("asset:")
        ) {
          value = embedUrl;
        }
        return iframeSet.call(this, name, value);
      };
      const internals = win.__TAURI_INTERNALS__;
      const originalInvoke = internals.invoke;
      internals.invoke = function (cmd: string, args: Record<string, unknown>) {
        if (cmd === "open_file_direct" && args?.path === mdPath) {
          return Promise.resolve({
            content: mdContent,
            path: mdPath,
            file_size: mdContent.length,
          });
        }
        return originalInvoke.call(this, cmd, args);
      };
    },
    {
      embedUrl: EMBED_URL,
      mdPath: MD_PATH,
      mdContent:
        "# 内嵌 Markdown 标题\n\n这是名称态悬浮预览要展示的**真实内容**。\n\n" +
        "占位段落\n\n".repeat(30),
    },
  );
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(page: Page, doc: string, title: string): Promise<void> {
  await page.evaluate(
    ({ docPath, doc, title }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(docPath, doc, title);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { docPath: DOC_PATH, doc, title },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function tabCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Object.keys(
        (window as unknown as Record<string, any>).__biaoyue_store__.getState()
          .tabs,
      ).length,
  );
}

async function activeTabPath(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return state.tabs[state.activeTabId]?.path ?? null;
  });
}

async function moveAway(page: Page): Promise<void> {
  await page.mouse.move(8, 8);
}

test("三态切换后节点形态可区分（embed / card）", async ({ page }) => {
  await openDoc(page, "![note](assets/note.md)\n", "doc.md");
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget.locator(".cm-embed-md")).toHaveCount(1);

  await expect(widget).toHaveAttribute("data-embed-state", "embed");
  await expect(widget.locator(".cm-embed-name")).toBeHidden();
  await expect(widget.locator(".cm-embed-body")).toBeVisible();
  const contentH = await widget
    .locator(".cm-embed-frame")
    .evaluate((el) => el.getBoundingClientRect().height);
  await shot(page, "01-content-state", "content-state");

  await widget.click();
  await page.locator('[data-testid="embed-panel-state-card"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "card");
  await expect(widget.locator(".cm-embed-name")).toBeVisible();
  await expect(widget.locator(".cm-embed-name-text")).toHaveText("note.md");
  await expect(widget.locator(".cm-embed-body")).toBeHidden();
  const nameH = await widget
    .locator(".cm-embed-frame")
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(nameH).toBeLessThan(contentH);
  await shot(page, "02-name-state", "name-state");

  await page.locator('[data-testid="embed-panel-state-embed"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "embed");
  await expect(widget.locator(".cm-embed-body")).toBeVisible();
  await expect(widget.locator(".cm-embed-name")).toBeHidden();
});

test("卡片态滑入弹出悬浮预览，滑出关闭", async ({ page }) => {
  await openDoc(page, "![note](assets/note.md)\n", "doc.md");
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await widget.click();
  await page.locator('[data-testid="embed-panel-state-card"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "card");

  await widget.locator(".cm-embed-name-text").hover();
  const preview = page.locator('[data-testid="floating-preview"]');
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveAttribute("data-preview-path", MD_PATH);
  await expect(preview.locator('[data-testid="preview-doc"]')).toContainText(
    "内嵌 Markdown 标题",
  );
  await shot(page, "03-name-hover-preview", "name-hover-preview");

  await moveAway(page);
  await expect
    .poll(async () => page.locator('[data-testid="floating-preview"]').count())
    .toBe(0);
});

test("点击卡片态链接在新标签页打开", async ({ page }) => {
  await openDoc(page, "![note](assets/note.md)\n", "doc.md");
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await widget.click();
  await page.locator('[data-testid="embed-panel-state-card"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "card");

  const before = await tabCount(page);
  await widget.locator(".cm-embed-name-text").click();
  await expect.poll(() => tabCount(page)).toBe(before + 1);
  await expect.poll(() => activeTabPath(page)).toBe(MD_PATH);
  await expect
    .poll(async () =>
      page.evaluate((p: string) => {
        const store = (window as unknown as Record<string, any>)
          .__biaoyue_store__;
        const state = store.getState();
        const tab = Object.values(state.tabs).find(
          (t: any) => t.path === p,
        ) as any;
        return tab?.title ?? "";
      }, MD_PATH),
    )
    .toBe("note.md");

  await moveAway(page);
  await expect
    .poll(async () => page.locator('[data-testid="floating-preview"]').count())
    .toBe(0);
  await shot(page, "04-new-tab-opened", "new-tab-opened");
});
