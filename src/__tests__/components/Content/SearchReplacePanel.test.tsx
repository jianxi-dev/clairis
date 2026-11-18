// @vitest-environment jsdom
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { cleanup, fireEvent, render, act } from "@testing-library/react";

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

const refs = vi.hoisted(() => ({
  views: {} as Record<string, unknown>,
  activeView: { current: null as null | unknown },
}));

vi.mock("../../../editors/editorRef", () => ({
  getEditorView: (panelId: string) => refs.views[panelId] ?? null,
  getActiveEditorView: () => refs.activeView.current,
}));

import SearchReplacePanel from "../../../components/Content/SearchReplacePanel";
import { useSearchFloatStore } from "../../../stores/searchFloat";

const CONTENT = "# 属性面板\n\n属性一\n\n属性二\n";

function fakeView() {
  return { dispatch: vi.fn(), focus: vi.fn() };
}

function renderPanel(panelId = "panel-b") {
  const container = document.createElement("div");
  return render(
    <SearchReplacePanel
      open
      content={CONTENT}
      mode="edit"
      defaultPos="center"
      container={container}
      panelId={panelId}
    />,
  );
}

function keyDown(input: HTMLElement, init: KeyboardEventInit) {
  fireEvent.keyDown(input, init);
}

beforeEach(() => {
  refs.views = {};
  refs.activeView.current = null;
  useSearchFloatStore.getState().close("panel-b");
});

afterEach(() => {
  cleanup();
  useSearchFloatStore.getState().close("panel-b");
});

describe("SearchReplacePanel 行尾快捷键渲染条件", () => {
  function badgeStates(): Array<{
    text: string;
    svg: number;
    aria: string | null;
  }> {
    return Array.from(document.querySelectorAll(".search-float-key")).map(
      (el) => ({
        text: el.textContent ?? "",
        svg: el.querySelectorAll("svg").length,
        aria: el.getAttribute("aria-label"),
      }),
    );
  }

  it("初始选中行显示键帽回车图标，其余 1~9 行显示 ⌘N", () => {
    const { getByTestId } = renderPanel();
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "属性" },
    });
    expect(badgeStates()).toEqual([
      { text: "", svg: 1, aria: "回车" },
      { text: "⌘2", svg: 0, aria: null },
      { text: "⌘3", svg: 0, aria: null },
    ]);
  });

  it("↑↓ 换选后回车图标跟随到新的选中行，无需点击", () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "ArrowDown" });
    expect(badgeStates()).toEqual([
      { text: "⌘1", svg: 0, aria: null },
      { text: "⌘2", svg: 0, aria: null },
      { text: "", svg: 1, aria: "回车" },
    ]);
  });

  it("↑ 换选后回车图标跟随回上一行，无需点击", () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "ArrowUp" });
    expect(badgeStates()).toEqual([
      { text: "⌘1", svg: 0, aria: null },
      { text: "", svg: 1, aria: "回车" },
      { text: "⌘3", svg: 0, aria: null },
    ]);
  });

  it("悬停结果行即把高亮与徽标切到该行（等价 ↑↓）", () => {
    const { getByTestId, getAllByTestId } = renderPanel();
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "属性" },
    });
    fireEvent.mouseEnter(getAllByTestId("search-float-hit")[1]);
    expect(
      getAllByTestId("search-float-hit")[1].classList.contains(
        "search-float-hit-cur",
      ),
    ).toBe(true);
    expect(badgeStates()).toEqual([
      { text: "⌘1", svg: 0, aria: null },
      { text: "", svg: 1, aria: "回车" },
      { text: "⌘3", svg: 0, aria: null },
    ]);
  });

  it("⌘N 直达该行即显示回车图标", () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "2", code: "Digit2", metaKey: true });
    expect(badgeStates()).toEqual([
      { text: "⌘1", svg: 0, aria: null },
      { text: "", svg: 1, aria: "回车" },
      { text: "⌘3", svg: 0, aria: null },
    ]);
  });

  it("第 10 行起无快捷键", () => {
    const { getByTestId } = render(
      <SearchReplacePanel
        open
        content={Array.from({ length: 11 }, () => "命中").join("\n")}
        mode="edit"
        defaultPos="center"
        container={document.createElement("div")}
        panelId="panel-b"
      />,
    );
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "命中" },
    });
    const states = badgeStates();
    expect(states.slice(0, 9)).toEqual([
      { text: "", svg: 1, aria: "回车" },
      { text: "⌘2", svg: 0, aria: null },
      { text: "⌘3", svg: 0, aria: null },
      { text: "⌘4", svg: 0, aria: null },
      { text: "⌘5", svg: 0, aria: null },
      { text: "⌘6", svg: 0, aria: null },
      { text: "⌘7", svg: 0, aria: null },
      { text: "⌘8", svg: 0, aria: null },
      { text: "⌘9", svg: 0, aria: null },
    ]);
    expect(states.slice(9)).toEqual([
      { text: "", svg: 0, aria: null },
      { text: "", svg: 0, aria: null },
    ]);
  });
});

describe("SearchReplacePanel 点击定位到浮窗所属窗格", () => {
  it("点击结果行只对 panelId 对应视图做选区与滚动，不碰全局最近聚焦视图", () => {
    const own = fakeView();
    const active = fakeView();
    refs.views["panel-b"] = own;
    refs.activeView.current = active;

    const { getByTestId, getAllByTestId } = renderPanel("panel-b");
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "属性" },
    });
    fireEvent.click(getAllByTestId("search-float-hit")[1]);

    expect(own.dispatch).toHaveBeenCalledTimes(1);
    expect(own.focus).toHaveBeenCalledTimes(1);
    expect(active.dispatch).not.toHaveBeenCalled();
    expect(active.focus).not.toHaveBeenCalled();

    const arg = (own.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      selection: { anchor: number; head: number };
    };
    expect(arg.selection.head).toBeGreaterThan(arg.selection.anchor);
  });

  it("空态按 Enter 不触发任何视图选区", () => {
    const own = fakeView();
    refs.views["panel-b"] = own;

    const { getByTestId } = renderPanel("panel-b");
    keyDown(getByTestId("search-float-input"), { key: "Enter" });

    expect(own.dispatch).not.toHaveBeenCalled();
  });

  it("Enter 定位选中行同样落到所属窗格", () => {
    const own = fakeView();
    refs.views["panel-b"] = own;
    refs.activeView.current = fakeView();

    const { getByTestId } = renderPanel("panel-b");
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "Enter" });

    expect(own.dispatch).toHaveBeenCalledTimes(1);
    expect(own.focus).toHaveBeenCalledTimes(1);
  });

  it("Enter 定位后焦点还回输入框，↑↓ 换选仍然有效", () => {
    const own = fakeView();
    refs.views["panel-b"] = own;

    const { getByTestId } = renderPanel("panel-b");
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "Enter" });

    expect(own.dispatch).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);

    keyDown(input, { key: "ArrowUp" });
    const cur = document.querySelector(".search-float-hit-cur") as HTMLElement;
    expect(Number(cur.dataset.index)).toBe(0);
  });
});

describe("SearchReplacePanel 预览态点击定位", () => {
  it("mode=preview 点击结果行只滚动所属 container 的命中文本节点，不动其他 container", () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");

    const containerA = document.createElement("div");
    containerA.innerHTML =
      '<div class="preview-content"><p id="a-hit">属性甲</p></div>';
    const containerB = document.createElement("div");
    containerB.innerHTML =
      '<div class="preview-content"><p id="b-hit">属性乙</p><p>属性丙</p></div>';
    document.body.append(containerA, containerB);

    try {
      const { getByTestId, getAllByTestId } = render(
        <SearchReplacePanel
          open
          content={CONTENT}
          mode="preview"
          defaultPos="center"
          container={containerB}
          panelId="panel-b"
        />,
      );
      fireEvent.change(getByTestId("search-float-input"), {
        target: { value: "属性" },
      });
      fireEvent.click(getAllByTestId("search-float-hit")[1]);

      // 浮窗自身还会滚动选中结果行（面板内部节点），这里只观察预览子树，
      // 验证预览定位恰好命中所属 container 的一个文本节点、且不碰其他 container。
      const targets = spy.mock.instances as unknown as HTMLElement[];
      const bTargets = targets.filter((el) => containerB.contains(el));
      const aTargets = targets.filter((el) => containerA.contains(el));

      expect(bTargets).toEqual([document.getElementById("b-hit")]);
      expect(aTargets).toEqual([]);
    } finally {
      spy.mockRestore();
      containerA.remove();
      containerB.remove();
    }
  });
});

describe("SearchReplacePanel 替换与关闭还焦落到所属窗格", () => {
  it("点击「逐个替换」只对 panelId 视图 dispatch，不碰全局最近聚焦视图", () => {
    const own = fakeView();
    const active = fakeView();
    refs.views["panel-b"] = own;
    refs.activeView.current = active;

    const { getByTestId } = renderPanel("panel-b");
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "属性" },
    });
    fireEvent.click(getByTestId("search-float-replace-toggle"));
    fireEvent.change(getByTestId("search-float-replace-input"), {
      target: { value: "特征" },
    });
    fireEvent.click(getByTestId("search-float-replace-one"));

    expect(own.dispatch).toHaveBeenCalledTimes(1);
    expect(active.dispatch).not.toHaveBeenCalled();
    expect(active.focus).not.toHaveBeenCalled();

    const arg = (own.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      changes: unknown[];
    };
    expect(arg.changes).toHaveLength(1);
  });

  it("点击「全部替换」只对 panelId 视图 dispatch，不碰全局最近聚焦视图", () => {
    const own = fakeView();
    const active = fakeView();
    refs.views["panel-b"] = own;
    refs.activeView.current = active;

    const { getByTestId } = renderPanel("panel-b");
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "属性" },
    });
    fireEvent.click(getByTestId("search-float-replace-toggle"));
    fireEvent.change(getByTestId("search-float-replace-input"), {
      target: { value: "特征" },
    });
    fireEvent.click(getByTestId("search-float-replace-all"));

    expect(own.dispatch).toHaveBeenCalledTimes(1);
    expect(active.dispatch).not.toHaveBeenCalled();
    expect(active.focus).not.toHaveBeenCalled();

    const arg = (own.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      changes: unknown[];
    };
    expect(arg.changes).toHaveLength(3);
  });

  it("Esc 关闭后还焦到所属窗格视图，不还焦全局最近聚焦视图", () => {
    const own = fakeView();
    const active = fakeView();
    refs.views["panel-b"] = own;
    refs.activeView.current = active;

    const container = document.createElement("div");
    const view = render(
      <SearchReplacePanel
        open
        content={CONTENT}
        mode="edit"
        defaultPos="center"
        container={container}
        panelId="panel-b"
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(useSearchFloatStore.getState().openPaneId).toBeNull();

    view.rerender(
      <SearchReplacePanel
        open={false}
        content={CONTENT}
        mode="edit"
        defaultPos="center"
        container={container}
        panelId="panel-b"
      />,
    );

    expect(own.focus).toHaveBeenCalledTimes(1);
    expect(active.focus).not.toHaveBeenCalled();
  });
});

describe("SearchReplacePanel 结果行预览态渲染", () => {
  function renderContext(content: string, query: string): HTMLElement {
    const { getByTestId } = render(
      <SearchReplacePanel
        open
        content={content}
        mode="edit"
        defaultPos="center"
        container={document.createElement("div")}
        panelId="panel-b"
      />,
    );
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: query },
    });
    return document.querySelector(".search-float-context") as HTMLElement;
  }

  it("加粗内的命中词由 mark 包裹，片段不出现源码符号", () => {
    const { getByTestId } = render(
      <SearchReplacePanel
        open
        content={"前缀 **加粗命中** 后缀"}
        mode="edit"
        defaultPos="center"
        container={document.createElement("div")}
        panelId="panel-b"
      />,
    );
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "加粗命中" },
    });
    const context = document.querySelector(
      ".search-float-context",
    ) as HTMLElement;
    expect(context.querySelector("b mark")?.textContent).toBe("加粗命中");
    expect(context.textContent).not.toContain("**");
  });

  it("行内代码内的命中词由 mark 包裹", () => {
    const { getByTestId } = render(
      <SearchReplacePanel
        open
        content={"前缀 `代码命中` 后缀"}
        mode="edit"
        defaultPos="center"
        container={document.createElement("div")}
        panelId="panel-b"
      />,
    );
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "代码命中" },
    });
    const context = document.querySelector(
      ".search-float-context",
    ) as HTMLElement;
    expect(context.querySelector("code mark")?.textContent).toBe("代码命中");
    expect(context.textContent).not.toContain("`");
  });

  it("标题片段剥离 # 源码符号，命中仍高亮", () => {
    const { getByTestId } = render(
      <SearchReplacePanel
        open
        content={"# 标题命中"}
        mode="edit"
        defaultPos="center"
        container={document.createElement("div")}
        panelId="panel-b"
      />,
    );
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "标题命中" },
    });
    const context = document.querySelector(
      ".search-float-context",
    ) as HTMLElement;
    expect(context.textContent).not.toContain("#");
    expect(context.querySelector("mark")?.textContent).toBe("标题命中");
  });

  it("多行列表片段逐行剥离标记，命中仍精确包裹", () => {
    const context = renderContext("- 第一项\n- 第二项命中\n- 第三项", "命中");
    expect(context.querySelector("mark")?.textContent).toBe("命中");
    expect(context.textContent).not.toContain("- ");
  });
});

describe("SearchReplacePanel 状态栏自动显隐", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("打开即显示快捷键说明", () => {
    vi.useFakeTimers();
    const { getByTestId } = renderPanel();
    const bar = getByTestId("search-float-statusbar");
    expect(bar.textContent).toBe(
      "↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达（局部 · 浮窗内）· Esc 关闭",
    );
    expect(bar.className).not.toContain("search-float-statusbar-hidden");
  });

  it("指针离开且失焦约 2 秒后隐藏，悬停恢复", () => {
    vi.useFakeTimers();
    const { getByTestId } = renderPanel();
    const float = getByTestId("search-float");
    const bar = getByTestId("search-float-statusbar");

    fireEvent.pointerLeave(float);
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(bar.className).not.toContain("search-float-statusbar-hidden");

    fireEvent.focusOut(float, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(bar.className).not.toContain("search-float-statusbar-hidden");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(bar.className).toContain("search-float-statusbar-hidden");

    fireEvent.pointerEnter(float);
    expect(bar.className).not.toContain("search-float-statusbar-hidden");
  });

  it("失焦后聚焦恢复显示并取消隐藏定时", () => {
    vi.useFakeTimers();
    const { getByTestId } = renderPanel();
    const float = getByTestId("search-float");
    const bar = getByTestId("search-float-statusbar");

    fireEvent.focusOut(float, { relatedTarget: document.body });
    fireEvent.focusIn(float);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(bar.className).not.toContain("search-float-statusbar-hidden");
  });
});
