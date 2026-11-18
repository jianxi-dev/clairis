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

test.describe("页签标题单行全显与间距（editor-surface-batch22 1.1 / #1053）", () => {
  test.beforeAll(() => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  });

  test("相邻页签间距为 32px（A-1.1）", async ({ page }) => {
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

    await page.screenshot({ path: `${ARTIFACT_DIR}/02-gap-32.png` });
  });

  test("长页签名单行完整显示、无省略号（A-1.2/A-1.3/A-1.4）", async ({
    page,
  }) => {
    await boot(page);
    await openFile(page, "/tmp/1053/short.md");
    await openFile(
      page,
      "/tmp/1053/very-long-tab-title-abcdefghijklmnopqrstuvwxyz-01.md",
    );

    const styles = await readTitleStyles(page);
    expect(styles.length).toBeGreaterThan(0);

    // A-1.2：没有任何页签标题生效 text-overflow: ellipsis
    expect(
      styles.filter((s) => s.textOverflow === "ellipsis").length,
    ).toBe(0);

    // A-1.3：至少一个页签标题的计算 -webkit-line-clamp 为 none
    expect(styles.filter((s) => s.lineClamp === "none").length).toBeGreaterThanOrEqual(1);

    // A-1.4：至少一个页签标题的计算 white-space 为 nowrap
    expect(
      styles.filter((s) => s.whiteSpace === "nowrap").length,
    ).toBeGreaterThanOrEqual(1);

    // 视觉事实复核：长标题不再折成两行（行盒数为 1）
    const lines = await page
      .locator('.tab-strip [data-tab-id] [data-testid="tab-title"]')
      .last()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        const lineHeight = Number.isFinite(lh) && lh > 0 ? lh : el.getBoundingClientRect().height;
        return Math.round(el.getBoundingClientRect().height / lineHeight);
      });
    expect(lines).toBe(1);

    await page.screenshot({ path: `${ARTIFACT_DIR}/01-long-titles-nowrap.png` });
  });

  test("多个长页签时页签条可横向滚动（A-1.5）", async ({ page }) => {
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
    // 单行后页签高度由内容决定，此处只要求图标完整可见、不被页签条裁切。
    expect(boxed.iconTop).toBeGreaterThanOrEqual(0);
    expect(boxed.iconBottom).toBeLessThanOrEqual(boxed.tabHeight);
    expect(boxed.iconBottom).toBeLessThanOrEqual(boxed.stripHeight);

    await page.screenshot({ path: `${ARTIFACT_DIR}/03-strip-scrollable.png` });
  });

  test("关闭页签后间距保持 32px 且无残留省略号", async ({ page }) => {
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
    expect(
      styles.filter((s) => s.textOverflow === "ellipsis").length,
    ).toBe(0);

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
