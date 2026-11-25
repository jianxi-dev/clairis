// Tauri API Mock + Store bridge — injected before app loads
window.__TAURI_INTERNALS__ = {
  metadata: {},
  invoke: mockInvoke,
  // 与真实 Tauri convertFileSrc 一致：整个路径 encodeURIComponent
  // （buildAssetUrl 依赖前缀提取，不编码会取错 lastIndexOf("/") 导致路径重复）
  convertFileSrc: function (path) {
    return "asset://localhost/" + encodeURIComponent(path);
  },
};

// Expose store access for E2E tests
window.__biaoyue_store__ = null;
window.__biaoyue_saved_files__ = [];
window.__biaoyue_saved_binaries__ = [];
// 窗口拖动观测：mock 环境无真实窗口位移，记录 startDragging 调用次数供 e2e 断言。
window.__dragCalls__ = 0;
window.__biaoyue_openFile__ = function (path, content, title) {
  if (!window.__biaoyue_store__) return false;
  var store = window.__biaoyue_store__.getState();
  store.openFile(path, content);
  store.addRecentFile(path, title || path.split("/").pop());
  return true;
};

// ── AI entry (C4) mock state ─────────────────────────────────
// config 持久化到 localStorage：模拟真实「配置文件在重启后仍在」，
// 否则 reload 后 load_config 又回到默认响应，无法测持久化。
var aiState = { config: null, snapshots: [], seq: 0 };
try {
  var __persisted = localStorage.getItem("__mock_config");
  if (__persisted) {
    aiState.config = JSON.parse(__persisted);
  }
} catch (e) {
  /* 忽略 */
}

// ── 数据面（html-toolbar）mock state ─────────────────────────
// 默认集合与 src-tauri/src/resources/html-toolbar.default.json 逐项一致；
// 测试用 window.__biaoyue_surface_items__ 覆盖默认项，用
// window.__biaoyue_surface_error__ 模拟加载失败。
var DEFAULT_SURFACE_ITEMS = [
  { id: "ai-rewrite", label: "改写", icon: "edit", group: "ai" },
  { id: "ai-translate", label: "翻译", icon: "globe", group: "ai" },
  { id: "ai-polish", label: "润色", icon: "sparkle", group: "ai" },
  { id: "format-bold", label: "粗体", icon: "bold", group: "format" },
  { id: "format-italic", label: "斜体", icon: "italic", group: "format" },
  {
    id: "format-underline",
    label: "下划线",
    icon: "underline",
    group: "format",
  },
  { id: "format-strike", label: "删除线", icon: "strike", group: "format" },
  { id: "format-code", label: "行内代码", icon: "code", group: "format" },
  { id: "format-link", label: "链接", icon: "link", group: "format" },
  { id: "align-left", label: "左对齐", icon: "alignLeft", group: "align" },
  { id: "align-center", label: "居中", icon: "alignCenter", group: "align" },
  { id: "align-right", label: "右对齐", icon: "alignRight", group: "align" },
];

// ── 数据面（menus）mock state ───────────────────────────────
// 默认集合与 src-tauri/src/resources/menus.default.json 逐项一致；
// 测试用 window.__biaoyue_menu_items__ 覆盖默认项（整组替换）。
var DEFAULT_MENU_ITEMS = [
  { id: "pane-new-file", group: "pane-header", order: 1, label: "新建文件", icon: "file", action: "new-file", enabled: true },
  { id: "pane-share", group: "pane-header", order: 2, label: "分享", icon: "share", action: "share", enabled: true },
  { id: "pane-split-right", group: "pane-header", order: 3, label: "右分", icon: "splitRight", action: "splitRight", enabled: true },
  { id: "pane-split-down", group: "pane-header", order: 4, label: "下分", icon: "splitDown", action: "splitDown", enabled: true },
  { id: "pane-source", group: "pane-header", order: 5, label: "源码模式", icon: "code", action: "source", enabled: true },
  { id: "pane-locate", group: "pane-header", order: 6, label: "定位", icon: "locate", action: "locate", enabled: true },
  { id: "ai-undock", group: "ai-pane", order: 1, label: "脱离为小窗", icon: "export", action: "undockAi", enabled: true },
  { id: "export-docx", group: "export-submenu", order: 1, label: "Word", icon: "exportWord", action: "exportDocx", enabled: true },
  { id: "export-mdpkg", group: "export-submenu", order: 2, label: ".mdpkg", icon: "exportMdpkg", action: "exportMdpkg", enabled: true },
  { id: "export-png", group: "export-submenu", order: 3, label: "图片", icon: "image", action: "exportPng", enabled: true },
  { id: "export-pdf", group: "export-submenu", order: 4, label: "PDF", icon: "pdf", action: "exportPdf", enabled: true },
  { id: "export-html", group: "export-submenu", order: 5, label: "HTML", icon: "html", action: "exportHtml", enabled: true },
  { id: "export-zip", group: "export-submenu", order: 6, label: "ZIP", icon: "exportZip", action: "exportZip", enabled: true },
  { id: "tab-preview", group: "tab-context", order: 1, label: "悬浮小窗", icon: "pip", action: "previewTab", enabled: true },
  { id: "tab-split-right", group: "tab-context", order: 2, label: "向右分栏", icon: "splitRight", action: "splitRight", enabled: true },
  { id: "tab-split-down", group: "tab-context", order: 3, label: "向下分栏", icon: "splitDown", action: "splitDown", enabled: true },
  { id: "tab-add-field", group: "tab-context", order: 4, label: "添加字段", icon: "plus", action: "addField", enabled: true },
  { id: "tab-export", group: "tab-context", order: 5, label: "导出", icon: "export", action: "export", enabled: true },
  { id: "tab-print", group: "tab-context", order: 6, label: "打印", icon: "print", action: "print", enabled: true },
  { id: "tab-copy-path", group: "tab-context", order: 7, label: "复制路径", icon: "copyPath", action: "copyPath", enabled: true },
  { id: "tab-reveal", group: "tab-context", order: 8, label: "打开文件位置", icon: "locate", action: "reveal", enabled: true },
  { id: "tab-move", group: "tab-context", order: 9, label: "移动到…", icon: "moveTo", action: "moveTo", enabled: true },
  { id: "tab-reload", group: "tab-context", order: 10, label: "刷新", icon: "refresh", action: "reload", enabled: true },
  { id: "tab-close", group: "tab-context", order: 11, label: "关闭", icon: "close", action: "closeTab", enabled: true },
  { id: "tab-close-others", group: "tab-context", order: 12, label: "关闭其他", icon: "closeOthers", action: "closeOthers", enabled: true },
  { id: "preview-open-folder", group: "preview-context", order: 1, label: "打开所在文件夹", icon: "folder", action: "openFolder", enabled: true },
  { id: "preview-save-as", group: "preview-context", order: 2, label: "另存为…", icon: "export", action: "saveAs", enabled: true },
  { id: "preview-copy-path", group: "preview-context", order: 3, label: "复制文件路径", icon: "copyPath", action: "copyPath", enabled: true },
  { id: "preview-close", group: "preview-context", order: 4, label: "关闭预览", icon: "close", action: "closePreview", enabled: true },
  { id: "ai-preset-theme-groups", group: "ai-float-presets", order: 1, label: "按主题分组", icon: "grid", action: "preset:theme-groups", enabled: true },
  { id: "ai-preset-pinned-recent-only", group: "ai-float-presets", order: 2, label: "只留收藏和最近", icon: "pin", action: "preset:pinned-recent-only", enabled: true },
  { id: "ai-preset-pinned-scale", group: "ai-float-presets", order: 3, label: "收藏段放大", icon: "zoomIn", action: "preset:pinned-scale", enabled: true },
  { id: "ai-preset-grid-list", group: "ai-float-presets", order: 4, label: "网格改列表", icon: "grid", action: "preset:grid-list", enabled: true },
  { id: "ai-preset-grid-group-type", group: "ai-float-presets", order: 5, label: "网格按类型分组", icon: "grid", action: "preset:grid-group-type", enabled: true },
  { id: "ai-preset-unread-filter", group: "ai-float-presets", order: 6, label: "加未读筛选", icon: "eye", action: "preset:unread-filter", enabled: true }
];

// ── 数据面（icons）mock state ───────────────────────────────
// 默认集合与 src-tauri/src/resources/icons.default.json 逐项一致；
// 测试用 window.__biaoyue_icon_items__ 覆盖（map 型逐键深合并）。
var DEFAULT_ICON_ITEMS = [{"key":"markdown","label":"Markdown","s":"M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M8.5 16.5V10L12 14.2L15.5 10V16.5"},{"key":"html","label":"HTML","s":"M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M10 12l-2 2.5L10 17 M14 12l2 2.5L14 17 M13 11l-2 7"},{"key":"text","label":"文本","s":"M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M9.5 12h5 M9.5 15h5 M9.5 18h3"},{"key":"pdf","label":"PDF","s":"M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z M9.5 17V11h2.6a2 2 0 010 4H9.5"},{"key":"video","label":"视频","s":"M3.5 6h17v12h-17z M10 9.5l5 2.5-5 2.5z"},{"key":"image","label":"图片","s":"M3.5 5h17v14h-17z M8 10.2a1.4 1.4 0 110-2.8 1.4 1.4 0 010 2.8z M5 17.5l4.5-5 3 3.2 2-2.2 4.5 4"},{"key":"code","label":"代码","s":"M9 8l-5 4 5 4 M15 8l5 4-5 4"},{"key":"audio","label":"音频","s":"M10 18V7l7-2v11 M10 18a2 2 0 11-4 0 2 2 0 014 0z M17 16a2 2 0 11-4 0 2 2 0 014 0z"},{"key":"folder","label":"文件夹","s":"M3.5 7h6l2 2h9v10h-17z"},{"key":"moveTo","label":"移动到","parts":[{"s":"M3.5 7h5l1.8 1.8h4.2v9.2h-11z"},{"s":"M16.5 12h4 M18.6 9.4l2.6 2.6-2.6 2.6"}]},{"key":"clock","label":"时钟","s":"M12 4a8 8 0 1 1 0 16 8 8 0 1 1 0-16 M12 7.5V12l3 2"},{"key":"file","label":"文件","s":"M6 3h8l4 4v14H6z M14 3v4h4"},{"key":"close","label":"关闭","s":"M6.5 6.5l11 11 M17.5 6.5l-11 11"},{"key":"closeOthers","label":"关闭其他","parts":[{"s":"M4 4l6 6M10 4l-6 6"},{"s":"M14 7h6"},{"s":"M14 13h6"}]},{"key":"search","label":"搜索","s":"M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13z M15.5 15.5L21 21"},{"key":"sun","label":"浅色","s":"M12 8a4 4 0 100 8 4 4 0 000-8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2"},{"key":"sunBright","label":"亮色","s":"M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M12 2.5v3 M20.23 7.25l-1.9 1.1 M20.23 16.75l-1.9 -1.1 M12 21.5v-3 M3.77 16.75l1.9 -1.1 M3.77 7.25l1.9 1.1"},{"key":"sunWarm","label":"暖色","s":"M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M12 2.5v2.2 M12 19.3v2.2 M2.5 12h2.2 M19.3 12h2.2"},{"key":"moon","label":"深色","s":"M13.5 3a9 9 0 107.5 12.9A7.2 7.2 0 0113.5 3z"},{"key":"monitor","label":"跟随系统","s":"M4 5h16v11H4z M9.5 18.5h5"},{"key":"pin","label":"钉住","s":"M9 4h6 M12 4v1.4 M9.4 6.4h5.2l1.2 3.4H8.2L9.4 6.4z M8.4 9.8h7.2 M12 9.8v6.2"},{"key":"pinOff","label":"取消钉住","s":"M9 4h6 M12 4v1.4 M9.4 6.4h5.2l1.2 3.4H8.2L9.4 6.4z M8.4 9.8h7.2 M12 9.8v6.2 M7.4 16.6L16.6 7.4"},{"key":"grid","label":"网格概览","s":"M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"},{"key":"check","label":"完成","s":"M5 12.5l4.5 4.5L19 7.5"},{"key":"lock","label":"锁定","s":"M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4"},{"key":"warning","label":"警告","s":"M12 3.5l9.5 16H2.5z M12 9.5v4.5 M11.4 16.6h1.2"},{"key":"settings","label":"设置","s":"M18.6 10.1L20.3 10A0.6 0.6 0 0 1 21 10.6L21 13.4A0.6 0.6 0 0 1 20.3 14L18.6 13.9A0.6 0.6 0 0 0 18 14.2L17.4 15.3A0.6 0.6 0 0 0 17.5 16L18.8 17.2A0.6 0.6 0 0 1 18.7 18.1L16.5 19.9A0.6 0.6 0 0 1 15.6 19.8L14.6 18.3A0.6 0.6 0 0 0 14 18L12.8 18.3A0.6 0.6 0 0 0 12.4 18.8L12.1 20.6A0.6 0.6 0 0 1 11.4 21.1L8.6 20.4A0.6 0.6 0 0 1 8.2 19.7L8.7 18A0.6 0.6 0 0 0 8.5 17.3L7.6 16.6A0.6 0.6 0 0 0 6.9 16.5L5.4 17.4A0.6 0.6 0 0 1 4.5 17.2L3.3 14.6A0.6 0.6 0 0 1 3.6 13.8L5.3 13.2A0.6 0.6 0 0 0 5.7 12.6L5.7 11.4A0.6 0.6 0 0 0 5.3 10.8L3.6 10.2A0.6 0.6 0 0 1 3.3 9.4L4.5 6.8A0.6 0.6 0 0 1 5.4 6.6L6.9 7.5A0.6 0.6 0 0 0 7.6 7.4L8.5 6.7A0.6 0.6 0 0 0 8.7 6L8.2 4.3A0.6 0.6 0 0 1 8.6 3.6L11.4 2.9A0.6 0.6 0 0 1 12.1 3.4L12.4 5.2A0.6 0.6 0 0 0 12.8 5.7L14 6A0.6 0.6 0 0 0 14.6 5.7L15.6 4.2A0.6 0.6 0 0 1 16.5 4.1L18.7 5.9A0.6 0.6 0 0 1 18.8 6.8L17.5 8A0.6 0.6 0 0 0 17.4 8.7L18 9.8A0.6 0.6 0 0 0 18.6 10.1Z M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0 -6.4z"},{"key":"expand","label":"全屏格","s":"M4 9V4h5 M15 4h5v5 M4 15v5h5 M15 20h5v-5"},{"key":"collapse","label":"退出全屏","s":"M4 9h5V4 M20 9h-5V4 M4 15h5v5 M20 15h-5v5"},{"key":"more","label":"更多","d":"M5 11h2.4v2.4H5z M10.8 11h2.4v2.4h-2.4z M16.6 11h2.4v2.4h-2.4z"},{"key":"eye","label":"预览","s":"M2.5 12c2.2-3.4 5.6-5.4 9.5-5.4s7.3 2 9.5 5.4c-2.2 3.4-5.6 5.4-9.5 5.4s-7.3-2-9.5-5.4z M12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z"},{"key":"eyeOff","label":"隐藏字段","s":"M2.5 12c2.2-3.4 5.6-5.4 9.5-5.4s7.3 2 9.5 5.4c-2.2 3.4-5.6 5.4-9.5 5.4s-7.3-2-9.5-5.4z M12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z M5.2 5.2l13.6 13.6"},{"key":"plus","label":"添加","s":"M12 5v14 M5 12h14"},{"key":"pencil","label":"编辑","s":"M4 20h4l10.4-10.4-4-4L4 16z M14.4 5.6l1.5-1.5a1 1 0 011.4 0l2.6 2.6a1 1 0 010 1.4l-1.5 1.5z"},{"key":"export","label":"导出","s":"M12 15V3 M8 7l4-4 4 4 M4 14v6h16v-6"},{"key":"exportWord","label":"Word 导出","s":"M6 3h8l4 4v14H6z M14 3v4h4 M8.5 9.5l1.6 6.5 1.9-4.3 1.9 4.3 1.6-6.5"},{"key":"exportZip","label":"ZIP 导出","s":"M4 5h16v14H4z M12 5v14 M10.6 8h2.8 M10.6 11h2.8 M10.6 14h2.8"},{"key":"exportMdpkg","label":".mdpkg 导出","s":"M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9"},{"key":"print","label":"打印","s":"M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z"},{"key":"share","label":"分享","s":"M6 12a2 2 0 100-4 2 2 0 000 4z M18 6a2 2 0 100-4 2 2 0 000 4z M18 22a2 2 0 100-4 2 2 0 000 4z M8 10l8-3 M8 14l8 3"},{"key":"splitRight","label":"向右分栏","parts":[{"s":"M4 5h6.5v14H4z"},{"s":"M13.5 5h6.5v14h-6.5z","dash":"2 2"}]},{"key":"splitDown","label":"向下分栏","parts":[{"s":"M5 4h14v6.5H5z"},{"s":"M5 13.5h14v6.5H5z","dash":"2 2"}]},{"key":"refresh","label":"刷新","s":"M20 12a8 8 0 10-2.3 5.6 M20 6v6h-6"},{"key":"locate","label":"定位","s":"M12 6.8a5.2 5.2 0 100 10.4 5.2 5.2 0 000-10.4z M12 9.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z M12 2v3 M12 19v3 M2 12h3 M19 12h3"},{"key":"copyPath","label":"复制路径","parts":[{"s":"M3 7h5l1.8 1.8h4.2v7.4H3z"},{"s":"M16.5 5.5l4 13"}]},{"key":"copyFile","label":"复制文件","parts":[{"s":"M4.5 6h6.5l3 3v9.5H4.5z"},{"s":"M15.5 12.5L20 8 M20 8h-3 M20 8v3"}]},{"key":"chevronDown","label":"展开","s":"M6 9l6 6 6-6"},{"key":"chevronRight","label":"展开栏","s":"M9 7l6 5-6 5"},{"key":"chevronLeft","label":"收起栏","s":"M15 7l-6 5 6 5"},{"key":"sparkle","label":"AI","d":"M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z M18.6 2.6l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7z M5.6 14.6l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9L3.1 17.1l1.9-.6z"},{"key":"immersive","label":"禅模式","s":"M7.2 17.8a7.5 7.5 0 119.6 0"},{"key":"play","label":"播放","d":"M8.5 5.2v13.6L19 12z"},{"key":"pause","label":"暂停","d":"M7.4 5h3.2v14H7.4z M13.4 5h3.2v14h-3.2z"},{"key":"prev","label":"上一首","parts":[{"s":"M7 5v14"},{"d":"M18 5.4v13.2L9.6 12z"}]},{"key":"next","label":"下一首","parts":[{"s":"M17 5v14"},{"d":"M6 5.4v13.2L14.4 12z"}]},{"key":"volume","label":"音量","s":"M4 9.5h3.5L12 5.8v12.4L7.5 14.5H4z M15.5 9.2a4 4 0 010 5.6 M18.2 6.6a7.5 7.5 0 010 10.8"},{"key":"volumeMute","label":"静音","s":"M4 9.5h3.5L12 5.8v12.4L7.5 14.5H4z M5.8 7.2l5.4 9.6"},{"key":"playlist","label":"播放列表","s":"M4 6h10 M4 11h10 M4 16h7 M15 13.5l5.5 3-5.5 3z"},{"key":"loopNone","label":"不循环","s":"M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5"},{"key":"loopSingle","label":"单曲循环","s":"M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5 M11.5 10v4.5 M10.4 11.2l1.1-1.1"},{"key":"loopPlaylist","label":"列表循环","s":"M5.5 10.5a5.5 5.5 0 0111-2.9 M18.5 13.5a5.5 5.5 0 01-11 2.9 M14 7.6h2.5V5.1 M10 16.4H7.5v2.5 M10.5 10v4.5 M10.5 10l3.2 4.5 M13.7 10v4.5"},{"key":"subtitle","label":"字幕","s":"M4 5h16v9H9.5L6 17.5V14H4z M8 8.5h8 M8 11.5h5"},{"key":"timestampNote","label":"时间戳笔记","s":"M4 20.5l4.5-1.1L19 8.9a2.1 2.1 0 0 0-3-3L5.5 16.4 4 20.5z M14.5 7.5l2.9 2.9 M13 21h8"},{"key":"enterKey","label":"回车","parts":[{"s":"M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"},{"s":"M16 9v3.2a2.3 2.3 0 01-2.3 2.3H9.2 M12.9 11.9L9.2 14.5l3.7 2.6"}]},{"key":"keyboardHints","label":"快捷键","s":"M4.5 6h15A1.5 1.5 0 0121 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5v-9A1.5 1.5 0 014.5 6z M6.5 9h1 M10 9h1 M13.5 9h1 M17 9h1 M6.5 12h1 M17 12h1 M9 12h6 M8 15h8"},{"key":"pip","label":"画中画","s":"M3 5.5h18v13H3z M12.5 12.5h6v4h-6z"},{"key":"fullscreen","label":"全屏","s":"M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5"},{"key":"layoutAuto","label":"自动布局","parts":[{"s":"M4.5 19.5L14.2 9.8"},{"s":"M15 4l0.8 2.7 2.7 0.8-2.7 0.8L15 11l-0.8-2.7-2.7-0.8 2.7-0.8z"},{"s":"M20 12l0.5 1.6 1.6 0.5-1.6 0.5-0.5 1.6-0.5-1.6-1.6-0.5 1.6-0.5z"},{"s":"M8 3l0.5 1.6 1.6 0.5-1.6 0.5L8 7.2l-0.5-1.6L5.9 5.1l1.6-0.5z"}]},{"key":"droplet","label":"墨滴","parts":[{"s":"M12 3.5c3.2 3.9 5.5 7.2 5.5 9.9a5.5 5.5 0 1 1-11 0c0-2.7 2.3-6 5.5-9.9z"}]},{"key":"tune","label":"画面","parts":[{"s":"M4 7h9M17 7h3M4 17h3M11 17h9"},{"s":"M15 7a2 2 0 1 0 0.01 0zM9 17a2 2 0 1 0 0.01 0z"}]},{"key":"rotate","label":"旋转画面","parts":[{"s":"M4 12a8 8 0 1 1 2.4 5.7"},{"s":"M3 8v4h4"}]},{"key":"zoomIn","label":"放大画面","parts":[{"s":"M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"},{"s":"M16 16l5 5M11 8v6M8 11h6"}]},{"key":"zoomOut","label":"缩小画面","parts":[{"s":"M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"},{"s":"M16 16l5 5M8 11h6"}]},{"key":"camera","label":"截取当前画面","parts":[{"s":"M3 8.5A1.5 1.5 0 0 1 4.5 7h3l1.5-2h6l1.5 2h3A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"},{"s":"M12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"}]},{"key":"speed","label":"倍速","s":"M4.5 18a8 8 0 1115 0 M12 14l3.6-5.6 M12 14h.01"},{"key":"width","label":"宽度","s":"M4 12h16 M4 12l3.5-3.5 M4 12l3.5 3.5 M20 12l-3.5-3.5 M20 12l-3.5 3.5"},{"key":"heart","label":"收藏","s":"M12 19.5s-6.8-4.3-6.8-9.2A3.6 3.6 0 0112 8a3.6 3.6 0 016.8 2.3c0 4.9-6.8 9.2-6.8 9.2z"},{"key":"heartFilled","label":"已收藏","d":"M12 20.2s-7.4-4.6-7.4-9.8A3.9 3.9 0 0112 7.6a3.9 3.9 0 017.4 2.8c0 5.2-7.4 9.8-7.4 9.8z"},{"key":"home","label":"首页","s":"M4 11l8-7 8 7 M6 10v9h12v-9 M10 19v-5h4v5"},{"key":"convert","label":"转换","s":"M4.6 5h8.8A1.6 1.6 0 0 1 15 6.6v5.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 12.4V6.6A1.6 1.6 0 0 1 4.6 5z M17 9.5h4 M21 9.5l-2-2 M21 9.5l-2 2 M3 18h9"},{"key":"align","label":"对齐","s":"M4 6h16 M6.5 10h11 M4 14h16 M8.5 18h7"},{"key":"bold","label":"加粗","s":"M7 5h5.4a3.4 3.4 0 0 1 0 6.8H7z M7 11.8h6.2a3.6 3.6 0 0 1 0 7.2H7z"},{"key":"italic","label":"斜体","s":"M10 5h7 M7 19h7 M14.5 5 9.5 19"},{"key":"underline","label":"下划线","s":"M7 5v6a5 5 0 0 0 10 0V5 M5.5 20h13"},{"key":"strike","label":"删除线","s":"M6 9.2c0-2.2 2.4-3.7 6-3.7s6 1.5 6 3.7 M6 14.8c0 2.2 2.4 3.7 6 3.7s6-1.5 6-3.7 M4 12h16"},{"key":"link","label":"链接","s":"M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1 M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"},{"key":"h1","label":"一级标题","s":"M4 6v12 M12 6v12 M4 12h8 M17 9.5 19.5 8v10"},{"key":"h2","label":"二级标题","s":"M4 6v12 M12 6v12 M4 12h8 M16.4 10a2.3 2.3 0 0 1 4 1.5c0 2.6-4 3.2-4 6.5H21"},{"key":"h3","label":"三级标题","s":"M4 6v12 M12 6v12 M4 12h8 M16.4 9h4l-2.4 3.2a3 3 0 1 1-1.6 5"},{"key":"h4","label":"四级标题","s":"M4 6v12 M12 6v12 M4 12h8 M16.6 8v5.2h3 M19.6 8v8"},{"key":"h5","label":"五级标题","s":"M4 6v12 M12 6v12 M4 12h8 M16.4 8h4l-.6 3.4h-2.2a2.2 2.2 0 1 0 2.2 2.2"},{"key":"h6","label":"六级标题","s":"M4 6v12 M12 6v12 M4 12h8 M19.8 8.4a2.2 2.2 0 0 0-2.2 2.2v3.2a2.2 2.2 0 0 0 4.4 0v-1a2.2 2.2 0 0 0-4.4 0"},{"key":"bullet","label":"无序列表","s":"M9 7h11 M9 12h11 M9 17h11 M4.6 7a1.1 1.1 0 1 0 0-.01 M4.6 12a1.1 1.1 0 1 0 0-.01 M4.6 17a1.1 1.1 0 1 0 0-.01"},{"key":"ordered","label":"有序列表","s":"M9 7h11 M9 12h11 M9 17h11 M4 5.5 5.4 4.8V8 M3.6 11.4a1.4 1.4 0 0 1 2.6.6c0 1.3-2.6 1.8-2.6 3.2h2.7"},{"key":"todo","label":"待办","s":"M4.9 4.5h4.2A1.4 1.4 0 0 1 10.5 5.9v4.2a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4V5.9A1.4 1.4 0 0 1 4.9 4.5z M5 7.4 6.2 8.6 8.2 5.8 M12.5 7.5h8 M12.5 15h8 M3.5 15h6"},{"key":"quote","label":"引用","s":"M5 5v14 M10 7h9 M10 12h9 M10 17h6"},{"key":"blockcode","label":"代码块","s":"M4.6 4.5h14.8A1.6 1.6 0 0 1 21 6.1v11.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.9V6.1A1.6 1.6 0 0 1 4.6 4.5z M8.5 9.5 6.5 12l2 2.5 M15.5 9.5 17.5 12l-2 2.5"},{"key":"callout","label":"高亮","s":"M4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4V6.6A1.6 1.6 0 0 1 4.6 5z M7 12h4 M14 12h3"},{"key":"table","label":"表格","s":"M4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v10.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4V6.6A1.6 1.6 0 0 1 4.6 5z M3 10h18 M9.5 10v9 M15 10v9"},{"key":"undo","label":"后退","s":"M4.5 9.5h9a4.5 4.5 0 0 1 0 9H9 M8 5.5 4.5 9.5 8 13.5"},{"key":"redo","label":"前进","s":"M19.5 9.5h-9a4.5 4.5 0 0 0 0 9H15 M16 5.5 19.5 9.5 16 13.5"},{"key":"copy","label":"复制选区","s":"M10.5 8.5h7A2 2 0 0 1 19.5 10.5v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"},{"key":"trash","label":"删除","s":"M4.5 7h15 M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7 M6.5 7l.8 12.2A1.4 1.4 0 0 0 8.7 20.5h6.6a1.4 1.4 0 0 0 1.4-1.3L17.5 7"},{"key":"cut","label":"剪下","s":"M7 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z M7 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z M9.2 8.6 19.5 19 M19.5 5 9.2 15.4"},{"key":"paste","label":"粘贴","s":"M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-12A1.5 1.5 0 0 1 6.5 5z M9 3h6v4H9z M8.5 12h7 M8.5 15.5h7"},{"key":"arrowUp","label":"上移","s":"M12 19V5 M6 11l6-6 6 6"},{"key":"arrowDown","label":"下移","s":"M12 5v14 M6 13l6 6 6-6"},{"key":"scissors","label":"剪切","s":"M6 9a3 3 0 1 0 0-6 3 3 0 1 0 0 6z M8.12 8.12 12 12 M20 4 8.12 15.88 M6 21a3 3 0 1 0 0-6 3 3 0 1 0 0 6z M14.8 14.8 20 20"},{"key":"brush","label":"格式刷","s":"M15.5 4.5 10 10l4 4 5.5-5.5a2.8 2.8 0 0 0-4-4z M10 10c-2 0-3.4 1.4-3.4 3.4 0 1.6-1 2.4-2.6 3 2.6 1.6 6.6 1.4 8-1.4"},{"key":"highlighter","label":"荧光笔","s":"M9.5 4.5h5v3h-5z M10.5 7.5 5 18l1.6 1.5L14 12.5 M13.5 7.5 19 18l-1.6 1.5L10 12.5"},{"key":"alignLeft","label":"左对齐","s":"M4 6h16 M4 12h10 M4 18h13"},{"key":"alignCenter","label":"居中","s":"M4 6h16 M7 12h10 M5.5 18h13"},{"key":"alignRight","label":"右对齐","s":"M4 6h16 M10 12h10 M7 18h13"},{"key":"edit","label":"改写","s":"M15.5 4.5 19.5 8.5 8 20l-4.5.5L4 16z"},{"key":"globe","label":"翻译","s":"M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M3.8 12h16.4 M12 3.6c2.6 2.4 4 5.4 4 8.4s-1.4 6-4 8.4c-2.6-2.4-4-5.4-4-8.4s1.4-6 4-8.4z"},{"key":"bulb","label":"提示","s":"M9.2 17h5.6 M10 20h4 M12 3.5a5.6 5.6 0 0 1 3 10.3V17H9v-3.2A5.6 5.6 0 0 1 12 3.5z"},{"key":"info","label":"信息","s":"M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M12 11v5 M12 8.2v.01"},{"key":"danger","label":"危险","s":"M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M9.4 9.4l5.2 5.2 M14.6 9.4l-5.2 5.2"},{"key":"indent","label":"增加缩进","s":"M4 6h16 M4 18h16 M9 12h11 M4 9l3 3-3 3"},{"key":"outdent","label":"减少缩进","s":"M4 6h16 M4 18h16 M9 12h11 M7 9l-3 3 3 3"},{"key":"divider","label":"分割线","s":"M4 12h16"},{"key":"columns1","label":"1 栏","s":"M3.5 5.5h17.0v13.0h-17.0z"},{"key":"columns2","label":"2 栏","s":"M3.5 5.5h17.0v13.0h-17.0z M12.00 5.5V18.5"},{"key":"columns3","label":"3 栏","s":"M3.5 5.5h17.0v13.0h-17.0z M9.17 5.5V18.5 M14.83 5.5V18.5"},{"key":"columns4","label":"4 栏","s":"M3.5 5.5h17.0v13.0h-17.0z M7.75 5.5V18.5 M12.00 5.5V18.5 M16.25 5.5V18.5"},{"key":"columns5","label":"5 栏","s":"M3.5 5.5h17.0v13.0h-17.0z M6.90 5.5V18.5 M10.30 5.5V18.5 M13.70 5.5V18.5 M17.10 5.5V18.5"},{"key":"abstract","label":"摘要","s":"M8 5h8v2H8z M6 5h12v14H6z M9 10h6 M9 13h6 M9 16h4"},{"key":"success","label":"成功","s":"M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M8.4 12.2l2.4 2.4 4.6-4.8"},{"key":"question","label":"问题","s":"M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z M9.6 9.2a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.6 M12 16.8v.01"},{"key":"failure","label":"失败","s":"M5 5h14v14H5z M9 9l6 6 M15 9l-6 6"},{"key":"bug","label":"Bug","s":"M9 6a3 3 0 0 1 6 0 M7 9h10v6a5 5 0 0 1-10 0z M3.5 10h3.5 M17 10h3.5 M3.5 15h3.5 M17 15h3.5 M8 6l-1.5-2 M16 6l1.5-2"},{"key":"example","label":"示例","s":"M6 4h9l4 4v12H6z M15 4v4h4 M9 12h7 M9 15h5"},{"key":"docPropertyVariant","label":"属性面板形态切换（L 一行条 / T 精排双列）","parts":[{"s":"M5 5v14 M5 19h13"},{"s":"M5 5h14 M12 5v14"}]},{"key":"selectAll","label":"全选","s":"M4.5 4.5h15v15h-15z M8 12l3 3 5.5-6"},{"key":"foldTriangle","label":"折叠三角","d":"M8 5 L17 12 L8 19 Z"}];

function menuItems() {
  var override = window.__biaoyue_menu_items__;
  return Array.isArray(override)
    ? cloneJson(override)
    : cloneJson(DEFAULT_MENU_ITEMS);
}

function surfaceItems() {
  var override = window.__biaoyue_surface_items__;
  return Array.isArray(override)
    ? cloneJson(override)
    : cloneJson(DEFAULT_SURFACE_ITEMS);
}

function iconItems() {
  var override = window.__biaoyue_icon_items__;
  if (override && typeof override === "object" && !Array.isArray(override)) {
    var out = cloneJson(DEFAULT_ICON_ITEMS);
    for (var key in override) {
      if (!Object.prototype.hasOwnProperty.call(override, key)) continue;
      var def = override[key];
      if (!def || typeof def !== "object") continue;
      var hit = -1;
      for (var i = 0; i < out.length; i++) {
        if (out[i].key === key) { hit = i; break; }
      }
      if (hit >= 0) {
        out[hit] = Object.assign({}, out[hit], def);
      } else if (def.label && (def.s || def.d || def.parts)) {
        // 新增概念键：整条定义追加（与 Rust merge_map_surface 同语义）
        var item = { key: key };
        if (def.label) item.label = def.label;
        if (def.d) item.d = def.d;
        if (def.s) item.s = def.s;
        if (def.dash) item.dash = def.dash;
        if (def.parts) item.parts = cloneJson(def.parts);
        out.push(item);
      }
    }
    return out;
  }
  return cloneJson(DEFAULT_ICON_ITEMS);
}

// ── 扩展包管理（#184）mock state ─────────────────────────────
var extensionPackages = [
  {
    id: "builtin-reading",
    name: "阅读增强",
    version: "1.0.0",
    description: "内置阅读扩展",
    source: "builtin",
    enabled: true,
    dir: null,
    skill: "# 阅读增强\n\n内置扩展：提供阅读辅助能力。",
  },
  {
    id: "builtin-outline",
    name: "大纲导航",
    version: "1.0.0",
    description: "内置大纲扩展",
    source: "builtin",
    enabled: true,
    dir: null,
    skill: "# 大纲导航\n\n内置扩展：提供文档大纲导航。",
  },
];
window.__biaoyue_extension_packages__ = extensionPackages;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function findExtensionPackage(id) {
  for (var i = 0; i < extensionPackages.length; i++) {
    if (extensionPackages[i].id === id) return extensionPackages[i];
  }
  return null;
}

// 系统钥匙串 mock：只存 service:account → key，绝不落配置/存储
window.__biaoyue_keyring__ = {};
window.__biaoyue_ai_config__ = function () {
  return aiState.config ? JSON.parse(JSON.stringify(aiState.config)) : null;
};

function aiPad(n, w) {
  var s = String(n);
  while (s.length < (w || 2)) s = "0" + s;
  return s;
}

function aiSnapshotName() {
  aiState.seq += 1;
  var d = new Date();
  var stamp =
    d.getUTCFullYear() +
    "-" +
    aiPad(d.getUTCMonth() + 1) +
    "-" +
    aiPad(d.getUTCDate()) +
    "T" +
    aiPad(d.getUTCHours()) +
    "-" +
    aiPad(d.getUTCMinutes()) +
    "-" +
    aiPad(d.getUTCSeconds()) +
    "-" +
    aiPad(d.getUTCMilliseconds() * 1000, 6) +
    "Z";
  return "settings-" + stamp + "-" + aiState.seq + ".json";
}

function aiSnapshot() {
  var name = aiSnapshotName();
  aiState.snapshots.push({
    name: name,
    config: JSON.parse(JSON.stringify(aiState.config)),
  });
  while (aiState.snapshots.length > 10) aiState.snapshots.shift();
  return name;
}

// 模拟「AI 改了配置」：先快照当前状态，再应用新值（与真实 patch_config 语义一致）
window.__biaoyue_ai_theme__ = function (theme) {
  if (!aiState.config) return null;
  aiSnapshot();
  aiState.config.theme = theme;
  return JSON.parse(JSON.stringify(aiState.config));
};

function aiRunAgentTurn(messages) {
  var text = (messages || [])
    .map(function (m) {
      return (m && m.content) || "";
    })
    .join("\n");
  if (text.indexOf("深色") >= 0 || text.indexOf("dark") >= 0) {
    window.__biaoyue_ai_theme__("dark");
    return {
      text: "已切换到深色主题。",
      turns: 2,
      tool_calls: ["patch_config"],
    };
  }
  if (text.indexOf("浅色") >= 0 || text.indexOf("light") >= 0) {
    window.__biaoyue_ai_theme__("light");
    return {
      text: "已切换到浅色主题。",
      turns: 2,
      tool_calls: ["patch_config"],
    };
  }
  if (text.indexOf("字号") >= 0) {
    aiSnapshot();
    aiState.config.fontSize = 18;
    return {
      text: "已把字号调到 18。",
      turns: 2,
      tool_calls: ["patch_config"],
    };
  }
  if (text.indexOf("翻译") >= 0)
    return { text: "这是翻译后的文本。", turns: 1, tool_calls: [] };
  if (text.indexOf("润色") >= 0)
    return { text: "这是润色后的文本。", turns: 1, tool_calls: [] };
  if (text.indexOf("改写") >= 0)
    return { text: "这是改写后的文本。", turns: 1, tool_calls: [] };
  return { text: "收到。", turns: 1, tool_calls: [] };
}

// 本机字体枚举 mock（#1178 起返回 {family, localized} 对象数组）。
// family 顺序镜像既有 e2e 常量（heading-fonts-853/1136），localized 为中文系统对照。
var DEFAULT_SYSTEM_FONTS = [
  { family: "PingFang SC", localized: "苹方-简" },
  { family: "Hiragino Sans GB", localized: "冬青黑体-简" },
  { family: "Songti SC", localized: "宋体-简" },
  { family: "Heiti SC", localized: "黑体-简" },
  { family: "STHeiti", localized: "华文黑体" },
  { family: "Kaiti SC", localized: "楷体-简" },
  { family: "Arial", localized: "Arial" },
  { family: "Helvetica", localized: "Helvetica" },
  { family: "Times New Roman", localized: "Times New Roman" },
  { family: "Georgia", localized: "Georgia" },
  { family: "Menlo", localized: "Menlo" },
  { family: "SF Mono", localized: "SF Mono" },
  { family: "Noto Sans CJK SC", localized: "思源黑体 SC" },
  { family: "Source Han Sans SC", localized: "思源黑体 SC" },
  { family: "Noto Sans", localized: "Noto Sans" },
  { family: "Noto Serif CJK SC", localized: "思源宋体 SC" },
  { family: "Source Han Serif SC", localized: "思源宋体 SC" },
  { family: "Inter", localized: "Inter" },
  { family: "JetBrains Mono", localized: "JetBrains Mono" },
  { family: "Fira Code", localized: "Fira Code" },
  { family: "IBM Plex Sans", localized: "IBM Plex Sans" },
  { family: "Microsoft YaHei", localized: "微软雅黑" },
  { family: "SimSun", localized: "宋体" },
  { family: "SimHei", localized: "黑体" },
];

function mockInvoke(cmd, args) {
  var responses = {
    load_config: {
      fontSize: 16,
      headingColors: null,
      ollamaEndpoint: "http://localhost:11434",
      openaiEndpoint: "https://api.openai.com",
      openaiModel: "gpt-4o-mini",
      translationProvider: "ollama",
      sourceLang: "en",
      targetLang: "zh-CN",
      theme: "system",
      sidebarLeftVisible: true,
      sidebarRightVisible: false,
      sidebarLeftWidth: 220,
      sidebarRightWidth: 320,
      recentFiles: [
        {
          path: "/Users/test/测试文档.md",
          title: "测试文档.md",
          openedAt: "2020-01-02T10:00:00.000Z",
          excerpt: "这是从文件里截下来的真实开头，不是占位文案。",
        },
        {
          path: "/Users/test/另一个.md",
          title: "另一个.md",
          openedAt: "2020-01-01T09:00:00.000Z",
          excerpt: "另一份文档的开头。",
        },
      ],
    },
    open_file: {
      content:
        "# 测试文档\n\n## 第一节\n\n这是测试内容。\n\n## 第二节\n\n更多内容。\n\n### 子节\n\n嵌套标题。\n\n- 列表项1\n- 列表项2\n\n```js\nconsole.log('hello')\n```\n\n> 引用文本\n\n**粗体** 和 *斜体*\n\n- [ ] 待办\n- [x] 已完成",
      path: "/Users/test/测试文档.md",
      file_size: 350,
    },
    save_file: { path: "/Users/test/测试文档.md" },
    save_as_file: { path: "/Users/test/新文件.md" },
    pick_folder: "/Users/test",
    flatten_files: {
      entries: [
        {
          name: "测试文档.md",
          path: "/Users/test/测试文档.md",
          relative_path: "测试文档.md",
          is_dir: false,
          size: 350,
        },
        {
          name: "另一个.md",
          path: "/Users/test/另一个.md",
          relative_path: "另一个.md",
          is_dir: false,
          size: 40,
        },
        {
          name: "笔记",
          path: "/Users/test/笔记",
          relative_path: "笔记",
          is_dir: true,
          size: 0,
        },
        {
          name: "周报.md",
          path: "/Users/test/笔记/周报.md",
          relative_path: "笔记/周报.md",
          is_dir: false,
          size: 120,
        },
        {
          name: "会议.md",
          path: "/Users/test/笔记/会议.md",
          relative_path: "笔记/会议.md",
          is_dir: false,
          size: 200,
        },
      ],
      truncated: false,
    },
    read_directory: {
      entries: [
        {
          name: "测试文档.md",
          path: "/Users/test/测试文档.md",
          is_dir: false,
          size: 350,
        },
        { name: "笔记", path: "/Users/test/笔记", is_dir: true, size: 0 },
      ],
      path: "/Users/test",
    },
    get_file_info: {
      path: "/Users/test/测试文档.md",
      size: 350,
      is_dir: false,
      modified: 1719000000,
    },
  };
  if (cmd === "read_file_base64" && args && args.path) {
    // /Users/test/doc.pdf 返回真实小 PDF（e2e/fixtures/mini.pdf，2 页，含 "BiaoyuePDFTest"）
    if (
      args.path === "/Users/test/doc.pdf" ||
      args.path === "/tmp/rc/report.pdf"
    ) {
      return "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA2IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NSA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDcyMCBUZCAoQmlhb3l1ZVBERlRlc3QpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCjYgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNyAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjcgMCBvYmoKPDwgL0xlbmd0aCA0MSA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDcyMCBUZCAoU2Vjb25kUGFnZSkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAyNDcgMDAwMDAgbiAKMDAwMDAwMDM0MiAwMDAwMCBuIAowMDAwMDAwNDEyIDAwMDAwIG4gCjAwMDAwMDA1MzggMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA4IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo2MjkKJSVFT0YK";
    }
    return "AAECAwQ=";
  }
  if (cmd === "open_file_direct" && args && args.path) {
    var failPaths = window.__biaoyue_fail_open_paths__;
    if (Array.isArray(failPaths) && failPaths.indexOf(args.path) >= 0) {
      return Promise.reject(
        new Error("mock open_file_direct 失败: " + args.path),
      );
    }
    return {
      content: "# " + args.path.split("/").pop() + "\n\n文件内容。",
      path: args.path,
      file_size: 100,
    };
  }
  if (cmd === "save_as_file") {
    window.__lastSaveAs = args || {};
    if (args) {
      window.__biaoyue_saved_files__.push({
        content: args.content,
        defaultName: args.defaultName,
      });
    }
    return {
      path: "/Users/test/" + ((args && args.defaultName) || "新文件.md"),
    };
  }
  if (cmd === "move_file" && args && args.from && args.toDir) {
    var name = args.from.split("/").pop();
    return args.toDir.replace(/\/$/, "") + "/" + name;
  }
  if (!aiState.config) {
    aiState.config = JSON.parse(JSON.stringify(responses.load_config));
    aiSnapshot();
  }
  if (cmd === "load_config") return JSON.parse(JSON.stringify(aiState.config));
  if (cmd === "save_config" && args && args.config) {
    aiSnapshot();
    aiState.config = JSON.parse(JSON.stringify(args.config));
    try {
      localStorage.setItem("__mock_config", JSON.stringify(aiState.config));
    } catch (e) {
      /* 忽略 */
    }
    return null;
  }
  if (cmd === "set_api_key" && args) {
    window.__biaoyue_keyring__[args.service + ":" + args.account] = args.key;
    return null;
  }
  if (cmd === "get_api_key" && args) {
    return (
      window.__biaoyue_keyring__[args.service + ":" + args.account] || null
    );
  }
  if (cmd === "delete_api_key" && args) {
    delete window.__biaoyue_keyring__[args.service + ":" + args.account];
    return null;
  }
  if (cmd === "list_config_snapshots")
    return aiState.snapshots.map(function (s) {
      return s.name;
    });
  if (cmd === "restore_config_snapshot" && args && args.name) {
    var hit = null;
    for (var i = 0; i < aiState.snapshots.length; i++) {
      if (aiState.snapshots[i].name === args.name) {
        hit = aiState.snapshots[i];
        break;
      }
    }
    if (!hit) throw new Error("快照不存在: " + args.name);
    aiSnapshot();
    aiState.config = JSON.parse(JSON.stringify(hit.config));
    return JSON.parse(JSON.stringify(aiState.config));
  }
  if (cmd === "run_agent_turn" && args && args.messages)
    return aiRunAgentTurn(args.messages);
  if (cmd === "save_binary_as_file" && args) {
    window.__biaoyue_saved_binaries__.push({
      base64: args.base64,
      defaultName: args.defaultName,
    });
    return "/Users/test/" + (args.defaultName || "导出.png");
  }
  if (cmd === "load_surfaces") {
    if (window.__biaoyue_surface_error__) {
      return Promise.reject(new Error("mock load_surfaces 失败"));
    }
    return [
      { id: "html-toolbar", items: surfaceItems(), warnings: [] },
      { id: "menus", items: menuItems(), warnings: [] },
      { id: "icons", items: iconItems(), warnings: [] },
    ];
  }
  if (cmd === "list_extensions") {
    // 测试通过 window.__biaoyue_extensions__ 注入用户片段；未注入时返回空快照。
    var ext = window.__biaoyue_extensions__;
    if (!ext)
      return {
        snippets: [],
        templates: [],
        theme: { tokens: {}, warnings: [] },
        warnings: [],
      };
    return ext;
  }
  if (cmd === "save_file" && args) {
    // 记录写盘内容，供 e2e 断言"存下来的字节里没有编辑痕迹"
    const w = typeof window !== "undefined" ? window : globalThis;
    w.__saved_files__ = w.__saved_files__ || {};
    w.__saved_files__[args.path] = args.content;
    w.__save_calls__ = w.__save_calls__ || [];
    w.__save_calls__.push({
      path: args.path,
      at: Date.now(),
      content: args.content,
    });
    return { path: args.path };
  }
  if (cmd === "flatten_files") return responses.flatten_files;
  if (cmd === "pick_folder") return responses.pick_folder;
  if (cmd === "list_recent_documents") {
    // 默认空扫描：本机最近文件是可选能力，测试用 __biaoyue_recent_documents__ 注入。
    var docs = window.__biaoyue_recent_documents__;
    return Array.isArray(docs) ? cloneJson(docs) : [];
  }
  if (cmd === "search_documents") {
    // 本机检索：测试用 __biaoyue_search_documents__ 注入固定样例；
    // 按 query 过滤 title/excerpt/path，模拟 Rust 侧大小写不敏感子串匹配。
    var hits = window.__biaoyue_search_documents__;
    if (!Array.isArray(hits)) return [];
    var q = args && args.query ? String(args.query).toLowerCase() : "";
    var matched = [];
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var hay = (
        (h.title || "") +
        " " +
        (h.excerpt || "") +
        " " +
        (h.path || "")
      ).toLowerCase();
      if (!q || hay.indexOf(q) >= 0) matched.push(cloneJson(h));
    }
    return matched;
  }
  if (cmd === "plugin:window|start_dragging") {
    window.__dragCalls__ = (window.__dragCalls__ || 0) + 1;
    return Promise.resolve(null);
  }
  if (cmd === "copy_file_to_clipboard" && args) {
    const w = typeof window !== "undefined" ? window : globalThis;
    w.__copy_file_calls__ = w.__copy_file_calls__ || [];
    w.__copy_file_calls__.push(args.path);
    return null;
  }
  if (cmd === "reveal_in_finder" && args) {
    const w = typeof window !== "undefined" ? window : globalThis;
    w.__reveal_calls__ = w.__reveal_calls__ || [];
    w.__reveal_calls__.push(args.path);
    return null;
  }
  if (cmd === "open_file_external" && args) {
    const w = typeof window !== "undefined" ? window : globalThis;
    w.__open_external_calls__ = w.__open_external_calls__ || [];
    w.__open_external_calls__.push(args.path);
    return null;
  }
  if (cmd === "get_file_info" && args && args.path) {
    // 大小按路径注入（window.__biaoyue_file_sizes__），未注入时回落 350B。
    const sizes = window.__biaoyue_file_sizes__;
    const size =
      sizes && typeof sizes[args.path] === "number" ? sizes[args.path] : 350;
    return { path: args.path, size: size, is_dir: false, modified: 1719000000 };
  }
  if (cmd === "list_extension_packages") return cloneJson(extensionPackages);
  if (cmd === "import_extension_package" && args && args.path) {
    var base = String(args.path).split("/").pop() || "extension";
    var existing = findExtensionPackage(base);
    var imported = {
      id: base,
      name: base,
      version: "1.0.0",
      description: "从 " + args.path + " 导入",
      source: "user",
      enabled: true,
      dir: args.path,
      skill: "# " + base + "\n\n用户导入的扩展。",
    };
    if (existing) {
      extensionPackages[extensionPackages.indexOf(existing)] = imported;
    } else {
      extensionPackages.push(imported);
    }
    return cloneJson(imported);
  }
  if (cmd === "set_extension_package_enabled" && args) {
    var target = findExtensionPackage(args.id);
    if (target) target.enabled = !!args.enabled;
    return null;
  }
  if (cmd === "remove_extension_package" && args) {
    var victim = findExtensionPackage(args.id);
    if (victim) extensionPackages.splice(extensionPackages.indexOf(victim), 1);
    return null;
  }
  if (cmd === "package_extension_package" && args) {
    return "/tmp/extensions-export/" + args.id + ".zip";
  }
  if (cmd === "pick_extension_source" && args) {
    if (args.kind === "folder") return "/tmp/extensions-import/demo";
    if (args.kind === "zip") return "/tmp/extensions-import/demo.zip";
    return null;
  }
  if (cmd === "generate_extension_package" && args) {
    var prompt = String(args.prompt || "");
    return new Promise(function (resolve) {
      setTimeout(function () {
        var id = "ai-" + Date.now();
        var generated = {
          id: id,
          name: prompt.slice(0, 20) || "AI 扩展",
          version: "1.0.0",
          description: "AI 生成的扩展",
          source: "ai",
          enabled: true,
          dir: "/tmp/extensions-ai/" + id,
          skill: "# " + (prompt.slice(0, 20) || "AI 扩展") + "\n\n" + prompt,
        };
        extensionPackages.push(generated);
        resolve(cloneJson(generated));
      }, 250);
    });
  }
  if (cmd === "list_media_in_dir") {
    return window.__biaoyue_media__ || [];
  }
  if (cmd === "register_media_path") return null;
  if (cmd === "import_media_bytes" && args) {
    // 与 Rust 侧同策略：同大小复用，否则退位 -1/-2；只记 ledger，不写真盘。
    var suggested = args.suggestedName || "pasted-image.png";
    var dot = suggested.lastIndexOf(".");
    var stem = dot > 0 ? suggested.slice(0, dot) : suggested;
    var ext = dot > 0 ? suggested.slice(dot) : "";
    var ledger = window.__biaoyue_imported_assets__ || [];
    var candidate = suggested;
    var seq = 0;
    var hit = null;
    while (true) {
      hit = null;
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].name === candidate) {
          hit = ledger[i];
          break;
        }
      }
      if (!hit || hit.size === args.base64.length) break;
      seq += 1;
      candidate = stem + "-" + seq + ext;
    }
    if (!hit) {
      ledger.push({ name: candidate, size: args.base64.length });
      window.__biaoyue_imported_assets__ = ledger;
    }
    window.__biaoyue_imported_media_bytes__ =
      window.__biaoyue_imported_media_bytes__ || [];
    window.__biaoyue_imported_media_bytes__.push({
      docPath: args.docPath,
      suggestedName: suggested,
      size: args.base64.length,
    });
    return {
      path: "/Users/test/assets/" + candidate,
      name: "assets/" + candidate,
    };
  }
  if (cmd === "list_system_fonts") {
    // 测试可用 window.__biaoyue_system_fonts__ = SystemFont[] 覆盖（对象数组；
    // 兼容旧的 string[]，自动补 localized = family）；
    // window.__biaoyue_system_fonts_error__ = true 模拟枚举失败（#1136）。
    if (window.__biaoyue_system_fonts_error__) {
      return Promise.reject(new Error("font enumeration failed"));
    }
    var fontsOverride = window.__biaoyue_system_fonts__;
    if (Array.isArray(fontsOverride)) {
      return cloneJson(
        fontsOverride.map(function (font) {
          return typeof font === "string"
            ? { family: font, localized: font }
            : font;
        }),
      );
    }
    return cloneJson(DEFAULT_SYSTEM_FONTS);
  }
  if (responses[cmd]) return responses[cmd];
  console.warn("[TauriMock] unknown command:", cmd);
  return null;
}
