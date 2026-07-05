import { useState, useCallback, useEffect } from "react";
import { useStore } from "../stores";
import type { Tab } from "../types";

interface TabBarProps {
  tabs: Record<string, Tab>;
  activeTabId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

interface CtxMenu {
  x: number;
  y: number;
  tabId: string;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
}: TabBarProps) {
  const tabIds = Object.keys(tabs);
  const [menu, setMenu] = useState<CtxMenu | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  // Close menu on any click outside the menu itself
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the context menu
      if (target.closest(".fixed.z-50")) return;
      setMenu(null);
    };
    // Delay adding listener so the current right-click doesn't close it
    const id = setTimeout(() => {
      window.addEventListener("click", handler, true);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("click", handler, true);
    };
  }, [menu]);

  if (tabIds.length === 0) return null;
  const showClose = tabIds.length > 1;

  return (
    <>
      <div
        className="flex items-end shrink-0 select-none overflow-x-auto"
        style={{
          borderBottom: "1px solid var(--tab-border, #e5e7eb)",
          background: "var(--tab-bg, #f9fafb)",
        }}
      >
        {tabIds.map((id) => {
          const tab = tabs[id];
          const isActive = id === activeTabId;
          return (
            <div
              key={id}
              onClick={() => onSwitchTab(id)}
              onContextMenu={(e) => handleContextMenu(e, id)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-white dark:bg-gray-800 border-b-2 border-b-blue-500 font-medium"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 border-b-2 border-b-transparent"
              }`}
              style={{ borderRight: "1px solid var(--tab-border, #e5e7eb)" }}
            >
              <span className="truncate max-w-40">{tab.title}</span>
              {tab.dirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              )}
              {showClose && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(id);
                  }}
                  className="ml-1 px-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 shrink-0"
                  title="关闭 (Cmd+W)"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {menu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 min-w-[150px] text-xs"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              useStore.getState().splitTab(menu.tabId, "horizontal");
              closeMenu();
            }}
          >
            向右分栏
            <span className="ml-auto text-gray-400">⌘\</span>
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              useStore.getState().splitTab(menu.tabId, "vertical");
              closeMenu();
            }}
          >
            向下分栏
            <span className="ml-auto text-gray-400">⌘⇧\</span>
          </button>
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              onCloseTab(menu.tabId);
              closeMenu();
            }}
          >
            关闭
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              const ids = Object.keys(tabs).filter((id) => id !== menu.tabId);
              ids.forEach((id) => onCloseTab(id));
              closeMenu();
            }}
          >
            关闭其他
          </button>
        </div>
      )}
    </>
  );
}
