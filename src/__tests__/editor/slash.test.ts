import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";
import {
  defaultCommands,
  insertSlashChar,
  openInsertMenu,
  registerPickMediaFile,
  setSlashKeyChordResolver,
  slashKeymap,
  slashMenuApply,
  markdownDestination,
  slashMenuClose,
  slashMenuSelectNext,
  slashMenuSelectPrev,
  slashMenuSubmenuBack,
  slashMenuSubmenuEnter,
} from "../../editors/slash";
import { filterSlashCommands } from "../../editors/slash-filter";
import { formatKeyChord } from "../../editors/key-chord";
import { createTestEditor } from "./testEditor";

// jsdom 缺 requestAnimationFrame/ResizeObserver；CodeMirror 6 两者都用。
function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        16,
      )) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

describe("slash commands", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement("div");
    document.body.appendChild(parent);
    // 走真实消费者接缝：markdown + 智能输入 + slashKeymap()。
    view = createTestEditor().view;
    parent = view.dom.parentElement as HTMLElement;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    setSlashKeyChordResolver(null);
  });

  /** 模拟真实输入：字符落进文档。 */
  function typeText(text: string): void {
    const head = view.state.selection.main.head;
    view.dispatch({
      changes: { from: head, insert: text },
      selection: { anchor: head + text.length },
    });
  }

  /** 模拟光标处退格。 */
  function backspace(): void {
    const head = view.state.selection.main.head;
    view.dispatch({
      changes: { from: head - 1, to: head },
      selection: { anchor: head - 1 },
    });
  }

  /**
   * 光标驱动的收起被推迟到微任务（CM6 禁止在插件 update 内 dispatch），
   * 所以断言文档前要排空队列。微任务 FIFO，一次 await 足够。
   */
  async function flushDismiss(): Promise<void> {
    await Promise.resolve();
  }

  it('typing "/" inserts the slash and opens the icon-grid menu', () => {
    const inserted = insertSlashChar(view);
    expect(inserted).toBe(true);
    expect(view.state.doc.toString()).toBe("/");
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
    const grid = view.dom.querySelector(".mdb-slash-grid-menu");
    expect(grid).not.toBeNull();
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(17);
  });

  it("positions the menu relative to the editor origin, not the viewport (issue #203)", () => {
    // 回归锁：#203——coordsAtPos 返回视口坐标，而菜单是 view.dom 的绝对定位子元素。
    // 直接把视口坐标写进 left/top 会让菜单偏移编辑器页面原点。只有两个原点不同时
    // 这个 bug 才可见，所以这里用刻意不同的原点打桩。
    vi.spyOn(view, "coordsAtPos").mockReturnValue({
      left: 456,
      right: 470,
      top: 370,
      bottom: 399,
    });
    vi.spyOn(view.dom, "getBoundingClientRect").mockReturnValue(
      new DOMRect(220, 122, 800, 600),
    );

    insertSlashChar(view);

    const menu = view.dom.querySelector<HTMLElement>(".mdb-slash-menu");
    expect(menu).not.toBeNull();
    // 期望：456 - 220 = 236；399 + 4 - 122 = 281。
    expect(menu?.style.left).toBe("236px");
    expect(menu?.style.top).toBe("281px");
  });

  it("applying the heading row opens the H1–H6 flyout beside the root grid, and choosing a level inserts it", () => {
    insertSlashChar(view);
    // 标题是子菜单入口：应用它会在浮层里打开二级，根列表保持渲染。
    expect(slashMenuApply(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("/");
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(17);

    const flyout = view.dom.querySelector(".mdb-slash-flyout");
    expect(flyout).not.toBeNull();
    const flyoutRows = view.dom.querySelectorAll(".mdb-slash-flyout-item");
    expect(flyoutRows.length).toBe(6);
    expect(flyoutRows[0].textContent).toContain("1 级标题");
    expect(flyoutRows[5].textContent).toContain("6 级标题");

    slashMenuSelectNext(view); // H1 -> H2（浮层选中）
    slashMenuApply(view);
    expect(view.state.doc.toString()).toBe("## ");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it("applying the callout command opens the type flyout and inserts the chosen type", () => {
    insertSlashChar(view);
    // 行按分组渲染；按标签找 标注，不依赖固定下标。
    const rowIndex = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    ).findIndex((row) => row.textContent?.includes("标注"));
    for (let i = 0; i < rowIndex; i++) slashMenuSelectNext(view);
    slashMenuApply(view);
    // 标注是类型浮层入口：第一个子项是 注释（note）。
    expect(view.dom.querySelector(".mdb-slash-flyout")).not.toBeNull();
    expect(slashMenuApply(view)).toBe(true);
    const doc = view.state.doc.toString();
    expect(doc).toContain("> [!NOTE]");
    expect(doc).toMatch(/^> \[!NOTE\]\n> $/);
  });

  it("labels the callout slash command in Chinese without a markdown hint", () => {
    const callout = defaultCommands.find((c) => c.id === "callout");
    expect(callout?.label).toBe("标注");
    // 提示不再回显 markdown 源符号。
    expect(callout?.hint).toBeUndefined();
  });

  it("the table row opens an N × M grid and inserts a GFM table on pick", () => {
    insertSlashChar(view);
    const rows = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    );
    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);

    // 表格行打开网格而不是直接插入。
    expect(view.state.doc.toString()).toBe("/");
    expect(view.dom.querySelectorAll(".mdb-slash-grid-cell").length).toBe(100);

    const cell = view.dom.querySelector<HTMLElement>(
      '.mdb-slash-grid-cell[data-r="3"][data-c="7"]',
    );
    expect(cell).not.toBeNull();
    cell!.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );

    const doc = view.state.doc.toString();
    expect(doc).toContain("|  |  |  |  |  |  |  |");
    expect(doc.split("\n").length).toBe(5); // 表头 + 分隔 + 3 行正文
  });

  it("the table grid keeps the root grid visible and lives inside the flyout layer", () => {
    insertSlashChar(view);
    const rows = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    );
    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);

    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(17);
    const flyout = view.dom.querySelector(".mdb-slash-flyout");
    expect(flyout).not.toBeNull();
    expect(flyout!.querySelectorAll(".mdb-slash-grid-cell").length).toBe(100);
  });

  it("Enter on a hovered table cell inserts that size", () => {
    insertSlashChar(view);
    const rows = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    );
    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);

    const cell = view.dom.querySelector<HTMLElement>(
      '.mdb-slash-grid-cell[data-r="3"][data-c="7"]',
    );
    expect(cell).not.toBeNull();
    cell!.dispatchEvent(new MouseEvent("mouseenter"));

    // Enter 必须应用悬停尺寸，而不是落到默认换行。
    expect(slashMenuApply(view)).toBe(true);
    const doc = view.state.doc.toString();
    expect(doc).toContain("|  |  |  |  |  |  |  |");
    expect(doc.split("\n").length).toBe(5);
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
  });

  it("hovering a table cell selects exactly the top-left rectangle up to the pointer", () => {
    insertSlashChar(view);
    const tableRow = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    ).find((row) => row.textContent?.includes("表格"));
    expect(tableRow).toBeDefined();
    tableRow!.dispatchEvent(new MouseEvent("mouseenter"));

    const onCells = () =>
      view.dom.querySelectorAll('.mdb-slash-grid-cell[data-on="true"]');
    expect(onCells().length).toBe(1);

    const cell = view.dom.querySelector<HTMLElement>(
      '.mdb-slash-grid-cell[data-r="3"][data-c="4"]',
    );
    expect(cell).not.toBeNull();
    cell!.dispatchEvent(new MouseEvent("mouseenter"));
    expect(onCells().length).toBe(12);
  });

  it("sliding from (3,4) back to (1,1) clears the rectangle to one cell", () => {
    insertSlashChar(view);
    const tableRow = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    ).find((row) => row.textContent?.includes("表格"));
    tableRow!.dispatchEvent(new MouseEvent("mouseenter"));

    const at = (r: number, c: number) =>
      view.dom.querySelector<HTMLElement>(
        `.mdb-slash-grid-cell[data-r="${r}"][data-c="${c}"]`,
      )!;
    at(3, 4).dispatchEvent(new MouseEvent("mouseenter"));
    const onCells = () =>
      view.dom.querySelectorAll('.mdb-slash-grid-cell[data-on="true"]');
    expect(onCells().length).toBe(12);

    at(1, 1).dispatchEvent(new MouseEvent("mouseenter"));
    expect(onCells().length).toBe(1);
  });

  it("leaving the table row and returning preserves the previous selection", () => {
    insertSlashChar(view);
    const tableRow = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    ).find((row) => row.textContent?.includes("表格"));
    tableRow!.dispatchEvent(new MouseEvent("mouseenter"));

    const cell = view.dom.querySelector<HTMLElement>(
      '.mdb-slash-grid-cell[data-r="3"][data-c="4"]',
    );
    cell!.dispatchEvent(new MouseEvent("mouseenter"));
    const onCells = () =>
      view.dom.querySelectorAll('.mdb-slash-grid-cell[data-on="true"]');
    expect(onCells().length).toBe(12);

    // 指针从表格行滑进网格（离开该行），再滑回表格行：选中应保留。
    tableRow!.dispatchEvent(new MouseEvent("mouseenter"));
    expect(onCells().length).toBe(12);
  });

  it("the 分栏 row opens a five-option flyout that inserts a complete column div", () => {
    insertSlashChar(view);
    const rows = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    );
    const colIdx = rows.findIndex((row) => row.textContent?.includes("分栏"));
    expect(colIdx).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < colIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);

    expect(view.state.doc.toString()).toBe("/");
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(17);
    const flyoutRows = view.dom.querySelectorAll(".mdb-slash-flyout-item");
    expect(flyoutRows.length).toBe(5);

    slashMenuSelectNext(view); // 分栏 -> 2 栏
    slashMenuApply(view);

    expect(view.state.doc.toString()).toBe("::: {.col-2}\n\n:::");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
  });

  it("分栏 is reachable by pinyin because 栏 is in the PINYIN map", () => {
    insertSlashChar(view);
    typeText("fenlan");
    const cells = () =>
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item");
    expect(cells().length).toBe(1);
    expect(cells()[0].textContent).toContain("分栏");
  });

  it("Escape during the table grid clears both layers and the trigger (no residue)", () => {
    insertSlashChar(view);
    const rows = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    );
    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);
    expect(view.dom.querySelector(".mdb-slash-flyout")).not.toBeNull();

    expect(slashMenuClose(view)).toBe(true);
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
    expect(view.state.doc.toString()).toBe("");
  });

  it("a mousedown outside the menu clears a table grid too (no residue)", () => {
    insertSlashChar(view);
    const rows = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    );
    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
    expect(view.state.doc.toString()).toBe("");
  });

  it("moving the caret away during a table grid clears both layers (no residue)", async () => {
    typeText("before ");
    insertSlashChar(view);
    const rows = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".mdb-slash-item"),
    );
    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);
    expect(view.dom.querySelector(".mdb-slash-flyout")).not.toBeNull();

    view.dispatch({ selection: { anchor: 0 } });
    await flushDismiss();
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
    expect(view.state.doc.toString()).toBe("before ");
  });

  it("Escape dismisses the menu and takes the trigger with it (no residue)", () => {
    insertSlashChar(view);
    typeText("b");
    const closed = slashMenuClose(view);
    expect(closed).toBe(true);
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.state.doc.toString()).toBe("");
    expect(view.state.selection.main.head).toBe(0);
  });

  it("Escape returns false and leaves the document alone when no menu is open", () => {
    typeText("plain text");
    expect(slashMenuClose(view)).toBe(false);
    expect(view.state.doc.toString()).toBe("plain text");
  });

  it("a mousedown outside the menu dismisses it and removes the trigger text", () => {
    insertSlashChar(view);
    typeText("b");
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.state.doc.toString()).toBe("");
  });

  it("a mousedown on the menu itself keeps it open", () => {
    insertSlashChar(view);
    const item = view.dom.querySelector<HTMLElement>(".mdb-slash-item");
    expect(item).not.toBeNull();
    item!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
    expect(view.state.doc.toString()).toBe("/");
  });

  it("moving the caret away from the trigger dismisses the menu (no residue)", async () => {
    typeText("before ");
    insertSlashChar(view);
    typeText("b");
    // 先断言菜单确实打开了：词中的 `/` 会被 insertSlashChar 拒绝，那样下面的
    // 断言就全是空转。
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
    view.dispatch({ selection: { anchor: 0 } });
    await flushDismiss();
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.state.doc.toString()).toBe("before ");
  });

  it("moving the caret to another line takes the trigger but not the surrounding text", async () => {
    typeText("first\n");
    insertSlashChar(view);
    typeText("b");
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
    view.dispatch({ selection: { anchor: 0 } });
    await flushDismiss();
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.state.doc.toString()).toBe("first\n");
  });

  it("moving the caret past text that predates the trigger never deletes that text", async () => {
    typeText("XY");
    view.dispatch({ selection: { anchor: 0 } });
    insertSlashChar(view);
    typeText("b");
    expect(view.state.doc.toString()).toBe("/bXY");
    view.dispatch({ selection: { anchor: 3 } });
    await flushDismiss();
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.state.doc.toString()).toBe("XY");
  });

  it('a second consecutive "/" while the menu is open does not double-insert', () => {
    insertSlashChar(view);
    const second = insertSlashChar(view);
    expect(second).toBe(false);
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
    expect(view.state.doc.toString()).toBe("/");
  });

  it("typing filters the root grid instead of closing the menu", () => {
    insertSlashChar(view);
    const cells = () =>
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item");

    typeText("b");
    expect(view.state.doc.toString()).toBe("/b");
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
    // 标题 / 表格 / 标注 都匹配拼音首字母 b。
    expect(cells().length).toBe(3);
    expect(Array.from(cells()).map((cell) => cell.textContent?.trim())).toEqual(
      expect.arrayContaining([
        expect.stringContaining("标题"),
        expect.stringContaining("表格"),
        expect.stringContaining("标注"),
      ]),
    );

    typeText("t"); // /bt → 只剩 标题
    expect(cells().length).toBe(1);
    expect(cells()[0].textContent).toContain("标题");

    backspace(); // /b
    expect(cells().length).toBe(3);
    backspace(); // /
    expect(cells().length).toBe(17);
  });

  it("shows an empty state for a filter with no match, and a newline closes the menu", () => {
    insertSlashChar(view);
    typeText("zzz");
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(0);
    expect(view.dom.querySelector(".mdb-slash-empty")).not.toBeNull();

    typeText("\n");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("applying a filtered row replaces the slash and the typed query", () => {
    insertSlashChar(view);
    typeText("bt");
    expect(view.state.doc.toString()).toBe("/bt");

    expect(slashMenuApply(view)).toBe(true); // 打开 标题 浮层
    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(6);
    slashMenuSelectNext(view); // H2
    slashMenuApply(view);

    expect(view.state.doc.toString()).toBe("## ");
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it("Enter applies the selected filtered opener row and its chosen type", () => {
    insertSlashChar(view);
    typeText("bz"); // 只剩 标注
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(1);

    expect(slashMenuApply(view)).toBe(true); // 打开类型浮层
    // 13 个编辑端类型——与块菜单渲染的同一集合。
    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(13);
    expect(slashMenuApply(view)).toBe(true); // 应用 注释（note）
    expect(view.state.doc.toString()).toBe("> [!NOTE]\n> ");
  });

  it("ArrowRight opens the flyout and ArrowLeft closes it while the root grid stays", () => {
    insertSlashChar(view);
    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(0);

    expect(slashMenuSubmenuEnter(view)).toBe(true);
    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(6);
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(17);

    expect(slashMenuSubmenuBack(view)).toBe(true);
    expect(view.dom.querySelector(".mdb-slash-flyout")).toBeNull();
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(17);
    expect(view.state.doc.toString()).toBe("/");
  });

  it("hovering a parent cell opens its flyout", () => {
    insertSlashChar(view);
    const headingCell = Array.from(
      view.dom.querySelectorAll<HTMLElement>(
        ".mdb-slash-grid-menu .mdb-slash-item",
      ),
    ).find((cell) => cell.textContent?.includes("标题"));
    expect(headingCell).toBeDefined();

    headingCell!.dispatchEvent(new MouseEvent("mouseenter"));
    expect(view.dom.querySelectorAll(".mdb-slash-flyout-item").length).toBe(6);
  });

  it("ArrowDown/ArrowUp navigate the selected item", () => {
    insertSlashChar(view);
    const items = () => view.dom.querySelectorAll(".mdb-slash-item");
    expect(items()[0].getAttribute("data-selected")).toBe("true");

    expect(slashMenuSelectNext(view)).toBe(true);
    expect(items()[1].getAttribute("data-selected")).toBe("true");
    expect(items()[0].getAttribute("data-selected")).toBeNull();

    expect(slashMenuSelectPrev(view)).toBe(true);
    expect(items()[0].getAttribute("data-selected")).toBe("true");
    expect(items()[1].getAttribute("data-selected")).toBeNull();
  });

  it("command functions return false when the menu is closed", () => {
    expect(slashMenuApply(view)).toBe(false);
    expect(slashMenuSelectNext(view)).toBe(false);
    expect(slashMenuSelectPrev(view)).toBe(false);
    expect(slashMenuClose(view)).toBe(false);
  });

  it("slash does NOT trigger on a non-empty line", () => {
    view.dispatch({
      changes: { from: 0, insert: "hello" },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.state.doc.toString()).toBe("hello");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("slash triggers at the start of an empty line", () => {
    // 空文档——光标在 0（空行行首）。
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe("/");
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
  });

  it("slash triggers on a line with only whitespace before cursor", () => {
    view.dispatch({
      changes: { from: 0, insert: "   " },
      selection: { anchor: 3 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
  });

  it("slash triggers at word start (after space mid-line)", () => {
    view.dispatch({
      changes: { from: 0, insert: "hello " },
      selection: { anchor: 6 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
  });

  it("slash does NOT trigger mid-word (immediately after non-whitespace)", () => {
    view.dispatch({
      changes: { from: 0, insert: "hello" },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("slash does NOT trigger after a word followed by more text", () => {
    view.dispatch({
      changes: { from: 0, insert: "foo bar" },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });
});

describe("insert menu catalog", () => {
  it("groups the 17 root rows into the seven categories, in order", () => {
    expect(defaultCommands).toHaveLength(17);
    const seen: string[] = [];
    for (const cmd of defaultCommands) {
      if (cmd.group && !seen.includes(cmd.group)) seen.push(cmd.group);
    }
    expect(seen).toEqual([
      "基础",
      "常用",
      "数据",
      "绘图",
      "团队协作",
      "进阶",
      "更多小组件",
    ]);
  });

  it("filters /f3 to the 3-column row and /fl3 to nothing", () => {
    const three = filterSlashCommands(defaultCommands, "f3");
    expect(three.map((row) => row.id)).toEqual(["columns-3"]);
    expect(filterSlashCommands(defaultCommands, "fl3")).toEqual([]);
  });
});

describe("slash registry isolation", () => {
  it("does not register its own command ids into any global registry", () => {
    // 菜单直接按 defaultCommands 渲染；污染共享注册表会重复命令面板行，
    // 并遮蔽规范的光标插入命令。本仓库没有命令注册表，这里锁住「菜单不写
    // 全局状态」：模块只导出函数与数据，没有注册副作用。
    const slashOnlyIds = [
      "heading",
      "callout",
      "image-ref",
      "code-block",
      "table",
      "quote",
    ];
    const exported = Object.keys(
      defaultCommands
        .map((c) => c.id)
        .reduce<Record<string, true>>((acc, id) => {
          acc[id] = true;
          return acc;
        }, {}),
    );
    for (const id of slashOnlyIds) {
      expect(
        exported,
        `slash row ${id} must exist in the menu catalog`,
      ).toContain(id);
    }
    // 菜单目录里没有任何注册表句柄。
    expect(defaultCommands.every((c) => !("registered" in c))).toBe(true);
  });
});

describe("slash key chord display", () => {
  let view: EditorView;
  let parent: HTMLElement;

  beforeEach(() => {
    installPolyfills();
    view = createTestEditor().view;
    parent = view.dom.parentElement as HTMLElement;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    setSlashKeyChordResolver(null);
  });

  it("shows no chord when no resolver is injected", () => {
    insertSlashChar(view);
    expect(view.dom.querySelector(".mdb-slash-item-kbd")).toBeNull();
  });

  it("renders the product chord for rows whose command id is bound", () => {
    setSlashKeyChordResolver((id) => (id === "heading-1" ? "Mod-Alt-1" : null));
    insertSlashChar(view);
    slashMenuSubmenuEnter(view); // 打开 标题 浮层
    const kbds = Array.from(
      view.dom.querySelectorAll(".mdb-slash-flyout-kbd"),
    ).map((el) => el.textContent);
    expect(kbds).toEqual([formatKeyChord("Mod-Alt-1")]);
  });

  it("formats chords per platform without throwing on unknown tokens", () => {
    expect(formatKeyChord("Mod-b", true)).toBe("⌘B");
    expect(formatKeyChord("Mod-Shift-x", true)).toBe("⌘⇧X");
    expect(formatKeyChord("Mod-Alt-1", false)).toBe("Ctrl+Alt+1");
    expect(formatKeyChord("Mod-Shift-.", false)).toBe("Ctrl+Shift+.");
    expect(formatKeyChord("", false)).toBe("");
    expect(formatKeyChord("--", false)).toBe("");
  });
});

describe("全角斜杠 / 顿号归一（E-13）", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    view = createTestEditor().view;
    parent = view.dom.parentElement as HTMLElement;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  /** 模拟一次真实键入：userEvent 必须是 input.type，否则过滤器按程序化变更跳过。 */
  function typeAt(pos: number, text: string): void {
    view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
      userEvent: "input.type",
    });
  }

  it("全角斜杠原样保留、不开菜单", async () => {
    typeAt(0, "／");
    await Promise.resolve();
    expect(view.state.doc.toString()).toBe("／");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("顿号原样保留、不开菜单", async () => {
    typeAt(0, "、");
    await Promise.resolve();
    expect(view.state.doc.toString()).toBe("、");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("全角逗号只归一、不开菜单", () => {
    typeAt(0, "你好，世界");
    expect(view.state.doc.toString()).toBe("你好,世界");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  // 注：ViewPlugin 的 compositionstart/compositionend 处理器在 jsdom 里不好测。
  // compositionend 触发菜单的路径由 Playwright e2e 覆盖。
});

describe("media pick commands", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    view = createTestEditor().view;
    parent = view.dom.parentElement as HTMLElement;
  });

  afterEach(() => {
    view?.destroy();
    parent.remove();
  });

  /** 在光标处输入文本；文档变更同步插件把它变成过滤词。 */
  function typeText(text: string): void {
    const head = view.state.selection.main.head;
    view.dispatch({
      changes: { from: head, insert: text },
      selection: { anchor: head + text.length },
    });
  }

  /** 选中根菜单第 `index` 行。 */
  function selectRootRow(index: number): void {
    for (let i = 0; i < index; i++) slashMenuSelectNext(view);
  }

  /**
   * 由测试手动结算的选择器。
   *
   * 这里绝不能用 `vi.waitFor`：它按宏任务轮询，会让 CodeMirror 的 16ms
   * requestAnimationFrame 在视图仍存活时跑 measureTextSize——jsdom 文本节点
   * 没有 getClientRects，会抛未处理错误并让整个 run 失败。捕获 resolver 加
   * 纯微任务刷新永远不会推进帧，afterEach 的 destroy 会在待定 rAF 触发前取消它。
   */
  function deferredPicker(): {
    pickMediaFile: () => Promise<{ name: string; href: string } | null>;
    resolve: (picked: { name: string; href: string } | null) => void;
  } {
    // 用持有者而不是捕获局部变量：executor 在 `deferredPicker` 返回后才重新
    // 绑定 `holder.resolve`，返回的包装必须读最新绑定，否则会调用初始空函数。
    const holder: {
      resolve: (picked: { name: string; href: string } | null) => void;
    } = {
      resolve: () => {},
    };
    const pickMediaFile = vi.fn(
      () =>
        new Promise<{ name: string; href: string } | null>(
          (res) => (holder.resolve = res),
        ),
    );
    return { pickMediaFile, resolve: (picked) => holder.resolve(picked) };
  }

  /** 只排空微任务——绝不推进定时器或 requestAnimationFrame。 */
  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("image-ref and media-ref carry the pickMedia flag (no static insert)", () => {
    const imageRef = defaultCommands.find((c) => c.id === "image-ref");
    const mediaRef = defaultCommands.find((c) => c.id === "media-ref");
    expect(imageRef?.pickMedia).toBe(true);
    expect(mediaRef?.pickMedia).toBe(true);
    expect(imageRef?.insert).toBeUndefined();
    expect(mediaRef?.insert).toBeUndefined();
  });

  it("applying image-ref with an injected picker inserts an editable reference", async () => {
    const picked = { name: "pic.png", href: "assets/pic.png" };
    const { pickMediaFile, resolve } = deferredPicker();
    registerPickMediaFile(view, pickMediaFile);

    insertSlashChar(view);
    selectRootRow(5); // 图片引用
    slashMenuApply(view);

    expect(pickMediaFile).toHaveBeenCalledTimes(1);
    resolve(picked);
    await flushMicrotasks();
    expect(view.state.doc.toString()).toBe("![pic.png](assets/pic.png)");
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("applying media-ref inserts its picked file reference", async () => {
    const picked = { name: "clip.mp4", href: "assets/clip.mp4" };
    const { pickMediaFile, resolve } = deferredPicker();
    registerPickMediaFile(view, pickMediaFile);

    insertSlashChar(view);
    selectRootRow(6); // 视频/文件
    slashMenuApply(view);

    expect(pickMediaFile).toHaveBeenCalledTimes(1);
    resolve(picked);
    await flushMicrotasks();
    expect(view.state.doc.toString()).toBe("![clip.mp4](assets/clip.mp4)");
  });

  it("applying image-ref without an injected picker removes the trigger and inserts nothing", () => {
    insertSlashChar(view);
    selectRootRow(5);
    slashMenuApply(view);

    expect(view.state.doc.toString()).toBe("");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("a no-picker apply removes the typed /query (no residue)", () => {
    insertSlashChar(view);
    typeText("img");
    expect(view.state.doc.toString()).toBe("/img");
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(1);

    expect(slashMenuApply(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("a cancelled picker (null) removes the trigger and inserts nothing", async () => {
    const { pickMediaFile, resolve } = deferredPicker();
    registerPickMediaFile(view, pickMediaFile);

    insertSlashChar(view);
    selectRootRow(5);
    slashMenuApply(view);

    expect(pickMediaFile).toHaveBeenCalledTimes(1);
    resolve(null);
    await flushMicrotasks();
    expect(view.state.doc.toString()).toBe("");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("a cancelled picker also removes a typed /query (no residue)", async () => {
    const { pickMediaFile, resolve } = deferredPicker();
    registerPickMediaFile(view, pickMediaFile);

    insertSlashChar(view);
    typeText("v");
    expect(view.state.doc.toString()).toBe("/v");
    expect(
      view.dom.querySelectorAll(".mdb-slash-grid-menu .mdb-slash-item").length,
    ).toBe(1);

    expect(slashMenuApply(view)).toBe(true);
    resolve(null);
    await flushMicrotasks();
    expect(view.state.doc.toString()).toBe("");
    expect(view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("an anchored (table cell) apply inserts at the anchor even when the caret precedes it", async () => {
    const picked = { name: "pic.png", href: "assets/pic.png" };
    const { pickMediaFile, resolve } = deferredPicker();
    registerPickMediaFile(view, pickMediaFile);

    view.dispatch({ changes: { from: 0, insert: "abcdef" } });
    // 光标刻意停在锚点之前：单元格菜单靠悬停把手打开，所以插入必须基于位置，
    // 而不是基于光标。
    view.dispatch({ selection: { anchor: 0 } });
    openInsertMenu(view, 2, defaultCommands, { from: 2, to: 2 });
    selectRootRow(5);
    slashMenuApply(view);

    resolve(picked);
    await flushMicrotasks();
    expect(view.state.doc.toString()).toBe("ab![pic.png](assets/pic.png)cdef");
  });

  it("a below (block handle) apply inserts the reference on a new line at the block end", async () => {
    const picked = { name: "pic.png", href: "assets/pic.png" };
    const { pickMediaFile, resolve } = deferredPicker();
    registerPickMediaFile(view, pickMediaFile);

    view.dispatch({ changes: { from: 0, insert: "abc" } });
    openInsertMenu(view, 3, defaultCommands, { from: 3, to: 3 }, "below");
    selectRootRow(5);
    slashMenuApply(view);

    resolve(picked);
    await flushMicrotasks();
    expect(view.state.doc.toString()).toBe("abc\n![pic.png](assets/pic.png)");
  });
});

describe("slash menu lifecycle", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    view = createTestEditor().view;
    parent = view.dom.parentElement as HTMLElement;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it("leaves no menu node in the DOM after Escape", () => {
    insertSlashChar(view);
    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(1);
    slashMenuClose(view);
    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(0);
    expect(document.querySelectorAll(".mdb-slash-flyout").length).toBe(0);
  });

  it("destroys the open menu with the view (ViewPlugin destroy)", () => {
    insertSlashChar(view);
    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(1);
    view.destroy();
    expect(document.querySelectorAll(".mdb-slash-menu").length).toBe(0);
    // afterEach 再 destroy 一次是幂等的。
    view = createTestEditor().view;
    parent = view.dom.parentElement as HTMLElement;
  });

  it("typing '/' is not swallowed by smart input (the slash lands in the doc)", () => {
    // 智能输入的 inputHandler 只配对特定字符；`/` 必须原样落进文档并开菜单。
    const handled = insertSlashChar(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe("/");
  });

  it("Enter and Escape fall through to default behavior while the menu is closed", () => {
    view.dispatch({
      changes: { from: 0, insert: "text" },
      selection: { anchor: 4 },
    });
    expect(slashMenuApply(view)).toBe(false);
    expect(slashMenuClose(view)).toBe(false);
    expect(view.state.doc.toString()).toBe("text");
  });
});

describe("markdownDestination（含空格的文件名）", () => {
  it("普通路径不加包装", () => {
    expect(markdownDestination("assets/pic.png")).toBe("assets/pic.png");
  });

  it("含空格/括号时用尖括号包住，否则整段退化成正文", () => {
    expect(markdownDestination("assets/a b.mp4")).toBe("<assets/a b.mp4>");
    expect(markdownDestination("assets/a(1).png")).toBe("<assets/a(1).png>");
    expect(markdownDestination("assets/中文 名 视频.mp4")).toBe(
      "<assets/中文 名 视频.mp4>",
    );
  });
});
