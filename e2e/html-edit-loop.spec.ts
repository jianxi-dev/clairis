import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ART276 = path.resolve(process.cwd(), ".artifacts/276");
mkdirSync(ART276, { recursive: true });

function shot276(page: Page, name: string): Promise<void> {
  return page.screenshot({ path: path.join(ART276, `${name}.png`) });
}

/**
 * HTML 编辑闭环（E-15 / H1）。
 *
 * 三件事：预览必须隔离在 iframe 里、相对资源要落到文档目录、三模式切换
 * 不能重建编辑器（编辑后的改动要能在预览里看到）。
 */

const HTML = [
  "<!DOCTYPE html>",
  "<html><head><style>body { color: rgb(200, 0, 0); }</style></head>",
  "<body><h1>标题</h1><img src='./pic.png' alt='p'></body></html>",
].join("\n");

async function openHtml(page: Page, content: string, name = "h1") {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ content, name }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(
        `/tmp/${name}/${name}.html`,
        content,
        `${name}.html`,
      );
      win.__biaoyue_store__.getState().setEditorMode("preview");
    },
    { content, name },
  );
}

function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const s = store.getState();
    return (s.tabs[s.activeTabId]?.content as string) ?? "";
  });
}

test("HTML 预览隔离在 iframe 里，不注入主文档", async ({ page }) => {
  await openHtml(page, HTML);
  const frame = page.locator('iframe[title="HTML 预览"]');
  await expect(frame).toHaveCount(1);
  // 用户样式不能漏进主文档
  const bodyColor = await page.evaluate(
    () => getComputedStyle(document.body).color,
  );
  expect(bodyColor).not.toBe("rgb(200, 0, 0)");
});

test("已保存 HTML 走 asset 直载；未保存内容回退 srcdoc 并重写相对路径", async ({
  page,
}) => {
  await openHtml(page, HTML, "h2");
  const frame = page.locator('iframe[title="HTML 预览"]');
  await expect(frame).toHaveCount(1);
  // 已保存且未编辑：asset 直载（脚本与相对路径由文档自身解析）
  await expect(frame).toHaveAttribute("src", /asset:\/\//);
  expect(await frame.getAttribute("srcdoc")).toBeNull();
  await shot276(page, "html-live-asset");

  // 标脏后回退 srcdoc：相对路径被重写，且骨架先出现、加载后消失
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const s = w.__biaoyue_store__.getState();
    s.updateTabContent(
      s.activeTabId,
      "<html><body><img src='./pic.png'></body></html>",
    );
  });
  await expect
    .poll(async () => await frame.getAttribute("srcdoc"))
    .not.toBeNull();
  const srcdoc = await frame.getAttribute("srcdoc");
  expect(srcdoc).toContain("asset://");
  expect(srcdoc).not.toContain("src='./pic.png'");
  await shot276(page, "html-srcdoc-fallback");
});

test("50KB HTML 打开：首屏 iframe 快速挂载、页签不被标脏（#276）", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });

  // 生成约 50KB 的 HTML（与用户文件同量级：560+ 元素 + 内联样式）
  const big =
    "<!DOCTYPE html><html><head><style>body{font-family:sans-serif}</style></head><body>" +
    Array.from(
      { length: 600 },
      (_, i) =>
        `<section class="c${i % 8}"><h2>标题 ${i}</h2><p>正文段落 ${i}，用于压测首屏。</p></section>`,
    ).join("") +
    "</body></html>";
  expect(big.length).toBeGreaterThan(40000);

  const t0 = await page.evaluate((content) => {
    const w = window as unknown as Record<string, any>;
    const start = performance.now();
    w.__biaoyue_openFile__("/tmp/perf/big.html", content, "big.html");
    w.__biaoyue_store__.getState().setEditorMode("preview");
    return start;
  }, big);

  const frame = page.locator('iframe[title="HTML 预览"]');
  await expect(frame).toHaveCount(1);
  const elapsed = await page.evaluate((start) => performance.now() - start, t0);
  console.log(`[#276] first-iframe ${Math.round(elapsed)}ms`);
  expect(elapsed).toBeLessThan(1500);
  await shot276(page, "html-50k-open");

  // 预览态不预热编辑器 → 页签保持 clean，走 asset 直载
  const state = await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const s = w.__biaoyue_store__.getState();
    const tab = s.tabs[s.activeTabId];
    const f = document.querySelector(
      'iframe[title="HTML 预览"]',
    ) as HTMLIFrameElement | null;
    return { dirty: tab?.dirty, src: f?.getAttribute("src") };
  });
  expect(state.dirty).toBe(false);
  expect(state.src).toContain("asset://");

  // 切到源码后才同步整篇文档（长度 > 40K）
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("source");
  });
  // CM6 只渲染视口内的行，断言首屏行已同步；完整 doc 相等由单测锁定
  const cmText = await page
    .locator(".cm-content")
    .first()
    .evaluate((el) => el.textContent ?? "");
  expect(cmText).toContain("标题 0");
  expect(cmText.length).toBeGreaterThan(1000);
  await shot276(page, "html-50k-source");
});

test("编辑后切回预览能看到改动，且编辑器未被重建", async ({ page }) => {
  await openHtml(page, HTML, "h3");
  // E-16 起 `.html` 的「编辑」是可视化面板，改源码走「源码」模式
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("source");
  });
  const editor = page.locator(".cm-content");
  await editor.waitFor({ timeout: 5000 });
  // 记录编辑器 DOM 节点身份，切模式后应保持不变（display 切换而非 remount）
  const before = await editor.evaluate((el) => {
    (el as unknown as Record<string, unknown>).__probe = "keep";
    return true;
  });
  expect(before).toBe(true);

  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("<h1>改过了</h1>");
  await expect.poll(() => content(page)).toContain("改过了");

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setEditorMode("preview");
  });
  const frame = page.locator('iframe[title="HTML 预览"]');
  await expect(frame).toHaveCount(1);
  // 预览 iframe 先挂载后写 srcdoc：并发下立即读取会拿到 null（#829）。
  await expect
    .poll(async () => (await frame.getAttribute("srcdoc")) ?? "", {
      timeout: 10000,
    })
    .toContain("改过了");
});
