import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const APP_URL = process.env.CAPSULES_APP_URL ?? "http://localhost:1424";
const ART = resolve(process.cwd(), ".artifacts/1501");

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

const DEFAULT_CAPSULES = JSON.parse(
  readFileSync(
    resolve(REPO_ROOT, "src-tauri/src/resources/capsules.default.json"),
    "utf8",
  ),
).items as Record<string, unknown>[];

// mock 的胶囊默认集合必须与仓库内 JSON 默认源逐项一致（单一真相源对账）。
test("mock 默认集合与 capsules.default.json 对账", () => {
  const mockSource = readFileSync(
    resolve(REPO_ROOT, "e2e/mocks/tauri-mock.js"),
    "utf8",
  );
  const block = mockSource.match(/var DEFAULT_CAPSULE_ITEMS = (\[[\s\S]*?\]);/);
  expect(block, "mock 应有 DEFAULT_CAPSULE_ITEMS").not.toBeNull();
  const mockItems = new Function(`return ${block![1]};`)() as unknown[];
  expect(mockItems).toEqual(DEFAULT_CAPSULES);
});

const DOC = ["# 标题", "", "第一段正文", "", "第二段正文", ""].join("\n");

async function boot(page: Page, capsuleOverride: unknown[] | null = null) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (capsuleOverride !== null) {
    await page.addInitScript((items) => {
      (window as unknown as Record<string, unknown>).__biaoyue_capsule_items__ =
        items;
    }, capsuleOverride);
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__("/tmp/capsules/doc.md", body, "doc.md");
    win.__biaoyue_store__.getState().setEditorMode("edit");
    win.__biaoyue_editor_store__
      .getState()
      .setConfig({ selectionToolbar: "capsule" });
  }, DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function openCapsule(page: Page) {
  await page.locator(".cm-line").nth(2).click({ clickCount: 3 });
  const capsule = page.locator('[data-testid="selection-capsule"]');
  await expect(capsule).toBeVisible({ timeout: 3000 });
  return capsule;
}

function shot(page: Page, name: string, state: string) {
  mkdirSync(ART, { recursive: true });
  return page.screenshot({ path: `${ART}/${name}.png` }).then(() => state);
}

test.describe("胶囊面（capsules）", () => {
  test("默认态：选区工具条渲染 12 项，顺序与默认源一致", async ({ page }) => {
    await boot(page);
    const capsule = await openCapsule(page);
    const ids = await capsule
      .locator(".capsule-btn[data-action]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
    expect(ids).toEqual(DEFAULT_CAPSULES.map((i) => i.id));
    await shot(page, "01-default-12", "open");
  });

  test("覆盖只留三项：工具条只渲染这三项且顺序与面数据一致", async ({
    page,
  }) => {
    const pick = (id: string) =>
      DEFAULT_CAPSULES.find((i) => i.id === id) as Record<string, unknown>;
    const three = ["capsule-bg", "format-bold", "ai-polish"].map(pick);
    await boot(page, three);
    const capsule = await openCapsule(page);
    const ids = await capsule
      .locator(".capsule-btn[data-action]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
    expect(ids).toEqual(["capsule-bg", "format-bold", "ai-polish"]);
    await shot(page, "02-three-items", "switch");
  });

  test("改名生效：title 与 aria-label 严格等于新名称，旧名出现 0 次", async ({
    page,
  }) => {
    const renamed = DEFAULT_CAPSULES.map((i) =>
      i.id === "format-bold" ? { ...i, label: "加粗文字" } : i,
    );
    await boot(page, renamed);
    const capsule = await openCapsule(page);
    const btn = capsule.locator('.capsule-btn[data-action="format-bold"]');
    await expect(btn).toHaveAttribute("title", "加粗文字");
    await expect(btn).toHaveAttribute("aria-label", "加粗文字");
    const title = await btn.getAttribute("title");
    const aria = await btn.getAttribute("aria-label");
    expect(title).toBe("加粗文字");
    expect(aria).toBe("加粗文字");
    // 旧名在整个工具条内出现 0 次（严格等于旧名，不做子串包含）
    const allTitles = await capsule
      .locator(".capsule-btn")
      .evaluateAll((els) =>
        els.flatMap((el) => [
          el.getAttribute("title") ?? "",
          el.getAttribute("aria-label") ?? "",
        ]),
      );
    expect(allTitles.filter((t) => t === "加粗")).toHaveLength(0);
    await shot(page, "03-renamed", "renamed");
  });

  test("清空覆盖（取消）后回落完整默认 12 项，无残留按钮", async ({
    page,
  }) => {
    await boot(page, null);
    const capsule = await openCapsule(page);
    const ids = await capsule
      .locator(".capsule-btn[data-action]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
    expect(ids).toHaveLength(12);
    expect(ids).toEqual(DEFAULT_CAPSULES.map((i) => i.id));
    await shot(page, "04-fallback-default", "fallback");
  });

  test("未知 id 覆盖被过滤：剩余项正常渲染，未知 id 不出现", async ({
    page,
  }) => {
    const pick = (id: string) =>
      DEFAULT_CAPSULES.find((i) => i.id === id) as Record<string, unknown>;
    const withUnknown = [
      pick("format-bold"),
      { id: "nope", label: "不存在", icon: "bold", order: 99 },
      pick("format-italic"),
    ];
    await boot(page, withUnknown);
    const capsule = await openCapsule(page);
    const ids = await capsule
      .locator(".capsule-btn[data-action]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
    expect(ids).toEqual(["format-bold", "format-italic"]);
    await shot(page, "05-unknown-filtered", "filtered");
  });
});
