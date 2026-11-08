import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function openImage(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  // Chromium 解不了 asset://，换成可解码的小图：否则 <img> 高度为 0，右键无落点
  await page.addInitScript((png) => {
    const w = window as unknown as Record<string, any>;
    w.__TAURI_INTERNALS__.convertFileSrc = () => png;
  }, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMDrRiU6khRg3E/Ornr2kEhAQEBAQEBAQEBAQEBAQSAceRiXEebi0SxgAAAAASUVORK5CYII=");
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown> & {
      __biaoyue_openFile__: (p: string, c: string, t: string) => boolean;
      __biaoyue_store__?: { getState: () => { setScene: (s: string) => void } };
    };
    w.__biaoyue_openFile__("/Users/test/photo.png", "", "photo.png");
    w.__biaoyue_store__?.getState().setScene("workspace");
  });
  await page
    .locator("img")
    .first()
    .waitFor({ timeout: 10000, state: "visible" });
}

async function installProbes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown> & {
      __TAURI_INTERNALS__: {
        invoke: (cmd: string, args?: unknown) => Promise<unknown>;
      };
    };
    const calls: string[] = [];
    const prevented: boolean[] = [];
    w.__invoke_calls__ = calls;
    w.__ctx_prevented__ = prevented;
    const orig = w.__TAURI_INTERNALS__.invoke;
    w.__TAURI_INTERNALS__.invoke = (cmd: string, args?: unknown) => {
      calls.push(cmd);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          Promise.resolve()
            .then(() => orig(cmd, args))
            .then(resolve, reject);
        }, 500);
      });
    };
    document.addEventListener(
      "contextmenu",
      (e) => {
        calls.length = 0;
        // 捕获阶段读到的是处理器执行前的状态；等事件跑完再取最终 defaultPrevented
        setTimeout(() => prevented.push(e.defaultPrevented), 0);
      },
      true,
    );
  });
}

test("右键图片弹出应用菜单，且渲染前不发起任何 IPC", async ({ page }) => {
  await openImage(page);
  await installProbes(page);

  await page.locator("img").first().click({ button: "right" });

  const menu = page.getByTestId("image-context-menu");
  await expect(menu).toBeVisible({ timeout: 1000 });
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, string[]>).__invoke_calls__,
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, boolean[]>).__ctx_prevented__,
    ),
  ).toEqual([true]);

  await expect(menu.locator('[role="menuitem"]')).toHaveCount(4);
  await expect(menu).toContainText("打开所在文件夹");
  await expect(menu).toContainText("另存为…");
  await expect(menu).toContainText("复制文件路径");
  await expect(menu).toContainText("关闭预览");
});

test("外部点击与 Esc 关闭菜单，无残留浮层", async ({ page }) => {
  await openImage(page);
  const menu = page.getByTestId("image-context-menu");
  const img = page.locator("img").first();

  await img.click({ button: "right" });
  await expect(menu).toBeVisible({ timeout: 1000 });
  await page.mouse.click(600, 300);
  await expect(menu).toHaveCount(0);

  await img.click({ button: "right" });
  await expect(menu).toBeVisible({ timeout: 1000 });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("另存为写出原文件名；复制路径写入剪贴板", async ({ page }) => {
  await openImage(page);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__clipboard__ = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (w.__clipboard__ as string[]).push(text);
          return Promise.resolve();
        },
      },
    });
  });

  const img = page.locator("img").first();
  await img.click({ button: "right" });
  await page.getByRole("menuitem", { name: "另存为…" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as Record<string, { defaultName: string }[]>)
              .__biaoyue_saved_binaries__?.length ?? 0,
        ),
      { timeout: 5000 },
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as Record<
            string,
            { defaultName: string; base64: string }[]
          >
        ).__biaoyue_saved_binaries__[0],
    ),
  ).toMatchObject({ defaultName: "photo.png" });

  await img.click({ button: "right" });
  await page.getByRole("menuitem", { name: "复制文件路径" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, string[]>).__clipboard__,
    ),
  ).toEqual(["/Users/test/photo.png"]);
});

test("关闭预览移除当前页签", async ({ page }) => {
  await openImage(page);
  await page.locator("img").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "关闭预览" }).click();
  await expect(page.locator("img").first()).toHaveCount(0);
  await expect(page.getByTestId("image-context-menu")).toHaveCount(0);
});
