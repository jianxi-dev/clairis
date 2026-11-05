import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 终验六态走查（layout-portal 16.1 / #186，QG-6 checkpoint ⑤）。
 *
 * 打开 → 浏览 → 编辑 → 切换场景 → 取消操作 → 关闭恢复。
 * 走 e2e/mocks/tauri-mock.js，用 window.__biaoyue_store__ 桥驱动状态。
 * 每个 state 截图落 .artifacts/186/，收尾写 state-coverage.json（≥6 states）。
 * 无固定 sleep：一律 expect.poll / locator 等待。
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/186");

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
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
}

test.afterAll(() => {
  const byState = new Map<string, StateRow>();
  for (const row of states) byState.set(row.state, row);
  const payload = {
    task: "186-walkthrough",
    states: [...byState.values()],
  };
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
});

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 15000 });
}

function scene(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __biaoyue_store__: { getState: () => { scene: string } };
        }
      ).__biaoyue_store__.getState().scene,
  );
}

function activeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            activeTabId: string | null;
            tabs: Record<string, { content: string }>;
          };
        };
      }
    ).__biaoyue_store__.getState();
    const id = s.activeTabId;
    return id ? (s.tabs[id]?.content ?? "") : "";
  });
}

async function openFile(
  page: Page,
  filePath: string,
  content: string,
  title: string,
): Promise<void> {
  await page.evaluate(
    ({ path: p, content: c, title: t }) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (p: string, c: string, t: string) => void;
        }
      ).__biaoyue_openFile__(p, c, t);
    },
    { path: filePath, content, title },
  );
  await expect.poll(() => scene(page)).toBe("workspace");
}

test("终验六态走查：打开→浏览→编辑→切换场景→取消操作→关闭恢复", async ({
  page,
}) => {
  await boot(page);

  // ── 1. 打开：冷启动门户 → 打开文件 → 工作区有内容 ──
  await expect(page.locator('[data-testid="portal"]')).toBeVisible();
  await record(page, "01-open-portal");

  await openFile(
    page,
    "/tmp/walkthrough/a.md",
    "# 走查笔记\n\n这是正文内容。",
    "走查笔记",
  );
  await expect(page.locator(".preview-content")).toContainText("走查笔记");
  await record(page, "01-open-workspace");

  // ── 2. 浏览：⌘⇧\ 网格 → 点卡预览 → Esc 回网格 → Esc 回门户 ──
  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();

  const tile = page.locator("[data-grid-item]").first();
  await tile.locator("[data-tile-thumb]").click();
  await expect(page.locator('[data-testid="floating-preview"]')).toBeVisible();
  await record(page, "02-browse-preview");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="grid"]')).toHaveCount(0);
  await expect.poll(() => scene(page)).toBe("portal");
  await record(page, "02-browse-back");

  // ── 3. 编辑：回工作区 → 切编辑态 → 输入文字 → 内容持久 ──
  await page.locator('[data-testid="portal-hero"]').click();
  await expect.poll(() => scene(page)).toBe("workspace");

  await page.keyboard.press("Control+Shift+M");
  await expect(page.locator(".cm-content")).toBeVisible();
  await page.locator(".cm-content").click();
  await page.keyboard.type("追加的走查文字");
  await expect.poll(() => activeContent(page)).toContain("追加的走查文字");
  await record(page, "03-edit-typed");

  // ── 4. 切换场景：工作区 → 设置 → Esc 回工作区 → 网格 → Enter 回工作区 ──
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await record(page, "04-scene-settings");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
  await expect.poll(() => scene(page)).toBe("workspace");

  await page.keyboard.press("Control+Shift+Backslash");
  await expect(page.locator('[data-testid="grid"]')).toBeVisible();
  await record(page, "04-scene-grid");

  await page.keyboard.press("Enter");
  await expect.poll(() => scene(page)).toBe("workspace");
  await expect(page.locator('[data-testid="grid"]')).toHaveCount(0);
  await expect(page.locator(".cm-content")).toBeVisible();
  await record(page, "04-scene-back-workspace");

  // ── 5. 取消操作：开 AI 浮层 → Esc 关闭，无残留 ──
  await page.keyboard.press("Meta+k");
  await expect(page.locator("[data-ai-overlay]")).toBeVisible();
  await record(page, "05-cancel-ai-open");

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ai-overlay]")).toHaveCount(0);
  await expect.poll(() => scene(page)).toBe("workspace");
  await expect(page.locator(".cm-content")).toBeVisible();
  await record(page, "05-cancel-ai-closed");

  // ── 6. 关闭恢复：分裂格 → 关聚焦格 → 单格工作区，内容仍在，无残留浮层 ──
  await page.keyboard.press("Control+Alt+ArrowRight");
  await expect(page.locator("[data-pane-id]")).toHaveCount(2);
  await record(page, "06-close-split");

  await page
    .locator('[data-pane-id][data-focused="true"] [data-testid="pane-close"]')
    .click();
  await expect(page.locator("[data-pane-id]")).toHaveCount(1);
  await expect.poll(() => scene(page)).toBe("workspace");
  await expect(page.locator(".cm-content")).toBeVisible();
  await expect(page.locator("[data-ai-overlay]")).toHaveCount(0);
  await expect(page.locator('[data-testid="floating-preview"]')).toHaveCount(0);
  await record(page, "06-close-recovered");
});
