// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import QuickOpen from "../components/QuickOpen";
import { useStore } from "../stores/index";
import type { Tab } from "../types";

function tab(id: string, title: string, path: string): Tab {
  return {
    id,
    title,
    path,
    fileKind: "markdown",
    content: "",
    dirty: false,
    editorMode: "preview",
    scrollPos: 0,
    contentHeight: 0,
  };
}

function seed() {
  useStore.setState({
    scene: "workspace",
    activeTabId: "t1",
    tabs: {
      t1: tab("t1", "甲文档.md", "/lib/甲文档.md"),
      t2: tab("t2", "乙笔记.md", "/lib/乙笔记.md"),
    },
    recentFiles: [
      {
        path: "/lib/丙报告.md",
        title: "丙报告.md",
        openedAt: "2026-01-01T00:00:00.000Z",
        excerpt: "",
      },
    ],
  });
}

function setup(query = "") {
  const props = {
    open: true,
    query,
    onQueryChange: vi.fn(),
    onClose: vi.fn(),
    onOpenTab: vi.fn(),
    onOpenPath: vi.fn(),
    onOpenGrid: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  render(<QuickOpen {...props} />);
  return props;
}

beforeEach(seed);
afterEach(cleanup);

describe("QuickOpen —— 三类结果与过滤", () => {
  it("空查询时三类分组都渲染", () => {
    setup();
    expect(screen.getByTestId("quick-open")).toBeInTheDocument();
    expect(screen.getByText("页签")).toBeInTheDocument();
    expect(screen.getByText("最近文件")).toBeInTheDocument();
    expect(screen.getByText("命令")).toBeInTheDocument();
    expect(screen.getAllByTestId("quick-open-row")).toHaveLength(5);
  });

  it("输入跨三类联合过滤：只保留命中项", () => {
    setup("甲");
    const items = screen.getAllByTestId("quick-open-row");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute("data-quick-kind", "tab");
    expect(items[0]).toHaveAttribute("data-quick-id", "tab:t1");
    expect(screen.queryByText("最近文件")).toBeNull();
  });

  it("按命令名过滤出命令项", () => {
    setup("网格");
    const items = screen.getAllByTestId("quick-open-row");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute("data-quick-kind", "command");
    expect(items[0]).toHaveAttribute("data-quick-id", "cmd:grid");
  });

  it("无命中显示空态", () => {
    setup("不存在的关键字xyz");
    expect(screen.getByTestId("quick-open-empty")).toBeInTheDocument();
    expect(screen.queryAllByTestId("quick-open-row")).toHaveLength(0);
  });

  it("命中片段高亮（mark 元素）", () => {
    setup("甲");
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent).toBe("甲");
  });

  it("最近文件与页签同路径时去重，只保留页签", () => {
    useStore.setState({
      recentFiles: [
        {
          path: "/lib/甲文档.md",
          title: "甲文档.md",
          openedAt: "2026-01-01T00:00:00.000Z",
          excerpt: "",
        },
        {
          path: "/lib/丙报告.md",
          title: "丙报告.md",
          openedAt: "2026-01-01T00:00:00.000Z",
          excerpt: "",
        },
      ],
    });
    setup();
    const items = screen.getAllByTestId("quick-open-row");
    // 2 个页签 + 1 个未打开的最近文件 + 2 个命令
    expect(items).toHaveLength(5);
    expect(
      items.filter((el) => el.getAttribute("data-quick-kind") === "recent"),
    ).toHaveLength(1);
    expect(
      items.find((el) => el.getAttribute("data-quick-kind") === "recent"),
    ).toHaveAttribute("data-quick-id", "recent:/lib/丙报告.md");
  });
});

describe("QuickOpen —— 键盘与执行", () => {
  it("Enter 执行选中的命令项并关闭", () => {
    const props = setup("网格");
    fireEvent.keyDown(window, { key: "Enter" });
    expect(props.onOpenGrid).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("↑↓ 在结果间移动选中", () => {
    setup();
    const items = screen.getAllByTestId("quick-open-row");
    expect(items[0]).toHaveAttribute("data-active", "true");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    const afterDown = screen.getAllByTestId("quick-open-row");
    expect(afterDown[1]).toHaveAttribute("data-active", "true");

    fireEvent.keyDown(window, { key: "ArrowUp" });
    const afterUp = screen.getAllByTestId("quick-open-row");
    expect(afterUp[0]).toHaveAttribute("data-active", "true");
  });

  it("Esc 关闭且不执行任何动作", () => {
    const props = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onOpenGrid).not.toHaveBeenCalled();
    expect(props.onOpenSettings).not.toHaveBeenCalled();
  });

  it("点击命令项触发对应动作", () => {
    const props = setup("设置");
    fireEvent.click(screen.getByTestId("quick-open-row"));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("点击页签项触发 onOpenTab", () => {
    const props = setup("甲");
    fireEvent.click(screen.getByTestId("quick-open-row"));
    expect(props.onOpenTab).toHaveBeenCalledWith("t1");
  });

  it("点击最近文件触发 onOpenPath", () => {
    const props = setup("丙");
    fireEvent.click(screen.getByTestId("quick-open-row"));
    expect(props.onOpenPath).toHaveBeenCalledWith("/lib/丙报告.md");
  });

  it("遮罩 mousedown 关闭，面板内 mousedown 不关闭", () => {
    const props = setup();
    fireEvent.mouseDown(screen.getByTestId("quick-open-input"));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByTestId("quick-open"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("重开时选中态回到首行", () => {
    const props = {
      open: true,
      query: "",
      onQueryChange: vi.fn(),
      onClose: vi.fn(),
      onOpenTab: vi.fn(),
      onOpenPath: vi.fn(),
      onOpenGrid: vi.fn(),
      onOpenSettings: vi.fn(),
    };
    const { rerender } = render(<QuickOpen {...props} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    const moved = screen.getAllByTestId("quick-open-row");
    expect(moved[1]).toHaveAttribute("data-active", "true");

    rerender(<QuickOpen {...props} open={false} />);
    rerender(<QuickOpen {...props} open={true} />);
    const reopened = screen.getAllByTestId("quick-open-row");
    expect(reopened[0]).toHaveAttribute("data-active", "true");
  });
});
