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
import { cleanup, fireEvent, render } from "@testing-library/react";

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
  it("初始选中行显示 ⏎，其余 1~9 行显示 ⌘N", () => {
    const { getByTestId } = renderPanel();
    fireEvent.change(getByTestId("search-float-input"), {
      target: { value: "属性" },
    });
    const keys = Array.from(document.querySelectorAll(".search-float-key")).map(
      (el) => el.textContent,
    );
    expect(keys).toEqual(["⏎", "⌘2", "⌘3"]);
  });

  it("↑↓ 换选后 ⏎ 跟随到新的选中行，无需点击", () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "ArrowDown" });
    const keys = Array.from(document.querySelectorAll(".search-float-key")).map(
      (el) => el.textContent,
    );
    expect(keys).toEqual(["⌘1", "⌘2", "⏎"]);
  });

  it("↑ 换选后 ⏎ 跟随回上一行，无需点击", () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "ArrowDown" });
    keyDown(input, { key: "ArrowUp" });
    const keys = Array.from(document.querySelectorAll(".search-float-key")).map(
      (el) => el.textContent,
    );
    expect(keys).toEqual(["⌘1", "⏎", "⌘3"]);
  });

  it("⌘N 直达该行即显示 ⏎", () => {
    const { getByTestId } = renderPanel();
    const input = getByTestId("search-float-input");
    fireEvent.change(input, { target: { value: "属性" } });
    keyDown(input, { key: "2", code: "Digit2", metaKey: true });
    const keys = Array.from(document.querySelectorAll(".search-float-key")).map(
      (el) => el.textContent,
    );
    expect(keys).toEqual(["⌘1", "⏎", "⌘3"]);
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
    const keys = Array.from(document.querySelectorAll(".search-float-key")).map(
      (el) => el.textContent,
    );
    expect(keys.slice(0, 9)).toEqual([
      "⏎",
      "⌘2",
      "⌘3",
      "⌘4",
      "⌘5",
      "⌘6",
      "⌘7",
      "⌘8",
      "⌘9",
    ]);
    expect(keys.slice(9)).toEqual(["", ""]);
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
