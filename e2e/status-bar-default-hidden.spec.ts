import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * shell-preview-refine 1.1（#1135）状态栏默认隐藏 + 底边热区滑入滑出。
 *
 * A-1.1 启动未钉住、指针未入热区 → 可见性 0，不占布局高度
 * A-1.2 指针进入底部 8px 热区 → 临时显现（position: fixed）
 * A-1.3 指针移出热区 → 隐藏
 * A-1.4 显式钉住 → 常显；取消钉住 → 恢复默认隐藏
 */

const APP_URL = "http://localhost:1420";
const ART = path.resolve(process.cwd(), ".artifacts/1135");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

async function shot(target: Page, name: string): Promise<void> {
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

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__?.getState?.().setScene("workspace");
  });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

test("默认隐藏：不渲染状态栏、不占布局高度", async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  await expect(page.getByTestId("status-hotzone")).toHaveCount(1);

  // 隐藏态布局占位为 0：工作区一直延伸到底边，热区只是 fixed 覆盖层。
  const body = (await page.getByTestId("workspace-body").boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(body.y + body.height).toBeGreaterThanOrEqual(viewport.height - 1);
  const zone = page.getByTestId("status-hotzone");
  expect(await zone.evaluate((el) => getComputedStyle(el).position)).toBe(
    "fixed",
  );
  expect(await zone.evaluate((el) => el.getBoundingClientRect().height)).toBe(
    8,
  );

  await shot(page, "01-default-hidden");
});

test("热区滑入滑出：进入可见（fixed 悬浮）、移出隐藏、正文不位移", async ({
  page,
}) => {
  await boot(page);
  const bar = page.getByTestId("status-bar");
  const body = page.getByTestId("workspace-body");
  const heightBefore = (await body.boundingBox())!.height;

  await page.getByTestId("status-hotzone").hover();
  await expect(bar).toBeVisible({ timeout: 3000 });
  expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe(
    "fixed",
  );
  expect(Math.abs((await body.boundingBox())!.height - heightBefore)).toBe(0);

  await shot(page, "02-hotzone-peek");

  await page.mouse.move(400, 200);
  await page.mouse.move(400, 260);
  await expect(bar).toHaveCount(0, { timeout: 3000 });
  expect(Math.abs((await body.boundingBox())!.height - heightBefore)).toBe(0);
});

test("钉住后常显，取消钉住恢复默认隐藏", async ({ page }) => {
  await boot(page);
  const bar = page.getByTestId("status-bar");

  await page.getByTestId("status-hotzone").hover();
  await expect(bar).toBeVisible({ timeout: 3000 });

  // 双击空白处 = 钉住（statusBarHidden: true → false）。
  await bar.locator("span").first().dblclick();
  await page.mouse.move(400, 200);
  await expect(bar).toBeVisible();

  await shot(page, "03-pinned-visible");

  await bar.locator("span").first().dblclick();
  await expect(bar).toHaveCount(0);
  await expect(page.getByTestId("status-hotzone")).toHaveCount(1);

  await shot(page, "04-unpinned-hidden");
});

test("沉浸态：仍默认隐藏、热区可临时唤出", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    w.__biaoyue_store__.getState().setReadingMode(true);
  });
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  await page.getByTestId("status-hotzone").hover();
  await expect(page.getByTestId("status-bar")).toBeVisible({ timeout: 3000 });
  expect(
    await page
      .getByTestId("status-bar")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("fixed");
});
