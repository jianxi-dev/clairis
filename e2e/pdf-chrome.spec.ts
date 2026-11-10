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

function pdfChrome(page: Page) {
  return page.evaluate(() => {
    const host = Array.from(document.querySelectorAll("*")).find((el) =>
      el.shadowRoot?.querySelector('[data-epdf-i="main-toolbar"]'),
    ) as HTMLElement | undefined;
    const bar = host?.shadowRoot?.querySelector(
      '[data-epdf-i="main-toolbar"]',
    ) as HTMLElement | null;
    const pageImg = host?.shadowRoot?.querySelector("img");
    if (!bar) return null;
    const style = getComputedStyle(bar);
    return {
      opacity: style.opacity,
      position: style.position,
      pageTop: pageImg ? pageImg.getBoundingClientRect().top : 0,
      barHeight: bar.getBoundingClientRect().height,
    };
  });
}

function dblclickToolbar(page: Page) {
  return page.evaluate(() => {
    const host = Array.from(document.querySelectorAll("*")).find((el) =>
      el.shadowRoot?.querySelector('[data-epdf-i="main-toolbar"]'),
    ) as HTMLElement | undefined;
    const bar = host?.shadowRoot?.querySelector('[data-epdf-i="main-toolbar"]');
    bar?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, composed: true }),
    );
  });
}

test("PDF 顶栏默认显示，双击收起、顶部滑入悬浮、再双击固定", async ({
  page,
}) => {
  await installShadowProbe(page);
  await boot(page);
  await openPdf(page);
  await page.waitForTimeout(400);

  const initial = await pdfChrome(page);
  expect(initial).not.toBeNull();
  expect(initial!.opacity).toBe("1");
  expect(initial!.position).not.toBe("absolute");

  await dblclickToolbar(page);
  await expect.poll(async () => (await pdfChrome(page))?.opacity).toBe("0");
  const hidden = await pdfChrome(page);
  expect(hidden!.position).toBe("absolute");
  expect(initial!.barHeight).toBeGreaterThanOrEqual(24);
  expect(hidden!.pageTop).toBeLessThan(initial!.pageTop - 24);

  const hostBox = await page
    .locator('[data-testid="pane-header"]')
    .boundingBox();
  const top = (hostBox?.y ?? 0) + 30;
  await page.mouse.move(600, top + 6);
  await expect.poll(async () => (await pdfChrome(page))?.opacity).toBe("1");
  expect((await pdfChrome(page))!.position).toBe("absolute");

  await page.mouse.move(600, top + 320);
  await expect.poll(async () => (await pdfChrome(page))?.opacity).toBe("0");

  await dblclickToolbar(page);
  await expect.poll(async () => (await pdfChrome(page))?.opacity).toBe("1");
  expect((await pdfChrome(page))!.position).not.toBe("absolute");
});
