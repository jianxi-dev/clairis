import { create } from "zustand";
import type { EditorMode, PropertyBarConfig } from "../types";
import { modeDefault } from "../lib/propertyBarConfig";

/**
 * 文档属性面板 UI 状态（doc-property-panel）。
 *
 * 只存「显示态」：显隐（⌘⇧Y）、折叠与显示样式（A 一行条 / B 精排双列）。
 * 面板内容一律从当前页签 `content` 实时解析，绝不在这里存字段快照。
 * 显示样式与默认档由设置配置驱动（1.2），经 useConfig 桥接同步。
 */

export type DocPropertyVariant = "A" | "B";

interface DocPropertyPanelStore {
  /** 面板显隐。隐藏只改显示，不改文档内容（数据仍在 frontmatter 里）。 */
  hidden: boolean;
  /** 显示样式：A 一行条 / B 精排双列。 */
  variant: DocPropertyVariant;
  /** 折叠态：仅编辑态可折叠，预览态不渲染折叠按钮。 */
  collapsed: boolean;
  toggleHidden: () => void;
  setHidden: (v: boolean) => void;
  setVariant: (v: DocPropertyVariant) => void;
  setCollapsed: (v: boolean) => void;
  /** 应用某模式的配置默认档；source 不渲染，不动状态。 */
  applyModeDefault: (
    mode: EditorMode,
    cfg?: Pick<PropertyBarConfig, "displayDefault">,
  ) => void;
}

export const useDocPropertyPanelStore = create<DocPropertyPanelStore>(
  (set) => ({
    hidden: false,
    variant: "A",
    collapsed: false,
    toggleHidden: () => set((s) => ({ hidden: !s.hidden })),
    setHidden: (v) => set({ hidden: v }),
    setVariant: (v) => set({ variant: v }),
    setCollapsed: (v) => set({ collapsed: v }),
    applyModeDefault: (mode, cfg) => {
      if (mode !== "preview" && mode !== "edit") return;
      const d = modeDefault(cfg, mode);
      set({ hidden: d === "hide", collapsed: d === "collapse" });
    },
  }),
);

// e2e 桥：与 __biaoyue_store__ 同构，供 Playwright 驱动显示样式。
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__biaoyue_doc_property__ =
    useDocPropertyPanelStore;
}
