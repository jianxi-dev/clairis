# Proposal: 全格式文件分流落地（代码类高亮 + 媒体类预览）

## Why

file-management C-1 已规定文件分流（文本类源码打开 / 媒体类预览打开），但实现仅完整支持 `.md`/`.html`：① 代码类（`.py`/`.json`/`.js`/`.ts`/`.yaml`/`.css`/`.csv`）打开无 CM6 语法高亮，且 Rust 打开对话框 filter 未包含这些扩展名；② 媒体类（`.pdf`/`.jpg`/`.png`/`.gif`/`.mp4`/`.mov`）完全不可用——Rust 侧 `read_to_string` 对二进制必然失败，对话框也无媒体 filter。C-1/C-2 列出的格式需全部可打开、可查看。

## What Changes

- **后端（Rust）**：
  - `open_file` / `open_file_direct` 磁盘读取前按扩展名分类：媒体/二进制类（image/video/pdf）跳过 `read_to_string` 返回空 `content`（不读大文件进内存），`file_size` 改用 `fs::metadata`
  - 打开对话框 filter 扩展：文档类补齐 `css/py/json/js/mjs/cjs/jsx/ts/tsx/yaml/yml/csv/log`；新增图片/视频/PDF filter
  - `save_as_file` filter 同步补齐文本类扩展名
- **前端**：
  - `FileKind` 扩展为 12 类（markdown/html/text/css/python/json/javascript/yaml/csv/image/video/pdf）；`detectFileKind` 按扩展名全名单归类
  - CM6 语言映射：css/python/json/javascript（含 ts/tsx 变体）/yaml；csv/text 维持无高亮等宽视图
  - 媒体 tab 只读预览：图片 `<img>`、视频 `<video controls>`、PDF `<iframe>`，资源经 `convertFileSrc(path)` 加载；媒体 tab 不允许切编辑/源码模式（store `setEditorMode` 拦截 + 按钮禁用）
  - 媒体 tab 禁止保存/自动保存（防空内容写回清空二进制文件）
- **测试**：Rust 扩展名分类单测；vitest detectFileKind 全名单、媒体渲染、模式拦截；E2E 代码文件高亮容器 + 图片/视频预览元素

## Capabilities

### New Capabilities

<!-- 无新能力：全部为 file-management / editing 现有规格落地 -->

### Modified Capabilities

- `file-management`：C-1 细化——代码类文件 SHALL 以编辑模式打开并提供对应语法高亮；媒体类 SHALL 以预览模式打开并渲染（图片显示/视频播放/PDF 内嵌）；媒体文件 SHALL 禁止编辑与保存回写。
- `editing`：语法高亮范围扩展——除 `.html` 外，`.css`/`.py`/`.json`/`.js`/`.ts`/`.yaml` 等代码类文件 SHALL 在编辑/源码模式提供对应语言高亮。

## Impact

- **后端**：`src-tauri/src/commands/file.rs`（filter 扩展、二进制分类、metadata 大小）
- **前端**：`src/types/index.ts`（FileKind）、`src/stores/index.ts`（detectFileKind、setEditorMode guard）、`src/components/Content/ContentArea.tsx`（语言映射）、`src/components/Content/PreviewView.tsx`（媒体渲染分支）、`src/components/Content/ContentSplitView.tsx`（ModeButtons 媒体禁用）、`src/components/Toolbar.tsx`（媒体保存/模式按钮）、`src/App.tsx`（保存/自动保存 guard、Cmd+Shift+M 经 store guard 自动生效）
- **依赖**：`@codemirror/lang-css/python/json/javascript/yaml`（已安装为直接依赖）
- **测试**：Rust 单测 + vitest + E2E

## 验收门槛

- verify 相关步骤全绿（排除既有 docsGovernanceGate）
- E2E：`.json` 打开进入编辑模式且高亮；`.png` 打开渲染为图片元素
- `npm run tauri dev` 手动走查：各代码类文件高亮、图片/视频/PDF 打开渲染、媒体文件不可编辑不可保存
