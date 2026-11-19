import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "fs";

const APP_URL = process.env.BIAOYUE_E2E_URL ?? "http://localhost:1420";
const ARTIFACT_DIR = ".artifacts/1180";

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

type TitleStyle = {
  textOverflow: string;
  whiteSpace: string;
  lineClamp: string;
};

async function readTitleStyles(page: Page): Promise<TitleStyle[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '.tab-strip [data-tab-id] [data-testid="tab-title"]',
      ),
    ).map((el) => {
      const cs = getComputedStyle(el);
      return {
        textOverflow: cs.textOverflow,
        whiteSpace: cs.whiteSpace,
        lineClamp: cs.webkitLineClamp,
      };
    }),
  );
}

test.describe("页签弹性伸缩与间距（tab-title-info-surface / shell-tabs-surface 1.1）", () => {
  test.beforeAll(() => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  });

  test("相邻页签间距保持 32px，标题与关闭图标之间压缩（#1138）", async ({
    page,
  }) => {
    await boot(page);
    await openFile(page, "/tmp/1053/alpha.md");
    await openFile(page, "/tmp/1053/beta.md");

    const strip = page.locator(".tab-strip").first();
    const gap = await strip.evaluate((el) => getComputedStyle(el).columnGap);
    expect(gap).toBe("32px");

    const delta = await page.evaluate(() => {
      const tabs = Array.from(
        document.querySelectorAll<HTMLElement>(".tab-strip [data-tab-id]"),
      );
      const r = tabs.map((t) => t.getBoundingClientRect());
      return r[1].left - (r[0].left + r[0].width);
    });
    expect(Math.abs(delta - 32)).toBeLessThanOrEqual(2);

    const innerGap = await page.evaluate(() => {
      const tab = document.querySelector<HTMLElement>(
        ".tab-strip [data-tab-id]",
      );
      if (!tab) return -1;
      const title = tab.querySelector<HTMLElement>("[data-testid=tab-title]");
      const close = tab.querySelector<HTMLElement>(
        'button[title="关闭 (Cmd+W)"]',
      );
      if (!title || !close) return -1;
      return (
        close.getBoundingClientRect().left - title.getBoundingClientRect().right
      );
    });
    expect(innerGap).toBeLessThanOrEqual(7);

    await page.screenshot({ path: `${ARTIFACT_DIR}/02-tab-inner-gap.png` });
  });

  test("长标题省略号收尾、短标题随伸缩拉伸（A-1.1/A-1.2/A-1.3）", async ({
    page,
  }) => {
    // 收窄视口，让长标题确实超过分配宽度（弹性布局下没有固定上限可依赖）
    await page.setViewportSize({ width: 900, height: 800 });
    await boot(page);
    await openFile(page, "/tmp/1180/short.md");
    const longPath =
      "/tmp/1180/very-long-tab-title-abcdefghijklmnopqrstuvwxyz-0123456789-abcdefghijklmnopqrstuvwxyz-9876543210.md";
    await openFile(page, longPath);

    const titles = page.locator(
      '.tab-strip [data-tab-id] [data-testid="tab-title"]',
    );
    const styles = await readTitleStyles(page);
    expect(styles.length).toBe(2);

    // A-1.1/A-1.2：长标题在分配宽度内以省略号收尾、单行不换行
    const long = await titles.last().evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        textOverflow: cs.textOverflow,
        whiteSpace: cs.whiteSpace,
        lineClamp: cs.webkitLineClamp,
        clipped: el.scrollWidth > el.clientWidth + 1,
        lines: Math.round(
          el.getBoundingClientRect().height /
            (parseFloat(cs.lineHeight) || el.getBoundingClientRect().height),
        ),
      };
    });
    expect(long.textOverflow).toBe("ellipsis");
    expect(long.whiteSpace).toBe("nowrap");
    expect(long.lineClamp).toBe("none");
    expect(long.lines).toBe(1);
    expect(long.clipped).toBe(true);

    // A-1.3：短标题所在页签随伸缩拉伸——页签宽度大于标题文本实际宽度
    const short = await page
      .locator(".tab-strip [data-tab-id]")
      .first()
      .evaluate((el) => {
        const title = el.querySelector<HTMLElement>(
          '[data-testid="tab-title"]',
        );
        const range = document.createRange();
        range.selectNodeContents(title!);
        return {
          tabWidth: el.getBoundingClientRect().width,
          textWidth: range.getBoundingClientRect().width,
        };
      });
    expect(short.tabWidth).toBeGreaterThan(short.textWidth + 8);

    const widths = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(".tab-strip [data-tab-id]"),
      ).map((el) => el.getBoundingClientRect().width),
    );
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);

    await page.screenshot({ path: `${ARTIFACT_DIR}/01-title-ellipsis.png` });
  });

  test("保底被击穿后页签条才横向滚动（A-1.5）", async ({ page }) => {
    await boot(page);
    const long = "very-long-tab-title-abcdefghijklmnopqrstuvwxyz-";
    for (let i = 0; i < 8; i += 1) {
      await openFile(page, `/tmp/1053/${long}${i}.md`);
    }

    const strip = page.locator(".tab-strip").first();
    const minWidth = await page.evaluate(() =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--tab-min-width",
        ),
      ),
    );
    expect(minWidth).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1600, height: 800 });
    await expect
      .poll(async () =>
        strip.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      )
      .toBe(true);
    const wideWidths = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(".tab-strip [data-tab-id]"),
      ).map((el) => el.getBoundingClientRect().width),
    );
    for (const w of wideWidths) {
      expect(w).toBeGreaterThan(minWidth + 8);
    }

    await page.setViewportSize({ width: 700, height: 800 });
    await expect
      .poll(async () => strip.evaluate((el) => el.scrollWidth > el.clientWidth))
      .toBe(true);
    const narrowWidths = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(".tab-strip [data-tab-id]"),
      ).map((el) => el.getBoundingClientRect().width),
    );
    for (const w of narrowWidths) {
      expect(Math.abs(w - minWidth)).toBeLessThanOrEqual(1);
    }

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
    // 单行后页签高度由内容决定，此处只要求图标完整可见、不被页签条裁切。
    expect(boxed.iconTop).toBeGreaterThanOrEqual(0);
    expect(boxed.iconBottom).toBeLessThanOrEqual(boxed.tabHeight);
    expect(boxed.iconBottom).toBeLessThanOrEqual(boxed.stripHeight);

    await page.screenshot({
      path: `${ARTIFACT_DIR}/03-strip-min-width-scroll.png`,
    });
  });

  test("窗格变窄时多页签等比收缩、无覆盖、无溢出（shell-tabs-surface 1.1）", async ({
    page,
  }) => {
    await boot(page);
    for (let i = 0; i < 4; i += 1) {
      await openFile(page, `/tmp/1180/tab-${i}.md`);
    }

    const strip = page.locator(".tab-strip").first();
    const read = () =>
      page.evaluate(() => {
        const el = document.querySelector<HTMLElement>(".tab-strip");
        const rects = Array.from(
          document.querySelectorAll<HTMLElement>(".tab-strip [data-tab-id]"),
        ).map((t) => t.getBoundingClientRect());
        return {
          gap: getComputedStyle(el!).columnGap,
          clientWidth: el!.clientWidth,
          scrollWidth: el!.scrollWidth,
          widths: rects.map((r) => r.width),
          lefts: rects.map((r) => r.left),
          rights: rects.map((r) => r.right),
        };
      });

    await page.setViewportSize({ width: 1400, height: 800 });
    const wide = await read();
    expect(wide.scrollWidth).toBeLessThanOrEqual(wide.clientWidth + 1);
    expect(new Set(wide.widths.map((w) => Math.round(w))).size).toBe(1);
    await page.screenshot({ path: `${ARTIFACT_DIR}/04-wide-stretch.png` });

    await page.setViewportSize({ width: 900, height: 800 });
    const narrow = await read();
    expect(new Set(narrow.widths.map((w) => Math.round(w))).size).toBe(1);
    expect(narrow.widths[0]).toBeLessThan(wide.widths[0]);
    expect(narrow.gap).toBe("32px");
    for (let i = 1; i < narrow.lefts.length; i += 1) {
      expect(narrow.lefts[i]).toBeGreaterThanOrEqual(
        narrow.rights[i - 1] - 0.5,
      );
    }
    expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth + 1);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/05-narrow-equal-shrink.png`,
    });
  });

  test("关闭页签后页签间距保持 32px 且长标题仍省略", async ({ page }) => {
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
    expect(gapBefore).toBe("32px");

    const tabs = page.locator(".tab-strip [data-tab-id]");
    await tabs.nth(1).hover();
    await tabs.nth(1).locator('button[title="关闭 (Cmd+W)"]').click();
    await expect(tabs).toHaveCount(2);

    const gapAfter = await strip.evaluate(
      (el) => getComputedStyle(el).columnGap,
    );
    expect(gapAfter).toBe("32px");

    const styles = await readTitleStyles(page);
    // 长标题在关闭其他页签后仍以省略号收尾（不会因空间变宽而回退成全显）
    expect(
      styles.filter((s) => s.textOverflow === "ellipsis").length,
    ).toBeGreaterThanOrEqual(1);
    for (const st of styles) {
      expect(st.lineClamp).toBe("none");
    }

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
