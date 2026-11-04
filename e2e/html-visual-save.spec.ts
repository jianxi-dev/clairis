import { test, expect, type Page } from "@playwright/test";

/**
 * 保存闭环（E-16 切片 5 / 票 166）。
 *
 * 判据是"落盘的字节"：编辑痕迹不许留在文件里，重复保存结果稳定，
 * 只打开不修改时不写盘。
 */

const PATH = "/tmp/save/doc.html";
const DOC = [
  "<!DOCTYPE html><html><head><style>p{font-size:16px}</style></head>",
  "<body><h1>标题</h1><p>第一段</p></body></html>",
].join("");

async function openVisual(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });
  await page.evaluate(
    ({ p, c }) => {
      const win = window as unknown as Record<string, any>;
      win.__saved_files__ = {};
      win.__biaoyue_openFile__(p, c, "doc.html");
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { p: PATH, c: DOC },
  );
  const iframe = page.locator('iframe[title="HTML 可视化编辑"]');
  await expect(iframe).toHaveCount(1);
  return page.frameLocator('iframe[title="HTML 可视化编辑"]');
}

function saves(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      ((window as unknown as Record<string, any>).__save_calls__ ?? []).length,
  );
}

function saved(page: Page, path = PATH): Promise<string | undefined> {
  return page.evaluate(
    (p) => (window as unknown as Record<string, any>).__saved_files__?.[p],
    path,
  );
}

test("可视化编辑后保存：落盘内容含改动，且零编辑痕迹", async ({ page }) => {
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("存进去的新段落");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = (
          window as unknown as Record<string, any>
        ).__biaoyue_store__.getState();
        return s.tabs[s.activeTabId].content as string;
      }),
    )
    .toContain("存进去的新段落");

  // 焦点在 iframe 内按 ⌘S：运行时转发给主窗口。
  // 判据必须"快于自动保存"——App 的自动保存在内容变化 2s 后才落盘，若只断言
  // "最终发生了保存"，自动保存会把 ⌘S 失效这件事盖住（第一版就是这样假绿的）。
  const before = await saves(page);
  const pressAt = Date.now();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() => saves(page), { timeout: 700 })
    .toBeGreaterThan(before);
  const lastAt = await page.evaluate(
    () =>
      ((window as unknown as Record<string, any>).__save_calls__ ?? []).at(-1)
        ?.at as number,
  );
  expect(lastAt - pressAt).toBeLessThan(700);
  await expect
    .poll(() => saved(page), { timeout: 5000 })
    .toContain("存进去的新段落");

  const bytes = (await saved(page)) as string;
  expect(bytes).not.toContain("data-cm-");
  expect(bytes).not.toContain("cmid");
  expect(bytes).not.toContain("contenteditable");
  // 用户样式必须还在
  expect(bytes).toContain("p{font-size:16px}");
});

test("连存两次字节相同（幂等，不累积漂移）", async ({ page }) => {
  const frame = await openVisual(page);
  const p = frame.locator('[data-cm-node-id="p:0"]');
  await p.dblclick();
  await page.keyboard.type("A");
  const base = await saves(page);
  await page.keyboard.press("ControlOrMeta+s");
  await expect.poll(() => saves(page), { timeout: 700 }).toBeGreaterThan(base);
  const first = await saved(page);
  expect(first).toContain("A");

  // 第二次必须真的发生（否则这条"幂等"就是拿旧值跟自己比）
  const afterFirst = await saves(page);
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() => saves(page), { timeout: 700 })
    .toBeGreaterThan(afterFirst);
  expect(await saved(page)).toBe(first);
});

test("只打开不修改：不写盘", async ({ page }) => {
  await openVisual(page);
  // 打开本身不许碰磁盘（E-16「打开不产生副作用」）
  await page.waitForTimeout(400);
  expect(await saved(page)).toBeUndefined();
});
