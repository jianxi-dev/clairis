import { create } from "zustand";

/**
 * 文档属性面板 UI 状态（doc-property-panel 功能一）。
 *
 * 只存「显示态」：显隐（⌘⇧Y）与显示样式（A 一行条 / B 精排双列）。
 * 面板内容一律从当前页签 `content` 实时解析，绝不在这里存字段快照。
 * 显示样式后续接设置配置（1.2 票），本票先用状态承载。
 */

export type DocPropertyVariant = "A" | "B";

interface DocPropertyPanelStore {
  /** 面板显隐。隐藏只改显示，不改文档内容（数据仍在 frontmatter 里）。 */
  hidden: boolean;
  /** 显示样式：A 一行条 / B 精排双列。 */
  variant: DocPropertyVariant;
  toggleHidden: () => void;
  setHidden: (v: boolean) => void;
  setVariant: (v: DocPropertyVariant) => void;
}

export const useDocPropertyPanelStore = create<DocPropertyPanelStore>(
  (set) => ({
    hidden: false,
    variant: "A",
    toggleHidden: () => set((s) => ({ hidden: !s.hidden })),
    setHidden: (v) => set({ hidden: v }),
    setVariant: (v) => set({ variant: v }),
  }),
);

// e2e 桥：与 __biaoyue_store__ 同构，供 Playwright 驱动显示样式。
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__biaoyue_doc_property__ =
    useDocPropertyPanelStore;
}
