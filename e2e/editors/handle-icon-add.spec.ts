import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { openMarkdownInEdit } from "../helpers/ui-probe";

const ART = path.resolve(process.cwd(), ".artifacts/1346");
const EVIDENCE = path.resolve(process.cwd(), "scripts/cw-evidence.sh");

test.beforeEach(async () => {
  mkdirSync(ART, { recursive: true });
});

function shot(page: Page, name: string, state: string): Promise<string> {
  const file = path.join(ART, `${name}.png`);
  return page.screenshot({ path: file }).then(() => {
    execFileSync(
      EVIDENCE,
      [
        "record-state",
        ART,
        "--state",
        state,
        "--screenshot",
        `.artifacts/1346/${name}.png`,
        "--assertion",
        "passed",
      ],
      { stdio: "ignore" },
    );
    return file;
  });
}

function storeContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    return (state.tabs[state.activeTabId]?.content as string) ?? "";
  });
}

async function displayOf(
  page: Page,
  locator: ReturnType<Page["locator"]>,
): Promise<string> {
  return locator.first().evaluate((el) => getComputedStyle(el).display);
}

/** 文档每行文本 → 该行块手柄图标（同名行取第一个，覆盖空行「+」与文末入口）。 */
async function iconByLine(page: Page): Promise<Map<string, string | null>> {
  const rows = await page.evaluate(() => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const text = (state.tabs[state.activeTabId]?.content as string) ?? "";
    const lines = text.split("\n");
    return Array.from(document.querySelectorAll(".cm-block-handle")).map(
      (h) => {
        const from = Number(h.getAttribute("data-block-from"));
        const line = text.slice(0, from).split("\n").length - 1;
        return {
          lineText: lines[line] ?? "",
          icon:
            h
              .querySelector(".cm-block-handle-icon svg")
              ?.getAttribute("data-icon") ?? null,
        };
      },
    );
  });
  const map = new Map<string, string | null>();
  for (const row of rows) {
    if (!map.has(row.lineText)) map.set(row.lineText, row.icon);
  }
  return map;
}

test("H1/H2/列表/任务/引用/代码/图片/分隔线手柄图标不回归", async ({
  page,
}) => {
  const doc = [
    "# 一级标题",
    "## 二级标题",
    "- 无序项",
    "1. 有序项",
    "- [ ] 待办项",
    "> 引用项",
    "```js",
    "code",
    "```",
    // GFM 表格是合法块：三行连续，不能插空行（空行会拆成三个段落）。
    "| A | B |\n| --- | --- |\n| 1 | 2 |",
    "![图片](photo.png)",
    "---",
    "<div>html block</div>",
  ].join("\n\n");
  await openMarkdownInEdit(page, doc, "handle-icon-map");

  const expected: Record<string, string> = {
    "# 一级标题": "H1Outlined",
    "## 二级标题": "H2Outlined",
    "- 无序项": "DisorderListOutlined",
    "1. 有序项": "OrderListOutlined",
    "- [ ] 待办项": "TodoOutlined",
    "> 引用项": "FormatQuoteOutlined",
    "```js": "CodeblockOutlined",
    "| A | B |": "TableGridOutlined",
    "![图片](photo.png)": "ImageOutlined",
    "---": "DividerOutlined",
  };
  const icons = await iconByLine(page);
  for (const [line, icon] of Object.entries(expected)) {
    expect(icons.get(line), line).toBe(icon);
  }

  await shot(page, "01-icon-map", "icon-map");
});

test("htmlBlock 手柄为明确代码图标；yamlFrontMatter 映射由真实模块钉死", async ({
  page,
}) => {
  await openMarkdownInEdit(
    page,
    "<div>html block</div>\n\n正文",
    "handle-icon-new",
  );

  const htmlIcon = await page.evaluate(() => {
    const h = document.querySelector('.cm-block-handle[data-block-from="0"]');
    return (
      h
        ?.querySelector(".cm-block-handle-icon svg")
        ?.getAttribute("data-icon") ?? null
    );
  });
  expect(htmlIcon).toBe("CodeOutlined");
  expect(htmlIcon).not.toBe("DragHandleOutlined");

  // 当前 @codemirror/lang-markdown 配置无 YAML frontmatter 节点，getBlocks 不产出
  // yamlFrontMatter 块，真实块不可达；映射由模块级断言钉死，真实块覆盖待解析器
  // 补齐（既有缺口，记录给 5.4）。
  const yamlIcon = await page.evaluate(async () => {
    const modulePath = "/src/editors/orchestration/block-handle.ts";
    const mod = await import(modulePath);
    return mod.blockHandleIcon("yamlFrontMatter") as string;
  });
  expect(yamlIcon).toBe("HeaderRowOutlined");
  expect(yamlIcon).not.toBe("DragHandleOutlined");

  await shot(page, "02-html-yaml-icon", "html-yaml-icon");
});

test("文末「+」点击落空段，一次撤销完全还原", async ({ page }) => {
  const orig = "第一段\n\n第二段";
  await openMarkdownInEdit(page, orig, "handle-trailing-add");

  const trailing = page.locator('[data-trailing="true"]');
  await expect(trailing).toHaveCount(1);
  await expect(trailing).toBeVisible();
  await shot(page, "03-trailing-visible", "trailing-visible");

  await trailing.click();
  await expect.poll(() => storeContent(page)).toBe(`${orig}\n\n`);
  await shot(page, "04-trailing-clicked", "trailing-clicked");

  await page.keyboard.press("Meta+z");
  await expect.poll(() => storeContent(page)).toBe(orig);
  await shot(page, "05-trailing-undone", "trailing-undone");
});

test("点击后光标落入新空段", async ({ page }) => {
  const orig = "第一段\n\n第二段";
  await openMarkdownInEdit(page, orig, "handle-trailing-cursor");

  await page.locator('[data-trailing="true"]').click();
  await expect.poll(() => storeContent(page)).toBe(`${orig}\n\n`);

  await page.keyboard.type("新");
  await expect.poll(() => storeContent(page)).toBe(`${orig}\n\n新`);
  await shot(page, "09-trailing-cursor", "trailing-cursor");
});

test("末尾已是空行时不重复出「+」入口", async ({ page }) => {
  await openMarkdownInEdit(page, "第一段\n\n第二段\n", "handle-trailing-dedup");

  await expect(page.locator('[data-trailing="true"]')).toHaveCount(0);
  const lastAdd = page.locator(".cm-block-handle-add").last();
  await expect(lastAdd).toHaveCount(1);
  const from = await lastAdd.evaluate((el) =>
    Number(el.closest(".cm-block-handle")?.getAttribute("data-block-from")),
  );
  const lineText = await page.evaluate((pos) => {
    const store = (window as unknown as Record<string, any>).__biaoyue_store__;
    const state = store.getState();
    const text = (state.tabs[state.activeTabId]?.content as string) ?? "";
    return text.split("\n")[text.slice(0, pos).split("\n").length - 1] ?? "";
  }, from);
  expect(lineText).toBe("");

  await shot(page, "06-trailing-dedup", "trailing-dedup");
});

test("文末「+」滚出视口隐藏、滚回恢复", async ({ page }) => {
  const doc = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 段正文`).join(
    "\n\n",
  );
  await openMarkdownInEdit(page, doc, "handle-trailing-scroll");

  const trailing = page.locator('[data-trailing="true"]');
  await expect(trailing).toHaveCount(1);

  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await expect.poll(() => displayOf(page, trailing)).not.toBe("none");
  await shot(page, "07-trailing-bottom", "trailing-bottom");

  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    scroller.scrollTop = 0;
  });
  await expect.poll(() => displayOf(page, trailing)).toBe("none");
  await shot(page, "08-trailing-scrolled-out", "trailing-scrolled-out");

  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await expect.poll(() => displayOf(page, trailing)).not.toBe("none");
});
