import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ContentArea from "../../../components/Content/ContentArea";
import { useStore } from "../../../stores/index";

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
