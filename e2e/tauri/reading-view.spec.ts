import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const LONG_DOC =
  "# 阅读测试\n\n" +
  Array.from(
    { length: 60 },
    (_, i) => `第 ${i + 1} 段内容，用于产生可滚动的高度，验证墨线与位置恢复。`,
  ).join("\n\n");

async function openFile(
  page: import("@playwright/test").Page,
  path: string,
  content: string,
) {
  await page.evaluate(
    ([p, c]) => {
      const w = window as unknown as Record<string, unknown>;
      (
        w as {
          __biaoyue_openFile__?: (
            path: string,
            content: string,
            title: string,
          ) => void;
        }
      ).__biaoyue_openFile__?.(p, c, p.split("/").pop() ?? p);
    },
    [path, content],
  );
  await page.waitForTimeout(300);
}

test("阅读模式：墨线随模式与沉浸态显隐", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/阅读.md", LONG_DOC);

  // 预览模式：墨线显示
  await expect(page.locator(".reading-ink")).toHaveCount(1);

  // 编辑模式：墨线隐藏
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__ as {
      getState: () => { setEditorMode: (m: string) => void };
    };
    store.getState().setEditorMode("edit");
  });
  await page.waitForTimeout(200);
  await expect(page.locator(".reading-ink")).toHaveCount(0);

  // 切回预览：墨线恢复
  await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__ as {
      getState: () => { setEditorMode: (m: string) => void };
    };
    store.getState().setEditorMode("preview");
  });
  await page.waitForTimeout(200);
  await expect(page.locator(".reading-ink")).toHaveCount(1);

  // Cmd+\ 进入沉浸：chrome 高度收拢为 0、墨线隐藏
  await page.keyboard.press("Meta+\\");
  await page.waitForTimeout(500);
  await expect(page.locator(".reading-ink")).toHaveCount(0);
  const hiddenHeight = await page.evaluate(() => {
    const header = document.querySelector("header");
    return header ? Math.round(header.getBoundingClientRect().height) : -1;
  });
  expect(hiddenHeight).toBe(0);

  // Shift+Cmd+T 唤出悬浮页签条（流内顶栏保持收拢）
  await page.keyboard.press("Meta+Shift+T");
  await page.waitForTimeout(500);
  await expect(page.locator('[data-testid="immersive-peek-bar"]')).toHaveCount(
    1,
  );
  // 挂载期定时器不得误收用户显式唤出的悬浮条（#343）
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-testid="immersive-peek-bar"]')).toHaveCount(
    1,
  );
  const stillHidden = await page.evaluate(() => {
    const header = document.querySelector("header");
    return header ? Math.round(header.getBoundingClientRect().height) : -1;
  });
  expect(stillHidden).toBe(0);

  // Esc 退出沉浸：墨线恢复
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await expect(page.locator(".reading-ink")).toHaveCount(1);
});

test("阅读模式：滚动位置在关闭后重开时恢复", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("header", { timeout: 10000 });

  await openFile(page, "/Users/test/进度.md", LONG_DOC);

  // 滚动到中部并派发 scroll（触发 200ms debounce 写入）
  const scrolled = await page.evaluate(() => {
    const container = document.querySelector(
      ".cm-editor-container ~ div, [style*='overflow: auto']",
    ) as HTMLElement | null;
    if (!container) return null;
    container.scrollTop = 400;
    container.dispatchEvent(new Event("scroll"));
    return {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    };
  });
  expect(scrolled?.scrollTop).toBe(400);
  await page.waitForTimeout(400); // 200ms debounce + store 更新

  // 关闭 tab（captureScrollNow 立即写入）
  const tabInfo = await page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>)
      .__biaoyue_store__ as {
      getState: () => {
        activeTabId: string | null;
        closeTab: (id: string) => void;
      };
    };
    const s = store.getState();
    const id = s.activeTabId;
    if (id) s.closeTab(id);
    return id;
  });
  expect(tabInfo).toBeTruthy();

  // 重开同一文件：位置恢复
  await openFile(page, "/Users/test/进度.md", LONG_DOC);
  const restored = await page.evaluate(() => {
    const container = document.querySelector(
      "[style*='overflow: auto']",
    ) as HTMLElement | null;
    return container ? container.scrollTop : -1;
  });
  expect(restored).toBeGreaterThan(300);
});
