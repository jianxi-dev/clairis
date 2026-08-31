# TODOS

## Security（安全）

### HTML 预览 iframe 隔离加固（评审 P0）

**What:** 移除 `HtmlPreview.tsx` 中 asset 直载分支的 `allow-same-origin` sandbox 令牌，并收紧 `tauri.conf.json` 的 `assetProtocol.scope`（当前为 `["**"]`）。

**Why:** 安全评审确认：恶意 `.html` 文件在 iframe 内可保持 `asset://localhost` 同源，经 asset 协议任意读取本地文件并外传。

**Context:** 评审（ship 2026-08-30）标注为 CRITICAL，用户选择跳过修复先行发布；PR 中已披露。资产协议为仅服务已注册路径的 media 协议可作参照。修复后需回归验证相对图片/CSS 资源仍能经 asset:// 加载。

**Effort:** S
**Priority:** P0

### inbox 日期参数路径穿越校验（评审 P0）

**What:** `capture.rs` 的 `load_inbox_by_date` / `edit_inbox_entry` / `delete_inbox_entry` / `archive_entry` 对 `date` 参数做字符校验（仅允许 `YYYY-MM-DD`），拒绝含 `..`、`/`、`\` 的输入。

**Why:** 当前 date 直接拼入文件路径，构造的 `date` 可读写任意 `.md` 文件。

**Context:** 评审（ship 2026-08-30）标注为 CRITICAL，用户选择跳过先行发布；PR 中已披露。

**Effort:** S
**Priority:** P0

### 翻译端点校验接线（SSRF 防护启用）

**What:** 在 `translate_text` 请求前调用 `validate_translation_endpoint`（`validation.rs`），失败返回 `InvalidEndpoint` / `EndpointBlocked`。

**Why:** SSRF 防护函数已实现且有测试，但从未被调用——配置端点可指向任意内网主机。

**Context:** 评审（ship 2026-08-30）确认是死代码；用户选择跳过先行发布；PR 中已披露。

**Effort:** S
**Priority:** P1

## Testing（测试）

### 补充 Rust 侧关键测试（评审 P0）

**What:** 为 `read_file_base64` 的 100MB 上限守卫补测试；为 `validate_translation_endpoint` 接线后的 translate 路径补测试；为 `media_protocol_handler` 的跨源拒绝 / 未注册路径 404 / range 206 分支补测试（handler 本身仍无测试）。

**Why:** 这些是安全边界分支，目前仅 `parse_range` / `decode_uri_path` 有测试；无测试守卫的边界会在重构中悄然回归。

**Context:** ship（2026-08-30）已为 capture CRUD、media protocol handler 补了 15 个测试；handler 本体与 base64 守卫仍为 gap。测试框架：`cargo test --manifest-path src-tauri/Cargo.toml`。

**Effort:** S
**Priority:** P1

### E2E 复杂 CSS / 视频字体断言（评审 P1）

**What:** 为 `html-css-view-support` 的 2.1（网格/变量/keyframes 计算样式）与 2.2（视频 data URI、`@font-face` 无 CSP 违例）补 e2e 断言。

**Why:** 计划完成度审计标记这两项 NOT DONE——功能已实现但无浏览器层验证，回归无防护。

**Context:** 现有 `html-css.spec.ts` 只覆盖 asset 直载 / srcdoc 回退 / 锚点导航三项。

**Effort:** M
**Priority:** P2

## Maintainability（可维护性）

### 死代码清理（评审 P2）

**What:** 删除 `useFile.ts`、`formattingKeymap`（keybindings.ts）、`setActiveEditorView`（editorRef.ts）、`moveTabToSplit`（stores/index.ts）、`renderByKind`（renderers/index.ts 未被消费）、`CapturePosition` 类型、`editorStore` 的 translation/file 状态块；将 `renderTextContent` 替换为 `renderText`。

**Why:** 评审确认 6+ 处从未被调用的导出与重复实现；死代码增加阅读与维护成本。

**Context:** ship（2026-08-30）的 maintainability 专家逐项确认 grep 无调用点。删除后需同步清理引用它们的测试。

**Effort:** M
**Priority:** P2

### DRY 去重（评审 P2）

**What:** 合并 `escapeHtml`（markdown/math/highlight 三份）、`toLocalDate` 与今天/昨天标签（captureOverlay×2、main.tsx、CaptureOverlay.tsx）、Rust `atomic_write`（capture.rs×7）、`time_hint` 提取（edit/delete/archive 已提取为 helper，验证后删除残留）、PreviewView 三个 clamp helper。

**Why:** 同类逻辑多份拷贝，改动需多处置同步，已实际造成这类 bug（见 Fixed：capture 时间戳匹配）。

**Context:** ship（2026-08-30）maintainability 专家发现；capture 的拆分 helper 已在本轮修复中落地。

**Effort:** M
**Priority:** P2

## Infrastructure（基础设施）

### 统一文件大小限制来源（评审 P2）

**What:** 前端调用 Rust `get_size_limits` 命令取得 500KB / 2MB 阈值，替代 `useFile.ts`、`editors/setup.ts`、`file.rs` 三处硬编码。

**Why:** 阈值三处重复且 `get_size_limits` 命令当前无人调用；漂移会导致大文件守卫行为不一致。

**Context:** ship（2026-08-30）maintainability 专家确认。注意 `useFile.ts` 整体为死代码（见上），阈值应迁至仍在使用的 `setup.ts` 路径。

**Effort:** S
**Priority:** P3

## Capture（捕获 CRUD 功能缺陷，review 2026-08-30）

### archive/delete IPC 参数缺失致静默失效（评审 P0）

**What:** `captureOverlay.ts` 的 `archive_entry`（:392）与 `delete_inbox_entry`（:520）invoke 载荷缺 `req:` 包装层（Rust 签名 `archive_entry(req: InboxEntryArchive)`），而 `edit_inbox_entry`（:485）正确包了 `req:`。Tauri 2 按参数名解析 → 归档/删除必然报 "missing required key req"，被 `.catch(()=>{})` 吞掉。

**Why:** UI 移除条目但磁盘块保留，下次 `loadHistory` 条目复活——用户看到"删了又出现"的伪删除/伪归档。Rust 8 个 CRUD 单测直调函数通过，e2e mock 掉 invoke 测不到。

**Context:** 评审（review 2026-08-30）API Contract 专家发现（confidence 9.5/10），同文件 edit 与 append 均按参数名包装可证。修复仅 2 行：载荷包 `{ req: { date, entryId } }`。用户选择跳过先行发布。

**Effort:** S
**Priority:** P0

### 批量提交后第 2+ 条无法编辑/归档/删除（评审 P1）

**What:** `captureOverlay.ts` `chunkDraft` 中条目 id 由 `nextEntryId()` 生成（时间戳 = 调用时刻 t），而 `capturedAt = t + i`（每条 +1ms）。Rust `block_matches_time_key` 靠 `encode_time_key(块time) == id内嵌time` 精确相等反解 → 批内第 2+ 条的乐观 id 与落盘块时间戳失配。

**Why:** reload 前对批内非首条做编辑会**追加重复 `edit-{now}` 块**而非替换；归档/删除静默跳过。首条（i=0）因 t 相同而侥幸可用。

**Context:** 评审（review 2026-08-30）API Contract 专家发现（confidence 8.5/10）。修复：id 时间戳改用与 capturedAt 相同的 `t + i`。用户选择跳过先行发布。

**Effort:** S
**Priority:** P1

## Media（媒体预览与协议，review 2026-08-30）

### media:// 编码双斜杠致视频预览 404（评审 P1）

**What:** `PreviewView.tsx` `mediaUrlForPath` = `"media://localhost/" + encodeURIComponent(整路径)`（连斜杠一起编码）；`media_protocol.rs` `decode_uri_path` 解码后 `format!("/{decoded}")` 再补前置斜杠 → 得 `//Users/...` 双斜杠 PathBuf，与 `register_media_path` 注册的单斜杠路径精确匹配失败 → 404。

**Why:** 生产环境视频预览打不开（open 后媒体元素 404）。Rust 单测用未编码 URI 通过；e2e mock 不触达 media 协议，故未暴露。**禁止**用"放宽为前缀/模糊匹配"修复——那会引入路径穿越；须统一编码约定（后端只解码一次并规范化后比对注册路径）。

**Context:** 评审（review 2026-08-30）Security 专家发现（confidence 8/10），字符串级验证。需真机开视频复核。用户选择跳过先行发布。

**Effort:** S
**Priority:** P1

### media 协议无 Range 请求整文件读入内存（评审 P1）

**What:** `media_protocol.rs` 对无 Range 或开放式 `bytes=0-` 请求执行 `read_range(0, file_len-1)`，一次性 `vec![0u8; file_len]` 无大小上限。

**Why:** 数 GB 视频即内存 OOM（Security + Performance 双专家确认）。当前前端经 VideoPlayer 发 Range 请求可绕开，但任意无 Range GET（探针/非 seek 客户端）会触发。

**Context:** 评审（review 2026-08-30）双专家发现（7+7 分，MULTI-SPECIALIST）。修复：无 Range/开放 Range 设上限（如 >16MB 拒 416），或分块流式。用户选择跳过先行发布。

**Effort:** M
**Priority:** P1

### read_file_base64 / register_media_path 无来源校验（评审 P1，关联既有 P0 链）

**What:** `read_file_base64(path)` 对任意路径无校验直接读（≤100MB → base64 返回 webview）；`register_media_path` 以普通 command 暴露，任意 webview 代码可投毒 media 白名单。

**Why:** 一旦 HTML 预览 P0 链（iframe allow-same-origin + asset scope `["**"]`）成立，同源脚本即可任意文件读取外传、并使 media 白名单形同虚设。`read_file_base64` 的 100MB 守卫测试缺口已录入 Testing 段，本条目记安全缺口本体。

**Context:** 评审（review 2026-08-30）Security 专家发现（8/10）。修复方向：base64 读取复用 media 白名单（仅读已注册媒体路径）+ canonicalize；注册改为后端在打开文件时登记、前端只传 token。用户选择跳过先行发布。

**Effort:** M
**Priority:** P1

## Window / Capabilities（窗口权限，review 2026-08-30）

### capability 缺 3 个窗口权限：关闭/拖拽/缩放被 ACL 拒绝（评审 P0/P1）

**What:** `capabilities/default.json` 缺 `core:window:allow-destroy`、`core:window:allow-set-size`、`core:window:allow-start-dragging`（已对照 tauri 2.11.3 源码确认 `core:window:default` 不含这三项）。前端实际调用：`App.tsx:435` `win.destroy()`（onCloseRequested preventDefault 后）、`CaptureOverlay.tsx:254` `startDragging()`、`:381` `setSize()`。

**Why:** 主窗口 close 请求被 preventDefault 后 destroy 被拒 → 关闭按钮可能失效（需真机验证）；无边框 overlay 无法拖拽与缩放。三处调用均被静默/告警吞掉。

**Context:** 评审（review 2026-08-30）API Contract 专家发现（confidence 9/10）。修复：capability 补三项权限。用户选择跳过先行发布。

**Effort:** S
**Priority:** P0

## Translation（翻译，review 2026-08-30）

### OpenAI 翻译路径完全不可用 + key 未走 keyring（评审 P1）

**What:** `config.rs` `AppConfig.openai_api_key` 带 `#[serde(skip)]` → `load_config` 后恒为 None → `translate.rs:201` 发空 `Authorization: Bearer`；`useTranslation.ts:77` 硬编码 `provider: "ollama"` 且 `useTranslation`/`TranslatePanel` 零调用方（翻译 UI 为 stub）；keyring 三命令（get/set/delete_api_key）无前端消费。

**Why:** openai 分支不可达且即使可达也发空 key；SSRF 校验器 `validate_translation_endpoint`（validation.rs，有测试）是死代码（接线条目见 Security 段）。违反 AGENTS.md「API key 只存 keyring」约束的隐患：key 若写入 config 会明文落盘。

**Context:** 评审（review 2026-08-30）Security + Maintainability 双专家发现（7/8 分）。修复方向：translate 从 keyring 取 key、接线校验器，或删除 openai 分支与死命令直至 UI 落地。用户选择跳过先行发布。

**Effort:** S
**Priority:** P1

## Performance（性能，review 2026-08-30）

### 编辑区每击键全文档重建装饰（评审 P2）

**What:** `editors/setup.ts` `decorationField` 每次 `docChanged` 对全文跑 5 遍正则（标题/粗斜/列表/引用/代码）重建整个 `Decoration.set`，无大小守卫（500KB `SOURCE_MODE_LIMIT` 已定义但未接线）。

**Why:** 大 markdown 文件每击键 O(n)×5 主线程计算，输入卡顿；AGENTS.md 已注明大文件守卫实际未生效。

**Context:** 评审（review 2026-08-30）Performance 专家发现（confidence 6/10）。修复：仅重算变更行区间（`tr.changes.toRanges`）或按文档大小门控。用户选择跳过先行发布。

**Effort:** M
**Priority:** P2

### 分屏预览每击键全量 markdown 管线无防抖（评审 P2）

**What:** `ContentArea.tsx` 分屏模式下 PreviewView 直接接收 `tab.content`，每击键重跑 marked 解析 + DOMPurify + DOMParser 回填 + 全部 mermaid 重渲染。

**Why:** 编辑即预览大文档时每键卡顿；mermaid 无已渲染标记（`renderMermaid` 每次全量重渲）。

**Context:** 评审（review 2026-08-30）Performance 专家发现（confidence 6/10）。修复：预览侧 150-300ms 防抖 + mermaid 标记已渲染块。用户选择跳过先行发布。

**Effort:** M
**Priority:** P2

### 其余性能小项（评审 P2/P3）

**What:** (a) `read_file_base64` 的 base64 编码在 `spawn_blocking` 外，占 tokio worker（P2）；(b) `save_file` 同步 fs（create_dir_all/write/persist）在 async 命令内（P2）；(c) capture 系列同步命令在主线程做 fs 读改，提交时卡 UI（P2）；(d) katex ~700KB 静态进主包，无公式文档也加载（P3）；(e) `CANCELLED` 全局标志 + 前端 listener 不过滤 `requestId`，连续翻译旧块混入新输出（P2）；(f) capture 读-改-写无锁，主/浮层并发提交可能丢条目（P2）。

**Why:** 逐一为 UI 卡顿、async 阻塞、包体积与并发一致性风险；均非数据损坏级，但修复成本低。

**Context:** 评审（review 2026-08-30）Performance 专家逐项标注。用户选择跳过先行发布。

**Effort:** M
**Priority:** P2

## Maintainability（可维护性，review 2026-08-30 追加）

### highlight.ts 源码含字面 NUL 字节（评审 P1）

**What:** `renderers/highlight.ts:64` 缓存键模板 `` `${lang}\x00${code}` `` 内含真实 0x00 字节 → git 将该文件按二进制处理，diff/grep/rename 工具链失效。

**Why:** 文件无法正常 diff 审查与 grep 定位，直接影响后续维护（已字节级验证 1 处 NUL）。

**Context:** 评审（review 2026-08-30）Maintainability 专家发现（0.95 分）。修复：换显式分隔符或 `"\u0000"` 转义写法，`git add` 重跟踪为文本。用户选择跳过先行发布。

**Effort:** S
**Priority:** P1

### debug-split.spec.ts 调试 spec 入库（评审 P1）

**What:** `e2e/tauri/debug-split.spec.ts` 为 DEBUG 草稿，含 console.log 调试输出与 `as any` 转义，随 e2e 套件发布。

**Why:** 调试残留进测试套件，污染测试输出与后续维护；`as any` 违反仓库类型纪律。

**Context:** 评审（review 2026-08-30）Maintainability 专家发现（0.9 分）。修复：删除或改写成断言式测试。用户选择跳过先行发布。

**Effort:** S
**Priority:** P1

### serde 字段漂移：RecentFile / TranslationChunk（评审 P2）

**What:** `config.rs` `RecentFile` 无 `#[serde(rename_all = "camelCase")]` → 序列化 `opened_at`，TS 声明 `openedAt`；`types.rs` `TranslationChunk` 序列化 `request_id`，TS 声明 `requestId`（前端目前不读该字段）。

**Why:** 与已修复的 CaptureConfig serde 不匹配同类 bug——一旦前端以 camelCase 写回 recentFiles，`save_config` 反序列化失败会中止整个配置保存；TranslationChunk 一旦消费 requestId 即得 undefined。

**Context:** 评审（review 2026-08-30）API Contract 专家发现（9/9.5 分）。修复：Rust 侧补 `rename_all` 或 TS 对齐字段名。用户选择跳过先行发布。

**Effort:** S
**Priority:** P2

### 无 VERSION 文件 + 无 v0.2.0 git tag（评审 P2）

**What:** 仓库无根 VERSION 文件，且首个正式版本 0.2.0 未打 git tag（`git tag` 为空）。

**Why:** 版本契约无单一事实源、发布不可复现，影响后续 /ship 队列判定与发布追溯。

**Context:** 评审（review 2026-08-30）Maintainability 专家发现（0.9 分）。修复：补 VERSION 文件 + 打注释版 v0.2.0 tag。用户选择跳过先行发布。

**Effort:** S
**Priority:** P2

## Design（设计，review 2026-08-30）

### 阅读设置控件可达性：对比度 / focus-visible / reduced-motion（评审 P2）

**What:** (a) `.reader-pill.on` 选中态深色模式对比度 2.98:1（WCAG AA 需 4.5:1，浅色也仅 4.47:1 贴线）；(b) `.reader-pill` / `.reader-settings-toggle` 无 `:focus-visible`（同文件其他控件有）；(c) `editor.css` `[style*=fadeInSlide] { animation: none !important; }` 用属性选择器 + `!important` 规避 reduced-motion。

**Why:** 键盘导航视觉语言不一致、深色模式可读性不足、reduced-motion 实现脆弱（此前已标 need input，本轮复核仍未处理）。

**Context:** 评审（review 2026-08-30）Design 专家复核（9/8/9 分），此前 Design Review (lite) 已标 2 need input。修复方向：accent 深色变体 + `:focus-visible` outline + 动画改 class 并用媒体查询。用户选择跳过先行发布。

**Effort:** S
**Priority:** P2

### 视觉一致性：accent 色漂移 / ErrorBoundary 硬编码浅色 / emoji 图标（评审 P2）

**What:** (a) 同屏 4 种互不相同的蓝/靛 accent（`--app-accent=#6366f1` vs 编辑器链接 #2563eb、split handle #3b82f6、TabBar blue-500、CaptureOverlay #0071e3）；(b) `ErrorBoundary.tsx` 兜底 UI 硬编码 `color:red`/`#f5f5f5`，深色模式刺眼；(c) CaptureOverlay 置顶按钮用彩色 emoji，违反 reader.css 明注的「不用 emoji」约定。

**Why:** 主题切换后不一致显眼；深色模式出错页白块 + 红字；emoji 在 macOS 渲染为彩图破坏单色 UI。

**Context:** 评审（review 2026-08-30）Design 专家发现（7/6/6 分）。修复：统一路由到 `var(--app-accent)` 语义变量、ErrorBoundary 用 token 色、emoji 换 lucide/Unicode 字形。用户选择跳过先行发布。

**Effort:** S
**Priority:** P2

## Testing（测试，review 2026-08-30 追加）

### captureOverlay store 交互 action 零覆盖（评审 P2）

**What:** `captureOverlay.ts` 的 `archiveEntry`/`undoArchive`/`tickUndo`（5s undo 定时）、`saveEdit`/`cancelEdit`/`deleteEntry`、`loadHistory`（今天+昨天去重）、`loadConfig` 合并、`clampPosition`/`clampCapsulePosition`/`setOverlaySize`/`setPanelRatio` 钳制均无测试。

**Why:** undo 定时与 CRUD invoke 路径是本次批量录入功能的核心交互；无测试守卫，配合上文 archive/delete 参数 bug 一起回归无人察觉。

**Context:** 评审（review 2026-08-30）Testing 专家发现（CRITICAL 6/10，附完整 vitest stub：fake timers + invoke mock）。测试框架：vitest（`src/__tests__/`）。用户选择跳过先行发布。

**Effort:** M
**Priority:** P2

### highlight / log / HtmlPreview 边界分支测试（评审 P2/P3）

**What:** (a) `highlightCodeBlock` 守卫分支零直接单测：20k 字符回退、未知语言回退、token 内 HTML 转义、cache 淘汰（P2）；(b) `log.ts` 零覆盖：级别过滤、Error→stack、环形缓冲 200 上限、recent/clear（P3）；(c) `HtmlPreview` srcdoc 回退分支（注入 `script-src 'none'` CSP、空内容文档、error 态）零覆盖，且 `FramePreview` 强制 filePath 使该安全分支难以触达（P2）。

**Why:** 均为安全/性能边界分支，无测试守卫会在重构中悄然回归（同类：media handler 边界已补 15 测试，此处为余下 gap）。

**Context:** 评审（review 2026-08-30）Testing 专家发现（5-7 分，均附 test stub）。用户选择跳过先行发布。

**Effort:** M
**Priority:** P2

## Completed