import { test, expect, type Page } from "@playwright/test";
import { imeDoc } from "./fixtures/ime-long-doc";

/**
 * #1437 第 5 项：IME 组合期装饰必须按 changes 映射。
 *
 * 旧实现 `return decos` 把按旧文档算出的范围套到组合中的新文本上，视图 tile
 * 树错位后在 `parents.pop()` 抛 TypeError，可见内容大面积塌陷。本用例用 CDP
 * 注入真实组合事件，断言无异常、高度不塌、媒体/标注节点不消失，并确认组合后
 * 编辑器仍可继续输入。
 */

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (
    path: string,
    content: string,
    title: string,
  ) => boolean;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
}

async function openDoc(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(() => {
    // 不提供可解析的媒体地址：图片加载失败正是崩溃现场的结构特征之一。
    const win = window as unknown as Record<string, unknown>;
    const internals = win.__TAURI_INTERNALS__ as Record<string, unknown>;
    internals.convertFileSrc = () => "asset://missing-media";
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await page.evaluate(
    ({ body }) => {
      const win = window as unknown as BridgeWindow;
      win.__biaoyue_openFile__("/tmp/ime-long.md", body, "ime-long.md");
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { body: imeDoc() },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

test("IME 组合输入不崩溃、不塌高、媒体与标注节点保留", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openDoc(page);

  const snapshot = () =>
    page.evaluate(() => {
      const scroller = document.querySelector(
        ".cm-scroller",
      ) as HTMLElement | null;
      return {
        scrollHeight: scroller?.scrollHeight ?? -1,
        callouts: document.querySelectorAll(".cm-callout").length,
        images: document.querySelectorAll(".cm-image-widget").length,
        videos: document.querySelectorAll("video").length,
      };
    });

  const before = await snapshot();
  expect(before.callouts).toBeGreaterThan(0);
  expect(before.images).toBeGreaterThan(0);

  await page.locator(".cm-content").click({ position: { x: 280, y: 8 } });
  await page.keyboard.press("Control+End");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", {
    text: "zhong",
    selectionStart: 5,
    selectionEnd: 5,
  });
  await cdp.send("Input.imeSetComposition", {
    text: "中文",
    selectionStart: 2,
    selectionEnd: 2,
  });
  await cdp.send("Input.insertText", { text: "中文" });
  await page.keyboard.type("输入");
  await page.waitForTimeout(250);

  expect(errors).toEqual([]);
  await page.screenshot({ path: ".artifacts/1437/07-ime-after.png" });
  const after = await snapshot();
  expect(after.scrollHeight).toBeGreaterThan(before.scrollHeight * 0.95);
  expect(after.callouts).toBeGreaterThanOrEqual(before.callouts);
  expect(after.images).toBeGreaterThanOrEqual(before.images);
  expect(after.videos).toBeGreaterThanOrEqual(before.videos);

  const textLength = await page
    .locator(".cm-content")
    .evaluate((el) => el.textContent?.length ?? 0);
  await page.keyboard.type("尾");
  const grew = await page
    .locator(".cm-content")
    .evaluate((el) => el.textContent?.length ?? 0);
  expect(grew).toBeGreaterThan(textLength);
});
