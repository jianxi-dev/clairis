import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "fs";

const APP_URL = process.env.BIAOYUE_E2E_URL ?? "http://localhost:1420";
const ARTIFACT_DIR = ".artifacts/1053";

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
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
    .poll(() => page.locator('[role="tab"]').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
}

test.describe("页签标题省略号与间距（editor-surface-batch21 4.5 / #1053）", () => {
  test.beforeAll(() => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  });

  test("相邻页签间距为 16px（A-15.1）", async ({ page }) => {
    await boot(page);
    await openFile(page, "/tmp/1053/alpha.md");
    await openFile(page, "/tmp/1053/beta.md");

    const strip = page.locator(".tab-strip").first();
    const gap = await strip.evaluate((el) => getComputedStyle(el).columnGap);
    expect(gap).toBe("16px");

    const delta = await page.evaluate(() => {
      const tabs = Array.from(
        document.querySelectorAll<HTMLElement>(".tab-strip [data-tab-id]"),
      );
      const r = tabs.map((t) => t.getBoundingClientRect());
      return r[1].left - (r[0].left + r[0].width);
    });
    expect(Math.abs(delta - 16)).toBeLessThanOrEqual(2);

    await page.screenshot({ path: `${ARTIFACT_DIR}/02-gap-16.png` });
  });

  test("长页签名换行收缩、不再生效省略号（A-15.2）", async ({ page }) => {
    await boot(page);
    await openFile(page, "/tmp/1053/short.md");
    await openFile(
      page,
      "/tmp/1053/very-long-tab-title-abcdefghijklmnopqrstuvwxyz-01.md",
    );

    const label = await page
      .locator('.tab-strip [data-tab-id] [data-testid="tab-title"]')
      .last()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          textOverflow: cs.textOverflow,
          height: r.height,
          whiteSpace: cs.whiteSpace,
          lineClamp: cs.webkitLineClamp,
        };
      });
    expect(label.textOverflow).not.toBe("ellipsis");
    expect(label.whiteSpace).not.toBe("nowrap");
    expect(label.height).toBe(32);

    const ellipsisCount = await page.evaluate(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '.tab-strip [data-tab-id] [data-testid="tab-title"]',
          ),
        ).filter((el) => getComputedStyle(el).textOverflow === "ellipsis")
          .length,
    );
    expect(ellipsisCount).toBe(0);

    await page.screenshot({ path: `${ARTIFACT_DIR}/01-long-titles-wrap.png` });
  });

  test("多个长页签时页签条可横向滚动（A-15.3）", async ({ page }) => {
    await boot(page);
    const long = "very-long-tab-title-abcdefghijklmnopqrstuvwxyz-";
    for (let i = 0; i < 8; i += 1) {
      await openFile(page, `/tmp/1053/${long}${i}.md`);
    }

    const strip = page.locator(".tab-strip").first();
    const scrollable = await strip.evaluate(
      (el) => el.scrollWidth > el.clientWidth,
    );
    expect(scrollable).toBe(true);

    const boxed = await page
      .locator(".tab-strip [data-tab-id]")
      .first()
      .evaluate((el) => {
        const tab = el.getBoundingClientRect();
        const icon = el.querySelector("svg")!.getBoundingClientRect();
        return {
          tabHeight: tab.height,
          stripHeight: el.parentElement!.getBoundingClientRect().height,
          iconTop: icon.top - tab.top,
          iconBottom: icon.bottom - tab.top,
        };
      });
    expect(boxed.tabHeight).toBe(40);
    expect(boxed.stripHeight).toBe(40);
    expect(boxed.iconTop).toBeGreaterThanOrEqual(0);
    expect(boxed.iconBottom).toBeLessThanOrEqual(boxed.tabHeight);

    await page.screenshot({ path: `${ARTIFACT_DIR}/03-strip-scrollable.png` });
  });

  test("关闭页签后间距保持 16px 且无残留省略号", async ({ page }) => {
    await boot(page);
    await openFile(
      page,
      "/tmp/1053/another-extremely-long-tab-title-abcdefghijklmnopqrstuvwxyz-02.md",
    );
    await openFile(page, "/tmp/1053/gamma.md");
    await openFile(page, "/tmp/1053/delta.md");

    const strip = page.locator(".tab-strip").first();
    const gapBefore = await strip.evaluate(
      (el) => getComputedStyle(el).columnGap,
    );
    expect(gapBefore).toBe("16px");

    const tabs = page.locator(".tab-strip [data-tab-id]");
    await tabs.nth(1).hover();
    await tabs.nth(1).locator('button[title="关闭 (Cmd+W)"]').click();
    await expect(tabs).toHaveCount(2);

    const gapAfter = await strip.evaluate(
      (el) => getComputedStyle(el).columnGap,
    );
    expect(gapAfter).toBe("16px");

    const ellipsisCount = await page.evaluate(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '.tab-strip [data-tab-id] [data-testid="tab-title"]',
          ),
        ).filter((el) => getComputedStyle(el).textOverflow === "ellipsis")
          .length,
    );
    expect(ellipsisCount).toBe(0);

    await page.screenshot({
      path: `${ARTIFACT_DIR}/04-after-close-keeps-gap.png`,
    });
  });
});

test.describe("页签选中态与底边（ui-polish-batch6 2.1）", () => {
  test("选中页签不画描边，页签条不重复画底边", async ({ page }) => {
    await boot(page);
    await openFile(page, "/tmp/e2e-tab-a.md");
    await openFile(page, "/tmp/e2e-tab-b.md");

    const tabs = page.locator('[role="tab"]');
    expect(await tabs.count()).toBe(2);

    for (let i = 0; i < 2; i += 1) {
      const outline = await tabs.nth(i).evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return { style: cs.outlineStyle, color: cs.outlineColor };
      });
      const invisible =
        outline.style === "none" || outline.color === "rgba(0, 0, 0, 0)";
      expect(invisible).toBe(true);
    }

    const border = await page
      .locator(".tab-strip")
      .first()
      .evaluate((el) => window.getComputedStyle(el).borderBottomWidth);
    expect(border).toBe("0px");
  });

  test("选中与未选中页签文字颜色不同", async ({ page }) => {
    await boot(page);
    await openFile(page, "/tmp/e2e-tab-c.md");
    await openFile(page, "/tmp/e2e-tab-d.md");

    const tabs = page.locator('[role="tab"]');
    expect(await tabs.count()).toBe(2);

    await expect
      .poll(
        async () => {
          const colors: string[] = [];
          for (let i = 0; i < 2; i += 1) {
            colors.push(
              await tabs
                .nth(i)
                .evaluate((el) => window.getComputedStyle(el).color),
            );
          }
          return new Set(colors).size;
        },
        { timeout: 5000 },
      )
      .toBeGreaterThan(1);
  });
});
