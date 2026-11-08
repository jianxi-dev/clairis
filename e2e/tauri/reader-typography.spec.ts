import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:1420";

const DOC = [
  "# 排版冒烟",
  "",
  "这是一段中文abc混排的正文，用于验证中西文间距与段落节奏。",
  "",
  "> [!NOTE] 提示标题",
  "> 这是 callout 正文。",
  "",
  "## 代码",
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
  "## 表格",
  "",
  "| 列一 | 列二 |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "## 公式",
  "",
  "行内 $E=mc^2$ 与块级：",
  "",
  "$$",
  "\\frac{a}{b}",
  "$$",
  "",
  "- [x] 已完成",
  "- [ ] 未完成",
].join("\n");

async function openFile(
  page: import("@playwright/test").Page,
  content: string,
) {
  await page.evaluate((c) => {
    const w = window as unknown as Record<string, unknown>;
    (
      w as {
        __biaoyue_openFile__?: (
          path: string,
          content: string,
          title: string,
        ) => void;
      }
    ).__biaoyue_openFile__?.("/Users/test/排版.md", c, "排版.md");
  }, content);
  await page.waitForTimeout(400);
}

async function openSettings(page: import("@playwright/test").Page) {
  await page.keyboard.press("Meta+,");
  await expect(page.locator('[data-testid="settings-scene"]')).toBeVisible();
}

async function closeSettings(page: import("@playwright/test").Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-scene"]')).toHaveCount(0);
}

test("预览排版：容器尺度按设计 token 生效", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });

  await openFile(page, DOC);

  const content = page.locator(".preview-content");
  await expect(content).toHaveCount(1);

  const box = await content.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      maxWidth: cs.maxWidth,
      background: cs.backgroundColor,
      fontFamily: cs.fontFamily,
    };
  });

  expect(box.fontSize).toBe("17px");
  expect(parseFloat(box.lineHeight) / parseFloat(box.fontSize)).toBeCloseTo(
    1.78,
    1,
  );
  // 内容容器走宽通道 1200px，正文段落走 1080px
  expect(box.maxWidth).toBe("1200px");
  expect(box.fontFamily).toContain("PingFang SC");

  const paraWidth = await page
    .locator(".preview-content > p")
    .first()
    .evaluate((el) => getComputedStyle(el).maxWidth);
  expect(paraWidth).toBe("1080px");

  // 纸色不是纯白，也不是窗口底色
  expect(box.background).not.toBe("rgb(255, 255, 255)");
});

test("预览排版：代码块高亮与容器细节生效", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, DOC);

  const block = page.locator(".code-block").first();
  await expect(block).toHaveCount(1);

  // 语法高亮必须真的上色（jsdom 测不到计算样式）
  const keywordColor = await page
    .locator(".tok-keyword")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(keywordColor).toBe("rgb(157, 58, 125)");

  // 代码块走宽通道，比正文宽
  const blockWidth = await block.evaluate(
    (el) => getComputedStyle(el).maxWidth,
  );
  expect(blockWidth).toBe("1200px");

  // 语言标签与复制按钮：默认显示标签，hover 后切成复制按钮
  await expect(page.locator(".code-lang").first()).toHaveText("js");
  const langOpacity = await page
    .locator(".code-lang")
    .first()
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(langOpacity).toBe("1");

  await block.hover();
  await page.waitForTimeout(300);
  const copyOpacity = await page
    .locator(".code-copy")
    .first()
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(copyOpacity)).toBeGreaterThan(0.9);
});

test("预览排版：Callout / 公式 / 表格 / 任务列表 / 中西文间距生效", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, DOC);

  // Callout：类型、主色条、标题
  const callout = page.locator('.callout[data-callout="note"]');
  await expect(callout).toHaveCount(1);
  await expect(callout.locator(".callout-title")).toContainText("提示标题");
  const borderColor = await callout.evaluate(
    (el) => getComputedStyle(el).borderInlineStartColor,
  );
  expect(borderColor).toBe("rgb(61, 90, 138)");
  await expect(page.locator("blockquote")).toHaveCount(0);

  // 公式：行内与块级都渲染出 katex
  await expect(page.locator(".katex").first()).toBeVisible();
  await expect(page.locator(".katex-block")).toHaveCount(1);

  // 表格：横向滚动容器 + 只留横向分隔线（末行底边交给外框，避免圆角处重线）
  const wrap = page.locator(".table-wrap");
  await expect(wrap).toHaveCount(1);
  const tdBorder = await page
    .locator(".preview-content td")
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      const isLastRow =
        el.parentElement?.parentElement?.lastElementChild === el.parentElement;
      return {
        bottom: cs.borderBottomWidth,
        left: cs.borderInlineStartWidth,
        isLastRow,
      };
    });
  expect(tdBorder.left).toBe("0px");
  expect(tdBorder.isLastRow).toBe(true);
  expect(tdBorder.bottom).toBe("0px");
  const wrapBorder = await wrap.evaluate(
    (el) => getComputedStyle(el).borderTopWidth,
  );
  expect(wrapBorder).toBe("1px");

  // 任务列表：自绘圆形 checkbox，完成项变灰且不带删除线
  const checked = page
    .locator(".preview-content input[type=checkbox]:checked")
    .first();
  const cb = await checked.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { radius: cs.borderRadius, appearance: cs.appearance };
  });
  expect(cb.radius).toBe("50%");
  const doneLi = page
    .locator(".preview-content li")
    .filter({ hasText: "已完成" })
    .first();
  const liStyle = await doneLi.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, decoration: cs.textDecorationLine };
  });
  expect(liStyle.decoration).not.toContain("line-through");
  expect(liStyle.color).toBe("rgb(139, 143, 150)");

  // 中西文间距：插入的空格是可测量的，但代码内不插
  const padWidth = await page
    .locator(".cjk-pad")
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(padWidth).toBeGreaterThan(1);
  expect(padWidth).toBeLessThan(4);
});

test("预览排版：连续引用行无空行也逐行显示", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });

  const quote = [
    "> **报告日期**: 2026-08-31",
    "> **评估对象**: MDE（格式标准）",
    "> **评估问题**: 可行性评估",
  ].join("\n");
  await openFile(page, quote);

  const bq = page.locator(".preview-content blockquote");
  await expect(bq).toHaveCount(1);

  // pre-line：<p> 内的软换行符可见（marked 不开 breaks，连续 > 行是单个 <p>）
  const ws = await bq
    .locator("p")
    .evaluate((el) => getComputedStyle(el).whiteSpace);
  expect(ws).toBe("pre-line");

  // 行为验证：3 行文本渲染成多行，而不是折叠成 1 行
  // （getClientRects 对含 inline 子元素与 CJK 的 range 会拆成大量片段，不可用，
  //   改用高度对比：合并成 1 行时高度 ≈ 1 倍行高）
  const lines = await bq.evaluate((el) => {
    const p = el.querySelector("p");
    if (!p) return 0;
    const lh = parseFloat(getComputedStyle(p).lineHeight);
    return p.getBoundingClientRect().height / lh;
  });
  expect(lines).toBeGreaterThan(2.5);
});

test("预览排版：阅读设置可改字号与行宽", async ({ page }) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, DOC);

  await openSettings(page);
  await page.locator('[data-settings-nav="reading"]').click();
  await page.locator('[data-testid="reader-width-720"]').click();
  await page.locator('[data-settings-nav="appearance"]').click();
  await page.locator('[data-testid="font-size-19"]').click();
  await closeSettings(page);

  const fontSize = await page
    .locator(".preview-content")
    .evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe("19px");

  const width = await page
    .locator(".preview-content > p")
    .first()
    .evaluate((el) => getComputedStyle(el).maxWidth);
  expect(width).toBe("720px");
});

test("预览排版：纸宽撑满可用宽度，且随窗口与行宽设置变化", async ({ page }) => {
  // 工作区已改为全宽外壳（旧 280px 侧栏移除）；1100 宽仍小于 1200 的宽通道，
  // 用来验证「纸必须撑满可用宽度」，更宽的窗口在下一段验证截住并居中。
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, "# 短\n\n一句话。");

  // 内容再短，纸也必须撑满外壳：列向 flex 项的 margin-inline: auto 会关掉
  // align-self: stretch，缺了 width:100% 就退化成 fit-content（纸宽随内容漂）
  const geom = () =>
    page.evaluate(() => {
      const pc = document.querySelector(
        ".preview-content",
      ) as HTMLElement | null;
      if (!pc) return null;
      const cs = getComputedStyle(pc);
      const shell = pc.parentElement as HTMLElement;
      const p = document.querySelector(
        ".preview-content > p",
      ) as HTMLElement | null;
      return {
        shellW: Math.round(shell.getBoundingClientRect().width),
        pcW: Math.round(pc.getBoundingClientRect().width),
        ml: Math.round(parseFloat(cs.marginLeft)),
        mr: Math.round(parseFloat(cs.marginRight)),
        paraW: p ? Math.round(p.getBoundingClientRect().width) : 0,
      };
    });

  const g1 = await geom();
  expect(g1!.pcW).toBe(g1!.shellW);

  // 窗口更宽时由宽通道截住并居中
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.waitForTimeout(300);
  const g2 = await geom();
  expect(g2!.pcW).toBe(1200);
  expect(g2!.ml).toBe(g2!.mr);
  expect(g2!.ml).toBeGreaterThan(0);

  // 窄窗口：撑满但不撑破（border-box 下 padding 必须内含，不产生横向滚动）
  await page.setViewportSize({ width: 600, height: 900 });
  await page.waitForTimeout(300);
  const gNarrow = await geom();
  expect(gNarrow!.pcW).toBe(gNarrow!.shellW);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // 行宽设置必须真的改变渲染宽度，而不只是改 max-width
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.waitForTimeout(300);
  await openSettings(page);
  await page.locator('[data-settings-nav="reading"]').click();
  await page.locator('[data-testid="reader-width-720"]').click();
  await closeSettings(page);
  const g3 = await geom();
  expect(g3!.pcW).toBeLessThan(g2!.pcW);
  expect(g3!.paraW).toBeLessThan(g2!.paraW);
});

const RICH_DOC = [
  "# 一级标题",
  "",
  "**加粗文本**与普通文本。",
  "",
  "> [!NOTE] 提示标题",
  "> callout 正文。",
  "",
  "```mermaid",
  "graph TD",
  "A-->B",
  "```",
  "",
  '<div style="background-color:#ffffff;color:#222222">内嵌色块</div>',
  "",
  "| 很长的表头一 | 表头二 | 表头三 |",
  "| --- | --- | --- |",
  "| 内容内容内容内容内容 | 2 | 3 |",
].join("\n");

test("六项反馈的浏览器层验收：图 / 背景 / 表格 / 主题 / 内嵌深色", async ({
  page,
}) => {
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, RICH_DOC);

  // 4. callout 正文只出现一次
  const calloutText = await page
    .locator(".preview-content .callout")
    .innerText();
  expect(calloutText.match(/callout 正文/g)?.length).toBe(1);

  // 1. mermaid 渲染成图
  await expect(page.locator(".preview-content .mermaid-view svg")).toBeVisible({
    timeout: 20000,
  });

  // 3. 背景随内容延伸：外壳高度不小于内容高度
  const sizes = await page.evaluate(() => {
    const shell = document.querySelector(".preview-shell") as HTMLElement;
    const content = document.querySelector(".preview-content") as HTMLElement;
    return {
      shell: shell.getBoundingClientRect().height,
      content: content.getBoundingClientRect().height,
    };
  });
  expect(sizes.shell).toBeGreaterThanOrEqual(sizes.content - 1);

  // 6. 表格圆角
  const radius = await page
    .locator(".preview-content .table-wrap")
    .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(parseFloat(radius)).toBeGreaterThanOrEqual(12);

  // 2. 切主题后标题色整体变化
  const before = await page
    .locator(".preview-content h1")
    .evaluate((el) => getComputedStyle(el).color);
  await openSettings(page);
  await page.locator('[data-settings-nav="reading"]').click();
  await page.locator('[data-testid="reader-tone-indigo"]').click();
  await closeSettings(page);
  const after = await page
    .locator(".preview-content h1")
    .evaluate((el) => getComputedStyle(el).color);
  expect(after).not.toBe(before);

  // 5. 深色下内嵌浅色块转成深色
  const block = page.locator('.preview-content [style*="--dc-1"]');
  await expect(block).toHaveCount(1);
  const lightBg = await block.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(200);
  const darkBg = await block.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const lum = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map(Number);
    return (r + g + b) / 3;
  };
  expect(lum(darkBg)).toBeLessThan(lum(lightBg));
});

// ── A-11 预览表格宽度与自动换行（change: preview-table-width）──────────────
// 长 token 用真实 URL 形态 + 超长英文单词，验证「换行而非横向延展」。
const LONG_TOKEN = "a".repeat(120);
const LONG_TABLE_DOC = [
  "# 长内容表格",
  "",
  "| 项目 | 地址 | 说明 |",
  "| --- | --- | --- |",
  `| 链接 | https://example.com/${"segment-of-path/".repeat(12)}${LONG_TOKEN} | 说明文本 |`,
  `| 单词 | ${LONG_TOKEN} | 说明文本 |`,
].join("\n");

const SHORT_TABLE_DOC = [
  "# 短表格",
  "",
  "| 列一 | 列二 |",
  "| --- | --- |",
  "| 1 | 2 |",
].join("\n");

// 极端不可断内容：内嵌固定宽度元素（消毒白名单放开 style 属性，见 markdown.ts）
const WIDE_CELL_DOC = [
  "# 极端兜底",
  "",
  "| 列一 | 列二 |",
  "| --- | --- |",
  '| <div style="width:1600px">x</div> | 2 |',
].join("\n");

/** 量表格与 .table-wrap 的宽度关系：inner 为容器内容区宽度（扣 padding）。 */
function tableMetrics(page: import("@playwright/test").Page) {
  return page.locator(".table-wrap").evaluate((el) => {
    const table = el.querySelector("table") as HTMLElement;
    const cs = getComputedStyle(el);
    const inner =
      el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return {
      wrapClient: el.clientWidth,
      wrapScroll: el.scrollWidth,
      inner,
      tableW: table.getBoundingClientRect().width,
    };
  });
}

test("预览排版：长内容表格不横向延展，单元格自动换行", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, LONG_TABLE_DOC);

  const wrap = page.locator(".table-wrap");
  await expect(wrap).toHaveCount(1);

  // 表格宽度不超出容器内容区（+1px 舍入容差），容器无横向溢出
  const m = await tableMetrics(page);
  expect(m.tableW).toBeLessThanOrEqual(m.inner + 1);
  expect(m.wrapScroll).toBeLessThanOrEqual(m.wrapClient + 1);

  // 长 URL 单元格换行：高度进入多行区间（1 行时约 1.6 倍行高）
  const urlLines = await page
    .locator(".preview-content td")
    .filter({ hasText: "segment-of-path" })
    .first()
    .evaluate((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return el.getBoundingClientRect().height / lh;
    });
  expect(urlLines).toBeGreaterThan(2);

  // 判别性证据：纯 a 重复 token（无可断点）只能靠 overflow-wrap: anywhere 换行，
  // URL 在 `/` 处天然可断，不足以证明换行机制生效
  const wordLines = await page
    .locator(".preview-content tbody tr")
    .filter({ hasText: "单词" })
    .locator("td")
    .nth(1)
    .evaluate((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return el.getBoundingClientRect().height / lh;
    });
  expect(wordLines).toBeGreaterThan(2);

  // 窗口变窄后仍不横向延展（窗口宽度联动）
  await page.setViewportSize({ width: 820, height: 900 });
  await page.waitForTimeout(300);
  const narrow = await tableMetrics(page);
  expect(narrow.tableW).toBeLessThanOrEqual(narrow.inner + 1);
  expect(narrow.wrapScroll).toBeLessThanOrEqual(narrow.wrapClient + 1);
});

test("预览排版：短内容表格保持满宽", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, SHORT_TABLE_DOC);

  const wrap = page.locator(".table-wrap");
  await expect(wrap).toHaveCount(1);

  // 内容再短，表格仍占满容器内容区（不缩到内容宽度）
  const m = await tableMetrics(page);
  expect(Math.abs(m.tableW - m.inner)).toBeLessThanOrEqual(2);
  expect(m.wrapScroll).toBeLessThanOrEqual(m.wrapClient + 1);
});

test("预览排版：表格随阅读行宽设置同步适配", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, LONG_TABLE_DOC);

  await expect(page.locator(".table-wrap")).toHaveCount(1);

  // 默认「标准」行宽（1080）：表格占满内容区且不横向延展
  const standard = await tableMetrics(page);
  expect(standard.tableW).toBeLessThanOrEqual(standard.inner + 1);
  expect(standard.wrapScroll).toBeLessThanOrEqual(standard.wrapClient + 1);

  // 复用既有阅读设置机制切到「紧凑」（720）
  await openSettings(page);
  await page.locator('[data-settings-nav="reading"]').click();
  await page.locator('[data-testid="reader-width-720"]').click();
  await closeSettings(page);

  // 行宽变窄后表格同步收窄，且仍不横向延展
  const compact = await tableMetrics(page);
  expect(compact.inner).toBeLessThan(standard.inner);
  expect(compact.tableW).toBeLessThan(standard.tableW);
  expect(compact.tableW).toBeLessThanOrEqual(compact.inner + 1);
  expect(compact.wrapScroll).toBeLessThanOrEqual(compact.wrapClient + 1);
});

test("预览排版：极端不可断内容在表格容器内横向滚动兜底", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript({ path: "./e2e/mocks/tauri-mock.js" });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="pane-header"]', { timeout: 10000 });
  await openFile(page, WIDE_CELL_DOC);

  const wrap = page.locator(".table-wrap");
  await expect(wrap).toHaveCount(1);

  // 先确认内嵌定宽元素真的渲染（style 未被消毒剥离）
  const cell = await page
    .locator(".preview-content tbody td")
    .first()
    .evaluate((el) => {
      const child = el.firstElementChild as HTMLElement | null;
      return {
        html: el.innerHTML,
        childW: child ? child.getBoundingClientRect().width : 0,
      };
    });
  expect(cell.html).toContain("1600px");
  expect(cell.childW).toBeGreaterThan(1400);

  const geom = await page.evaluate(() => {
    const w = document.querySelector(".table-wrap") as HTMLElement;
    const content = document.querySelector(".preview-content") as HTMLElement;
    const cs = getComputedStyle(content);
    const contentInner =
      content.clientWidth -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight);
    return {
      wrapClient: w.clientWidth,
      wrapScroll: w.scrollWidth,
      wrapW: w.getBoundingClientRect().width,
      contentInner,
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
    };
  });

  // 兜底滚动只在 .table-wrap 内生效
  expect(geom.wrapScroll).toBeGreaterThan(geom.wrapClient + 1);
  // 容器自身不溢出纸面内容区
  expect(geom.wrapW).toBeLessThanOrEqual(geom.contentInner + 1);
  // 页面级无横向溢出
  expect(geom.docScroll).toBeLessThanOrEqual(geom.docClient + 1);
});
