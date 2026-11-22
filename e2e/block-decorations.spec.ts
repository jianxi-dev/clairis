import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { hostname as osHostname } from "node:os";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/714");
const ART_918 = path.resolve(process.cwd(), ".artifacts/918");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

mkdirSync(ART, { recursive: true });
mkdirSync(ART_918, { recursive: true });

type Assertion = "passed" | "failed" | "untested";
interface StateRow {
  state: string;
  screenshot: string;
  assertion: Assertion;
  recorded_at: string;
  runner: string;
}
const states: StateRow[] = [];

async function record(
  page: Page,
  state: string,
  assertion: Assertion = "passed",
): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion,
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${osHostname()}`,
  });
}

/** 写真实截图并登记到 .artifacts/918/state-coverage.json（#918 证据面）。 */
async function record918(
  page: Page,
  state: string,
  assertion: Assertion = "passed",
): Promise<void> {
  const file = path.join(ART_918, `${state}.png`);
  await page.screenshot({ path: file });
  execFileSync(
    EVIDENCE,
    [
      "record-state",
      ART_918,
      "--state",
      state,
      "--screenshot",
      path.relative(process.cwd(), file),
      "--assertion",
      assertion,
    ],
    { stdio: "ignore" },
  );
}

/** 读当前页签的原文（store 是纯文本真相源）。 */
async function readDoc(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    const tab = Object.values(s.tabs).find(
      (t: any) => typeof t?.content === "string",
    );
    return (tab?.content as string) ?? "";
  });
}

test.afterAll(() => {
  const byState = new Map<string, StateRow>();
  for (const row of states) byState.set(row.state, row);
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify(
      {
        task: "19.1",
        change: "editor-surface-batch16",
        issue: 714,
        states: [...byState.values()],
      },
      null,
      2,
    )}\n`,
  );
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
});

/** 打开一个 markdown 页签、切到编辑模式，光标停在文末正文（块非活跃）。 */
async function openInactive(page: Page, path: string, content: string) {
  await page.evaluate(
    ({ p, c }) => {
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        p,
        c,
        p.split("/").pop(),
      );
    },
    { p: path, c: content },
  );
  const modeBtn = page.locator('[data-testid="pane-mode"]').first();
  if ((await modeBtn.getAttribute("data-mode")) !== "edit")
    await modeBtn.click();
  const editor = page.locator(".cm-content");
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  return editor;
}

/** 在行的左缘 25% 召唤区里移动指针（与 block-handle.spec.ts 同法）。 */
async function hoverLineLeft(page: Page, line: ReturnType<Page["locator"]>) {
  const box = (await line.boundingBox())!;
  const content = await page.evaluate(() => {
    const rect = (
      document.querySelector(".cm-content") as HTMLElement
    ).getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.mouse.move(
    Math.max(box.x, content.left + content.width * 0.1),
    box.y + box.height / 2,
  );
}

test("分割线渲染为装饰块", async ({ page }) => {
  await openInactive(page, "/Users/test/bd-hr.md", "---\n\n正文");
  await expect(page.locator(".cm-thematic-break").first()).toBeVisible();
});

test("链接渲染为链接装饰且非活跃块隐藏源标记", async ({ page }) => {
  await openInactive(
    page,
    "/Users/test/bd-link.md",
    "[示例](https://example.com)\n\n正文",
  );
  const link = page.locator(".cm-link").first();
  await expect(link).toBeVisible();
  await expect(link).toHaveText("示例");
});

test("相对图片路径解析成 asset://（桌面端不再退化成文字）", async ({
  page,
}) => {
  // 行为变更（#103）：应用现在始终提供图片解析器，相对引用会落到文档目录
  // 并换成 asset://；只有解析不出来（浏览器 / 未保存文档）才退化成 alt 文本。
  await openInactive(
    page,
    "/Users/test/bd-image.md",
    "![示意图](missing.png)\n\n正文",
  );
  await expect(page.locator(".cm-image-widget").first()).toBeVisible();
  await expect(
    page.locator('.cm-image-widget img[src^="asset://"]').first(),
  ).toHaveAttribute("src", /asset:\/\//);
});

test("mermaid 块在非活跃时出图容器", async ({ page }) => {
  await openInactive(
    page,
    "/Users/test/bd-mermaid.md",
    "```mermaid\ngraph TD;\nA-->B;\n```\n\n正文",
  );
  await expect(page.locator(".cm-mermaid-block").first()).toBeVisible();
  await expect(page.locator(".cm-content")).not.toContainText("```mermaid");
});

test("任务方框 3px 圆角且手柄 / 插入菜单图标为方框内打勾", async ({ page }) => {
  const editor = await openInactive(
    page,
    "/Users/test/bd-task-icon.md",
    "- [ ] 任务一\n\n正文",
  );
  const checkbox = page.locator(".cm-task-checkbox").first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).toHaveCSS("border-radius", "3px");
  await record(page, "task-row");

  const line = page.locator(".cm-line").filter({ hasText: "任务一" }).first();
  await hoverLineLeft(page, line);
  const handle = page.locator('.cm-block-handle[data-block-from="0"]');
  await expect(handle).toHaveClass(/cm-block-handle-visible/, {
    timeout: 3000,
  });
  const handleIcon = handle.locator('svg[data-icon="TodoOutlined"]');
  await expect(handleIcon).toBeVisible();
  await expect(handleIcon.locator("path")).toHaveCount(2);
  await record(page, "handle-icon");

  await editor.click();
  await page.keyboard.press("Control+End");
  // 斜杠只在词首触发：先回到空行，再输入 `/`。
  await page.keyboard.press("ArrowUp");
  await page.keyboard.type("/");
  const menu = page.locator(".mdb-slash-menu");
  await expect(menu).toBeVisible();
  const label = page
    .locator(".mdb-slash-item-label")
    .filter({ hasText: /^任务$/ });
  await expect(label).toHaveCount(1);
  const menuIcon = label
    .locator("xpath=..")
    .locator('svg[data-icon="TodoOutlined"]');
  await expect(menuIcon).toBeVisible();
  await expect(menuIcon.locator("path")).toHaveCount(2);
  await record(page, "insert-menu-icon");

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  await checkbox.click();
  await expect(checkbox).toHaveAttribute("data-checked", "true");
  const afterContent = await checkbox.evaluate(
    (el) => getComputedStyle(el, "::after").content,
  );
  expect(afterContent).not.toBe("none");
  await expect(checkbox).toHaveCSS("border-radius", "3px");
  await record(page, "checked");
});

test("Tab 缩进后引用块装饰仍在位、可编辑、手柄可召唤", async ({ page }) => {
  await openInactive(
    page,
    "/Users/test/bd-quote-tab.md",
    "> 引用第一行\n> 引用第二行\n\n正文段落",
  );
  const quotes = page.locator(".cm-editor .cm-line.cm-quote");
  await expect(quotes).toHaveCount(2);

  const before = await page.evaluate(() => {
    const q = document.querySelector(
      ".cm-editor .cm-line.cm-quote",
    ) as HTMLElement;
    const body = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ].find((el) => (el.textContent ?? "").includes("正文段落"))!;
    const qr = q.getBoundingClientRect();
    const br = body.getBoundingClientRect();
    return { quoteLeft: qr.left, quoteRight: qr.right, bodyRight: br.right };
  });
  const twoSpaces = await page.evaluate(() => {
    const cm = document.querySelector(".cm-editor .cm-content") as HTMLElement;
    const cs = getComputedStyle(cm);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
    return ctx.measureText("  ").width;
  });

  await quotes.first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");

  // 缩进行丢装饰是当前缺陷：修复前计数 2 → 1。
  if ((await quotes.count()) !== 2) {
    await record918(page, "tab1-decoration-lost-red", "failed");
  }
  await expect(quotes).toHaveCount(2);

  const after = await page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    const tab = Object.values(s.tabs).find(
      (t: any) => typeof t?.content === "string",
    );
    const qs = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line.cm-quote"),
    ];
    const q = qs[0];
    const body = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ].find((el) => (el.textContent ?? "").includes("正文段落"))!;
    const qr = q.getBoundingClientRect();
    const br = body.getBoundingClientRect();
    return {
      firstLine: ((tab?.content as string) ?? "").split("\n")[0],
      quoteLeft: qr.left,
      quoteRight: qr.right,
      bodyRight: br.right,
      count: qs.length,
    };
  });

  expect(after.firstLine).toBe("  > 引用第一行");
  // 左侧随层级空格右移（±2px）；右侧与正文右缘严格相等。
  expect(
    Math.abs(after.quoteLeft - before.quoteLeft - twoSpaces),
  ).toBeLessThanOrEqual(2);
  expect(after.quoteRight - after.bodyRight).toBe(0);
  await record918(page, "tab1-decoration-kept");
  await record918(page, "tab1-left-border-indented");

  // 手柄可召唤：data-block-from 指向该行可见文本起点（行首 0 + 缩进 2 + 隐藏标记 2）。
  await hoverLineLeft(page, quotes.first());
  const handle = page
    .locator(".cm-block-handle.cm-block-handle-visible")
    .first();
  await expect(handle).toBeVisible({ timeout: 3000 });
  const from = Number(await handle.getAttribute("data-block-from"));
  expect(from).toBeLessThanOrEqual(4);
  await record918(page, "tab1-handle-summoned");

  // 可输入：新字进入文档且装饰不丢。
  await page.mouse.move(0, 0);
  await quotes.first().click();
  await page.keyboard.press("End");
  await page.keyboard.type("追加");
  await expect(quotes).toHaveCount(2);
  // 内容快照走 300ms 防抖（ADR 0003），store 收敛需要轮询。
  await expect
    .poll(async () => (await readDoc(page)).split("\n")[0])
    .toBe("  > 引用第一行追加");
  await record918(page, "tab1-editable");
});

test("Tab 两次（4 空格）脱离引用按 CommonMark 优雅退化", async ({ page }) => {
  await openInactive(
    page,
    "/Users/test/bd-quote-tab2.md",
    "> 引用第一行\n> 引用第二行\n\n正文段落",
  );
  const quotes = page.locator(".cm-editor .cm-line.cm-quote");
  await expect(quotes).toHaveCount(2);

  await quotes.first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");

  const state = await page.evaluate(() => {
    const s = (
      window as unknown as Record<string, any>
    ).__biaoyue_store__.getState();
    const tab = Object.values(s.tabs).find(
      (t: any) => typeof t?.content === "string",
    );
    const qs = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line.cm-quote"),
    ];
    const firstLineEl = [
      ...document.querySelectorAll<HTMLElement>(".cm-editor .cm-line"),
    ].find((el) => (el.textContent ?? "").includes("引用第一行"));
    return {
      firstLine: ((tab?.content as string) ?? "").split("\n")[0],
      quoteCount: qs.length,
      firstLineIsQuote: firstLineEl?.classList.contains("cm-quote") ?? false,
      quoteTexts: qs.map((q) => q.textContent),
    };
  });

  expect(state.firstLine).toBe("    > 引用第一行");
  // 4 空格是缩进代码块：第一行不再是引用，第二行引用保留，无残留装饰、无崩溃。
  expect(state.firstLineIsQuote).toBe(false);
  expect(state.quoteCount).toBe(1);
  expect(state.quoteTexts[0]).toBe("引用第二行");

  const firstLine = page
    .locator(".cm-editor .cm-line")
    .filter({ hasText: "引用第一行" })
    .first();
  await hoverLineLeft(page, firstLine);
  const handle = page
    .locator(".cm-block-handle.cm-block-handle-visible")
    .first();
  await expect(handle).toBeVisible({ timeout: 3000 });
  await record918(page, "tab2-graceful-degradation");
});
