import { useEffect, useRef } from "react";
import { EditorState, StateEffect, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { basicSetup } from "codemirror";
import { useStore } from "../../stores/index";
import { decorCompartment, fullDecorations } from "../../editors/setup";
import PreviewView from "./PreviewView";
import type { FileKind } from "../../types";

/** Compartment for language extensions that change per file kind */
const langCompartment = new Compartment();

function createLanguageExtension(kind: FileKind) {
  switch (kind) {
    case "markdown":
      return [markdown({ base: markdownLanguage }), decorCompartment.of(fullDecorations())];
    case "html":
      return [html()];
    case "text":
      return []; // Plain text, no language extension
  }
}

export default function ContentArea() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const activeTab = activeTabId ? tabs[activeTabId] : null;

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const currentKindRef = useRef<FileKind>("markdown");

  // Create EditorView once with a placeholder language compartment
  useEffect(() => {
    if (viewRef.current || !editorRef.current) return;

    const state = EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        langCompartment.of([]), // Will be reconfigured when a tab is active
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            useStore.getState().updateContent(content);
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sync store → CM6 when tab switches, and reconfigure language if fileKind changed
  useEffect(() => {
    if (!viewRef.current || !activeTab) return;

    const current = viewRef.current.state.doc.toString();
    if (current !== activeTab.content) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: activeTab.content },
      });
    }

    // Reconfigure language extension if fileKind changed
    if (activeTab.fileKind !== currentKindRef.current) {
      currentKindRef.current = activeTab.fileKind;
      const langExtensions = createLanguageExtension(activeTab.fileKind);
      viewRef.current.dispatch({
        effects: langCompartment.reconfigure(langExtensions),
      });
    }
  }, [activeTab?.id, activeTab?.fileKind]);

  // Toggle decorations compartment on mode change (markdown only)
  useEffect(() => {
    if (!viewRef.current || !activeTab) return;

    // Only apply decorations in markdown edit mode
    if (activeTab.fileKind !== "markdown") return;

    if (activeTab.editorMode === "source") {
      viewRef.current.dispatch({
        effects: decorCompartment.reconfigure([]),
      });
    } else if (activeTab.editorMode === "edit") {
      viewRef.current.dispatch({
        effects: decorCompartment.reconfigure(fullDecorations()),
      });
    }
  }, [activeTab?.editorMode, activeTab?.fileKind]);

  const tabIds = Object.keys(tabs);

  return (
    <div className="content-area" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Tab bar */}
      {tabIds.length > 0 && (
        <div className="tab-bar" style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
          {tabIds.map((id) => {
            const tab = tabs[id];
            return (
              <div
                key={id}
                className={`tab ${id === activeTabId ? "active" : ""}`}
                style={{
                  padding: "4px 12px",
                  cursor: "pointer",
                  background: id === activeTabId ? "#e0e0e0" : "transparent",
                }}
                onClick={() => useStore.getState().switchTab(id)}
              >
                {tab.title}
              </div>
            );
          })}
        </div>
      )}

      {/* Viewport */}
      <div style={{ flex: 1, position: "relative", overflow: "auto" }}>
        {/* CM6 editor — visible in edit/source mode, hidden in preview */}
        <div
          ref={editorRef}
          className="cm-editor-container"
          style={{
            height: "100%",
            display: activeTab?.editorMode === "preview" || !activeTab ? "none" : "block",
          }}
        />

        {/* Preview mode */}
        {activeTab?.editorMode === "preview" && activeTab && (
          <PreviewView
            content={activeTab.content}
            fileKind={activeTab.fileKind}
            filePath={activeTab.path}
          />
        )}
      </div>
    </div>
  );
}
