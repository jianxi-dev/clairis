import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState, Compartment } from "@codemirror/state";
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
} from "../../editors/setup";
import type { EditorDecorationsOptions } from "../../editors/decorations";
import { slashKeymap, setUserSlashCommands } from "../../editors/slash";
import { loadUserExtensions } from "../../editors/user-extensions";
import { smartInput } from "../../editors/smart-input";
import { blockHandle } from "../../editors/orchestration/block-handle";
import {
  setEditorView,
  setActivePanel,
  setPanelScrollEl,
} from "../../editors/editorRef";
import { resolveScrollTarget } from "../../utils/scrollPosition";
import { renderMermaid } from "../../renderers/mermaid";
import PreviewView from "./PreviewView";
import ReadingProgressInk from "./ReadingProgressInk";
import type { EditorMode, FileKind, Tab } from "../../types";

const langCompartment = new Compartment();

/** 编辑态 mermaid 水合：把装饰 widget 里的源码块渲染成 SVG。 */
function hydrateMermaid(
  root: HTMLElement,
  theme: "dark" | "light",
): Promise<void> {
  root.dataset.theme = theme;
  return renderMermaid(root);
}

/** 编辑态装饰选项：本批只接 mermaid 水合，图片解析器留空走 alt 回退。 */
const editorDecorationOptions: EditorDecorationsOptions = {
  hydrateMermaid,
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
      return [html()];
    case "css":
      return [css()];
    case "python":
      return [python()];
    case "json":
      return [json()];
    case "javascript":
      return [javascript({ typescript: true })];
    case "yaml":
      return [yaml()];
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const currentKindRef = useRef<FileKind | null>(null);
  const currentTabIdRef = useRef<string | null>(null);
  const restoredTabRef = useRef<string | null>(null);

  // Keep tab ID ref current so the updateListener closure can read it
  currentTabIdRef.current = tab?.id || null;

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

  // Create EditorView once per panelId
  useEffect(() => {
    if (viewRef.current || !editorRef.current) return;

    const state = EditorState.create({
      doc: "",
      extensions: [
        ...baseEditorExtensions(),
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

    // 用户片段：编辑器创建后加载一次并注册进斜杠菜单。加载失败静默——菜单退回
    // 纯内置命令（`list_extensions` 在纯浏览器/老版本里不存在）。
    void loadUserExtensions(invoke).then((commands) => {
      setUserSlashCommands(commands);
    });

    return () => {
      setEditorView(panelId, null);
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [panelId]);

  // Sync tab content → editor
  useEffect(() => {
    if (!viewRef.current || !tab) return;

    const current = viewRef.current.state.doc.toString();
    if (current !== tab.content) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: tab.content },
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
  }, [tab?.id, tab?.fileKind]);

  // Toggle decorations on mode change
  useEffect(() => {
    if (!viewRef.current || !tab) return;
    if (tab.fileKind !== "markdown") return;

    if (editorMode === "source") {
      viewRef.current.dispatch({ effects: decorCompartment.reconfigure([]) });
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
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
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
            display: editorMode === "preview" || !tab ? "none" : "block",
            ...editorThemeVars,
          }}
        />
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
    </div>
  );
}
