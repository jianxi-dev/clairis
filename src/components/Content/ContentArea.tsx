import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { basicSetup } from "codemirror";
import { useStore } from "../../stores/index";
import { decorCompartment, fullDecorations } from "../../editors/setup";
import { setEditorView, setActivePanel } from "../../editors/editorRef";
import PreviewView from "./PreviewView";
import type { EditorMode, FileKind, Tab } from "../../types";

const langCompartment = new Compartment();

function createLanguageExtension(kind: FileKind) {
  switch (kind) {
    case "markdown":
      return [markdown({ base: markdownLanguage }), decorCompartment.of(fullDecorations())];
    case "html":
      return [html()];
    case "text":
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
  const activeTab = activeTabId ? tabs[activeTabId] : null;

  // tabOverride for split panels, otherwise use activeTab
  const tab = tabOverride !== undefined ? tabOverride : activeTab;
  const editorMode = modeOverride || (activeTab?.editorMode ?? "preview");

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const currentKindRef = useRef<FileKind | null>(null);
  const currentTabIdRef = useRef<string | null>(null);

  // Keep tab ID ref current so the updateListener closure can read it
  currentTabIdRef.current = tab?.id || null;

  // Create EditorView once per panelId
  useEffect(() => {
    if (viewRef.current || !editorRef.current) return;

    const state = EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
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
        effects: langCompartment.reconfigure(createLanguageExtension(tab.fileKind)),
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
      viewRef.current.dispatch({ effects: decorCompartment.reconfigure(fullDecorations()) });
    }
  }, [editorMode, tab?.fileKind]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }} className="dark:bg-gray-800">
      <div style={{ flex: 1, position: "relative", overflow: "auto" }}>
        <div
          ref={editorRef}
          className="cm-editor-container"
          style={{
            height: "100%",
            display: editorMode === "preview" || !tab ? "none" : "block",
          }}
        />
        {editorMode === "preview" && tab && (
          <PreviewView content={tab.content} fileKind={tab.fileKind} filePath={tab.path} />
        )}
      </div>
    </div>
  );
}
