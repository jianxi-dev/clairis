import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { hostname as osHostname } from "node:os";
import path from "node:path";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/714");

mkdirSync(ART, { recursive: true });

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
