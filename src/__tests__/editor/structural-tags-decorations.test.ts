/**
 * #263：编辑态隐藏独占一行的未知结构标签（加固回归）。
 *
 * 真实 SKILL.md 形态：frontmatter + 中文正文 + 围栏代码 + 多个 <tag> 包裹分节。
 * 标签行本身隐藏；标签包裹的标题/表格保留；围栏内的同名标签是代码内容，可见。
 * 同一文档的 CRLF 变体行为一致。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  editorDecorations,
  resetDecorationGuards,
} from "../../editors/decorations";

function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        16,
      )) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

const DOC = `---
name: overview-design-liyy
description: 从客户需求文档自动生成概要设计说明书。
---

<objective>
将客户提供的需求文档自动转换为标准化的概要设计说明书。
</objective>

<essential_principles>
## 核心原则

**1. 大文档处理**

正文段落。
</essential_principles>

## 后续标题

\`\`\`text
<fenced_tag>
围栏内的标签是代码内容，不应被隐藏。
\`\`\`
`;

describe("structural tag decorations", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    resetDecorationGuards();
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
    resetDecorationGuards();
  });

  function createEditor(doc: string): EditorView {
    return new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown(), editorDecorations()],
      }),
    });
  }

  function assertTagsHidden(doc: string): void {
    view = createEditor(doc);
    const content = view.dom.querySelector(".cm-content");
    expect(content).not.toBeNull();
    const text = content!.textContent ?? "";
    expect(text).not.toContain("essential_principles");
    expect(text).not.toContain("objective");
    expect(text).toContain("核心原则");
    expect(text).toContain("后续标题");
    expect(text).toContain("fenced_tag");
    // CM6 会把 CRLF 归一化为 LF；装饰本身不得改动文档值。
    expect(view.state.doc.toString()).toBe(doc.replace(/\r\n/g, "\n"));
  }

  it("隐藏标签行，保留包裹的标题与围栏内的同名标签", () => {
    assertTagsHidden(DOC);
  });

  it("CRLF 变体同样隐藏", () => {
    assertTagsHidden(DOC.replace(/\n/g, "\r\n"));
  });

  it("4 空格缩进的行是码块内容，不当结构标签隐藏", () => {
    const indented = "## 标题\n\n    <custom_tag>\n    码块正文\n";
    view = createEditor(indented);
    const text = view.dom.querySelector(".cm-content")?.textContent ?? "";
    expect(text).toContain("custom_tag");
    expect(text).toContain("码块正文");
  });
});
