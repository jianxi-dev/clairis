import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

const editorRefs = vi.hoisted(() => ({
  activeView: null as null | {
    dispatch: (spec: {
      changes: { from: number; to: number; insert: string };
    }) => void;
    focus: () => void;
  },
}));

vi.mock("../../../editors/editorRef", () => ({
  getActiveEditorView: () => editorRefs.activeView,
}));

import DocPropertyBar from "../../../components/Content/DocPropertyBar";
import { useDocPropertyPanelStore } from "../../../stores/docPropertyPanel";
import { useEditorStore } from "../../../stores/editorStore";

const DOC = `---
title: 属性面板
created: 2026-11-14
updated: 2026-11-15T10:30:00
note: 备注
---

# 正文
`;

function resetPanel(): void {
  const s = useDocPropertyPanelStore.getState();
  s.setVariant("A");
  s.setHidden(false);
  s.setCollapsed(false);
}

describe("DocPropertyBar 托管日期键只读（P-6）", () => {
  afterEach(() => {
    cleanup();
    resetPanel();
  });

  it("B 编辑态：created / updated 值不进编辑、类型菜单不弹出", () => {
    useDocPropertyPanelStore.getState().setVariant("B");
    const { container } = render(<DocPropertyBar content={DOC} mode="edit" />);

    for (const key of ["created", "updated"]) {
      const row = container.querySelector(`[data-key="${key}"]`);
      expect(row).not.toBeNull();

      const value = row!.querySelector('[data-testid="dpb-value"]');
      expect(value?.getAttribute("role")).toBeNull();
      fireEvent.click(value!);
      expect(row!.querySelector('[data-testid="dpb-input"]')).toBeNull();

      expect(row!.querySelector('[data-testid="dpb-type"]')).toBeNull();
      fireEvent.click(row!.querySelector(".dpb-b-type")!);
      expect(
        document.querySelector('[data-testid="dpb-type-menu"]'),
      ).toBeNull();
    }
  });

  it("B 编辑态：自由键仍可编辑、类型菜单可弹出（守卫不误伤）", () => {
    useDocPropertyPanelStore.getState().setVariant("B");
    const { container } = render(<DocPropertyBar content={DOC} mode="edit" />);

    const row = container.querySelector('[data-key="note"]');
    expect(row).not.toBeNull();
    fireEvent.click(row!.querySelector('[data-testid="dpb-value"]')!);
    expect(row!.querySelector('[data-testid="dpb-input"]')).not.toBeNull();

    fireEvent.click(row!.querySelector('[data-testid="dpb-type"]')!);
    expect(
      document.querySelector('[data-testid="dpb-type-menu"]'),
    ).not.toBeNull();
  });
});

const BOOL_DOC = `---
title: 布尔属性
flag: true
---

# 正文
`;

describe("DocPropertyBar 布尔值图形与提示分离（#1021）", () => {
  afterEach(() => {
    cleanup();
    resetPanel();
  });

  it("预览态：值内仅状态图形，状态文案在 title", () => {
    const { container } = render(
      <DocPropertyBar content={BOOL_DOC} mode="preview" />,
    );
    const value = container.querySelector('[data-key="flag"] .dpb-bool');
    expect(value?.textContent).toBe("◉");
    expect(value?.getAttribute("title")).toBe("已开启");
  });
});

const PERSIST_DOC = "/Users/test/persist-doc.md";

describe("模板字段类型跨会话保持（#1034）", () => {
  beforeEach(() => {
    localStorage.clear();
    editorRefs.activeView = null;
    useEditorStore.getState().setConfig({
      propTemplates: [
        {
          name: "通用",
          fields: [
            { key: "category", type: "date", value: "2026-11-17" },
            { key: "author", type: "text", value: "" },
            { key: "status", type: "number", value: "7" },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    resetPanel();
    localStorage.clear();
    editorRefs.activeView = null;
    useEditorStore.getState().setConfig({
      propTemplates: undefined,
      propAliasMap: undefined,
    });
  });

  it("套用后重挂载仍按模板类型渲染（持久化往返）", () => {
    const doc = `---\ntitle: 持久化\nnote: 备注\n---\n\n# 正文\n`;
    let content = doc;
    const dispatchRef: {
      current: { changes: { from: number; to: number; insert: string } } | null;
    } = { current: null };
    editorRefs.activeView = {
      dispatch: (spec) => {
        dispatchRef.current = spec;
      },
      focus: () => {},
    };

    const first = render(
      <DocPropertyBar
        content={content}
        mode="edit"
        docKey="tab-1"
        docId={PERSIST_DOC}
      />,
    );
    fireEvent.click(first.container.querySelector('[data-testid="dpb-template"]')!);
    fireEvent.click(document.querySelector('[data-name="通用"]')!);

    const spec = dispatchRef.current!;
    content =
      content.slice(0, spec.changes.from) +
      spec.changes.insert +
      content.slice(spec.changes.to);
    first.rerender(
      <DocPropertyBar
        content={content}
        mode="edit"
        docKey="tab-1"
        docId={PERSIST_DOC}
      />,
    );

    const catRow = first.container.querySelector('[data-key="category"]');
    expect(catRow).not.toBeNull();
    expect(
      catRow!.querySelector('[data-testid="dpb-type"] .dpb-ico-svg'),
    ).not.toBeNull();
    first.unmount();

    const second = render(
      <DocPropertyBar
        content={content}
        mode="edit"
        docKey="tab-2"
        docId={PERSIST_DOC}
      />,
    );
    const catRow2 = second.container.querySelector('[data-key="category"]');
    expect(catRow2).not.toBeNull();
    expect(
      catRow2!.querySelector('[data-testid="dpb-type"] .dpb-ico-svg'),
    ).not.toBeNull();
    expect(
      catRow2!.querySelector('[data-testid="dpb-type"]')!.getAttribute("title"),
    ).toContain("日期");
  });
});
