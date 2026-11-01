import { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "../stores";
import type { Tab } from "../types";
import { log } from "../utils/log";
import { exportDocxDocument } from "../lib/export/docx";
import {
  exportCurrentDocHtml,
  exportMessage,
} from "../lib/export/exportDocument";
import { exportPngFromMarkdown, exportPngMessage } from "../lib/export/png";
import { exportDocxMessage } from "../lib/export/docx";
import {
  exportMdpkgFromMarkdown,
  exportMdpkgMessage,
} from "../lib/export/mdpkg";

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
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingMdpkg, setExportingMdpkg] = useState(false);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, tabId });
    },
    [],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  const handleExportHtml = useCallback(
    async (tabId: string) => {
      const tab = useStore.getState().tabs[tabId];
      if (!tab) return;
      const dir = tab.path
        ? tab.path.slice(
            0,
            Math.max(tab.path.lastIndexOf("/"), tab.path.lastIndexOf("\\")),
          )
        : "";
      const result = await exportCurrentDocHtml({
        title: tab.title,
        markdown: tab.content,
        baseDir: dir,
      });
      const message = exportMessage(result);
      if (result.status === "error") {
        log.error("ExportHtml", "导出 HTML 失败", result.message);
        showNotice(message ?? "导出失败");
      } else if (result.status === "saved") {
        log.info("ExportHtml", message ?? "已导出", { path: result.path });
        showNotice(message ?? "已导出");
      }
    },
    [showNotice],
  );

  const handleExportPng = useCallback(
    async (tabId: string) => {
      if (exportingPng) return;
      const tab = useStore.getState().tabs[tabId];
      if (!tab) return;
      const dir = tab.path
        ? tab.path.slice(
            0,
            Math.max(tab.path.lastIndexOf("/"), tab.path.lastIndexOf("\\")),
          )
        : "";
      setExportingPng(true);
      showNotice("正在生成图片…");
      let message: string | null = null;
      try {
        const result = await exportPngFromMarkdown({
          title: tab.title,
          markdown: tab.content,
          baseDir: dir,
        });
        if (result.status === "error") {
          log.error("ExportPng", "导出图片失败", result.message);
        } else if (result.status === "saved") {
          log.info("ExportPng", "已导出图片", { path: result.path });
        }
        message = exportPngMessage(result);
      } catch (e) {
        log.error("ExportPng", "导出图片失败", String(e));
        message = `导出失败：${e instanceof Error ? e.message : String(e)}`;
      } finally {
        setExportingPng(false);
      }
      if (message) showNotice(message);
    },
    [exportingPng, showNotice],
  );

  const handleExportDocx = useCallback(
    async (tabId: string) => {
      if (exportingDocx) return;
      const tab = useStore.getState().tabs[tabId];
      if (!tab) return;
      setExportingDocx(true);
      showNotice("正在生成 Word…");
      let message: string | null = null;
      try {
        const dir = tab.path
          ? tab.path.slice(
              0,
              Math.max(tab.path.lastIndexOf("/"), tab.path.lastIndexOf("\\")),
            )
          : "";
        const result = await exportDocxDocument({
          title: tab.title,
          markdown: tab.content,
          baseDir: dir,
        });
        if (result.status === "error") {
          log.error("ExportDocx", "导出 Word 失败", result.message);
        } else if (result.status === "saved") {
          log.info("ExportDocx", "已导出 Word", {
            path: result.path,
            warnings: result.warnings,
          });
        }
        message = exportDocxMessage(result);
      } catch (e) {
        log.error("ExportDocx", "导出 Word 失败", String(e));
        message = `导出失败：${e instanceof Error ? e.message : String(e)}`;
      } finally {
        setExportingDocx(false);
      }
      if (message) showNotice(message);
    },
    [exportingDocx, showNotice],
  );

  const handleExportMdpkg = useCallback(
    async (tabId: string) => {
      if (exportingMdpkg) return;
      const tab = useStore.getState().tabs[tabId];
      if (!tab) return;
      setExportingMdpkg(true);
      showNotice("正在打包 .mdpkg…");
      let message: string | null = null;
      try {
        const dir = tab.path
          ? tab.path.slice(
              0,
              Math.max(tab.path.lastIndexOf("/"), tab.path.lastIndexOf("\\")),
            )
          : "";
        const result = await exportMdpkgFromMarkdown({
          title: tab.title,
          markdown: tab.content,
          baseDir: dir,
        });
        if (result.status === "error") {
          log.error("ExportMdpkg", "导出 .mdpkg 失败", result.message);
        } else if (result.status === "saved") {
          log.info("ExportMdpkg", "已导出 .mdpkg", { path: result.path });
        }
        message = exportMdpkgMessage(result);
      } catch (e) {
        log.error("ExportMdpkg", "导出 .mdpkg 失败", String(e));
        message = `导出失败：${e instanceof Error ? e.message : String(e)}`;
      } finally {
        setExportingMdpkg(false);
      }
      if (message) showNotice(message);
    },
    [exportingMdpkg, showNotice],
  );

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
              data-tab-id={id}
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

      {notice && (
        <div
          data-export-notice
          role="status"
          className="fixed bottom-6 left-1/2 z-[2147483000] -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-700/95"
        >
          {notice}
        </div>
      )}

      {/* Context menu */}
      {menu && (
        <div
          data-tab-menu
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
              void handleExportHtml(menu.tabId);
              closeMenu();
            }}
          >
            导出 HTML…
          </button>
          <button
            data-export-png
            disabled={exportingPng}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              void handleExportPng(menu.tabId);
              closeMenu();
            }}
          >
            {exportingPng ? "正在生成…" : "导出图片…"}
          </button>
          <button
            data-export-docx
            disabled={exportingDocx}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              void handleExportDocx(menu.tabId);
              closeMenu();
            }}
          >
            {exportingDocx ? "正在生成…" : "导出 Word…"}
          </button>
          <button
            data-export-mdpkg
            disabled={exportingMdpkg}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              void handleExportMdpkg(menu.tabId);
              closeMenu();
            }}
          >
            {exportingMdpkg ? "正在打包…" : "导出 .mdpkg…"}
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
