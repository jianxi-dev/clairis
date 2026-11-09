import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState, Compartment, Transaction } from "@codemirror/state";
import { history } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { yaml } from "@codemirror/lang-yaml";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores/index";
import { isMediaKind } from "../../stores/index";
import { useEditorStore } from "../../stores/editorStore";
import {
  baseEditorExtensions,
  decorCompartment,
  fullDecorations,
  historyCompartment,
} from "../../editors/setup";
import type { EditorDecorationsOptions } from "../../editors/decorations";
import {
  slashKeymap,
  setUserSlashCommands,
  registerPickMediaFile,
} from "../../editors/slash";
import { loadUserExtensions } from "../../editors/user-extensions";
import HtmlVisualEditor from "./HtmlVisualEditor";
import { horizontalToolbar } from "../../editors/orchestration/horizontal-toolbar";
import { floatingToolbar } from "../../editors/orchestration/floating-toolbar";
import { smartInput } from "../../editors/smart-input";
import { blockHandle } from "../../editors/orchestration/block-handle";
import {
  setEditorView,
  setActivePanel,
  setPanelScrollEl,
} from "../../editors/editorRef";
import { resolveScrollTarget } from "../../utils/scrollPosition";
import { pickMediaForDocument } from "../../lib/mediaPicker";
import { resolveDocMediaHref } from "../../lib/mediaUrl";
import { renderAllStatic } from "../../renderers/diagram/engine";
import PreviewView from "./PreviewView";
import OutlineMenu from "./OutlineMenu";
import ReadingProgressInk from "./ReadingProgressInk";
import type { EditorMode, FileKind, Tab } from "../../types";

const langCompartment = new Compartment();

/** 编辑态 mermaid 水合：把装饰 widget 里的源码块渲染成 SVG。
 *  走适配层的静态 `render()` 路径（design D4，无 ResizeObserver）；主题由
 *  CSS 变量驱动（D5），theme 参数仅为水合器签名保留，不再写 dataset。 */
function hydrateMermaid(
  root: HTMLElement,
  _theme: "dark" | "light",
): Promise<void> {
  return renderAllStatic(root);
}

/**
 * 编辑态装饰选项。
 *
 * 图片解析器读模块级当前文档路径：装饰选项在模块作用域构造一次，而文档随
 * 页签切换——用 getter 而不是把路径烘进常量，切页签后新插入的相对引用才
 * 找得到同级的 `assets/`。
 */
let activeDocPath: string | null = null;

const editorDecorationOptions: EditorDecorationsOptions = {
  hydrateMermaid,
  resolveImage: (path) => resolveDocMediaHref(path, activeDocPath),
};

function createLanguageExtension(kind: FileKind) {
  switch (kind) {
    case "markdown":
      return [
        markdown({ base: markdownLanguage }),
        smartInput(),
        slashKeymap(),
        blockHandle(),
        decorCompartment.of(fullDecorations(editorDecorationOptions)),
      ];
    case "html":
      return [html(), horizontalToolbar()];
    case "css":
      return [css(), horizontalToolbar()];
    case "python":
      return [python(), horizontalToolbar()];
    case "json":
      return [json(), horizontalToolbar()];
    case "javascript":
      return [javascript({ typescript: true }), horizontalToolbar()];
    case "yaml":
      return [yaml(), horizontalToolbar()];
    default:
      return [];
  }
}

interface ContentAreaProps {
  panelId?: string;
  /** Override which tab to show (for split panels) */
  tabOverride?: Tab | null;
  /** Override editor mode (for split panels) */
  modeOverride?: EditorMode;
}

export default function ContentArea({
  panelId = "main",
  tabOverride,
  modeOverride,
}: ContentAreaProps) {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const readingMode = useStore((s) => s.readingMode);
  const activeTab = activeTabId ? tabs[activeTabId] : null;

  // tabOverride for split panels, otherwise use activeTab
  const tab = tabOverride !== undefined ? tabOverride : activeTab;
  const editorMode = isMediaKind(tab?.fileKind ?? "text")
    ? "preview"
    : modeOverride || (activeTab?.editorMode ?? "preview");

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorViewState, setEditorViewState] = useState<EditorView | null>(
    null,
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const currentKindRef = useRef<FileKind | null>(null);
  const currentTabIdRef = useRef<string | null>(null);
  /** 当前页签的绝对路径：媒体导入要落在文档同级 assets/ 下。 */
  const tabPathRef = useRef<string | null>(null);
  const restoredTabRef = useRef<string | null>(null);

  // Keep tab ID ref current so the updateListener closure can read it
  currentTabIdRef.current = tab?.id || null;
  tabPathRef.current = tab?.path || null;
  activeDocPath = tab?.path || null;

  // 与 PreviewView 的 `.preview-content` 注入同一组变量，两个模式才会同貌。
  const headingColors = useEditorStore((s) => s.headingColors);
  const readerFontSize = useEditorStore((s) => s.config.readerFontSize);
  const readerWidth = useEditorStore((s) => s.config.readerWidth);

  const editorThemeVars = useMemo(() => {
    const vars: Record<string, string> = {};
    if (headingColors) {
      for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
        const color = headingColors[level];
        if (color) vars[`--heading-${level}`] = color;
      }
    }
    if (readerFontSize) vars["--type-font-size"] = `${readerFontSize}px`;
    if (readerWidth) {
      vars["--type-measure"] = `${readerWidth}px`;
      vars["--type-measure-wide"] = `${Math.min(readerWidth + 120, 1400)}px`;
    }
    return vars as React.CSSProperties;
  }, [headingColors, readerFontSize, readerWidth]);

  // Register preview scroll container for scroll position capture
  useEffect(() => {
    const el = scrollContainerRef.current;
    setScrollContainer(el);
    setPanelScrollEl(panelId, el);
    return () => setPanelScrollEl(panelId, null);
  }, [panelId]);

  // Persist scroll position: 200ms debounce after scrolling stops (A-9)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const tabId = currentTabIdRef.current;
        if (tabId) {
          useStore
            .getState()
            .updateScrollPos(tabId, el.scrollTop, el.scrollHeight);
        }
      }, 200);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [panelId]);

  // Restore scroll position once per tab open/switch (A-9)
  useEffect(() => {
    if (editorMode !== "preview" || !tab?.path) return;
    if (restoredTabRef.current === tab.id) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const record = useStore.getState().scrollPositions[tab.path];
    const target = resolveScrollTarget(
      record,
      el.scrollHeight,
      el.clientHeight,
    );
    if (target === null) return;
    el.scrollTop = target;
    restoredTabRef.current = tab.id;
  }, [tab?.id, tab?.path, editorMode]);

  // 首次打开文件时先写一条 0% 记录：阅读空间卡片据此显示「已读 0%」
  // 并在滚动后增长；没有记录时卡片不会渲染进度条（#252）。
  useEffect(() => {
    if (!tab?.path) return;
    const store = useStore.getState();
    if (store.scrollPositions[tab.path]) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      useStore
        .getState()
        .updateScrollPos(
          tab.id,
          el.scrollTop,
          el.scrollHeight || el.clientHeight,
        );
    });
    return () => cancelAnimationFrame(frame);
  }, [tab?.id, tab?.path]);

  // 打开即落一条 0% 的阅读记录：否则卡片在用户第一次滚动前没有数据，
  // 进度条永远不出现（#252）。
  useEffect(() => {
    if (!tab?.path) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const path = tab.path;
    const tabId = tab.id;
    const raf = requestAnimationFrame(() => {
      const store = useStore.getState();
      if (!store.scrollPositions[path]) {
        store.updateScrollPos(tabId, el.scrollTop, el.scrollHeight);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [tab?.id, tab?.path, editorMode]);

  // Create EditorView once per panelId
  useEffect(() => {
    if (viewRef.current || !editorRef.current) return;

    const state = EditorState.create({
      doc: "",
      extensions: [
        ...baseEditorExtensions(),
        historyCompartment.of(history()),
        langCompartment.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            const tabId = currentTabIdRef.current;
            if (tabId) {
              useStore.getState().updateTabContent(tabId, content);
            } else {
              useStore.getState().updateContent(content);
            }
          }
        }),
        EditorView.domEventHandlers({
          focus: () => setActivePanel(panelId),
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: editorRef.current });
    setEditorView(panelId, viewRef.current);
    setEditorViewState(viewRef.current);
    // 媒体选择走宿主：编辑器只发「请给我一个文件」，落点在哪儿由这里决定。
    // 挂载只跑一次，所以用 ref 读当前页签路径，避免闭包停在打开第一天的文档上。
    registerPickMediaFile(viewRef.current, () =>
      pickMediaForDocument(tabPathRef.current),
    );

    // 用户片段：编辑器创建后加载一次并注册进斜杠菜单。加载失败静默——菜单退回
    // 纯内置命令（`list_extensions` 在纯浏览器/老版本里不存在）。
    void loadUserExtensions(invoke).then((commands) => {
      setUserSlashCommands(commands);
    });

    return () => {
      setEditorView(panelId, null);
      setEditorViewState(null);
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [panelId]);

  /**
   * `.html` 的「编辑」走可视化面板，CM6 退到源码模式（design D7）。
   *
   * CM6 容器只是被 `display:none` 藏起来，**不销毁**——这样源码模式的 undo 栈
   * 与选区在 可视化 → 源码 之间来回切时都还在。
   */
  const htmlVisual = tab?.fileKind === "html" && editorMode === "edit";
  const cmVisible = !!tab && editorMode !== "preview" && !htmlVisual;
  const tabId = tab?.id;

  // 撤销历史不跨页签（#321）：一个面板只有一个 EditorView，历史却是
  // EditorState 的一部分。切页签时清空它，否则 A 页签的编辑会让 B 页签的
  // 一次 Ctrl+Z 把 B 的内容退回成 A 的内容。`reconfigure([])` 摘掉 history
  // 字段再装回才会重新初始化（见 setup.ts 的 historyCompartment 注释）。
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !tabId) return;
    view.dispatch({ effects: historyCompartment.reconfigure([]) });
    view.dispatch({ effects: historyCompartment.reconfigure(history()) });
  }, [tabId]);

  // Sync tab content → editor
  useEffect(() => {
    if (!viewRef.current || !tab) return;
    // 预览态不预热编辑器：把整篇文档 dispatch 进 CM6 会同步跑一遍语法解析，
    // 大 HTML 首屏被它拖慢；初始 dispatch 还会把页签标脏，让 HTML 预览从
    // asset 直载退回禁脚本的 srcdoc。首次切到编辑/源码时再同步（#276）。
    if (!cmVisible) return;

    const current = viewRef.current.state.doc.toString();
    if (current !== tab.content) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: tab.content },
        // 内容同步不是用户编辑，不能进历史：否则一次 Ctrl+Z 会退回同步前的
        // 空文档，把整篇正文清空且无法恢复（#321）。
        annotations: Transaction.addToHistory.of(false),
      });
    }

    if (tab.fileKind !== currentKindRef.current) {
      currentKindRef.current = tab.fileKind;
      viewRef.current.dispatch({
        effects: langCompartment.reconfigure(
          createLanguageExtension(tab.fileKind),
        ),
      });
    }
    // `tab.content` 也要跟进：可视化编辑不经过 CM6，改完切到源码时必须把新内容
    // dispatch 进去，否则源码里还是打开时的旧文档，再一敲字就把编辑结果覆盖回去。
    // CM 自己触发的更新在这里是 no-op（current === tab.content）。
  }, [tab?.id, tab?.fileKind, tab?.content, cmVisible]);

  /**
   * 从预览切回编辑时强制重测视口。
   *
   * 编辑器容器在预览态是 `display: none`，CM6 量到的高度是 0，只渲染了很少
   * 几行；切回可见后它**不会自己重新测量**，于是只剩顶部一截内容、下面全空
   * （预览 → 编辑偶发空白）。等一帧让布局落定再 requestMeasure。
   */
  useEffect(() => {
    // 只有 CM6 真正可见时才测；隐藏态的测量结果恒为 0 高度。
    // 依赖里带上 cmVisible，才能覆盖「可视化 → 源码」这条解除隐藏的路径。
    if (!cmVisible) return;
    const view = viewRef.current;
    if (!view) return;
    const frame = requestAnimationFrame(() => view.requestMeasure());
    return () => cancelAnimationFrame(frame);
  }, [editorMode, cmVisible]);

  // Toggle decorations on mode change
  useEffect(() => {
    if (!viewRef.current || !tab) return;
    // 非 markdown 一律摘掉：装饰与浮动工具条是 markdown 编辑态专属，
    // 切到 html/text 页签时留着会把 md 工具条画到 html 源码编辑上（双条）。
    if (tab.fileKind !== "markdown") {
      viewRef.current.dispatch({ effects: decorCompartment.reconfigure([]) });
      return;
    }

    if (editorMode === "source") {
      // 源码模式保留选区轮盘（E-18：AI 三动作归轮盘），但不装 L2 装饰。
      viewRef.current.dispatch({
        effects: decorCompartment.reconfigure([floatingToolbar()]),
      });
    } else if (editorMode === "edit") {
      viewRef.current.dispatch({
        effects: decorCompartment.reconfigure(
          fullDecorations(editorDecorationOptions),
        ),
      });
    }
  }, [editorMode, tab?.fileKind]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
      className="dark:bg-gray-800"
    >
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, position: "relative", overflow: "auto" }}
      >
        <div
          ref={editorRef}
          className="cm-editor-container"
          style={{
            height: "100%",
            display: cmVisible ? "block" : "none",
            ...editorThemeVars,
          }}
        />
        {htmlVisual && tab && (
          <HtmlVisualEditor
            content={tab.content}
            filePath={tab.path}
            onContentChange={(updater) => {
              // 以 store 里的最新值为基准求值，而不是渲染期的 tab.content
              const store = useStore.getState();
              const prev = store.tabs[tab.id]?.content ?? "";
              const next = updater(prev);
              store.updateTabContent(tab.id, next);
              return next;
            }}
          />
        )}
        {editorMode === "preview" && tab && (
          <PreviewView
            content={tab.content}
            fileKind={tab.fileKind}
            filePath={tab.path}
          />
        )}
        {editorMode === "preview" && tab && !readingMode && (
          <ReadingProgressInk scrollEl={scrollContainer} />
        )}
      </div>
      {tab?.fileKind === "markdown" && (
        <OutlineMenu
          mode={editorMode}
          documentText={tab.content}
          view={editorViewState}
          container={scrollContainer}
        />
      )}
    </div>
  );
}
