# Design: 第十三批真机走查（ui-polish-batch13）

## 1. 背景与失败模式

14 条需求分四类：**回归**（R-2 编辑态装饰丢失、R-12 HTML 缩略图）、**方向反转**（R-10 视频自动播放、R-13 PDF 工具栏、R-11 提示抑制的范围）、**既有缺陷**（R-3 高亮块图标、R-4 撤销聚焦、R-6 上限不一致、R-1 格式刷）、**能力缺口**（R-1 三级联动、R-7 胶囊、R-8 双击新建、R-14 小窗编辑）。

每条都对应可定位的实现事实，不靠猜测：

| 需求 | 实现事实（勘察结论） |
|---|---|
| R-2 | `ContentArea.tsx:255-276` 创建 EditorState 时**只装** `langCompartment.of([])`，不含 `decorCompartment`；`:371-392` 的装饰 effect 用 `decorCompartment.reconfigure(...)`。CM6 对「未出现在 state 里的 compartment」的 reconfigure 是 no-op。浏览器探针：分栏后 `main` 重建 view，`currentKindRef` 仍是 markdown → language effect 不复跑 → 装饰永不安装，编辑态呈源码。 |
| R-1 | 轮盘：`sectorIcon("color")` 返回 `tune`；`.selection-roulette.sub-open .sr-sector{opacity:.7}`、`SUB_DIM_OPACITY=0.8`；`openGroup` 置 `hot=-1`；`drawBand` 的 `pointerenter` 只按索引高亮二层。提示：扇区/单元/色条都设 `title`。格式刷：`applyMarks` 只处理 bold/italic/underline/strike/code，**从不应用 color/bg**，且拖拽选中期间持续触发。 |
| R-3 | `callout-emoji.ts:16` 覆盖表按**序号**存；`CalloutWidget.toDOM` 无条件优先覆盖值 → 类型转换后仍是旧 emoji。间距：`editor.css:1718 gap:0.5em`；无标题时 `:1708 min-width:40px`（≈3 汉字）。 |
| R-4 | 撤销只由 CM6 `historyKeymap` 在编辑器聚焦时处理（`setup.ts:82-88`）；App 的全局 keydown 无 z 分支。切到编辑态后焦点仍在按钮/页面。 |
| R-5 | `paneHeaderMenu.ts:48` 文案。 |
| R-6 | `StatusBar.tsx:20 WIDTH_MAX=1400`；`SettingsView.tsx:118 READER_WIDTH_MAX=2400`；`aiErrors.ts:18` 文案 480–2400。 |
| R-7 | `floating-toolbar.ts` 只有 `createRoulette`；`selectionPillMode.ts` 编辑器选区返回 null（E-18 决策：AI 归轮盘）。 |
| R-8 | `TabBar.tsx:238-245` 页签条无 dblclick；store 已有 `newTab()`（默认 `editorMode:"edit"`）。 |
| R-9 | `StatusBar.tsx:298` title 文案。 |
| R-10 | `VideoPlayer.tsx:670 autoplay:false`、`:675 autoPlayback:false`、`:1022-1038` ready 只 seek；`icons.ts:378 timestampNote` 是文档+圆。 |
| R-11 | `TooltipLayer.tsx` 仅按 `[title]` 触发，无全局弹窗抑制；菜单宿主（`ContextMenu`、`PaneHeader`）无共享信号。 |
| R-12 | `726bd7e` 把 iframe 缩略图替换成 `rail-thumb-page` 占位（`ReadingRail.tsx:296-312`），并删除 `HTML_IFRAME_CAP`。 |
| R-13 | `PdfViewer.tsx:315-343` readingMode 下 1.2s 自动加 `pdf-chrome-idle`；无双击；`injectPdfUiCss` 已有 `--pdf-chrome-idle` 的 transform/opacity 规则。 |
| R-14 | `FloatingPreview.tsx:545-590` 标题栏按钮只有钉住/关闭；正文为只读渲染（`renderMarkdown`/`renderText`）。 |

## 2. 决策

### D1 编辑态装饰生命周期（R-2）
- 创建 EditorState 时显式装入 `decorCompartment.of(初始装饰)` 与 `langCompartment.of(createLanguageExtension(当前 fileKind))`，并同步 `currentKindRef`。
- 初始装饰按当前模式：`edit` → `fullDecorations(options)`；`source` → `[floatingToolbar()]`；`preview` → `[]`。
- 装饰 effect 保持为模式切换的唯一写入口；因 compartment 已存在于 state，reconfigure 必然生效。
- 这是根因修复，不在每个重挂载点打补丁。

### D2 轮盘（R-1）
- 颜色扇区图标 → 新增 `droplet` 图标（水滴/墨滴），`sectorIcon("color")` 返回它。
- 三层展开（`third-open`）时：根扇区与二层 path 的不透明度 = 0.25（`SUB_DIM_OPACITY = 0.25`；CSS `.third-open .sr-sector { opacity:.25 }`），三层保持 1。
- 三层默认高亮：`openGroup` 把 hot 设为子项中心索引。
- 联动：group 打开期间监听文档 pointermove，按指针相对轮盘圆心的角度就近命中三层扇区索引并高亮（同向跟随）；指针仍可点选二层兄弟项。
- 提示回滚：扇区 `title`、单元 `unit.title`、色条 `title` 全部移除；仅 `hub.title` 保留（格式刷说明）。
- 格式刷：`applyMarks` 增加字色/背景色（复用 `colorAction` 的 class 应用逻辑）；仅在选区稳定后（`!pointerDown`）调度；不足 1 字符直接返回。

### D3 胶囊工具条（R-7）
- 新文件 `src/editors/orchestration/capsule-toolbar.ts`：`createCapsuleToolbar(items, onClose)`，`position:fixed`，两行按钮。
- 近指针行（下排）：加粗 / 斜体 / 字色 / 背景色 / 清除格式；远指针行（上排）：下划线 / 删除线 / 行内代码 / 链接 / 改写 / 翻译 / 润色。字色/背景色点击后在胶囊内展开 12 色条（不新增浮层定位）。
- `floatingToolbar()` 依 `useEditorStore.config.selectionToolbar`（默认 `roulette`）选择渲染器；胶囊作用于 MD 编辑态，源码态仍用轮盘（保持 E-18）。
- 设置：`setting.selectionToolbar` 两项单选，持久化进 `AppConfig`。
- 视觉数值只引用既有 token（`--radius-full`、`--app-surface`、`--app-border`、`--app-shadow`）。

### D4 高亮块（R-3）
- 覆盖表值改为 `{ type, emoji }`；`toDOM` 仅在 `entry.type === this.type` 时采用，类型转换自动回到新类型默认。
- 头部间距：`gap: 0`；图标 `padding: 0`；空标题槽 `min-width: 0`（标题编辑仍可通过点击头部空白/标题区触发；空标题时头部整行作为标题热区）。

### D5 撤销/重做（R-4）
- App 全局 keydown 增加：`meta|ctrl + z`（撤销）与 `meta|ctrl + shift + z`（重做）。当焦点不在编辑器/输入控件时，取当前聚焦格的活动 EditorView 执行 `undo/redo` 并 `focus()`。
- 编辑器聚焦时仍由 CM6 自己处理，避免双执行（检测 `e.target.closest('.cm-editor')`）。

### D6 文案与上限（R-5/R-6/R-9）
- 新增 `src/lib/readerWidth.ts`：MIN 480 / MAX 1400 / STEP 20 / 预设表；`StatusBar`、`SettingsView` 共用；`aiErrors` 文案同步。
- 菜单项与状态栏 title 文案按用户原文。

### D7 页签栏与提示（R-8/R-11）
- `TabBar` 根节点 `onDoubleClick`：`e.target` 为页签条本体（非页签/按钮/输入）时 `newTab()`。
- 新增 `src/lib/overlayGate.ts`：计数式 `pushOverlay/popOverlay/isOverlayOpen`。`ContextMenu`、栏目 ⋯ 菜单、宽度/主题弹层打开时登记；`TooltipLayer` 在定时器触发与显示期间检查，弹窗打开则立即清空。

### D8 视频（R-10）
- `autoplay: true`、`autoPlayback: true`；ready 后恢复进度并 `play()`，`play()` 失败不清空画面（去掉 loading 遮罩态）。
- 多路独立：保持既有 `paneId` 独立实例与 `muted=false`，只补 e2e 断言「两格同时播放且都有声」。
- `timestampNote` 图标改为笔写字形（笔尖 + 书写线）。

### D9 HTML 卡片缩略图（R-12）
- 恢复 `iframe`（`assetSrc(src)`，`sandbox="allow-scripts"`，`pointer-events:none`，10% 缩放）作为底层，类型色占位在其下；`onLoad` 后 `opacity` 0→1。去掉并发配额。
- 加载失败/超时 → iframe 保持透明，占位可见（永不白块）。

### D10 PDF 工具栏（R-13）
- 状态：`chromeHidden`（默认 false）+ `chromePeek`（顶部热区临时显示）。
- 双击 shadow 内 `[data-epdf-i="main-toolbar"]`：隐藏 ↔ 固定。
- 隐藏时工具栏 `position:absolute`、`translateY(-100%)`、`opacity:0`，不占正文高度；指针进入容器顶部 16px 热区 → peek（`translateY(0)`、opacity 1、`position:absolute` 悬浮）；离开热区与工具栏 → 回到隐藏。
- 删除 readingMode 的 1.2s 自动收起逻辑。
- CSS 仍走 `injectPdfUiCss` 注入的 shadow 样式，新增 `.pdf-chrome-hidden` / `.pdf-chrome-peek` 两组规则。

### D11 悬浮小窗编辑（R-14）
- 标题栏钉住按钮右侧新增切换按钮（眼睛/铅笔），仅 md/html/文本类显示。
- 编辑态：md/text 用 `textarea`（等宽、自动聚焦）；html 用源码 `textarea`（保持可读，不做可视化编辑器）。
- 保存：`Cmd/Ctrl+S` 或失焦时调用既有 Tauri 写文件命令；失败以标题栏状态提示，不静默。
- 切换回预览后重新渲染（与主编辑器同貌用既有 renderer）。
