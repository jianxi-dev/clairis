import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";
const PDF_PATH = "/Users/test/doc.pdf";

declare global {
  interface Window {
    findInShadow: (selector: string) => Element | null;
  }
}

async function installShadowProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const findInShadow = (selector: string): Element | null => {
      const walk = (root: Document | ShadowRoot): Element | null => {
        const hit = root.querySelector(selector);
        if (hit) return hit;
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot) {
            const nested = walk(el.shadowRoot);
            if (nested) return nested;
          }
        }
        return null;
      };
      return walk(document);
    };
    (window as unknown as { findInShadow: typeof findInShadow }).findInShadow =
      findInShadow;
  });
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openFile(
  page: Page,
  path: string,
  content: string,
  title: string,
): Promise<void> {
  await page.evaluate(
    ([p, c, t]) => {
      const w = window as unknown as {
        __biaoyue_openFile__: (
          path: string,
          content: string,
          title: string,
        ) => void;
      };
      w.__biaoyue_openFile__(p, c, t);
    },
    [path, content, title],
  );
}

async function openPdf(page: Page): Promise<void> {
  await openFile(page, PDF_PATH, "", "doc.pdf");
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.findInShadow('[data-epdf-i="pdf-page-nav"]') !== null,
        ),
      { timeout: 15000 },
    )
    .toBe(true);
}

function toolbarDisplay(page: Page): Promise<string> {
  return page.evaluate(() => {
    const bar = window.findInShadow('[data-epdf-i="main-toolbar"]');
    return bar ? getComputedStyle(bar).display : "missing";
  });
}

async function pinToolbar(page: Page): Promise<void> {
  await page.locator('[data-epdf-i="pdf-toolbar-pin"]').click();
}

/** 承载 PDF shadow DOM 的宿主元素 class 列表（pdf-chrome-pinned-hidden 挂在这里）。 */
function pdfHostClass(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walk = (root: Document | ShadowRoot): string | null => {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (
          el.shadowRoot &&
          el.shadowRoot.querySelector('[data-epdf-i="main-toolbar"]')
        ) {
          return el.className;
        }
        if (el.shadowRoot) {
          const nested = walk(el.shadowRoot);
          if (nested !== null) return nested;
        }
      }
      return null;
    };
    return walk(document) ?? "";
  });
}

test("PDF 按钮栏固定隐藏后 display 为 none，快捷键恢复可见", async ({
  page,
}) => {
  await installShadowProbe(page);
  await boot(page);
  await openPdf(page);

  expect(await toolbarDisplay(page)).not.toBe("none");

  await pinToolbar(page);
  await expect.poll(() => toolbarDisplay(page)).toBe("none");

  await page.keyboard.press("Shift+Meta+D");
  await expect.poll(() => toolbarDisplay(page)).not.toBe("none");
});

test("切换文档后按钮栏恢复默认，无残留", async ({ page }) => {
  await installShadowProbe(page);
  await boot(page);
  await openPdf(page);

  await pinToolbar(page);
  await expect.poll(() => toolbarDisplay(page)).toBe("none");

  await openFile(
    page,
    "/Users/test/切换文档.md",
    "# 标题\n\n正文。",
    "切换文档.md",
  );
  await page.locator('[data-tab-id][title="doc.pdf"]').click();
  await openPdf(page);

  expect(await toolbarDisplay(page)).not.toBe("none");
});

test("⌘⇧D 在 PDF 视图内切换固定隐藏，总览含对应行（editor-surface-batch17 2.1）", async ({
  page,
}) => {
  await installShadowProbe(page);
  await boot(page);
  await openPdf(page);

  // 焦点放进 shadow DOM 控件（视图内部），模拟用户正在操作 PDF 控件
  await page.locator('[data-epdf-i="pdf-page-nav"] input').click();

  expect(await pdfHostClass(page)).not.toContain("pdf-chrome-pinned-hidden");

  await page.keyboard.press("Shift+Meta+D");
  await expect
    .poll(() => pdfHostClass(page))
    .toContain("pdf-chrome-pinned-hidden");

  await page.keyboard.press("Shift+Meta+D");
  await expect
    .poll(() => pdfHostClass(page))
    .not.toContain("pdf-chrome-pinned-hidden");

  // 快捷键总览按现有注册表自动渲染
  await page.keyboard.press("Shift+/");
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toBeVisible();
  await expect(
    page.locator('[data-shortcut-id="mode-pdf-toolbar-pin"]'),
  ).toHaveCount(1);
  await page.locator('[data-testid="shortcut-overlay-close"]').click();
  await expect(page.locator('[data-testid="shortcut-overlay"]')).toHaveCount(0);
});
