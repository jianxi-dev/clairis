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

/**
 * 添加字段调色板的跨组件请求（O7）。
 *
 * 页签右键菜单只持页签 id，面板持文档 key；两者通过本会话态握手：
 * 菜单 `requestPalette(docKey)`，匹配的面板消费后清空。`seq` 单调递增，
 * 消费必须带 seq，避免陈旧面板把更新的请求清掉。不落盘。
 */
export interface DocPropertyPaletteRequest {
  docKey: string;
  seq: number;
}

/** 请求序号：模块级单调计数，不进 store 状态（无需被订阅）。 */
let paletteSeq = 0;

/** 全局偏好取值归一化：仅 A / B 有效，其余（含缺失）视为未手动选择。 */
export function normalizeDocPropertyVariant(
  raw: unknown,
): DocPropertyVariant | null {
  return raw === "A" || raw === "B" ? raw : null;
}

/**
 * 显式选择标记（#1147）。
 *
 * `docPropertyVariant` 只能由用户点击 L/T 图标（或设置「显示样式」）写入；
 * 历史版本 / 设置桥接曾把它当成「当前形态」直接落盘，导致用户从未手动切换
 * 也留下 `"B"`，窄窗自动胶囊被短路。加载时仅当本标记存在才承认存储值，
 * 否则视为未手动选择（回落默认 / 窄窗胶囊）。
 */
const EXPLICIT_CHOICE_KEY = "biaoyue.docPropertyVariant.explicit";

/** 用户是否曾显式选择过形态（标记缺失 = 存储值不可信）。 */
export function hasExplicitDocPropertyChoice(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(EXPLICIT_CHOICE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

/** 记录一次显式选择；存储不可用时静默降级（偏好仍写配置，只是下次加载不承认）。 */
function markExplicitDocPropertyChoice(): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EXPLICIT_CHOICE_KEY, "1");
    }
  } catch {
    // 隐私模式 / 配额：忽略，不影响当次切换。
  }
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
  /** 添加字段调色板的跨组件请求；会话态，不落盘。 */
  paletteRequest: DocPropertyPaletteRequest | null;
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
  /** 请求打开某文档的字段调色板（页签右键菜单）。 */
  requestPalette: (docKey: string) => void;
  /** 消费请求：仅当 seq 匹配当前请求时清空，避免陈旧面板清掉新请求。 */
  consumePaletteRequest: (seq: number) => void;
  /** 应用某模式的配置默认档；source 不渲染，不动状态。 */
  applyModeDefault: (
    mode: EditorMode,
    cfg?: Pick<PropertyBarConfig, "displayDefault">,
  ) => void;
}

export const useDocPropertyPanelStore = create<DocPropertyPanelStore>(
  (set, get) => ({
    hidden: false,
    variant: "A",
    preference: null,
    fallback: "A",
    narrow: false,
    collapsed: false,
    paletteRequest: null,
    requestPalette: (docKey) => {
      paletteSeq += 1;
      const seq = paletteSeq;
      set({ paletteRequest: { docKey, seq } });
    },
    consumePaletteRequest: (seq) =>
      set((s) =>
        s.paletteRequest?.seq === seq ? { paletteRequest: null } : {},
      ),
    toggleHidden: () => set((s) => ({ hidden: !s.hidden })),
    setHidden: (v) => set({ hidden: v }),
    setVariant: (v) => {
      const next = normalizeDocPropertyVariant(v);
      if (!next) return;
      markExplicitDocPropertyChoice();
      set({ preference: next, variant: next });
    },
    toggleVariant: () => {
      const next: DocPropertyVariant = get().variant === "A" ? "B" : "A";
      markExplicitDocPropertyChoice();
      set({ preference: next, variant: next });
    },
    // 配置回填时沿用当前窄窗态：否则窄窗启动会被配置默认拉回 A。
    // 无显式选择标记的存储值视为历史污染，不生效（#1147）。
    applyLoadedPreference: (preference, fallback) =>
      set((s) => {
        const effective = hasExplicitDocPropertyChoice() ? preference : null;
        return {
          preference: effective,
          fallback,
          variant: effective ?? (s.narrow ? "B" : fallback),
        };
      }),
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
