import { test, expect, type Page } from "@playwright/test";

/**
 * 提示信息显示时长可配置（#667 / change=ui-polish-batch15 4.1）。
 *
 * 走 e2e/mocks/tauri-mock.js：config 持久化在 localStorage.__mock_config，
 * reload 后仍在，用来验证「重启后生效」。
 *
 * 提示触发器：ContentArea 的粘贴处理在图片超过 20MB 时调用 showNotice
 * （与 image-block-edit.spec.ts 的既有触发方式一致）。这是纯 UI 可达、
 * 确定性的入口，不依赖 sleep。
 */

const APP_URL = "http://localhost:1420";

interface BridgeWindow extends Window {
  __biaoyue_openFile__: (p: string, c: string, t: string) => void;
  __biaoyue_store__: { getState: () => { setEditorMode: (m: string) => void } };
  __biaoyue_editor_store__: {
    getState: () => { config: { noticeDuration?: number | null } };
  };
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
}

async function openEditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as BridgeWindow;
    w.__biaoyue_openFile__(
      "/tmp/notice-duration/doc.md",
      "# 标题\n\n正文。",
      "doc.md",
    );
    w.__biaoyue_store__.getState().setEditorMode("edit");
  });
  await page.locator(".cm-content").waitFor({ timeout: 10000 });
}

function storeNoticeDuration(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const w = window as unknown as BridgeWindow;
    return w.__biaoyue_editor_store__.getState().config.noticeDuration ?? null;
  });
}

function storedConfigNoticeDuration(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("__mock_config");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { noticeDuration?: number | null };
    return parsed.noticeDuration ?? null;
  });
}

/**
 * 触发一次 >20MB 图片粘贴，返回提示从触发到消失的真实毫秒数。
 *
 * 时间戳在页面内记录（触发前、节点被移除时），避免 Playwright 断言轮询
 * 的往返延迟把时长测长——实测该往返会引入约 500ms 噪声。
 */
async function measureNotice(page: Page): Promise<number> {
  await page.locator(".cm-content").click();
  return page.locator(".cm-content").evaluate((el) => {
    return new Promise<number>((resolve, reject) => {
      const t0 = Date.now();
      let seen = false;
      const observer = new MutationObserver(() => {
        const node = document.querySelector('[data-testid="paste-notice"]');
        if (node) {
          seen = true;
        } else if (seen) {
          observer.disconnect();
          clearTimeout(fallback);
          resolve(Date.now() - t0);
        }
      });
      const fallback = setTimeout(() => {
        observer.disconnect();
        reject(
          seen ? new Error("提示未在 8s 内消失") : new Error("提示未出现"),
        );
      }, 8000);
      observer.observe(document.body, { childList: true, subtree: true });
      const bytes = new Uint8Array(21 * 1024 * 1024);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "big.png", { type: "image/png" }));
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
    });
  });
}

test("设置 1.5 秒：配置持久化且提示在 1.4–1.7 秒间消失", async ({ page }) => {
  await boot(page);
  await openSettings(page);

  const input = page.getByTestId("settings-notice-duration");
  await input.fill("1.5");
  await input.press("Enter");

  await expect.poll(() => storeNoticeDuration(page)).toBe(1.5);
  await expect.poll(() => storedConfigNoticeDuration(page)).toBe(1.5);

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await openEditor(page);
  const duration = await measureNotice(page);
  expect(duration).toBeGreaterThanOrEqual(1400);
  expect(duration).toBeLessThanOrEqual(1700);
});

test("非法值 1.55 / 0 被拒：配置不变且输入回退", async ({ page }) => {
  await boot(page);
  await openSettings(page);

  const input = page.getByTestId("settings-notice-duration");
  await input.fill("1.5");
  await input.press("Enter");
  await expect.poll(() => storeNoticeDuration(page)).toBe(1.5);

  await input.fill("1.55");
  await input.press("Enter");
  await expect.poll(() => storeNoticeDuration(page)).toBe(1.5);
  await expect(input).toHaveValue("1.5");

  await input.fill("0");
  await input.press("Enter");
  await expect.poll(() => storeNoticeDuration(page)).toBe(1.5);
  await expect(input).toHaveValue("1.5");
});

test("清空恢复默认：配置 null 且提示约 3 秒", async ({ page }) => {
  await boot(page);
  await openSettings(page);

  const input = page.getByTestId("settings-notice-duration");
  await input.fill("1.5");
  await input.press("Enter");
  await expect.poll(() => storeNoticeDuration(page)).toBe(1.5);

  await input.fill("");
  await input.press("Enter");
  await expect.poll(() => storeNoticeDuration(page)).toBe(null);
  await expect.poll(() => storedConfigNoticeDuration(page)).toBe(null);

  await page.keyboard.press("Escape");
  await openEditor(page);
  const duration = await measureNotice(page);
  expect(duration).toBeGreaterThanOrEqual(2800);
});

test("reload 后配置仍保持 1.5", async ({ page }) => {
  await boot(page);
  await openSettings(page);

  const input = page.getByTestId("settings-notice-duration");
  await input.fill("1.5");
  await input.press("Enter");
  await expect.poll(() => storedConfigNoticeDuration(page)).toBe(1.5);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
  await expect.poll(() => storeNoticeDuration(page)).toBe(1.5);
});
