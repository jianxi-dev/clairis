# Design: 全格式文件分流落地

## Context

file-management C-1 规定文本类源码打开 / 媒体类预览打开。现状：
- Rust `open_file`：filter 仅 `md/markdown/mdown/mdwn/html/htm/txt`；`read_to_string` 读取（二进制报 InvalidData）；`file_size` 用 content 字节数
- 前端 `detectFileKind`：仅 md/markdown → markdown、html/htm → html、其余 → text
- `PreviewView`：markdown（渲染）/ html（iframe）/ text（等宽 pre）
- `ContentArea` 语言：markdown/html/text（text 无高亮）
- `tauri-mock.js`：`__TAURI_INTERNALS__` 无 `convertFileSrc`（媒体 E2E 需要补）

约束：规格权威；vitest 只收 `src/__tests__/`；media 二进制不读入前端内存；文档对话框 filter 需覆盖全名单。

## Goals / Non-Goals

**Goals**
1. 全部 C-1 文本类扩展名可打开，代码类有 CM6 语法高亮；默认编辑模式（源码打开）。
2. 媒体类（image/video/pdf）可打开、预览渲染；不读二进制进内存。
3. 媒体 tab 防呆：不可编辑、不可保存回写。
4. Rust + vitest + E2E 覆盖，verify 全绿（排除既有失败）。

**Non-Goals**
- 不做 CSV 结构化渲染/表格化（等宽视图即可，规格无此要求）。
- 不做代码运行/编译/格式化（打开查看 + 高亮为止）。
- 不做图片缩放/旋转/幻灯片等浏览增强（Phase P 方向）。
- 不实现未列格式（.docx/.xlsx/.zip 等）——超出 C-1 名单。

## Decisions

### D1 二进制判定与读取策略：扩展名分类 + 空 content

**决策**：Rust 新增 `is_binary_extension(path: &Path) -> bool`（扩展名集合：png/jpg/jpeg/gif/svg/webp/bmp/ico/pdf/mp4/mov/webm/m4v/mkv/avi/mp3/m4a/wav/flac/ogg）。`open_file`/`open_file_direct` 中：
- 二进制 → `content = ""`（不读取；大视频不占内存），`file_size` 改 `fs::metadata(path).len()`
- 文本 → 维持 `read_to_string`；`file_size` 统一走 metadata（与 content.len 一致且更准）

**理由**：把大文件读成字符串/Base64 进 IPC 是明显的内存与性能坑；前端已有 `path` + `convertFileSrc` 可直接经 asset 协议渲染媒体，空 content 是零成本通道。

**备选**：Base64 回传（实现直观但大文件内存翻倍、IPC 慢）→ 拒绝。

### D2 FileKind 12 类 + 前端 detectFileKind 全名单

**决策**（types/index.ts）：
```ts
FileKind = "markdown" | "html" | "text" | "css" | "python" | "json"
         | "javascript" | "yaml" | "csv" | "image" | "video" | "pdf"
```
- 文本：md/markdown/mdown/mdwn → markdown；html/htm → html；css → css；py/pyw → python；json/jsonc → json；js/mjs/cjs/jsx/ts/tsx → javascript（ts 变体由语言扩展开启）；yaml/yml → yaml；csv → csv；txt/log/其余 → text
- 媒体：png/jpg/jpeg/gif/svg/webp/bmp/ico → image；mp4/mov/webm/m4v/mkv/avi → video；pdf → pdf
- 导出 `isMediaKind(kind)` helper（types 或 utils）

**理由**：细分 kind 让语言扩展映射与媒体行为都是显式 switch；csv/text 保持无高亮等宽（无官方 CM csv 语言，不引入第三方）。

### D3 CM6 语言映射（ContentArea）

**决策**：
- markdown/html/css/python/json/yaml → 对应 lang 包
- javascript → `javascript({ typescript: true })`（ts/tsx 与 js 统一 TS 模式，JS 为 TS 子集高亮兼容）
- text/csv/image/video/pdf → `[]`（无编辑语言；媒体恒 preview 不挂编辑器）

### D4 媒体 tab 只读防护

**决策**：
- `store.setEditorMode`：active tab 为媒体 kind 时直接 return（Cmd+Shift+M 与按钮全部经此拦截，单一 guard 点）
- `ContentSplitView` 与 `Toolbar` 的 ModeButtons：媒体 tab 隐藏"编辑/源码"按钮（视觉禁用）
- `App.tsx handleSaveFile` 与 autoSave：媒体 tab return（杜绝空 content 写回清空文件）
- `ContentArea`：媒体 kind 恒渲染 PreviewView（editorMode 即使被置为 edit 也因 guard 不落 store）

### D5 媒体预览渲染（PreviewView）

**决策**：
- image → `<img src={convertFileSrc(path)} style={{ maxWidth: "100%", height: "auto" }} />`（居中容器）
- video → `<video src={convertFileSrc(path)} controls style={{ maxWidth: "100%" }} />`
- pdf → `<iframe src={convertFileSrc(path)} style={{ width: "100%", height: "100%", border: "none" }} />`（WKWebView 内置 PDF 查看）
- 路径为空 → 占位提示（"无法预览"）
- 容器沿用 `.preview-view` 但媒体分支不加 markdown 字体样式（独立居中类）

**安全**：`convertFileSrc` 生成 `asset://localhost/<path>`，Tauri asset 协议按 scope 映射；无脚本注入面（WKWebView PDF/图片/视频渲染）。

### D6 mock 桥补齐

**决策**：`e2e/mocks/tauri-mock.js` 的 `__TAURI_INTERNALS__` 增加 `convertFileSrc: (p) => "asset://localhost" + p`；`src/__tests__/setup.ts` 的 core mock 增加同签名 `convertFileSrc`（htmlRewrite 测试文件内 mock 覆盖不受影响）。

## Risks / Trade-offs

- **[扩展名伪装文本的二进制文件]** → read_to_string 报 InvalidData，打开失败（维持现状报错，不嗅探内容）——超低频，接受。
- **[视频大文件 preview 一次性加载]** → WKWebView/asset 协议流式处理，无整文件读入；前端内存不受影响。
- **[PDF 内嵌 iframe 与禁脚本]** → PDF 为 asset 协议静态文档，WKWebView 内置渲染不含脚本执行面。
- **[Rust/TS 扩展名名单漂移]** → 名单集中两处（file.rs 常量 + detectFileKind），规格 C-1 为唯一真相源，出现漂移时以规格为准修复。

## Migration Plan

1. 无数据迁移；无配置变化。
2. 顺序：Rust（分类 + filter）→ 前端类型/store → 语言映射 → 媒体预览 → guard → mock → 测试 → 验证。
3. 回滚：分支级回滚。

## Open Questions

- `.csv` 是否需要结构化预览（表格化）？→ 非 Goal，等宽视图（规格未要求）。
