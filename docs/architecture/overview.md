---
title: 架构现状总览
type: architecture
status: accepted
last_updated: 2026-11-06
source_of_truth: canonical
---

# 架构现状总览（Biaoyue / 标月）

> 本文只描述**与当前代码一致**的架构现状，是架构主题的当前权威文档。
> 「为什么这么决定」属于决策历史，见 [`decisions/`](./decisions/README.md) 下的 ADR；本文不复述论证。
> 早期架构稿 `docs/ARCHITECTURE.md` 含旧项目名与过时图示，不再作为现状裁定依据（其处置见后续归档任务）。

## 一、总体形态

Biaoyue 是 Tauri 2 桌面应用：Rust 后端（`src-tauri/`）提供文件系统、配置、翻译等命令，前端 Webview 用 React 18 + TypeScript（`src/`）渲染，编辑器为 CodeMirror 6。

- Tauri 命令注册入口：`src-tauri/src/lib.rs`（`tauri::generate_handler!`）。
- 前端入口：`src/main.tsx`、`src/App.tsx`。

## 二、双渲染管线（阅读 / 编辑分离）

两条渲染管线相互独立（决策依据见 [ADR 0001](./decisions/0001-separate-rendering-pipelines.md)）：

- **阅读管线**：`src/renderers/`。Markdown 经 `marked` 解析后用 `DOMPurify` 白名单清洗，数学公式（KaTeX，`src/renderers/math.ts`）与 Pele 图表（适配层 `src/renderers/diagram/`，入口 `src/renderers/mermaid.ts`）分别预处理后渲染，再由 `src/components/Content/PreviewView.tsx` 通过 `dangerouslySetInnerHTML` 渲染（见 `src/renderers/markdown.ts`）。HTML 文件走 `src/components/Content/HtmlPreview.tsx`：有文件路径时经 asset 协议直载（`convertFileSrc`，sandbox 含 `allow-scripts`，脚本可执行、相对资源由浏览器原生解析）；无路径时回退 srcdoc 渲染，此时由 `src/renderers/html.ts` 改写相对路径并注入禁脚本 CSP。纯文本由 `src/renderers/text.ts` 转义后渲染；PDF 文件经 `read_file_base64` 读入内存，由 `src/components/Content/PdfViewer.tsx` 渲染为 EmbedPDF v2 查看器（PDFium WASM，`public/pdfium.wasm` 自托管、离线可用）。
- **HTML 可视化编辑**：`.html` 的「编辑」模式不是 CM6，而是 `src/components/Content/HtmlVisualEditor.tsx` 中的 iframe 面板——文档以 `srcdoc` 渲染，注入一段带 nonce 的运行时（`src/editors/html/runtime.ts`），点选/双击改字/回车拆块经 `postMessage` 上报，主侧用纯函数（`src/editors/html/edit.ts`）折算回 `content`。预览态与编辑态是两套 CSP：预览禁一切脚本，编辑态只放行注入运行时。`content` 字符串是唯一真相，iframe DOM 不反向驱动（[ADR 0010](./decisions/0010-html-visual-editing-content-is-truth.md)）。选中元素后由 `src/components/Content/HtmlEditToolbar.tsx` 浮出工具条（portal 到 body）：换标签、字号、文字颜色、对齐、`class`/`id`，同样经 `src/editors/html/edit.ts` 的纯函数折算回 `content`；工具条的定位矩形由 iframe 内的运行时以 `selectionRect` 消息上报（跨源，主侧量不到内部布局）。源码模式仍是 CM6（`html()` 语言包），两种模式共用同一份 `content`，切换时 EditorView 不重建。
- **编辑管线**：CodeMirror 6 编辑器，基础扩展装配在 `src/editors/setup.ts`，按文件类型组合语言扩展与装饰（decorations）：markdown / html / text 语言与 5 个 decoration 插件在 `setup.ts` 组装；css / python / json / javascript / yaml 代码语言高亮由 `src/components/Content/ContentArea.tsx` 的 `langCompartment` 装配。

模式（preview / edit / source）切换通过 CSS `display` 显隐，**不重建 EditorView**，从而保留 undo、选区与编辑状态（决策依据见 [ADR 0002](./decisions/0002-mode-switch-css-display-no-remount.md)）。实现见 `src/components/Content/ContentArea.tsx`：编辑器容器在 preview 时为 `display:none`，preview 由 `PreviewView` 呈现。

## 三、EditorView 实例管理

EditorView 实例不进 React 状态树，而存在模块级 Map 中，按 panelId 索引（决策依据见 [ADR 0004](./decisions/0004-store-plain-text-not-editor-objects.md)）：

- `src/editors/editorRef.ts`：`Map<panelId, EditorView>`；pane 树的每个 leaf 各占独立 panelId（leaf id），根 leaf 的 panelId 为 `"main"`；`getActiveEditorView()` 按最近聚焦面板回退到 `"main"`。
- 每个 leaf 在 `ContentArea` 挂载时创建一次 EditorView，卸载时销毁并按 panelId 注销。

## 四、状态（Zustand store 现状）

当前存在两个 Zustand store（`editorStore.ts` 已标注 `@deprecated`，待与主 store 合并）：

- `src/stores/index.ts`（`useStore`）：`scene`（门户/工作区/网格/设置）、pane 递归树（`paneRoot` / `focusedPaneId` / `fullscreenPaneId`）、阅读空间栏（`railState` / `railLayout` / `railDensity` / `railCardHeight` / `railViewSpec`）、网格会话状态（搜索/排序/分组/选中/置顶）、悬浮预览（`preview` / `previewSettings`）、AI 视图规格（`viewSpec`）、标签（tabs / activeTabId）、最近文件、侧栏可见性、沉浸阅读模式（readingMode）等。**store 只存纯文本** `content`，不存 EditorView 等编辑器对象。
- `src/stores/editorStore.ts`（`useEditorStore`，`@deprecated`）：配置（config，含主题/字号/图标标签）、翻译状态、内容版本号（`contentVersion`）。
- `src/stores/captureOverlay.ts`（`useCaptureOverlayStore`）：捕获浮层独立状态，由 `src/stores/index.ts` 再导出。

编辑内容回写 store：`ContentArea` 的 CM6 `updateListener` 在 `docChanged` 时调用 `updateTabContent` / `updateContent`（见 `src/components/Content/ContentArea.tsx`）；为避免高频同步开销，对 store→CM6 同步设置了防抖节奏（决策值见 [ADR 0003](./decisions/0003-store-debounce-300ms.md)）。

## 五、场景化外壳

应用以 `scene`（`portal` / `workspace` / `grid` / `settings`）组织顶层场景，场景状态在 `src/stores/index.ts`，渲染分支在 `src/App.tsx`：

- **workspace 是常显底座**：`Toolbar` + `ReadingRail` + `PaneTreeView`（`data-testid="workspace-body"`）始终挂载。
- **portal / grid / settings 是覆盖层**：分别在 `scene === "portal" | "grid" | "settings"` 时以 `fixed inset-0` 挂载（z-40 / z-40 / z-50），**不卸载工作区**——切换场景时 EditorView、选区、undo 历史与滚动位置全部保留。
- **`?` 快捷键总览**：`ShortcutOverlay` 由 `App` 的 `shortcutsOpen` 状态控制，独立于场景。
- **设置返回路径**：`App` 用 `settingsReturnRef`（`useRef<Scene>`）记录进入设置前的场景；`openSettings` 写入、`closeSettings`（Esc / 关闭按钮）读出并复位，因此 Esc 从设置回到的是**上一个场景**（工作区/门户/网格），不是固定工作区。
- Esc 层级关闭顺序：快捷键总览 → AI 确认卡/小窗/停靠 → 全屏格 → 沉浸阅读（见 `App.tsx` 的 keydown handler）。

## 六、Pane 递归树

工作区分栏是递归树，纯模型与纯函数在 `src/lib/paneTree.ts`，状态在 `src/stores/index.ts`，渲染在 `src/components/Content/PaneTreeView.tsx`：

- **模型**：`node = { type:"node", id, dir:"row"|"col", ratio, children:[node,node] }`；`leaf = { type:"leaf", id, tabs:string[], activeTabId, editorMode, kind?:"tabs"|"ai" }`。根 leaf id 固定 `"main"`。
- **每格多页签**：`addTab` / `removeTab` / `reorderLeafTabs`；关最后一签且非根 → 删格、兄弟扩展、焦点移到兄弟（`removeLeaf` + `siblingLeafId`）。
- **分裂**：`splitPane(dir)`（⌘⌥→ 右分 / ⌘⌥↓ 下分）复用 `splitLeaf`；新格获焦。
- **最小尺寸**：`MIN_PANE_PX = 240`，`clampRatio` 按比例钳制 + CSS `min-width`/`min-height` 双保险。
- **全屏**：`fullscreenPaneId`（⌘⇧↵ 或格头按钮）；全屏时隐藏其他格与分隔条，再按或 Esc 恢复。
- **拖拽换位**：`swapLeaves`（中心互换）/ `moveLeaf`（四边移动重排）/ `moveLeafToRoot`（移到根层），与拖文件四向落区（`dropFileOnPane` → `splitLeafSide`）严格区分。
- **持久化**：`serializeLayout` / `parseSerializedLayout` / `restoreLayout` 序列化为 JSON 字符串，写入 Rust 配置字段 `paneLayout`（`src-tauri/src/config.rs`），重启恢复结构/比例/页签/活动页签/焦点。
- **EditorView**：每个 leaf 一个 panelId，`src/editors/editorRef.ts` 的 `Map<panelId, EditorView>` 按 leaf id 索引。

## 七、视图规格持久化现状

> **当前真相**：视图规格**集中合并**在 Rust 应用配置的字段里，而不是设计稿 §13 描述的独立 `rail.json` / `grid.json` / `preview.json` 文件。设计稿的文件布局是目标形态，实现期未落为独立文件——**不存在** `rail.json/grid.json/preview.json` 这三个文件。

| 字段（Rust `AppConfig`） | 内容 | 前端镜像 |
|---|---|---|
| `railViewSpec` | 阅读空间栏布局/密度/卡片高度（「设为默认」） | `railLayout` / `railDensity` / `railCardHeight` |
| `previewSettings` | 悬浮预览双轨开关（阅读空间悬停 / 网格触发方式 / 总开关） | `previewSettings` |
| `aiViewSpec` | AI 视图改写（布局/密度/卡片高度/图标标签/预览开关/面板宽窄/网格排布与分组/未读/主题分组/置顶段缩放） | `viewSpec` + 各域镜像 |
| `paneLayout` | 工作区 pane 递归树序列化 JSON | `paneRoot` / `focusedPaneId` |

- 读取：`load_config` → `src/hooks/useConfig.ts` → `setViewSpec` / `restorePaneLayout` / `setPreviewSettings` / `saveRailViewSpec`。
- 写入：`saveAppConfig()`（防抖）把上述字段序列化进配置。
- AI 改写经 `applyViewSpec` / `setViewSpec` 镜像到各域，配合确认卡 + 撤销 + 快照（最近 10 份）。

设计稿 §13 的独立文件形态与 D11 的差异在此显式记录；后续如需拆分为文件按新 change 处理。

## 八、扩展包

- **形态**：`<config_base>/extensions/<id>/{manifest.json, SKILL.md}`；可选 `.disabled` 标记文件表示停用（不改用户目录结构，只加标记）。
- **管理**：`src-tauri/src/extension_packages.rs` 提供列表/导入/启用开关/卸载/导出；`list_extension_packages` / `import_extension_package` / `set_extension_package_enabled` / `remove_extension_package` / `package_extension_package` / `read_extension_skill` 命令在 `src-tauri/src/lib.rs` 注册。
- **AI 消费**：`enabled_skill_context_at` 把**用户启用**的扩展 `SKILL.md` 全文拼成系统消息（内置扩展不注入），由 `run_agent_turn` 插入 `messages[0]`。
- **前端**：设置·扩展区（`src/components/SettingsView.tsx`）列表/导入/开关/卸载/导出/AI 生成；`src/lib/extensions/bundle.ts` 读取 snippets/templates/theme tokens（另一套数据文件扩展点，见 extensions 域）。

## 九、快捷键注册表

`src/lib/shortcuts.ts` 是快捷键的**唯一真相源**：`SHORTCUTS` 数组（id / keys / label / family / core / decision / implemented），驱动四处消费：

- 实际 keymap 绑定（`App.tsx` 的 keydown handler）
- tooltip 键位显示
- `?` 总览浮层（`ShortcutOverlay`）
- 设置·快捷键区（核心 7 条 + 完整列表）

家族分组（global / typeFilter / mode / file / workspace / navigation / card / ai）与展示顺序见 `SHORTCUT_FAMILY_ORDER`。设计规则：单 ⌘ 高频 / ⌘⇧ 二级 / ⌘⌥ 分栏 / ⌥ 过滤 / 不用三修饰键。

## 十、大文件守卫（large file guard）

历史实现中，文件大于 **500KB** 时强制进入 source 模式并关闭装饰以规避性能开销（`src/hooks/useFile.ts` 的 `SOURCE_MODE_LIMIT`）。该守卫内嵌于旧的 `useFile` 单文件流程，当前页签打开流程（`src/stores/index.ts` 的 `openFile`）未接入尺寸检查，因此**当前实际不生效**；`src/editors/setup.ts` 中的同名常量亦为未使用的残留。装饰的启用/禁用仍通过 CM6 `Compartment` reconfigure 完成（`setup.ts` 的 `decorCompartment` / `fullDecorations`，在 `ContentArea.tsx` 依模式切换触发）。

## 十一、Rust 后端命令

命令实现按职责分组于 `src-tauri/src/commands/`（模块声明见 `src-tauri/src/commands/mod.rs`），统一在 `src-tauri/src/lib.rs` 注册：

| 模块 | 命令 |
|------|------|
| `file.rs` | `open_file`、`open_file_direct`、`pick_folder`、`read_file_base64`、`save_file`、`save_as_file` |
| `lib.rs`（顶层） | `register_media_path`（media:// 协议路径注册，处理器见 `media_protocol.rs`） |
| `directory.rs` | `read_directory`、`get_file_info`、`flatten_files` |
| `config_cmd.rs` | `load_config`、`save_config`、`get_api_key`、`set_api_key`、`delete_api_key` |
| `translate.rs` | `translate_text`、`stop_translation` |
| `capture.rs` | `append_inbox`、`append_inbox_batch`、`load_today_inbox`、`load_inbox_by_date`、`edit_inbox_entry`、`delete_inbox_entry`、`archive_entry`、`save_config_capture`、`load_config_capture`、`set_overlay_pinned`、`show_overlay_window`、`hide_overlay_window` |

文件写入采用原子写（tempfile persist）。

## 十二、API 密钥存储

API key 只存 OS 钥匙串，经由 `get_api_key` / `set_api_key` / `delete_api_key` 命令读写，**不写入配置文件**（决策依据见 [ADR 0005](./decisions/0005-api-key-os-keyring.md)）。实现见 `src-tauri/src/commands/config_cmd.rs`。

## 十三、关联决策

本文的现状均由以下已接受 ADR 固化其决策依据：

- [ADR 0001](./decisions/0001-separate-rendering-pipelines.md) — 阅读 / 编辑分离（双渲染管线）
- [ADR 0002](./decisions/0002-mode-switch-css-display-no-remount.md) — 模式切换用 CSS display 非 remount
- [ADR 0003](./decisions/0003-store-debounce-300ms.md) — store→CM6 同步 debounce 300ms
- [ADR 0004](./decisions/0004-store-plain-text-not-editor-objects.md) — store 存纯文本，不存编辑器对象
- [ADR 0005](./decisions/0005-api-key-os-keyring.md) — API key 只存 OS keyring
- [ADR 0009](./decisions/0009-collapsible-reading-rail-supersedes-no-sidebar.md) — 可折叠阅读空间取代无侧栏
- [ADR 0011](./decisions/0011-scenario-shell-and-pane-tree.md) — 场景化外壳与 Pane 递归树取代旧扁平分屏
