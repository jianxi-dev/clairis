## Why

layout-portal 收口后，桌面端仍有一批表面问题直接影响可用性：主题只换局部、顶栏重复文件身份、页签只剩图标、阅读空间缩略图与操作按钮互相遮挡、HTML 摘要露源码、悬浮预览离开不消失且媒体只显示占位、最近文件依赖本次会话、Cmd/Ctrl+P 触发打印/网格而不是搜索、设置窗在窄窗口溢出、正文选区工具条缺失、块手柄召唤区域过大、图标语义不清。

这些是同一轮真实使用后集中暴露的「表面质量」问题，按 cw 规范收成一个 change，分四条垂直切片交付，避免零散热修继续漂移。

## What Changes

- 主题：Tailwind 改为 class 驱动暗色，顶栏、面板、卡片、弹层统一使用语义 token，切换浅/深/暖时整窗一致。
- 顶栏：移除文件名与预览/编辑/源码切换（下沉到各分栏页签条），保留网格、AI、主题、沉浸；「阅读」改名「沉浸」。
- 页签：始终渲染图标+文件名；活跃页签改为胶囊高亮。
- 阅读空间：缩略图上下居中，操作按钮不再压住缩略图；HTML 显示中性占位图；摘要剥离 HTML 标签；最近文件从本机自动加载并按时间倒序；路径显示父文件夹且可点击打开文件夹；取消全路径 tooltip；三点菜单切换布局/密度后列表回顶。
- 悬浮预览：仅在阅读空间条目右半区触发；鼠标离开后自动关闭（钉住/拖拽/缩放除外）；图片/视频/音频真实渲染。
- MD 编辑块手柄：仅正文左侧四分之一区域召唤；滑入手柄即显示菜单；迁移 md-bundle 的块颜色能力。
- 选区胶囊：编辑态与阅读态选区都显示工具条；文件类型、活跃页签、选区工具条统一胶囊形状。
- 图标：重绘 pin/expand/splitRight/splitDown 等，线条更轻、左右/上下分栏比例可读；单格隐藏无效全屏按钮，多格点击生效。
- 设置：移除正文右上角字号/行宽/配色浮层，全部收进设置；修复窄窗口溢出；阅读空间布局/密度/卡片高度保留在设置。
- 搜索：Cmd/Ctrl+P 打开文件/页签/命令快速打开，阻止 WebView 原生打印；网格概览保留 Cmd+Shift+\ 与顶栏入口；阅读空间搜索扩展为本机标题+正文检索，支持类型/时间筛选。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `application-shell`：顶栏职责收缩、页签始终带名称、活跃页签胶囊、主题 class 驱动、图标体系重绘。
- `navigation`：阅读空间最近文件来源与路径交互、条目右半区预览触发、三点菜单回顶、本机标题/正文搜索与筛选。
- `reading`：悬浮预览离开关闭与真实媒体渲染、HTML 摘要文本化、选区块胶囊在阅读态出现。
- `editing`：MD 块手柄召唤区域、滑入菜单、块颜色能力迁移、编辑态选区块胶囊。
- `configuration`：字号/行宽/配色迁入设置、设置窄窗滚动、阅读空间布局项归属、全屏与沉浸命名。

## Impact

- 前端：`src/App.tsx`、`src/components/Toolbar.tsx`、`src/components/TabBar.tsx`、`src/components/Rail/ReadingRail.tsx`、`src/components/Preview/FloatingPreview.tsx`、`src/components/ai/SelectionPill.tsx`、`src/components/SettingsView.tsx`、`src/components/QuickOpen.tsx`、`src/editors/orchestration/block-handle.ts`、`src/ui/icons.ts`、`src/stores/index.ts`、`src/styles/*`、`tailwind.config.js`。
- 后端：新增本机最近文件/全文搜索 Tauri command 与注册（`src-tauri/src/commands/`、`lib.rs`），限制扫描目录与扩展名。
- 测试：新增/更新 `e2e/reading-rail.spec.ts`、`e2e/floating-preview.spec.ts`、`e2e/rail-cards.spec.ts`、`e2e/block-handle.spec.ts`、`e2e/block-menu.spec.ts`、`e2e/settings-scene.spec.ts`、`e2e/quick-open.spec.ts`；每个 UI 票产出 `.artifacts/<票号>/state-coverage.json`。
- 不变：pane 树、场景路由、配置持久化字段、编辑器不 remount 约束。
