import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * AI 两形态（layout-portal 9.1）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js 模拟 Tauri IPC，用 `window.__biaoyue_store__` 桥
 * 驱动状态。⌘ 用 Control 代替（App 判定 metaKey || ctrlKey）。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/179");

mkdirSync(ART, { recursive: true });

const PRESET_IDS = [
  "theme-groups",
  "pinned-recent-only",
  "pinned-scale",
  "grid-list",
  "grid-group-type",
  "unread-filter",
];

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

async function openFile(page: Page, p: string): Promise<void> {
  await page.evaluate((file) => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__(file, `# ${file.split("/").pop()}\n\n内容。`, "doc");
  }, p);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __biaoyue_store__: { getState: () => { scene: string } };
            }
          ).__biaoyue_store__.getState().scene,
      ),
    )
    .toBe("workspace");
}

function specOf(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __biaoyue_store__: {
            getState: () => { viewSpec: Record<string, unknown> };
          };
        }
      ).__biaoyue_store__.getState().viewSpec as Record<string, unknown>,
  );
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(ART, `${name}.png`) });
}

async function openBubble(page: Page): Promise<void> {
  await page.locator("[data-ai-entry]").click();
  await expect(page.locator("[data-ai-bubble]")).toBeVisible();
}

test("顶栏星芒是全站唯一 AI 入口；小窗默认 285×260 距右下 16px", async ({
  page,
}) => {
  await boot(page);
  await openFile(page, "/tmp/ai/a.md");

  await expect(page.locator("[data-ai-entry]")).toHaveCount(1);
  await openBubble(page);

  const bubble = page.locator("[data-ai-bubble]");
  await expect(bubble).toHaveAttribute("data-ai-form", "bubble");
  const box = await bubble.boundingBox();
  const vp = page.viewportSize();
  if (!box || !vp) throw new Error("小窗不可测量");
  expect(Math.round(box.width)).toBe(285);
  expect(Math.round(box.height)).toBe(260);
  expect(Math.abs(vp.width - (box.x + box.width) - 16)).toBeLessThanOrEqual(1);
  expect(Math.abs(vp.height - (box.y + box.height) - 16)).toBeLessThanOrEqual(
    1,
  );
  await expect(page.locator("[data-ai-resize]")).toHaveCount(8);
  await shot(page, "01-bubble-default");
});

test("小窗发消息 → 停靠为右 28% 窗格、历史连续；⋯ 脱离回小窗", async ({
  page,
}) => {
  await boot(page);
  await openFile(page, "/tmp/ai/b.md");
  await openBubble(page);

  await page.locator("[data-ai-input]").fill("换成深色主题");
  await page.locator("[data-ai-send]").click();
  await expect(page.locator("[data-ai-confirm-card]")).toBeVisible();
  await page.locator("[data-ai-confirm-ok]").click();
  await expect
    .poll(() => page.locator("[data-ai-message]").count())
    .toBeGreaterThanOrEqual(2);
  const before = await page.locator("[data-ai-message]").count();

  // 主题改动会触发一次配置热应用（把左侧栏重置为显示）；先收起左侧栏，
  // 使 pane 树容器 = workspace-body，再量停靠占比
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setSidebarLeftVisible: (v: boolean) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setSidebarLeftVisible(false);
  });

  await page.locator("[data-ai-dock-button]").click();
  await expect(page.locator("[data-ai-docked]")).toBeVisible();
  await expect(page.locator("[data-ai-bubble]")).toHaveCount(0);
  await expect
    .poll(() => page.locator("[data-ai-message]").count())
    .toBe(before);

  const body = await page
    .locator('[data-testid="workspace-body"]')
    .boundingBox();
  const ai = await page.locator('[data-pane-id="ai"]').boundingBox();
  if (!body || !ai) throw new Error("停靠窗格不可测量");
  const ratio = ai.width / body.width;
  expect(ratio).toBeGreaterThan(0.26);
  expect(ratio).toBeLessThan(0.3);
  await shot(page, "02-docked");

  await page.locator('[data-testid="ai-pane-menu-button"]').click();
  await page.locator('[data-ai-menu-item="undockAi"]').click();
  await expect(page.locator("[data-ai-bubble]")).toBeVisible();
  await expect(page.locator("[data-ai-docked]")).toHaveCount(0);
  await expect
    .poll(() => page.locator("[data-ai-message]").count())
    .toBe(before);
});

test("预设菜单恰好 6 条、固定顺序", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ai/c.md");
  await openBubble(page);

  await page.locator("[data-ai-presets-button]").click();
  const items = page.locator("[data-ai-preset]");
  await expect(items).toHaveCount(6);
  const ids = await items.evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-ai-preset")),
  );
  expect(ids).toEqual(PRESET_IDS);
  const labels = (await items.allInnerTexts()).map((t) => t.trim());
  expect(labels).toEqual([
    "按主题分组",
    "只留置顶和最近",
    "置顶段放大",
    "网格改列表",
    "网格按类型分组",
    "加未读筛选",
  ]);
  await shot(page, "03-presets-menu");
});

test("首弹人话确认卡；同类第二次静默 + 撤销条 3s 淡出 hover 重现，撤销后规格相等", async ({
  page,
}) => {
  await boot(page);
  await openFile(page, "/tmp/ai/d.md");
  await openBubble(page);

  const before = await specOf(page);

  await page.locator("[data-ai-presets-button]").click();
  await page.locator('[data-ai-preset="grid-list"]').click();
  const card = page.locator("[data-ai-confirm-card]");
  await expect(card).toBeVisible();
  await expect(card).toContainText("网格视图改为列表");
  await shot(page, "04-confirm-card");
  await page.locator("[data-ai-confirm-ok]").click();
  await expect.poll(() => specOf(page)).toMatchObject({ gridMode: "list" });
  const mid = await specOf(page);

  await page.locator("[data-ai-presets-button]").click();
  await page.locator('[data-ai-preset="unread-filter"]').click();
  await expect(page.locator("[data-ai-confirm-card]")).toHaveCount(0);
  await expect.poll(() => specOf(page)).toMatchObject({ unreadOnly: true });

  const bar = page.locator("[data-undo-bar]");
  await expect(bar).toBeVisible();
  await expect
    .poll(() => bar.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  await shot(page, "05-undo-bar");

  await expect
    .poll(() => bar.evaluate((el) => getComputedStyle(el).opacity), {
      timeout: 6000,
    })
    .toBe("0");
  await page.locator("[data-undo-hover-zone]").hover();
  await expect
    .poll(() => bar.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");

  await page.locator("[data-undo-button]").click();
  await expect.poll(() => specOf(page)).toEqual(mid);
  expect(mid).not.toEqual(before);
});

test("Esc 关闭确认卡且视图规格不变（无半写状态）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ai/e.md");
  await openBubble(page);

  const before = await specOf(page);
  await page.locator("[data-ai-presets-button]").click();
  await page.locator('[data-ai-preset="grid-list"]').click();
  await expect(page.locator("[data-ai-confirm-card]")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ai-confirm-card]")).toHaveCount(0);
  expect(await specOf(page)).toEqual(before);
  await shot(page, "06-esc-cancelled");
});

test("⌘⇧A 切换小窗 ⇄ 停靠窗格", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ai/f.md");

  await page.keyboard.press("Control+Shift+A");
  await expect(page.locator("[data-ai-bubble]")).toBeVisible();

  await page.keyboard.press("Control+Shift+A");
  await expect(page.locator("[data-ai-docked]")).toBeVisible();
  await expect(page.locator("[data-ai-bubble]")).toHaveCount(0);
  await shot(page, "08-toggle-docked");

  await page.keyboard.press("Control+Shift+A");
  await expect(page.locator("[data-ai-bubble]")).toBeVisible();
  await expect(page.locator("[data-ai-docked]")).toHaveCount(0);
});

test("快照面板最多 10 份，恢复后配置还原", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/ai/g.md");
  await openBubble(page);

  // 首次弹卡并确认（消耗本会话同类），其余同类静默执行
  await page.locator("[data-ai-presets-button]").click();
  await page.locator('[data-ai-preset="grid-list"]').click();
  await page.locator("[data-ai-confirm-ok]").click();
  await expect.poll(() => specOf(page)).toMatchObject({ gridMode: "list" });

  for (const id of [
    "unread-filter",
    "grid-group-type",
    "theme-groups",
    "pinned-scale",
    "pinned-recent-only",
  ]) {
    await page.locator("[data-ai-presets-button]").click();
    await page.locator(`[data-ai-preset="${id}"]`).click();
  }
  const changed = await specOf(page);

  await page.locator("[data-ai-history-button]").click();
  const panel = page.locator("[data-snapshot-panel]");
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.locator("li").count()).toBeGreaterThan(0);
  expect(await panel.locator("li").count()).toBeLessThanOrEqual(10);
  await shot(page, "07-snapshot-panel");

  await panel.locator("li").first().getByRole("button").click();
  await expect.poll(() => specOf(page)).not.toEqual(changed);
});
