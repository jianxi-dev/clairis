import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "fs";

const APP_URL = process.env.BIAOYUE_E2E_URL ?? "http://localhost:1420";
const ARTIFACT_DIR = ".artifacts/1231";

/**
 * 等长标题页签的宽度容差。激活页签走 `font-medium`（字重更宽），
 * 同字符数的标题文本会宽出几像素；等比收缩的断言按此容差判定「等宽」。
 */
const EQUAL_WIDTH_TOLERANCE = 8;

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

/** 页签条整体度量：页签宽/左右缘、容器宽、滚动宽、尾部空白宽、上下限 token。 */
type StripMetrics = {
  clientWidth: number;
  scrollWidth: number;
  widths: number[];
  lefts: number[];
  rights: number[];
  gap: string;
  tailWidth: number;
  tabMinWidth: number;
  tabMaxWidth: number;
};

async function readStrip(page: Page): Promise<StripMetrics> {
  return page.evaluate(() => {
    const strip = document.querySelector<HTMLElement>(".tab-strip")!;
    const cs = getComputedStyle(document.documentElement);
    const rects = Array.from(
      document.querySelectorAll<HTMLElement>(".tab-strip [data-tab-id]"),
    ).map((t) => t.getBoundingClientRect());
    const tail = document.querySelector<HTMLElement>(
      '[data-testid="tab-strip-tail"]',
    );
    // --tab-max-width 引用 --tab-info-width；直接读解析后的计算值，
    // 老浏览器若回退成 var() 文本则回退到 --tab-info-width。
    const rawMax = cs.getPropertyValue("--tab-max-width").trim();
    const tabMaxWidth = rawMax.endsWith("px")
      ? parseFloat(rawMax)
      : parseFloat(cs.getPropertyValue("--tab-info-width"));
    return {
      clientWidth: strip.clientWidth,
      scrollWidth: strip.scrollWidth,
      widths: rects.map((r) => r.width),
      lefts: rects.map((r) => r.left),
      rights: rects.map((r) => r.right),
      gap: getComputedStyle(strip).columnGap,
      tailWidth: tail ? tail.getBoundingClientRect().width : 0,
      tabMinWidth: parseFloat(cs.getPropertyValue("--tab-min-width")),
      tabMaxWidth,
    };
  });
}

/** 页签宽度 vs 标题文本实际宽度（用于证明「不伸展」）。 */
async function readTabVsText(
  page: Page,
  index: number,
): Promise<{ tabWidth: number; textWidth: number }> {
  return page
    .locator(".tab-strip [data-tab-id]")
    .nth(index)
    .evaluate((el) => {
      const title = el.querySelector<HTMLElement>('[data-testid="tab-title"]')!;
      const range = document.createRange();
      range.selectNodeContents(title);
      return {
        tabWidth: el.getBoundingClientRect().width,
        textWidth: range.getBoundingClientRect().width,
      };
    });
}

/** 宽度极差（最大值 - 最小值），用于「等宽」判定。 */
function spread(widths: number[]): number {
  return Math.max(...widths) - Math.min(...widths);
}

test.describe("页签弹性伸缩与间距（tab-title-info-surface / shell-tabs-surface 1.1 / #1231）", () => {
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

  test("长标题省略号收尾、短标题按实际宽度显示（A-1.1/A-1.2/A-1.3 / #1231）", async ({
    page,
  }) => {
    // 收窄视口，让长标题确实超过分配宽度（弹性布局下没有固定上限可依赖）
    await page.setViewportSize({ width: 900, height: 800 });
    await boot(page);
    await openFile(page, "/tmp/1231/short.md");
    const longPath =
      "/tmp/1231/very-long-tab-title-abcdefghijklmnopqrstuvwxyz-0123456789-abcdefghijklmnopqrstuvwxyz-9876543210.md";
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

    // A-1.3（#1231 反转 #1180 的「短标题随伸缩拉伸」）：短标题页签不伸展，
    // 宽度贴合内容（图标 + 文本 + 关闭钮 + 内距），并明显窄于顶到上限的长页签。
    const short = await readTabVsText(page, 0);
    expect(short.tabWidth).toBeLessThanOrEqual(short.textWidth + 80);

    const m = await readStrip(page);
    expect(m.widths[0]).toBeLessThan(m.widths[1]);
    // 长页签被 --tab-max-width 上限钳住（内容远超 256px）
    expect(Math.abs(m.widths[1] - m.tabMaxWidth)).toBeLessThanOrEqual(1);
    expect(m.widths[0]).toBeLessThan(m.tabMaxWidth);

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
    const wide = await readStrip(page);
    for (const w of wide.widths) {
      // 长标题页签先被 --tab-max-width 钳住，再随可用宽度收缩；始终不超上限
      expect(w).toBeLessThanOrEqual(wide.tabMaxWidth + 1);
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
    // 长标题的 max-content > 96px，保底仍为 96px
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

  test("页签不伸展：宽视口受上限约束、窄视口等比收缩（shell-tabs-surface 1.1 / #1231）", async ({
    page,
  }) => {
    await boot(page);
    for (let i = 0; i < 4; i += 1) {
      await openFile(page, `/tmp/1231/tab-0${i}-abcdefghijklmn.md`);
    }

    await page.setViewportSize({ width: 1400, height: 800 });
    const wide = await readStrip(page);
    // 宽视口：页签不伸展，宽度 ≤ --tab-max-width 上限
    for (const w of wide.widths) {
      expect(w).toBeLessThanOrEqual(wide.tabMaxWidth + 1);
    }
    // 总宽不溢出，且尾部空白区仍在（不随页签伸缩被吃掉）
    expect(wide.scrollWidth).toBeLessThanOrEqual(wide.clientWidth + 1);
    expect(wide.tailWidth).toBeGreaterThan(0);
    await page.screenshot({ path: `${ARTIFACT_DIR}/04-wide-no-stretch.png` });

    await page.setViewportSize({ width: 900, height: 800 });
    const narrow = await readStrip(page);
    // 等比收缩：等长标题页签收缩到近似等宽（激活页签 font-medium 有几像素差）
    expect(spread(narrow.widths)).toBeLessThanOrEqual(EQUAL_WIDTH_TOLERANCE);
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

  test("单个短名页签不铺满页签条（#1231）", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page);
    await openFile(page, "/tmp/1231/a");

    const m = await readStrip(page);
    const short = await readTabVsText(page, 0);
    // 不铺满：页签右缘之后仍有尾部空白区
    expect(m.widths[0]).toBeLessThan(m.clientWidth - m.tailWidth);
    // 不伸展：页签宽度贴合内容，明显小于 96px 保底（短名按实际宽度）
    expect(short.tabWidth).toBeLessThanOrEqual(short.textWidth + 80);
    expect(m.widths[0]).toBeLessThan(m.tabMinWidth);

    await page.screenshot({ path: `${ARTIFACT_DIR}/06-single-short-tab.png` });
  });

  test("短名按实际宽度显示：短名页签窄于长名页签（#1231）", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page);
    await openFile(page, "/tmp/1231/a");
    await openFile(
      page,
      "/tmp/1231/abcdefghijklmnopqrstuvwxyz-0123456789-abcd.md",
    );

    const m = await readStrip(page);
    expect(m.widths.length).toBe(2);
    expect(m.widths[0]).toBeLessThan(m.widths[1]);
    // 短名页签低于 96px 保底（未被撑到保底）
    expect(m.widths[0]).toBeLessThan(m.tabMinWidth);
    // 长名页签顶到 --tab-max-width 上限
    expect(Math.abs(m.widths[1] - m.tabMaxWidth)).toBeLessThanOrEqual(1);

    await page.screenshot({ path: `${ARTIFACT_DIR}/07-short-vs-long.png` });
  });

  test("两个等长页签在窄视口等比收缩到等宽（#1231）", async ({ page }) => {
    await boot(page);
    await openFile(page, "/tmp/1231/same-length-name-aaaa.md");
    await openFile(page, "/tmp/1231/same-length-name-bbbb.md");

    await page.setViewportSize({ width: 1400, height: 800 });
    const wide = await readStrip(page);
    expect(spread(wide.widths)).toBeLessThanOrEqual(EQUAL_WIDTH_TOLERANCE);
    expect(wide.scrollWidth).toBeLessThanOrEqual(wide.clientWidth + 1);

    await page.setViewportSize({ width: 560, height: 800 });
    const narrow = await readStrip(page);
    // 等比收缩：两页签仍近似等宽，且窄于宽视口下的内容宽
    expect(spread(narrow.widths)).toBeLessThanOrEqual(EQUAL_WIDTH_TOLERANCE);
    expect(narrow.widths[0]).toBeLessThan(wide.widths[0]);
    expect(narrow.widths[0]).toBeGreaterThanOrEqual(narrow.tabMinWidth - 1);
    expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth + 1);
    for (let i = 1; i < narrow.lefts.length; i += 1) {
      expect(narrow.lefts[i]).toBeGreaterThanOrEqual(
        narrow.rights[i - 1] - 0.5,
      );
    }

    await page.screenshot({
      path: `${ARTIFACT_DIR}/08-two-tabs-equal-shrink.png`,
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
      path: `${ARTIFACT_DIR}/09-after-close-keeps-gap.png`,
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
