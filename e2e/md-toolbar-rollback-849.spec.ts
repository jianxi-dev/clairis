import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * B6 / #849：md 编辑态选中文字的横向工具条回滚到 #603 之前可用版本。
 *
 * 回滚目标来自 git 历史（`git show 54403f4^:src/editors/orchestration/horizontal-toolbar.ts`）：
 * 12 个动作按 ai → format → align 分组，颜色下拉与「清除格式」为固定控件。
 * #603 把这套动作改为经全局命令注册表执行后，源码 / 代码文件视图会用自己的闭包
 * 覆盖同一批 `format-*` id，导致 md 编辑态选区工具条的格式按钮失效；本票回滚该
 * 注册行为（按钮集合与顺序的配置驱动架构保留）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/849");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const MD_DOC = "# 标题\n\n第一段正文内容\n\n第二段\n";

// #603 前的动作集合与顺序（回滚目标）。
const ROLLBACK_ACTIONS = [
  "ai-rewrite",
  "ai-translate",
  "ai-polish",
  "format-bold",
  "format-italic",
  "format-underline",
  "format-strike",
  "format-code",
  "format-link",
  "align-left",
  "align-center",
  "align-right",
];

// 回滚目标的格式组顺序，用来核对 md 选区工具条暴露的格式动作子集。
const ROLLBACK_FORMAT_ORDER = [
  "format-bold",
  "format-italic",
  "format-underline",
  "format-strike",
  "format-code",
  "format-link",
];

// HTML 可视化编辑态文字工具条的既有控件集合（A-15.2：保持不变）。
const HTML_VISUAL_TEXT_CONTROLS = [
  "button:AI 编辑",
  "input:背景色",
  "select:字体",
  "select:字号",
  "button:粗体",
  "button:斜体",
  "button:下划线",
  "button:删除线",
  "button:链接",
  "select:对齐",
  "input:文字颜色",
  "button:删除元素",
];

function shot(page: Page, name: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        name,
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

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openCss(page: Page, filePath: string): Promise<void> {
  await page.evaluate((p) => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(p, "body{color:red}\n.x{color:blue}", "bar.css");
    win.__biaoyue_store__.getState().setEditorMode("edit");
  }, filePath);
  await page.waitForTimeout(400);
}

async function openMdCapsule(page: Page, filePath: string): Promise<void> {
  await page.evaluate(
    ([p, doc]) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(p, doc, p.split("/").pop());
      win.__biaoyue_store__.getState().setEditorMode("edit");
      win.__biaoyue_editor_store__
        .getState()
        .setConfig({ selectionToolbar: "capsule" });
    },
    [filePath, MD_DOC],
  );
  await page.waitForTimeout(400);
}

async function selectMdLine(page: Page): Promise<void> {
  const mdPane = page
    .locator(".cm-content")
    .filter({ hasText: "第一段正文内容" })
    .first();
  await mdPane.locator(".cm-line").nth(2).click({ clickCount: 3 });
  await page.waitForTimeout(300);
}

function tabContent(page: Page, filePath: string): Promise<string> {
  return page.evaluate((p) => {
    const win = window as unknown as Record<string, any>;
    const state = win.__biaoyue_store__.getState();
    const tab = Object.values(state.tabs).find((t) => t.path === p) as {
      content: string;
    };
    return tab?.content ?? "";
  }, filePath);
}

test("横条按钮集合等于 #603 前的回滚目标", async ({ page }) => {
  await boot(page);
  await openCss(page, "/tmp/849-bar.css");
  await page.locator(".cm-line").nth(1).click({ clickCount: 3 });
  const bar = page.locator('[data-testid="selection-toolbar"]');
  await expect(bar).toBeVisible({ timeout: 3000 });
  const actions = await bar
    .locator("[data-action]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
  expect(actions).toEqual([...ROLLBACK_ACTIONS, "clear-format"]);
});

test("md 编辑态选区横向工具条格式动作子集与顺序保持回滚目标", async ({
  page,
}) => {
  await boot(page);
  await openMdCapsule(page, "/tmp/849-md.md");
  await selectMdLine(page);
  const capsule = page.locator('[data-testid="selection-capsule"]');
  await expect(capsule).toBeVisible({ timeout: 3000 });
  const actions = await capsule
    .locator(".capsule-btn[data-action]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-action")));
  const formatSubset = actions.filter((id) =>
    ROLLBACK_FORMAT_ORDER.includes(id as string),
  );
  expect(formatSubset).toEqual(ROLLBACK_FORMAT_ORDER);
});

test("md 选区工具条格式行为不被其它编辑视面劫持（#603 全局注册回滚）", async ({
  page,
}) => {
  await boot(page);
  await openMdCapsule(page, "/tmp/849-hijack.md");
  // 另一视面打开代码文件：其横向工具条曾注册同一批 format-* 命令。
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().splitPane("col");
  });
  await page.waitForTimeout(300);
  await openCss(page, "/tmp/849-hijack.css");
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    const state = win.__biaoyue_store__.getState();
    const mdId = Object.keys(state.tabs).find(
      (k) => state.tabs[k].path === "/tmp/849-hijack.md",
    );
    state.switchTab(mdId);
  });
  await page.waitForTimeout(400);

  await selectMdLine(page);
  const capsule = page.locator('[data-testid="selection-capsule"]');
  await expect(capsule).toBeVisible({ timeout: 3000 });
  await capsule.locator('.capsule-btn[data-action="format-bold"]').click();
  await expect
    .poll(() => tabContent(page, "/tmp/849-hijack.md"))
    .toContain("**第一段正文内容");
  expect(await tabContent(page, "/tmp/849-hijack.css")).not.toContain("**");
});

test("HTML 可视化编辑态工具条按钮集合不变", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/849-visual.html",
      "<!DOCTYPE html><html><head><style>body{margin:0}p{font-size:16px;padding:24px}</style></head><body><p>第一段文字</p></body></html>",
      "visual.html",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(700);
  const frame = page.frameLocator('iframe[title="HTML 可视化编辑"]');
  await frame.locator("p").first().click();
  const bar = page.locator('.html-edit-toolbar[data-cm-node-kind="text"]');
  await expect(bar).toBeVisible({ timeout: 3000 });
  const controls = await bar
    .locator("button, select, input")
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${el.tagName.toLowerCase()}:${el.getAttribute("aria-label") ?? ""}`,
      ),
    );
  expect(controls).toEqual(HTML_VISUAL_TEXT_CONTROLS);
});

test("证据：四态截图", async ({ page }) => {
  mkdirSync(ART, { recursive: true });

  await boot(page);
  await openMdCapsule(page, "/tmp/849-shot-md.md");
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_store__.getState().splitPane("col");
  });
  await page.waitForTimeout(300);
  await openCss(page, "/tmp/849-shot.css");
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    const state = win.__biaoyue_store__.getState();
    const mdId = Object.keys(state.tabs).find(
      (k) => state.tabs[k].path === "/tmp/849-shot-md.md",
    );
    state.switchTab(mdId);
  });
  await page.waitForTimeout(400);
  await selectMdLine(page);
  await expect(page.locator('[data-testid="selection-capsule"]')).toBeVisible({
    timeout: 3000,
  });
  await shot(page, "md-capsule-rolled-back");

  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    const state = win.__biaoyue_store__.getState();
    const id = Object.keys(state.tabs).find(
      (k) => state.tabs[k].path === "/tmp/849-shot.css",
    );
    state.switchTab(id);
  });
  await page.waitForTimeout(400);
  const cssPane = page
    .locator(".cm-content")
    .filter({ hasText: "color:blue" })
    .first();
  await cssPane.locator(".cm-line").nth(1).click({ clickCount: 3 });
  await expect(page.locator('[data-testid="selection-toolbar"]')).toBeVisible({
    timeout: 3000,
  });
  await shot(page, "horizontal-bar-rollback-set");

  await boot(page);
  await page.evaluate(() => {
    const win = window as unknown as Record<string, any>;
    win.__biaoyue_openFile__(
      "/tmp/849-shot-visual.html",
      "<!DOCTYPE html><html><head><style>body{margin:0}p{font-size:16px;padding:24px}</style></head><body><p>第一段文字</p></body></html>",
      "shot-visual.html",
    );
    win.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(700);
  const frame = page.frameLocator('iframe[title="HTML 可视化编辑"]');
  await frame.locator("p").first().click();
  await expect(
    page.locator('.html-edit-toolbar[data-cm-node-kind="text"]'),
  ).toBeVisible({ timeout: 3000 });
  await shot(page, "html-visual-toolbar-unchanged");

  await boot(page);
  await openMdCapsule(page, "/tmp/849-shot-none.md");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="selection-capsule"]')).toHaveCount(
    0,
  );
  await shot(page, "no-selection");
});
