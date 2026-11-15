import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 内嵌文件滚动定格与重开保持（#851 / B5b）。
 *
 * 滚动内嵌内容后指针移出即定格，再次打开（关闭重开 / 整页重载）恢复到定格
 * 位置；再次滚动到其他区域后定格更新。定格存到文档级 view-state
 * （`embedScrollPositions`，键 = 文档路径 + 内嵌路径），与 scrollPositions 同类。
 *
 * md 走外层容器滚动；html 走同源 iframe 内部滚动（跨域 iframe 拿不到
 * scrollTop，定格不生效，见票面口径）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/851");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const EMBED_URL = `${APP_URL}/e2e/fixtures/embed-page.html`;
const MARKER = "EMBED-FIXTURE-MARKER-850";
const DOC_PATH = "/tmp/e851/doc.md";
const MD_PATH = "/tmp/e851/assets/note.md";
const MD_KEY = `${DOC_PATH}\u0000assets/note.md`;
const HTML_KEY = `${DOC_PATH}\u0000assets/page.html`;

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
        "# 内嵌 Markdown 标题\n\n这是内嵌 md 的**真实渲染**内容，不是文件名。\n\n" +
        "占位段落\n\n".repeat(60),
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

/** 关闭当前页签后按同路径重开：真正的「再次打开」。 */
async function reopenDoc(
  page: Page,
  doc: string,
  title: string,
): Promise<void> {
  await page.evaluate(
    ({ docPath, doc, title }) => {
      const win = window as unknown as Record<string, any>;
      const store = win.__biaoyue_store__.getState();
      if (store.activeTabId) store.closeTab(store.activeTabId);
      win.__biaoyue_openFile__(docPath, doc, title);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { docPath: DOC_PATH, doc, title },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function moveIntoEmbed(page: Page, widget: Locator): Promise<void> {
  const box = (await widget.boundingBox())!;
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + Math.min(60, box.height / 2),
  );
}

/** 把指针移到内嵌框外（优先下方，下方不够则上方），触发 pointerleave 定格。 */
async function moveOutOfEmbed(page: Page): Promise<void> {
  const point = await page.evaluate(() => {
    const frameEl = document.querySelector(
      ".cm-embed-frame",
    ) as HTMLElement | null;
    if (!frameEl) return { x: 400, y: 400 };
    const r = frameEl.getBoundingClientRect();
    if (r.bottom + 16 < window.innerHeight - 8) {
      return { x: r.left + 16, y: r.bottom + 16 };
    }
    return { x: r.left + 16, y: Math.max(8, r.top - 16) };
  });
  await page.mouse.move(point.x, point.y);
}

async function freezeOf(
  page: Page,
  key: string,
): Promise<{ scrollPos: number; contentHeight: number } | null> {
  return page.evaluate((k: string) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    return store.getState().embedScrollPositions[k] ?? null;
  }, key);
}

async function embedScrollTop(page: Page, widget: Locator): Promise<number> {
  return widget.locator(".cm-embed-body").evaluate((el) => el.scrollTop);
}

async function frameContent(
  page: Page,
  iframe: Locator,
): Promise<import("@playwright/test").Frame> {
  const handle = await iframe.elementHandle();
  const contentFrame = (await handle?.contentFrame()) ?? null;
  expect(contentFrame).not.toBeNull();
  return contentFrame!;
}

test("md 内嵌：滑出定格 → 重开保持 → 再滚动更新 → 重载持久化", async ({
  page,
}) => {
  const doc = "![note](assets/note.md)\n";
  await openDoc(page, doc, "doc.md");
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget.locator(".cm-embed-md")).toHaveCount(1);

  await shot(page, "01-top", "top");

  await moveIntoEmbed(page, widget);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => embedScrollTop(page, widget)).toBeGreaterThan(0);
  const a = await embedScrollTop(page, widget);
  await moveOutOfEmbed(page);
  await expect
    .poll(async () => (await freezeOf(page, MD_KEY))?.scrollPos ?? -1)
    .toBeGreaterThanOrEqual(a - 1);

  await shot(page, "02-scrolled-frozen", "scrolled-frozen");

  await reopenDoc(page, doc, "doc.md");
  const reopened = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(reopened.locator(".cm-embed-md")).toHaveCount(1);
  await expect
    .poll(() => embedScrollTop(page, reopened))
    .toBeGreaterThanOrEqual(a - 1);
  await reopened.click();
  await expect(reopened).toHaveAttribute("data-selected", "true");
  await shot(page, "03-reopen-restored", "reopen-restored");

  await moveIntoEmbed(page, reopened);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => embedScrollTop(page, reopened)).toBeGreaterThan(a);
  const b = await embedScrollTop(page, reopened);
  await moveOutOfEmbed(page);
  await expect
    .poll(async () => (await freezeOf(page, MD_KEY))?.scrollPos ?? -1)
    .toBeGreaterThanOrEqual(b - 1);

  await shot(page, "04-rescrolled-updated", "rescrolled-updated");

  // 等 scheduleSave 防抖落盘，再整页重载：定格应从文档级 view-state 恢复。
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("__mock_config");
        if (!raw) return false;
        const cfg = JSON.parse(raw);
        return Object.keys(cfg.embedScrollPositions || {}).some((k) =>
          k.includes("note.md"),
        );
      }),
    )
    .toBe(true);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await openDoc(page, doc, "doc.md");
  const reloaded = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(reloaded.locator(".cm-embed-md")).toHaveCount(1);
  await expect
    .poll(() => embedScrollTop(page, reloaded))
    .toBeGreaterThanOrEqual(b - 1);
  await reloaded.click();
  await expect(reloaded).toHaveAttribute("data-selected", "true");
  await shot(page, "05-reload-persisted", "reload-persisted");
});

test("html 内嵌同源 iframe：滑出定格与重开保持", async ({ page }) => {
  // 尾部段落让外层文档可滚：重开态靠外层滚动与「滚动后」截图区分（iframe
  // 吞点击，无法用选中态做视觉区分）。
  const doc =
    "![page](assets/page.html)\n\n" +
    "正文段落，用于让外层文档可滚动。\n\n".repeat(20);
  await openDoc(page, doc, "doc.md");
  const widget = page.locator('.cm-embed-widget[data-embed-kind="html"]');
  const iframe = widget.locator("iframe");
  await expect(iframe).toHaveAttribute("src", EMBED_URL);
  const frame = await frameContent(page, iframe);
  await expect(frame.locator("#embed-fixture-marker")).toHaveText(MARKER);

  await moveIntoEmbed(page, widget);
  await frame.evaluate(() => {
    document.scrollingElement!.scrollTop = 200;
  });
  await expect
    .poll(() => frame.evaluate(() => document.scrollingElement!.scrollTop))
    .toBeGreaterThanOrEqual(199);
  await moveOutOfEmbed(page);
  await expect
    .poll(async () => (await freezeOf(page, HTML_KEY))?.scrollPos ?? -1)
    .toBeGreaterThanOrEqual(199);

  await shot(page, "06-html-scrolled-frozen", "html-scrolled-frozen");

  await reopenDoc(page, doc, "doc.md");
  const iframe2 = page.locator(
    '.cm-embed-widget[data-embed-kind="html"] iframe',
  );
  const frame2 = await frameContent(page, iframe2);
  await expect
    .poll(() => frame2.evaluate(() => document.scrollingElement!.scrollTop))
    .toBeGreaterThanOrEqual(199);
  const outer = page.locator(".content-scroll");
  await outer.evaluate((el) => {
    el.scrollTop = 80;
  });
  await expect
    .poll(() => outer.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await shot(page, "07-html-reopen-restored", "html-reopen-restored");
});
