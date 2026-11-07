/**
 * 全站图标 path 表（Layout Portal D9）。
 *
 * 24×24 viewBox、`fill="currentColor"`、18（密集）/24（主操作）两档。
 * 刻意做成静态 path 表而不是引入图标库：没有运行时依赖、可被 tree-shake，
 * 也方便「图标抽屉」把在用图标全部列出来。
 *
 * 规矩：一个概念一个图标；同一概念全产品同一形状；不混风格；禁 emoji。
 */

export type IconName =
  | "markdown"
  | "html"
  | "text"
  | "pdf"
  | "video"
  | "image"
  | "code"
  | "audio"
  | "folder"
  | "file"
  | "close"
  | "search"
  | "settings"
  | "sun"
  | "moon"
  | "monitor"
  | "pin"
  | "grid"
  | "check"
  | "warning"
  | "expand"
  | "more"
  | "eye"
  | "pencil"
  | "export"
  | "share"
  | "splitRight"
  | "splitDown"
  | "locate"
  | "copyPath"
  | "chevronLeft"
  | "chevronRight"
  | "sparkle"
  | "pinOff"
  | "immersive";

export interface IconDef {
  /**
   * 实心子路径的 `d`。多个子路径要合并在这一条里（用 `M` 分隔）——
   * 分成多个 <path> 各自填充的话，内部字形会被同色填充盖掉，图标退化成色块。
   */
  d?: string;
  /**
   * 描边子路径的 `d`。`Icon` 组件对本字段渲染 `fill="none" stroke="currentColor"`。
   * `d` 与 `s` 至少存在其一。
   */
  s?: string;
  /** 图标抽屉里显示的中文名 */
  label: string;
}

export const ICONS: Record<IconName, IconDef> = {
  markdown: {
    label: "Markdown",
    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M8.5 16.5V10L12 14.2L15.5 10V16.5",
  },
  html: {
    label: "HTML",
    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M10 12l-2 2.5L10 17 M14 12l2 2.5L14 17 M13 11l-2 7",
  },
  text: {
    label: "文本",
    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M9.5 12h5 M9.5 15h5 M9.5 18h3",
  },
  pdf: {
    label: "PDF",
    s: "M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M9.5 17V11h2.6a2 2 0 010 4H9.5",
  },
  video: {
    label: "视频",
    s: "M3.5 6h17v12h-17z M10 9.5l5 2.5-5 2.5z",
  },
  image: {
    label: "图片",
    s: "M3.5 5h17v14h-17z M8 10.2a1.4 1.4 0 110-2.8 1.4 1.4 0 010 2.8z M5 17.5l4.5-5 3 3.2 2-2.2 4.5 4",
  },
  code: {
    label: "代码",
    s: "M9 8l-5 4 5 4 M15 8l5 4-5 4",
  },
  audio: {
    label: "音频",
    s: "M10 18V7l7-2v11 M10 18a2 2 0 11-4 0 2 2 0 014 0z M17 16a2 2 0 11-4 0 2 2 0 014 0z",
  },
  folder: {
    label: "文件夹",
    s: "M3.5 7h6l2 2h9v10h-17z",
  },
  file: {
    label: "文件",
    s: "M6 3h8l4 4v14H6z M14 3v4h4",
  },
  close: {
    label: "关闭",
    s: "M6.5 6.5l11 11 M17.5 6.5l-11 11",
  },
  search: {
    label: "搜索",
    s: "M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13z M15.5 15.5L21 21",
  },
  sun: {
    label: "浅色",
    s: "M12 8a4 4 0 100 8 4 4 0 000-8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2",
  },
  moon: {
    label: "深色",
    s: "M13.5 3a9 9 0 107.5 12.9A7.2 7.2 0 0113.5 3z",
  },
  monitor: {
    label: "跟随系统",
    s: "M4 5h16v11H4z M9.5 18.5h5",
  },
  pin: {
    label: "钉住",
    s: "M9 3h6v3H9z M9 6h6l-3 4z M12 10v9",
  },
  pinOff: {
    label: "取消钉住",
    s: "M9 3h6v3H9z M9 6h6l-3 4z M12 10v9 M8.5 15.5l7-7",
  },
  grid: {
    label: "网格概览",
    s: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  },
  check: {
    label: "完成",
    s: "M5 12.5l4.5 4.5L19 7.5",
  },
  warning: {
    label: "警告",
    s: "M12 3.5l9.5 16H2.5z M12 9.5v4.5 M11.4 16.6h1.2",
  },
  settings: {
    label: "设置",
    s: "M18.6 10.1L20.3 10A0.6 0.6 0 0 1 21 10.6L21 13.4A0.6 0.6 0 0 1 20.3 14L18.6 13.9A0.6 0.6 0 0 0 18 14.2L17.4 15.3A0.6 0.6 0 0 0 17.5 16L18.8 17.2A0.6 0.6 0 0 1 18.7 18.1L16.5 19.9A0.6 0.6 0 0 1 15.6 19.8L14.6 18.3A0.6 0.6 0 0 0 14 18L12.8 18.3A0.6 0.6 0 0 0 12.4 18.8L12.1 20.6A0.6 0.6 0 0 1 11.4 21.1L8.6 20.4A0.6 0.6 0 0 1 8.2 19.7L8.7 18A0.6 0.6 0 0 0 8.5 17.3L7.6 16.6A0.6 0.6 0 0 0 6.9 16.5L5.4 17.4A0.6 0.6 0 0 1 4.5 17.2L3.3 14.6A0.6 0.6 0 0 1 3.6 13.8L5.3 13.2A0.6 0.6 0 0 0 5.7 12.6L5.7 11.4A0.6 0.6 0 0 0 5.3 10.8L3.6 10.2A0.6 0.6 0 0 1 3.3 9.4L4.5 6.8A0.6 0.6 0 0 1 5.4 6.6L6.9 7.5A0.6 0.6 0 0 0 7.6 7.4L8.5 6.7A0.6 0.6 0 0 0 8.7 6L8.2 4.3A0.6 0.6 0 0 1 8.6 3.6L11.4 2.9A0.6 0.6 0 0 1 12.1 3.4L12.4 5.2A0.6 0.6 0 0 0 12.8 5.7L14 6A0.6 0.6 0 0 0 14.6 5.7L15.6 4.2A0.6 0.6 0 0 1 16.5 4.1L18.7 5.9A0.6 0.6 0 0 1 18.8 6.8L17.5 8A0.6 0.6 0 0 0 17.4 8.7L18 9.8A0.6 0.6 0 0 0 18.6 10.1Z M12 8.8a3.2 3.2 0 100 6.4a3.2 3.2 0 100 0 -6.4z",
  },
  expand: {
    label: "全屏格",
    d: "M4 4h5v1.5H5.5V9H4z M15 4h5v5h-1.5V5.5H15z M4 15h1.5v3.5H9V20H4z M18.5 15H20v5h-5v-1.5h3.5z",
  },
  more: {
    label: "更多",
    d: "M5 11h2.4v2.4H5z M10.8 11h2.4v2.4h-2.4z M16.6 11h2.4v2.4h-2.4z",
  },
  eye: {
    label: "预览",
    s: "M2.5 12c2.2-3.4 5.6-5.4 9.5-5.4s7.3 2 9.5 5.4c-2.2 3.4-5.6 5.4-9.5 5.4s-7.3-2-9.5-5.4z M12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z",
  },
  pencil: {
    label: "编辑",
    s: "M4 20h4l10.4-10.4-4-4L4 16z M14.4 5.6l1.5-1.5a1 1 0 011.4 0l2.6 2.6a1 1 0 010 1.4l-1.5 1.5z",
  },
  export: {
    label: "导出",
    s: "M12 15V3 M8 7l4-4 4 4 M4 14v6h16v-6",
  },
  share: {
    label: "分享",
    s: "M6 12a2 2 0 100-4 2 2 0 000 4z M18 6a2 2 0 100-4 2 2 0 000 4z M18 22a2 2 0 100-4 2 2 0 000 4z M8 10l8-3 M8 14l8 3",
  },
  splitRight: {
    label: "向右分栏",
    d: "M3 5.5h7.5v13H3z M4.5 7v10h4.5V7z M13.5 5.5H21v13h-7.5z M15 7v10h4.5V7z",
  },
  splitDown: {
    label: "向下分栏",
    d: "M3 4.5h18v6H3z M4.5 6v3h15V6z M3 12.5h18v7H3z M4.5 14v4h15v-4z",
  },
  locate: {
    label: "定位",
    s: "M12 6.8a5.2 5.2 0 100 10.4 5.2 5.2 0 000-10.4z M12 9.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z M12 2v3 M12 19v3 M2 12h3 M19 12h3",
  },
  copyPath: {
    label: "复制",
    s: "M5 8h10v12H5z M9 5h10v11",
  },
  chevronRight: {
    label: "展开栏",
    s: "M9 7l6 5-6 5",
  },
  chevronLeft: {
    label: "收起栏",
    s: "M15 7l-6 5 6 5",
  },
  sparkle: {
    label: "AI",
    d: "M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z M18.6 2.6l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7z M5.6 14.6l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9L3.1 17.1l1.9-.6z",
  },
  immersive: {
    label: "沉浸",
    s: "M7.2 17.8a7.5 7.5 0 119.6 0",
  },
};

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** 两档尺寸：密集列表 18px，主操作 24px。 */
export type IconSize = 18 | 24;
