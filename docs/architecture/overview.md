---
title: 架构现状总览
type: architecture
status: accepted
last_updated: 2026-08-30
source_of_truth: canonical
---

# 架构现状总览（Clairis / 渐晰）

> 本文只描述**与当前代码一致**的架构现状，是架构主题的当前权威文档。
> 「为什么这么决定」属于决策历史，见 [`decisions/`](./decisions/README.md) 下的 ADR；本文不复述论证。
> 早期架构稿 `docs/ARCHITECTURE.md` 含旧项目名与过时图示，不再作为现状裁定依据（其处置见后续归档任务）。

## 一、总体形态

Clairis 是 Tauri 2 桌面应用：Rust 后端（`src-tauri/`）提供文件系统、配置、翻译等命令，前端 Webview 用 React 18 + TypeScript（`src/`）渲染，编辑器为 CodeMirror 6。

- Tauri 命令注册入口：`src-tauri/src/lib.rs`（`tauri::generate_handler!`）。
- 前端入口：`src/main.tsx`、`src/App.tsx`。

## 二、双渲染管线（阅读 / 编辑分离）

两条渲染管线相互独立（决策依据见 [ADR 0001](./decisions/0001-separate-rendering-pipelines.md)）：

- **阅读管线**：`src/renderers/`。Markdown 经 `marked` 解析后用 `DOMPurify` 白名单清洗，数学公式（KaTeX，`src/renderers/math.ts`）与 Mermaid 图表（`src/renderers/mermaid.ts`）分别预处理后渲染，再由 `src/components/Content/PreviewView.tsx` 通过 `dangerouslySetInnerHTML` 渲染（见 `src/renderers/markdown.ts`）。HTML 文件走 `src/components/Content/HtmlPreview.tsx`：有文件路径时经 asset 协议直载（`convertFileSrc`，sandbox 含 `allow-scripts`，脚本可执行、相对资源由浏览器原生解析）；无路径时回退 srcdoc 渲染，此时由 `src/renderers/html.ts` 改写相对路径并注入禁脚本 CSP。纯文本由 `src/renderers/text.ts` 转义后渲染。
- **编辑管线**：CodeMirror 6 编辑器，基础扩展装配在 `src/editors/setup.ts`，按文件类型组合语言扩展与装饰（decorations）：markdown / html / text 语言与 5 个 decoration 插件在 `setup.ts` 组装；css / python / json / javascript / yaml 代码语言高亮由 `src/components/Content/ContentArea.tsx` 的 `langCompartment` 装配。

模式（preview / edit / source）切换通过 CSS `display` 显隐，**不重建 EditorView**，从而保留 undo、选区与编辑状态（决策依据见 [ADR 0002](./decisions/0002-mode-switch-css-display-no-remount.md)）。实现见 `src/components/Content/ContentArea.tsx`：编辑器容器在 preview 时为 `display:none`，preview 由 `PreviewView` 呈现。

## 三、EditorView 实例管理

EditorView 实例不进 React 状态树，而存在模块级 Map 中，按 panelId 索引（决策依据见 [ADR 0004](./decisions/0004-store-plain-text-not-editor-objects.md)）：

- `src/editors/editorRef.ts`：`Map<panelId, EditorView>`，`panelId` 默认 `"main"`，分屏面板各占独立 ID；`getActiveEditorView()` 按最近聚焦面板回退到 `"main"`。
- 每个面板在 `ContentArea` 挂载时创建一次 EditorView，卸载时销毁并按 panelId 注销。

## 四、状态（双 store 现状）

当前存在两个 Zustand store（`editorStore.ts` 已标注 `@deprecated`，待与主 store 合并）：

- `src/stores/index.ts`（`useStore`）：标签（tabs / activeTabId）、分屏、最近文件、侧栏可见性、沉浸阅读模式（readingMode）等文件与界面状态。**store 只存纯文本** `content`，不存 EditorView 等编辑器对象。
- `src/stores/editorStore.ts`（`useEditorStore`，`@deprecated`）：配置（config）、字号、标题配色、翻译状态、内容版本号（`contentVersion`）。
- `src/stores/captureOverlay.ts`（`useCaptureOverlayStore`）：捕获浮层独立状态，由 `src/stores/index.ts` 再导出。

编辑内容回写 store：`ContentArea` 的 CM6 `updateListener` 在 `docChanged` 时调用 `updateTabContent` / `updateContent`（见 `src/components/Content/ContentArea.tsx`）；为避免高频同步开销，对 store→CM6 同步设置了防抖节奏（决策值见 [ADR 0003](./decisions/0003-store-debounce-300ms.md)）。

## 五、大文件守卫（large file guard）

历史实现中，文件大于 **500KB** 时强制进入 source 模式并关闭装饰以规避性能开销（`src/hooks/useFile.ts` 的 `SOURCE_MODE_LIMIT`）。该守卫内嵌于旧的 `useFile` 单文件流程，当前页签打开流程（`src/stores/index.ts` 的 `openFile`）未接入尺寸检查，因此**当前实际不生效**；`src/editors/setup.ts` 中的同名常量亦为未使用的残留。装饰的启用/禁用仍通过 CM6 `Compartment` reconfigure 完成（`setup.ts` 的 `decorCompartment` / `fullDecorations`，在 `ContentArea.tsx` 依模式切换触发）。

## 六、Rust 后端命令

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

## 七、API 密钥存储

API key 只存 OS 钥匙串，经由 `get_api_key` / `set_api_key` / `delete_api_key` 命令读写，**不写入配置文件**（决策依据见 [ADR 0005](./decisions/0005-api-key-os-keyring.md)）。实现见 `src-tauri/src/commands/config_cmd.rs`。

## 八、关联决策

本文的现状均由以下已接受 ADR 固化其决策依据：

- [ADR 0001](./decisions/0001-separate-rendering-pipelines.md) — 阅读 / 编辑分离（双渲染管线）
- [ADR 0002](./decisions/0002-mode-switch-css-display-no-remount.md) — 模式切换用 CSS display 非 remount
- [ADR 0003](./decisions/0003-store-debounce-300ms.md) — store→CM6 同步 debounce 300ms
- [ADR 0004](./decisions/0004-store-plain-text-not-editor-objects.md) — store 存纯文本，不存编辑器对象
- [ADR 0005](./decisions/0005-api-key-os-keyring.md) — API key 只存 OS keyring
