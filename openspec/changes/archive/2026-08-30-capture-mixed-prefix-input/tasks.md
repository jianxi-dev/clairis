## 1. 后端批量命令

- [x] 1.1 在 `src-tauri/src/commands/capture.rs` 新增 `append_inbox_batch(entries: Vec<InboxEntryInput>) -> Result<(), AppError>`：按 `captured_at` 日期分组，每组一次原子写（读现有 → 追加该组全部块 → tempfile → persist 替换），空 `entries` 直接返回 `Ok(())`。验收：`cargo test` 通过；空输入不产生文件写入。
- [x] 1.2 在 `src-tauri/src/lib.rs` invoke_handler 注册 `append_inbox_batch`。验收：命令可被前端 `invoke` 调用，无编译错误。

## 2. 后端 Rust 单测

- [x] 2.1 新增 `append_inbox_batch` 单测：多日期分组原子写、批内 `capturedAt` 两两互异、空输入不写入。验收：`cargo test --manifest-path src-tauri/Cargo.toml` 全绿。

## 3. 前端切块算法 chunkDraft

- [x] 3.1 在 `src/stores/captureOverlay.ts` 新增 `chunkDraft(raw: string): InboxEntryInput[]`：按行切块（前缀行开启新条目、无前缀续行并入当前条目以 `\n` 连接、空行硬分隔并清空 prefix），复用 IME_PREFIX_MAP 全角变体映射。验收：多行混合 prefix 输入切分为正确条目数组。
- [x] 3.2 在 `chunkDraft` 中为批内每条分配 `capturedAt = Date.now() + i`（第 i 条）与唯一 `id`。验收：批内 `capturedAt` 严格互异。

## 4. store 批量提交动作

- [x] 4.1 在 `src/stores/captureOverlay.ts` 新增批量提交动作：调用 `append_inbox_batch`，失败降级为逐条 `append_inbox`，再失败写入 localStorage `clairis_capture_fallback`；空切分结果不触发任何写入。验收：`npx vitest run src/__tests__/` 通过。
- [x] 4.2 新增 store 测试（`src/__tests__/`）：多行混合 prefix 批量提交、续行归并、空行硬分隔、空结果不写入、降级链。验收：测试覆盖新逻辑且 CI coverage 阈值不降。

## 5. 组件对齐

- [x] 5.1 在 `src/components/CaptureOverlay.tsx` 将提交路径对齐批量动作（`Cmd+Enter` 走批量切分提交）。验收：真实 UI 中一次粘贴多行混合 prefix 提交后，历史区出现多条条目。

## 6. 规格与跟踪表同步（T7）

- [x] 6.1 将本变更 delta 折叠进 `openspec/specs/capture/spec.md`：新增 D-15 需求（含批内 `capturedAt` 唯一性验收守卫），编号与主 spec 一致不漂移。验收：`openspec list` 可列出本变更，`specs/capture/delta.md` 引用主 spec 编号（D-15）无漂移。
- [x] 6.2 同步 `docs/MVP-需求跟踪表.md` 模块 D 新增 D-15 行。验收：跟踪表与 spec 编号一致。

## 7. 交付验证

- [x] 7.1 运行 `bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）。验收：交付前完整验证通过。