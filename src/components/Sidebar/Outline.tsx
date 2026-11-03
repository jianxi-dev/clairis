import { useMemo, useCallback } from "react";
import { useStore } from "../../stores";
import { getActiveEditorView, getEditorView } from "../../editors/editorRef";
import { EditorView } from "@codemirror/view";
import { extractHeadings, type OutlineHeading } from "../../lib/outline";

export default function Outline() {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const activeTab = activeTabId ? tabs[activeTabId] : null;

  const headings = useMemo(
    () => (activeTab ? extractHeadings(activeTab.content) : []),
    [activeTab?.content],
  );

  const handleClick = useCallback((heading: OutlineHeading) => {
    const view = getActiveEditorView() ?? getEditorView("main");
    if (!view) return;
    const doc = view.state.doc;
    const pos = doc.line(Math.min(heading.line + 1, doc.lines)).from;
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "start" }),
    });
    view.focus();
  }, []);

  if (!activeTab) {
    return (
      <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
        打开文件以查看目录
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
        当前文档无标题
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          目录
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {headings.map((h, i) => (
          <button
            key={i}
            onClick={() => handleClick(h)}
            className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 truncate block border-b border-gray-50 dark:border-gray-700"
            style={{ paddingLeft: `${8 + h.level * 12}px` }}
            title={`H${h.level}: ${h.text} — 点击跳转`}
          >
            <span className="text-gray-500 dark:text-gray-400 mr-1">
              H{h.level}
            </span>
            <span className="text-gray-800 dark:text-gray-200">{h.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
