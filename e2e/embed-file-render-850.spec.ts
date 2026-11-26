import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 插入文件内嵌渲染（#850 / B5a）。
 *
 * 四类引用在编辑态正文里渲染真实内容：pdf（读字节 → iframe）、md（读文件 →
 * 预览渲染管线）、html（asset URL iframe）、网页（URL iframe）。默认高度约
 * 一屏，选中出 8 个把手拖拽改高宽，内容区可滚动。
 *
 * mock 环境没有真实 asset / media 协议：html 的 asset: iframe src 被重写到
 * 本地夹具页；pdf 走 mock 的 read_file_base64（返回真实 mini.pdf 字节）。
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/850");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const EMBED_URL = `${APP_URL}/e2e/fixtures/embed-page.html`;
const MARKER = "EMBED-FIXTURE-MARKER-850";

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
      // html 内嵌的 asset: iframe src 在浏览器无处理器，重写到本地夹具页。
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
      // md 内嵌内容：为夹具路径返回确定性 markdown，验证「渲染而非纯文本」。
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
      mdPath: "/tmp/e850/assets/note.md",
      mdContent:
        "# 内嵌 Markdown 标题\n\n这是内嵌 md 的**真实渲染**内容，不是文件名。\n\n" +
        "占位段落\n\n".repeat(40),
    },
  );
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(
  page: Page,
  docPath: string,
  doc: string,
  title: string,
): Promise<void> {
  await page.evaluate(
    ({ docPath, doc, title }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(docPath, doc, title);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { docPath, doc, title },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function frameContent(
  page: Page,
  iframe: import("@playwright/test").Locator,
): Promise<import("@playwright/test").Frame> {
  const handle = await iframe.elementHandle();
  const contentFrame = (await handle?.contentFrame()) ?? null;
  expect(contentFrame).not.toBeNull();
  return contentFrame!;
}

test("pdf 内嵌真实内容、默认一屏高", async ({ page }) => {
  await openDoc(
    page,
    "/tmp/rc/report.md",
    "![report](report.pdf)\n",
    "report.md",
  );

  const widget = page.locator('.cm-embed-widget[data-embed-kind="pdf"]');
  await expect(widget).toHaveCount(1);
  const iframe = widget.locator("iframe");
  await expect(iframe).toHaveCount(1);

  // 真实内容：iframe src 是文件字节生成的 blob，fetch 回来以 %PDF 开头。
  const src = await iframe.getAttribute("src");
  expect(src?.startsWith("blob:")).toBe(true);
  const head = await page.evaluate(
    async (url: string) =>
      Array.from(
        new Uint8Array(await (await fetch(url)).arrayBuffer()).slice(0, 5),
      ),
    src!,
  );
  expect(head).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

  // 默认高度约一屏 = min(视口高, .cm-content 可视高)。
  const contentH = await page.evaluate(
    () => document.querySelector(".cm-content")!.clientHeight,
  );
  const expected = Math.min(800, contentH);
  await expect
    .poll(async () =>
      widget
        .locator(".cm-embed-frame")
        .evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeCloseTo(expected, 0);

  await shot(page, "pdf-embedded", "pdf-embedded");
});

test("html 内嵌 iframe 加载真实页面内容且可滚动", async ({ page }) => {
  await openDoc(
    page,
    "/tmp/e850/doc.md",
    "![page](assets/page.html)\n",
    "doc.md",
  );

  const widget = page.locator('.cm-embed-widget[data-embed-kind="html"]');
  await expect(widget).toHaveCount(1);
  const iframe = widget.locator("iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", EMBED_URL);

  const contentFrame = await frameContent(page, iframe);
  await expect(contentFrame.locator("#embed-fixture-marker")).toHaveText(
    MARKER,
  );
  const scrollable = await contentFrame.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollHeight > doc.clientHeight;
  });
  expect(scrollable).toBe(true);
  await contentFrame.evaluate(() => {
    document.scrollingElement!.scrollTop = 200;
  });
  const htmlScroll = await contentFrame.evaluate(
    () => document.scrollingElement!.scrollTop,
  );
  expect(htmlScroll).toBeGreaterThan(0);

  await shot(page, "html-embedded", "html-embedded");
});

test("md 内嵌渲染排版内容（不是纯文本）且可滚动", async ({ page }) => {
  await openDoc(
    page,
    "/tmp/e850/doc.md",
    "![note](assets/note.md)\n",
    "doc.md",
  );

  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget).toHaveCount(1);
  const body = widget.locator(".cm-embed-md");
  await expect(body).toHaveCount(1);
  await expect(body.locator("h1")).toHaveText("内嵌 Markdown 标题");
  // 渲染成节点，源码标记不成可见文本。
  const text = await body.innerText();
  expect(text).not.toContain("# 内嵌");
  expect(text).not.toContain("**");

  const scrollable = await widget
    .locator(".cm-embed-body")
    .evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrollable).toBe(true);
  // 真实滚轮事件：内容区自己滚，不被 CM6 抢去滚整篇文档。
  const bodyEl = widget.locator(".cm-embed-body");
  const bodyBox = (await bodyEl.boundingBox())!;
  await page.mouse.move(
    bodyBox.x + bodyBox.width / 2,
    bodyBox.y + Math.min(120, bodyBox.height / 2),
  );
  await page.mouse.wheel(0, 240);
  await expect
    .poll(async () => bodyEl.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);

  await shot(page, "md-embedded", "md-embedded");
});

test("网页引用内嵌 iframe 加载目标页面", async ({ page }) => {
  await openDoc(page, "/tmp/e850/doc.md", `![web](${EMBED_URL})\n`, "doc.md");

  const widget = page.locator('.cm-embed-widget[data-embed-kind="web"]');
  await expect(widget).toHaveCount(1);
  const iframe = widget.locator("iframe");
  await expect(iframe).toHaveAttribute("src", EMBED_URL);
  const contentFrame = await frameContent(page, iframe);
  await expect(contentFrame.locator("#embed-fixture-marker")).toHaveText(
    MARKER,
  );
});

test("选中出 8 个把手，拖拽改高宽生效并写回文档", async ({ page }) => {
  await openDoc(
    page,
    "/tmp/e850/doc.md",
    "![note](assets/note.md)\n",
    "doc.md",
  );

  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget.locator(".cm-embed-md")).toHaveCount(1);
  await widget.click();
  const handles = widget.locator(".cm-image-handle");
  await expect(handles).toHaveCount(8);

  const frame = widget.locator(".cm-embed-frame");
  const before = await frame.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });

  // e 把手改宽。
  const eHandle = widget.locator('.cm-image-handle[data-handle="e"]');
  const eBox = (await eHandle.boundingBox())!;
  await page.mouse.move(eBox.x + eBox.width / 2, eBox.y + eBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(eBox.x + 90, eBox.y + eBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(async () => frame.evaluate((el) => el.getBoundingClientRect().width))
    .not.toBe(before.w);

  // n 把手改高（顶边中点可见；默认一屏高时底边把手在视口外）。
  const nHandle = widget.locator('.cm-image-handle[data-handle="n"]');
  const nBox = (await nHandle.boundingBox())!;
  await page.mouse.move(nBox.x + nBox.width / 2, nBox.y + nBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(nBox.x + nBox.width / 2, nBox.y + 70, { steps: 6 });
  await page.mouse.up();

  const after = await frame.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  expect(after.w).not.toBe(before.w);
  expect(after.h).not.toBe(before.h);

  // 尺寸写回同一属性语法。
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const store = (window as unknown as Record<string, any>)
          .__biaoyue_store__;
        const state = store.getState();
        return state.tabs[state.activeTabId]?.content ?? "";
      }),
    )
    .toMatch(/\{width=\d+ height=\d+\}/);

  await shot(page, "resized", "resized");
});
