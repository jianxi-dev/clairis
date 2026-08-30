# Tasks: 全格式文件分流落地

## 1. 后端（Rust）

- [x] 1.1 `src-tauri/src/commands/file.rs`：新增 `is_binary_extension(path)`（image/video/pdf 扩展名集合）与文本扩展名常量；`open_file`/`open_file_direct` 二进制分支返回空 content、`file_size` 统一走 `fs::metadata`
- [x] 1.2 对话框 filter：`open_file` 补齐文档类（css/py/json/js/mjs/cjs/jsx/ts/tsx/yaml/yml/csv/log）+ 图片/视频/PDF filter；`save_as_file` filter 同步文本类扩展名
- [x] 1.3 Rust 单测：扩展名分类表（md=false、png=true、pdf=true、txt=false、无扩展名=false）、二进制返回空 content

## 2. 前端类型与分流

- [x] 2.1 `src/types/index.ts`：FileKind 12 类；`src/stores/index.ts` detectFileKind 全名单（文本+媒体）+ 导出 `isMediaKind`
- [x] 2.2 `store.setEditorMode`：媒体 tab 拦截（单一 guard 点）；`openFile` 媒体 tab 默认 preview（content 为空字符串不影响渲染，前端经 path 加载）

## 3. 语言映射与编辑器

- [x] 3.1 `src/components/Content/ContentArea.tsx`：createLanguageExtension 增加 css/python/json/javascript({typescript:true})/yaml 分支（5 个 lang 包已装为直接依赖）
- [x] 3.2 媒体 tab 恒预览：ContentArea 对媒体 kind 不渲染 CM6 容器；Toolbar 与 ContentSplitView 的 ModeButtons 对媒体隐藏编辑/源码按钮

## 4. 媒体预览与写回防护

- [x] 4.1 `src/components/Content/PreviewView.tsx`：image（`<img>`）/video（`<video controls>`）/pdf（`<iframe>`）分支，资源经 `convertFileSrc(path)`；空路径占位提示
- [x] 4.2 `src/App.tsx`：handleSaveFile 与 autoSave 对媒体 tab 跳过（保存按钮对媒体隐藏或禁用）
- [x] 4.3 mock 桥：`e2e/mocks/tauri-mock.js` 与 `src/__tests__/setup.ts` 补 `convertFileSrc` stub

## 5. 测试

- [x] 5.1 vitest：detectFileKind 全扩展名归类表、isMediaKind、setEditorMode 媒体拦截、PreviewView 媒体分支渲染（image/video/pdf 元素与 src）
- [x] 5.2 E2E（`e2e/tauri/`）：打开 `.json` → 默认编辑模式 + cm-editor 高亮容器；打开 `.png` → img 元素 + asset src；媒体 tab 点编辑按钮模式不变
- [x] 5.3 `npx tsc --noEmit` / `npx eslint src/` / `npm test`（除既有 docsGovernanceGate）全绿；`bash scripts/css-manifest-check.sh` + 浏览器层 Playwright 通过

## 6. 交付

- [x] 6.1 tasks 全部勾选；`openspec validate` 通过
- [x] 6.2 手动走查清单：各代码类高亮、图片/视频/PDF 打开渲染、PDF 翻页、媒体不可编辑/不可保存、对话框各 filter 可见
