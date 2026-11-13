/**
 * 高亮块正文统一斜杠菜单（#743）。
 *
 * 真实 EditorView 路径：按正文开 textarea，输入 `/` 打开统一斜杠菜单，选中写回
 * textarea，blur commit 后落文档；Esc 回滚不留 `/` 残留。独立片段菜单退役
 * （A-4.6），片段表映射为统一命令（A-4.4）。
 *
 * jsdom 缺 requestAnimationFrame / ResizeObserver，CM6 两者都用。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  editorDecorations,
  resetDecorationGuards,
} from "../../editors/decorations";
import { openCalloutContextMenu } from "../../editors/decorations/callout";
import { getCalloutSlashCommands } from "../../editors/decorations/callout-insert";
import {
  slashMenuApply,
  slashMenuClose,
  type SlashCommand,
} from "../../editors/slash";

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

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 30));

describe("callout editor slash context (#743)", () => {
  let parent: HTMLElement;
  let view: EditorView;

  const DOC = "> [!NOTE] 标题\n> 正文\n\n段落";

  beforeEach(() => {
    installPolyfills();
    resetDecorationGuards();
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
    resetDecorationGuards();
  });

  /** 走真实入口：按压正文打开就地编辑器。 */
  async function openEditor(): Promise<HTMLTextAreaElement> {
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: DOC,
        extensions: [markdown(), editorDecorations()],
      }),
    });
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();
    const content = view.dom.querySelector<HTMLElement>(".cm-callout-content");
    expect(content).not.toBeNull();
    content?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    const area = view.dom.querySelector<HTMLTextAreaElement>(
      '[data-testid="cm-callout-editor"]',
    );
    expect(area).not.toBeNull();
    return area as HTMLTextAreaElement;
  }

  /** 确定性行内命令：insert 固定文本，不依赖媒体选择器。 */
  const inlineCommand: SlashCommand = {
    id: "test-inline",
    label: "测试行内",
    inline: true,
    insert: () => ({ from: 0, to: 0, text: "测试片段" }),
  };

  it("片段表映射为统一斜杠命令（A-4.4）", () => {
    const commands = getCalloutSlashCommands();
    expect(commands.length).toBeGreaterThan(0);
    const link = commands.find((cmd) => cmd.id === "callout-snippet-link");
    expect(link?.label).toBe("链接");
    expect(link?.insert?.(EditorState.create({})).text).toBe("[](url)");
  });

  it("斜杠触发：输入 / 打开统一菜单、焦点留在 textarea、文档逐字节不变", async () => {
    const area = await openEditor();
    expect(area.value).toBe("正文");

    area.value = "正文/";
    area.setSelectionRange(3, 3);
    area.dispatchEvent(new Event("input", { bubbles: true }));

    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
    expect(document.activeElement).toBe(area);
    expect(view.state.doc.toString()).toBe(DOC);
  });

  it("斜杠模式：applyText 替换 /query，commit 后源码含插入值、其余字节不变", async () => {
    const area = await openEditor();
    area.value = "正文/";
    area.setSelectionRange(3, 3);

    openCalloutContextMenu(view, area, [inlineCommand], true);
    expect(slashMenuApply(view)).toBe(true);
    expect(area.value).toBe("正文测试片段");

    // 选中只写回 textarea；失焦 commit 后落文档。
    area.dispatchEvent(new Event("blur"));
    expect(view.state.doc.toString()).toBe(
      "> [!NOTE] 标题\n> 正文测试片段\n\n段落",
    );
  });

  it("Esc 取消：textarea 回滚到打开前，无 / 残留", async () => {
    const area = await openEditor();
    area.value = "正文/查询";
    area.setSelectionRange(5, 5);

    openCalloutContextMenu(view, area, [inlineCommand], true);
    expect(slashMenuClose(view)).toBe(true);
    expect(area.value).toBe("正文");
    expect(area.value).not.toContain("/");
  });

  it("把手模式：applyText 在光标处零宽插入（无斜杠可替换）", async () => {
    const area = await openEditor();
    area.value = "正文内容";
    area.setSelectionRange(2, 2);

    openCalloutContextMenu(view, area, [inlineCommand], false);
    expect(slashMenuApply(view)).toBe(true);
    expect(area.value).toBe("正文测试片段内容");

    area.dispatchEvent(new Event("blur"));
    expect(view.state.doc.toString()).toBe(
      "> [!NOTE] 标题\n> 正文测试片段内容\n\n段落",
    );
  });

  it("「+」手柄：点击打开同一菜单（把手模式），焦点留在 textarea", async () => {
    const area = await openEditor();
    const handle = view.dom.querySelector<HTMLElement>(
      ".cm-callout-add-handle",
    );
    expect(handle).not.toBeNull();
    handle?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );

    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
    expect(document.activeElement).toBe(area);
    // 把手模式无斜杠可回滚：Esc 不改 textarea。
    expect(slashMenuClose(view)).toBe(true);
    expect(area.value).toBe("正文");
    expect(area.value).not.toContain("/");
  });

  it("独立片段菜单 DOM 不出现（A-4.6）", async () => {
    const area = await openEditor();
    area.value = "正文/";
    area.setSelectionRange(3, 3);
    area.dispatchEvent(new Event("input", { bubbles: true }));

    expect(view.dom.querySelectorAll(".mdb-slash-menu")).toHaveLength(1);
    expect(view.dom.querySelectorAll(".cm-callout-insert-menu")).toHaveLength(
      0,
    );
    expect(
      view.dom.querySelector('[data-testid="cm-callout-insert-menu"]'),
    ).toBeNull();
  });
});
