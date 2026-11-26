import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * #1017 复现探针（measure-before-you-fix）。
 *
 * 矩阵：内容形态 × A/B 态 × 窗宽，量测面板 / 宿主 / 浮层相对「文档页边界」
 * （doc-property-host）与视口的右缘，落截图 + 数值 JSON 到 .artifacts/1017/。
 *
 * 判定（任一成立即复现）：
 *  - 面板右缘 > 宿主右缘
 *  - 面板右缘 > 视口右缘
 *  - 面板后代右缘 > 宿主右缘（内容视觉溢出）
 *  - 文档 scrollWidth > 视口宽（整窗横滚）
 */

const APP_URL = "http://localhost:1424";
const ART = path.resolve(process.cwd(), ".artifacts/1017");

/** 矩阵通过后合并一条 state-coverage 记录（IC-2 ≥4 态）。 */
async function recordState(page: Page, state: string): Promise<void> {
  const file = path.join(ART, `${state}.png`);
  await page.screenshot({ path: file });
  const manifest = path.join(ART, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: "1017-overflow", states }, null, 2)}\n`,
  );
}
const WIDTHS = [1280, 900, 640, 400];

/** #1040：卡片宽度对齐正文测量宽度，四档视口各录一态。 */
const ART_1040 = path.resolve(process.cwd(), ".artifacts/1040");
const CARD_WIDTHS = [1280, 900, 640, 300];

/** 与 recordState 同构，落点目录可指定（#1040 卡片宽度态），返回截图相对路径。 */
async function recordStateDir(
  page: Page,
  dir: string,
  state: string,
): Promise<string> {
  const art = path.resolve(process.cwd(), `.artifacts/${dir}`);
  mkdirSync(art, { recursive: true });
  const file = path.join(art, `${state}.png`);
  await page.screenshot({ path: file });
  const rel = path.relative(process.cwd(), file);
  const manifest = path.join(art, "state-coverage.json");
  let states: Array<Record<string, string>> = [];
  try {
    states = JSON.parse(readFileSync(manifest, "utf8")).states ?? [];
  } catch {
    states = [];
  }
  states = states.filter((s) => s.state !== state);
  states.push({
    state,
    screenshot: path.relative(process.cwd(), file),
    assertion: "passed",
    recorded_at: new Date().toISOString(),
    runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
  });
  writeFileSync(
    manifest,
    `${JSON.stringify({ task: dir, states }, null, 2)}\n`,
  );
  return rel;
}

const LONG_ASCII = "A".repeat(220);

const SHAPES: Array<{ id: string; doc: string }> = [
  {
    id: "baseline",
    doc: `---\ntitle: 属性面板测试\ntags:\n  - 甲\n  - 乙\ncount: 1234567\npublished: true\n---\n\n# 正文\n`,
  },
  {
    id: "long-value",
    doc: `---\ntitle: 长值\nnote: ${LONG_ASCII}\n---\n\n# 正文\n`,
  },
  {
    id: "long-key",
    doc: `---\ntitle: 长键名\n${"k".repeat(60)}: 值\n---\n\n# 正文\n`,
  },
  {
    id: "many-tags",
    doc: `---\ntitle: 多标签\ntags:\n${Array.from({ length: 12 }, (_, i) => `  - 标签${i}`).join("\n")}\n---\n\n# 正文\n`,
  },
  {
    id: "long-title",
    doc: `---\ntitle: ${LONG_ASCII}\ncount: 1\n---\n\n# 正文\n`,
  },
  {
    id: "long-key-value",
    doc: `---\ntitle: 长键长值\n${"k".repeat(60)}: ${"V".repeat(120)}\n---\n\n# 正文\n`,
  },
];

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openDoc(page: Page, content: string): Promise<void> {
  await page.evaluate((c) => {
    (
      window as unknown as {
        __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
      }
    ).__biaoyue_openFile__("/Users/test/prop.md", c, "prop.md");
  }, content);
}

async function setMode(page: Page, mode: "preview" | "edit" | "source") {
  await page.evaluate((m) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { setEditorMode: (m: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .setEditorMode(m as "preview" | "edit" | "source");
  }, mode);
}

async function setVariant(page: Page, variant: "A" | "B") {
  await page.evaluate((v) => {
    (
      window as unknown as {
        __biaoyue_doc_property__: {
          getState: () => { setVariant: (v: "A" | "B") => void };
        };
      }
    ).__biaoyue_doc_property__
      .getState()
      .setVariant(v);
  }, variant);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface Overflowing {
  sel: string;
  scrollWidth: number;
  clientWidth: number;
  right: number;
}

interface Measure {
  vw: number;
  docScrollWidth: number;
  host: Box | null;
  panel: Box | null;
  panelScrollWidth: number | null;
  panelClientWidth: number | null;
  maxDescendantRight: number | null;
  worst: string | null;
  overflowing: Overflowing[];
}

async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    };
    const host = document.querySelector('[data-testid="doc-property-host"]');
    const panel = document.querySelector(".dpb-panel");
    let maxRight = -Infinity;
    let worst: string | null = null;
    const overflowing: Overflowing[] = [];
    if (panel) {
      for (const el of Array.from(panel.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.right > maxRight) {
          maxRight = r.right;
          const cls = el.getAttribute("class") ?? "";
          worst = `${el.tagName.toLowerCase()}.${cls}[${el.getAttribute("data-testid") ?? ""}]`;
        }
        // 文本溢出但元素盒被压缩（overflow-x: visible）→ 内容会画到面板外。
        const cs = getComputedStyle(el);
        if (
          cs.overflowX === "visible" &&
          el.scrollWidth > el.clientWidth + 2 &&
          el.clientWidth > 0
        ) {
          const cls = el.getAttribute("class") ?? "";
          overflowing.push({
            sel: `${el.tagName.toLowerCase()}.${cls}[${el.getAttribute("data-testid") ?? ""}]`,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            right: r.right,
          });
        }
      }
    }
    return {
      vw: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      host: box(host),
      panel: box(panel),
      panelScrollWidth: panel ? (panel as HTMLElement).scrollWidth : null,
      panelClientWidth: panel ? (panel as HTMLElement).clientWidth : null,
      maxDescendantRight: maxRight === -Infinity ? null : maxRight,
      worst,
      overflowing,
    };
  });
}

function verdict(m: Measure) {
  const hostRight = m.host?.right ?? m.vw;
  const panelRight = m.panel?.right ?? 0;
  const maxRight = m.maxDescendantRight ?? 0;
  const panelOverflow =
    (m.panelScrollWidth ?? 0) > (m.panelClientWidth ?? 0) + 0.5;
  return {
    panelExceedsHost: panelRight > hostRight + 0.5,
    panelExceedsViewport: panelRight > m.vw + 0.5,
    hostExceedsViewport: (m.host?.right ?? 0) > m.vw + 0.5,
    contentExceedsHost: maxRight > hostRight + 0.5,
    contentExceedsViewport: maxRight > m.vw + 0.5,
    horizontalScroll: m.docScrollWidth > m.vw + 1,
    panelContentOverflow: panelOverflow,
    overflowingCount: m.overflowing.length,
  };
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test("复现矩阵：面板本体（形态 × A/B × 窗宽）", async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  const rows: Array<Record<string, unknown>> = [];

  for (const shape of SHAPES) {
    for (const variant of ["A", "B"] as const) {
      await openDoc(page, shape.doc);
      await setMode(page, "edit");
      await setVariant(page, variant);
      await expect(
        page.locator(`[data-testid="dpb-${variant.toLowerCase()}"]`),
      ).toBeVisible();

      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(120);
        const m = await measure(page);
        const v = verdict(m);
        const shot = path.join(ART, `body-${shape.id}-${variant}-${w}.png`);
        await page.screenshot({ path: shot });
        rows.push({
          shape: shape.id,
          variant,
          width: w,
          hostRight: m.host?.right ?? null,
          panelRight: m.panel?.right ?? null,
          maxDescendantRight: m.maxDescendantRight,
          worst: m.worst,
          docScrollWidth: m.docScrollWidth,
          panelScrollWidth: m.panelScrollWidth,
          panelClientWidth: m.panelClientWidth,
          overflowing: m.overflowing,
          screenshot: path.relative(process.cwd(), shot),
          ...v,
        });
      }
    }
  }

  writeFileSync(
    path.join(ART, "probe-body-matrix.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );

  const bad = rows.filter(
    (r) =>
      r.panelExceedsHost === true ||
      r.panelExceedsViewport === true ||
      r.contentExceedsHost === true ||
      r.contentExceedsViewport === true ||
      r.horizontalScroll === true ||
      r.panelContentOverflow === true,
  );
  expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  await recordState(page, "01-body-matrix-no-overflow");
});

test("复现矩阵：菜单浮层（类型 / 模板 / 标签建议）", async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  const rows: Array<Record<string, unknown>> = [];
  const doc = `---\ntitle: 浮层测试\ntags:\n  - 甲\nnote: 链接值\n---\n\n# 正文\n`;

  for (const variant of ["A", "B"] as const) {
    await openDoc(page, doc);
    await setMode(page, "edit");
    await setVariant(page, variant);
    const panel = page.locator(`[data-testid="dpb-${variant.toLowerCase()}"]`);
    await expect(panel).toBeVisible();

    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(120);

      // 类型菜单：B 行走行内类型按钮；A 态走 chip 内类型按钮。
      const typeBtn = panel.locator('[data-testid="dpb-type"]').first();
      await typeBtn.click();
      await expect(page.locator('[data-testid="dpb-type-menu"]')).toBeVisible();
      let menuBox = (await page
        .locator('[data-testid="dpb-type-menu"]')
        .boundingBox())!;
      let m = await measure(page);
      rows.push({
        menu: "type",
        variant,
        width: w,
        menuLeft: menuBox.x,
        menuRight: menuBox.x + menuBox.width,
        vw: m.vw,
        hostRight: m.host?.right ?? null,
        exceedsViewport: menuBox.x + menuBox.width > m.vw + 0.5,
        exceedsHost: menuBox.x + menuBox.width > (m.host?.right ?? m.vw) + 0.5,
        screenshot: await shot(page, `menu-type-${variant}-${w}.png`),
      });
      await page.keyboard.press("Escape");

      // 模板菜单
      await panel.locator('[data-testid="dpb-template"]').click();
      await expect(
        page.locator('[data-testid="dpb-template-menu"]'),
      ).toBeVisible();
      menuBox = (await page
        .locator('[data-testid="dpb-template-menu"]')
        .boundingBox())!;
      m = await measure(page);
      rows.push({
        menu: "template",
        variant,
        width: w,
        menuLeft: menuBox.x,
        menuRight: menuBox.x + menuBox.width,
        vw: m.vw,
        hostRight: m.host?.right ?? null,
        exceedsViewport: menuBox.x + menuBox.width > m.vw + 0.5,
        exceedsHost: menuBox.x + menuBox.width > (m.host?.right ?? m.vw) + 0.5,
        screenshot: await shot(page, `menu-template-${variant}-${w}.png`),
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(80);
    }
  }

  writeFileSync(
    path.join(ART, "probe-menu-matrix.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );

  const bad = rows.filter(
    (r) => r.exceedsViewport === true || r.exceedsHost === true,
  );
  expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  await recordState(page, "02-menu-matrix-in-viewport");
});

test("复现矩阵：建议菜单与模板状态", async ({ page }) => {
  mkdirSync(ART, { recursive: true });
  const rows: Array<Record<string, unknown>> = [];
  const doc = `---\ntitle: 浮层测试\ntags:\n  - 甲\nlinks:\n  - "[[某文档]]"\n---\n\n# 正文\n`;

  for (const variant of ["A", "B"] as const) {
    await openDoc(page, doc);
    await setMode(page, "edit");
    await setVariant(page, variant);
    const panel = page.locator(`[data-testid="dpb-${variant.toLowerCase()}"]`);
    await expect(panel).toBeVisible();

    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(120);

      const tagValue = panel.locator(
        '[data-key="tags"] [data-testid="dpb-chip-value"]',
      );
      const tagValueBox = (await tagValue.boundingBox())!;
      await page.mouse.click(
        tagValueBox.x + tagValueBox.width - 4,
        tagValueBox.y + tagValueBox.height / 2,
      );
      const tagInput = panel.locator('[data-testid="dpb-tag-input"]').first();
      await tagInput.fill("标");
      await expect(page.locator('[data-testid="dpb-tag-menu"]')).toBeVisible();
      const tagBox = (await page
        .locator('[data-testid="dpb-tag-menu"]')
        .boundingBox())!;
      const m1 = await measure(page);
      rows.push({
        menu: "tag",
        variant,
        width: w,
        menuRight: tagBox.x + tagBox.width,
        menuBottom: tagBox.y + tagBox.height,
        vw: m1.vw,
        hostRight: m1.host?.right ?? null,
        exceedsViewport: tagBox.x + tagBox.width > m1.vw + 0.5,
        exceedsHost: tagBox.x + tagBox.width > (m1.host?.right ?? m1.vw) + 0.5,
        screenshot: await shot(page, `menu-tag-${variant}-${w}.png`),
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(80);

      const linkValue = panel.locator(
        '[data-key="links"] [data-testid="dpb-chip-value"]',
      );
      const linkValueBox = (await linkValue.boundingBox())!;
      await page.mouse.click(
        linkValueBox.x + linkValueBox.width - 4,
        linkValueBox.y + linkValueBox.height / 2,
      );
      const linkInput = panel.locator('[data-testid="dpb-link-input"]').first();
      await linkInput.fill("[[");
      await expect(page.locator('[data-testid="dpb-doc-menu"]')).toBeVisible();
      const docBox = (await page
        .locator('[data-testid="dpb-doc-menu"]')
        .boundingBox())!;
      rows.push({
        menu: "doc",
        variant,
        width: w,
        menuRight: docBox.x + docBox.width,
        menuBottom: docBox.y + docBox.height,
        vw: m1.vw,
        hostRight: m1.host?.right ?? null,
        exceedsViewport: docBox.x + docBox.width > m1.vw + 0.5,
        exceedsHost: docBox.x + docBox.width > (m1.host?.right ?? m1.vw) + 0.5,
        screenshot: await shot(page, `menu-doc-${variant}-${w}.png`),
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(80);

      // 套用模板后的状态文案（长模板名场景的近似）
      await panel.locator('[data-testid="dpb-template"]').click();
      await page.locator('[data-testid="dpb-template-option"]').first().click();
      await expect(
        page.locator('[data-testid="dpb-tpl-status"]'),
      ).toBeVisible();
      const stBox = (await page
        .locator('[data-testid="dpb-tpl-status"]')
        .boundingBox())!;
      const m2 = await measure(page);
      rows.push({
        menu: "tpl-status",
        variant,
        width: w,
        menuRight: stBox.x + stBox.width,
        vw: m2.vw,
        hostRight: m2.host?.right ?? null,
        panelScrollWidth: m2.panelScrollWidth,
        panelClientWidth: m2.panelClientWidth,
        exceedsViewport: stBox.x + stBox.width > m2.vw + 0.5,
        exceedsHost: stBox.x + stBox.width > (m2.host?.right ?? m2.vw) + 0.5,
        panelContentOverflow:
          (m2.panelScrollWidth ?? 0) > (m2.panelClientWidth ?? 0) + 2,
        screenshot: await shot(page, `tpl-status-${variant}-${w}.png`),
      });
    }
  }

  writeFileSync(
    path.join(ART, "probe-suggest-matrix.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );

  const bad = rows.filter(
    (r) =>
      r.exceedsViewport === true ||
      r.exceedsHost === true ||
      r.panelContentOverflow === true,
  );
  expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  await recordState(page, "03-suggest-matrix-in-viewport");
  await recordState(page, "04-final-panel-b-narrow");
});

test("卡片宽度对齐正文测量宽度（1280/900/640/300 四档）", async ({ page }) => {
  mkdirSync(ART_1040, { recursive: true });
  const rows: Array<Record<string, unknown>> = [];
  const doc = `---\ntitle: 卡片宽度对齐\nnote: 一个值\ncount: 1\n---\n\n# 正文\n`;

  await openDoc(page, doc);
  await setMode(page, "edit");
  await setVariant(page, "A");
  await expect(page.locator('[data-testid="dpb-a"]')).toBeVisible();

  for (const w of CARD_WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(150);
    const m = await measure(page);
    const info = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="doc-property-host"]');
      const panelEl = document.querySelector(".dpb-panel");
      if (!host || !panelEl) return null;
      const cs = getComputedStyle(panelEl);
      const hostCs = getComputedStyle(host);
      const hostRect = host.getBoundingClientRect();
      const panelRect = panelEl.getBoundingClientRect();
      return {
        measure: parseFloat(cs.getPropertyValue("--type-measure")) || null,
        available:
          hostRect.width -
          parseFloat(hostCs.paddingLeft || "0") -
          parseFloat(hostCs.paddingRight || "0"),
        radius: parseFloat(cs.borderRadius || "0"),
        panelWidth: panelRect.width,
        panelX: panelRect.x,
        panelRight: panelRect.right,
        hostX: hostRect.x,
        hostRight: hostRect.right,
      };
    });
    const shotPath = await recordStateDir(page, "1040", `card-width-${w}`);
    const v = verdict(m);
    rows.push({
      width: w,
      measure: info?.measure ?? null,
      available: info?.available ?? null,
      expectedWidth:
        info && info.measure != null
          ? Math.min(info.available, info.measure)
          : null,
      radius: info?.radius ?? null,
      panelWidth: info?.panelWidth ?? null,
      panelX: info?.panelX ?? null,
      panelRight: info?.panelRight ?? null,
      hostX: info?.hostX ?? null,
      hostRight: info?.hostRight ?? null,
      docScrollWidth: m.docScrollWidth,
      vw: m.vw,
      screenshot: shotPath,
      ...v,
    });
  }

  writeFileSync(
    path.join(ART_1040, "card-width.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );

  for (const r of rows) {
    const width = r.width as number;
    expect(r.radius, `radius@${width}`).toBeGreaterThan(0);
    expect(r.expectedWidth, `expectedWidth@${width}`).not.toBeNull();
    expect(
      Math.abs((r.panelWidth as number) - (r.expectedWidth as number)),
      `card width vs min(available, measure) @${width}: panel=${r.panelWidth} expected=${r.expectedWidth}`,
    ).toBeLessThanOrEqual(2);
    expect(r.panelRight as number, `panelRight@${width}`).toBeLessThanOrEqual(
      (r.hostRight as number) + 0.5,
    );
    expect(r.panelX as number, `panelX@${width}`).toBeGreaterThanOrEqual(
      (r.hostX as number) - 0.5,
    );
    expect(
      r.docScrollWidth as number,
      `horizontal overflow @${width}`,
    ).toBeLessThanOrEqual((r.vw as number) + 1);
    expect(r.panelContentOverflow, `panel content overflow @${width}`).toBe(
      false,
    );
    expect(r.overflowingCount, `overflowing elements @${width}`).toBe(0);
  }
});

async function shot(page: Page, name: string): Promise<string> {
  const file = path.join(ART, name);
  await page.screenshot({ path: file });
  return path.relative(process.cwd(), file);
}
