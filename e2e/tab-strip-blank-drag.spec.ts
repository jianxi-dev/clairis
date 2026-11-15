import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 页签条空白处拖动窗口（#855 / C2 / A-21.1、A-21.2）。
 *
 * mock 环境没有真实窗口位移：tauri-mock.js 记录 plugin:window|start_dragging
 * 调用次数到 window.__dragCalls__。本 spec 断言的是「超阈值 → startDragging 被调用」
 * 「页签区按下 → 未被调用」「未超阈值 → 未被调用」，不代表真实窗口位移。
 */

const ART = path.resolve(process.cwd(), ".artifacts/855");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

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
  await page.addInitScript(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__: {
        invoke: (cmd: string, args?: unknown) => unknown;
        metadata: Record<string, unknown>;
      };
      __dragCalls__: number;
    };
    // getCurrentWindow() 读 metadata.currentWindow.label，mock 默认没有，补一个。
    w.__TAURI_INTERNALS__.metadata = {
      ...w.__TAURI_INTERNALS__.metadata,
      currentWindow: { label: "main" },
    };
    w.__dragCalls__ = 0;
  });
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
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
    .poll(() => page.locator("[data-tab-id]").count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

function dragCalls(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __dragCalls__: number }).__dragCalls__,
  );
}

async function blankPoint(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator(".tab-strip").first().boundingBox())!;
  return { x: box.x + box.width - 10, y: box.y + box.height / 2 };
}

async function tabPoint(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator("[data-tab-id]").first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function pressMoveUp(
  page: Page,
  from: { x: number; y: number },
  dx: number,
  dy: number,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await page.mouse.up();
}

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

test("空白处按下移动超阈值触发窗口拖动（A-21.1）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/855-blank-drag.md");
  const from = await blankPoint(page);
  await pressMoveUp(page, from, 40, 0);
  expect(await dragCalls(page)).toBe(1);
  await shot(page, "blank-drag-started");
});

test("页签本体按下移动不触发窗口拖动（A-21.2）", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/855-tab-a.md");
  await openFile(page, "/tmp/855-tab-b.md");
  const from = await tabPoint(page);
  await pressMoveUp(page, from, 40, 0);
  expect(await dragCalls(page)).toBe(0);
  await shot(page, "tab-press-no-drag");
});

test("空白处按下未超阈值视为点击，不触发窗口拖动", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/855-sub-a.md");
  await openFile(page, "/tmp/855-sub-b.md");
  const from = await blankPoint(page);
  await pressMoveUp(page, from, 2, 0);
  expect(await dragCalls(page)).toBe(0);
  await shot(page, "sub-threshold-click");
});

test("页签关闭按钮区域按下移动不触发窗口拖动（A-21.2 按钮半区）", async ({
  page,
}) => {
  await boot(page);
  await openFile(page, "/tmp/855-btn.md");
  // 关闭按钮默认 pointer-events-none，先悬停页签本体触发 group-hover 再取按钮。
  await page.locator("[data-tab-id]").first().hover();
  const close = page.locator("[data-tab-id] button").first();
  await close.hover();
  const box = (await close.boundingBox())!;
  await pressMoveUp(
    page,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    40,
    0,
  );
  expect(await dragCalls(page)).toBe(0);
  await shot(page, "button-press-no-drag");
});

test("空白处按下（未移动）不触发窗口拖动", async ({ page }) => {
  await boot(page);
  await openFile(page, "/tmp/855-idle.md");
  const from = await blankPoint(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await dragCalls(page)).toBe(0);
  await shot(page, "blank-press-idle");
});
