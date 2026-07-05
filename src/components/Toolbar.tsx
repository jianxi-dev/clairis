import type { Theme } from "../types";

interface ToolbarProps {
  isTauri: boolean;
  title: string;
  activeTabExists: boolean;
  editorMode: "preview" | "edit" | "source";
  theme: Theme;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onNewFile: () => void;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onSetMode: (mode: "preview" | "edit" | "source") => void;
  onSetReadingMode: (on: boolean) => void;
  onSetTheme: (theme: Theme) => void;
}

export default function Toolbar({
  isTauri,
  title,
  activeTabExists,
  editorMode,
  theme,
  onOpenFile,
  onSaveFile,
  onNewFile,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onSetMode,
  onSetReadingMode,
  onSetTheme,
}: ToolbarProps) {
  return (
    <header className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-sm select-none shrink-0">
      {/* File operations */}
      {isTauri && (
        <>
          <button
            onClick={onOpenFile}
            className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
            title="打开文件 (Cmd+O)"
          >
            打开
          </button>
          <button
            onClick={onSaveFile}
            className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
            title="保存文件 (Cmd+S)"
          >
            保存
          </button>
          <button
            onClick={onNewFile}
            className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
            title="新建 (Cmd+N)"
          >
            新建
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        </>
      )}

      {/* Title */}
      <span className="text-gray-500 dark:text-gray-400 text-xs flex-1 truncate">
        {title || (isTauri ? "Cmd+O 打开文件" : "Web 模式 — 仅展示 UI")}
      </span>

      {/* Sidebar toggles */}
      {activeTabExists && (
        <>
          <button
            onClick={onToggleLeftSidebar}
            className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
            title="切换左侧栏 (Cmd+\)"
          >
            侧栏
          </button>
          <button
            onClick={onToggleRightSidebar}
            className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
            title="切换右侧栏 (Cmd+Shift+\)"
          >
            翻译
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        </>
      )}

      {/* Theme toggle */}
      <button
        onClick={() =>
          onSetTheme(
            theme === "light" ? "dark" : theme === "dark" ? "system" : "light",
          )
        }
        className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs whitespace-nowrap"
        title={`当前: ${theme === "system" ? "跟随系统" : theme === "dark" ? "暗色" : "亮色"}`}
      >
        {theme === "dark" ? "☀️" : theme === "light" ? "🌙" : "💻"}
      </button>

      {/* Mode buttons */}
      {activeTabExists && (
        <>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          <div className="flex gap-1 items-center">
            <ModeButton
              label="预览"
              active={editorMode === "preview"}
              onClick={() => onSetMode("preview")}
            />
            <ModeButton
              label="编辑"
              active={editorMode === "edit"}
              onClick={() => onSetMode("edit")}
            />
            <ModeButton
              label="源码"
              active={editorMode === "source"}
              onClick={() => onSetMode("source")}
            />
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
            <button
              onClick={() => onSetReadingMode(true)}
              className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
              title="进入阅读模式 (沉浸全屏)"
            >
              阅读
            </button>
          </div>
        </>
      )}
    </header>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs ${
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium"
          : "hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
