import type { Theme } from "../types";
import Icon from "./Icon";
import { useAiEntryStore } from "../hooks/useAiEntry";

interface ToolbarProps {
  title: string;
  activeTabExists: boolean;
  editorMode: "preview" | "edit" | "source";
  theme: Theme;
  /** 媒体类文件（图片/视频/PDF）：隐藏模式切换 */
  isMedia?: boolean;
  onSetMode: (mode: "preview" | "edit" | "source") => void;
  onSetReadingMode: (on: boolean) => void;
  onSetTheme: (theme: Theme) => void;
}

export default function Toolbar({
  title,
  activeTabExists,
  editorMode,
  theme,
  isMedia = false,
  onSetMode,
  onSetReadingMode,
  onSetTheme,
}: ToolbarProps) {
  return (
    <header className="app-chrome flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-sm select-none shrink-0">
      {/* Title */}
      <span className="text-gray-500 dark:text-gray-400 text-xs flex-1 truncate">
        {title || "标月 Biaoyue"}
      </span>

      {/* AI：全产品唯一常驻入口（顶栏星芒）。门户里的 [data-testid="quick-ai"]
          是场景内快捷方式，不是常驻入口——唯一入口判定只看 data-ai-entry。 */}
      <button
        data-ai-entry
        data-testid="ai-entry"
        title="AI（⌘⇧A 切换形态）"
        aria-label="AI"
        onClick={() => {
          const st = useAiEntryStore.getState();
          if (st.form === "docked") st.undock();
          else if (st.bubbleOpen) st.closeBubble();
          else st.openBubble();
        }}
        className="px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <Icon name="sparkle" size={18} color="var(--app-accent)" />
      </button>

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
        <Icon
          name={
            theme === "dark" ? "sun" : theme === "light" ? "moon" : "monitor"
          }
          size={18}
        />
      </button>

      {/* Mode buttons */}
      {activeTabExists && !isMedia && (
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
