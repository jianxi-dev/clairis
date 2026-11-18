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
  getPanelEditorView: () => editorRefs.activeView,
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
    fireEvent.click(
      first.container.querySelector('[data-testid="dpb-template"]')!,
    );
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

const DT_DOC = `---
title: 时间字段
评审时间: 2026-11-15 14:30
---

# 正文
`;

function mountDatetime() {
  const dispatchRef: {
    current: Array<{
      changes: { from: number; to: number; insert: string };
    }>;
  } = { current: [] };
  editorRefs.activeView = {
    dispatch: (spec) => {
      dispatchRef.current.push(spec);
    },
    focus: () => {},
  };
  const view = render(
    <DocPropertyBar content={DT_DOC} mode="edit" docKey="tab-dt" />,
  );
  return { ...view, dispatchRef };
}

describe("DocPropertyBar 日期时间单面板（#1044）", () => {
  afterEach(() => {
    cleanup();
    resetPanel();
    localStorage.clear();
    editorRefs.activeView = null;
  });

  it("点击值打开单一面板：无分离 date/time 输入，含月历与时分控件", () => {
    const { container } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);

    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    expect(editor).not.toBeNull();
    expect(
      editor.querySelector('[data-testid="dpb-datetime-panel"]'),
    ).not.toBeNull();
    expect(
      editor.querySelectorAll('input[type="date"], input[type="time"]'),
    ).toHaveLength(0);
    expect(
      editor.querySelectorAll('[data-testid="dpb-cal-day"]').length,
    ).toBeGreaterThan(0);
    expect(
      editor.querySelector('[data-testid="dpb-time-hour"]'),
    ).not.toBeNull();
    expect(
      editor.querySelector('[data-testid="dpb-time-minute"]'),
    ).not.toBeNull();
  });

  it("面板内操作不提交；Enter 提交组合值且仅一次写回", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;

    fireEvent.click(
      editor.querySelector(
        '[data-testid="dpb-cal-day"][data-date="2026-11-18"]',
      )!,
    );
    fireEvent.change(editor.querySelector('[data-testid="dpb-time-hour"]')!, {
      target: { value: "14" },
    });
    fireEvent.change(editor.querySelector('[data-testid="dpb-time-minute"]')!, {
      target: { value: "30" },
    });
    expect(dispatchRef.current).toHaveLength(0);

    fireEvent.keyDown(editor, { key: "Enter" });
    expect(dispatchRef.current).toHaveLength(1);
    expect(dispatchRef.current[0].changes.insert).toContain("2026-11-18T14:30");
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();
  });

  it("Esc 取消：不写回，回到原值", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;

    fireEvent.click(
      editor.querySelector(
        '[data-testid="dpb-cal-day"][data-date="2026-11-18"]',
      )!,
    );
    fireEvent.change(editor.querySelector('[data-testid="dpb-time-hour"]')!, {
      target: { value: "18" },
    });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(dispatchRef.current).toHaveLength(0);
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();
    expect(row.querySelector('[data-testid="dpb-value"]')?.textContent).toBe(
      "2026-11-15 14:30",
    );
  });

  it("失焦且未改动则取消，不写回", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;

    fireEvent.blur(editor);

    expect(dispatchRef.current).toHaveLength(0);
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();
  });

  it("日期字段保持仅日期控件，不出现面板或时间输入", () => {
    const DATE_ONLY_DOC = `---
title: 日期字段
createdate: 2026-11-14
---

# 正文
`;
    editorRefs.activeView = { dispatch: () => {}, focus: () => {} };
    const { container } = render(
      <DocPropertyBar content={DATE_ONLY_DOC} mode="edit" docKey="tab-date" />,
    );
    const row = container.querySelector('[data-key="createdate"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);

    expect(row.querySelector('[data-testid="dpb-input"]')).not.toBeNull();
    expect(
      row.querySelector('[data-testid="dpb-input"]')!.getAttribute("type"),
    ).toBe("date");
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();
    expect(row.querySelectorAll('input[type="time"]')).toHaveLength(0);
  });
});
