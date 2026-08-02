## Context

Quick Capture 浮窗（`Cmd+Shift+.`）当前每次 `Cmd+Enter` 只提交一条条目到当日 inbox 文件 `inbox-YYYY-MM-DD.md`（D-5 原子写）。草稿区支持 D-4 的 prefix 粘滞输入：行首 `.` `。` `．` →「问题」、`-` `—` `–` →「待办」、`!` `！` →「灵感」、`?` `？` →「思考」，IME_PREFIX_MAP 保留全角变体映射。本变更让用户一次粘贴/输入多行混合 prefix 内容，一次提交即按行切分为多条条目批量写入。

约束：中文优先（产物中文）；模式切换不 remount；交付前 `bash scripts/verify.sh` 全绿；vitest 只收集 `src/__tests__/**`；Rust 单测走 `cargo test`。

## Goals / Non-Goals

**Goals:**
- 一次弹窗批量录入多行混合 prefix 的 inbox 条目，一次提交全部写入。
- 切块策略 = Option 1（按行切块 + 续行归并）：前缀行开启新条目，无前缀续行并入当前条目（`content` 以 `\n` 连接），空行作为硬分隔并清除粘性 prefix。
- 后端 `append_inbox_batch` 原子写：按 `captured_at` 日期分组，每日期一次原子写（读现有 → 追加全部块 → 临时文件 → persist 替换）。
- 批内每条 `capturedAt` 严格互异，保证下游 `load_inbox_by_date` / `edit` / `delete` / `archive` 经 `time_hint` 首个匹配不塌缩。
- 失败降级链：`append_inbox_batch` → 逐条 `append_inbox` → localStorage `clairis_capture_fallback`。
- 空结果守卫：空的切分结果（全空 / 全空行）不触发任何写入。

**Non-Goals:**
- 不新增任何快捷键（复用 D-4「空行清空」手势作为硬分隔）。
- 不改变单条 `append_inbox` 的既有行为与签名。
- 不做跨日期自动分片之外的复杂路由（仅按 `captured_at` 日期分组）。
- 不修改 `openspec/specs/capture/spec.md`、`docs/capture-overlay-SPEC.md`、`docs/MVP-需求跟踪表.md`（T7 负责折叠同步）。

## Decisions

### D1. 切块策略 = Option 1（按行切块 + 续行归并）

- 逐行扫描草稿文本：
  - 行首命中 prefix（`.` `-` `!` `?` 及 IME_PREFIX_MAP 全角变体）→ 开启新条目，消费该前缀字符，`prefix` 记为对应类型，`content` 从该行剩余正文开始。
  - 无前缀的非空行 → 并入当前条目，`content` 以 `\n` 连接（续行归并）。
  - 空行 → 硬分隔：结束当前条目（若有），并清除粘性 prefix（复用 D-4「空行清空」手势，零新增快捷键）。
- 备选（否决）：Option 2「每行独立成条」——无法表达多行续行内容，丢失 D-4 续行语义；Option 3「仅按空行分隔」——无法区分 prefix 类型。Option 1 与 D-4 现有 prefix 语义一致，改动最小。

### 2. 批量命令契约 `append_inbox_batch`

```rust
#[tauri::command]
fn append_inbox_batch(entries: Vec<InboxEntryInput>) -> Result<(), AppError>
```

- `InboxEntryInput` 复用现有单条输入结构（`id` / `prefix` / `content` / `capturedAt`）。
- 原子写：按 `captured_at` 的日期（`YYYY-MM-DD`）分组，每组一次原子写（读现有 → 追加该组全部块 → tempfile → persist 替换），复用 D-5 的 `atomic_append` 实现。
- 空 `entries` 直接返回 `Ok(())`，不触发任何文件写入。

### 3. id / capturedAt 唯一性守卫

- 批内每条 `capturedAt` 严格互异：第 i 条取 `Date.now() + i`（毫秒递增），保证同一批内时间戳不重复。
- 理由：`load_inbox_by_date` / `edit` / `delete` / `archive` 依赖 `time_hint` 首个匹配定位实块；若批内多条 `capturedAt` 相同，首个匹配会塌缩到同一实块，导致后续条目不可定位。
- `id` 沿用 `nextEntryId()` 保证全局唯一。

### 4. 失败降级链

1. `append_inbox_batch(entries)` 原子写。
2. 失败 → 逐条 `append_inbox(entry)`（单条原子写，兼容旧路径）。
3. 仍失败 → localStorage `clairis_capture_fallback`（键 `clairis_capture_fallback`，追加 JSON 数组），保证不丢数据。

### 5. 空结果守卫

- 切分结果为空（全空 / 全空行）→ 不调用任何写入命令，直接返回，不产生空条目。

## Risks / Trade-offs

- [批内 `capturedAt` 相同导致 `time_hint` 塌缩] → 用 `Date.now() + i` 强制互异，并在 Rust 单测断言批内 `capturedAt` 两两不同。
- [批量原子写中途失败导致部分写入] → 降级链逐条 `append_inbox` 兜底，保证数据不丢。
- [续行归并改变既有单条提交语义] → 仅批量路径启用切块；单条 `Cmd+Enter` 行为不变。
- [空行硬分隔与 D-4 空行清空手势冲突] → 复用同一手势，语义一致（空行既清 prefix 又结束当前块），零新增快捷键。

## Migration Plan

- 纯新增能力，无破坏性变更；`append_inbox` 保留，向后兼容。
- 回滚：移除 `append_inbox_batch` 命令与前端切分逻辑即可，不影响既有单条路径。

## Open Questions

- 批量提交后 UI 是否逐条 fly-in 动画（对齐单条 `savedAckId` 语义）——实现时按单条动画复用，不阻塞本设计。