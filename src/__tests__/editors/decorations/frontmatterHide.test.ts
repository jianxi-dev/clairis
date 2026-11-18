import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  FMH_SUMMARY_CLASS,
  createFrontmatterHideDecorations,
  findFrontmatterBlock,
  frontmatterSelectionFix,
  frontmatterTouchesSelection,
} from "../../../editors/decorations/frontmatterHide";

const DOC = `---
title: 甲
tags:
  - 乙
count: 3
---

# 正文
`;

describe("findFrontmatterBlock", () => {
  it("定位块起止，bodyStart 跳过尾随空行", () => {
    const block = findFrontmatterBlock(DOC);
    expect(block).not.toBeNull();
    expect(DOC.slice(block!.start, block!.blockEnd)).toBe(
      `---\ntitle: 甲\ntags:\n  - 乙\ncount: 3\n---`,
    );
    expect(DOC[block!.bodyStart]).toBe("#");
  });

  it("无 frontmatter / 空块返回 null", () => {
    expect(findFrontmatterBlock("# 正文\n")).toBeNull();
    expect(findFrontmatterBlock("---\n---\n")).toBeNull();
  });

  it("容忍 BOM 前缀", () => {
    const block = findFrontmatterBlock("\uFEFF---\na: 1\n---\n\n正文\n");
    expect(block).not.toBeNull();
    expect(block!.start).toBe(0);
    expect(block!.bodyStart).toBeGreaterThan(block!.blockEnd);
  });
});

describe("frontmatterTouchesSelection", () => {
  it("光标严格落入块内算命中，块边界与正文首字符不算", () => {
    const block = findFrontmatterBlock(DOC)!;
    expect(
      frontmatterTouchesSelection(
        EditorState.create({ doc: DOC, selection: { anchor: 1 } }),
        block,
      ),
    ).toBe(true);
    expect(
      frontmatterTouchesSelection(
        EditorState.create({ doc: DOC, selection: { anchor: 0 } }),
        block,
      ),
    ).toBe(false);
    expect(
      frontmatterTouchesSelection(
        EditorState.create({
          doc: DOC,
          selection: { anchor: block.bodyStart },
        }),
        block,
      ),
    ).toBe(false);
  });

  it("选区跨过块边界算命中", () => {
    const block = findFrontmatterBlock(DOC)!;
    expect(
      frontmatterTouchesSelection(
        EditorState.create({
          doc: DOC,
          selection: { anchor: block.blockEnd - 1, head: block.bodyStart + 1 },
        }),
        block,
      ),
    ).toBe(true);
  });
});

describe("createFrontmatterHideDecorations", () => {
  it("选项缺省 / hide:false 不产生装饰", () => {
    const state = EditorState.create({ doc: DOC });
    expect(createFrontmatterHideDecorations(state)).toBeNull();
    expect(
      createFrontmatterHideDecorations(state, { hide: false, collapsed: true }),
    ).toBeNull();
  });

  it("展开态：整块替换到正文起点", () => {
    const state = EditorState.create({
      doc: DOC,
      selection: { anchor: DOC.length },
    });
    const block = findFrontmatterBlock(DOC)!;
    const result = createFrontmatterHideDecorations(state, {
      hide: true,
      collapsed: false,
    })!;
    expect(result.from).toBe(0);
    expect(result.to).toBe(block.bodyStart);
    const replace = result.decorations.find((d) => !d.value.spec.widget);
    expect(replace!.from).toBe(0);
    expect(replace!.to).toBe(block.bodyStart);
  });

  it("折叠态：替换闭合行以上并插入一行摘要 widget（N = 顶层键数）", () => {
    const state = EditorState.create({
      doc: DOC,
      selection: { anchor: DOC.length },
    });
    const block = findFrontmatterBlock(DOC)!;
    const result = createFrontmatterHideDecorations(state, {
      hide: true,
      collapsed: true,
    })!;
    expect(result.to).toBe(block.blockEnd);
    const widget = result.decorations.find((d) => d.value.spec.widget);
    expect(widget).toBeDefined();
    const el = widget!.value.spec.widget!.toDOM();
    expect(el.className).toBe(FMH_SUMMARY_CLASS);
    expect(el.textContent).toBe("文档属性 · 3 个字段");
  });

  it("光标落入块内时不隐藏（防编辑盲区）", () => {
    const state = EditorState.create({ doc: DOC, selection: { anchor: 4 } });
    expect(
      createFrontmatterHideDecorations(state, { hide: true, collapsed: false }),
    ).toBeNull();
  });
});

describe("frontmatterSelectionFix", () => {
  it("未激活隐藏 / 无块返回 null", () => {
    const state = EditorState.create({ doc: DOC, selection: { anchor: 4 } });
    expect(frontmatterSelectionFix(state, null)).toBeNull();
    expect(
      frontmatterSelectionFix(state, { hide: false, collapsed: false }),
    ).toBeNull();
    expect(
      frontmatterSelectionFix(
        EditorState.create({ doc: "# 正文\n", selection: { anchor: 2 } }),
        { hide: true, collapsed: false },
      ),
    ).toBeNull();
  });

  it("光标在块外不迁移", () => {
    const block = findFrontmatterBlock(DOC)!;
    const state = EditorState.create({
      doc: DOC,
      selection: { anchor: block.bodyStart },
    });
    expect(
      frontmatterSelectionFix(state, { hide: true, collapsed: true }),
    ).toBeNull();
  });

  it("光标/选区落入块内迁到正文起点", () => {
    const block = findFrontmatterBlock(DOC)!;
    const caret = EditorState.create({ doc: DOC, selection: { anchor: 4 } });
    expect(
      frontmatterSelectionFix(caret, { hide: true, collapsed: false }),
    ).toEqual({ anchor: block.bodyStart });
    const selection = EditorState.create({
      doc: DOC,
      selection: { anchor: block.blockEnd - 1, head: block.bodyStart + 1 },
    });
    expect(
      frontmatterSelectionFix(selection, { hide: true, collapsed: true }),
    ).toEqual({ anchor: block.bodyStart });
  });
});
