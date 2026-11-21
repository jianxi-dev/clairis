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

import DocPropertyBar, {
  aDropIndicator,
  chipDragTarget,
  type ChipBox,
  type DropRowBox,
} from "../../../components/Content/DocPropertyBar";
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

  it("B 态：created / updated 不作为字段行，只读展示在 footer 右侧", () => {
    useDocPropertyPanelStore.getState().setVariant("B");
    const { container } = render(<DocPropertyBar content={DOC} mode="edit" />);

    for (const key of ["created", "updated"]) {
      expect(
        container.querySelector(`[data-testid="dpb-row"][data-key="${key}"]`),
      ).toBeNull();
    }
    const foot = container.querySelector(".dpb-b-foot")!;
    const dates = foot.querySelector('[data-testid="dpb-managed-dates"]');
    expect(dates).not.toBeNull();
    expect(foot.querySelector(".dpb-lock")).not.toBeNull();
    expect(dates!.textContent).toContain("创建 2026-11-14");
    expect(dates!.textContent).toContain("修改 2026-11-15");
    expect(foot.querySelector('[data-testid="dpb-input"]')).toBeNull();
  });

  it("A 态：footer 计数在左、两日期在右，无输入框（与 B 同序）", () => {
    useDocPropertyPanelStore.getState().setVariant("A");
    const { container } = render(
      <DocPropertyBar content={DOC} mode="preview" />,
    );

    for (const key of ["created", "updated"]) {
      expect(
        container.querySelector(`[data-testid="dpb-row"][data-key="${key}"]`),
      ).toBeNull();
    }
    const foot = container.querySelector(".dpb-a-foot")!;
    const dates = foot.querySelector('[data-testid="dpb-managed-dates"]')!;
    const count = foot.querySelector('[data-testid="dpb-count"]')!;
    expect(dates.textContent).toContain("创建 2026-11-14");
    expect(count.textContent).toBe("2 个字段");
    expect(
      count.compareDocumentPosition(dates) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(foot.querySelector('[data-testid="dpb-input"]')).toBeNull();
    expect(foot.querySelector(".dpb-lock")!.getAttribute("width")).toBe("12");
  });

  it("托管日期：编辑态无文本输入，双击不出现日期面板", () => {
    useDocPropertyPanelStore.getState().setVariant("A");
    const { container } = render(<DocPropertyBar content={DOC} mode="edit" />);
    const dates = container.querySelector('[data-testid="dpb-managed-dates"]')!;
    expect(dates.querySelectorAll("input")).toHaveLength(0);
    const created = dates.querySelector(
      '[data-testid="dpb-managed-date"][data-key="created"]',
    )!;

    fireEvent.pointerDown(created, { clientX: 10, clientY: 10 });
    fireEvent.doubleClick(created);
    fireEvent.pointerDown(created, { clientX: 10, clientY: 10 });

    expect(
      container.querySelector('[data-testid="dpb-datetime-editor"]'),
    ).toBeNull();
    expect(dates.textContent).toContain("创建 2026-11-14");
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

const DATE_ONLY_DOC = `---
title: 日期字段
createdate: 2026-11-14
---

# 正文
`;

function mountDateOnly() {
  const dispatchRef: {
    current: Array<{
      changes: { from: number; to: number; insert: string };
    }>;
  } = { current: [] };
  editorRefs.activeView = {
    dispatch: (spec) => dispatchRef.current.push(spec),
    focus: () => {},
  };
  const view = render(
    <DocPropertyBar content={DATE_ONLY_DOC} mode="edit" docKey="tab-date" />,
  );
  return { ...view, dispatchRef };
}

describe("DocPropertyBar 标题扩展名（#1263）", () => {
  afterEach(() => {
    cleanup();
    resetPanel();
    localStorage.clear();
  });

  it("标题字段显示不含文档扩展名", () => {
    const doc = `---\ntitle: 笔记.md\n---\n\n正文\n`;
    const { container } = render(<DocPropertyBar content={doc} mode="edit" />);
    expect(container.querySelector(".dpb-a-title")!.textContent).toBe("笔记");
  });
});

describe("DocPropertyBar 列表值容错（#1256）", () => {
  afterEach(() => {
    cleanup();
    resetPanel();
    localStorage.clear();
  });

  it("tags 为字符串时按单元素标签渲染且不抛错", () => {
    const doc = `---\ntitle: 容错\ntags: "#"\n---\n\n正文\n`;
    const { container } = render(<DocPropertyBar content={doc} mode="edit" />);
    const row = container.querySelector('[data-key="tags"]');
    expect(row).not.toBeNull();
    expect(row!.querySelectorAll(".dpb-tag")).toHaveLength(1);
    expect(row!.querySelector(".dpb-tag")!.textContent).toContain("#");
  });
});

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
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    );
    expect(text).not.toBeNull();
    expect(text!.type).toBe("text");
    expect(text!.value).toBe("2026-11-15T14:30");
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

  it("双击日期时间值区：打开面板并聚焦小时输入，不写回", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    const value = row.querySelector('[data-testid="dpb-value"]')!;
    fireEvent.pointerDown(value, { clientX: 100, clientY: 50 });
    fireEvent.click(value);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const text = editor.querySelector('[data-testid="dpb-datetime-input"]')!;

    fireEvent.pointerDown(text, { clientX: 100, clientY: 50 });

    expect(document.activeElement).toBe(
      editor.querySelector('[data-testid="dpb-time-hour"]'),
    );
    expect(dispatchRef.current).toHaveLength(0);
    expect(
      row.querySelector('[data-testid="dpb-datetime-editor"]'),
    ).not.toBeNull();
  });

  it("值区输入框按 Tab 进入面板，不写回正文", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const panel = editor.querySelector<HTMLElement>(
      '[data-testid="dpb-datetime-panel"]',
    )!;
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    )!;
    text.focus();

    const ev = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    text.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(text);
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(dispatchRef.current).toHaveLength(0);
  });

  it("值区直接键入并 Enter：按归一化结果写回一次", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    )!;

    fireEvent.change(text, { target: { value: "2026/11/18 09:05" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(dispatchRef.current).toHaveLength(1);
    expect(dispatchRef.current[0].changes.insert).toContain(
      "评审时间: 2026-11-18T09:05",
    );
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();
  });

  it("清空值区提交为空字符串，不补今天", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    )!;

    fireEvent.change(text, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(dispatchRef.current).toHaveLength(1);
    expect(dispatchRef.current[0].changes.insert).toContain('评审时间: ""');
  });

  it("非法输入：不写回、还原原值并提示", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    )!;

    fireEvent.change(text, { target: { value: "abc" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(dispatchRef.current).toHaveLength(0);
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();
    expect(row.querySelector('[data-testid="dpb-error"]')!.textContent).toBe(
      "日期时间格式不正确",
    );
    expect(row.querySelector('[data-testid="dpb-value"]')!.textContent).toBe(
      "2026-11-15 14:30",
    );
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

  it("日期时间字段点日格只改草稿，面板保持打开", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;

    fireEvent.click(
      editor.querySelector(
        '[data-testid="dpb-cal-day"][data-date="2026-11-18"]',
      )!,
    );

    expect(dispatchRef.current).toHaveLength(0);
    expect(
      row.querySelector('[data-testid="dpb-datetime-editor"]'),
    ).not.toBeNull();
    expect(
      row.querySelector<HTMLInputElement>('[data-testid="dpb-datetime-input"]')!
        .value,
    ).toBe("2026-11-18T14:30");
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

  it("时/分输入框内 Tab 被面板拦截：焦点留在面板内且不写回", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const panel = editor.querySelector('[data-testid="dpb-datetime-panel"]')!;
    const minute = editor.querySelector<HTMLElement>(
      '[data-testid="dpb-time-minute"]',
    )!;

    minute.focus();
    expect(document.activeElement).toBe(minute);

    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    minute.dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(minute);
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(dispatchRef.current).toHaveLength(0);
  });

  it("时/分输入框内 Shift+Tab 向面板内上一个停靠点移动", () => {
    const { container, dispatchRef } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const panel = editor.querySelector('[data-testid="dpb-datetime-panel"]')!;
    const minute = editor.querySelector<HTMLElement>(
      '[data-testid="dpb-time-minute"]',
    )!;

    minute.focus();
    const ev = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    minute.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(minute);
    expect(dispatchRef.current).toHaveLength(0);
  });

  it("从 tabindex=-1 的日历格起跳时 Tab 方向正确", () => {
    const { container } = mountDatetime();
    const row = container.querySelector('[data-key="评审时间"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const panel = editor.querySelector('[data-testid="dpb-datetime-panel"]')!;
    const cells = Array.from(
      panel.querySelectorAll<HTMLElement>("[data-date]"),
    );
    const cell = cells.find((c) => c.getAttribute("aria-pressed") !== "true")!;
    expect(cell).toBeTruthy();

    cell.focus();
    const back = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(back);
    const prev = document.activeElement as HTMLElement;
    expect(back.defaultPrevented).toBe(true);
    expect(panel.contains(prev)).toBe(true);
    expect(prev).not.toBe(cell);
    expect(
      prev.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    cell.focus();
    const fwd = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(fwd);
    const next = document.activeElement as HTMLElement;
    expect(fwd.defaultPrevented).toBe(true);
    expect(panel.contains(next)).toBe(true);
    expect(next).not.toBe(cell);
    expect(
      cell.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("日期字段用同一自绘面板（仅日期），可切月/年视图", () => {
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

    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    expect(editor).not.toBeNull();
    expect(
      row.querySelectorAll('input[type="date"],input[type="time"]'),
    ).toHaveLength(0);
    expect(editor.querySelector('[data-testid="dpb-time-hour"]')).toBeNull();
    expect(
      editor.querySelector('[data-testid="dpb-cal-month"]'),
    ).not.toBeNull();

    fireEvent.click(editor.querySelector('[data-testid="dpb-cal-month"]')!);
    expect(
      editor.querySelectorAll('[data-testid="dpb-cal-month-cell"]'),
    ).toHaveLength(12);

    fireEvent.click(
      editor.querySelectorAll('[data-testid="dpb-cal-month-cell"]')[0]!,
    );
    expect(editor.querySelector('[data-testid="dpb-cal-grid"]')).not.toBeNull();

    fireEvent.click(editor.querySelector('[data-testid="dpb-cal-year"]')!);
    expect(
      editor.querySelectorAll('[data-testid="dpb-cal-year-cell"]'),
    ).toHaveLength(12);
    fireEvent.click(
      editor.querySelectorAll('[data-testid="dpb-cal-year-cell"]')[5]!,
    );
    expect(
      editor.querySelectorAll('[data-testid="dpb-cal-month-cell"]'),
    ).toHaveLength(12);
  });

  it("日期字段单击日格立即提交并关闭，仅一次写回", () => {
    const { container, dispatchRef } = mountDateOnly();
    const row = container.querySelector('[data-key="createdate"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const day = editor.querySelector<HTMLElement>(
      '[data-testid="dpb-cal-day"][data-date="2026-11-15"]',
    )!;
    fireEvent.click(day);

    expect(dispatchRef.current).toHaveLength(1);
    expect(dispatchRef.current[0].changes.insert).toContain(
      "createdate: 2026-11-15",
    );
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();

    fireEvent.blur(row);
    fireEvent.mouseDown(document.body);
    expect(dispatchRef.current).toHaveLength(1);
  });

  it("日期字段点「今天」立即提交并关闭", () => {
    const { container, dispatchRef } = mountDateOnly();
    const row = container.querySelector('[data-key="createdate"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    fireEvent.click(editor.querySelector('[data-testid="dpb-cal-today"]')!);

    expect(dispatchRef.current).toHaveLength(1);
    expect(dispatchRef.current[0].changes.insert).toMatch(
      /createdate: \d{4}-\d{2}-\d{2}/,
    );
    expect(row.querySelector('[data-testid="dpb-datetime-editor"]')).toBeNull();
  });

  it("双击日期值区：面板打开并聚焦选中日格，不写回", () => {
    const { container, dispatchRef } = mountDateOnly();
    const row = container.querySelector('[data-key="createdate"]')!;
    const value = row.querySelector('[data-testid="dpb-value"]')!;
    fireEvent.pointerDown(value, { clientX: 120, clientY: 40 });
    fireEvent.click(value);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    )!;

    fireEvent.pointerDown(text, { clientX: 120, clientY: 40 });

    expect(document.activeElement).toBe(
      editor.querySelector(
        '[data-testid="dpb-cal-day"][data-date="2026-11-14"]',
      ),
    );
    expect(dispatchRef.current).toHaveLength(0);
  });

  it("日期字段值区可直接键入并归一化 / 至 -", () => {
    const { container, dispatchRef } = mountDateOnly();
    const row = container.querySelector('[data-key="createdate"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    )!;

    fireEvent.change(text, { target: { value: "2026/11/18" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(dispatchRef.current).toHaveLength(1);
    expect(dispatchRef.current[0].changes.insert).toContain(
      "createdate: 2026-11-18",
    );
  });

  it("日期字段清空提交为空字符串", () => {
    const { container, dispatchRef } = mountDateOnly();
    const row = container.querySelector('[data-key="createdate"]')!;
    fireEvent.click(row.querySelector('[data-testid="dpb-value"]')!);
    const editor = row.querySelector('[data-testid="dpb-datetime-editor"]')!;
    const text = editor.querySelector<HTMLInputElement>(
      '[data-testid="dpb-datetime-input"]',
    )!;

    fireEvent.change(text, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(dispatchRef.current).toHaveLength(1);
    expect(dispatchRef.current[0].changes.insert).toContain('createdate: ""');
  });
});

describe("aDropIndicator（A 态竖向落点条几何）", () => {
  const rows: DropRowBox[] = [
    { id: 0, left: 14, top: 10, width: 100, height: 26 },
    { id: 1, left: 14, top: 50, width: 120, height: 26 },
    { id: 2, left: 150, top: 50, width: 120, height: 26 },
    { id: 3, left: 286, top: 50, width: 120, height: 26 },
    { id: 4, left: 14, top: 82, width: 120, height: 26 },
    { id: 5, left: 150, top: 82, width: 120, height: 26 },
  ];

  it("行内 gap：x 落在相邻两胶囊之间，覆盖整行高", () => {
    expect(aDropIndicator(2, rows, 6)).toEqual({
      left: (134 + 150) / 2,
      top: 50,
      height: 26,
    });
  });

  it("行首 gap：竖条贴该行左缘胶囊", () => {
    expect(aDropIndicator(1, rows, 6)).toEqual({
      left: 14,
      top: 50,
      height: 26,
    });
  });

  it("换行行首：取目标视觉行的左缘与行高", () => {
    expect(aDropIndicator(4, rows, 6)).toEqual({
      left: 14,
      top: 82,
      height: 26,
    });
  });

  it("追加到末尾：竖条贴末行末胶囊右缘", () => {
    expect(aDropIndicator(6, rows, 6)).toEqual({
      left: 270,
      top: 82,
      height: 26,
    });
  });

  it("标题位单独成行：竖条贴标题左缘", () => {
    expect(aDropIndicator(0, rows, 6)).toEqual({
      left: 14,
      top: 10,
      height: 26,
    });
  });
});

describe("chipDragTarget（chip 拖动落点）", () => {
  const box = (
    index: number,
    left: number,
    top: number,
    width = 40,
    height = 20,
  ): ChipBox => ({ index, left, top, width, height });

  it("同一行：指针落在 chip 左半 → 插到它前面；越过末位 → 末尾", () => {
    const boxes = [box(0, 0, 0), box(1, 50, 0), box(2, 100, 0)];
    expect(chipDragTarget(boxes, 60, 10)).toBe(1);
    expect(chipDragTarget(boxes, 200, 10)).toBe(3);
  });

  it("指针在上方行之上 → 插到行首", () => {
    const boxes = [box(0, 0, 0), box(1, 50, 0), box(2, 0, 40)];
    expect(chipDragTarget(boxes, 60, -10)).toBe(0);
  });

  it("换行：指针落在第二行 → 插到第二行行首", () => {
    const boxes = [box(0, 0, 0), box(1, 50, 0), box(2, 0, 40), box(3, 50, 40)];
    expect(chipDragTarget(boxes, 10, 50)).toBe(2);
  });

  it("空列表返回 0", () => {
    expect(chipDragTarget([], 10, 10)).toBe(0);
  });
});
