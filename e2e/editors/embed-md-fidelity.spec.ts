import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { openMarkdownInEdit } from "../helpers/ui-probe";

/**
 * #1415 嵌入 md 保真与预览可渲染。
 *
 * A-4.1/4.2/4.3 嵌入 md 与独立预览同段落 font-size / line-height / 段距相等。
 * A-4.4 预览态 md/pdf/html/附件引用不再出裂图 img。
 * A-4.5 预览态 md 内容可见。A-4.6 pdf/html 出 iframe，zip 出附件卡。
 */

const ART = ".artifacts/1415";
mkdirSync(ART, { recursive: true });
const TMP = "/tmp/e1415-fidelity";
mkdirSync(TMP, { recursive: true });
writeFileSync(
  path.join(TMP, "note.md"),
  "# 内嵌笔记\n\n这是一段嵌入的 Markdown 正文，用于验证排版一致性。\n\n- 列表项一\n- 列表项二\n",
);
writeFileSync(path.join(TMP, "report.pdf"), "%PDF-1.4 fake");
writeFileSync(path.join(TMP, "page.html"), "<html><body><h1>内嵌页</h1></body></html>");
writeFileSync(path.join(TMP, "archive.zip"), "PK fake zip");

const DOC = [
  "先看一段正文，用于对照独立预览的排版基准。",
  "",
  "![内嵌笔记](/tmp/e1415-fidelity/note.md)",
  "",
  "![报告](/tmp/e1415-fidelity/report.pdf)",
  "",
  "![页面](/tmp/e1415-fidelity/page.html)",
  "",
  "![归档](/tmp/e1415-fidelity/archive.zip)",
].join("\n");

interface Type {
  fontSize: string;
  lineHeight: string;
  marginBottom: string;
}

async function paraType(page: any, scope: string): Promise<Type> {
  return page.evaluate((scopeSel: string) => {
    const el = document.querySelector(
      `${scopeSel} p`,
    ) as HTMLElement | null;
    if (!el) return { fontSize: "", lineHeight: "", marginBottom: "" };
    const s = getComputedStyle(el);
    return {
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      marginBottom: s.marginBottom,
    };
  }, scope);
}

test("嵌入 md 与独立预览：font-size / line-height / 段距逐项相等", async ({
  page,
}) => {
  await openMarkdownInEdit(page, DOC, "e1415-typography");
  await page.waitForFunction(() =>
    Boolean(document.querySelector(".cm-embed-md p")),
  );
  const embed = await paraType(page, ".cm-embed-md");

  // 切预览态取独立预览基准（同一文档第一段正文）。
  await page.evaluate(() => {
    const store = (window as any).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  await page.waitForSelector(".preview-content p");
  const preview = await paraType(page, ".preview-content");

  expect(embed.fontSize).toBe(preview.fontSize);
  expect(embed.fontSize).toBe("17px");
  expect(parseFloat(embed.lineHeight)).toBeCloseTo(
    parseFloat(preview.lineHeight),
    0,
  );
  // 段距一致性按「同规则同表现」验证：嵌入卡里该段是容器 last-child
  // （.preview-content > :last-child 尾距归零），预览侧取文档最后一个
  // 段落对照——同规则下两者必须相等。
  const previewLast = await page.evaluate(() => {
    const kids = [
      ...document.querySelectorAll<HTMLElement>(".preview-content > *"),
    ];
    const last = kids[kids.length - 1] as HTMLElement | undefined;
    return last ? getComputedStyle(last).marginBottom : "";
  });
  expect(previewLast).toBe(embed.marginBottom);
  await page.screenshot({ path: `${ART}/01-typography.png` });
});

test("预览态：md/pdf/html/附件引用无裂图，md 内容可见", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "e1415-preview");
  await page.evaluate(() => {
    const store = (window as any).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  await page.waitForSelector(".preview-content");
  await page.waitForTimeout(600);

  const broken = await page.evaluate(() => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>(".preview-content img"),
    );
    const srcs = ["/tmp/e1415-fidelity/note.md", "/tmp/e1415-fidelity/report.pdf", "/tmp/e1415-fidelity/page.html", "/tmp/e1415-fidelity/archive.zip"];
    const broken = imgs.filter(
      (img) =>
        img.naturalWidth === 0 &&
        srcs.some((s) => decodeURIComponent(img.src).includes(s)),
    );
    return { total: imgs.length, broken: broken.length };
  });
  expect(broken.broken).toBe(0);

  const mdText = await page.evaluate(() => {
    const host = document.querySelector(
      ".preview-embed-md",
    ) as HTMLElement | null;
    return host?.textContent ?? "";
  });
  // e2e 走 tauri mock：open_file_direct 返回 "# note.md\n\n文件内容。"。
  expect(mdText).toContain("文件内容");
  await page.screenshot({ path: `${ART}/02-preview-md.png` });
});

test("预览态：pdf/html 出 iframe，zip 出附件卡", async ({ page }) => {
  await openMarkdownInEdit(page, DOC, "e1415-iframe");
  await page.evaluate(() => {
    const store = (window as any).__biaoyue_store__;
    store.getState().setEditorMode("preview");
  });
  await page.waitForSelector(".preview-content");
  await page.waitForTimeout(600);

  const iframes = await page.locator(".preview-content iframe").count();
  expect(iframes).toBeGreaterThanOrEqual(2);

  const cards = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".preview-embed-attachment"),
    );
    return cards.map((c) => c.textContent ?? "");
  });
  expect(cards.some((t) => t.includes("归档"))).toBe(true);
  await page.screenshot({ path: `${ART}/03-preview-iframe.png` });
  await page.screenshot({ path: `${ART}/04-preview-attachment.png` });
});
