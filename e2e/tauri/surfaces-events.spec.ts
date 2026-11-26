// #1474 第 1/2 项：数据面事件链路的可执行断言。
//
// 1. surfaces-changed 只重载对应面（DS-2）：mock 派发事件后工具条按新有效集合
//    重渲染，且不得触发全量配置重放（load_config 调用数不变）。
// 2. load_surfaces 失败时降级不崩：应用外壳与编辑器仍可用。
import { test, expect, type Page } from "@playwright/test";

const APP_URL = process.env.SURFACES_APP_URL ?? "http://localhost:1420";

const DOC = [
  "<!DOCTYPE html><html><body>",
  "<h1>标题</h1>",
  "<p>段落正文</p>",
  "</body></html>",
].join("\n");

const BAR = ".cm-floating-toolbar";

async function boot(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((content) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/surfaces/doc.html", content, "doc.html");
    win.__biaoyue_store__.getState().setEditorMode("source");
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openBar(page: Page) {
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  const bar = page.locator(BAR);
  await expect(bar).toBeVisible({ timeout: 3000 });
  return bar;
}

async function toolbarActionIds(page: Page): Promise<string[]> {
  const bar = await openBar(page);
  const ids = await bar
    .locator("[data-action]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
  return ids.filter((id) => id !== "clear-format");
}

test("surfaces-changed 只重载对应面，不触发全量配置重放（DS-2）", async ({
  page,
}) => {
  await boot(page);

  const before = await toolbarActionIds(page);
  expect(before.length).toBeGreaterThan(0);

  const loadsBefore = await page.evaluate(
    () => (window as unknown as Record<string, any>).__mock_load_config_calls__,
  );

  const next = ["format-italic", "format-bold"];
  const diag = await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    return {
      handlers: Object.keys(win.__mock_event_handlers__ || {}),
      emit: typeof win.__mock_emit__,
    };
  });
  await page.evaluate((ids) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_surface_items__ = ids.map((id: string) => ({
      id,
      label: id,
      icon: "bold",
      group: "format",
    }));
    win.__mock_emit__("surfaces-changed", "html-toolbar");
  }, next);

  await expect
    .poll(() => toolbarActionIds(page), { timeout: 3000, message: JSON.stringify(diag) })
    .toEqual(next);

  const loadsAfter = await page.evaluate(
    () => (window as unknown as Record<string, any>).__mock_load_config_calls__,
  );
  expect(loadsAfter, "surfaces-changed 不得触发 load_config 全量重放").toBe(
    loadsBefore,
  );
});

test("load_surfaces 失败时降级：外壳与编辑器仍可用，不崩", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, any>).__biaoyue_surface_error__ = true;
  });
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await boot(page);

  // 外壳可见、页签已打开
  await expect(page.locator('[data-testid="pane-header"]').first()).toBeVisible();
  await expect(page.locator('[role="tab"]').first()).toBeVisible();
  // 面加载失败 → 工具条无项可渲染，但进程不崩
  expect(
    errors.filter((e) => !/load_surfaces/.test(e)),
    `pageerrors: ${errors.join(" | ")}`,
  ).toEqual([]);
});
