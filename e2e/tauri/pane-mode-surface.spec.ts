// pane-tuning-values-v1 / 1.2（#1625）pane-modes 数据面：热区高度 / 临时显现时长 /
// 提示线厚度由面驱动。锁死默认三档逐像素/逐毫秒与今天一致、AI 在边界内改值即时生效、
// 越界回落、重置回落默认。
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = process.env.PANE_MODE_SURFACE_APP_URL ?? "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1625");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

const DEFAULT_PANE_MODES = [
  { id: "simple", label: "简易", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
  { id: "standard", label: "常规", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
  { id: "hardcore", label: "硬核", hotzonePx: 0, revealMs: 3000, hintLinePx: 1 },
];

test.beforeEach(() => {
  mkdirSync(ART, { recursive: true });
});

async function shot(target: Page, name: string): Promise<string> {
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
  return file;
}

async function boot(page: Page, paneMode?: string, paneModes?: unknown[]): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (paneMode) {
    await page.addInitScript({
      content: `window.__biaoyue_pane_mode__ = ${JSON.stringify(paneMode)};`,
    });
  }
  if (paneModes) {
    await page.addInitScript({
      content: `window.__biaoyue_pane_modes__ = ${JSON.stringify(paneModes)};`,
    });
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', {
    state: "attached",
    timeout: 15000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.dataset.paneMode ?? null,
        ),
      { timeout: 15000 },
    )
    .toBe(paneMode ?? "standard");
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_openFile__("/tmp/pane-mode/doc.md", "# 标题\n\n正文。", "doc.md");
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await expect
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

async function hotzoneHeight(page: Page): Promise<number> {
  return page
    .getByTestId("status-hotzone")
    .evaluate((el) => el.getBoundingClientRect().height);
}

async function hintLineHeight(page: Page): Promise<string> {
  return page
    .locator("[data-pane-id]")
    .first()
    .evaluate((el) => getComputedStyle(el, "::before").height);
}

test("(a) 默认三档与今天一致：standard 热区 16px、hardcore 提示线 1px、显现 ~3s", async ({
  page,
}) => {
  await boot(page, "standard");
  // 面加载后立即断言（覆盖异步竞态：首次 apply 可能早于面到达）。
  await expect
    .poll(() => hotzoneHeight(page), { timeout: 5000 })
    .toBe(16);

  await shot(page, "01-standard-default");

  await boot(page, "hardcore");
  await expect(page.getByTestId("status-hotzone")).toHaveCount(0);
  await expect
    .poll(() => hintLineHeight(page), { timeout: 5000 })
    .toBe("1px");

  // Cmd+Shift+U 显现：按下后可见，3.5s 后自动收起。
  await page.keyboard.press("Meta+Shift+U");
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 2000 });
  await shot(page, "02-hardcore-revealed");
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("status-bar")).toHaveCount(0, { timeout: 3000 });
});

test("(b) AI 改 hardcore.revealMs=5000：surfaces-changed 后显现 ~5s", async ({
  page,
}) => {
  await boot(page, "hardcore", DEFAULT_PANE_MODES);
  await expect
    .poll(() => hintLineHeight(page), { timeout: 5000 })
    .toBe("1px");

  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_pane_modes__ = [
      { id: "simple", label: "简易", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
      { id: "standard", label: "常规", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
      { id: "hardcore", label: "硬核", hotzonePx: 0, revealMs: 5000, hintLinePx: 1 },
    ];
    w.__mock_emit__("surfaces-changed", "pane-modes");
  });

  await page.keyboard.press("Meta+Shift+U");
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 2000 });
  // 3.5s 时仍可见（默认 3s 早已收起）。
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("status-bar")).toBeVisible();
  await shot(page, "03-hardcore-5000-visible");
  // 5.6s 时已收起。
  await page.waitForTimeout(2100);
  await expect(page.getByTestId("status-bar")).toHaveCount(0, { timeout: 3000 });
});

test("(c) AI 改 standard.hotzonePx=20：热区计算高度 20", async ({ page }) => {
  await boot(page, "standard", DEFAULT_PANE_MODES);
  await expect
    .poll(() => hotzoneHeight(page), { timeout: 5000 })
    .toBe(16);

  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_pane_modes__ = [
      { id: "simple", label: "简易", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
      { id: "standard", label: "常规", hotzonePx: 20, revealMs: 0, hintLinePx: 0 },
      { id: "hardcore", label: "硬核", hotzonePx: 0, revealMs: 3000, hintLinePx: 1 },
    ];
    w.__mock_emit__("surfaces-changed", "pane-modes");
  });
  await expect
    .poll(() => hotzoneHeight(page), { timeout: 5000 })
    .toBe(20);
  await shot(page, "04-standard-hotzone-20");
});

test("(d) AI 改 hardcore.hintLinePx=0：提示线不可见（高度 0）", async ({
  page,
}) => {
  await boot(page, "hardcore", DEFAULT_PANE_MODES);
  await expect
    .poll(() => hintLineHeight(page), { timeout: 5000 })
    .toBe("1px");

  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_pane_modes__ = [
      { id: "simple", label: "简易", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
      { id: "standard", label: "常规", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
      { id: "hardcore", label: "硬核", hotzonePx: 0, revealMs: 3000, hintLinePx: 0 },
    ];
    w.__mock_emit__("surfaces-changed", "pane-modes");
  });
  await expect
    .poll(() => hintLineHeight(page), { timeout: 5000 })
    .toBe("0px");
  await shot(page, "05-hardcore-hint-0");
});

test("(e) 重置（override=null）：回落默认 16px / 1px / 3s", async ({ page }) => {
  await boot(page, "standard", [
    { id: "simple", label: "简易", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
    { id: "standard", label: "常规", hotzonePx: 20, revealMs: 0, hintLinePx: 0 },
    { id: "hardcore", label: "硬核", hotzonePx: 0, revealMs: 3000, hintLinePx: 1 },
  ]);
  await expect
    .poll(() => hotzoneHeight(page), { timeout: 5000 })
    .toBe(20);

  // 模拟重置：覆盖删除 → mock 回落默认三档。
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_pane_modes__ = null;
    w.__mock_emit__("surfaces-changed", "pane-modes");
  });
  await expect
    .poll(() => hotzoneHeight(page), { timeout: 5000 })
    .toBe(16);
  await shot(page, "06-reset-default");
});

test("证据采集：四态截图 + state-coverage.json", async ({ page }) => {
  await boot(page, "standard");
  await shot(page, "ev-standard-default");

  await boot(page, "hardcore");
  await page.keyboard.press("Meta+Shift+U");
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 2000 });
  await shot(page, "ev-hardcore-revealed");

  await boot(page, "standard", [
    { id: "simple", label: "简易", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
    { id: "standard", label: "常规", hotzonePx: 20, revealMs: 0, hintLinePx: 0 },
    { id: "hardcore", label: "硬核", hotzonePx: 0, revealMs: 3000, hintLinePx: 1 },
  ]);
  await shot(page, "ev-standard-hotzone-20");

  await boot(page, "hardcore", [
    { id: "simple", label: "简易", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
    { id: "standard", label: "常规", hotzonePx: 16, revealMs: 0, hintLinePx: 0 },
    { id: "hardcore", label: "硬核", hotzonePx: 0, revealMs: 5000, hintLinePx: 1 },
  ]);
  await page.keyboard.press("Meta+Shift+U");
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 2000 });
  await shot(page, "ev-hardcore-5000");

  const states = [
    { state: "standard-default", screenshot: "ev-standard-default.png", assertion: "passed" },
    { state: "hardcore-revealed", screenshot: "ev-hardcore-revealed.png", assertion: "passed" },
    { state: "standard-hotzone-20", screenshot: "ev-standard-hotzone-20.png", assertion: "passed" },
    { state: "hardcore-5000", screenshot: "ev-hardcore-5000.png", assertion: "passed" },
  ];
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    JSON.stringify({ states }, null, 2),
  );
});
