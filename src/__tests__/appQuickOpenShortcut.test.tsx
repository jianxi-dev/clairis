// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  fireEvent,
  screen,
  cleanup,
  waitFor,
} from "@testing-library/react";
import App from "../App";
import { useStore } from "../stores/index";
import type { Tab } from "../types";

function tab(id: string, title: string): Tab {
  return {
    id,
    title,
    path: `/lib/${title}`,
    fileKind: "markdown",
    content: "",
    dirty: false,
    editorMode: "preview",
    scrollPos: 0,
    contentHeight: 0,
  };
}

beforeEach(() => {
  useStore.setState({
    scene: "workspace",
    activeTabId: "t1",
    tabs: { t1: tab("t1", "甲文档.md") },
    recentFiles: [
      {
        path: "/lib/乙文档.md",
        title: "乙文档.md",
        openedAt: "2026-01-01T00:00:00.000Z",
        excerpt: "",
      },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App ⌘P 拦截原生打印", () => {
  it("preventDefault 被调用、quick-open 打开、window.print 未触发", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const beforePrint = vi.fn();
    window.addEventListener("beforeprint", beforePrint);

    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("grid-entry")).toBeInTheDocument(),
    );

    let prevented = false;
    const recorder = (e: Event) => {
      prevented = e.defaultPrevented;
    };
    window.addEventListener("keydown", recorder);
    fireEvent.keyDown(window, { key: "p", metaKey: true });
    window.removeEventListener("keydown", recorder);

    expect(screen.getByTestId("quick-open")).toBeInTheDocument();
    expect(prevented).toBe(true);
    expect(printSpy).not.toHaveBeenCalled();
    expect(beforePrint).not.toHaveBeenCalled();

    window.removeEventListener("beforeprint", beforePrint);
  });

  it("Ctrl+P 同样打开 quick-open", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("grid-entry")).toBeInTheDocument(),
    );
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    expect(screen.getByTestId("quick-open")).toBeInTheDocument();
  });

  it("输入法组合态不拦截（不打开、不 preventDefault）", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("grid-entry")).toBeInTheDocument(),
    );
    const event = new KeyboardEvent("keydown", {
      key: "p",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "isComposing", { value: true });
    window.dispatchEvent(event);
    expect(screen.queryByTestId("quick-open")).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it("再次按下关闭 quick-open", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("grid-entry")).toBeInTheDocument(),
    );
    fireEvent.keyDown(window, { key: "p", metaKey: true });
    expect(screen.getByTestId("quick-open")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "p", metaKey: true });
    expect(screen.queryByTestId("quick-open")).toBeNull();
  });

  it("⌘⇧P 仍是收藏，不打开 quick-open", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("grid-entry")).toBeInTheDocument(),
    );
    fireEvent.keyDown(window, { key: "p", metaKey: true, shiftKey: true });
    expect(screen.queryByTestId("quick-open")).toBeNull();
  });
});
