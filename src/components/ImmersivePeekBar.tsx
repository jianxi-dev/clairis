import { useEffect, useState } from "react";
import { useStore } from "../stores";
import { findLeaf } from "../lib/paneTree";
import type { Tab } from "../types";
import Icon from "./Icon";
import TabBar from "./TabBar";

function paneIdAt(x: number, y: number): string | null {
  if (typeof document === "undefined") return null;
  if (typeof document.elementFromPoint !== "function") return null;
  const el = document.elementFromPoint(x, y);
  if (!(el instanceof Element)) return null;
  return (
    el.closest<HTMLElement>("[data-pane-id]")?.getAttribute("data-pane-id") ??
    null
  );
}

/**
 * 沉浸模式的悬浮页签条（#273）。
 *
 * 流内顶栏在沉浸态高度收拢为 0；指针进入屏幕上缘热区时，用这条 fixed
 * 浮层回显指针所在格的页签，避免为了切换页签而退出沉浸。
 */
export default function ImmersivePeekBar() {
  const paneRoot = useStore((s) => s.paneRoot);
  const focusedPaneId = useStore((s) => s.focusedPaneId);
  const allTabs = useStore((s) => s.tabs);
  const [pointerPaneId, setPointerPaneId] = useState<string | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // 拖拽期间冻结所在格：bar 的 paneId 必须保持拖拽源格，否则松手
      // 会被误判成目标格内的换位。
      if (useStore.getState().tabDragActive) return;
      setPointerPaneId(paneIdAt(e.clientX, e.clientY));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const activePaneId = pointerPaneId ?? focusedPaneId;
  const leaf = findLeaf(paneRoot, activePaneId);
  const leafTabs: Record<string, Tab> = {};
  for (const id of leaf?.tabs ?? []) {
    if (allTabs[id]) leafTabs[id] = allTabs[id];
  }
  const hasTabs = Object.keys(leafTabs).length > 0;

  return (
    <div
      data-testid="immersive-peek-bar"
      className="immersive-peek-bar flex items-center gap-1 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 shadow-lg"
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        {hasTabs && leaf ? (
          <TabBar
            tabs={leafTabs}
            activeTabId={leaf.activeTabId}
            onSwitchTab={(id) => useStore.getState().switchTab(id)}
            onCloseTab={(id) => useStore.getState().closeTab(id)}
            paneId={leaf.id}
            onReorderTabs={(from, to) =>
              useStore.getState().reorderPaneTabs(leaf.id, from, to)
            }
            onMoveToPane={(tabId, targetLeafId) =>
              useStore.getState().moveTabToPane(tabId, targetLeafId)
            }
          />
        ) : (
          <span className="block px-2 py-1 text-xs text-[var(--app-text-3)]">
            空分栏
          </span>
        )}
      </div>
      <button
        type="button"
        data-testid="immersive-exit"
        title="退出沉浸"
        aria-label="退出沉浸"
        onClick={() => useStore.getState().setReadingMode(false)}
        className="shrink-0 rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
