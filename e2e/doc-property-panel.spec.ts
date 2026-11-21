import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tagColor } from "../src/lib/frontmatter";

/**
 * 文档属性面板首通（#973 / P-1、P-10）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js：`__biaoyue_openFile__` 注入文档，
 * `__biaoyue_doc_property__` 切换显示样式。断言落到计算样式与文本，
 * 不停留在「元素存在」。
 */

const APP_URL = "http://localhost:1420";

/** 单用例证据采集：截图落 .artifacts/<dir>/ 并合并 state-coverage.json（IC-2 ≥4 态）。 */
async function dpbRecord(
  page: Page,
  dir: string,
  state: string,
): Promise<void> {
  const ART = path.resolve(process.cwd(), `.artifacts/${dir}`);
  mkdirSync(ART, { recursive: true });
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
    `${JSON.stringify({ task: dir, states }, null, 2)}\n`,
  );
}

const DOC = `---
title: 属性面板测试
tags:
  - 甲
  - 乙
count: 1234567
published: true
created: 2026-11-14
updated: 2026-11-15T10:30:00
---

# 正文
`;

const LONG_DOC = `---
title: 长值测试
note: 这是一段很长的属性值，用来验证两行截断与悬停显示全文的能力。它必须足够长，长到在面板宽度内也无法一行放下，因而会折成三行以上，再被面板截断到两行。这里继续补充更多文字，确保总长度超过面板的可用宽度，从而触发溢出隐藏与 title 全文提示。再重复一次：这是一段很长的属性值，用来验证两行截断与悬停显示全文的能力。它必须足够长，长到在面板宽度内也无法一行放下，因而会折成三行以上，再被面板截断到两行。第三遍继续堆叠文字：两行截断、悬停全文、引擎无关的 max-height 方案，这些行为都依赖足够长的内容才能被真实浏览器验证。再补一句确保超过三行。
---

# 正文
`;

const LONG_NAME_DOC = `---
title: 长字段名
这是一个很长的字段名称: 值
---

# 正文
`;

const COLOR_DOC = `---
title: 彩色标签
tags:
  - 甲
  - 丁
  - 戊
---

# 正文
`;

const COLOR_DOC_2 = `---
title: 彩色标签（缺中间）
tags:
  - 甲
  - 戊
---

# 正文
`;

const CAPSULE_DOC = `---
title: 胶囊测试
score: 42
note:
created: 2026-11-14
updated: 2026-11-15T10:30:00
---

# 正文
`;

const THREE_SELECTABLE_DOC = `---
title: 三可选字段
tags:
  - 甲
score: 42
note: 备注
category: 草稿
---

# 正文
`;

async function boot(page: Page): Promise<void> {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 15000 });
}

async function openDoc(
  page: Page,
  content = DOC,
  path = "/Users/test/prop.md",
): Promise<void> {
  await page.evaluate(
    (args) => {
      (
        window as unknown as {
          __biaoyue_openFile__: (p: string, c: string, t?: string) => boolean;
        }
      ).__biaoyue_openFile__(args.path, args.content, "prop.md");
    },
    { path, content },
  );
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

function panel(page: Page, variant: "A" | "B") {
  return page.locator(`[data-testid="dpb-${variant.toLowerCase()}"]`);
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test("预览态：A 一行条只读渲染（千分位 / 开关态 / 标签胶囊）", async ({
  page,
}) => {
  await openDoc(page);
  const a = panel(page, "A");
  await expect(a).toBeVisible();

  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(3);
  await expect(
    a.locator('[data-key="count"] [data-testid="dpb-value"]'),
  ).toHaveText("1,234,567");
  await expect(a.locator('[data-key="published"] .dpb-bool-on')).toHaveText(
    "◉",
  );
  await expect(a.locator('[data-key="tags"] .dpb-tag')).toHaveCount(2);
  await expect(a.locator('[data-key="tags"] .dpb-tag').first()).toHaveText(
    "甲",
  );

  // 预览态没有任何编辑入口（形态切换图标除外）
  await expect(a.locator('[data-testid="dpb-collapse"]')).toHaveCount(0);
  await expect(a.locator(".dpb-row-handle")).toHaveCount(0);
  await expect(a.locator("button")).toHaveCount(1);
  await expect(a.locator('[data-testid="dpb-variant-toggle"]')).toBeVisible();
});

test("布尔值：图形与提示分离，状态文案移至 title（#1021）", async ({
  page,
}) => {
  await openDoc(page);
  const a = panel(page, "A");

  const boolValue = a.locator('[data-key="published"] .dpb-bool');
  await expect(boolValue).toHaveText("◉");
  await expect(boolValue).toHaveAttribute("title", "已开启");
  await dpbRecord(page, "1021", "01-bool-on");

  await setMode(page, "edit");
  const switchBtn = a.locator(
    '[data-key="published"] [data-testid="dpb-value"]',
  );
  await expect(switchBtn).toHaveText("◉");
  await expect(switchBtn).toHaveAttribute("title", "已开启");
  await expect(switchBtn).toHaveAttribute("aria-checked", "true");
  await dpbRecord(page, "1021", "03-edit-switch-on");

  await switchBtn.click();
  await expect(switchBtn).toHaveAttribute("aria-checked", "false");
  await expect(switchBtn).toHaveText("○");
  await expect(switchBtn).toHaveAttribute("title", "已关闭");
  await dpbRecord(page, "1021", "04-edit-switch-off");

  await setMode(page, "preview");
  await expect(boolValue).toHaveText("○");
  await expect(boolValue).toHaveAttribute("title", "已关闭");
  await dpbRecord(page, "1021", "02-bool-off");
});

test("三模式：源码态面板 display:none，切回编辑恢复展开", async ({ page }) => {
  await openDoc(page);
  await expect(panel(page, "A")).toBeVisible();

  await setMode(page, "source");
  const host = page.locator('[data-testid="doc-property-host"]');
  await expect(host).toHaveCSS("display", "none");
  await expect(panel(page, "A")).toBeHidden();
  // 源码态 YAML 原文仍在编辑区
  await expect(page.locator(".cm-content").first()).toContainText("title:");

  await setMode(page, "edit");
  await expect(host).toHaveCSS("display", "block");
  await expect(panel(page, "A")).toBeVisible();
  await expect(page.locator('[data-testid="dpb-collapse"]')).toBeVisible();
});

test("编辑态可折叠，折叠状态跨模式切换保留", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const a = panel(page, "A");
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(3);

  await page.locator('[data-testid="dpb-collapse"]').click();
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(0);
  await expect(a.locator(".dpb-a-summary")).toContainText("已折叠");

  await setMode(page, "source");
  await setMode(page, "edit");
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(0);
  await expect(a.locator(".dpb-a-summary")).toBeVisible();

  await page.locator('[data-testid="dpb-collapse"]').click();
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(3);
});

test("A 编辑态：手柄悬出于胶囊左外侧且不占布局，胶囊列间距 16px", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  const chips = panel(page, "A").locator(".dpb-chip");
  await expect(chips).toHaveCount(3);

  const first = chips.nth(0);
  const second = chips.nth(1);
  const before = await first.boundingBox();
  const handle = first.locator(".dpb-row-handle");
  await expect(handle).toHaveCSS("opacity", "0");

  await first.hover();
  await expect(handle).toHaveCSS("opacity", "1");
  const after = await first.boundingBox();
  expect(after!.width).toBe(before!.width);
  expect(after!.x).toBe(before!.x);

  const hb = await handle.boundingBox();
  expect(hb!.x + hb!.width).toBeLessThanOrEqual(before!.x + 1);

  const sb = await second.boundingBox();
  expect(sb!.x - (before!.x + before!.width)).toBeCloseTo(16, 1);
});

test("⌘⇧Y 隐藏并显示恢复提示，再按恢复", async ({ page }) => {
  await openDoc(page);
  await expect(panel(page, "A")).toBeVisible();

  await page.keyboard.press("Meta+Shift+Y");
  await expect(panel(page, "A")).toHaveCount(0);
  const note = page.locator('[data-testid="dpb-hidden-note"]');
  await expect(note).toBeVisible();
  await expect(note).toContainText("已隐藏，按");
  await expect(note).toContainText("⌘⇧Y");

  await page.keyboard.press("Meta+Shift+Y");
  await expect(note).toHaveCount(0);
  await expect(panel(page, "A")).toBeVisible();
});

test("B 精排双列：5 列网格 / 静态类型图标 / 底部统计全部字段数", async ({
  page,
}) => {
  await openDoc(page);
  await setVariant(page, "B");
  const b = panel(page, "B");
  await expect(b).toBeVisible();

  const rows = b.locator('[data-testid="dpb-row"]');
  await expect(rows).toHaveCount(4);

  const tracks = await rows.first().evaluate((el) => {
    const v = getComputedStyle(el).gridTemplateColumns;
    return v.split(/\s+/).filter(Boolean);
  });
  expect(tracks).toHaveLength(5);
  expect(parseFloat(tracks[0])).toBeCloseTo(16, 1);
  // 类型列已去掉文字，只剩图标宽度（#1261）
  expect(parseFloat(tracks[1])).toBeGreaterThanOrEqual(16);
  expect(parseFloat(tracks[1])).toBeLessThan(30);
  const shortLabelTrack = parseFloat(tracks[2]);
  expect(shortLabelTrack).toBeGreaterThan(0);
  expect(parseFloat(tracks[4])).toBeCloseTo(18, 1);

  // 预览态每行都有静态类型图标（svg 或字符）
  const iconCount = await b.locator(".dpb-b-type > *").count();
  expect(iconCount).toBe(4);

  await expect(b.locator('[data-testid="dpb-count"]')).toHaveText("4 个字段");

  await openDoc(page, LONG_NAME_DOC, "/Users/test/o1-label-track.md");
  await setVariant(page, "B");
  const longTracks = await panel(page, "B")
    .locator('[data-key="这是一个很长的字段名称"]')
    .evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateColumns.split(/\s+/)
        .filter(Boolean)
        .map((v) => parseFloat(v)),
    );
  expect(longTracks[2]).toBeGreaterThan(shortLabelTrack);
  expect(longTracks[3]).toBeGreaterThan(0);
});

test("O1 长字段名：B 标签列自适应完整显示、无竖线，A 胶囊同优先级", async ({
  page,
}) => {
  await openDoc(page, LONG_NAME_DOC, "/Users/test/o1-long-name.md");

  await setVariant(page, "B");
  const b = panel(page, "B");
  const row = b.locator('[data-key="这是一个很长的字段名称"]');
  await expect(row).toHaveCount(1);

  const label = row.locator('[data-testid="dpb-label"]');
  const labelMetrics = await label.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    fontSize: parseFloat(getComputedStyle(el).fontSize),
  }));
  expect(labelMetrics.scrollWidth).toBeLessThanOrEqual(
    labelMetrics.clientWidth,
  );
  const labelBox = (await label.boundingBox())!;
  expect(labelBox.width).toBeLessThanOrEqual(labelMetrics.fontSize * 16 + 1);

  const geo = await row.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      tracks: cs.gridTemplateColumns
        .split(/\s+/)
        .filter(Boolean)
        .map(parseFloat),
      rowBorderLeft: parseFloat(cs.borderLeftWidth),
      rowBorderRight: parseFloat(cs.borderRightWidth),
      cells: Array.from(el.children).map((c) => {
        const s = getComputedStyle(c);
        return {
          bl: parseFloat(s.borderLeftWidth),
          br: parseFloat(s.borderRightWidth),
        };
      }),
    };
  });
  expect(geo.rowBorderLeft).toBe(0);
  expect(geo.rowBorderRight).toBe(0);
  for (const c of geo.cells) {
    expect(c.bl).toBe(0);
    expect(c.br).toBe(0);
  }
  expect(geo.tracks[3]).toBeGreaterThan(0);

  await setVariant(page, "A");
  const chip = panel(page, "A").locator('[data-key="这是一个很长的字段名称"]');
  await expect(chip).toHaveCount(1);
  const aLabel = chip.locator('[data-testid="dpb-label"]');
  const aMetrics = await aLabel.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    fontSize: parseFloat(getComputedStyle(el).fontSize),
  }));
  expect(aMetrics.scrollWidth).toBeLessThanOrEqual(aMetrics.clientWidth);
  expect(aMetrics.clientWidth).toBeLessThanOrEqual(aMetrics.fontSize * 16 + 1);
  expect(
    (await chip.locator('[data-testid="dpb-value"]').boundingBox())!.width,
  ).toBeGreaterThan(0);
});

test("长值两行截断：clientHeight ≈ 2 × line-height，title 为全文", async ({
  page,
}) => {
  await openDoc(page, LONG_DOC);
  const value = panel(page, "A").locator(
    '[data-key="note"] [data-testid="dpb-value"]',
  );
  await expect(value).toBeVisible();

  const metrics = await value.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      maxHeight: cs.maxHeight,
      lineHeight: cs.lineHeight,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflow: cs.overflow,
    };
  });
  const line = parseFloat(metrics.lineHeight);
  expect(metrics.overflow).toBe("hidden");
  expect(Math.abs(parseFloat(metrics.maxHeight) - 2 * line)).toBeLessThan(1);
  expect(Math.abs(metrics.clientHeight - 2 * line)).toBeLessThan(2);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  const full = await value.getAttribute("title");
  expect(full).toContain("用来验证两行截断");
});

test("B1b 截断值 title 全文：A 胶囊与 B 两行一致，短值/空值口径", async ({
  page,
}) => {
  await openDoc(page, LONG_DOC);
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const value = panel(page, variant).locator(
      '[data-key="note"] [data-testid="dpb-value"]',
    );
    await expect(value).toBeVisible();
    const text = (await value.textContent()) ?? "";
    expect(text.length).toBeGreaterThan(24);
    expect(await value.getAttribute("title")).toBe(text);
    const clamp = await value.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }));
    expect(clamp.scrollHeight).toBeGreaterThan(clamp.clientHeight);
  }
  await dpbRecord(page, "1285", "01-long-title-full");

  await openDoc(page, ROW_DOC, "/Users/test/b1b-short.md");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const value = panel(page, variant).locator(
      '[data-key="category"] [data-testid="dpb-value"]',
    );
    await expect(value).toHaveText("草稿");
    expect(await value.getAttribute("title")).toBe("草稿");
  }

  await openDoc(page, CAPSULE_DOC, "/Users/test/b1b-empty.md");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const value = panel(page, variant).locator(
      '[data-key="note"] [data-testid="dpb-value"]',
    );
    await expect(value).toHaveCount(1);
    expect((await value.textContent())?.trim()).toBe("");
    expect(await value.getAttribute("title")).toBeNull();
  }
});

test("无 frontmatter：空态引导文案", async ({ page }) => {
  await openDoc(page, "# 只有正文\n\n没有属性。\n");
  const empty = page.locator('[data-testid="dpb-empty"]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("首次添加字段时自动创建");
  await expect(panel(page, "A")).toHaveCount(0);
});

test("设置区：文档属性样式 A→B 切换立即生效，字段内容不变", async ({
  page,
}) => {
  await openDoc(page);
  await expect(panel(page, "A")).toBeVisible();

  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();

  const section = page.locator('[data-testid="settings-doc-property"]');
  await expect(section).toBeVisible();
  await expect(section).toContainText("显示样式");
  await expect(section).toContainText("预览态默认");
  await expect(section).toContainText("编辑态默认");
  await expect(section).toContainText("新建文档默认");

  await page.locator('[data-testid="property-bar-style-dual"]').click();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await expect(panel(page, "A")).toHaveCount(0);
  const b = panel(page, "B");
  await expect(b).toBeVisible();
  await expect(b.locator('[data-testid="dpb-row"]')).toHaveCount(4);
  await expect(
    b.locator('[data-key="count"] [data-testid="dpb-value"]'),
  ).toHaveText("1,234,567");
});

test("编辑态默认档：折叠与隐藏按模式生效", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const a = panel(page, "A");
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(3);

  await page.keyboard.press("Meta+,");
  await page.locator('[data-settings-nav="editor"]').click();
  await page.locator('[data-testid="property-bar-edit-collapse"]').click();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(0);
  await expect(a.locator(".dpb-a-summary")).toContainText("已折叠");

  await page.keyboard.press("Meta+,");
  await page.locator('[data-settings-nav="editor"]').click();
  await page.locator('[data-testid="property-bar-edit-hide"]').click();
  await page.keyboard.press("Escape");

  await expect(page.locator('[data-testid="dpb-hidden-note"]')).toBeVisible();
  await expect(a).toHaveCount(0);
});

test("新建文档默认隐藏：恢复提示出现，⌘⇧Y 可恢复", async ({ page }) => {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
  await page.locator('[data-testid="property-bar-new-doc-hide"]').click();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await page.evaluate((content) => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { newTabWith: (title: string, body: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .newTabWith("未命名", content);
  }, DOC);

  const note = page.locator('[data-testid="dpb-hidden-note"]');
  await expect(note).toBeVisible();
  await expect(note).toContainText("⌘⇧Y");
  await expect(panel(page, "A")).toHaveCount(0);

  await page.keyboard.press("Meta+Shift+Y");
  await expect(note).toHaveCount(0);
  await expect(panel(page, "A")).toBeVisible();
});

interface TagSample {
  name: string;
  bg: string;
  color: string;
}

async function readTags(page: Page, variant: "A" | "B"): Promise<TagSample[]> {
  const loc = panel(page, variant).locator('[data-key="tags"] .dpb-tag');
  const out: TagSample[] = [];
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    const bg = await el.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );
    out.push({
      name: (await el.textContent()) ?? "",
      bg,
      color: (await el.getAttribute("data-color")) ?? "",
    });
  }
  return out;
}

/** 解析 --app-accent-soft 的计算值（探针法）。 */
async function accentSoft(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--app-accent-soft)";
    document.body.appendChild(probe);
    const v = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return v;
  });
}

/** 元素自身或其最近祖先的第一个非透明背景色（用户实际看到的底色）。 */
async function effectiveBg(page: Page, sel: string): Promise<string> {
  return page
    .locator(sel)
    .first()
    .evaluate((el) => {
      let node: Element | null = el;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
        node = node.parentElement;
      }
      return "rgba(0, 0, 0, 0)";
    });
}

test("标签胶囊：哈希色板渲染，计算背景色两两不同且 A/B 同色", async ({
  page,
}) => {
  await openDoc(page, COLOR_DOC);
  const a = await readTags(page, "A");
  expect(a.map((t) => t.name)).toEqual(["甲", "丁", "戊"]);
  expect(new Set(a.map((t) => t.bg)).size).toBe(3);
  for (const t of a) {
    expect(Number(t.color)).toBeGreaterThanOrEqual(0);
    expect(Number(t.color)).toBeLessThan(10);
  }

  await setVariant(page, "B");
  const b = await readTags(page, "B");
  expect(b.map((t) => t.name)).toEqual(["甲", "丁", "戊"]);
  for (const t of b) {
    expect(t.bg).toBe(a.find((x) => x.name === t.name)!.bg);
  }
});

test("跨文档同名标签等色：删掉中间标签后其余标签色值不变", async ({ page }) => {
  await openDoc(page, COLOR_DOC, "/Users/test/color1.md");
  const first = await readTags(page, "A");
  await openDoc(page, COLOR_DOC_2, "/Users/test/color2.md");
  const second = await readTags(page, "A");
  expect(second.map((t) => t.name)).toEqual(["甲", "戊"]);
  const byName = new Map(first.map((t) => [t.name, t.bg]));
  for (const t of second) {
    expect(t.bg).toBe(byName.get(t.name));
  }
});

const EDIT_DOC = `---
title: 可编辑标题
note: 一段普通备注
count: 42
custom-note: 自由键
---

# 正文
`;

const LONG_NOTE_DOC = `---
title: 长文本编辑
note: 这是一段超过四十字符的长备注内容，用来验证点击进入编辑时会自动切换为多行文本域，并且回车换行、失焦提交。
count: 7
---

# 正文
`;

test("编辑态：点击文本值进入编辑，Enter 提交后源码 YAML 同步", async ({
  page,
}) => {
  await openDoc(page, EDIT_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="note"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const input = row.locator('[data-testid="dpb-input"]');
  await expect(input).toBeVisible();
  await input.fill("改过的备注");
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText(
    "改过的备注",
  );

  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "note: 改过的备注",
  );
});

test("数字字段输入 abc 提交被拒绝：还原原值并出现提示", async ({ page }) => {
  await openDoc(page, EDIT_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="count"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const input = row.locator('[data-testid="dpb-input"]');
  await input.fill("abc");
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-error"]')).toContainText(
    "数字格式不正确",
  );
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText("42");
});

test("修改值后 Ctrl+Z 源码回退到修改前", async ({ page }) => {
  await openDoc(page, EDIT_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="note"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const input = row.locator('[data-testid="dpb-input"]');
  await input.fill("临时改动");
  await input.press("Enter");
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText("临时改动");

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Meta+Z");

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText("note: 一段普通备注");
  await expect(src).not.toContainText("临时改动");
});

test("长文本（>40 字符）点击值出现多行文本域，Enter 换行、失焦提交", async ({
  page,
}) => {
  await openDoc(page, LONG_NOTE_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="note"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const box = row.locator('[data-testid="dpb-input"]');
  await expect(box).toBeVisible();
  await expect(box).toHaveJSProperty("tagName", "TEXTAREA");
  await box.fill("第一行");
  await box.press("Enter");
  await box.type("第二行");
  await expect(box).toHaveValue("第一行\n第二行");
  await page.locator(".dpb-a-title").click();
  await expect(box).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-value"]')).toContainText(
    "第一行",
  );
});

test("编辑其他字段后自由键在源码中保持不变", async ({ page }) => {
  await openDoc(page, EDIT_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="note"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const input = row.locator('[data-testid="dpb-input"]');
  await input.fill("改后备注");
  await input.press("Enter");
  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText("custom-note: 自由键");
  await expect(src).toContainText("note: 改后备注");
});

test("#1129 托管日期只读展示：A/B footer 均为计数在左、日期在右，带锁无输入框", async ({
  page,
}) => {
  await openDoc(page);
  const a = panel(page, "A");
  for (const key of ["created", "updated"]) {
    await expect(
      a.locator(`[data-testid="dpb-row"][data-key="${key}"]`),
    ).toHaveCount(0);
  }
  await expect(a.locator('[data-testid="dpb-count"]')).toHaveText("4 个字段");

  const aFoot = a.locator(".dpb-a-foot");
  const aDates = aFoot.locator('[data-testid="dpb-managed-dates"]');
  await expect(aDates).toBeVisible();
  await expect(aDates.locator(".dpb-lock")).toHaveCount(1);
  await expect(aDates.locator('[data-testid="dpb-managed-date"]')).toHaveCount(
    2,
  );
  await expect(
    aDates.locator('[data-testid="dpb-managed-date"][data-key="created"]'),
  ).toHaveText("创建 2026-11-14");
  await expect(
    aDates.locator('[data-testid="dpb-managed-date"][data-key="updated"]'),
  ).toHaveText("修改 2026-11-15");
  await expect(aFoot.locator("input, textarea, button")).toHaveCount(0);

  const aDateBox = (await aDates.boundingBox())!;
  const aCountBox = (await aFoot
    .locator('[data-testid="dpb-count"]')
    .boundingBox())!;
  expect(aCountBox.x).toBeLessThan(aDateBox.x);
  expect(Math.abs(aDateBox.y - aCountBox.y)).toBeLessThan(8);
  await dpbRecord(page, "1129", "01-a-footer-dates");

  await setVariant(page, "B");
  const b = panel(page, "B");
  const bFoot = b.locator(".dpb-b-foot");
  const bDates = bFoot.locator('[data-testid="dpb-managed-dates"]');
  await expect(bDates).toBeVisible();
  await expect(bDates.locator(".dpb-lock")).toHaveCount(1);
  await expect(bDates.locator('[data-testid="dpb-managed-date"]')).toHaveCount(
    2,
  );
  await expect(bFoot.locator('[data-testid="dpb-count"]')).toHaveText(
    "4 个字段",
  );
  const bDateBox = (await bDates.boundingBox())!;
  const bCountBox = (await bFoot
    .locator('[data-testid="dpb-count"]')
    .boundingBox())!;
  expect(bCountBox.x).toBeLessThan(bDateBox.x);
  expect(Math.abs(bDateBox.y - bCountBox.y)).toBeLessThan(8);
  await dpbRecord(page, "1129", "02-b-foot-dates");

  await setMode(page, "edit");
  await bDates.click();
  await expect(b.locator('[data-testid="dpb-input"]')).toHaveCount(0);
  await expect(bDates).toBeVisible();
  await dpbRecord(page, "1129", "03-edit-readonly");
});

test("#1129 结构写回保留托管日期：删除普通字段后源码仍含 created / updated", async ({
  page,
}) => {
  await openDoc(page);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-key="count"] [data-testid="dpb-row-del"]').click();
  await expect(
    b.locator('[data-testid="dpb-row"][data-key="count"]'),
  ).toHaveCount(0);

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText("created: 2026-11-14");
  await expect(src).toContainText("updated: 2026-11-15T10:30:00");
});

const PARTIAL_DATE_DOC = `---
title: 只有创建日期
created: 2026-11-14
note: 备注
---

# 正文
`;

const NO_DATE_DOC = `---
title: 无日期
note: 备注
---

# 正文
`;

test("#1129 缺失日期键不渲染空壳，部分缺失只渲染已有项", async ({ page }) => {
  await openDoc(page, NO_DATE_DOC, "/Users/test/no-date.md");
  await expect(
    panel(page, "A").locator('[data-testid="dpb-managed-dates"]'),
  ).toHaveCount(0);
  await expect(panel(page, "A").locator(".dpb-a-foot")).toHaveCount(1);
  await expect(
    panel(page, "A").locator('[data-testid="dpb-count"]'),
  ).toHaveText("2 个字段");
  await setVariant(page, "B");
  await expect(
    panel(page, "B").locator('[data-testid="dpb-managed-dates"]'),
  ).toHaveCount(0);
  await expect(
    panel(page, "B").locator('[data-testid="dpb-count"]'),
  ).toHaveText("2 个字段");

  await openDoc(page, PARTIAL_DATE_DOC, "/Users/test/partial-date.md");
  await setVariant(page, "A");
  const aDates = panel(page, "A").locator('[data-testid="dpb-managed-dates"]');
  await expect(aDates.locator('[data-testid="dpb-managed-date"]')).toHaveCount(
    1,
  );
  await expect(
    aDates.locator('[data-testid="dpb-managed-date"][data-key="created"]'),
  ).toHaveText("创建 2026-11-14");
  await expect(
    aDates.locator('[data-testid="dpb-managed-date"][data-key="updated"]'),
  ).toHaveCount(0);
  await dpbRecord(page, "1129", "04-partial-missing");
});

test("#1129 AB 图标切换形态并持久化；窄窗自动胶囊不覆盖用户选择", async ({
  page,
}) => {
  await openDoc(page);
  await expect(panel(page, "A")).toBeVisible();

  await panel(page, "A").locator('[data-testid="dpb-variant-toggle"]').click();
  await expect(panel(page, "A")).toHaveCount(0);
  const b = panel(page, "B");
  await expect(b).toBeVisible();
  await expect(b.locator('[data-testid="dpb-variant-toggle"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dpbRecord(page, "1129", "05-toggle-b");

  await expect
    .poll(
      () => page.evaluate(() => localStorage.getItem("__mock_config") ?? ""),
      { timeout: 5000 },
    )
    .toContain('"docPropertyVariant":"B"');

  await page.reload();
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 15000,
  });
  await openDoc(page);
  await expect(panel(page, "B")).toBeVisible();
  await dpbRecord(page, "1129", "06-reload-kept-b");

  await page.setViewportSize({ width: 700, height: 800 });
  await expect(panel(page, "B")).toBeVisible();
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(panel(page, "B")).toBeVisible();

  await page.evaluate(() => localStorage.removeItem("__mock_config"));
  await page.reload();
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 15000,
  });
  await openDoc(page);
  await expect(panel(page, "A")).toBeVisible();

  await page.setViewportSize({ width: 700, height: 800 });
  await expect(panel(page, "B")).toBeVisible();
  await dpbRecord(page, "1129", "07-narrow-auto-capsule");
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(panel(page, "A")).toBeVisible();
  await dpbRecord(page, "1129", "08-wide-back-to-list");
});

test("#1147 历史污染 docPropertyVariant=B 不再短路窄窗自动胶囊", async ({
  page,
}) => {
  // 预置用户实际配置：docPropertyVariant=B + displayStyle=dual（历史污染）。
  // 加载后污染值不生效：宽窗回一行条 A，窄窗自动胶囊 B。
  await page.evaluate(
    (cfg) => {
      try {
        localStorage.setItem("__mock_config", JSON.stringify(cfg));
      } catch {
        /* ignore */
      }
    },
    {
      fontSize: 16,
      headingColors: null,
      ollamaEndpoint: "http://localhost:11434",
      openaiEndpoint: "https://api.openai.com",
      openaiModel: "gpt-4o-mini",
      translationProvider: "ollama",
      sourceLang: "en",
      targetLang: "zh-CN",
      theme: "system",
      sidebarLeftVisible: true,
      sidebarRightVisible: false,
      sidebarLeftWidth: 220,
      sidebarRightWidth: 320,
      recentFiles: [],
      propTemplates: [],
      propAliasMap: {},
      docPropertyVariant: "B",
      propertyBar: {
        displayStyle: "dual",
        displayDefault: { preview: "show", edit: "show" },
        newDocVisible: true,
      },
    },
  );
  await page.reload();
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 15000,
  });
  await openDoc(page);

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(panel(page, "A")).toBeVisible();
  await dpbRecord(page, "1147", "01-wide-list");

  await page.setViewportSize({ width: 700, height: 800 });
  await expect(panel(page, "B")).toBeVisible();
  await dpbRecord(page, "1147", "02-narrow-capsule");

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(panel(page, "A")).toBeVisible();
  await dpbRecord(page, "1147", "03-wide-back");

  await page.setViewportSize({ width: 700, height: 800 });
  await expect(panel(page, "B")).toBeVisible();
  await dpbRecord(page, "1147", "04-narrow-again");

  await page.setViewportSize({ width: 1200, height: 800 });
  await panel(page, "A").locator('[data-testid="dpb-variant-toggle"]').click();
  await expect(panel(page, "B")).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => localStorage.getItem("__mock_config") ?? ""),
      { timeout: 5000 },
    )
    .toContain('"docPropertyVariant":"B"');
  await page.reload();
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 15000,
  });
  await openDoc(page);
  await expect(panel(page, "B")).toBeVisible();
  await dpbRecord(page, "1147", "05-manual-persisted");
});

test("#1163 形态切换图标 L/T 语义与存储兼容", async ({ page }) => {
  await openDoc(page);
  const toggleA = panel(page, "A").locator(
    '[data-testid="dpb-variant-toggle"]',
  );
  await expect(toggleA.locator("svg")).toHaveAttribute(
    "data-icon",
    "docPropertyVariant",
  );

  const pathsA = toggleA.locator("svg path");
  await expect(pathsA).toHaveCount(1);
  expect(await pathsA.first().getAttribute("d")).toBe("M5 5v14 M5 19h13");
  expect(
    await toggleA.evaluate(
      (el) => el.getAttribute("title") ?? el.getAttribute("data-tip") ?? "",
    ),
  ).toContain("L 一行条 / T 精排双列");
  await dpbRecord(page, "1163", "01-a-icon-lt");

  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
  await page.locator('[data-settings-nav="editor"]').click();
  await expect(
    page.locator('[data-testid="property-bar-style-list"]'),
  ).toHaveText("L 一行条");
  await expect(
    page.locator('[data-testid="property-bar-style-dual"]'),
  ).toHaveText("T 精排双列");
  await dpbRecord(page, "1163", "02-settings-lt");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);

  await toggleA.click();
  const b = panel(page, "B");
  await expect(b).toBeVisible();
  const toggleB = b.locator('[data-testid="dpb-variant-toggle"]');
  await expect(toggleB).toHaveAttribute("aria-pressed", "true");
  expect(
    await toggleB.evaluate(
      (el) => el.getAttribute("title") ?? el.getAttribute("data-tip") ?? "",
    ),
  ).toContain("L 一行条 / T 精排双列");
  await expect(toggleB.locator("svg path")).toHaveCount(1);
  await dpbRecord(page, "1163", "03-b-icon-lt");

  await expect
    .poll(
      () => page.evaluate(() => localStorage.getItem("__mock_config") ?? ""),
      { timeout: 5000 },
    )
    .toContain('"docPropertyVariant":"B"');
  await page.reload();
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 15000,
  });
  await openDoc(page);
  await expect(panel(page, "B")).toBeVisible();
  await expect(
    panel(page, "B").locator('[data-testid="dpb-variant-toggle"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await dpbRecord(page, "1163", "04-reload-persisted-b");

  await panel(page, "B").locator('[data-testid="dpb-variant-toggle"]').click();
  await expect(panel(page, "A")).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => localStorage.getItem("__mock_config") ?? ""),
      { timeout: 5000 },
    )
    .toContain('"docPropertyVariant":"A"');
  await page.reload();
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 15000,
  });
  await openDoc(page);
  await expect(panel(page, "A")).toBeVisible();
  await dpbRecord(page, "1163", "05-reload-persisted-a");
});

test("#1228 形态切换图标换形（L 行条 / T 双列卡）", async ({ page }) => {
  await openDoc(page);
  const toggleA = panel(page, "A").locator(
    '[data-testid="dpb-variant-toggle"]',
  );
  await expect(toggleA.locator("svg")).toHaveAttribute(
    "data-icon",
    "docPropertyVariant",
  );

  const pathsA = toggleA.locator("svg path");
  await expect(pathsA).toHaveCount(1);
  expect(await pathsA.first().getAttribute("d")).toBe("M5 5v14 M5 19h13");
  await dpbRecord(page, "1228", "01-a-icon-lt");

  await toggleA.click();
  const b = panel(page, "B");
  await expect(b).toBeVisible();
  const toggleB = b.locator('[data-testid="dpb-variant-toggle"]');
  await expect(toggleB.locator("svg path")).toHaveCount(1);
  expect(await toggleB.locator("svg path").first().getAttribute("d")).toBe(
    "M5 5h14 M12 5v14",
  );
  await expect(toggleB).toHaveAttribute("aria-pressed", "true");
  await dpbRecord(page, "1228", "02-b-icon-lt");
});

test("#1242 形态切换图标按当前态显示对应形态（L 三横线 / T 双竖栏）", async ({
  page,
}) => {
  await openDoc(page);
  const toggleA = panel(page, "A").locator(
    '[data-testid="dpb-variant-toggle"]',
  );
  await expect(toggleA.locator("svg")).toHaveAttribute(
    "data-icon",
    "docPropertyVariant",
  );

  const pathsA = toggleA.locator("svg path");
  await expect(pathsA).toHaveCount(1);
  const dA = await pathsA.first().getAttribute("d");
  expect(dA).toBe("M5 5v14 M5 19h13");
  await dpbRecord(page, "1242", "01-a-icon-l");

  await toggleA.click();
  const b = panel(page, "B");
  await expect(b).toBeVisible();
  const toggleB = b.locator('[data-testid="dpb-variant-toggle"]');
  await expect(toggleB).toHaveAttribute("aria-pressed", "true");

  const pathsB = toggleB.locator("svg path");
  await expect(pathsB).toHaveCount(1);
  const dB = await pathsB.first().getAttribute("d");
  expect(dB).toBe("M5 5h14 M12 5v14");
  expect(dB).not.toBe(dA);
  await dpbRecord(page, "1242", "02-b-icon-t");

  await expect
    .poll(
      () => page.evaluate(() => localStorage.getItem("__mock_config") ?? ""),
      { timeout: 5000 },
    )
    .toContain('"docPropertyVariant":"B"');

  await page.reload();
  await page.waitForSelector('[data-testid="pane-header"]', {
    timeout: 15000,
  });
  await openDoc(page);
  await expect(panel(page, "B")).toBeVisible();
  const toggleB2 = panel(page, "B").locator(
    '[data-testid="dpb-variant-toggle"]',
  );
  await expect(toggleB2.locator("svg path")).toHaveCount(1);
  expect(await toggleB2.locator("svg path").first().getAttribute("d")).toBe(dB);
  await dpbRecord(page, "1242", "03-reload-b-icon-t");

  await toggleB2.click();
  await expect(panel(page, "A")).toBeVisible();
  const toggleA2 = panel(page, "A").locator(
    '[data-testid="dpb-variant-toggle"]',
  );
  await expect(toggleA2.locator("svg path")).toHaveCount(1);
  expect(await toggleA2.locator("svg path").first().getAttribute("d")).toBe(dA);
  await dpbRecord(page, "1242", "04-back-a-icon-l");
});

const TYPE_DOC = `---
title: 类型切换
author: 2026-11-14
---

# 正文
`;

const EXTERNAL_DOC = `---
title: 外部文件
createdate: 2026-11-14
---

# 正文
`;

const DATETIME_DOC = `---
title: 时间字段
评审时间: 2026-11-15 14:30
---

# 正文
`;

const ADOPT_DOC = `---
title: 收编
priority: 高
---

# 正文
`;

const RENAME_DOC = `---
title: 改名
note: 一段普通备注
other: 其他
---

# 正文
`;

test("类型选择器：八类菜单直选，选「日期」后编辑器变日期并写回日期字面量", async ({
  page,
}) => {
  await openDoc(page, TYPE_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="author"]');
  await row.locator('[data-testid="dpb-type"]').click();
  const menu = page.locator('[data-testid="dpb-type-menu"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-testid="dpb-type-option"]')).toHaveCount(8);
  await menu.locator('[data-type="date"]').click();
  await expect(menu).toHaveCount(0);

  await expect(
    row.locator('[data-testid="dpb-type"] .dpb-ico-svg'),
  ).toHaveCount(1);
  await row.locator('[data-testid="dpb-value"]').click();
  const editor = row.locator('[data-testid="dpb-datetime-editor"]');
  await expect(editor).toHaveCount(1);
  await expect(
    row.locator('input[type="date"],input[type="time"]'),
  ).toHaveCount(0);
  await editor
    .locator('[data-testid="dpb-cal-day"][data-date="2026-11-16"]')
    .click();
  await page.keyboard.press("Enter");

  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "author: 2026-11-16",
  );
});

test("日期时间字段：单一面板（月历 + 时分步进），组合写回 YYYY-MM-DDTHH:mm", async ({
  page,
}) => {
  await openDoc(page, DATETIME_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="评审时间"]');

  await row.locator('[data-testid="dpb-value"]').click();
  const editor = row.locator('[data-testid="dpb-datetime-editor"]');
  await expect(editor).toHaveCount(1);
  const panelEl = editor.locator('[data-testid="dpb-datetime-panel"]');
  await expect(panelEl).toBeVisible();
  // A-4.1：值编辑器内分离的日期 / 时间原生控件节点数 = 0
  await expect(
    editor.locator('input[type="date"], input[type="time"]'),
  ).toHaveCount(0);
  // A-4.2：单一面板内含月历网格 + 时分步进控件
  await expect(editor.locator('[data-testid="dpb-cal-day"]')).toHaveCount(30);
  await expect(editor.locator('[data-testid="dpb-time-hour"]')).toHaveCount(1);
  await expect(editor.locator('[data-testid="dpb-time-minute"]')).toHaveCount(
    1,
  );
  await dpbRecord(page, "1044", "01-single-panel");

  // A-4.6：WebKit 下步进组不被 input 固有宽度撑开，时分输入保持在面板内
  const panelBox = (await panelEl.boundingBox())!;
  const hourBox = (await editor
    .locator('[data-testid="dpb-time-hour"]')
    .boundingBox())!;
  const minuteBox = (await editor
    .locator('[data-testid="dpb-time-minute"]')
    .boundingBox())!;
  const stepBox = (await editor.locator(".dpb-dt-step").first().boundingBox())!;
  expect(hourBox.x).toBeGreaterThanOrEqual(panelBox.x);
  expect(minuteBox.x + minuteBox.width).toBeLessThanOrEqual(
    panelBox.x + panelBox.width,
  );
  expect(minuteBox.x - (hourBox.x + hourBox.width)).toBeLessThan(60);
  expect(stepBox.width).toBeLessThan(70);

  // A-4.5：面板内操作只改内部状态，不提前提交（面板保持打开）
  await editor
    .locator('[data-testid="dpb-cal-day"][data-date="2026-11-18"]')
    .click();
  await editor.locator('[data-testid="dpb-time-hour"]').fill("14");
  await editor.locator('[data-testid="dpb-time-minute"]').fill("30");
  await expect(panelEl).toBeVisible();

  // A-4.3 / A-4.4：Enter 提交组合值
  await page.keyboard.press("Enter");
  await expect(editor).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText(
    "2026-11-18 14:30",
  );
  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "评审时间: 2026-11-18T14:30",
  );
  await setMode(page, "edit");
  await dpbRecord(page, "1044", "02-commit-combined");
});

test("日期时间面板：Tab 在月历与时分间移动，Esc 取消回原值", async ({
  page,
}) => {
  await openDoc(page, DATETIME_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="评审时间"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const editor = row.locator('[data-testid="dpb-datetime-editor"]');

  await editor
    .locator('[data-testid="dpb-cal-day"][data-date="2026-11-18"]')
    .focus();
  await page.keyboard.press("Tab");
  await expect(editor.locator('[data-testid="dpb-time-hour"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(editor.locator('[data-testid="dpb-time-minute"]')).toBeFocused();

  await editor.locator('[data-testid="dpb-time-hour"]').fill("18");
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText(
    "2026-11-15 14:30",
  );
  await dpbRecord(page, "1044", "03-esc-cancelled");
});

test("日期时间面板：分输入框按 Tab 焦点留在面板内，正文首字符仍为 ---", async ({
  page,
}) => {
  await openDoc(page, DATETIME_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="评审时间"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const editor = row.locator('[data-testid="dpb-datetime-editor"]');
  const panelEl = editor.locator('[data-testid="dpb-datetime-panel"]');
  await expect(panelEl).toBeVisible();
  await dpbRecord(page, "1257", "01-panel-open");

  await editor.locator('[data-testid="dpb-time-minute"]').focus();
  await page.keyboard.press("Tab");

  await expect(panelEl).toBeVisible();
  const state = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const panel = document.querySelector('[data-testid="dpb-datetime-panel"]');
    const store = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            tabs: Record<string, { content: string }>;
            activeTabId: string;
          };
        };
      }
    ).__biaoyue_store__.getState();
    const content = store.tabs[store.activeTabId]?.content ?? "";
    return {
      inPanel: panel ? panel.contains(active) : false,
      first: content.slice(0, 1),
    };
  });
  expect(state.inPanel).toBe(true);
  expect(state.first).toBe("-");
  await dpbRecord(page, "1257", "02-tab-stays-in-panel");

  await editor.locator('[data-testid="dpb-time-minute"]').fill("58");
  await page.keyboard.press("Enter");
  await expect(panelEl).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-value"]')).toContainText("14:58");
  await dpbRecord(page, "1257", "03-enter-commits");

  await row.locator('[data-testid="dpb-value"]').click();
  await expect(panelEl).toBeVisible();
  await editor.locator('[data-testid="dpb-time-minute"]').focus();
  await page.keyboard.press("Escape");
  await expect(panelEl).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-value"]')).toContainText("14:58");
  await dpbRecord(page, "1257", "04-esc-cancels");
});

test("日期时间面板：失焦（点击外部）才提交组合值", async ({ page }) => {
  await openDoc(page, DATETIME_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="评审时间"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const editor = row.locator('[data-testid="dpb-datetime-editor"]');
  await editor
    .locator('[data-testid="dpb-cal-day"][data-date="2026-11-18"]')
    .click();
  await editor.locator('[data-testid="dpb-time-hour"]').fill("09");
  await editor.locator('[data-testid="dpb-time-minute"]').fill("05");
  await expect(
    editor.locator('[data-testid="dpb-datetime-panel"]'),
  ).toBeVisible();
  await page.locator(".cm-content").first().click();
  await expect(editor).toHaveCount(0);
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText(
    "2026-11-18 09:05",
  );
  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "评审时间: 2026-11-18T09:05",
  );
  await dpbRecord(page, "1044", "04-blur-committed");
});

test("日期字段：自绘面板仅日期，无时分；月/年可切，展示格式紧凑（#1259）", async ({
  page,
}) => {
  await openDoc(page, EXTERNAL_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="createdate"]');
  await row.locator('[data-testid="dpb-value"]').click();
  const editor = row.locator('[data-testid="dpb-datetime-editor"]');
  await expect(editor).toHaveCount(1);
  await expect(
    row.locator('input[type="date"],input[type="time"]'),
  ).toHaveCount(0);
  await expect(editor.locator('[data-testid="dpb-time-hour"]')).toHaveCount(0);
  await expect(editor.locator('[data-testid="dpb-cal-today"]')).toHaveCount(1);
  await dpbRecord(page, "1259", "01-date-panel");

  await editor.locator('[data-testid="dpb-cal-month"]').click();
  await expect(
    editor.locator('[data-testid="dpb-cal-month-cell"]'),
  ).toHaveCount(12);
  await dpbRecord(page, "1259", "02-month-view");

  await editor.locator('[data-testid="dpb-cal-year"]').click();
  await expect(editor.locator('[data-testid="dpb-cal-year-cell"]')).toHaveCount(
    12,
  );
  await dpbRecord(page, "1259", "03-year-view");

  await page.keyboard.press("Escape");
  await openDoc(page, DATETIME_DOC);
  await setMode(page, "edit");
  const dt = panel(page, "A").locator('[data-key="评审时间"]');
  await expect(dt.locator('[data-testid="dpb-value"]')).toHaveText(
    "2026-11-15 14:30",
  );
  await dpbRecord(page, "1259", "04-datetime-compact");
});

test("类型切换转换失败：保留原文并提示", async ({ page }) => {
  await openDoc(page, ADOPT_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="priority"]');
  await row.locator('[data-testid="dpb-type"]').click();
  await page
    .locator('[data-testid="dpb-type-menu"] [data-type="date"]')
    .click();
  await expect(row.locator('[data-testid="dpb-error"]')).toContainText(
    "日期格式应为 YYYY-MM-DD",
  );
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText("高");
});

test("外部文件：createdate 自动识别为日期（日历图标）且显示名保持 createdate", async ({
  page,
}) => {
  await openDoc(page, EXTERNAL_DOC);
  await setVariant(page, "B");
  const row = panel(page, "B").locator('[data-key="createdate"]');
  await expect(row.locator(".dpb-b-type .dpb-ico-svg")).toHaveCount(1);
  await expect(row.locator('[data-testid="dpb-label"]')).toHaveText(
    "createdate",
  );

  await setMode(page, "edit");
  await row.locator('[data-testid="dpb-type"]').click();
  await expect(page.locator('[data-testid="dpb-type-menu"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="dpb-type-menu"]')).toHaveCount(0);
});

test("纯字符串默认文本：改选「下拉」后原值保留", async ({ page }) => {
  await openDoc(page, ADOPT_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="priority"]');
  await expect(row.locator('[data-testid="dpb-type"] .dpb-ico')).toHaveText(
    "Aa",
  );
  await row.locator('[data-testid="dpb-type"]').click();
  await page
    .locator('[data-testid="dpb-type-menu"] [data-type="select"]')
    .click();
  await expect(row.locator('[data-testid="dpb-type"] .dpb-ico')).toHaveText(
    "▾",
  );
  await expect(row.locator('[data-testid="dpb-value"]')).toHaveText("高");
});

test("字段名就地改名：面板显示与 YAML 键同步，重名被拦截", async ({ page }) => {
  await openDoc(page, RENAME_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="note"]');
  await row.locator('[data-testid="dpb-label"]').click();
  const input = row.locator('[data-testid="dpb-rename-input"]');
  await expect(input).toBeVisible();
  await input.fill("priority");
  await input.press("Enter");
  await expect(panel(page, "A").locator('[data-key="priority"]')).toHaveCount(
    1,
  );
  await expect(
    panel(page, "A").locator('[data-key="priority"] [data-testid="dpb-label"]'),
  ).toHaveText("priority");

  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "priority: 一段普通备注",
  );
  await setMode(page, "edit");

  const other = panel(page, "A").locator('[data-key="other"]');
  await other.locator('[data-testid="dpb-label"]').click();
  const dup = other.locator('[data-testid="dpb-rename-input"]');
  await dup.fill("priority");
  await dup.press("Enter");
  await expect(other.locator('[data-testid="dpb-error"]')).toContainText(
    "重名",
  );
  await expect(other.locator('[data-testid="dpb-label"]')).toHaveText("other");
});

test("创建 / 修改日期不作为字段行，普通字段改名入口不受影响", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  const a = panel(page, "A");
  for (const key of ["created", "updated"]) {
    await expect(
      a.locator(`[data-testid="dpb-row"][data-key="${key}"]`),
    ).toHaveCount(0);
    await expect(
      a.locator(`[data-key="${key}"] [data-testid="dpb-label"]`),
    ).toHaveCount(0);
  }
  await expect(
    a.locator('[data-key="count"] [data-testid="dpb-label"]'),
  ).toHaveAttribute("data-renameable", "true");
});

const LINK_DOC = `---
title: 列表链接
related:
  - "[[设计说明.md]]"
tags:
  - 甲
---

# 正文
`;

async function openLinkDocs(page: Page): Promise<void> {
  await openDoc(page, "# 第二篇文档\n", "/Users/test/second.md");
  await openDoc(page, LINK_DOC, "/Users/test/list.md");
}

async function sceneOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    return (
      window as unknown as {
        __biaoyue_store__: { getState: () => { scene: string } };
      }
    ).__biaoyue_store__.getState().scene;
  });
}

test("列表 [[ 文档菜单：行只显示文档名（无 [[ 前缀），↑↓ 换选行尾快捷键", async ({
  page,
}) => {
  await openLinkDocs(page);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="related"]');
  const input = row.locator('[data-testid="dpb-link-input"]');
  await expect(input).toBeVisible();

  await input.fill("[[");
  const menu = page.locator('[data-testid="dpb-doc-menu"]');
  await expect(menu).toBeVisible();
  const rows = menu.locator('[data-testid="dpb-doc-menu-row"]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator(".dpb-menu-label")).toHaveText("list.md");
  await expect(rows.nth(1).locator(".dpb-menu-label")).toHaveText("second.md");
  await expect(rows.nth(0).locator(".dpb-menu-label")).not.toContainText("[[");
  await expect(rows.nth(0).locator(".dpb-menu-key")).toHaveText("⏎");
  await expect(rows.nth(1).locator(".dpb-menu-key")).toHaveText("⌘2");

  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(0).locator(".dpb-menu-key")).toHaveText("⌘1");
  await expect(rows.nth(1).locator(".dpb-menu-key")).toHaveText("⏎");
});

test("列表 [[ 菜单：⏎ 选用成 chip，× 移除，源码同步", async ({ page }) => {
  await openLinkDocs(page);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="related"]');
  const input = row.locator('[data-testid="dpb-link-input"]');

  await input.fill("[[");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="dpb-doc-menu"]')).toHaveCount(0);

  const chips = row.locator(".dpb-link-chip");
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(1).locator(".dpb-link-chip-text")).toHaveText(
    "[[second.md]]",
  );

  await chips.nth(1).locator('[data-testid="dpb-link-chip-x"]').click();
  await expect(chips).toHaveCount(1);

  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).not.toContainText(
    "[[second.md]]",
  );
});

test("菜单打开时 ⌘2 直选第 2 项，不触发全局卡片直开", async ({ page }) => {
  await openLinkDocs(page);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="related"]');
  const input = row.locator('[data-testid="dpb-link-input"]');

  await input.fill("[[");
  await expect(page.locator('[data-testid="dpb-doc-menu"]')).toBeVisible();
  await page.keyboard.press("Meta+2");
  await expect(page.locator('[data-testid="dpb-doc-menu"]')).toHaveCount(0);

  await expect(row.locator(".dpb-link-chip-text").last()).toHaveText(
    "[[second.md]]",
  );
  expect(await sceneOf(page)).toBe("workspace");
  await expect(panel(page, "A")).toBeVisible();
});

test("外部 frontmatter 兜底：模板占位可识别、常见键不再未识别（#1258）", async ({
  page,
}) => {
  const templater = `---\n\ncreated: {{date}} {{time}}\ntags: ["模板", "IT"]\nbook_title: \nauthor: \nread_date: {{date:YYYY-MM}}\nrating: \nstatus: 阅读中\n\n---\n\n# 标题\n`;
  await openDoc(page, templater);
  await setMode(page, "edit");
  await setVariant(page, "B");
  const b = panel(page, "B");
  await expect(b.locator('[data-testid="dpb-row"]')).toHaveCount(6);
  await expect(b.locator('[data-key="book_title"]')).toHaveCount(1);
  await dpbRecord(page, "1258", "01-templater-rows");

  const mdpkg = `---\ntype: guide\ntitle: 指南\ncaptured_at: 2026-09-01T00:56:05.946Z\ncaptured_via: capture-cli\ningested_via: put_page\ningested_at: 2026-09-01T00:56:09.822Z\nsource_kind: put_page\n---\n\n# 正文\n`;
  await openDoc(page, mdpkg, "/Users/test/mdpkg.md");
  await setMode(page, "edit");
  await setVariant(page, "B");
  const b2 = panel(page, "B");
  await expect(b2.locator('[data-testid="dpb-row"]')).toHaveCount(7);
  await expect(
    b2.locator('[data-key="type"] [data-testid="dpb-type"]'),
  ).toHaveAttribute("title", /下拉/);
  await expect(
    b2.locator('[data-key="captured_at"] [data-testid="dpb-type"]'),
  ).toHaveAttribute("title", /日期时间/);
  await expect(
    b2.locator('[data-testid="dpb-type"]', { hasText: "?" }),
  ).toHaveCount(0);
  await dpbRecord(page, "1258", "02-mdpkg-types");

  await openDoc(page, templater);
  await setMode(page, "edit");
  await setVariant(page, "B");
  const row = panel(page, "B").locator('[data-key="book_title"]');
  await row.locator('[data-testid="dpb-value"]').click();
  await row.locator('[data-testid="dpb-input"]').fill("读书");
  await row.locator('[data-testid="dpb-input"]').press("Enter");
  const content = await page.evaluate(() => {
    const st = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            tabs: Record<string, { content: string }>;
            activeTabId: string;
          };
        };
      }
    ).__biaoyue_store__.getState();
    return st.tabs[st.activeTabId]?.content ?? "";
  });
  expect(content).toContain("created: {{date}} {{time}}");
  expect(content).toContain("read_date: {{date:YYYY-MM}}");
  expect(content).toContain("book_title: 读书");
  await dpbRecord(page, "1258", "03-edit-preserves-template");

  await setMode(page, "source");
  await expect(page.locator(".cm-content")).toContainText("{{date}} {{time}}");
  await dpbRecord(page, "1258", "04-source-preserved");
});

test("tags 字符串不崩溃并按单元素标签渲染，编辑后写回列表（#1256）", async ({
  page,
}) => {
  const doc = `---\ntitle: 列表容错\ntags: "#"\n---\n\n# 正文\n`;
  await openDoc(page, doc);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="tags"]');
  await expect(row.locator(".dpb-tag")).toHaveCount(1);
  await expect(row.locator(".dpb-tag").first()).toContainText("#");
  await dpbRecord(page, "1256", "01-open-single-tag");

  const input = row.locator('[data-testid="dpb-tag-input"]');
  await input.fill("补充");
  await input.press("Enter");
  await expect(row.locator(".dpb-tag")).toHaveCount(2);
  await dpbRecord(page, "1256", "02-add-tag");

  const content = await page.evaluate(() => {
    const st = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            tabs: Record<string, { content: string }>;
            activeTabId: string;
          };
        };
      }
    ).__biaoyue_store__.getState();
    return st.tabs[st.activeTabId]?.content ?? "";
  });
  expect(content).not.toContain('tags: "#"');
  expect(content).toContain('- "#"');

  await setMode(page, "source");
  await expect(page.locator(".cm-content")).toContainText('- "#"');
  await dpbRecord(page, "1256", "03-source-yaml-list");

  await setMode(page, "edit");
  await expect(
    panel(page, "A").locator('[data-key="tags"] .dpb-tag'),
  ).toHaveCount(2);
  await expect(page.locator('[data-testid="dpb-error"]')).toHaveCount(0);
  await dpbRecord(page, "1256", "04-back-edit-no-error");
});

test("标签建议菜单：过滤 / 无匹配 Enter 新建 / 改名后颜色按新名重算 / 删除", async ({
  page,
}) => {
  await openDoc(page, COLOR_DOC, "/Users/test/color.md");
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="tags"]');
  const input = row.locator('[data-testid="dpb-tag-input"]');

  await input.fill("甲");
  const menu = page.locator('[data-testid="dpb-tag-menu"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-testid="dpb-tag-menu-row"]')).toHaveCount(1);
  await expect(menu.locator(".dpb-menu-label").first()).toHaveText("甲");

  await input.fill("新标签");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(row.locator(".dpb-tag")).toHaveCount(4);
  await expect(row.locator('[data-testid="dpb-tag-name"]').last()).toHaveText(
    "新标签",
  );

  await row.locator('[data-testid="dpb-tag-name"]').first().click();
  const rename = row.locator('[data-testid="dpb-tag-rename"]');
  await expect(rename).toBeVisible();
  await rename.fill("改名的标签");
  await rename.press("Enter");
  await expect(rename).toHaveCount(0);
  const renamed = row.locator(".dpb-tag").first();
  await expect(renamed.locator('[data-testid="dpb-tag-name"]')).toHaveText(
    "改名的标签",
  );
  expect(Number(await renamed.getAttribute("data-color"))).toBe(
    tagColor("改名的标签"),
  );

  await row.locator('[data-testid="dpb-tag-x"]').first().click();
  await expect(row.locator(".dpb-tag")).toHaveCount(3);
});

test("B 精排双列：列表 / 标签编辑器同样可用", async ({ page }) => {
  await openLinkDocs(page);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  await expect(
    b.locator('[data-key="related"] [data-testid="dpb-link-input"]'),
  ).toBeVisible();
  await expect(
    b.locator('[data-key="tags"] [data-testid="dpb-tag-input"]'),
  ).toBeVisible();

  await b
    .locator('[data-key="related"] [data-testid="dpb-link-input"]')
    .fill("[[");
  await expect(page.locator('[data-testid="dpb-doc-menu"]')).toBeVisible();
  await expect(
    page
      .locator('[data-testid="dpb-doc-menu-row"]')
      .nth(0)
      .locator(".dpb-menu-label"),
  ).toHaveText("list.md");
});

test("菜单关闭后 ⌘2 归还全局：无局部响应且工作区不变", async ({ page }) => {
  await openLinkDocs(page);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="related"]');
  const input = row.locator('[data-testid="dpb-link-input"]');

  await input.fill("[[");
  await expect(page.locator('[data-testid="dpb-doc-menu"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="dpb-doc-menu"]')).toHaveCount(0);
  await expect(panel(page, "A")).toBeVisible();

  await page.keyboard.press("Meta+2");
  await expect(page.locator('[data-testid="dpb-doc-menu"]')).toHaveCount(0);
  await expect(row.locator(".dpb-link-chip")).toHaveCount(1);
  expect(await sceneOf(page)).toBe("workspace");
});

const ROW_DOC = `---
title: 行操作
category: 草稿
author: 张三
source: 网络
note: 备注
---

# 正文
`;

const ROW_DOC_TAGS = `---
title: 行操作
tags:
  - 甲
category: 草稿
author: 张三
---

# 正文
`;

const WRAP_DOC = `---
title: 换行测试
alpha: 甲甲甲
bravo: 乙乙乙
charlie: 丙丙丙
delta: 丁丁丁
echo: 戊戊戊
foxtrot: 己己己
golf: 庚庚庚
hotel: 辛辛辛
india: 壬壬壬
juliet: 癸癸癸
kilo: 子子子
lima: 丑丑丑
---

# 正文
`;

async function rowKeys(page: Page, variant: "A" | "B"): Promise<string[]> {
  return panel(page, variant)
    .locator('[data-testid="dpb-row"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-key") ?? ""));
}

type ChipBox = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

async function chipBoxes(page: Page, variant: "A" | "B"): Promise<ChipBox[]> {
  return panel(page, variant)
    .locator('[data-testid="dpb-row"]')
    .evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return {
          key: e.getAttribute("data-key") ?? "",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      }),
    );
}

/** 按视觉行分组（中心 Y 相差 ≤2px），与 computeDropIndex 同判据。 */
function groupVisualRows(boxes: ChipBox[]): ChipBox[][] {
  const groups: ChipBox[][] = [];
  for (const b of boxes) {
    const cy = b.y + b.height / 2;
    const g = groups.find(
      (gr) => Math.abs(gr[0].y + gr[0].height / 2 - cy) <= 2,
    );
    if (g) g.push(b);
    else groups.push([b]);
  }
  groups.sort((a, b) => a[0].y - b[0].y);
  return groups;
}

function rowSpan(row: ChipBox[]): number {
  return (
    Math.max(...row.map((b) => b.y + b.height)) -
    Math.min(...row.map((b) => b.y))
  );
}

async function docText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            activeTabId: string | null;
            tabs: Record<string, { content: string }>;
          };
        };
      }
    ).__biaoyue_store__.getState();
    return s.tabs[s.activeTabId ?? ""]?.content ?? "";
  });
}

/** 持久化 frontmatter 的键序（含标题位），用于断言拖拽后的真实字段顺序。 */
async function frontmatterKeys(page: Page): Promise<string[]> {
  const text = await docText(page);
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return [];
  const keys: string[] = [];
  for (const line of block[1].split(/\r?\n/)) {
    const m = line.match(/^(\S[^:\n]*):/);
    if (m) keys.push(m[1].trim());
  }
  return keys;
}

test("行手柄点击多选 / 再点取消（A 态）", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setMode(page, "edit");
  const a = panel(page, "A");

  await a
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(a.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 1 项",
  );
  await expect(a.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    1,
  );

  await a.locator('[data-key="author"] [data-testid="dpb-row-handle"]').click();
  await expect(a.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 2 项",
  );
  await expect(a.locator(".dpb-chip.dpb-row-selected")).toHaveCount(2);

  await a
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(a.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 1 项",
  );
  await expect(a.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    0,
  );
});

test("手柄拖拽：5px 内不排序，超过 5px 显示落点线并移动", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "author",
    "source",
    "note",
  ]);

  const handle = b.locator('[data-key="note"] [data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  const x = hb.x + hb.width / 2;
  const y = hb.y + hb.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 3, { steps: 2 });
  await page.mouse.up();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "author",
    "source",
    "note",
  ]);

  const hb2 = (await handle.boundingBox())!;
  const x2 = hb2.x + hb2.width / 2;
  const y2 = hb2.y + hb2.height / 2;
  const cat = (await b.locator('[data-key="category"]').boundingBox())!;
  await page.mouse.move(x2, y2);
  await page.mouse.down();
  await page.mouse.move(x2, cat.y + cat.height * 0.25, { steps: 6 });
  await expect(page.locator('[data-testid="dpb-drop-line"]')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('[data-testid="dpb-drop-line"]')).toHaveCount(0);
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "note",
    "category",
    "author",
    "source",
  ]);
});

test("选中临近三行后拖动任一行 = 整块移动且相对顺序不变", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  for (const key of ["category", "author", "source"]) {
    await b
      .locator(`[data-key="${key}"] [data-testid="dpb-row-handle"]`)
      .click();
  }
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 3 项",
  );

  const handle = b.locator(
    '[data-key="author"] [data-testid="dpb-row-handle"]',
  );
  const hb = (await handle.boundingBox())!;
  const note = (await b.locator('[data-key="note"]').boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, note.y + note.height * 0.75, {
    steps: 6,
  });
  await page.mouse.up();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "note",
    "category",
    "author",
    "source",
  ]);
});

test("#1229 A 态拖拽：拖到中间胶囊落在目标位置（不追加到末尾）", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/drag-middle-a.md");
  await setVariant(page, "A");
  await setMode(page, "edit");
  const a = panel(page, "A");
  expect(await rowKeys(page, "A")).toEqual([
    "category",
    "author",
    "source",
    "note",
  ]);

  const chip = a.locator('[data-key="category"]');
  await chip.hover();
  const handle = chip.locator('[data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  const target = (await a.locator('[data-key="source"]').boundingBox())!;
  await page.mouse.move(
    target.x + target.width * 0.75,
    target.y + target.height * 0.75,
    { steps: 8 },
  );
  await expect(page.locator('[data-testid="dpb-drop-line"]')).toBeVisible();
  await dpbRecord(page, "1229", "edit-A-drag-middle");
  await page.mouse.up();
  await dpbRecord(page, "1229", "edit-A-drag-middle-result");

  expect(await rowKeys(page, "A")).toEqual([
    "author",
    "source",
    "category",
    "note",
  ]);
  expect(await frontmatterKeys(page)).toEqual([
    "title",
    "author",
    "source",
    "category",
    "note",
  ]);
});

test("#1229 A 态多选整块拖到中间位置（不追加到末尾）", async ({ page }) => {
  await openDoc(page, ROW_DOC, "/Users/test/drag-block-a.md");
  await setVariant(page, "A");
  await setMode(page, "edit");
  const a = panel(page, "A");

  for (const key of ["category", "author"]) {
    await a
      .locator(`[data-key="${key}"] [data-testid="dpb-row-handle"]`)
      .click();
  }
  await expect(a.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 2 项",
  );

  const chip = a.locator('[data-key="category"]');
  await chip.hover();
  const handle = chip.locator('[data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  const target = (await a.locator('[data-key="source"]').boundingBox())!;
  await page.mouse.move(
    target.x + target.width * 0.75,
    target.y + target.height * 0.75,
    { steps: 8 },
  );
  await dpbRecord(page, "1229", "edit-A-block-move");
  await page.mouse.up();

  expect(await rowKeys(page, "A")).toEqual([
    "source",
    "category",
    "author",
    "note",
  ]);
});

test("#1229 B 态拖拽：行 1 拖到行 3 落点 = [f2,f3,f1,f4,f5]", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/drag-middle-b.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "author",
    "source",
    "note",
  ]);

  const handle = b.locator('[data-key="title"] [data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  const target = (await b.locator('[data-key="author"]').boundingBox())!;
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height * 0.75,
    { steps: 8 },
  );
  await dpbRecord(page, "1229", "edit-B-drag-middle");
  await page.mouse.up();

  expect(await rowKeys(page, "B")).toEqual([
    "category",
    "author",
    "title",
    "source",
    "note",
  ]);
});

test("#1246 A 态拖拽：右下落点显示行内竖条（x 在相邻胶囊之间，高约等于行高）", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/drag-vertical-a.md");
  await setVariant(page, "A");
  await setMode(page, "edit");
  const a = panel(page, "A");

  const chip = a.locator('[data-key="category"]');
  await chip.hover();
  const handle = chip.locator('[data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  // 拖起即选中：删除按钮隐藏、操作条出现，布局重排，按选中后的真实盒形定位。
  const sourceBox = (await a.locator('[data-key="source"]').boundingBox())!;
  const noteBox = (await a.locator('[data-key="note"]').boundingBox())!;
  await page.mouse.move(
    sourceBox.x + sourceBox.width * 0.75,
    sourceBox.y + sourceBox.height * 0.75,
    { steps: 8 },
  );

  const line = page.locator('[data-testid="dpb-drop-line"]');
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute("data-orientation", "v");
  const lineBox = (await line.boundingBox())!;
  expect(lineBox.x).toBeGreaterThan(sourceBox.x + sourceBox.width);
  expect(lineBox.x).toBeLessThan(noteBox.x);
  expect(
    Math.abs(lineBox.height - rowSpan([sourceBox, noteBox])),
  ).toBeLessThanOrEqual(2);
  await dpbRecord(page, "1246", "edit-A-vertical-gap");

  await page.mouse.up();
  await dpbRecord(page, "1246", "edit-A-vertical-gap-result");
  expect(await rowKeys(page, "A")).toEqual([
    "author",
    "source",
    "category",
    "note",
  ]);
});

test("#1246 A 态拖拽：拖到换行视觉行行首，竖条贴该行左缘胶囊", async ({
  page,
}) => {
  await openDoc(page, WRAP_DOC, "/Users/test/drag-row-start.md");
  await setVariant(page, "A");
  await setMode(page, "edit");
  const a = panel(page, "A");

  const before = await rowKeys(page, "A");
  const chip = a.locator(`[data-key="${before[0]}"]`);
  await chip.hover();
  const handle = chip.locator('[data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  // 拖起即选中触发布局重排，按选中后的真实视觉行取「换行行首」目标。
  const groups = groupVisualRows(await chipBoxes(page, "A"));
  expect(groups.length).toBeGreaterThanOrEqual(2);
  const targetRow = groups[groups.length - 1];
  const leftChip = targetRow[0];
  await page.mouse.move(
    leftChip.x + leftChip.width * 0.1,
    leftChip.y + leftChip.height / 2,
    { steps: 8 },
  );

  const line = page.locator('[data-testid="dpb-drop-line"]');
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute("data-orientation", "v");
  const lineBox = (await line.boundingBox())!;
  expect(Math.abs(lineBox.x - leftChip.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(lineBox.height - rowSpan(targetRow))).toBeLessThanOrEqual(2);
  await dpbRecord(page, "1246", "edit-A-row-start");

  await page.mouse.up();
  await dpbRecord(page, "1246", "edit-A-row-start-result");
  const moved = before[0];
  const expected = [...before];
  expected.splice(expected.indexOf(moved), 1);
  expected.splice(expected.indexOf(leftChip.key), 0, moved);
  expect(await rowKeys(page, "A")).toEqual(expected);
});

test("#1246 B 态拖拽：落点线保持整宽横线（data-orientation=h）", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/drag-horizontal-b.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  const handle = b.locator('[data-key="title"] [data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  const target = (await b.locator('[data-key="author"]').boundingBox())!;
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height * 0.75,
    { steps: 8 },
  );

  const line = page.locator('[data-testid="dpb-drop-line"]');
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute("data-orientation", "h");
  const lineBox = (await line.boundingBox())!;
  const panelBox = (await b.boundingBox())!;
  expect(lineBox.width).toBeGreaterThanOrEqual(panelBox.width - 4);
  expect(Math.abs(lineBox.x - panelBox.x)).toBeLessThanOrEqual(4);
  const sourceBox = (await b.locator('[data-key="source"]').boundingBox())!;
  expect(Math.abs(lineBox.y - sourceBox.y)).toBeLessThanOrEqual(2);
  await dpbRecord(page, "1246", "edit-B-horizontal");

  await page.mouse.up();
  await dpbRecord(page, "1246", "edit-B-horizontal-result");
  expect(await rowKeys(page, "B")).toEqual([
    "category",
    "author",
    "title",
    "source",
    "note",
  ]);
});

test("#1161 复制/剪切两行粘贴：类型名一致、值一律为空；同名键追加序号", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await b.locator('[data-key="author"] [data-testid="dpb-row-handle"]').click();
  await b.locator('[data-testid="dpb-ops-copy"]').click();
  await expect(
    b.locator('[data-key="category"] [data-testid="dpb-value"]'),
  ).toHaveText("草稿");
  await expect(
    b.locator('[data-key="author"] [data-testid="dpb-value"]'),
  ).toHaveText("张三");
  await dpbRecord(page, "1161", "01-copy-keeps-source-values");

  await b.locator('[data-testid="dpb-ops-cut"]').click();
  expect(await rowKeys(page, "B")).toEqual(["title", "source", "note"]);

  await b.locator('[data-key="note"] [data-testid="dpb-row-handle"]').click();
  await b.locator('[data-testid="dpb-ops-paste"]').click();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "source",
    "note",
    "category",
    "author",
  ]);
  await expect(
    b.locator('[data-key="category"] [data-testid="dpb-value"]'),
  ).toHaveText("");
  await expect(
    b.locator('[data-key="author"] [data-testid="dpb-value"]'),
  ).toHaveText("");
  await dpbRecord(page, "1161", "02-pasted-empty-values");

  await b.locator('[data-key="author"] [data-testid="dpb-row-handle"]').click();
  await b.locator('[data-testid="dpb-ops-paste"]').click();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "source",
    "note",
    "category",
    "author",
    "category-2",
    "author-2",
  ]);
  await expect(
    b.locator('[data-key="category-2"] [data-testid="dpb-value"]'),
  ).toHaveText("");
  await expect(
    b.locator('[data-key="author-2"] [data-testid="dpb-value"]'),
  ).toHaveText("");
  await dpbRecord(page, "1161", "03-deduped-empty-values");

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText('category: ""');
  await expect(src).toContainText('author: ""');
  await expect(src).toContainText('category-2: ""');
  await expect(src).toContainText('author-2: ""');
});

test("#1161 跨文档复制→粘贴：目标文档同类型同名字段、值为空，原文档不受影响", async ({
  page,
}) => {
  const SRC_DOC = `---
title: 来源文档
category: 草稿
author: 张三
count: 7
published: true
---

# 正文
`;
  const DST_DOC = `---
title: 目标文档
note: 已有备注
---

# 正文
`;
  await openDoc(page, SRC_DOC, "/Users/test/clip-src.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const src1 = panel(page, "B");

  for (const key of ["category", "author", "count", "published"]) {
    await src1
      .locator(`[data-key="${key}"] [data-testid="dpb-row-handle"]`)
      .click();
  }
  await src1.locator('[data-testid="dpb-ops-copy"]').click();
  await dpbRecord(page, "1161", "04-cross-doc-copied");

  await openDoc(page, DST_DOC, "/Users/test/clip-dst.md");
  await setMode(page, "edit");
  const dst = panel(page, "B");
  await dst.locator('[data-key="note"] [data-testid="dpb-row-handle"]').click();
  await dst.locator('[data-testid="dpb-ops-paste"]').click();

  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "note",
    "category",
    "author",
    "count",
    "published",
  ]);
  const typeLabels: Array<[string, string]> = [
    ["category", "下拉"],
    ["author", "文本"],
    ["count", "数字"],
    ["published", "布尔"],
  ];
  for (const [key, label] of typeLabels) {
    // 行内类型文字已移除，改由图标 title 承载类型语义（#1261）
    await expect(
      dst.locator(`[data-key="${key}"] [data-testid="dpb-type"]`),
    ).toHaveAttribute("title", new RegExp(label));
    await expect(
      dst.locator(`[data-key="${key}"] .dpb-type-label`),
    ).toHaveCount(0);
  }
  await expect(
    dst.locator('[data-key="category"] [data-testid="dpb-value"]'),
  ).toHaveText("");
  await expect(
    dst.locator('[data-key="author"] [data-testid="dpb-value"]'),
  ).toHaveText("");
  await expect(
    dst.locator('[data-key="count"] [data-testid="dpb-value"]'),
  ).toHaveText("");
  await expect(
    dst.locator('[data-key="published"] [data-testid="dpb-value"]'),
  ).toHaveText("○");
  await dpbRecord(page, "1161", "05-cross-doc-pasted-empty");

  await openDoc(page, SRC_DOC, "/Users/test/clip-src.md");
  await setMode(page, "edit");
  const src2 = panel(page, "B");
  await expect(
    src2.locator('[data-key="category"] [data-testid="dpb-value"]'),
  ).toHaveText("草稿");
  await expect(
    src2.locator('[data-key="author"] [data-testid="dpb-value"]'),
  ).toHaveText("张三");
  await expect(
    src2.locator('[data-key="count"] [data-testid="dpb-value"]'),
  ).toHaveText("7");
  await dpbRecord(page, "1161", "06-source-doc-unchanged");
});

test("全选含标签行、排除标题位，可手动再选标题", async ({ page }) => {
  await openDoc(page, ROW_DOC_TAGS);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-testid="dpb-select-all"]').click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 3 项",
  );
  await expect(b.locator('[data-key="title"].dpb-row-selected')).toHaveCount(0);
  await expect(b.locator('[data-key="tags"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    1,
  );
  await expect(b.locator('[data-key="author"].dpb-row-selected')).toHaveCount(
    1,
  );

  await b.locator('[data-key="title"] [data-testid="dpb-row-handle"]').click();
  await expect(b.locator('[data-key="title"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 4 项",
  );
});

test("全选/反选二态：连点两次全选→补集，文案两取值，标题不参与、标签纳入", async ({
  page,
}) => {
  await openDoc(page, THREE_SELECTABLE_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  const selectAll = b.locator('[data-testid="dpb-select-all"]');

  await expect(b.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
  await expect(selectAll).toHaveText("全选");

  await selectAll.click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 4 项",
  );
  await expect(selectAll).toHaveText("反选");
  await expect(b.locator('[data-key="title"].dpb-row-selected')).toHaveCount(0);
  await expect(b.locator('[data-key="tags"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-key="score"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-key="note"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    1,
  );
  await dpbRecord(page, "1042", "01-selected-all");

  await selectAll.click();
  await expect(b.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
  await expect(selectAll).toHaveText("全选");
  await expect(b.locator(".dpb-row-selected")).toHaveCount(0);
  await dpbRecord(page, "1042", "02-inverted-empty");

  await selectAll.click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 4 项",
  );
  await page.locator(".cm-content").first().click();
  await expect(b.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
  await expect(selectAll).toHaveText("全选");
  await expect(b.locator(".dpb-row-selected")).toHaveCount(0);
  await dpbRecord(page, "1042", "03-cleared-after-outside-click");

  await selectAll.click();
  await b.locator('[data-key="score"] [data-testid="dpb-row-handle"]').click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 3 项",
  );
  await selectAll.click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 1 项",
  );
  await expect(b.locator('[data-key="score"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-key="note"].dpb-row-selected')).toHaveCount(0);
  await expect(b.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    0,
  );
  await expect(b.locator('[data-key="tags"].dpb-row-selected')).toHaveCount(0);
  await dpbRecord(page, "1042", "04-partial-invert");
});

test("三元组交互：单击字段名改名、手柄选中、选中后点其他字段任意位置切换选中", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC);
  await setMode(page, "edit");
  const a = panel(page, "A");

  await a.locator('[data-key="category"] [data-testid="dpb-label"]').click();
  const rename = a.locator(
    '[data-key="category"] [data-testid="dpb-rename-input"]',
  );
  await expect(rename).toBeVisible();
  await expect(panel(page, "A")).not.toHaveClass(/select-mode/);
  await rename.press("Escape");
  await expect(rename).toHaveCount(0);

  await a
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(panel(page, "A")).toHaveClass(/select-mode/);
  await expect(a.locator('[data-testid="dpb-select-all"]')).toHaveText("反选");
  await expect(a.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    1,
  );
  const softA = await accentSoft(page);
  expect(await effectiveBg(page, '[data-key="category"]')).toBe(softA);
  expect(
    await effectiveBg(page, '[data-key="category"] [data-testid="dpb-value"]'),
  ).toBe(softA);
  expect(await effectiveBg(page, '[data-key="author"]')).not.toBe(softA);
  await dpbRecord(page, "1162", "03-a-row-selected");

  await a.locator('[data-key="author"] [data-testid="dpb-value"]').click();
  await expect(a.locator('[data-key="author"].dpb-row-selected')).toHaveCount(
    1,
  );
  await expect(a.locator('[data-testid="dpb-input"]')).toHaveCount(0);
  await expect(
    a.locator('[data-key="author"] [data-testid="dpb-value"]'),
  ).toHaveText("张三");
  await expect(a.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 2 项",
  );
  await dpbRecord(page, "1162", "04-a-value-through");

  await a.locator('[data-key="source"] [data-testid="dpb-label"]').click();
  await expect(a.locator('[data-key="source"].dpb-row-selected')).toHaveCount(
    1,
  );
  await expect(a.locator('[data-testid="dpb-rename-input"]')).toHaveCount(0);
  await expect(a.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 3 项",
  );

  await a.locator('[data-key="source"] [data-testid="dpb-value"]').click();
  await expect(a.locator('[data-key="source"].dpb-row-selected')).toHaveCount(
    0,
  );
  await expect(a.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 2 项",
  );

  await page.locator(".cm-content").first().click();
  await expect(panel(page, "A")).not.toHaveClass(/select-mode/);
  await expect(page.locator('[data-testid="dpb-ops"]')).toHaveCount(0);

  await a.locator('[data-key="author"] [data-testid="dpb-value"]').click();
  await expect(a.locator('[data-testid="dpb-input"]')).toBeVisible();
});

test("#1128 选择模型四态：0 选中全选 / 选中即反选 / 标签参与 / 反选互补", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC_TAGS);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  const selectAll = b.locator('[data-testid="dpb-select-all"]');

  await expect(selectAll).toHaveText("全选");
  await expect(b.locator(".dpb-row-selected")).toHaveCount(0);
  await dpbRecord(page, "1128", "01-zero-select-all");

  await b.locator('[data-key="category"] [data-testid="dpb-label"]').click();
  const rename = b.locator(
    '[data-key="category"] [data-testid="dpb-rename-input"]',
  );
  await expect(rename).toBeVisible();
  await expect(b.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
  await rename.press("Escape");
  await expect(rename).toHaveCount(0);

  await b
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(selectAll).toHaveText("反选");
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 1 项",
  );
  const soft = await accentSoft(page);
  expect(await effectiveBg(page, '[data-key="category"]')).toBe(soft);
  expect(
    await effectiveBg(page, '[data-key="category"] [data-testid="dpb-value"]'),
  ).toBe(soft);
  expect(await effectiveBg(page, '[data-key="author"]')).not.toBe(soft);
  await dpbRecord(page, "1162", "01-b-row-selected");
  await dpbRecord(page, "1128", "02-one-name-invert-ready");

  await b.locator('[data-key="tags"] [data-testid="dpb-row-handle"]').click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 2 项",
  );
  expect(await effectiveBg(page, '[data-key="tags"]')).toBe(soft);
  expect(await effectiveBg(page, '[data-key="tags"] .dpb-tag')).not.toBe(soft);
  await dpbRecord(page, "1162", "02-b-value-through");

  await selectAll.click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 1 项",
  );
  await expect(b.locator('[data-key="author"].dpb-row-selected')).toHaveCount(
    1,
  );
  await expect(b.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    0,
  );
  await expect(b.locator('[data-key="tags"].dpb-row-selected')).toHaveCount(0);
  await expect(selectAll).toHaveText("反选");
  await dpbRecord(page, "1128", "03-inverted-complement");

  await b.locator('[data-key="author"] [data-testid="dpb-value"]').click();
  await expect(b.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
  await expect(selectAll).toHaveText("全选");

  await selectAll.click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 3 项",
  );
  await expect(b.locator('[data-key="tags"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-key="title"].dpb-row-selected')).toHaveCount(0);
  await dpbRecord(page, "1128", "04-select-all-tags-no-title");
});

test("操作条：无选中不出现；选中出现且粘贴禁用；复制后可用；取消隐藏", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  await expect(page.locator('[data-testid="dpb-ops"]')).toHaveCount(0);

  await b
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(page.locator('[data-testid="dpb-ops"]')).toBeVisible();
  await expect(page.locator('[data-testid="dpb-ops-paste"]')).toBeDisabled();

  await page.locator('[data-testid="dpb-ops-copy"]').click();
  await expect(page.locator('[data-testid="dpb-ops-paste"]')).toBeEnabled();

  await page.locator('[data-testid="dpb-ops-clear"]').click();
  await expect(page.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
});

test("#1262 选中操作条为中性表面色，不与选中行同色", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  const row = b.locator('[data-key="category"]');
  await row.locator('[data-testid="dpb-row-handle"]').click();
  const ops = page.locator('[data-testid="dpb-ops"]');
  await expect(ops).toBeVisible();
  const opsBg = await ops.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const rowBg = await row.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const accentSoft = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--app-accent-soft")
      .trim(),
  );
  expect(opsBg).not.toBe(rowBg);
  expect(opsBg).not.toContain("99, 102, 241");
  expect(accentSoft.length).toBeGreaterThan(0);
  await dpbRecord(page, "1262", "01-ops-neutral");

  await page.locator('[data-testid="dpb-ops-copy"]').click();
  await expect(page.locator('[data-testid="dpb-ops-paste"]')).toBeEnabled();
  await dpbRecord(page, "1262", "02-copy-click");

  await page.locator('[data-testid="dpb-ops-del"]').click();
  await expect(b.locator('[data-key="category"]')).toHaveCount(0);
  await dpbRecord(page, "1262", "03-delete-selected");

  await page.mouse.click(4, 4);
  await expect(ops).toHaveCount(0);
  await dpbRecord(page, "1262", "04-cleared");
});

test("操作条七按钮为注册表 SVG 图标：无字形文本、描边 1.7（#1022）", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(page.locator('[data-testid="dpb-ops"]')).toBeVisible();
  await dpbRecord(page, "1022", "01-opsbar-visible");

  const ops: Array<[string, string]> = [
    ["copy", "copy"],
    ["cut", "cut"],
    ["paste", "paste"],
    ["up", "arrowUp"],
    ["down", "arrowDown"],
    ["del", "trash"],
    ["clear", "close"],
  ];
  for (const [id, icon] of ops) {
    const btn = page.locator(`[data-testid="dpb-ops-${id}"]`);
    await expect(btn.locator("svg")).toHaveCount(1);
    await expect(btn.locator("svg")).toHaveAttribute("data-icon", icon);
    expect((await btn.textContent())?.trim()).toBe("");
    await expect(btn.locator("svg path").first()).toHaveAttribute(
      "stroke-width",
      "1.7",
    );
  }

  await page.locator('[data-testid="dpb-ops-copy"]').click();
  await expect(page.locator('[data-testid="dpb-ops-paste"]')).toBeEnabled();
  await dpbRecord(page, "1022", "02-copy-click");

  await page.locator('[data-testid="dpb-ops-del"]').click();
  await expect(page.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "author",
    "source",
    "note",
  ]);
  await dpbRecord(page, "1022", "03-delete-selected");

  await b.locator('[data-key="author"] [data-testid="dpb-row-handle"]').click();
  await expect(page.locator('[data-testid="dpb-ops"]')).toBeVisible();
  await page.locator('[data-testid="dpb-ops-clear"]').click();
  await expect(page.locator('[data-testid="dpb-ops"]')).toHaveCount(0);
  await dpbRecord(page, "1022", "04-close-clears");
});

test("删除所选字段保留标题位", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-testid="dpb-select-all"]').click();
  await b.locator('[data-testid="dpb-ops-del"]').click();
  expect(await rowKeys(page, "B")).toEqual(["title"]);
  await expect(b.locator('[data-key="title"]')).toHaveCount(1);
});

test("结构变更单事务：删除所选行后 Ctrl+Z 一次恢复", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await b.locator('[data-testid="dpb-ops-del"]').click();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "author",
    "source",
    "note",
  ]);

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Meta+Z");
  await expect
    .poll(async () => (await rowKeys(page, "B")).join(","))
    .toBe("title,category,author,source,note");
});

test("B 行尾删除按钮：点击删除普通字段，源码同步移除", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  const row = b.locator('[data-key="category"]');
  await expect(row.locator('[data-testid="dpb-row-del"]')).toHaveCount(1);
  await row.locator('[data-testid="dpb-row-del"]').click();

  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "author",
    "source",
    "note",
  ]);
  await dpbRecord(page, "1016", "01-row-del-removed");
  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).not.toContainText(
    "category:",
  );
});

test("B 行尾删除后可 Ctrl+Z 一次恢复", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-key="category"] [data-testid="dpb-row-del"]').click();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "author",
    "source",
    "note",
  ]);

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Meta+Z");
  await expect
    .poll(async () => (await rowKeys(page, "B")).join(","))
    .toBe("title,category,author,source,note");
  await dpbRecord(page, "1016", "02-undo-restored");
});

test("B 行尾删除按钮：标题 / 标签行不渲染，普通字段渲染；日期无行", async ({
  page,
}) => {
  await openDoc(page);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  for (const key of ["created", "updated"]) {
    await expect(
      b.locator(`[data-testid="dpb-row"][data-key="${key}"]`),
    ).toHaveCount(0);
  }
  await expect(
    b.locator('[data-key="title"] [data-testid="dpb-row-del"]'),
  ).toHaveCount(0);
  await expect(
    b.locator('[data-key="tags"] [data-testid="dpb-row-del"]'),
  ).toHaveCount(0);
  await expect(
    b.locator('[data-key="count"] [data-testid="dpb-row-del"]'),
  ).toHaveCount(1);
  await dpbRecord(page, "1016", "03-managed-row-lock-only");
});

test("选择模式：选中一行后所有行尾删除按钮隐藏", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await expect(
    b.locator('[data-key="category"] [data-testid="dpb-row-del"]'),
  ).toHaveCount(1);
  await b
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(b).toHaveClass(/select-mode/);
  await expect(b.locator('[data-testid="dpb-row-del"]')).toHaveCount(0);
  await dpbRecord(page, "1016", "04-select-mode-hidden");
});

test("行尾删除单行：其余自由键原样保留（P-9）", async ({ page }) => {
  await openDoc(page, ROW_DOC);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-key="author"] [data-testid="dpb-row-del"]').click();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "source",
    "note",
  ]);
  await expect(
    b.locator('[data-key="category"] [data-testid="dpb-value"]'),
  ).toHaveText("草稿");
  await expect(
    b.locator('[data-key="source"] [data-testid="dpb-value"]'),
  ).toHaveText("网络");
  await expect(
    b.locator('[data-key="note"] [data-testid="dpb-value"]'),
  ).toHaveText("备注");
  await dpbRecord(page, "1016", "05-free-keys-preserved");
});

const REALISTIC_DOC = `---
title: 真实文档：冒号 # 引号
tags:
  - 甲
  - "乙:丙"
category: '草稿: 进行中'
note: |
  第一行
  第二行
author: 张三
count: 42
---

# 正文
`;

const CRLF_DOC =
  "---\r\ntitle: CRLF 文档\r\ncategory: 草稿\r\nauthor: 张三\r\n---\r\n\r\n# 正文\r\n";

test("行尾删除：真实 frontmatter 形态（数组 / 引号冒号 / 多行 / 注释）A/B 均生效", async ({
  page,
}) => {
  for (const variant of ["A", "B"] as const) {
    await openDoc(page, REALISTIC_DOC, `/Users/test/realistic-${variant}.md`);
    await setVariant(page, variant);
    await setMode(page, "edit");
    const p = panel(page, variant);

    await p
      .locator('[data-key="category"] [data-testid="dpb-row-del"]')
      .click();
    expect(await rowKeys(page, variant)).not.toContain("category");
    await setMode(page, "source");
    await expect(page.locator(".cm-content").first()).not.toContainText(
      "category:",
    );
    await expect(p.locator('[data-key="note"]')).toHaveCount(1);
    await expect(
      p.locator('[data-key="author"] [data-testid="dpb-value"]'),
    ).toHaveText("张三");
  }
});

test("工具条删除：CRLF 文档选中行后删除，源码同步移除", async ({ page }) => {
  await openDoc(page, CRLF_DOC, "/Users/test/crlf.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await b.locator('[data-testid="dpb-ops-del"]').click();
  expect(await rowKeys(page, "B")).toEqual(["title", "author"]);
  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).not.toContainText(
    "category:",
  );
});

test("分屏：非聚焦格行尾 / 工具条删除只改本格，另一格逐字不变（#1016）", async ({
  page,
}) => {
  const DOC_A = `---\ntitle: 分屏甲\ncategory: 甲类\nauthor: 张三\n---\n\n# 甲\n`;
  const DOC_B = `---\ntitle: 分屏乙\ncategory: 乙类\nauthor: 李四\n---\n\n# 乙\n`;

  await openDoc(page, DOC_A, "/Users/test/split-a.md");
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => { splitPane: (d: string) => void };
        };
      }
    ).__biaoyue_store__
      .getState()
      .splitPane("right");
  });
  await openDoc(page, DOC_B, "/Users/test/split-b.md");
  await setVariant(page, "B");

  const panes = await page.locator("[data-pane-id]").evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute("data-pane-id"),
      kind: e.getAttribute("data-pane-kind"),
    })),
  );
  for (const pane of panes) {
    if (pane.kind !== "tabs") continue;
    await page.evaluate((pid) => {
      (
        window as unknown as {
          __biaoyue_store__: {
            getState: () => {
              setPaneEditorMode: (id: string, m: string) => void;
            };
          };
        }
      ).__biaoyue_store__
        .getState()
        .setPaneEditorMode(pid, "edit");
    }, pane.id);
  }

  const readPath = (path: string) =>
    page.evaluate((p) => {
      const s = (
        window as unknown as {
          __biaoyue_store__: {
            getState: () => {
              tabs: Record<string, { path: string; content: string }>;
            };
          };
        }
      ).__biaoyue_store__.getState();
      const tab = Object.values(s.tabs).find((t) => t.path === p);
      return tab?.content ?? "";
    }, path);

  await page.locator('[data-pane-id="main"] .cm-content').first().click();

  const bars = page.locator('[data-testid="dpb-b"]');
  let targetIdx = -1;
  for (let i = 0; i < (await bars.count()); i++) {
    const text = (await bars.nth(i).textContent()) ?? "";
    if (text.includes("分屏乙")) targetIdx = i;
  }
  expect(targetIdx, "找到分屏乙所在面板").toBeGreaterThanOrEqual(0);
  const target = bars.nth(targetIdx);

  await target
    .locator('[data-key="category"] [data-testid="dpb-row-del"]')
    .click();
  await expect(target.locator('[data-key="category"]')).toHaveCount(0);
  expect(await readPath("/Users/test/split-b.md")).not.toContain("category:");
  expect(await readPath("/Users/test/split-a.md")).toBe(DOC_A);

  await target
    .locator('[data-key="author"] [data-testid="dpb-row-handle"]')
    .click();
  await target.locator('[data-testid="dpb-ops-del"]').click();
  await expect(target.locator('[data-key="author"]')).toHaveCount(0);
  expect(await readPath("/Users/test/split-b.md")).not.toContain("author:");
  expect(await readPath("/Users/test/split-a.md")).toBe(DOC_A);
});

async function newDoc(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as {
        __biaoyue_store__: { getState: () => { newTab: () => void } };
      }
    ).__biaoyue_store__
      .getState()
      .newTab();
  });
}

interface ActiveTabInfo {
  id: string;
  title: string;
  content: string;
  path?: string;
}

async function activeTab(page: Page): Promise<ActiveTabInfo> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __biaoyue_store__: {
          getState: () => {
            activeTabId: string | null;
            tabs: Record<
              string,
              { id: string; title: string; content: string; path?: string }
            >;
          };
        };
      }
    ).__biaoyue_store__;
    const s = store.getState();
    const tab = s.tabs[s.activeTabId ?? ""];
    return {
      id: tab.id,
      title: tab.title,
      content: tab.content,
      path: tab.path,
    };
  });
}

test("新建文档：默认仅标题占位 + 创建/修改日期，页签名未命名", async ({
  page,
}) => {
  await newDoc(page);
  const a = panel(page, "A");
  await expect(a.locator('[data-testid="dpb-title"]')).toHaveText("未命名");
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(0);
  const dates = a.locator('[data-testid="dpb-managed-dates"]');
  await expect(dates.locator('[data-testid="dpb-managed-date"]')).toHaveCount(
    2,
  );
  await expect(
    dates.locator('[data-testid="dpb-managed-date"][data-key="created"]'),
  ).toContainText("创建");
  await expect(a.locator('[data-testid="dpb-count"]')).toHaveText("1 个字段");
  expect((await activeTab(page)).title).toBe("未命名");

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText('title: ""');
  await expect(src).toContainText("created:");
  await expect(src).toContainText("updated:");
});

test("面板改标题 → 页签名同步，源码标题更新", async ({ page }) => {
  await newDoc(page);
  const a = panel(page, "A");
  await a.locator('[data-testid="dpb-title"]').click();
  const input = a.locator('[data-testid="dpb-title-input"]');
  await expect(input).toBeVisible();
  await input.fill("会议纪要");
  await input.press("Enter");
  await expect(input).toHaveCount(0);

  const tab = await activeTab(page);
  expect(tab.title).toBe("会议纪要");
  expect(tab.content).toContain("会议纪要");
  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText("会议纪要");
});

test("双击页签重命名 → 回写文档标题字段", async ({ page }) => {
  await newDoc(page);
  await page.locator('[data-tab-id][aria-selected="true"]').dblclick();
  const input = page.locator('[data-testid="tab-title-input"]');
  await expect(input).toBeVisible();
  await input.fill("周会记录");
  await input.press("Enter");
  await expect(input).toHaveCount(0);

  const tab = await activeTab(page);
  expect(tab.title).toBe("周会记录");
  expect(tab.content).toContain("周会记录");
});

test("#1276 块后空行不并入属性块：首行回车下移、正文输入不破坏 frontmatter", async ({
  page,
}) => {
  const doc =
    `---\ntitle: 空行\ncreated: 2026-11-21\nupdated: 2026-11-21\n---\n` +
    "\n".repeat(3) +
    `首行正文\n第二行\n`;
  await openDoc(page, doc, "/tmp/blank-body.md");
  await setMode(page, "edit");
  const line = page.locator(".cm-line", { hasText: "首行正文" }).first();
  await line.scrollIntoViewIfNeeded();
  const box = (await line.boundingBox())!;
  await page.mouse.click(box.x + 2, box.y + box.height / 2);
  await page.keyboard.type("X");
  await expect
    .poll(async () => (await docText(page)).includes("X首行正文"), {
      timeout: 3000,
    })
    .toBe(true);
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Home");
  const before = await docText(page);
  const linesBefore = before.split("首行正文")[0].split("\n").length;
  await page.keyboard.press("Enter");
  await expect
    .poll(
      async () => (await docText(page)).split("首行正文")[0].split("\n").length,
      { timeout: 3000 },
    )
    .toBe(linesBefore + 1);
  await dpbRecord(page, "1276", "01-enter-moves-down");

  await page.keyboard.type("补充");
  const text = await docText(page);
  expect(text.split("首行正文")[0].split("\n").length).toBe(linesBefore + 1);
  expect(text).toContain("补充");
  expect(text.startsWith("---\n")).toBe(true);
  await dpbRecord(page, "1276", "02-body-typed");

  await setMode(page, "preview");
  await expect(page.locator("body")).not.toContainText("应用错误");
  await expect(page.locator("body")).toContainText("补充");
  await dpbRecord(page, "1276", "03-preview-no-error");

  await setMode(page, "edit");
  await expect(
    panel(page, "A").locator('[data-testid="dpb-title"]'),
  ).toHaveText("空行");
  await dpbRecord(page, "1276", "04-back-edit-intact");
});

test("#1277 frontmatter 前导空格：属性可显示，首次编辑归位", async ({
  page,
}) => {
  const doc = `  ---\ntitle: 空格\n---\n\n正文\n`;
  await openDoc(page, doc, "/tmp/lead-space.md");
  await setMode(page, "edit");
  await expect(
    panel(page, "A").locator('[data-testid="dpb-title"]'),
  ).toHaveText("空格");
  await dpbRecord(page, "1277", "01-panel-visible");

  await panel(page, "A").locator('[data-testid="dpb-title"]').click();
  const input = panel(page, "A").locator('[data-testid="dpb-title-input"]');
  await input.fill("修复");
  await input.press("Enter");
  const text = await docText(page);
  expect(text.startsWith("---\n")).toBe(true);
  expect(text).toContain("title: 修复");
  await dpbRecord(page, "1277", "02-healed");

  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "title: 修复",
  );
  await dpbRecord(page, "1277", "03-source-healed");

  await setMode(page, "preview");
  const preview = page.locator(".preview-content").first();
  await expect(preview).toContainText("正文");
  await expect(preview).not.toContainText("title:");
  await expect(preview).not.toContainText("created:");
  await dpbRecord(page, "1277", "05-preview-no-yaml");

  await setMode(page, "edit");
  await expect(
    panel(page, "A").locator('[data-testid="dpb-title"]'),
  ).toHaveText("修复");
  await dpbRecord(page, "1277", "04-still-ok");
});

test("#1263 页签改名只改主名、扩展名只读；面板标题不显示扩展名", async ({
  page,
}) => {
  await openDoc(
    page,
    `---\ntitle: 笔记.md\n---\n\n# 正文\n`,
    "/Users/test/note.md",
  );
  await setMode(page, "edit");
  await expect(
    panel(page, "A").locator('[data-testid="dpb-title"]'),
  ).toHaveText("笔记");
  await dpbRecord(page, "1263", "01-panel-title-no-ext");

  await page.locator('[data-tab-id][aria-selected="true"]').dblclick();
  const input = page.locator('[data-testid="tab-title-input"]');
  await expect(input).toHaveValue("note");
  await expect(page.locator('[data-testid="tab-ext"]')).toHaveText(".md");
  await dpbRecord(page, "1263", "02-rename-stem-only");

  await input.fill("改名");
  await input.press("Enter");
  const tab = await activeTab(page);
  expect(tab.title).toBe("改名.md");
  expect(tab.path).toBe("/Users/test/note.md");
  expect(tab.content).toContain("title: 改名");
  expect(tab.content).not.toContain("title: 改名.md");
  await dpbRecord(page, "1263", "03-commit-keeps-ext");

  await page.locator('[data-tab-id][aria-selected="true"]').dblclick();
  await expect(page.locator('[data-testid="tab-title-input"]')).toHaveValue(
    "改名",
  );
  await page.keyboard.press("Escape");
  await dpbRecord(page, "1263", "04-reopen-stem");

  await setMode(page, "edit");
  const title = panel(page, "A").locator('[data-testid="dpb-title"]');
  await title.click();
  const titleInput = panel(page, "A").locator(
    '[data-testid="dpb-title-input"]',
  );
  await titleInput.fill("面板改名");
  await titleInput.press("Enter");
  await expect(
    page.locator('[data-tab-id][aria-selected="true"]'),
  ).toHaveAttribute("aria-label", "面板改名.md");
  const tab2 = await activeTab(page);
  expect(tab2.title).toBe("面板改名.md");
  expect(tab2.content).toContain("title: 面板改名");
  expect(tab2.content).not.toContain("title: 面板改名.md");
  await dpbRecord(page, "1263", "05-panel-sync-keeps-ext");
});

test("双击页签重命名 → 属性面板标题字段同步（#1232）", async ({ page }) => {
  await openDoc(page, DOC, "/Users/test/rename-sync.md");
  await setMode(page, "edit");
  const a = panel(page, "A");
  await expect(a.locator('[data-testid="dpb-title"]')).toHaveText(
    "属性面板测试",
  );

  await page.locator('[data-tab-id][aria-selected="true"]').dblclick();
  const input = page.locator('[data-testid="tab-title-input"]');
  await expect(input).toBeVisible();
  await input.fill("周会记录");
  await input.press("Enter");
  await expect(input).toHaveCount(0);

  await expect(a.locator('[data-testid="dpb-title"]')).toHaveText("周会记录");
  await expect.poll(async () => docText(page)).toContain("title: 周会记录");
  const tab = await activeTab(page);
  expect(tab.title).toBe("周会记录.md");
  await dpbRecord(page, "1232", "01-literal-title-synced");
});

test("双击页签重命名 → 别称标题键（标题）同步（#1232）", async ({ page }) => {
  await openDoc(
    page,
    `---\n标题: 原中文名\ntags:\n  - 甲\n---\n\n# 正文\n`,
    "/Users/test/rename-alias.md",
  );
  await setMode(page, "edit");
  const a = panel(page, "A");
  await expect(a.locator('[data-testid="dpb-title"]')).toHaveText("原中文名");
  await dpbRecord(page, "1232", "02-alias-before");

  await page.locator('[data-tab-id][aria-selected="true"]').dblclick();
  const input = page.locator('[data-testid="tab-title-input"]');
  await expect(input).toBeVisible();
  await input.fill("新中文名");
  await input.press("Enter");
  await expect(input).toHaveCount(0);

  await expect(a.locator('[data-testid="dpb-title"]')).toHaveText("新中文名");
  await expect.poll(async () => docText(page)).toContain("标题: 新中文名");
  const tab = await activeTab(page);
  expect(tab.title).toBe("新中文名.md");
  await dpbRecord(page, "1232", "03-alias-after");

  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "标题: 新中文名",
  );
  await dpbRecord(page, "1232", "04-alias-source");
});

test("模板菜单：通用 / 会议记录 / 需求 三项，A/B 两态可用", async ({
  page,
}) => {
  await newDoc(page);
  const a = panel(page, "A");
  await a.locator('[data-testid="dpb-template"]').click();
  const menu = page.locator('[data-testid="dpb-template-menu"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-testid="dpb-template-option"]')).toHaveCount(
    3,
  );
  await expect(menu.locator('[data-name="通用"]')).toBeVisible();
  await expect(menu.locator('[data-name="会议记录"]')).toBeVisible();
  await expect(menu.locator('[data-name="需求"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  await setVariant(page, "B");
  await panel(page, "B").locator('[data-testid="dpb-template"]').click();
  await expect(page.locator('[data-testid="dpb-template-menu"]')).toBeVisible();
});

const TPL_DOC = `---
title: 会议纪要
status: 已定稿
---

# 正文
`;

test("套用模板只补缺失键：已有 status 不覆盖", async ({ page }) => {
  await openDoc(page, TPL_DOC, "/Users/test/tpl.md");
  await setMode(page, "edit");
  const a = panel(page, "A");
  await a.locator('[data-testid="dpb-template"]').click();
  await page.locator('[data-name="通用"]').click();

  await expect(page.locator('[data-testid="dpb-tpl-status"]')).toContainText(
    "新增 2 个字段",
  );
  await expect(a.locator('[data-key="category"]')).toHaveCount(1);
  await expect(a.locator('[data-key="author"]')).toHaveCount(1);
  await expect(
    a.locator('[data-key="status"] [data-testid="dpb-value"]'),
  ).toHaveText("已定稿");

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText("status: 已定稿");
  await expect(src).toContainText("category: 设计");
});

test("套用模板后 Ctrl+Z 一次撤销整次套用", async ({ page }) => {
  await openDoc(page, TPL_DOC, "/Users/test/tpl.md");
  await setMode(page, "edit");
  const a = panel(page, "A");
  await a.locator('[data-testid="dpb-template"]').click();
  await page.locator('[data-name="通用"]').click();
  await expect(a.locator('[data-key="category"]')).toHaveCount(1);

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Meta+Z");
  await expect(a.locator('[data-key="category"]')).toHaveCount(0);
  await expect(a.locator('[data-key="author"]')).toHaveCount(0);
  await expect(a.locator('[data-key="status"]')).toHaveCount(1);

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).not.toContainText("category");
  await expect(src).toContainText("status: 已定稿");
});

test("套用后源码不写任何模板标记", async ({ page }) => {
  await openDoc(page, TPL_DOC, "/Users/test/tpl.md");
  await setMode(page, "edit");
  const a = panel(page, "A");
  await a.locator('[data-testid="dpb-template"]').click();
  await page.locator('[data-name="需求"]').click();
  await expect(a.locator('[data-key="优先级"]')).toHaveCount(1);

  await setMode(page, "source");
  const text = (await page.locator(".cm-content").first().textContent()) ?? "";
  expect(text).not.toContain("template");
  expect(text).not.toContain("模板");
  expect(text).not.toContain("tpl");
});

test("拖动手柄光标：悬停 grab，拖拽超 5px 切 grabbing，松手恢复 grab", async ({
  page,
}) => {
  const ART = path.resolve(process.cwd(), ".artifacts/1020");
  mkdirSync(ART, { recursive: true });
  const record = async (state: string) => {
    const file = path.join(ART, `${state}.png`);
    await page.screenshot({ path: file });
    writeFileSync(
      path.join(ART, "state-coverage.json"),
      `${JSON.stringify(
        {
          task: "1020-drag-cursor",
          states: [
            "01-b-hover-grab",
            "02-a-hover-grab",
            "03-dragging-grabbing",
            "04-released-grab",
          ].map((s) => ({
            state: s,
            screenshot: path.relative(
              process.cwd(),
              path.join(ART, `${s}.png`),
            ),
            assertion: "passed",
            recorded_at: new Date().toISOString(),
            runner: `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "unknown"}`,
          })),
        },
        null,
        2,
      )}\n`,
    );
  };

  await openDoc(page, ROW_DOC);
  await setMode(page, "edit");

  // B 精排双列：手柄常驻，悬停即 grab
  await setVariant(page, "B");
  const b = panel(page, "B");
  const bHandle = b.locator('[data-key="note"] [data-testid="dpb-row-handle"]');
  await bHandle.hover();
  await expect(bHandle).toHaveCSS("cursor", "grab");
  await record("01-b-hover-grab");

  // A 一行条：手柄 opacity 0，悬停胶囊显现后取光标
  await setVariant(page, "A");
  const aChip = panel(page, "A").locator('[data-key="note"]');
  const aHandle = aChip.locator('[data-testid="dpb-row-handle"]');
  await page.mouse.move(0, 0);
  await expect(aHandle).toHaveCSS("opacity", "0");
  await aChip.hover();
  await expect(aHandle).toHaveCSS("opacity", "1");
  await expect(aHandle).toHaveCSS("cursor", "grab");
  await record("02-a-hover-grab");

  // B：按下并移动超过 5px 阈值 → 面板挂 dpb-dragging → grabbing；松手恢复 grab
  await setVariant(page, "B");
  const handle = b.locator('[data-key="note"] [data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  const x = hb.x + hb.width / 2;
  const y = hb.y + hb.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 20, { steps: 6 });
  await expect(b).toHaveClass(/dpb-dragging/);
  await expect(handle).toHaveCSS("cursor", "grabbing");
  await record("03-dragging-grabbing");
  await page.mouse.up();
  await expect(b).not.toHaveClass(/dpb-dragging/);
  await expect(handle).toHaveCSS("cursor", "grab");
  await record("04-released-grab");
});

test("无 frontmatter 空态：添加字段自动创建 frontmatter 块并出现可改名新行", async ({
  page,
}) => {
  await openDoc(
    page,
    "# 只有正文\n\n没有属性。\n",
    "/Users/test/no-frontmatter.md",
  );
  await setMode(page, "edit");
  const empty = page.locator('[data-testid="dpb-empty"]');
  await expect(empty).toBeVisible();
  await empty.locator('[data-testid="dpb-add-field"]').click();
  await page
    .locator('[data-testid="dpb-palette-item"][data-type="text"]')
    .click();

  await expect(page.locator('[data-testid="dpb-empty"]')).toHaveCount(0);
  const a = panel(page, "A");
  await expect(a.locator('[data-key="new-field"]')).toHaveCount(1);
  await expect(
    a.locator('[data-key="new-field"] [data-testid="dpb-rename-input"]'),
  ).toBeVisible();

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText('title: ""');
  await expect(src).toContainText("created:");
  await expect(src).toContainText("updated:");
  await expect(src).toContainText('new-field: ""');
  await dpbRecord(page, "1018", "01-empty-create-block");
});

test("A 态添加字段：追加空文本行，就地改名并编辑值，一次撤销全部还原", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/add-field-a.md");
  await setMode(page, "edit");
  const a = panel(page, "A");
  const before = await rowKeys(page, "A");

  await a.locator('[data-testid="dpb-add-field"]').click();
  await page
    .locator('[data-testid="dpb-palette-item"][data-type="text"]')
    .click();
  await expect(a.locator('[data-key="new-field"]')).toHaveCount(1);
  const rename = a.locator(
    '[data-key="new-field"] [data-testid="dpb-rename-input"]',
  );
  await expect(rename).toBeVisible();
  await rename.fill("author-x");
  await rename.press("Enter");
  await expect(a.locator('[data-key="author-x"]')).toHaveCount(1);

  const value = a.locator('[data-key="author-x"] [data-testid="dpb-value"]');
  await value.click();
  const input = a.locator('[data-key="author-x"] [data-testid="dpb-input"]');
  await input.fill("李四");
  await input.press("Enter");
  await expect(
    a.locator('[data-key="author-x"] [data-testid="dpb-value"]'),
  ).toHaveText("李四");

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Meta+Z");
  await expect
    .poll(async () => (await rowKeys(page, "A")).join(","))
    .toBe(before.join(","));
  await dpbRecord(page, "1018", "02-a-add-rename-undo");
});

test("B 态底部添加字段：追加空行、改名并同步源码", async ({ page }) => {
  await openDoc(page, ROW_DOC, "/Users/test/add-field-b.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  await expect(b.locator('[data-testid="dpb-add-field"]')).toBeVisible();

  await b.locator('[data-testid="dpb-add-field"]').click();
  await page
    .locator('[data-testid="dpb-palette-item"][data-type="text"]')
    .click();
  await expect(b.locator('[data-key="new-field"]')).toHaveCount(1);
  const rename = b.locator(
    '[data-key="new-field"] [data-testid="dpb-rename-input"]',
  );
  await expect(rename).toBeVisible();
  await rename.fill("author-x");
  await rename.press("Enter");
  await expect(b.locator('[data-key="author-x"]')).toHaveCount(1);

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText("author-x:");
  await dpbRecord(page, "1018", "03-b-add-rename-source");
});

test("添加字段键名去重：连续添加得到 new-field 与 new-field-2", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/add-field-dedupe.md");
  await setMode(page, "edit");
  const a = panel(page, "A");

  await a.locator('[data-testid="dpb-add-field"]').click();
  await page
    .locator('[data-testid="dpb-palette-item"][data-type="text"]')
    .click();
  await expect(a.locator('[data-key="new-field"]')).toHaveCount(1);
  await a.locator('[data-testid="dpb-add-field"]').click();
  await page
    .locator('[data-testid="dpb-palette-item"][data-type="text"]')
    .click();
  await expect(a.locator('[data-key="new-field"]')).toHaveCount(1);
  await expect(a.locator('[data-key="new-field-2"]')).toHaveCount(1);
  await dpbRecord(page, "1018", "04-key-dedupe");
});

test("预览态只读：空态与有 frontmatter 都不出现添加入口", async ({ page }) => {
  await openDoc(page, ROW_DOC, "/Users/test/add-field-preview.md");
  await expect(
    panel(page, "A").locator('[data-testid="dpb-add-field"]'),
  ).toHaveCount(0);
  await setVariant(page, "B");
  await expect(
    panel(page, "B").locator('[data-testid="dpb-add-field"]'),
  ).toHaveCount(0);

  await openDoc(page, "# 只有正文\n", "/Users/test/add-field-preview-empty.md");
  await expect(page.locator('[data-testid="dpb-add-field"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-empty"]')).toBeVisible();
  await dpbRecord(page, "1018", "05-preview-no-entry");
});

test("#1041 控件区展开：点「添加字段」出现八类类型控件", async ({ page }) => {
  await openDoc(page, ROW_DOC, "/Users/test/palette-open.md");
  await setMode(page, "edit");
  const a = panel(page, "A");

  await a.locator('[data-testid="dpb-add-field"]').click();
  const palette = page.locator('[data-testid="dpb-field-palette"]');
  await expect(palette).toBeVisible();
  await expect(palette.locator('[data-testid="dpb-palette-item"]')).toHaveCount(
    8,
  );
  await expect(palette.locator('[data-type="date"]')).toBeVisible();
  await expect(palette.locator('[data-type="text"]')).toBeVisible();
  expect(await rowKeys(page, "A")).toEqual([
    "category",
    "author",
    "source",
    "note",
  ]);
  await dpbRecord(page, "1041", "palette-open");
});

test("#1041 拖入日期控件：落点插入日期类型空字段并进入改名态", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/palette-drop-date.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-testid="dpb-add-field"]').click();
  const item = page.locator(
    '[data-testid="dpb-palette-item"][data-type="date"]',
  );
  const ib = (await item.boundingBox())!;
  const author = (await b.locator('[data-key="author"]').boundingBox())!;

  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    author.x + author.width / 2,
    author.y + author.height * 0.25,
    {
      steps: 8,
    },
  );
  await expect(page.locator('[data-testid="dpb-drag-ghost"]')).toBeVisible();
  await dpbRecord(page, "1041", "dragging-ghost");
  await page.mouse.up();

  await expect(page.locator('[data-testid="dpb-drag-ghost"]')).toHaveCount(0);
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "new-field",
    "author",
    "source",
    "note",
  ]);
  const row = b.locator('[data-key="new-field"]');
  await expect(row.locator('[data-testid="dpb-type"]')).toHaveAttribute(
    "title",
    "日期（点击选择类型）",
  );
  await expect(row.locator('[data-testid="dpb-type"] svg')).toHaveCount(1);
  const rename = row.locator('[data-testid="dpb-rename-input"]');
  await expect(rename).toBeVisible();
  await expect(rename).toBeFocused();
  await dpbRecord(page, "1041", "dropped-typed-field");
});

test("#1041 拖放取消：松手在字段区外不插入、无残留", async ({ page }) => {
  await openDoc(page, ROW_DOC, "/Users/test/palette-cancel.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  const beforeKeys = await rowKeys(page, "B");
  const beforeText = await docText(page);

  await b.locator('[data-testid="dpb-add-field"]').click();
  const item = page.locator(
    '[data-testid="dpb-palette-item"][data-type="date"]',
  );
  const ib = (await item.boundingBox())!;
  const pb = (await b.boundingBox())!;
  const outsideX = Math.max(8, pb.x - 30);
  const outsideY = pb.y + pb.height / 2;

  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(outsideX, outsideY, { steps: 8 });
  await expect(page.locator('[data-testid="dpb-drag-ghost"]')).toBeVisible();
  await page.mouse.up();

  await expect(page.locator('[data-testid="dpb-drag-ghost"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="dpb-drop-line"]')).toHaveCount(0);
  expect(await rowKeys(page, "B")).toEqual(beforeKeys);
  expect(await docText(page)).toBe(beforeText);
  await dpbRecord(page, "1041", "cancelled-no-residue");
});

test("#1041 插入一次撤销：Ctrl+Z 回到插入前 frontmatter（状态往返 + 文本相等）", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/palette-undo.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  const beforeKeys = await rowKeys(page, "B");
  const beforeText = await docText(page);

  await b.locator('[data-testid="dpb-add-field"]').click();
  const item = page.locator(
    '[data-testid="dpb-palette-item"][data-type="date"]',
  );
  const ib = (await item.boundingBox())!;
  const author = (await b.locator('[data-key="author"]').boundingBox())!;
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    author.x + author.width / 2,
    author.y + author.height * 0.25,
    {
      steps: 8,
    },
  );
  await page.mouse.up();
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "new-field",
    "author",
    "source",
    "note",
  ]);

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Meta+Z");
  await expect
    .poll(async () => (await rowKeys(page, "B")).join(","))
    .toBe(beforeKeys.join(","));
  await expect.poll(async () => await docText(page)).toBe(beforeText);
});

test("#1041 键盘可达：聚焦控件 Enter 插入对应类型", async ({ page }) => {
  await openDoc(page, ROW_DOC, "/Users/test/palette-keyboard.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-testid="dpb-add-field"]').click();
  const item = page.locator(
    '[data-testid="dpb-palette-item"][data-type="select"]',
  );
  await item.focus();
  await page.keyboard.press("Enter");

  const row = b.locator('[data-key="new-field"]');
  await expect(row).toHaveCount(1);
  await expect(row.locator('[data-testid="dpb-type"]')).toHaveAttribute(
    "title",
    "下拉（点击选择类型）",
  );
});

test("#1041 窄宽可视：400px 视口控件区完整落在视口内", async ({ page }) => {
  await openDoc(page, ROW_DOC, "/Users/test/palette-narrow.md");
  await setMode(page, "edit");
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(150);
  // 窄窗自动胶囊（#1129）：此处应只有 B 面板可见。
  const a = page.locator('[data-testid="dpb-a"], [data-testid="dpb-b"]');

  await a.locator('[data-testid="dpb-add-field"]').click();
  const box = (await page
    .locator('[data-testid="dpb-field-palette"]')
    .boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(400 + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(800 + 0.5);
  await expect(page.locator('[data-testid="dpb-palette-item"]')).toHaveCount(8);
});

test("#1019 编辑态面板展开隐藏 frontmatter 整块，折叠在正文流内呈现折叠条", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  const cm = page.locator(".cm-content").first();

  // 展开：正文顶部不再出现 --- 源码块
  await expect(cm).not.toContainText("title:");
  await expect(cm).not.toContainText("---");
  await dpbRecord(page, "1019", "01-edit-expanded-hidden");

  // 折叠：折叠条位于正文流内（原 frontmatter 位置），正文不再出现摘要标签
  await page.locator('[data-testid="dpb-collapse"]').click();
  await expect(page.locator(".cm-content > .cm-dpb-embed")).toHaveCount(1);
  await expect(page.locator(".cm-fmh-summary")).toHaveCount(0);
  await expect(cm).not.toContainText("title:");
  await expect(
    page.locator('.cm-dpb-embed [data-testid="dpb-a"] .dpb-a-summary'),
  ).toContainText("已折叠");
  await dpbRecord(page, "1019", "02-collapsed-bar-in-body");

  // 展开：回到完整卡片
  await page.locator('[data-testid="dpb-collapse"]').click();
  await expect(
    page.locator('.cm-dpb-embed [data-testid="dpb-a"] .dpb-a-summary'),
  ).toHaveCount(0);
  await expect(cm).not.toContainText("title:");
  await dpbRecord(page, "1019", "03-expanded-restored");
});

test("#1019 ⌘⇧Y 隐藏面板与切源码态均恢复完整 YAML", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const cm = page.locator(".cm-content").first();
  await expect(cm).not.toContainText("title:");

  await page.keyboard.press("Meta+Shift+Y");
  await expect(page.locator(".cm-fmh-summary")).toHaveCount(0);
  await expect(cm).toContainText("title:");
  await expect(cm).toContainText("count: 1234567");
  await dpbRecord(page, "1019", "03-panel-hidden-yaml-restored");

  await setMode(page, "source");
  await expect(cm).toContainText("title:");
  await expect(cm).toContainText("---");
  await dpbRecord(page, "1019", "04-source-yaml-visible");
});

test("#1019 源码态光标留在 frontmatter 内，切回编辑态仍隐藏整块", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "source");
  const cm = page.locator(".cm-content").first();
  await cm.locator(".cm-line").nth(1).click();

  await setMode(page, "edit");
  await expect(cm).not.toContainText("title:");
  await expect(cm).not.toContainText("---");
  await dpbRecord(page, "1019", "05-source-caret-edit-hidden");
});

test("#1039 胶囊 DOM 顺序：类型图标→字段名→值→叉号（A/B，类型文字已移除）", async ({
  page,
}) => {
  await openDoc(page, CAPSULE_DOC);
  await setMode(page, "edit");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const row = panel(page, variant).locator('[data-key="score"]');
    const sels = [
      ".dpb-type",
      '[data-testid="dpb-label"]',
      '[data-testid="dpb-value"]',
      '[data-testid="dpb-row-del"]',
    ];
    const nodes = await row.evaluate(
      (el, sels) => sels.map((s) => el.querySelector(s)),
      sels,
    );
    for (const n of nodes) {
      expect(n, `${variant} 胶囊缺节点`).not.toBeNull();
    }
    const ordered = await row.evaluate((el, sels) => {
      const list = sels
        .map((s) => el.querySelector(s))
        .filter(Boolean) as Element[];
      return list.every(
        (n, i) =>
          i === 0 ||
          (list[i - 1].compareDocumentPosition(n) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
            0,
      );
    }, sels);
    expect(ordered, `${variant} 胶囊 DOM 顺序`).toBe(true);
    await expect(row.locator(".dpb-type-label")).toHaveCount(0);
    await expect(row.locator('[data-testid="dpb-type"]')).toHaveAttribute(
      "title",
      /数字/,
    );
    await dpbRecord(
      page,
      "1039",
      variant === "A" ? "01-capsule-a" : "02-capsule-b",
    );
  }
});

test("#1039 字段名输入框单行高度：长名不撑高输入框与行（A/B）", async ({
  page,
}) => {
  await openDoc(page, CAPSULE_DOC);
  await setMode(page, "edit");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const row = panel(page, variant).locator('[data-key="score"]');
    await row.locator('[data-testid="dpb-label"]').click();
    const input = row.locator('[data-testid="dpb-rename-input"]');
    await expect(input).toBeVisible();
    const before = await input.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    }));
    expect(before.clientHeight).toBeLessThanOrEqual(before.fontSize * 2);
    expect(before.scrollHeight).toBeLessThanOrEqual(before.clientHeight + 1);
    const rowBefore = (await row.boundingBox())!.height;
    await input.fill("超长字段名".repeat(12));
    const after = await input.evaluate((el) => el.clientHeight);
    expect(after, "输入框高度随内容变化").toBe(before.clientHeight);
    expect((await row.boundingBox())!.height, "行高随字段名变化").toBe(
      rowBefore,
    );
  }
});

test("#1039 空值字段值节点无 — 占位（A/B）", async ({ page }) => {
  await openDoc(page, CAPSULE_DOC);
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const value = panel(page, variant).locator(
      '[data-key="note"] [data-testid="dpb-value"]',
    );
    await expect(value).toHaveCount(1);
    expect((await value.textContent())?.trim()).toBe("");
    await expect(value).not.toContainText("—");
    if (variant === "A") {
      await dpbRecord(page, "1039", "03-empty-value-no-placeholder");
    }
  }
});

test("#1039 行尾删除为叉号（关闭语义）非垃圾桶（A/B）", async ({ page }) => {
  await openDoc(page, CAPSULE_DOC);
  await setMode(page, "edit");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const row = panel(page, variant).locator('[data-key="score"]');
    const del = row.locator('[data-testid="dpb-row-del"]');
    await expect(del).toHaveCount(1);
    await expect(del.locator("svg")).toHaveAttribute("data-icon", "close");
    await expect(row.locator('[data-icon="trash"]')).toHaveCount(0);
  }
});

test("#1039 托管日期只读：无字段行 / 无删除改名入口，footer 带注册表锁图标（A/B）", async ({
  page,
}) => {
  await openDoc(page, CAPSULE_DOC);
  await setMode(page, "edit");
  for (const variant of ["A", "B"] as const) {
    await setVariant(page, variant);
    const p = panel(page, variant);
    const foot = p.locator(variant === "A" ? ".dpb-a-foot" : ".dpb-b-foot");
    for (const key of ["created", "updated"]) {
      await expect(
        p.locator(`[data-testid="dpb-row"][data-key="${key}"]`),
      ).toHaveCount(0);
      await expect(
        p.locator(`[data-key="${key}"] [data-testid="dpb-row-del"]`),
      ).toHaveCount(0);
      await expect(
        p.locator(`[data-key="${key}"] [data-testid="dpb-label"]`),
      ).toHaveCount(0);
    }
    await expect(foot.locator(".dpb-lock")).toHaveCount(1);
    await expect(foot.locator('[data-icon="lock"]')).toHaveCount(1);
    await expect(foot.locator('[data-testid="dpb-managed-date"]')).toHaveCount(
      2,
    );
    if (variant === "A") {
      await dpbRecord(page, "1039", "04-locked-row");
    }
  }
});

test("#1260 头部按钮居中、footer 顺序/对齐/弱化、L-T 图标、全选图标、折叠条淡出", async ({
  page,
}) => {
  const doc = `---\ntitle: 头部\nstatus: 阅读中\ncreated: 2026-11-14\nupdated: 2026-11-15\n---\n\n# 正文\n`;
  await openDoc(page, doc, "/Users/test/chrome.md");
  await setMode(page, "edit");
  await setVariant(page, "B");
  const b = panel(page, "B");
  const dateEl = b.locator('[data-testid="dpb-managed-dates"]');
  const countEl = b.locator('[data-testid="dpb-count"]');
  await expect(dateEl).toHaveCount(1);
  await expect(countEl).toHaveText("2 个字段");
  const order = await b
    .locator(".dpb-b-foot > *")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
  expect(order[0]).toBe("dpb-count");
  const countLeft = await countEl.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left + parseFloat(getComputedStyle(el).paddingLeft || "0");
  });
  const typeBox = (await b
    .locator('[data-key="status"] [data-testid="dpb-type"]')
    .boundingBox())!;
  expect(Math.abs(countLeft - typeBox.x)).toBeLessThanOrEqual(2);
  const lock = b.locator(".dpb-lock").first();
  expect(await lock.getAttribute("width")).toBe("12");

  const tools = b.locator('[data-testid="dpb-tools"]');
  const centers = await tools.locator("button").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return r.top + r.height / 2;
    }),
  );
  expect(centers.length).toBeGreaterThan(0);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  await expect(tools.locator('[data-testid="dpb-select-all"] svg')).toHaveCount(
    1,
  );
  await dpbRecord(page, "1260", "01-b-chrome");

  await setVariant(page, "A");
  const a = panel(page, "A");
  const aOrder = await a
    .locator(".dpb-a-foot > *")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
  expect(aOrder[0]).toBe("dpb-count");
  const aTools = a.locator('[data-testid="dpb-tools"]');
  const aCenters = await aTools.locator("button").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return r.top + r.height / 2;
    }),
  );
  expect(aCenters.length).toBeGreaterThan(0);
  expect(Math.max(...aCenters) - Math.min(...aCenters)).toBeLessThanOrEqual(1);
  await dpbRecord(page, "1260", "02-a-footer-order");

  await a.locator('[data-testid="dpb-collapse"]').click();
  await page.mouse.move(4, 4);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect(a.getByText(/个字段/)).toHaveCount(1);
  const opacity = () =>
    a.evaluate((el) => Number(getComputedStyle(el).opacity));
  await expect.poll(opacity, { timeout: 3000 }).toBeLessThan(0.5);
  await dpbRecord(page, "1260", "03-collapsed-faded");
  await a.hover({ position: { x: 10, y: 10 } });
  await expect.poll(opacity, { timeout: 3000 }).toBeGreaterThan(0.9);
  await dpbRecord(page, "1260", "04-collapsed-hover");
});

test("#1261 字段行：去类型文字、垂直居中、文本值满行、字号随正文、删除悬停", async ({
  page,
}) => {
  const doc = `---\ntitle: 行布局\nnote: 文本值\ncount: 42\n---\n\n# 正文\n`;
  await openDoc(page, doc, "/Users/test/row-layout.md");
  await setMode(page, "edit");
  await setVariant(page, "A");
  const a = panel(page, "A");
  await expect(a.locator(".dpb-type-label")).toHaveCount(0);
  await dpbRecord(page, "1261", "01-no-type-text");

  const center = async (loc: ReturnType<typeof a.locator>) => {
    const b = (await loc.boundingBox())!;
    return b.y + b.height / 2;
  };
  const chip = a.locator('[data-key="note"]');
  const centers = await Promise.all([
    center(chip.locator(".dpb-type")),
    center(chip.locator('[data-testid="dpb-label"]')),
    center(chip.locator('[data-testid="dpb-value"]')),
  ]);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  await dpbRecord(page, "1261", "02-centered");

  const fontOf = (loc: ReturnType<typeof a.locator>) =>
    loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const nameSize = await fontOf(chip.locator('[data-testid="dpb-label"]'));
  const valueSize = await fontOf(chip.locator('[data-testid="dpb-value"]'));
  expect(nameSize).toBe(valueSize);
  expect(
    await chip
      .locator('[data-testid="dpb-value"]')
      .evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe("400");
  const titleSize = await fontOf(a.locator(".dpb-a-title"));
  expect(titleSize).toBe(17);
  await page.keyboard.press("Meta+-");
  await expect
    .poll(() => fontOf(chip.locator('[data-testid="dpb-label"]')), {
      timeout: 3000,
    })
    .toBeLessThan(nameSize);
  expect(await fontOf(chip.locator('[data-testid="dpb-value"]'))).toBe(
    await fontOf(chip.locator('[data-testid="dpb-label"]')),
  );
  expect(await fontOf(a.locator(".dpb-a-title"))).toBe(titleSize);
  await dpbRecord(page, "1261", "03-font-sync");

  await setVariant(page, "B");
  const b = panel(page, "B");
  const noteRow = b.locator('[data-key="note"]');
  const bNameSize = await noteRow
    .locator('[data-testid="dpb-label"]')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const bValueSize = await noteRow
    .locator('[data-testid="dpb-value"]')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(bNameSize).toBe(bValueSize);
  expect(
    await noteRow
      .locator('[data-testid="dpb-value"]')
      .evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe("400");
  await noteRow.locator('[data-testid="dpb-value"]').click();
  const input = noteRow.locator('[data-testid="dpb-input"]');
  const inputBox = (await input.boundingBox())!;
  const cellBox = (await noteRow.locator(".dpb-b-value").boundingBox())!;
  expect(Math.abs(inputBox.width - cellBox.width)).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");

  const countRow = b.locator('[data-key="count"]');
  await countRow.locator('[data-testid="dpb-value"]').click();
  const numBox = (await countRow
    .locator('[data-testid="dpb-input"]')
    .boundingBox())!;
  const numCell = (await countRow.locator(".dpb-b-value").boundingBox())!;
  expect(numBox.width).toBeLessThan(numCell.width - 20);
  await page.keyboard.press("Escape");

  const del = noteRow.locator('[data-testid="dpb-row-del"]');
  const opacity = () =>
    del.evaluate((el) => Number(getComputedStyle(el).opacity));
  await page.mouse.move(4, 4);
  await expect.poll(opacity, { timeout: 2000 }).toBe(0);
  await noteRow.hover();
  await expect.poll(opacity, { timeout: 2000 }).toBe(1);
  await dpbRecord(page, "1261", "04-delete-hover");
});

test("#1043 新建字段按钮位次：A/B 均为首位，按钮顺序一致（#1260 改规格）", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC, "/Users/test/add-field-order.md");
  await setMode(page, "edit");

  const orderOf = (variant: "A" | "B") =>
    panel(page, variant)
      .locator('[data-testid="dpb-tools"] > *')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute("data-testid") ?? ""),
      );

  await setVariant(page, "B");
  const bOrder = await orderOf("B");
  expect(bOrder[0], "B 模式添加字段应为按钮区首位").toBe("dpb-add-field");
  await dpbRecord(page, "1043", "01-b-add-first");

  await setVariant(page, "A");
  const aOrder = await orderOf("A");
  expect(aOrder[0], "A 模式添加字段应为按钮区首位").toBe("dpb-add-field");
  await dpbRecord(page, "1043", "02-a-add-first");

  // A-5.2：两态按钮顺序完全一致
  expect(aOrder).toEqual(bOrder);

  // 往返切换无残留 / 无重复节点
  await setVariant(page, "B");
  const bAgain = await orderOf("B");
  expect(bAgain).toEqual(bOrder);
  expect(bAgain.filter((t) => t === "dpb-add-field")).toHaveLength(1);
  await dpbRecord(page, "1043", "03-b-again-first");

  await setVariant(page, "A");
  const aAgain = await orderOf("A");
  expect(aAgain).toEqual(aOrder);
  expect(aAgain.filter((t) => t === "dpb-add-field")).toHaveLength(1);
  await dpbRecord(page, "1043", "04-a-again-last");

  // 调色板仍锚定按钮新位置
  await setVariant(page, "B");
  await panel(page, "B").locator('[data-testid="dpb-add-field"]').click();
  await expect(page.locator('[data-testid="dpb-field-palette"]')).toBeVisible();
  await page.keyboard.press("Escape");
});

const ROW_DOC_MANAGED = `---
title: 行操作
category: 草稿
author: 张三
source: 网络
note: 备注
created: 2026-11-17
updated: 2026-11-17
---

# 正文
`;

test("#1245 托管日期文档 B 态拖拽：顺序改动不再被抹掉", async ({ page }) => {
  await openDoc(page, ROW_DOC_MANAGED, "/Users/test/managed-drag-b.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");
  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "author",
    "source",
    "note",
  ]);

  const handle = b.locator(
    '[data-key="source"] [data-testid="dpb-row-handle"]',
  );
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  const cat = (await b.locator('[data-key="category"]').boundingBox())!;
  await page.mouse.move(cat.x + cat.width / 2, cat.y + cat.height * 0.75, {
    steps: 8,
  });
  await expect(page.locator('[data-testid="dpb-drop-line"]')).toBeVisible();
  await dpbRecord(page, "1245", "01-b-managed-drag-over");
  await page.mouse.up();
  await expect(page.locator('[data-testid="dpb-drop-line"]')).toHaveCount(0);

  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "source",
    "author",
    "note",
  ]);
  await expect
    .poll(async () => (await frontmatterKeys(page)).join(","))
    .toBe("title,category,source,author,note,created,updated");
  await dpbRecord(page, "1245", "02-b-managed-drag-result");
});

test("#1245 托管日期文档 A 态拖拽：中间落点顺序改动不再被抹掉", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC_MANAGED, "/Users/test/managed-drag-a.md");
  await setVariant(page, "A");
  await setMode(page, "edit");
  const a = panel(page, "A");
  expect(await rowKeys(page, "A")).toEqual([
    "category",
    "author",
    "source",
    "note",
  ]);

  const chip = a.locator('[data-key="note"]');
  await chip.hover();
  const handle = chip.locator('[data-testid="dpb-row-handle"]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 12, {
    steps: 3,
  });
  const author = (await a.locator('[data-key="author"]').boundingBox())!;
  await page.mouse.move(
    author.x + author.width * 0.75,
    author.y + author.height * 0.75,
    { steps: 8 },
  );
  await expect(page.locator('[data-testid="dpb-drop-line"]')).toBeVisible();
  await dpbRecord(page, "1245", "03-a-managed-drag-over");
  await page.mouse.up();

  expect(await rowKeys(page, "A")).toEqual([
    "category",
    "author",
    "note",
    "source",
  ]);
  await expect
    .poll(async () => (await frontmatterKeys(page)).join(","))
    .toBe("title,category,author,note,source,created,updated");
  await dpbRecord(page, "1245", "04-a-managed-drag-result");
});

test("#1245 托管日期文档调色板：拖到中间行插入而非追加到末尾", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC_MANAGED, "/Users/test/managed-palette-middle.md");
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-testid="dpb-add-field"]').click();
  const item = page.locator(
    '[data-testid="dpb-palette-item"][data-type="date"]',
  );
  const ib = (await item.boundingBox())!;
  const author = (await b.locator('[data-key="author"]').boundingBox())!;
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    author.x + author.width / 2,
    author.y + author.height * 0.25,
    { steps: 8 },
  );
  await expect(page.locator('[data-testid="dpb-drag-ghost"]')).toBeVisible();
  await dpbRecord(page, "1245", "05-palette-middle-over");
  await page.mouse.up();

  expect(await rowKeys(page, "B")).toEqual([
    "title",
    "category",
    "new-field",
    "author",
    "source",
    "note",
  ]);
  await expect
    .poll(async () => (await frontmatterKeys(page)).join(","))
    .toBe("title,category,new-field,author,source,note,created,updated");
  await dpbRecord(page, "1245", "06-palette-middle-result");
});

test("O3 控件悬停显隐：标签叉号 / 形态切换 / 折叠按钮默认透明，悬停或聚焦显现", async ({
  page,
}) => {
  const doc = `---\ntitle: 悬停显隐\ntags:\n  - 甲\nstatus: 阅读中\n---\n\n# 正文\n`;
  await openDoc(page, doc, "/Users/test/o3-reveal.md");
  await setMode(page, "edit");
  await setVariant(page, "B");
  const b = panel(page, "B");
  await page.mouse.move(4, 4);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  const opacityOf = (loc: ReturnType<typeof b.locator>) =>
    loc.evaluate((el) => Number(getComputedStyle(el).opacity));
  const widthOf = async (loc: ReturnType<typeof b.locator>) =>
    (await loc.boundingBox())!.width;

  const tag = b.locator(".dpb-tag").first();
  const tagX = b.locator('[data-testid="dpb-tag-x"]').first();
  const variant = b.locator('[data-testid="dpb-variant-toggle"]');
  const collapse = b.locator('[data-testid="dpb-collapse"]');

  await expect.poll(() => opacityOf(tagX), { timeout: 2000 }).toBe(0);
  await expect.poll(() => opacityOf(variant), { timeout: 2000 }).toBe(0);
  await expect.poll(() => opacityOf(collapse), { timeout: 2000 }).toBe(0);

  const tagXWidth = await widthOf(tagX);
  const variantWidth = await widthOf(variant);
  const collapseWidth = await widthOf(collapse);

  await tag.hover();
  await expect.poll(() => opacityOf(tagX), { timeout: 2000 }).toBe(1);
  expect(await widthOf(tagX)).toBe(tagXWidth);
  await page.mouse.move(4, 4);
  await expect.poll(() => opacityOf(tagX), { timeout: 2000 }).toBe(0);

  await b.hover();
  await expect.poll(() => opacityOf(variant), { timeout: 2000 }).toBe(1);
  await expect.poll(() => opacityOf(collapse), { timeout: 2000 }).toBe(1);
  expect(await widthOf(variant)).toBe(variantWidth);
  expect(await widthOf(collapse)).toBe(collapseWidth);
  await page.mouse.move(4, 4);
  await expect.poll(() => opacityOf(variant), { timeout: 2000 }).toBe(0);
  await expect.poll(() => opacityOf(collapse), { timeout: 2000 }).toBe(0);

  await tagX.focus();
  await expect.poll(() => opacityOf(tagX), { timeout: 2000 }).toBe(1);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect.poll(() => opacityOf(tagX), { timeout: 2000 }).toBe(0);

  await variant.focus();
  await expect.poll(() => opacityOf(variant), { timeout: 2000 }).toBe(1);
  await expect.poll(() => opacityOf(collapse), { timeout: 2000 }).toBe(1);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect.poll(() => opacityOf(variant), { timeout: 2000 }).toBe(0);
  await dpbRecord(page, "o3", "01-hover-reveal");
});

test("O4 折叠全透明：折叠态计算 opacity 0，悬停 / 聚焦恢复 1，高度不变", async ({
  page,
}) => {
  const doc = `---\ntitle: 折叠透明\nstatus: 阅读中\n---\n\n# 正文\n`;
  await openDoc(page, doc, "/Users/test/o4-collapsed.md");
  await setMode(page, "edit");
  await setVariant(page, "B");
  const b = panel(page, "B");
  await b.locator('[data-testid="dpb-collapse"]').click();
  await expect(b.locator(".dpb-b-body")).toHaveCount(0);
  await page.mouse.move(4, 4);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  const opacity = () =>
    b.evaluate((el) => Number(getComputedStyle(el).opacity));
  const height = async () => (await b.boundingBox())!.height;

  await expect.poll(opacity, { timeout: 2000 }).toBe(0);
  const collapsedHeight = await height();

  await b.hover();
  await expect.poll(opacity, { timeout: 2000 }).toBe(1);
  expect(await height()).toBe(collapsedHeight);

  await page.mouse.move(4, 4);
  await expect.poll(opacity, { timeout: 2000 }).toBe(0);

  await b.locator('[data-testid="dpb-collapse"]').focus();
  await expect.poll(opacity, { timeout: 2000 }).toBe(1);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await dpbRecord(page, "o4", "01-collapsed-transparent");
});

test("O5 footer 收敛：垂直内距收窄 + 预览计数胶囊、编辑态纯文本", async ({
  page,
}) => {
  const doc = `---\ntitle: footer 收敛\nstatus: 阅读中\ncreated: 2026-11-14\nupdated: 2026-11-15\n---\n\n# 正文\n`;
  await openDoc(page, doc, "/Users/test/o5-footer.md");

  await setMode(page, "edit");
  await setVariant(page, "B");
  const b = panel(page, "B");
  const bFoot = b.locator(".dpb-b-foot");
  const bCount = bFoot.locator('[data-testid="dpb-count"]');
  expect(
    await bFoot.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
  ).toBeLessThanOrEqual(4);
  expect(
    await bCount.evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe("0px");
  const bCountBox = (await bCount.boundingBox())!;
  const bDateBox = (await bFoot
    .locator('[data-testid="dpb-managed-dates"]')
    .boundingBox())!;
  expect(bCountBox.x).toBeLessThan(bDateBox.x);
  await dpbRecord(page, "o5", "01-b-edit-plain");

  await setVariant(page, "A");
  const a = panel(page, "A");
  const aFoot = a.locator(".dpb-a-foot");
  const aCount = aFoot.locator('[data-testid="dpb-count"]');
  expect(
    await aFoot.evaluate((el) => parseFloat(getComputedStyle(el).marginTop)),
  ).toBeLessThanOrEqual(4);
  expect(
    await aCount.evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe("0px");
  await dpbRecord(page, "o5", "02-a-edit-plain");

  await setMode(page, "preview");
  await setVariant(page, "B");
  const pb = panel(page, "B");
  const pbFoot = pb.locator(".dpb-b-foot");
  const pbCount = pbFoot.locator('[data-testid="dpb-count"]');
  const pbRadius = await pbCount.evaluate((el) =>
    parseFloat(getComputedStyle(el).borderTopLeftRadius),
  );
  const pbBg = await pbCount.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(pbRadius).toBeGreaterThan(0);
  expect(pbBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(pbBg).not.toBe("transparent");
  expect(
    await pbCount.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopWidth),
    ),
  ).toBeGreaterThan(0);
  const pbCountBox = (await pbCount.boundingBox())!;
  const pbFootBox = (await pbFoot.boundingBox())!;
  expect(Math.abs(pbCountBox.x - pbFootBox.x)).toBeLessThanOrEqual(1);
  await dpbRecord(page, "o5", "03-b-preview-pill");

  await setVariant(page, "A");
  const pa = panel(page, "A");
  const paFoot = pa.locator(".dpb-a-foot");
  const paCount = paFoot.locator('[data-testid="dpb-count"]');
  expect(
    await paCount.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius),
    ),
  ).toBeGreaterThan(0);
  const paCountBox = (await paCount.boundingBox())!;
  const paFootBox = (await paFoot.boundingBox())!;
  expect(Math.abs(paCountBox.x - paFootBox.x)).toBeLessThanOrEqual(1);
  await dpbRecord(page, "o5", "04-a-preview-pill");
});
