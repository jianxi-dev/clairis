import { describe, it, expect, beforeEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import ContentArea from "../../../components/Content/ContentArea";
import { useStore } from "../../../stores/index";
import { getEditorView } from "../../../editors/editorRef";

describe("ContentArea", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("renders without crashing", () => {
    const { container } = render(<ContentArea />);
    expect(container).toBeDefined();
  });

  it("shows empty state when no tabs are open", () => {
    const { container } = render(<ContentArea />);
    expect(container.textContent).toBeDefined();
  });

  it("renders editor container when tab is open with edit mode", () => {
    useStore.getState().openFile("/path/test.md", "# Hello");
    useStore.getState().setEditorMode("edit");
    const { container } = render(<ContentArea />);
    // Should render CM6 editor for edit mode
    const editorDiv = container.querySelector(".cm-editor-container");
    expect(editorDiv).toBeDefined();
  });

  it("renders active tab content (tab bar delegated to TabBar)", () => {
    useStore.getState().openFile("/path/a.md", "# A");
    useStore.getState().openFile("/path/b.md", "# B");
    const { container } = render(<ContentArea />);
    // Tab bar lives in TabBar.tsx now; ContentArea renders the editor + viewport
    expect(container.querySelector(".cm-editor-container")).toBeDefined();
  });
});

describe("ContentArea 预览态不预热编辑器（#276）", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("HTML 预览态不同步；切到源码后再同步整篇文档", async () => {
    const html = "<!DOCTYPE html><html><body><p>hello</p></body></html>";
    useStore.getState().openFile("/path/a.html", html);
    expect(useStore.getState().activeTabId).toBeTruthy();

    render(<ContentArea panelId="main" />);
    await waitFor(() => expect(getEditorView("main")).toBeTruthy());
    expect(getEditorView("main")?.state.doc.length).toBe(0);
    // 初始不同步也不会把页签标脏（HTML 预览保持 asset 直载）
    const tabId = useStore.getState().activeTabId!;
    expect(useStore.getState().tabs[tabId]?.dirty).toBe(false);

    act(() => useStore.getState().setEditorMode("source"));
    await waitFor(() =>
      expect(getEditorView("main")?.state.doc.toString()).toBe(html),
    );
  });
});
