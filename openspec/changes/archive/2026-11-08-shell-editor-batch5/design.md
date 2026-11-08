# Design: shell-editor-batch5

## Context

Biaoyue（标月）为 Tauri 2 + React 18 + CM6 + Zustand 桌面应用，模式切换用 CSS display 不 remount。分栏为递归 pane 树（`src/lib/paneTree.ts`），页签拖拽是**纯 pointer 事件**（无 HTML5 DnD），落点靠 `document.elementFromPoint` + `closest('[data-pane-id]')`。PDF 用 `@embedpdf/react-pdf-viewer`（PDFium wasm，shadow DOM 位图，UI 在 open shadowRoot 内，可注入 CSS / 用 `onReady` 拿 registry）。图标是静态 path 表 `src/ui/icons.ts`（`{d?, s?, label}`，描边 1.7，18/24 两档）。`md-bundle`（`/Users/mason/ToHighs/md-bundle`）是同类编辑器参考实现（浮动工具条、对齐、颜色、章节树），非 vendored。

本批 26 项跨 8 个表面，按切片交付。

## Goals / Non-Goals

**Goals:**
- 8 条垂直切片，逐片有浏览器可观测验收 + e2e 探针
- 复用 md-bundle 的既有能力（选区工具条、对齐、颜色、章节区间数学），不整包引入
- 图标与状态栏对齐既有设计规范（`docs/design/approved/`）

**Non-Goals:**
- 不 remount EditorView、不引入第二渲染管线、不引新图标库
- 不做跨平台手势适配（按 macOS 验证）
- 不复刻 workbuddy 全部功能，仅本 change 明列的两条工具条

## Decisions

- **D1 悬浮条跟随指针格**：`ImmersivePeekBar` 现绑定 `focusedPaneId` 且全局唯一。改为在热区 `pointermove` 时用 `document.elementFromPoint` + `closest('[data-pane-id]')` 解析指针所在格并高亮/切内容；无命中则回退 `focusedPaneId`。给其 `TabBar` 补 `paneId`/`onReorderTabs`/`onMoveToPane`。
  - 备选（弃）：每格各渲染一条悬浮条——与"全局唯一、悬停顶部热区唤出"的 G-10 交互模型冲突，且多格时视觉噪声大。
- **D2 拖拽期间冻结热区隐藏**：热区 `onMouseLeave` 2s 后置 `immersiveChromeVisible=false` 会卸载悬浮条、清 window 监听、中断拖拽。改：store 增 `tabDragActive`（或把拖拽态上提到不卸载的层），拖拽期间抑制该隐藏。
  - 备选（弃）：把拖拽逻辑从 TabBar 提到 App——改动面过大且与既有 pointer capture 模型不符。
- **D3 消除露白**：`App.tsx` 的 `.immersive-peek-trigger`（16px 透明）与 bar 是兄弟块，透出正文。改为热区与 bar 重叠（trigger 绝对定位覆盖/或用 zone padding + bar 负 margin），保留 16px 命中高度。
- **D4 页签 ghost**：`TabBar` 在 `pointermove` 记录 `clientX/Y`，`createPortal` 到 body 渲染 `position:fixed` 克隆（`pointer-events:none`，避免遮挡 `elementFromPoint`），`finish` 清理。保留虚线占位作落点提示。
- **D5 单格全屏（改 G-7）**：`PaneTreeView` 的 `showFullscreen={!rootIsLeaf}` 改为恒真（单格也显示）；`showClosePane` 保持 `!rootIsLeaf`（单格关格无意义）。同步改 G-7 规格。
- **D6 双击改名**：`TabBar` 标题 `<span>` 双击进入行内 `contentEditable`/`input`；store 加 `renameTab(tabId, title)`；回车提交、Esc 取消、失焦提交。仅改显示名，不改 `path`。
- **D7 PDF 缩放**：`PdfViewer` 的 `DISABLED_CATEGORIES` 追加 `zoom-in`/`zoom-out`（保留 `zoom` 菜单与百分比输入）。捏合：`onReady(registry)` 拿 zoom 插件，桥接 WebKit `gesturestart/gesturechange`（复用 `PreviewView` 的 `usePreviewZoom` 模式）驱动 `zoom:set`。
- **D8 PDF 页码条**：`onReady` 后 `ui.disableOverlay("page-controls")` 关底部浮现；用 `ui.mergeSchema` 把 `scroll:previous-page`/`scroll:next-page` + 页码指示并入 `main-toolbar`。
- **D9 PDF 缩略图**：候选 ① EmbedPDF render 插件运行时把首页渲到 canvas 生成 dataURL；② Rust 侧渲染。**待评估**（OQ-1），切片可先交付 D7/D8，缩略图子项后置。
- **D10 图标**：在 `src/ui/icons.ts` 增 `exportWord`/`exportZip`/`exportMdpkg` 形状；重绘 `subtitle`（气泡）/`keyboardHints`（键位格）；`paneHeaderMenu.ts` 的 export 项改指新名；播放器自绘控件经 `iconSvg(name, size)` 显式传与原生一致的尺寸（或加 CSS 覆盖）；`Toolbar` 沉浸按钮改图标+文字；pin 四处改 `name={pinned ? "pinOff" : "pin"}`。
- **D11 全角斜杠语义**：`smart-input.ts` 现静默把 `，`→`,`、`／`→`/`（不动菜单），`slash.ts` 的顿号 `、` 触发菜单但不转字符。统一为：全角 `／` 与顿号 `、` 输入后转 ASCII `/` 并打开斜杠菜单；`，` 仍转 `,`。同步改 `e2e/smart-input.spec.ts` 与 `slash.test.ts`。
- **D12 手柄滑入菜单**：`block-handle.ts` 的菜单计时被 `entry.gate.isOpen()` 拦截，导致进入即 no-op 且 `pointerenter` 不再触发。改为手柄 hover 即开菜单（对齐 md-bundle `onHandleMouseEnter`）。
- **D13 大纲按钮**：`OutlineMenu.tsx` 加 `data-pinned`；CSS `.biaoyue-outline-button` 由胶囊改方形圆角、默认透明、钉住用 `--app-accent` 底。
- **D14 标题折叠**：移植 md-bundle `chapter-tree.ts` 的 `computeSections`（区间数学），在 `decorations/` 加折叠 widget（三角），点击切换 `foldedRanges`（`StateEffect` + `StateField`）。新增 `cm-*` 类名同步 CSS。
- **D15 前进后退恢复**：根因是 `ContentArea.tsx` 内容同步做**整篇替换**并进历史 → `Ctrl+Z` 退回空文档、跨页签。改为同步 dispatch 标 `Transaction.addToHistory.of(false)`（或最小 diff）。HTML 可视化编辑补文档级快照历史（撤销栈）。
- **D16 选区工具条**：迁移 md-bundle `floating-toolbar.ts` 的能力；图标复用 Clairis `icons.ts`/`COMMAND_ICON_NAME`；按 workbuddy 收敛：区块=AI 编辑/背景色/边框色/删除；文字=AI 编辑/字号(当前值)/加粗/斜体/下划线/删除线/链接/对齐/文字颜色/删除。内联格式作用选区，对齐/转换作用整块。
- **D17 阅读空间卡片**：`ReadingRail.tsx` card 档动作移左下角、顺序 打开/右分栏/下分栏/收藏/路径；进度+时间移右上（进度仅百分比，title "已读"）。`railView.ts` 段标签与 11 处"置顶"文案改"收藏"。
- **D18 悬浮预览窗**：`previewAnchor.ts` 宽度收窄到卡片缩略图宽（72px 缩略图 + 内边距，下限见 anchor clamp）；底部三按钮在悬停底部按钮高度区时重显（新增 hover 高度区判定）。
- **D19 状态栏**：新建 `StatusBar` 组件，规格参考 `docs/design/approved/shell-ui/spec.md`；顶栏 `Toolbar` 移除主题区，grid/AI/theme/immersive 4 图标按序移入状态栏右侧。
- **D20 新建默认 .md + 跳转**：`newTabWith` 让 `fileTypeOf(path)` 返回 markdown（补 `.md` 路径或改 TabBar 用 `tab.fileKind`），并设 `scene: "workspace"`。
- **D21 视频页签名**：切视频文件时同步 `title` 为文件基名。
- **D22 HTML 编辑态**：先复现定位根因（DQ-2）。候选：`buildEditableDoc` 注入运行时对含 CDN 脚本/异常首字符文档的兼容；sandbox `allow-scripts` 下外链脚本失败不影响主体但可能触发重建异常。以实测为准。

## Risks / Trade-offs

- [PDF 缩略图无现成路径] → 拆子项、先交 D7/D8；D9 评估后再定，必要时新增 Rust 渲染。
- [单格全屏改 G-7 会挂既有 e2e] → 同步更新 `pane-fullscreen-icon.spec.ts` / `clairis-bug2.spec.ts`。
- [全角斜杠语义变更挂既有断言] → 同步改 `smart-input.spec.ts` / `slash.test.ts`。
- [整篇替换改不进历史可能影响"预览→编辑预热"] → 用最小 diff 或仅在同步路径标 `addToHistory=false`，保留用户输入进历史。
- [D19 顶栏收缩、D17 卡片重构涉及多文件，易与并行票冲突] → 切片文件级错开：分栏/页签票独占 TabBar/PaneTreeView/ImmersivePeekBar/App；卡片票独占 ReadingRail/previewAnchor；状态栏票独占 Toolbar + 新组件。
- [workbuddy 工具条集合口径] → 以用户两张截图为准（已确认）。
- [无人值守无法人工肉眼验收] → QG-5 用 Playwright 截图 + `cw-vision.sh` 结构化判定替代人工；最终 `npm run tauri dev` 手动项记入 decisions.tsv。

## Migration Plan

单 change 多票，逐票独立 PR 合并；无数据迁移。回滚 = 逐 PR revert。

## Open Questions

- OQ-1：PDF 真缩略图渲染路径（EmbedPDF render 插件 vs Rust 侧）；阻断反馈 5 的缩略图子项。
- OQ-2：HTML 编辑态根因，经实测确认（不阻断切片启动）。
