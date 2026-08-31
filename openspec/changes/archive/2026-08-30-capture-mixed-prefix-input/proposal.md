## Why

当前 Quick Capture 浮窗一次只能提交一条条目（`Cmd+Enter` 单条提交）。用户想批量录入多条混合 prefix 的 inbox 条目时，只能逐条重复唤起、输入、提交，效率低且打断心流。需要一个「一次弹窗批量录入多行混合 prefix」的能力：在浮窗草稿区一次粘贴或输入多行，每行以 `.` `-` `!` `?` 前缀标记类型，一次提交即按行切块为多条条目原子写入当日 inbox。

## What Changes

- 新增批量切块：草稿区多行内容按「前缀行开启新条目、无前缀续行并入当前条目、空行硬分隔」切分为多条条目（复用 D-4 的 prefix 语义与 IME_PREFIX_MAP 全角变体映射）。
- 新增批量提交命令 `append_inbox_batch`：一次原子写入多条条目，按 `captured_at` 日期分组，每日期一次原子写。
- 新增正确性守卫：批内每条 `capturedAt` 严格互异（`Date.now() + i`），避免 `load_inbox_by_date` / `edit` / `delete` / `archive` 经 `time_hint` 首个匹配塌缩到同一实块。
- 新增失败降级链：`append_inbox_batch` → 逐条 `append_inbox` → localStorage `clairis_capture_fallback`。
- 新增空结果守卫：空的切分结果（全空 / 全空行）不触发任何写入。
- 复用 D-4「空行清空」手势作为硬分隔，零新增快捷键。

## Capabilities

### New Capabilities

- `capture-mixed-prefix-input`: 一次弹窗批量录入多行混合 prefix 的 inbox 条目（切块算法 + 批量命令 + 正确性守卫 + 失败降级链）。

### Modified Capabilities

- `capture`: 在现有 capture 域（D-1 至 D-14）基础上新增 D-15 需求「一次批量混合 prefix 录入」，含批内 `capturedAt` 唯一性验收守卫。

## Impact

- **后端**：`src-tauri/src/commands/capture.rs` 新增 `append_inbox_batch` 命令；`src-tauri/src/lib.rs` invoke_handler 注册。
- **前端**：`src/stores/captureOverlay.ts` 新增批量切分逻辑（`chunkDraft`）与批量提交动作；`src/components/CaptureOverlay.tsx` 提交路径对齐批量语义。
- **测试**：Rust 单测（切块 / 原子写 / capturedAt 唯一性）、vitest store 测试（`src/__tests__/`）。
- **规格同步**：T7 将本变更 delta 折叠进 `openspec/specs/capture/spec.md`（新增 D-15）与 `docs/MVP-需求跟踪表.md` 模块 D。