import { test, expect, type Page } from "@playwright/test";

/**
 * 文档属性面板首通（#973 / P-1、P-10）真实浏览器用例。
 *
 * 走 e2e/mocks/tauri-mock.js：`__biaoyue_openFile__` 注入文档，
 * `__biaoyue_doc_property__` 切换显示样式。断言落到计算样式与文本，
 * 不停留在「元素存在」。
 */

const APP_URL = "http://localhost:1420";

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

  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(5);
  await expect(
    a.locator('[data-key="count"] [data-testid="dpb-value"]'),
  ).toHaveText("1,234,567");
  await expect(a.locator('[data-key="published"] .dpb-bool-on')).toHaveText(
    "◉ 开",
  );
  await expect(a.locator('[data-key="tags"] .dpb-tag')).toHaveCount(2);
  await expect(a.locator('[data-key="tags"] .dpb-tag').first()).toHaveText(
    "甲",
  );

  // 预览态没有任何编辑入口
  await expect(a.locator('[data-testid="dpb-collapse"]')).toHaveCount(0);
  await expect(a.locator(".dpb-row-handle")).toHaveCount(0);
  await expect(a.locator("button")).toHaveCount(0);
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
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(5);

  await page.locator('[data-testid="dpb-collapse"]').click();
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(0);
  await expect(a.locator(".dpb-a-summary")).toContainText("已折叠");

  await setMode(page, "source");
  await setMode(page, "edit");
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(0);
  await expect(a.locator(".dpb-a-summary")).toBeVisible();

  await page.locator('[data-testid="dpb-collapse"]').click();
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(5);
});

test("A 编辑态：手柄悬出于胶囊左外侧且不占布局，胶囊列间距 16px", async ({
  page,
}) => {
  await openDoc(page);
  await setMode(page, "edit");
  const chips = panel(page, "A").locator(".dpb-chip");
  await expect(chips).toHaveCount(5);

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
  await expect(rows).toHaveCount(6);

  const tracks = await rows.first().evaluate((el) => {
    const v = getComputedStyle(el).gridTemplateColumns;
    return v.split(/\s+/).filter(Boolean);
  });
  expect(tracks).toHaveLength(5);
  expect(parseFloat(tracks[0])).toBeCloseTo(16, 1);
  expect(parseFloat(tracks[1])).toBeCloseTo(30, 1);
  expect(parseFloat(tracks[2])).toBeCloseTo(92, 1);
  expect(parseFloat(tracks[4])).toBeCloseTo(18, 1);

  // 预览态每行都有静态类型图标（svg 或字符）
  const iconCount = await b.locator(".dpb-b-type > *").count();
  expect(iconCount).toBe(6);

  await expect(b.locator('[data-testid="dpb-count"]')).toHaveText("6 个字段");
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
  await expect(b.locator('[data-testid="dpb-row"]')).toHaveCount(6);
  await expect(
    b.locator('[data-key="count"] [data-testid="dpb-value"]'),
  ).toHaveText("1,234,567");
});

test("编辑态默认档：折叠与隐藏按模式生效", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const a = panel(page, "A");
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(5);

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

test("自动托管日期只读锁定：A/B 两态均有锁定标记且无编辑入口", async ({
  page,
}) => {
  await openDoc(page);
  const a = panel(page, "A");
  for (const key of ["created", "updated"]) {
    await expect(
      a.locator(`[data-key="${key}"][data-locked="true"]`),
    ).toHaveCount(1);
    await expect(a.locator(`[data-key="${key}"] .dpb-lock`)).toHaveCount(1);
    await expect(
      a.locator(`[data-key="${key}"] [data-testid="dpb-value"]`),
    ).toBeVisible();
  }
  await expect(a.locator('[data-key="count"][data-locked]')).toHaveCount(0);
  await expect(a.locator("button")).toHaveCount(0);

  await setVariant(page, "B");
  const b = panel(page, "B");
  for (const key of ["created", "updated"]) {
    await expect(
      b.locator(`[data-key="${key}"][data-locked="true"]`),
    ).toHaveCount(1);
    await expect(
      b.locator(`[data-key="${key}"] .dpb-b-x .dpb-lock`),
    ).toHaveCount(1);
  }
  await expect(b.locator('[data-key="count"][data-locked]')).toHaveCount(0);
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
  const input = row.locator('[data-testid="dpb-input"]');
  await expect(input).toHaveJSProperty("type", "date");
  await input.fill("2026-11-16");
  await input.press("Enter");

  await setMode(page, "source");
  await expect(page.locator(".cm-content").first()).toContainText(
    "author: 2026-11-16",
  );
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

test("未识别键「?」收编：选「下拉」后原值保留为当前值", async ({ page }) => {
  await openDoc(page, ADOPT_DOC);
  await setMode(page, "edit");
  const row = panel(page, "A").locator('[data-key="priority"]');
  await expect(row.locator('[data-testid="dpb-type"] .dpb-ico')).toHaveText(
    "?",
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

test("创建 / 修改日期键名锁定：无改名入口", async ({ page }) => {
  await openDoc(page);
  await setMode(page, "edit");
  const a = panel(page, "A");
  for (const key of ["created", "updated"]) {
    const label = a.locator(`[data-key="${key}"] [data-testid="dpb-label"]`);
    await expect(label).toHaveAttribute("data-renameable", "false");
    await expect(label).not.toHaveAttribute("role", "button");
  }
  await expect(
    a.locator('[data-key="count"] [data-testid="dpb-label"]'),
  ).toHaveAttribute("data-renameable", "true");
});
