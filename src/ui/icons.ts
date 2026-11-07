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
  | "sparkle";

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
    d: "M5 3h9l5 5v13H5z M14 3v5h5 M9 12v5h1.6v-2.4L12 16.2l1.4-1.6V17H15v-5h-1.6L12 13.4 10.6 12z",
  },
  html: {
    label: "HTML",
    d: "M5 3h9l5 5v13H5z M14 3v5h5 M9 12.5l1.8 2.5L9 17.5h1.7l1.8-2.5-1.8-2.5z M15 12.5l-1.8 2.5 1.8 2.5h-1.7L11.5 15l1.8-2.5z",
  },
  text: {
    label: "文本",
    d: "M5 3h9l5 5v13H5z M14 3v5h5 M8 12h8v1.5H8zM8 15h8v1.5H8zM8 18h5v1.5H8z",
  },
  pdf: {
    label: "PDF",
    d: "M5 3h9l5 5v13H5z M14 3v5h5 M8.5 11.5h2.2a1.9 1.9 0 010 3.8H10v2.7H8.5zM10 12.9v1h0.7a0.5 0.5 0 000-1z",
  },
  video: {
    label: "视频",
    d: "M3 5h18v14H3z M10 9l5.5 3L10 15z",
  },
  image: {
    label: "图片",
    d: "M3 4h18v16H3z M6.5 8a1.5 1.5 0 110 3 1.5 1.5 0 010-3z M4.5 18l5-6 3.5 4 2.5-3 4 5z",
  },
  code: {
    label: "代码",
    d: "M8.6 7.2L5 12l3.6 4.8h2.2L7.4 12l3.4-4.8z M15.4 7.2L19 12l-3.6 4.8h-2.2L16.6 12l-3.4-4.8z",
  },
  audio: {
    label: "音频",
    d: "M12 4v11.2a3 3 0 10 1.6 2.6V8.4l5.4-1.5v9.3a3 3 0 10 1.6 2.6V4.6z",
  },
  folder: {
    label: "文件夹",
    d: "M3 5h7l2 2h9v12H3z",
  },
  file: {
    label: "文件",
    d: "M5 3h9l5 5v13H5z M14 3v5h5",
  },
  close: {
    label: "关闭",
    d: "M7.1 8.5l1.4-1.4 8.4 8.4-1.4 1.4z M8.5 16.9L7.1 15.5 15.5 7.1l1.4 1.4z",
  },
  search: {
    label: "搜索",
    d: "M10.5 3a7.5 7.5 0 105.9 12.1l3.3 3.3 1.4-1.4-3.3-3.3A7.5 7.5 0 0010.5 3zm0 2a5.5 5.5 0 110 11 5.5 5.5 0 010-11z",
  },
  sun: {
    label: "浅色",
    d: "M12 6.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z M11 1.5h2V4h-2zM11 20h2v2.5h-2zM1.5 11H4v2H1.5zM20 11h2.5v2H20zM4.2 5.6l1.4-1.4 1.8 1.8-1.4 1.4zM16.6 18l1.4-1.4 1.8 1.8-1.4 1.4zM5.6 18l-1.8 1.8-1.4-1.4 1.8-1.8zM18 6l-1.8-1.8 1.4-1.4L19.4 4.6z",
  },
  moon: {
    label: "深色",
    d: "M13.5 2a9.5 9.5 0 108.5 13.1A7.6 7.6 0 0113.5 2z",
  },
  monitor: {
    label: "跟随系统",
    d: "M3 4h18v12H3z M9 18h6v2H9z",
  },
  pin: {
    label: "钉住",
    d: "M9 3h6l-.8 4.2 2.8 2.8v1.5h-5v6.2l-1 2.3-1-2.3v-6.2H4v-1.5L6.8 7.2z M10.5 4.5l-.6 3.3L7 10.5h10l-2.9-2.7-.6-3.3z",
  },
  grid: {
    label: "网格概览",
    d: "M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z M5.5 5.5v3.5h3.5V5.5z M15 5.5v3.5h3.5V5.5z M5.5 15v3.5h3.5V15z M15 15v3.5h3.5V15z",
  },
  check: {
    label: "完成",
    d: "M9.6 17.4L4.2 12l1.4-1.4 4 4 8.8-8.8L19.8 7z",
  },
  warning: {
    label: "警告",
    d: "M12 2.5l10 18H2z M11 9h2v6h-2zM11 16.5h2V19h-2z",
  },
  settings: {
    label: "设置",
    d: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M10.6 2h2.8l.4 2.3 1.9 1.1 2.2-.9 1.4 2.4-1.7 1.6v2.2l1.7 1.6-1.4 2.4-2.2-.9-1.9 1.1-.4 2.3h-2.8l-.4-2.3-1.9-1.1-2.2.9-1.4-2.4L4.2 11V8.8L2.5 7.2 3.9 4.8l2.2.9 1.9-1.1z",
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
    d: "M12 5.2C7.3 5.2 3.5 8.3 1.6 12c1.9 3.7 5.7 6.8 10.4 6.8s8.5-3.1 10.4-6.8C20.5 8.3 16.7 5.2 12 5.2z M12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z",
  },
  pencil: {
    label: "编辑",
    d: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  },
  export: {
    label: "导出",
    d: "M11 3h2v7h-2z M12 14.5l-4.6-4.5h9.2z M4 18h16v2H4z",
  },
  share: {
    label: "分享",
    d: "M11 3h2v7h-2z M12 2l4.6 4.5h-9.2z M4 11h2v7h12v-7h2v9H4z",
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
    d: "M12 6.4a5.6 5.6 0 100 11.2 5.6 5.6 0 000-11.2z M12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z M11 2h2v3.4h-2z M11 18.6h2V22h-2z M2 11h3.4v2H2z M18.6 11H22v2h-3.4z",
  },
  copyPath: {
    label: "复制",
    d: "M4 7h11a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z M8 3h11a1 1 0 011 1v11h-2V5H8z",
  },
  chevronRight: {
    label: "展开栏",
    d: "M9.6 6L18 12l-8.4 6-1.8-1.8L14.4 12 7.8 7.8z",
  },
  chevronLeft: {
    label: "收起栏",
    d: "M14.4 6L16.2 7.8 9.6 12l6.6 4.2L14.4 18 6 12z",
  },
  sparkle: {
    label: "AI",
    d: "M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z M18.6 2.6l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7z M5.6 14.6l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9L3.1 17.1l1.9-.6z",
  },
};

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** 两档尺寸：密集列表 18px，主操作 24px。 */
export type IconSize = 18 | 24;
