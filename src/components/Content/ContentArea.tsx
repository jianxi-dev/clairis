import { useEffect, useRef, useState } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { yaml } from "@codemirror/lang-yaml";
import { basicSetup } from "codemirror";
import { useStore } from "../../stores/index";
import { isMediaKind } from "../../stores/index";
import { decorCompartment, fullDecorations } from "../../editors/setup";
import {
  setEditorView,
  setActivePanel,
  setPanelScrollEl,
} from "../../editors/editorRef";
import { resolveScrollTarget } from "../../utils/scrollPosition";
import PreviewView from "./PreviewView";
import ReadingProgressInk from "./ReadingProgressInk";
import type { EditorMode, FileKind, Tab } from "../../types";

const langCompartment = new Compartment();

function createLanguageExtension(kind: FileKind) {
  switch (kind) {
    case "markdown":
      return [
        markdown({ base: markdownLanguage }),
        decorCompartment.of(fullDecorations()),
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
        basicSetup,
        EditorView.lineWrapping,
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
        effects: decorCompartment.reconfigure(fullDecorations()),
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
