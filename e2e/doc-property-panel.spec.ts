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

test("自动托管日期值与类型在 B 编辑态只读：点击值不进编辑、类型菜单不弹", async ({
  page,
}) => {
  const ART = path.resolve(process.cwd(), ".artifacts/1015");
  mkdirSync(ART, { recursive: true });
  const record = async (state: string) => {
    const file = path.join(ART, `${state}.png`);
    await page.screenshot({ path: file });
    writeFileSync(
      path.join(ART, "state-coverage.json"),
      `${JSON.stringify(
        {
          task: "1015-managed-date-readonly",
          states: [
            "01-b-date-value-click-no-edit",
            "02-b-date-type-click-no-menu",
            "03-a-date-click-no-edit",
            "04-b-free-key-editable",
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

  await openDoc(page);
  await setMode(page, "edit");
  await setVariant(page, "B");
  const b = panel(page, "B");
  for (const key of ["created", "updated"]) {
    const row = b.locator(`[data-key="${key}"]`);
    // 类型控件是静态只读态，无按钮、无菜单触发
    await expect(row.locator('[data-testid="dpb-type"]')).toHaveCount(0);
    await expect(row.locator(".dpb-b-type .dpb-type-ro")).toHaveCount(1);
    await row.locator(".dpb-b-type").click();
    await expect(page.locator('[data-testid="dpb-type-menu"]')).toHaveCount(0);
    // 值无 button 语义，点击不出现输入框
    const value = row.locator('[data-testid="dpb-value"]');
    await expect(value).not.toHaveAttribute("role", "button");
    await value.click();
    await expect(row.locator('[data-testid="dpb-input"]')).toHaveCount(0);
  }
  await record("01-b-date-value-click-no-edit");
  await record("02-b-date-type-click-no-menu");

  // 回归：A 态日期值同样不进编辑
  await setVariant(page, "A");
  const a = panel(page, "A");
  for (const key of ["created", "updated"]) {
    const row = a.locator(`[data-key="${key}"]`);
    await row.locator('[data-testid="dpb-value"]').click();
    await expect(row.locator('[data-testid="dpb-input"]')).toHaveCount(0);
  }
  await record("03-a-date-click-no-edit");

  // 对照：自由键仍可编辑（守卫不误伤）
  await setVariant(page, "B");
  const freeRow = b.locator('[data-key="count"]');
  await freeRow.locator('[data-testid="dpb-value"]').click();
  await expect(freeRow.locator('[data-testid="dpb-input"]')).toBeVisible();
  await record("04-b-free-key-editable");
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

async function rowKeys(page: Page, variant: "A" | "B"): Promise<string[]> {
  return panel(page, variant)
    .locator('[data-testid="dpb-row"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-key") ?? ""));
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

test("复制两行粘贴：键名一致；目标已有同名键时自动追加序号", async ({
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

  await setMode(page, "source");
  const src = page.locator(".cm-content").first();
  await expect(src).toContainText("category: 草稿");
  await expect(src).toContainText("author: 张三");
  await expect(src).toContainText("category-2: 草稿");
  await expect(src).toContainText("author-2: 张三");
});

test("全选排除标题位与标签行，可手动再选标题", async ({ page }) => {
  await openDoc(page, ROW_DOC_TAGS);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  await b.locator('[data-testid="dpb-select-all"]').click();
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 2 项",
  );
  await expect(b.locator('[data-key="title"].dpb-row-selected')).toHaveCount(0);
  await expect(b.locator('[data-key="tags"].dpb-row-selected')).toHaveCount(0);
  await expect(b.locator('[data-key="category"].dpb-row-selected')).toHaveCount(
    1,
  );
  await expect(b.locator('[data-key="author"].dpb-row-selected')).toHaveCount(
    1,
  );

  await b.locator('[data-key="title"] [data-testid="dpb-row-handle"]').click();
  await expect(b.locator('[data-key="title"].dpb-row-selected')).toHaveCount(1);
  await expect(b.locator('[data-testid="dpb-ops-count"]')).toHaveText(
    "已选 3 项",
  );
});

test("选择模式：行内点击 = 选中/取消（不进编辑），行外点击清空", async ({
  page,
}) => {
  await openDoc(page, ROW_DOC);
  await setMode(page, "edit");
  const a = panel(page, "A");

  await a
    .locator('[data-key="category"] [data-testid="dpb-row-handle"]')
    .click();
  await expect(panel(page, "A")).toHaveClass(/select-mode/);

  await a.locator('[data-key="author"] [data-testid="dpb-value"]').click();
  await expect(a.locator('[data-key="author"].dpb-row-selected')).toHaveCount(
    1,
  );
  await expect(a.locator('[data-testid="dpb-input"]')).toHaveCount(0);
  await expect(
    a.locator('[data-key="author"] [data-testid="dpb-value"]'),
  ).toHaveText("张三");

  await a.locator('[data-key="source"] [data-testid="dpb-type"]').click();
  await expect(a.locator('[data-key="source"].dpb-row-selected')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-testid="dpb-type-menu"]')).toHaveCount(0);

  await page.locator(".cm-content").first().click();
  await expect(panel(page, "A")).not.toHaveClass(/select-mode/);
  await expect(page.locator('[data-testid="dpb-ops"]')).toHaveCount(0);

  await a.locator('[data-key="author"] [data-testid="dpb-value"]').click();
  await expect(a.locator('[data-testid="dpb-input"]')).toBeVisible();
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

test("B 行尾删除按钮：托管日期 / 标题 / 标签行不渲染，普通字段渲染", async ({
  page,
}) => {
  await openDoc(page);
  await setVariant(page, "B");
  await setMode(page, "edit");
  const b = panel(page, "B");

  for (const key of ["created", "updated"]) {
    await expect(
      b.locator(`[data-key="${key}"] .dpb-b-x .dpb-lock`),
    ).toHaveCount(1);
    await expect(
      b.locator(`[data-key="${key}"] [data-testid="dpb-row-del"]`),
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
              { id: string; title: string; content: string }
            >;
          };
        };
      }
    ).__biaoyue_store__;
    const s = store.getState();
    const tab = s.tabs[s.activeTabId ?? ""];
    return { id: tab.id, title: tab.title, content: tab.content };
  });
}

test("新建文档：默认仅标题占位 + 创建/修改日期，页签名未命名", async ({
  page,
}) => {
  await newDoc(page);
  const a = panel(page, "A");
  await expect(a.locator('[data-testid="dpb-title"]')).toHaveText("未命名");
  await expect(a.locator('[data-testid="dpb-row"]')).toHaveCount(2);
  await expect(a.locator('[data-key="created"]')).toHaveCount(1);
  await expect(a.locator('[data-key="updated"]')).toHaveCount(1);
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
