import { create } from "zustand";
import type { EditorMode, PropertyBarConfig } from "../types";
import { modeDefault } from "../lib/propertyBarConfig";

/**
 * 文档属性面板 UI 状态（doc-property-panel）。
 *
 * 只存「显示态」：显隐（⌘⇧Y）、折叠与显示样式（A 一行条 / B 精排双列）。
 * 面板内容一律从当前页签 `content` 实时解析，绝不在这里存字段快照。
 * 形态优先级：用户手动偏好 > 窄窗自动胶囊 > 配置默认；窄窗自动不改写偏好。
 */

export type DocPropertyVariant = "A" | "B";

/** 全局偏好取值归一化：仅 A / B 有效，其余（含缺失）视为未手动选择。 */
export function normalizeDocPropertyVariant(
  raw: unknown,
): DocPropertyVariant | null {
  return raw === "A" || raw === "B" ? raw : null;
}

interface DocPropertyPanelStore {
  /** 面板显隐。隐藏只改显示，不改文档内容（数据仍在 frontmatter 里）。 */
  hidden: boolean;
  /** 生效形态：用户偏好优先，其次窄窗自动胶囊，最后配置默认。 */
  variant: DocPropertyVariant;
  /** 全局偏好 `docPropertyVariant`：仅用户手动切换时写入；null = 未选过。 */
  preference: DocPropertyVariant | null;
  /** 配置默认形态（legacy displayStyle）；偏好为空且非窄窗时使用。 */
  fallback: DocPropertyVariant;
  /** 窗口宽度 < 720px：仅在无用户偏好时把形态压成胶囊。 */
  narrow: boolean;
  /** 折叠态：仅编辑态可折叠，预览态不渲染折叠按钮。 */
  collapsed: boolean;
  toggleHidden: () => void;
  setHidden: (v: boolean) => void;
  /** 手动选择形态：写偏好并立即生效（AB 图标 / 设置共用）。 */
  setVariant: (v: DocPropertyVariant) => void;
  toggleVariant: () => void;
  /** 配置加载：写入偏好与配置默认，重算生效形态。 */
  applyLoadedPreference: (
    preference: DocPropertyVariant | null,
    fallback: DocPropertyVariant,
  ) => void;
  setNarrow: (narrow: boolean) => void;
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
    preference: null,
    fallback: "A",
    narrow: false,
    collapsed: false,
    toggleHidden: () => set((s) => ({ hidden: !s.hidden })),
    setHidden: (v) => set({ hidden: v }),
    setVariant: (v) => {
      const next = normalizeDocPropertyVariant(v);
      if (!next) return;
      set({ preference: next, variant: next });
    },
    toggleVariant: () =>
      set((s) => {
        const next: DocPropertyVariant = s.variant === "A" ? "B" : "A";
        return { preference: next, variant: next };
      }),
    // 配置回填时沿用当前窄窗态：否则窄窗启动会被配置默认拉回 A。
    applyLoadedPreference: (preference, fallback) =>
      set((s) => ({
        preference,
        fallback,
        variant: preference ?? (s.narrow ? "B" : fallback),
      })),
    setNarrow: (narrow) =>
      set((s) => ({
        narrow,
        variant: s.preference ?? (narrow ? "B" : s.fallback),
      })),
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
