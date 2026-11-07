/**
 * 快捷键注册表（layout-portal 15.1 / R-10）。
 *
 * 唯一真相源：实际 keymap 绑定、tooltip 键位显示、`?` 总览浮层、设置快捷键区
 * 都从这里渲染。新增/调整快捷键只改本文件，四处消费点自动同源。
 *
 * 设计规则（批准设计 §11）：单 ⌘ 高频 / ⌘⇧ 二级 / ⌘⌥ 分栏 / ⌥ 过滤 / 不用三修饰键。
 */

export type ShortcutFamily =
  | "global"
  | "typeFilter"
  | "mode"
  | "file"
  | "workspace"
  | "navigation"
  | "card"
  | "ai";

export interface ShortcutDef {
  id: string;
  /** 展示形式，如 "⌘P"、"⌥4"、"⌘⌥→"。 */
  keys: string;
  label: string;
  family: ShortcutFamily;
  /** 设置页「核心快捷键」展示的 7 条。 */
  core?: boolean;
  /** 冲突裁定说明：仅在有旧绑定竞争时填写，总览浮层会显示。 */
  decision?: string;
  implemented: boolean;
}

export const SHORTCUT_FAMILY_LABELS: Record<ShortcutFamily, string> = {
  global: "全局",
  typeFilter: "类型过滤",
  mode: "模式",
  file: "文件",
  workspace: "工作区",
  navigation: "导航",
  card: "卡片直开",
  ai: "AI / 其他",
};

/** 家族展示顺序（总览浮层与设置完整列表按此顺序分组）。 */
export const SHORTCUT_FAMILY_ORDER: readonly ShortcutFamily[] = [
  "global",
  "typeFilter",
  "mode",
  "file",
  "workspace",
  "navigation",
  "card",
  "ai",
];

export const SHORTCUTS: readonly ShortcutDef[] = [
  // ── 全局（9）──────────────────────────────────────────────
  {
    id: "global-quick-open",
    keys: "⌘P",
    label: "快速打开",
    family: "global",
    core: true,
    decision: "页签 / 最近文件 / 命令；统一文件面板见 B-3",
    implemented: true,
  },
  {
    id: "global-reading-rail",
    keys: "⌘\\",
    label: "阅读空间",
    family: "global",
    core: true,
    decision: "折叠态兼作沉浸阅读",
    implemented: true,
  },
  {
    id: "global-grid",
    keys: "⌘⇧\\",
    label: "网格概览",
    family: "global",
    core: true,
    decision: "旧右侧栏切换已移除，归网格概览",
    implemented: true,
  },
  {
    id: "global-ai-overlay",
    keys: "⌘K",
    label: "AI 快捷浮层",
    family: "global",
    core: true,
    implemented: true,
  },
  {
    id: "global-ai-bubble",
    keys: "⌘⇧A",
    label: "AI 小窗·停靠",
    family: "global",
    core: true,
    implemented: true,
  },
  {
    id: "global-settings",
    keys: "⌘,",
    label: "设置",
    family: "global",
    core: true,
    implemented: true,
  },
  {
    id: "global-preview-toggle",
    keys: "⌘⇧V",
    label: "悬浮预览开关",
    family: "global",
    decision: "旧向下分屏让位 ⌘⌥↓",
    implemented: true,
  },
  {
    id: "global-shortcuts",
    keys: "?",
    label: "快捷键总览",
    family: "global",
    core: true,
    implemented: true,
  },
  {
    id: "global-escape",
    keys: "Esc",
    label: "层级关闭",
    family: "global",
    implemented: true,
  },

  // ── 类型过滤（9：⌥1–8 八类 + ⌥0 全部）────────────────────
  {
    id: "type-filter-markdown",
    keys: "⌥1",
    label: "Markdown",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-html",
    keys: "⌥2",
    label: "HTML",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-text",
    keys: "⌥3",
    label: "文本",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-pdf",
    keys: "⌥4",
    label: "PDF",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-video",
    keys: "⌥5",
    label: "视频",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-image",
    keys: "⌥6",
    label: "图片",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-code",
    keys: "⌥7",
    label: "代码",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-audio",
    keys: "⌥8",
    label: "音频",
    family: "typeFilter",
    implemented: true,
  },
  {
    id: "type-filter-all",
    keys: "⌥0",
    label: "全部",
    family: "typeFilter",
    implemented: true,
  },

  // ── 模式（1）──────────────────────────────────────────────
  {
    id: "mode-cycle",
    keys: "⌘⇧M",
    label: "循环预览 / 编辑 / 源码",
    family: "mode",
    implemented: true,
  },

  // ── 文件（6）──────────────────────────────────────────────
  {
    id: "file-open",
    keys: "⌘O",
    label: "打开",
    family: "file",
    implemented: true,
  },
  {
    id: "file-save",
    keys: "⌘S",
    label: "保存",
    family: "file",
    implemented: true,
  },
  {
    id: "file-new",
    keys: "⌘N",
    label: "新建",
    family: "file",
    implemented: true,
  },
  {
    id: "file-new-tab",
    keys: "⌘T",
    label: "新页签",
    family: "file",
    implemented: true,
  },
  {
    id: "file-close-tab",
    keys: "⌘W",
    label: "关页签 / 格",
    family: "file",
    implemented: true,
  },
  {
    id: "file-pin",
    keys: "⌘⇧P",
    label: "收藏",
    family: "file",
    implemented: true,
  },

  // ── 工作区（5）────────────────────────────────────────────
  {
    id: "workspace-open-selected",
    keys: "⌘↵",
    label: "打开选中",
    family: "workspace",
    implemented: true,
  },
  {
    id: "workspace-split-right",
    keys: "⌘⌥→",
    label: "右分",
    family: "workspace",
    implemented: true,
  },
  {
    id: "workspace-split-down",
    keys: "⌘⌥↓",
    label: "下分",
    family: "workspace",
    implemented: true,
  },
  {
    id: "workspace-fullscreen",
    keys: "⌘⇧↵",
    label: "全屏当前格",
    family: "workspace",
    implemented: true,
  },
  {
    id: "workspace-immersive",
    keys: "⌘⇧F",
    label: "沉浸",
    family: "workspace",
    implemented: true,
  },

  // ── 导航（6）──────────────────────────────────────────────
  {
    id: "nav-vertical",
    keys: "j/k",
    label: "上下整行",
    family: "navigation",
    implemented: true,
  },
  {
    id: "nav-horizontal",
    keys: "h/l",
    label: "行内左右",
    family: "navigation",
    implemented: true,
  },
  {
    id: "nav-page",
    keys: "PageUp/PageDown",
    label: "整页",
    family: "navigation",
    implemented: true,
  },
  {
    id: "nav-edge",
    keys: "Home/End",
    label: "首尾",
    family: "navigation",
    implemented: true,
  },
  {
    id: "nav-open",
    keys: "Enter",
    label: "打开",
    family: "navigation",
    implemented: true,
  },
  {
    id: "nav-search",
    keys: "/",
    label: "搜索",
    family: "navigation",
    implemented: true,
  },

  // ── 卡片直开（3）──────────────────────────────────────────
  {
    id: "card-show-numbers",
    keys: "按住 ⌘",
    label: "显示编号",
    family: "card",
    implemented: true,
  },
  {
    id: "card-open",
    keys: "⌘1–9",
    label: "当前格打开",
    family: "card",
    implemented: true,
  },
  {
    id: "card-split-right",
    keys: "⌘⇧1–9",
    label: "右分打开",
    family: "card",
    implemented: true,
  },
  {
    id: "card-split-down",
    keys: "⌘⌥1–9",
    label: "下分打开",
    family: "card",
    implemented: true,
  },

  // ── AI / 其他（3）─────────────────────────────────────────
  {
    id: "ai-study-page",
    keys: "⌘⇧E",
    label: "生成学习页",
    family: "ai",
    implemented: true,
  },
  {
    id: "ai-translate",
    keys: "⌘⇧T",
    label: "翻译",
    family: "ai",
    implemented: true,
  },
  {
    id: "ai-quick-capture",
    keys: "⌘⇧.",
    label: "快速捕获",
    family: "ai",
    implemented: true,
  },
];

/** 设置页「核心快捷键」的 7 条。 */
export function coreShortcuts(): ShortcutDef[] {
  return SHORTCUTS.filter((s) => s.core);
}

/** 按家族取条目（总览浮层与设置完整列表共用）。 */
export function shortcutsByFamily(family: ShortcutFamily): ShortcutDef[] {
  return SHORTCUTS.filter((s) => s.family === family);
}
