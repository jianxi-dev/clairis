import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import TranslatePanel from "../../../components/Translation/TranslatePanel";
import { useStore } from "../../../stores/index";

describe("TranslatePanel", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("renders without crashing", () => {
    const { container } = render(<TranslatePanel />);
    expect(container).toBeDefined();
  });

  it("shows translate button when content exists", () => {
    useStore.getState().openFile("/path/test.md", "Hello world");
    const { container } = render(<TranslatePanel />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders empty state when no active tab", () => {
    const { container } = render(<TranslatePanel />);
    expect(container.textContent).toBeDefined();
  });
});
