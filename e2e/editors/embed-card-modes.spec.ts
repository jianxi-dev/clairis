import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * 嵌入文件卡 quiet 化（#1414 / editor-refine-batch2 D3）。
 *
 * A-3.1 工具条按钮严格 7 个（展开全屏 + 左/中/右 + 卡片/预览/嵌入），无下载、无 +/-
 * A-3.2 工具条「下载」按钮数 0
 * A-3.3 点「卡片」→ body 计算 display === "none"，头部文件名 + 副标题可见
 * A-3.4 点「预览」→ body 可见且高度 ≤ 上限
 * A-3.5 点「嵌入」→ body 全尺寸
 * A-3.6 头部主标题节点数 1
 * A-3.7 有描述时副标题节点数 1；无描述时 0
 * A-3.8 拖边框后文档 {width=…} 变化并写回
 * 三态往返可逆且持久化，无残留选中把手
 */

const APP_URL = "http://localhost:1424";
const ART = ".artifacts/1414";
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");
const MD_PATH = "/tmp/e1414/assets/note.md";
const MD_CONTENT =
  "# 内嵌标题\n\n" + "占位段落，用来把内容撑出限高。\n\n".repeat(60);

test.beforeEach(async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.addInitScript(
    ({ mdPath, mdContent }) => {
      const win = window as unknown as Record<string, any>;
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
    { mdPath: MD_PATH, mdContent: MD_CONTENT },
  );
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
});

async function openDoc(page: Page, doc: string, name: string): Promise<void> {
  await page.evaluate(
    ({ doc, name }) => {
      const win = window as unknown as Record<string, any>;
      win.__biaoyue_openFile__(`/tmp/e1414/${name}.md`, doc, `${name}.md`);
      win.__biaoyue_store__.getState().setEditorMode("edit");
    },
    { doc, name },
  );
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

async function activeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const st = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    return st.tabs[st.activeTabId]?.content ?? "";
  });
}

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
        `.artifacts/1414/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

async function selectWidget(page: Page): Promise<void> {
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget.locator(".cm-embed-md h1")).toHaveText("内嵌标题");
  await widget.click();
  await expect(
    page.locator('[data-testid="embed-panel"]'),
  ).toBeVisible();
  await expect(widget).toHaveAttribute("data-selected", "true");
}

test("A-3.1 / A-3.2 工具条严格 7 个按钮，无下载、无 +/-", async ({ page }) => {
  await openDoc(page, `![note](${MD_PATH})\n`, "toolbar-seven");
  await selectWidget(page);

  const panel = page.locator('[data-testid="embed-panel"]');
  await expect(panel.locator("button")).toHaveCount(7);

  const testids = await panel
    .locator("button")
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.testid),
    );
  expect(testids).toEqual([
    "embed-panel-expand",
    "embed-panel-align-left",
    "embed-panel-align-center",
    "embed-panel-align-right",
    "embed-panel-state-card",
    "embed-panel-state-preview",
    "embed-panel-state-embed",
  ]);

  const labels = await panel
    .locator("button")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).innerText));
  expect(labels.join("")).not.toContain("下载");
  expect(panel.locator('[data-testid="embed-panel-width-inc"]')).toHaveCount(0);
  await expect(panel.locator('[data-testid="embed-panel-width-dec"]')).toHaveCount(0);

  await shot(page, "04-toolbar-seven", "toolbar-seven");
});

test("A-3.3 点「卡片」→ body display none，头部文件名与副标题可见", async ({
  page,
}) => {
  await openDoc(page, `![会议记录](${MD_PATH})\n`, "state-card");
  await selectWidget(page);

  await page.locator('[data-testid="embed-panel-state-card"]').click();
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget).toHaveAttribute("data-embed-state", "card");
  await expect
    .poll(async () =>
      widget
        .locator(".cm-embed-body")
        .evaluate((el) => getComputedStyle(el).display),
    )
    .toBe("none");

  await expect(widget.locator(".cm-embed-name-text")).toHaveText("note.md");
  await expect(widget.locator(".cm-embed-name-desc")).toHaveCount(1);
  await expect(widget.locator(".cm-embed-name-desc")).toHaveText("会议记录");
  await shot(page, "01-card", "card-state");
});

test("A-3.4 点「预览」→ body 可见且高度 ≤ 上限", async ({ page }) => {
  await openDoc(page, `![note](${MD_PATH})\n`, "state-preview");
  await selectWidget(page);

  await page.locator('[data-testid="embed-panel-state-preview"]').click();
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget).toHaveAttribute("data-embed-state", "preview");
  const body = widget.locator(".cm-embed-body");
  await expect
    .poll(async () => body.evaluate((el) => getComputedStyle(el).display))
    .toBe("block");
  const height = await body.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(320 + 1);
  await shot(page, "02-preview", "preview-state");
});

test("A-3.5 点「嵌入」→ body 全尺寸（高度大于预览上限）", async ({ page }) => {
  await openDoc(page, `![note](${MD_PATH})\n`, "state-embed");
  await selectWidget(page);

  await page.locator('[data-testid="embed-panel-state-embed"]').click();
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget).toHaveAttribute("data-embed-state", "embed");
  const height = await widget
    .locator(".cm-embed-body")
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(320);
  await shot(page, "03-embed", "embed-state");
});

test("A-3.6 / A-3.7 头部主标题 1 个；无描述时副标题回落类型描述", async ({
  page,
}) => {
  await openDoc(page, `![](${MD_PATH})\n`, "header-no-desc");
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await widget.click();
  await page.locator('[data-testid="embed-panel-state-card"]').click();

  await expect(widget.locator(".cm-embed-name-text")).toHaveCount(1);
  await expect(widget.locator(".cm-embed-name-text")).toHaveText("note.md");
  await expect(widget.locator(".cm-embed-name-desc")).toHaveCount(1);
  await expect(widget.locator(".cm-embed-name-desc")).toHaveText("Markdown 文档");
});

test("三态往返可逆且持久化，无残留选中把手", async ({ page }) => {
  await openDoc(page, `![note](${MD_PATH})\n`, "roundtrip");
  await selectWidget(page);
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');

  await page.locator('[data-testid="embed-panel-state-card"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "card");
  await page.locator('[data-testid="embed-panel-state-preview"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "preview");
  await page.locator('[data-testid="embed-panel-state-embed"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "embed");
  await page.locator('[data-testid="embed-panel-state-card"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "card");
  await expect(widget.locator(".cm-embed-name-text")).toHaveText("note.md");

  // 切回 embed 态再取消选中：card 态整个可见区是头部，直接点会命中头部
  // 触发「在新标签页打开」的既有路径（#852），点不到容器本身。
  await page.locator('[data-testid="embed-panel-state-embed"]').click();
  await expect(widget).toHaveAttribute("data-embed-state", "embed");
  await page.locator('[data-testid="pane-header"]').click();
  await expect(page.locator('[data-testid="embed-panel"]')).toHaveCount(0);
  await expect(widget).toHaveAttribute("data-selected", "false");
  await expect(widget.locator(".cm-image-handle")).toHaveCount(0);
  await shot(page, "06-roundtrip-card", "roundtrip-card");

  // 取消选中后重新选中：三态从会话态恢复（持久化）。
  await widget.click();
  await expect(widget).toHaveAttribute("data-embed-state", "embed");
  await expect(widget).toHaveAttribute("data-selected", "true");
});

test("A-3.8 拖边框后文档 {width=…} 变化并写回", async ({ page }) => {
  await openDoc(page, `![note](${MD_PATH})\n`, "resize");
  const widget = page.locator('.cm-embed-widget[data-embed-kind="md"]');
  await expect(widget.locator(".cm-embed-md h1")).toHaveText("内嵌标题");
  await widget.click();
  await expect(widget.locator(".cm-image-handle")).toHaveCount(8);

  const before = await activeContent(page);
  expect(before).not.toContain("width=");

  const eHandle = widget.locator('.cm-image-handle[data-handle="e"]');
  const eBox = (await eHandle.boundingBox())!;
  await page.mouse.move(eBox.x + eBox.width / 2, eBox.y + eBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(eBox.x + 90, eBox.y + eBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(async () => activeContent(page))
    .toMatch(/\{width=\d+ height=\d+\}/);
  const after = await activeContent(page);
  expect(after).not.toBe(before);
  await shot(page, "05-resized", "resized");
});
