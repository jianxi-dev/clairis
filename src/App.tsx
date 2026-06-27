import { useEffect, useCallback, useState } from "react";
import { useEditorStore } from "./stores/editorStore";
import { useFile } from "./hooks/useFile";

function App() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const fileName = useEditorStore((s) => s.fileName);
  const { openFile, saveFile, saveAsFile } = useFile();

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-gray-900">
      <header className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50 text-sm select-none">
        <button onClick={openFile} className="px-2 py-0.5 rounded hover:bg-gray-200 text-xs">打开</button>
        <button onClick={saveFile} className="px-2 py-0.5 rounded hover:bg-gray-200 text-xs">保存</button>
        <span className="text-gray-500 text-xs flex-1 truncate">{fileName || "未打开文件"}</span>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <textarea
          className="w-full h-full border-0 resize-none focus:outline-none font-mono text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="按 Cmd/Ctrl+O 打开 Markdown 文件"
        />
      </main>
    </div>
  );
}

export default App;
