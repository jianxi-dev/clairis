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

## Completed