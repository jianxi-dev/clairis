import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1050");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

/** 写真实截图并登记到 state-coverage.json（ui-surface 证据面）。 */
async function shot(target: Page | Locator, name: string): Promise<void> {
  const file = path.join(ART, `${name}.png`);
  await target.screenshot({ path: file });
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
}

async function readContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: { getState: () => {
          tabs: Record<string, { content: string }>;
          activeTabId: string;
        } };
      }
    ).__biaoyue_store__.getState();
    return s.tabs[s.activeTabId]?.content ?? "";
  });
}

const DOC = [
  "# 第一章",
  "",
  "开场。",
  "",
  "```md",
  "# 代码里的井号",
  "```",
  "",
  "## 第一节",
  "",
  "正文。",
  "",
  "### 小节 A",
  "",
  ...Array.from({ length: 24 }, (_, i) => `填充段落 ${i + 1}。`).flatMap(
    (line) => [line, ""],
  ),
  "## 第二节",
  "",
  ...Array.from({ length: 24 }, (_, i) => `尾段 ${i + 1}。`).flatMap((line) => [
    line,
    "",
  ]),
].join("\n");

async function openDoc(page: Page, mode: "edit" | "preview") {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(
    ({ body, mode }) => {
      const store = (window as unknown as Record<string, any>)
        .__biaoyue_store__;
      (window as unknown as Record<string, any>).__biaoyue_openFile__(
        "/tmp/outline.md",
        body,
        "outline.md",
      );
      store.getState().setEditorMode(mode);
    },
    { body: DOC, mode },
  );
  if (mode === "preview") {
    await page.locator(".preview-content").waitFor({ timeout: 10000 });
  } else {
    await page.locator(".cm-content").waitFor({ timeout: 10000 });
  }
  await page.waitForTimeout(400);
}

test("编辑态大纲按钮：列出真实标题并跳过代码块", async ({ page }) => {
  await openDoc(page, "edit");

  const button = page.locator('[data-testid="outline-btn"]');
  await expect(button).toBeVisible();

  await button.hover();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible({ timeout: 3000 });

  const items = menu.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toHaveText(/第一章/);
  await expect(items.nth(1)).toHaveText(/第一节/);
  await expect(items.nth(2)).toHaveText(/小节 A/);
  await expect(items.nth(3)).toHaveText(/第二节/);
  await expect(menu).not.toContainText("代码里的井号");
});

test("点击大纲项滚动到标题，Esc 收起", async ({ page }) => {
  await openDoc(page, "edit");

  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible();

  await menu.locator('[data-testid="outline-item-3"]').click();

  const scroller = page.locator(".cm-scroller");
  await expect
    .poll(async () => scroller.evaluate((el) => el.scrollTop), {
      timeout: 3000,
    })
    .toBeGreaterThan(0);

  const distance = await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    const line = [...document.querySelectorAll(".cm-line")].find((el) =>
      (el.textContent ?? "").includes("第二节"),
    ) as HTMLElement | undefined;
    if (!line) return Number.POSITIVE_INFINITY;
    return Math.abs(
      line.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
    );
  });
  expect(distance).toBeLessThan(80);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("预览态大纲列出 DOM 标题", async ({ page }) => {
  await openDoc(page, "preview");
  await page.locator(".preview-content").waitFor({ timeout: 10000 });

  await page.locator('[data-testid="outline-btn"]').hover();
  const items = page.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(4, { timeout: 3000 });
  await expect(items.nth(0)).toHaveText(/第一章/);
});

test("切换页签后大纲跟随当前文档", async ({ page }) => {
  await openDoc(page, "edit");

  await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/other.md",
      "# 另一篇\n\n## 另一节\n",
      "other.md",
    );
  });
  await page.waitForTimeout(400);

  await page.locator('[data-testid="outline-btn"]').hover();
  const items = page.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(2, { timeout: 3000 });
  await expect(items.nth(0)).toHaveText(/另一篇/);
});

test("大纲按钮：默认透明底方形圆角，钉住后显示强调色背景", async ({ page }) => {
  await openDoc(page, "edit");

  const button = page.locator('[data-testid="outline-btn"]');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("data-pinned", "false");

  const background = () =>
    button.evaluate((el) => getComputedStyle(el).backgroundColor);
  const radius = () =>
    button.evaluate((el) => getComputedStyle(el).borderRadius);

  expect(await background()).toBe("rgba(0, 0, 0, 0)");
  expect(await radius()).toBe("8px");

  await button.click();
  await expect(button).toHaveAttribute("data-pinned", "true");
  await expect.poll(async () => background()).not.toBe("rgba(0, 0, 0, 0)");
});

test("条目去掉前导竖线，改为 H 等级徽标（#925）", async ({ page }) => {
  await openDoc(page, "edit");
  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible();

  // 前导竖线是 .biaoyue-outline-bar DOM 节点；移除后节点数必须为 0。
  expect(await menu.locator(".biaoyue-outline-bar").count()).toBe(0);

  const badges = menu.locator("[data-outline-level]");
  expect(await badges.count()).toBeGreaterThanOrEqual(1);
  await expect(badges.nth(0)).toHaveAttribute("data-outline-level", "H1");
  await expect(badges.nth(1)).toHaveAttribute("data-outline-level", "H2");
  await expect(badges.nth(2)).toHaveAttribute("data-outline-level", "H3");

  // 竖线也不是 CSS 画的：条目自身无左描边、无 ::before 伪元素内容。
  const style = await menu
    .locator('[data-testid="outline-item-0"]')
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      const before = getComputedStyle(el, "::before");
      return { borderLeftWidth: cs.borderLeftWidth, beforeContent: before.content };
    });
  console.log(
    `[925] item borderLeftWidth=${style.borderLeftWidth} ::before content=${style.beforeContent}`,
  );
  expect(style.borderLeftWidth).toBe("0px");
  expect(style.beforeContent).toBe("none");

  await page.screenshot({ path: ".artifacts/925/outline-level-badges.png" });
});

test("拖动条目重排正文并清除持久化顺序（#925 → #1050）", async ({ page }) => {
  await openDoc(page, "edit");
  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible();

  const items = menu.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toHaveText(/第一章/);
  await expect(items.nth(3)).toHaveText(/第二节/);

  // 把 第二节 拖到最前。第一章 是唯一的 H1，整篇都是它的子级，拖它无意义。
  const box3 = await items.nth(3).boundingBox();
  const box0 = await items.nth(0).boundingBox();
  if (!box3 || !box0) throw new Error("大纲条目无边界");
  const x = box3.x + box3.width / 2;

  await page.mouse.move(x, box3.y + box3.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box0.y + box0.height / 2 - 1, { steps: 4 });
  await page.mouse.up();

  // 松手后显示顺序 = 正文顺序。
  await expect(items.nth(0)).toHaveText(/第二节/);
  await expect(items.nth(1)).toHaveText(/第一章/);
  const content = await readContent(page);
  expect(content.indexOf("## 第二节")).toBeLessThan(content.indexOf("# 第一章"));

  // 正文已同步，旧的显示顺序必须清除，否则二次排序。
  const stored = await page.evaluate(
    () => localStorage.getItem("outline-order:/tmp/outline.md"),
  );
  expect(stored).toBeNull();

  // 拖完不得触发点击跳转：编辑器滚动位置保持不变。
  const scrollTop = await page
    .locator(".cm-scroller")
    .evaluate((el) => el.scrollTop);
  expect(scrollTop).toBe(0);
});

// ── #1050：轨迹 / 正文同步 / 取消 / 同级徽标 ─────────────────────

const REORDER_DOC = [
  "# 甲",
  "",
  "甲文。",
  "",
  "## 甲一",
  "",
  "甲一文。",
  "",
  "# 乙",
  "",
  "乙文。",
  "",
].join("\n");

// 甲 的区段含其尾部空行（标题行到下一个同级标题前一行），移动后该空行落到文末。
const REORDERED_DOC =
  "# 乙\n\n乙文。\n# 甲\n\n甲文。\n\n## 甲一\n\n甲一文。\n\n";

async function openReplayDoc(page: Page) {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/outline-reorder.md",
      body,
      "outline-reorder.md",
    );
    (window as unknown as Record<string, any>)
      .__biaoyue_store__.getState()
      .setEditorMode("edit");
  }, REORDER_DOC);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator('[data-testid="outline-btn"]').click();
  await expect(
    page.locator('[data-testid="outline-menu"]'),
  ).toBeVisible({ timeout: 3000 });
}

test("#1050 拖动出现轨迹，松手后正文与新大纲一致", async ({ page }) => {
  await openReplayDoc(page);
  const items = page.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(3);

  const box0 = await items.nth(0).boundingBox();
  const box1 = await items.nth(1).boundingBox();
  if (!box0 || !box1) throw new Error("大纲条目无边界");
  const x = box0.x + box0.width / 2;

  await page.mouse.move(x, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box1.y + box1.height / 2 + 1, { steps: 4 });

  // 轨迹元素在拖动期间可见。
  await expect(page.locator('[data-testid="outline-ghost"]')).toBeVisible();
  // 插入位置指示条出现并随指针移动（A-2.1）。
  const indicator = page.locator('[data-testid="outline-drop-indicator"]');
  await expect(indicator).toBeVisible();
  const indicatorY = () =>
    indicator.evaluate((el) => el.getBoundingClientRect().top);
  const y1 = await indicatorY();
  await page.mouse.move(x, box0.y + box0.height / 2, { steps: 4 });
  const y2 = await indicatorY();
  expect(y2).not.toBe(y1);
  // 回到目标落点再松手，避免回退把重排取消。
  await page.mouse.move(x, box1.y + box1.height / 2 + 1, { steps: 4 });
  await shot(page, "01-drag-trail");

  await page.mouse.up();
  await expect(indicator).toHaveCount(0);

  await expect(items.nth(0)).toHaveText(/乙/);
  await expect(items.nth(1)).toHaveText(/甲/);
  expect(await readContent(page)).toBe(REORDERED_DOC);
  await shot(page, "02-body-synced");

  // 一次 Ctrl+Z 回到重排前（单事务）。
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+z");
  expect(await readContent(page)).toBe(REORDER_DOC);
});

test("#1050 拖动取消（Esc）后正文与大纲回到原状", async ({ page }) => {
  await openReplayDoc(page);
  const items = page.locator('[data-testid^="outline-item-"]');

  const box0 = await items.nth(0).boundingBox();
  const box1 = await items.nth(1).boundingBox();
  if (!box0 || !box1) throw new Error("大纲条目无边界");
  const x = box0.x + box0.width / 2;

  await page.mouse.move(x, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box1.y + box1.height / 2 + 1, { steps: 4 });
  await expect(page.locator('[data-testid="outline-ghost"]')).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.locator('[data-testid="outline-ghost"]')).toHaveCount(0);
  expect(await readContent(page)).toBe(REORDER_DOC);
  await expect(items.nth(0)).toHaveText(/甲/);
  await shot(page, "03-cancel-restores");
});

test("#1050 每项持有层级标识，仅悬停项可见且颜色更浅（A-2.3…A-2.6）", async ({
  page,
}) => {
  const doc = ["# 题", "", "## 一", "", "## 二", "", "## 三", ""].join("\n");
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/outline-badge.md",
      body,
      "outline-badge.md",
    );
    (window as unknown as Record<string, any>)
      .__biaoyue_store__.getState()
      .setEditorMode("edit");
  }, doc);
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible();

  // A-2.3：三个连续同级二级标题各持标识节点。
  const badges = menu.locator('[data-outline-level="H2"]');
  await expect(badges).toHaveCount(3);

  // A-2.4：非悬停项的标识不可见。
  await expect(menu.locator("[data-outline-level]:visible")).toHaveCount(0);

  // A-2.5：悬入某项后仅该项标识可见。
  await menu.locator('[data-testid="outline-item-1"]').hover();
  await expect(badges.nth(0)).toBeVisible();

  // A-2.6：标识计算色严格等于 §6 更浅一档语义色 --app-text-3 的解释值。
  const tokenColor = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--app-text-3)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  const badgeColor = await badges
    .nth(0)
    .evaluate((el) => getComputedStyle(el).color);
  expect(badgeColor).toBe(tokenColor);

  await shot(page, "04-badges-hover-only");
});

// ── #1050（batch23）：预览态正文顺序同步缺陷复现（A-2.2，先红后绿） ──

test("#1050 预览态松手后正文顺序与大纲一致（缺陷复现）", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate((body) => {
    (window as unknown as Record<string, any>).__biaoyue_openFile__(
      "/tmp/outline-reorder-preview.md",
      body,
      "outline-reorder-preview.md",
    );
    (window as unknown as Record<string, any>)
      .__biaoyue_store__.getState()
      .setEditorMode("preview");
  }, REORDER_DOC);
  await page.locator(".preview-content").waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);

  await page.locator('[data-testid="outline-btn"]').click();
  const menu = page.locator('[data-testid="outline-menu"]');
  await expect(menu).toBeVisible({ timeout: 3000 });

  const items = page.locator('[data-testid^="outline-item-"]');
  await expect(items).toHaveCount(3);

  const box0 = await items.nth(0).boundingBox();
  const box1 = await items.nth(1).boundingBox();
  if (!box0 || !box1) throw new Error("大纲条目无边界");
  const x = box0.x + box0.width / 2;

  await page.mouse.move(x, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box1.y + box1.height / 2 + 1, { steps: 4 });
  await page.mouse.up();

  // 大纲显示顺序已变。
  await expect(items.nth(0)).toHaveText(/乙/);

  // 正文必须同步：乙 的标题行必须排在 甲 之前。
  const content = await readContent(page);
  expect(content.indexOf("# 乙")).toBeLessThan(content.indexOf("# 甲"));
});
