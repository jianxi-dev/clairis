import { test, expect, type Page } from "@playwright/test";

const APP_URL = "http://localhost:1420";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openPdf(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __biaoyue_openFile__: (
        path: string,
        content: string,
        title: string,
      ) => void;
    };
    w.__biaoyue_openFile__("/Users/test/doc.pdf", "x", "doc.pdf");
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => findInShadow('[data-epdf-i="pdf-page-nav"]') !== null,
        ),
      {
        timeout: 15000,
      },
    )
    .toBe(true);
}

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

function navBorder(page: Page): Promise<string> {
  return page.evaluate(() => {
    const nav = window.findInShadow('[data-epdf-i="pdf-page-nav"]');
    const inner = nav?.querySelector("div > div");
    return inner ? getComputedStyle(inner).borderTopWidth : "missing";
  });
}

function shadowBg(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    const el = window.findInShadow(sel);
    return el ? getComputedStyle(el).backgroundColor : "missing";
  }, selector);
}

function cssVar(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${n})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

test("PDF 页码区无外框，外围底色跟随主题", async ({ page }) => {
  await installShadowProbe(page);
  await boot(page);
  await openPdf(page);

  expect(await navBorder(page)).toBe("0px");

  const lightAppBg = await cssVar(page, "--app-bg");
  expect(await shadowBg(page, ".bg-bg-app")).toBe(lightAppBg);

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const darkAppBg = await cssVar(page, "--app-bg");
  expect(darkAppBg).not.toBe(lightAppBg);
  await expect.poll(() => shadowBg(page, ".bg-bg-app")).toBe(darkAppBg);

  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await expect.poll(() => shadowBg(page, ".bg-bg-app")).toBe(lightAppBg);
});

test("沉浸态 PDF 顶栏 1.2s 无交互自动收起，指针活动复现", async ({ page }) => {
  await installShadowProbe(page);
  await boot(page);
  await openPdf(page);
  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setReadingMode(true);
  });
  await page.waitForTimeout(300);

  const toolbarOpacity = () =>
    page.evaluate(() => {
      const bar = window.findInShadow('[data-epdf-i="main-toolbar"]');
      if (!bar) return "missing";
      return getComputedStyle(bar).opacity;
    });

  // 指针在预览内活动 → 顶栏可见
  const host = page
    .locator("div")
    .filter({ has: page.locator("shadow=no") })
    .first();
  await page.mouse.move(600, 400);
  await page.mouse.move(610, 410);
  await page.waitForTimeout(250);
  expect(await toolbarOpacity()).toBe("1");

  // 指针停住 1.6s → 顶栏收起（opacity 0）
  await page.waitForTimeout(1600);
  expect(await toolbarOpacity()).toBe("0");

  // 再活动 → 复现
  await page.mouse.move(620, 420);
  await page.waitForTimeout(300);
  expect(await toolbarOpacity()).toBe("1");

  await page.evaluate(() => {
    window.__biaoyue_store__.getState().setReadingMode(false);
  });
});
