## Why

batch20 汇集用户 2026-11-15 反馈的 28 项（14 缺陷 + 14 优化，父规格票 #897）。这一批以**「既有 requirement 未真正生效」**为特征：程序化定位显示，缺陷 4（提示胶囊化，E-22）、缺陷 8（标题配色，A-10/C1）、缺陷 9（标题折叠，标题折叠条款）、缺陷 11（左边栏快捷键，N-4 附近）、缺陷 13（页签空白双击全屏，application-shell「页签空白双击切换窗口全屏」）、缺陷 14（撤销快捷键、E-36 逗号触发）、优化 9（大纲，E-10）、优化 12（标题字体，CF「标题字体逐级配置」）等，其 requirement 已在主规格中登记，但用户实测仍未达成——多为 batch19 的回归或仅覆盖了一半面（预览态）。这直接决定本批的验收口径：**不是新增能力，而是把已登记的 contract 真正落到可见行为**，并对确有冲突的条款（导出 hover 保持、视频打开即自动播放）显式 supersede。

## What Changes

- **打印与导出**：打印→输出 PDF 的内容完整（中段与尾部不丢）；应用内单页导出 PDF 的完整性与超限显式拒绝同域收口。
- **媒体与视频**：文件卡片/悬浮窗视频真实画面；文本卡标题不压进度；字幕同名收敛；重启不自动播放与单声道；MD 编辑态媒体可渲染；进度缩略图定位与格内适配；播放图标；图片圆角统一；嵌入视频宽度档与全屏。
- **提示与菜单**：提示外壳单一与方位并行（优先上/下）、延迟口径统一、状态栏提示在图标正上；悬浮窗更紧凑；页签导出子菜单并集关闭与菜单提示非原生矩形；「移动到」图标加右箭头并立图标去重规则；新增/插入菜单统一 grammar。
- **编辑器表面**：标题配色编辑态生效；预览态折叠触发区同编辑态；逗号→/ 与撤销；横向工具条回滚；嵌套录入处富文本插入/转换手柄；Tab 缩进后渲染稳健与引用块边框对齐；分栏/表格编号位置；文本显示格式统一；文本工具条只复制。
- **窗口与布局**：页签空白拖动窗口（指针/单浮层/不换格/可移动）；双击页签空白全屏；左边栏快捷键与场景门；大纲按钮/等级/拖拽。
- **配置**：标题字体显示当前值并收敛预设。
- **BREAKING**（内部契约）：`TabBar` 导出子菜单收起条件由「移出父项保持」改为「移出并集收起」；`reading` 的「视频打开即自动播放」改为「打开为暂停态、不自动播放」；`VideoPlayer` 移除 ready 阶段手动 `play()`。

## Capabilities

### New Capabilities

- 无新增能力域。

### Modified Capabilities

- `export`：EX-7 Markdown 打印（打印→PDF 内容完整）。
- `file-management`：C-6 视频预览播放器（字幕同名、不自动播放、单声道、音频链路）；「导出菜单顺序与 PDF 导出」（PDF 完整与超限拒绝）。
- `editing`：E-22 编辑态悬停提示胶囊化（矩形消尽、方位、延迟）；标题折叠（预览触发区）；选区浮动工具条 / 编辑态工具条归属（横向工具条回滚、文本工具条复制）；撤销与重做快捷键（失效修复）；E-36 斜杠菜单回显与逗号触发；E-17 块手柄召唤与滑入菜单（嵌套录入面）；E-12 单元格富文本编辑（嵌套录入）；E-23 块宽度统一（引用块边框对齐）；E-11 块菜单结构与图标体系（菜单 grammar 统一）；E-8 编辑态与预览态同貌（标题配色 + 文本显示格式）；E-26 插入菜单表格与分栏（编号位置）；文本与脚本文件行号（行号贴合 + 格式统一）。
- `navigation`：页签条与格头（空白拖动窗口）；左边栏展开与固定快捷键（与网格预览冲突）；页签右键菜单文件动作（导出子菜单生命周期、移动到图标）；图标体系（去重规则）。
- `application-shell`：状态栏（主页等按钮提示在图标上方）；页签空白双击切换窗口全屏（真正生效）；页签栏空白双击新建文档（与全屏的裁决）；弹窗以按钮图标中心对齐（提示方位）。
- `reading`：视频打开即自动播放且多路独立（改为不自动播放）；卡片缩略图高度（视频缩略图真实画面）；A-19 预览图片圆角（与视频一致）；嵌入视频显示与播放（宽度档与全屏）；文本与脚本预览语法（与编辑态同格式）。
- `configuration`：标题字体逐级配置（显示当前值 + 预设收敛）；提示信息显示时长可配置（tooltip 读同一口径）。

## Impact

- 前端：`src/lib/export/*`、`src/lib/printPreview.ts`、`src/styles/print.css`；`src/components/Grid/GridTile.tsx`、`src/components/Preview/FloatingPreview.tsx`、`src/components/Rail/ReadingRail.tsx`、`src/components/Content/VideoPlayer.tsx`、`src/components/Content/MediaPlayerHost.tsx`；`src/components/TooltipLayer.tsx`、`src/components/TabInfoPopover.tsx`、`src/components/TabBar.tsx`、`src/lib/overlayGate.ts`、`src/lib/shortcuts.ts`；`src/editors/decorations/*`、`src/editors/{smart-input,keybindings,setup}.ts`、`src/editors/orchestration/{floating-toolbar,horizontal-toolbar,menu-metrics,slots}.ts`、`src/editors/slash.ts`；`src/components/Content/{ContentArea,PreviewView,OutlineMenu,PaneTreeView}.tsx`、`src/App.tsx`；`src/hooks/usePaneDragController.ts`；`src/styles/{editor,reader}.css`。
- 配置/后端：`src-tauri/src/config.rs`、`src-tauri/src/fonts.rs`、`src-tauri/src/commands/{config_cmd,file,directory}.rs`；`src-tauri/capabilities/default.json`（补 `allow-start-dragging` / `allow-set-fullscreen`）。
- 图标：`src/ui/icons.ts`（play / folder-arrow）。
- 测试：e2e 若干（打印、视频、提示、页签菜单、大纲、字体、显示同貌），既有若干需同步修订。
- 无新增外部依赖；无数据库迁移。
