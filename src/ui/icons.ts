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
  | "closeOthers"
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
  | "exportWord"
  | "exportZip"
  | "exportMdpkg"
  | "share"
  | "splitRight"
  | "splitDown"
  | "locate"
  | "refresh"
  | "copyPath"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "sparkle"
  | "pinOff"
  | "immersive"
  | "collapse"
  | "play"
  | "pause"
  | "prev"
  | "next"
  | "volume"
  | "volumeMute"
  | "playlist"
  | "loopNone"
  | "loopSingle"
  | "loopPlaylist"
  | "subtitle"
  | "timestampNote"
  | "fullscreen"
  | "keyboardHints"
  | "pip"
  | "camera"
  | "tune"
  | "droplet"
  | "layoutAuto"
  | "rotate"
  | "zoomIn"
  | "zoomOut"
  | "speed"
  | "home"
  | "heart"
  | "heartFilled"
  | "sunBright"
  | "sunWarm"
  | "abstract"
  | "success"
  | "question"
  | "failure"
  | "bug"
  | "example"
  | "convert"
  | "align"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "link"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "bullet"
  | "ordered"
  | "todo"
  | "quote"
  | "blockcode"
  | "callout"
  | "table"
  | "undo"
  | "redo"
  | "copy"
  | "trash"
  | "scissors"
  | "brush"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "edit"
  | "globe"
  | "bulb"
  | "info"
  | "danger"
  | "indent"
  | "outdent"
  | "columns1"
  | "columns2"
  | "columns3"
  | "columns4"
  | "columns5"
  | "divider";

export interface IconPart {
  d?: string;
  s?: string;
  /** stroke-dasharray 值，如 "2 2"。 */
  dash?: string;
}

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
  dash?: string;
  /** 存在时覆盖 `d`/`s`，用于「实线格 + 虚线格」这类多段图标。 */
  parts?: IconPart[];
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
  closeOthers: {
    label: "关闭其他",
    parts: [{ s: "M4 4l6 6M10 4l-6 6" }, { s: "M14 7h6" }, { s: "M14 13h6" }],
  },
  search: {
    label: "搜索",
    s: "M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13z M15.5 15.5L21 21",
  },
  sun: {
    label: "浅色",
    s: "M12 8a4 4 0 100 8 4 4 0 000-8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2",
  },
  sunBright: {
    label: "亮色",
    s: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M12 2.5v3 M20.23 7.25l-1.9 1.1 M20.23 16.75l-1.9 -1.1 M12 21.5v-3 M3.77 16.75l1.9 -1.1 M3.77 7.25l1.9 1.1",
  },
  sunWarm: {
    label: "暖色",
    s: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M12 2.5v2.2 M12 19.3v2.2 M2.5 12h2.2 M19.3 12h2.2",
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
    s: "M9 4h6 M12 4v1.4 M9.4 6.4h5.2l1.2 3.4H8.2L9.4 6.4z M8.4 9.8h7.2 M12 9.8v6.2",
  },
  pinOff: {
    label: "取消钉住",
    s: "M9 4h6 M12 4v1.4 M9.4 6.4h5.2l1.2 3.4H8.2L9.4 6.4z M8.4 9.8h7.2 M12 9.8v6.2 M7.4 16.6L16.6 7.4",
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
    s: "M18.6 10.1L20.3 10A0.6 0.6 0 0 1 21 10.6L21 13.4A0.6 0.6 0 0 1 20.3 14L18.6 13.9A0.6 0.6 0 0 0 18 14.2L17.4 15.3A0.6 0.6 0 0 0 17.5 16L18.8 17.2A0.6 0.6 0 0 1 18.7 18.1L16.5 19.9A0.6 0.6 0 0 1 15.6 19.8L14.6 18.3A0.6 0.6 0 0 0 14 18L12.8 18.3A0.6 0.6 0 0 0 12.4 18.8L12.1 20.6A0.6 0.6 0 0 1 11.4 21.1L8.6 20.4A0.6 0.6 0 0 1 8.2 19.7L8.7 18A0.6 0.6 0 0 0 8.5 17.3L7.6 16.6A0.6 0.6 0 0 0 6.9 16.5L5.4 17.4A0.6 0.6 0 0 1 4.5 17.2L3.3 14.6A0.6 0.6 0 0 1 3.6 13.8L5.3 13.2A0.6 0.6 0 0 0 5.7 12.6L5.7 11.4A0.6 0.6 0 0 0 5.3 10.8L3.6 10.2A0.6 0.6 0 0 1 3.3 9.4L4.5 6.8A0.6 0.6 0 0 1 5.4 6.6L6.9 7.5A0.6 0.6 0 0 0 7.6 7.4L8.5 6.7A0.6 0.6 0 0 0 8.7 6L8.2 4.3A0.6 0.6 0 0 1 8.6 3.6L11.4 2.9A0.6 0.6 0 0 1 12.1 3.4L12.4 5.2A0.6 0.6 0 0 0 12.8 5.7L14 6A0.6 0.6 0 0 0 14.6 5.7L15.6 4.2A0.6 0.6 0 0 1 16.5 4.1L18.7 5.9A0.6 0.6 0 0 1 18.8 6.8L17.5 8A0.6 0.6 0 0 0 17.4 8.7L18 9.8A0.6 0.6 0 0 0 18.6 10.1Z M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0 -6.4z",
  },
  expand: {
    label: "全屏格",
    s: "M4 9V4h5 M15 4h5v5 M4 15v5h5 M15 20h5v-5",
  },
  collapse: {
    label: "退出全屏",
    s: "M4 9h5V4 M20 9h-5V4 M4 15h5v5 M20 15h-5v5",
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
  exportWord: {
    label: "Word 导出",
    s: "M6 3h8l4 4v14H6z M14 3v4h4 M8.5 9.5l1.6 6.5 1.9-4.3 1.9 4.3 1.6-6.5",
  },
  exportZip: {
    label: "ZIP 导出",
    s: "M4 5h16v14H4z M12 5v14 M10.6 8h2.8 M10.6 11h2.8 M10.6 14h2.8",
  },
  exportMdpkg: {
    label: ".mdpkg 导出",
    s: "M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9",
  },
  share: {
    label: "分享",
    s: "M6 12a2 2 0 100-4 2 2 0 000 4z M18 6a2 2 0 100-4 2 2 0 000 4z M18 22a2 2 0 100-4 2 2 0 000 4z M8 10l8-3 M8 14l8 3",
  },
  splitRight: {
    label: "向右分栏",
    parts: [
      { s: "M4 5h6.5v14H4z" },
      { s: "M13.5 5h6.5v14h-6.5z", dash: "2 2" },
    ],
  },
  splitDown: {
    label: "向下分栏",
    parts: [{ s: "M5 4h14v6.5H5z" }, { s: "M5 13.5h14v6.5H5z", dash: "2 2" }],
  },
  refresh: {
    label: "刷新",
    s: "M20 12a8 8 0 10-2.3 5.6 M20 6v6h-6",
  },
  locate: {
    label: "定位",
    s: "M12 6.8a5.2 5.2 0 100 10.4 5.2 5.2 0 000-10.4z M12 9.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z M12 2v3 M12 19v3 M2 12h3 M19 12h3",
  },
  copyPath: {
    label: "复制",
    s: "M5 8h10v12H5z M9 5h10v11",
  },
  chevronDown: {
    label: "展开",
    s: "M6 9l6 6 6-6",
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
  play: {
    label: "播放",
    d: "M8.5 5.2v13.6L19 12z",
  },
  pause: {
    label: "暂停",
    d: "M7.4 5h3.2v14H7.4z M13.4 5h3.2v14h-3.2z",
  },
  prev: {
    label: "上一首",
    parts: [{ s: "M7 5v14" }, { d: "M18 5.4v13.2L9.6 12z" }],
  },
  next: {
    label: "下一首",
    parts: [{ s: "M17 5v14" }, { d: "M6 5.4v13.2L14.4 12z" }],
  },
  volume: {
    label: "音量",
    s: "M4 9.5h3.5L12 5.8v12.4L7.5 14.5H4z M15.5 9.2a4 4 0 010 5.6 M18.2 6.6a7.5 7.5 0 010 10.8",
  },
  volumeMute: {
    label: "静音",
    s: "M4 9.5h3.5L12 5.8v12.4L7.5 14.5H4z M5.8 7.2l5.4 9.6",
  },
  playlist: {
    label: "播放列表",
    s: "M4 6h10 M4 11h10 M4 16h7 M15 13.5l5.5 3-5.5 3z",
  },
  loopNone: {
    label: "不循环",
    s: "M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5",
  },
  loopSingle: {
    label: "单曲循环",
    s: "M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5 M11.5 10v4.5 M10.4 11.2l1.1-1.1",
  },
  loopPlaylist: {
    label: "列表循环",
    s: "M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5 M10.5 10v4.5 M10.5 10l3.2 4.5 M13.7 10v4.5",
  },
  subtitle: {
    label: "字幕",
    s: "M4 5h16v9H9.5L6 17.5V14H4z M8 8.5h8 M8 11.5h5",
  },
  timestampNote: {
    label: "时间戳笔记",
    s: "M4 20.5l4.5-1.1L19 8.9a2.1 2.1 0 0 0-3-3L5.5 16.4 4 20.5z M14.5 7.5l2.9 2.9 M13 21h8",
  },
  keyboardHints: {
    label: "快捷键",
    s: "M4.5 6h15A1.5 1.5 0 0121 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5v-9A1.5 1.5 0 014.5 6z M6.5 9h1 M10 9h1 M13.5 9h1 M17 9h1 M6.5 12h1 M17 12h1 M9 12h6 M8 15h8",
  },
  pip: {
    label: "画中画",
    s: "M3 5.5h18v13H3z M12.5 12.5h6v4h-6z",
  },
  fullscreen: {
    label: "全屏",
    s: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
  },
  layoutAuto: {
    label: "自动布局",
    parts: [
      { s: "M4.5 19.5L14.2 9.8" },
      { s: "M15 4l0.8 2.7 2.7 0.8-2.7 0.8L15 11l-0.8-2.7-2.7-0.8 2.7-0.8z" },
      { s: "M20 12l0.5 1.6 1.6 0.5-1.6 0.5-0.5 1.6-0.5-1.6-1.6-0.5 1.6-0.5z" },
      { s: "M8 3l0.5 1.6 1.6 0.5-1.6 0.5L8 7.2l-0.5-1.6L5.9 5.1l1.6-0.5z" },
    ],
  },
  droplet: {
    label: "墨滴",
    parts: [
      {
        s: "M12 3.5c3.2 3.9 5.5 7.2 5.5 9.9a5.5 5.5 0 1 1-11 0c0-2.7 2.3-6 5.5-9.9z",
      },
    ],
  },
  tune: {
    label: "画面",
    parts: [
      { s: "M4 7h9M17 7h3M4 17h3M11 17h9" },
      { s: "M15 7a2 2 0 1 0 0.01 0zM9 17a2 2 0 1 0 0.01 0z" },
    ],
  },
  rotate: {
    label: "旋转画面",
    parts: [{ s: "M4 12a8 8 0 1 1 2.4 5.7" }, { s: "M3 8v4h4" }],
  },
  zoomIn: {
    label: "放大画面",
    parts: [
      { s: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" },
      { s: "M16 16l5 5M11 8v6M8 11h6" },
    ],
  },
  zoomOut: {
    label: "缩小画面",
    parts: [
      { s: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" },
      { s: "M16 16l5 5M8 11h6" },
    ],
  },
  camera: {
    label: "截取当前画面",
    parts: [
      {
        s: "M3 8.5A1.5 1.5 0 0 1 4.5 7h3l1.5-2h6l1.5 2h3A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z",
      },
      { s: "M12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
    ],
  },
  speed: {
    label: "倍速",
    s: "M4.5 18a8 8 0 1115 0 M12 14l3.6-5.6 M12 14h.01",
  },
  heart: {
    label: "收藏",
    s: "M12 19.5s-6.8-4.3-6.8-9.2A3.6 3.6 0 0112 8a3.6 3.6 0 016.8 2.3c0 4.9-6.8 9.2-6.8 9.2z",
  },
  heartFilled: {
    label: "已收藏",
    d: "M12 20.2s-7.4-4.6-7.4-9.8A3.9 3.9 0 0112 7.6a3.9 3.9 0 017.4 2.8c0 5.2-7.4 9.8-7.4 9.8z",
  },
  home: {
    label: "首页",
    s: "M4 11l8-7 8 7 M6 10v9h12v-9 M10 19v-5h4v5",
  },
  convert: {
    label: "转换",
    s: "M4.6 5h8.8A1.6 1.6 0 0 1 15 6.6v5.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 12.4V6.6A1.6 1.6 0 0 1 4.6 5z M17 9.5h4 M21 9.5l-2-2 M21 9.5l-2 2 M3 18h9",
  },
  align: {
    label: "对齐",
    s: "M4 6h16 M6.5 10h11 M4 14h16 M8.5 18h7",
  },
  bold: {
    label: "加粗",
    s: "M7 5h5.4a3.4 3.4 0 0 1 0 6.8H7z M7 11.8h6.2a3.6 3.6 0 0 1 0 7.2H7z",
  },
  italic: {
    label: "斜体",
    s: "M10 5h7 M7 19h7 M14.5 5 9.5 19",
  },
  underline: {
    label: "下划线",
    s: "M7 5v6a5 5 0 0 0 10 0V5 M5.5 20h13",
  },
  strike: {
    label: "删除线",
    s: "M6 9.2c0-2.2 2.4-3.7 6-3.7s6 1.5 6 3.7 M6 14.8c0 2.2 2.4 3.7 6 3.7s6-1.5 6-3.7 M4 12h16",
  },
  link: {
    label: "链接",
    s: "M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1 M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1",
  },
  h1: {
    label: "一级标题",
    s: "M4 6v12 M12 6v12 M4 12h8 M17 9.5 19.5 8v10",
  },
  h2: {
    label: "二级标题",
    s: "M4 6v12 M12 6v12 M4 12h8 M16.4 10a2.3 2.3 0 0 1 4 1.5c0 2.6-4 3.2-4 6.5H21",
  },
  h3: {
    label: "三级标题",
    s: "M4 6v12 M12 6v12 M4 12h8 M16.4 9h4l-2.4 3.2a3 3 0 1 1-1.6 5",
  },
  h4: {
    label: "四级标题",
    s: "M4 6v12 M12 6v12 M4 12h8 M16.6 8v5.2h3 M19.6 8v8",
  },
  h5: {
    label: "五级标题",
    s: "M4 6v12 M12 6v12 M4 12h8 M16.4 8h4l-.6 3.4h-2.2a2.2 2.2 0 1 0 2.2 2.2",
  },
  h6: {
    label: "六级标题",
    s: "M4 6v12 M12 6v12 M4 12h8 M19.8 8.4a2.2 2.2 0 0 0-2.2 2.2v3.2a2.2 2.2 0 0 0 4.4 0v-1a2.2 2.2 0 0 0-4.4 0",
  },
  bullet: {
    label: "无序列表",
    s: "M9 7h11 M9 12h11 M9 17h11 M4.6 7a1.1 1.1 0 1 0 0-.01 M4.6 12a1.1 1.1 0 1 0 0-.01 M4.6 17a1.1 1.1 0 1 0 0-.01",
  },
  ordered: {
    label: "有序列表",
    s: "M9 7h11 M9 12h11 M9 17h11 M4 5.5 5.4 4.8V8 M3.6 11.4a1.4 1.4 0 0 1 2.6.6c0 1.3-2.6 1.8-2.6 3.2h2.7",
  },
  todo: {
    label: "待办",
    s: "M4.9 4.5h4.2A1.4 1.4 0 0 1 10.5 5.9v4.2a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4V5.9A1.4 1.4 0 0 1 4.9 4.5z M5 7.4 6.2 8.6 8.2 5.8 M12.5 7.5h8 M12.5 15h8 M3.5 15h6",
  },
  quote: {
    label: "引用",
    s: "M5 5v14 M10 7h9 M10 12h9 M10 17h6",
  },
  blockcode: {
    label: "代码块",
    s: "M4.6 4.5h14.8A1.6 1.6 0 0 1 21 6.1v11.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.9V6.1A1.6 1.6 0 0 1 4.6 4.5z M8.5 9.5 6.5 12l2 2.5 M15.5 9.5 17.5 12l-2 2.5",
  },
  callout: {
    label: "高亮",
    s: "M4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4V6.6A1.6 1.6 0 0 1 4.6 5z M7 12h4 M14 12h3",
  },
  table: {
    label: "表格",
    s: "M4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4V6.6A1.6 1.6 0 0 1 4.6 5z M3 10h18 M9.5 10v9 M15 10v9",
  },
  undo: {
    label: "后退",
    s: "M4.5 9.5h9a4.5 4.5 0 0 1 0 9H9 M8 5.5 4.5 9.5 8 13.5",
  },
  redo: {
    label: "前进",
    s: "M19.5 9.5h-9a4.5 4.5 0 0 0 0 9H15 M16 5.5 19.5 9.5 16 13.5",
  },
  copy: {
    label: "复制选区",
    s: "M10.5 8.5h7A2 2 0 0 1 19.5 10.5v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2",
  },
  trash: {
    label: "删除",
    s: "M4.5 7h15 M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7 M6.5 7l.8 12.2A1.4 1.4 0 0 0 8.7 20.5h6.6a1.4 1.4 0 0 0 1.4-1.3L17.5 7",
  },
  scissors: {
    label: "剪切",
    s: "M6 9a3 3 0 1 0 0-6 3 3 0 1 0 0 6z M8.12 8.12 12 12 M20 4 8.12 15.88 M6 21a3 3 0 1 0 0-6 3 3 0 1 0 0 6z M14.8 14.8 20 20",
  },
  brush: {
    label: "格式刷",
    s: "M15.5 4.5 10 10l4 4 5.5-5.5a2.8 2.8 0 0 0-4-4z M10 10c-2 0-3.4 1.4-3.4 3.4 0 1.6-1 2.4-2.6 3 2.6 1.6 6.6 1.4 8-1.4",
  },
  alignLeft: {
    label: "左对齐",
    s: "M4 6h16 M4 12h10 M4 18h13",
  },
  alignCenter: {
    label: "居中",
    s: "M4 6h16 M7 12h10 M5.5 18h13",
  },
  alignRight: {
    label: "右对齐",
    s: "M4 6h16 M10 12h10 M7 18h13",
  },
  edit: {
    label: "改写",
    s: "M15.5 4.5 19.5 8.5 8 20l-4.5.5L4 16z",
  },
  globe: {
    label: "翻译",
    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M3.8 12h16.4 M12 3.6c2.6 2.4 4 5.4 4 8.4s-1.4 6-4 8.4c-2.6-2.4-4-5.4-4-8.4s1.4-6 4-8.4z",
  },
  bulb: {
    label: "提示",
    s: "M9.2 17h5.6 M10 20h4 M12 3.5a5.6 5.6 0 0 1 3 10.3V17H9v-3.2A5.6 5.6 0 0 1 12 3.5z",
  },
  info: {
    label: "信息",
    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M12 11v5 M12 8.2v.01",
  },
  danger: {
    label: "危险",
    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M9.4 9.4l5.2 5.2 M14.6 9.4l-5.2 5.2",
  },
  indent: {
    label: "增加缩进",
    s: "M4 6h16 M4 18h16 M9 12h11 M4 9l3 3-3 3",
  },
  outdent: {
    label: "减少缩进",
    s: "M4 6h16 M4 18h16 M9 12h11 M7 9l-3 3 3 3",
  },
  divider: {
    label: "分割线",
    s: "M4 12h16",
  },
  columns1: {
    label: "1 栏",
    s: "M3.5 5.5h17.0v13.0h-17.0z",
  },
  columns2: {
    label: "2 栏",
    s: "M3.5 5.5h17.0v13.0h-17.0z M12.00 5.5V18.5",
  },
  columns3: {
    label: "3 栏",
    s: "M3.5 5.5h17.0v13.0h-17.0z M9.17 5.5V18.5 M14.83 5.5V18.5",
  },
  columns4: {
    label: "4 栏",
    s: "M3.5 5.5h17.0v13.0h-17.0z M7.75 5.5V18.5 M12.00 5.5V18.5 M16.25 5.5V18.5",
  },
  columns5: {
    label: "5 栏",
    s: "M3.5 5.5h17.0v13.0h-17.0z M6.90 5.5V18.5 M10.30 5.5V18.5 M13.70 5.5V18.5 M17.10 5.5V18.5",
  },
  abstract: {
    label: "摘要",
    s: "M8 5h8v2H8z M6 5h12v14H6z M9 10h6 M9 13h6 M9 16h4",
  },
  success: {
    label: "成功",
    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M8.4 12.2l2.4 2.4 4.6-4.8",
  },
  question: {
    label: "问题",
    s: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M9.6 9.2a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.6 M12 16.8v.01",
  },
  failure: {
    label: "失败",
    s: "M5 5h14v14H5z M9 9l6 6 M15 9l-6 6",
  },
  bug: {
    label: "Bug",
    s: "M9 6a3 3 0 0 1 6 0 M7 9h10v6a5 5 0 0 1-10 0z M3.5 10h3.5 M17 10h3.5 M3.5 15h3.5 M17 15h3.5 M8 6l-1.5-2 M16 6l1.5-2",
  },
  example: {
    label: "示例",
    s: "M6 4h9l4 4v12H6z M15 4v4h4 M9 12h7 M9 15h5",
  },
};

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/**
 * 把图标序列化成 HTML 字符串，供非 React 渲染面（播放器 ArtPlayer 自绘控件）
 * 复用同一张表。规则与 `Icon.tsx` 保持一致：`s` 描边、`d` 实心、`parts` 多段。
 */
export function iconSvg(name: IconName, size = 22): string {
  const def = ICONS[name];
  const parts = def.parts ?? [{ d: def.d, s: def.s, dash: def.dash }];
  const inner = parts
    .map((part) => {
      const out: string[] = [];
      if (part.s) {
        const dash = part.dash ? ` stroke-dasharray="${part.dash}"` : "";
        out.push(
          `<path d="${part.s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${dash}/>`,
        );
      }
      if (part.d) {
        out.push(
          `<path d="${part.d}" fill="currentColor" fill-rule="evenodd"/>`,
        );
      }
      return out.join("");
    })
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" data-icon="${name}">${inner}</svg>`;
}

/** 两档尺寸：密集列表 18px，主操作 24px。 */
export type IconSize = 14 | 18 | 24;
