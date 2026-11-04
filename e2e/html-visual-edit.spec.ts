import { test, expect, type Page } from "@playwright/test";

/**
 * HTML 可视化编辑（E-16 / H2，切片 2）。
 *
 * 这一片只验通道本身：编辑态 iframe 起得来、锚点打上了、用户脚本跑不了、
 * CM6 不被重建。交互（点选/改字）在后续切片。
 */

const DOC = [
  "<!DOCTYPE html>",
  "<html><head><style>body { color: rgb(0, 0, 128); }</style>",
  "<script>parent.postMessage({ v: 1, type: 'pwned' }, '*');</script>",
  "</head>",
  "<body><h1>标题</h1><p>第一段</p></body></html>",
].join("\n");

async function openHtml(page: Page, mode: "edit" | "source" | "preview") {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate(
    ({ content, mode }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__("/tmp/ve/doc.html", content, "doc.html");
      win.__biaoyue_store__.getState().setEditorMode(mode);
    },
    { content: DOC, mode },
  );
}

test("编辑态起 iframe，且锚点已打上", async ({ page }) => {
  await openHtml(page, "edit");
  const frame = page.locator('iframe[title="HTML 可视化编辑"]');
  await expect(frame).toHaveCount(1);
  const srcdoc = await frame.getAttribute("srcdoc");
  expect(srcdoc).not.toBeNull();
  expect(srcdoc).toContain('data-cm-node-id="h1:0"');
  expect(srcdoc).toContain("cmid:");
  // 编辑态允许注入运行时：带 nonce 的 CSP；且绝不能退化成 unsafe-inline
  expect(srcdoc).toMatch(/script-src 'nonce-[a-f0-9]{32}'/);
  expect(srcdoc).not.toContain("script-src 'unsafe-inline'");
});

test("用户文件里的脚本不执行，注入运行时执行", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  // 先装监听，再开文件，避免漏掉早期消息
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__bridge = [];
    window.addEventListener("message", (e) => {
      w.__bridge.push((e.data as { type?: string })?.type ?? "?");
    });
  });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/ve/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, DOC);

  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as Record<string, any>).__bridge as string[],
        ),
      { timeout: 5000 },
    )
    .toContain("ready");

  const types = await page.evaluate(
    () => (window as unknown as Record<string, any>).__bridge as string[],
  );
  // 关键断言：运行时跑了，用户脚本没跑
  expect(types).not.toContain("pwned");
});

test("可视化 ↔ 源码 切换不重建 CM6", async ({ page }) => {
  await openHtml(page, "source");
  const cm = page.locator(".cm-content");
  await cm.waitFor({ timeout: 5000 });
  // 在 DOM 节点上留记号：remount 会换掉节点，记号随之消失
  await cm.evaluate((el) => {
    (el as unknown as Record<string, unknown>).__probe = "keep";
  });

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("edit");
  });
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(1);
  // 可视化态下 CM6 只是藏起来，仍在 DOM 里
  await expect(cm).toHaveCount(1);
  await expect(cm).toBeHidden();

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("source");
  });
  await expect(cm).toBeVisible();
  const kept = await cm.evaluate(
    (el) => (el as unknown as Record<string, unknown>).__probe === "keep",
  );
  expect(kept).toBe(true);
});

test("markdown 文件的编辑态仍是 CM6，不受影响", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/ve/a.md", "# 标题\n正文", "a.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await expect(page.locator('iframe[title="HTML 可视化编辑"]')).toHaveCount(0);
  await expect(page.locator(".cm-content")).toBeVisible();
});
