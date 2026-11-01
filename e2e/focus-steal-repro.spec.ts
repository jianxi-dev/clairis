import { test, expect } from "@playwright/test";

// 回归测试：FramePreview 的焦点抢回轮询必须给 iframe 内原生控件留交互窗口。
// 根因：HTML 预览（iframe）内嵌 <select> / <input type="color"> 等原生控件，
// 点击后焦点进入 iframe 文档；若立即抢回焦点，原生下拉/取色器会因失焦瞬间关闭
// （"点击闪一下就消失"）。修复：进入 iframe 或抢回后各留 2.5s 窗口，窗口内不抢。
//
// 本测试以 iframe 内 <select> 为探针：点击 select 后焦点应留在 iframe
// （select 获得焦点）；等待超过窗口后焦点应被抢回父文档（快捷键恢复）。
//
// 注意：走 web 模式（无 tauri-mock）→ HtmlPreview 用 srcdoc，iframe 内有真实内容；
// 且 FramePreview 的焦点抢回轮询与是否 Tauri 无关，web 模式同样生效。

const APP_URL = "http://localhost:1420";

test("HTML 预览：点击 iframe 内 select 后 2.5s 交互窗口内焦点不被打断", async ({
  page,
}) => {
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  // 通过 store 桥打开内嵌 <select> 的 HTML 文件（fileKind=html → FramePreview）
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body><select id="t" class="c-theme"><option value="calm">沉稳</option><option value="tech">科技</option></select></body></html>`;
  await page.evaluate(
    ([p, c]) => {
      const w = window as unknown as Record<string, unknown>;
      const store = (w as { __biaoyue_store__?: unknown }).__biaoyue_store__;
      if (!store) throw new Error("store bridge missing");
      (
        store as {
          getState: () => { openFile: (p: string, c: string) => void };
        }
      )
        .getState()
        .openFile(p, c);
    },
    ["/virtual/palette.html", html],
  );
  await page.waitForTimeout(300);

  const frame = page
    .locator('iframe[title="HTML 预览"]')
    .first()
    .contentFrame();
  await expect(frame.locator("select.c-theme")).toBeVisible({
    timeout: 5000,
  });

  // 点击 select（焦点进入 iframe 文档，select 获得焦点）
  await frame.locator("select.c-theme").click();

  // 交互窗口内（< 2.5s）：焦点应留在 iframe 内
  await page.waitForTimeout(800);
  const activeInsideWindow = await page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLIFrameElement;
  });
  expect(activeInsideWindow).toBe(true);

  // 超过交互窗口（> 2.5s）：焦点应被抢回父文档（Cmd+±/0 快捷键恢复）
  await page.waitForTimeout(2200); // 累计 3.0s
  const activeAfterWindow = await page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLIFrameElement;
  });
  expect(activeAfterWindow).toBe(false);
});
