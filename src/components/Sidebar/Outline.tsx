import { useMemo, useCallback } from "react";
import { useStore } from "../../stores";
import { getActiveEditorView, getEditorView } from "../../editors/editorRef";
import { EditorView } from "@codemirror/view";

interface Heading {
  level: number;
  text: string;
  line: number;
}

function parseHeadings(content: string): Heading[] {
  // Strip fenced code blocks to avoid matching # inside code
  const stripped = content.replace(/```[\s\S]*?```/g, "");

  const lines = stripped.split("\n");
  const headings: Heading[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: lineNumber,
      });
    }
  }

  return headings;
}

export default function Outline() {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const activeTab = activeTabId ? tabs[activeTabId] : null;

  const headings = useMemo(
    () => (activeTab ? parseHeadings(activeTab.content) : []),
    [activeTab?.content],
  );

  const handleClick = useCallback((headingText: string) => {
    // Get editor — try active first, fall back to main
    let view = getActiveEditorView();
    if (!view) view = getEditorView("main");
    if (!view) return;

    const doc = view.state.doc.toString();

    // Search for the heading line: either at start of doc or after newline
    for (let level = 1; level <= 6; level++) {
      const prefix = `${"#".repeat(level)} ${headingText}`;
      // Try after newline first, then at position 0
      for (const searchStr of [`\n${prefix}`, prefix]) {
        const idx = doc.indexOf(searchStr);
        if (idx !== -1) {
          const offset = searchStr.startsWith("\n") ? 1 : 0;
          const line = view.state.doc.lineAt(idx + offset);
          view.dispatch({
            selection: { anchor: line.from },
            scrollIntoView: true,
          });
          return;
        }
      }
    }

    // Last resort: find heading text anywhere
    const idx = doc.indexOf(headingText);
    if (idx !== -1) {
      const line = view.state.doc.lineAt(idx);
      view.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
    }
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
            onClick={() => handleClick(h.text)}
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
