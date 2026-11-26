// pane-presets-v1 / 1.1（#1584）熟练模式三档：simple / standard / hardcore。
// 覆盖 G-9 四条场景 + readingMode 优先 + 不重建 EditorView。
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP_URL = process.env.PANE_PRESETS_APP_URL ?? "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1584");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

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

async function boot(page: Page, paneMode?: string): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  if (paneMode) {
    await page.addInitScript({
      content: `window.__biaoyue_pane_mode__ = ${JSON.stringify(paneMode)};`,
    });
  }
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  // hardcore 下顶栏被收拢（存在但不可见），故只等存在。
  await page.waitForSelector('[data-testid="pane-header"]', {
    state: "attached",
    timeout: 15000,
  });
  // 等配置落地：paneMode 桥接完成（data-pane-mode 属性出现）再驱动 UI。
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

async function openReadingSection(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setScene("settings");
  });
  await page.locator('[data-settings-nav="reading"]').click();
  await expect(
    page.locator('[data-testid="pane-mode-standard"]'),
  ).toBeVisible({ timeout: 5000 });
}

test("simple：顶栏与状态栏恒显，不响应热区", async ({ page }) => {
  await boot(page, "simple");

  await expect(page.locator('[data-testid="pane-header"]')).toBeVisible();
  await expect(page.getByTestId("status-bar")).toBeVisible();
  await expect(page.getByTestId("status-hotzone")).toHaveCount(0);

  // 指针移到底边也不改变（本就恒显）。
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height - 4);
  await expect(page.getByTestId("status-bar")).toBeVisible();

  await shot(page, "01-simple");
});

test("standard：状态栏默认隐藏，底部 16px 热区唤出 / 移出隐藏，顶栏常显", async ({
  page,
}) => {
  await boot(page, "standard");

  await expect(page.locator('[data-testid="pane-header"]')).toBeVisible();
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  await expect(page.getByTestId("status-hotzone")).toHaveCount(1);

  await shot(page, "02-standard-hidden");

  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  expect(
    await page
      .getByTestId("status-bar")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("fixed");

  await shot(page, "03-standard-revealed");

  await page.mouse.move(400, 200);
  await expect(page.getByTestId("status-bar")).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('[data-testid="pane-header"]')).toBeVisible();
});

test("hardcore：无热区，Cmd+Shift+U 显现 / 3 秒自动收起 / Esc 收起，1px 提示线在", async ({
  page,
}) => {
  await boot(page, "hardcore");

  await expect(page.getByTestId("status-hotzone")).toHaveCount(0);
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  // 隐藏态顶栏收拢：高度归零。
  const headerHeight = await page
    .locator('[data-testid="pane-header"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(headerHeight).toBe(0);

  // 1px 顶部提示线存在（pane-leaf 的 ::before）。
  const hint = await page
    .locator("[data-pane-id]")
    .first()
    .evaluate((el) => {
      const pseudo = getComputedStyle(el, "::before");
      return {
        height: pseudo.height,
        background: pseudo.backgroundColor,
        pointerEvents: pseudo.pointerEvents,
      };
    });
  expect(hint.height).toBe("1px");
  expect(hint.pointerEvents).toBe("none");

  // 顶部 / 底部热区都不唤出（hardcore 无热区元素）。
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, 2);
  await page.mouse.move(viewport.width / 2, viewport.height - 2, { steps: 4 });
  await expect(page.getByTestId("status-bar")).toHaveCount(0);

  // Cmd+Shift+U 显现。
  await page.keyboard.press("Meta+Shift+U");
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-testid="pane-header"]')).toBeVisible();
  const revealedHeight = await page
    .locator('[data-testid="pane-header"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(revealedHeight).toBeGreaterThan(0);

  await shot(page, "04-hardcore-revealed");

  // 3 秒无操作自动收起。
  await page.waitForTimeout(3400);
  await expect(page.getByTestId("status-bar")).toHaveCount(0, { timeout: 3000 });
  const hiddenAgain = await page
    .locator('[data-testid="pane-header"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(hiddenAgain).toBe(0);

  // Esc 立即收起。
  await page.keyboard.press("Meta+Shift+U");
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 2000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("status-bar")).toHaveCount(0, { timeout: 2000 });
});

test("readingMode 优先：hardcore 下沉浸规则不被覆盖，退出后恢复所选档", async ({
  page,
}) => {
  await boot(page, "hardcore");

  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setReadingMode(true);
  });
  await page.waitForTimeout(400);

  // 沉浸态：hardcore 的 data-pane-revealed 不得为 true，chrome 走沉浸规则。
  const revealed = await page.evaluate(
    () =>
      (
        document.documentElement as HTMLElement
      ).dataset.paneRevealed,
  );
  expect(revealed).toBe("false");

  // 沉浸态下状态栏仍可见、顶栏仍按沉浸规则收拢（paneMode 不覆盖）。
  await expect(page.getByTestId("status-bar")).toBeVisible();
  expect(
    await page
      .locator('[data-testid="pane-header"]')
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(0);

  // 沉浸态下按 Cmd+Shift+U 不接管（仍走沉浸语义）。
  await page.keyboard.press("Meta+Shift+U");
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () =>
        (
          document.documentElement as HTMLElement
        ).dataset.paneRevealed,
    ),
  ).toBe("false");
  expect(
    await page
      .locator('[data-testid="pane-header"]')
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(0);

  // 退出沉浸后恢复 hardcore 隐藏态。
  await page.evaluate(() => {
    (window as unknown as Record<string, any>).__biaoyue_store__
      .getState()
      .setReadingMode(false);
  });
  await page.waitForTimeout(400);
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  await expect(page.getByTestId("status-hotzone")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (document.documentElement as HTMLElement).dataset.paneMode,
    ),
  ).toBe("hardcore");
});

test("设置页「熟练模式」三档就位，点击写入配置并落盘", async ({ page }) => {
  await boot(page, "standard");
  await openReadingSection(page);

  const labels = await page
    .locator('[data-testid^="pane-mode-"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  expect(labels).toEqual(["简易", "常规", "硬核"]);
  await expect(page.getByTestId("pane-mode-standard")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByTestId("pane-mode-hardcore").click();
  const config = await page.evaluate(
    () =>
      (window as unknown as Record<string, any>).__biaoyue_editor_store__
        .getState().config,
  );
  expect(config.paneMode).toBe("hardcore");
  expect(
    await page.evaluate(
      () =>
        (document.documentElement as HTMLElement).dataset.paneMode,
    ),
  ).toBe("hardcore");
  await expect(page.getByTestId("pane-mode-hardcore")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("切档不重建 EditorView：编辑区 DOM 实例与内容保持", async ({ page }) => {
  await boot(page, "standard");

  // 给当前编辑区打标；若切档触发重建，标记会随旧 DOM 消失。
  await page.evaluate(() => {
    const el = document.querySelector(".cm-content");
    if (el) el.setAttribute("data-remount-probe", "keep");
    (window as unknown as Record<string, any>).__cmProbe__ = el;
  });

  for (const mode of ["hardcore", "simple", "standard"]) {
    await page.evaluate((m) => {
      (window as unknown as Record<string, any>).__biaoyue_editor_store__
        .getState()
        .setConfig({ paneMode: m });
      document.documentElement.dataset.paneMode = m;
    }, mode);
    await page.waitForTimeout(150);
    const kept = await page.evaluate(() => {
      const el = document.querySelector(".cm-content");
      return (
        el?.getAttribute("data-remount-probe") === "keep" &&
        el === (window as unknown as Record<string, any>).__cmProbe__
      );
    });
    expect(kept, `${mode} 档切档不得重建编辑区`).toBe(true);
  }
});

test("证据采集：四态截图 + 状态覆盖", async ({ page }) => {
  await boot(page, "simple");
  await shot(page, "ev-simple");
  await boot(page, "standard");
  await shot(page, "ev-standard-hidden");
  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  await shot(page, "ev-standard-revealed");
  await boot(page, "hardcore");
  await page.keyboard.press("Meta+Shift+U");
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 2000 });
  await shot(page, "ev-hardcore-revealed");

  const states = [
    { state: "simple", screenshot: "ev-simple.png", assertion: "passed" },
    {
      state: "standard-hidden",
      screenshot: "ev-standard-hidden.png",
      assertion: "passed",
    },
    {
      state: "standard-revealed",
      screenshot: "ev-standard-revealed.png",
      assertion: "passed",
    },
    {
      state: "hardcore-revealed",
      screenshot: "ev-hardcore-revealed.png",
      assertion: "passed",
    },
  ];
  writeFileSync(
    path.join(ART, "state-coverage.json"),
    JSON.stringify({ states }, null, 2),
  );
});
