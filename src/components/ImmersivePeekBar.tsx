import { useStore } from "../stores";
import { findLeaf } from "../lib/paneTree";
import type { Tab } from "../types";
import Icon from "./Icon";
import TabBar from "./TabBar";

/**
 * 沉浸模式的悬浮页签条（#273）。
 *
 * 流内顶栏在沉浸态高度收拢为 0；指针进入屏幕上缘热区时，用这条 fixed
 * 浮层回显当前聚焦格的页签，避免为了切换页签而退出沉浸。
 */
export default function ImmersivePeekBar() {
  const paneRoot = useStore((s) => s.paneRoot);
  const focusedPaneId = useStore((s) => s.focusedPaneId);
  const allTabs = useStore((s) => s.tabs);

  const leaf = findLeaf(paneRoot, focusedPaneId);
  const leafTabs: Record<string, Tab> = {};
  for (const id of leaf?.tabs ?? []) {
    if (allTabs[id]) leafTabs[id] = allTabs[id];
  }

  return (
    <div
      data-testid="immersive-peek-bar"
      className="flex items-center gap-1 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 shadow-lg"
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <TabBar
          tabs={leafTabs}
          activeTabId={leaf?.activeTabId ?? null}
          onSwitchTab={(id) => useStore.getState().switchTab(id)}
          onCloseTab={(id) => useStore.getState().closeTab(id)}
        />
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
