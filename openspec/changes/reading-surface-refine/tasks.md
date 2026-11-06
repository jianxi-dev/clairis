# Tasks — reading-surface-refine

> 每个 task 是一个垂直切片：贯穿 UI → 状态/命令 → e2e → 证据，可独立演示。子项是同一票内的验收细节，不单独拆票。

## 1. 外壳、主题、页签与图标

- [x] 1.1 外壳与主题：Tailwind 启用 `darkMode: "class"`；顶栏/设置/卡片硬编码灰阶换 `--app-*` token；顶栏移除文件名与模式按钮，保留品牌/网格/AI/主题/沉浸；「阅读」改「沉浸」；单格隐藏全屏，多格全屏先聚焦再切换。
  - 用户可见：切换浅/深/暖时整窗一起变；顶栏不再重复文件名；页签始终有名字；单格没有无效全屏按钮。
  - 接线：`tailwind.config.js`、`Toolbar.tsx`、`App.tsx`、`TabBar.tsx`、`PaneTreeView.tsx`、`src/ui/icons.ts`、`SettingsView.tsx`。
  - 验收：顶栏文件名字符串 0；每个页签标题可见；单格全屏按钮 0；多格全屏生效。

## 2. 阅读空间卡片、本机最近文件与路径

- [x] 2.1 卡片与数据：缩略图居中、动作按钮移到缩略图下方；无缩略图卡片恢复通栏摘要；HTML 缩略图中性占位；`excerptOf` 对 HTML 去标签；新增 `list_recent_documents` Rust command 启动自动发现最近文件（mtime 倒序）；卡片路径显示父文件夹名（文件夹图标），点击调用 `reveal_in_finder` 打开目录，移除完整路径 tooltip。
  - 用户可见：缩略图不再被按钮压住；HTML 卡片显示正文摘要；启动即有最近文件；点父文件夹能打开目录。
  - 接线：`ReadingRail.tsx`、`src/lib/railCards.ts`、`src/stores/index.ts`、`src-tauri/src/commands/`、`lib.rs`。
  - 验收：缩略图与按钮重叠 0；HTML 摘要 `<tag>` 0；启动后 recent 非空且按 mtime 倒序；父文件夹点击触发系统打开。

## 3. 悬浮预览、触发区与列表回顶

- [x] 3.1 预览行为：仅在条目右半区触发；左半区跳过；全局 pointermove 180ms 防抖离窗关闭（钉住/拖拽/缩放豁免，指针仍在 rail 保持）；图片/视频/音频真实渲染，HTML 沙箱 iframe，PDF 占位；三点菜单切换布局/密度/筛选后列表回顶。
  - 用户可见：左侧移动不弹窗，右侧才预览；鼠标离开小窗后消失；图片/视频能在小窗里看/播；切换菜单后回到列表顶部。
  - 接线：`ReadingRail.tsx`、`FloatingPreview.tsx`、`src/lib/previewAnchor.ts`。
  - 验收：左半区不打开；右半区 250ms 打开；离窗 180ms 关闭；媒体元素为 img/video/audio。

## 4. 块手柄、块颜色与选区胶囊

- [x] 4.1 块手柄：仅在 `.cm-content` 左侧 25% 或手柄自身召唤；滑入手柄 60ms 内开菜单；迁移 md-bundle 块颜色能力（菜单颜色项 + `mdb-color-*` 包裹，无源码时先落色板 UI 与持久化格式）。
  - 用户可见：只有左缘出手柄，滑入即出菜单；块菜单可选颜色。
  - 接线：`block-handle.ts`、`block-menu.ts`、`editor.css`。
  - 验收：左侧 25% 召唤；右侧不召唤；滑入 60ms 出菜单；颜色写入源码。
- [x] 4.2 选区胶囊：编辑态保留改写/翻译/润色；阅读态 `.preview-content` 选区显示复制/解释/翻译；胶囊形状与文件类型 chip、活跃页签统一。
  - 用户可见：阅读态选中文字也出现胶囊工具条。
  - 接线：`SelectionPill.tsx`、`TabBar.tsx`、`ReadingRail.tsx`。
  - 验收：两种模式的选区都显示工具条；编辑态 3 个动作；阅读态 3 个动作。

## 5. 设置迁移与设置窗自适应

- [ ] 5.1 设置：移除正文右上角 `ReaderSettingsPopover`；设置阅读空间区补行宽/配色，字号入口保留设置；根容器 `min-h-0 overflow-hidden`、内容区滚动、导航独立滚动；阅读空间布局/密度/卡片高度确认在设置中。
  - 用户可见：正文右上角不再有设置浮层；窄窗口下设置内容可滚到底、不越界。
  - 接线：`PreviewView.tsx`、`SettingsView.tsx`。
  - 验收：正文设置浮层 0；窄窗设置可滚动；字号/行宽/配色均在设置。

## 6. 快速打开、网格入口与本机检索

- [ ] 6.1 Cmd/Ctrl+P 阻止原生打印并打开 QuickOpen（页签/最近文件/命令：网格、设置）；网格保留 Cmd+Shift+\ 与顶栏入口。
  - 用户可见：Ctrl+P 出搜索窗；网格有明确入口。
  - 接线：`App.tsx`、`QuickOpen.tsx`、`Toolbar.tsx`。
  - 验收：Ctrl+P 打开 quick-open；原生打印不触发；网格入口可见。
- [ ] 6.2 本机检索：新增 `search_documents` Rust command（文件名/title/H1/正文，限量），前端阅读空间搜索接本机结果，支持类型与时间筛选。
  - 用户可见：阅读空间搜索能搜本机正文并筛选。
  - 接线：`src-tauri/src/commands/`、`lib.rs`、`ReadingRail.tsx`、`src/lib/railView.ts`。
  - 验收：正文命中并高亮；类型/时间筛选生效。
