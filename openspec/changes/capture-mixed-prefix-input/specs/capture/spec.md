## ADDED Requirements

### Requirement: D-15 一次批量混合 prefix 录入

浮窗草稿区 SHALL 支持一次批量录入多行混合 prefix 的 inbox 条目：按行切块（前缀行开启新条目、无前缀续行并入当前条目并以 `\n` 连接、空行作为硬分隔并清除粘性 prefix），一次提交 SHALL 将切分结果批量写入当日 inbox。批内每条 `capturedAt` SHALL 严格互异（第 i 条取 `Date.now() + i`），保证 `load_inbox_by_date` / `edit` / `delete` / `archive` 经 `time_hint` 首个匹配不塌缩到同一实块。批量写入 SHALL 采用失败降级链：`append_inbox_batch` → 逐条 `append_inbox` → localStorage `clairis_capture_fallback`。空的切分结果（全空 / 全空行）SHALL 不触发任何写入。

#### Scenario: 多行混合 prefix 一次批量提交

- **WHEN** 用户在草稿区输入多行混合 prefix 内容（如 `. 问题一`、`- 待办一`、续行、`! 灵感`）并按 `Cmd+Enter` 提交
- **THEN** 草稿 SHALL 按行切分为多条条目，每条 `prefix` 与 `content` 正确，且全部条目 SHALL 一次批量写入当日 inbox

#### Scenario: 无前缀续行归并

- **WHEN** 某前缀行之后紧跟无前缀的非空续行
- **THEN** 续行 SHALL 并入当前条目，`content` 以 `\n` 连接，而非另起一条

#### Scenario: 空行硬分隔并清空 prefix

- **WHEN** 两条前缀条目之间出现空行
- **THEN** 空行 SHALL 结束当前条目并清除粘性 prefix，后续行 SHALL 开启新条目

#### Scenario: 批内 capturedAt 唯一性

- **WHEN** 一次批量提交包含多条条目
- **THEN** 批内每条 `capturedAt` SHALL 严格互不相同，`load_inbox_by_date` / `edit` / `delete` / `archive` 经 `time_hint` 首个匹配 SHALL 定位到各自独立实块

#### Scenario: 批量写入失败降级

- **WHEN** `append_inbox_batch` 写入失败
- **THEN** 应用 SHALL 依次降级为逐条 `append_inbox`，仍失败则写入 localStorage `clairis_capture_fallback`，保证数据不丢失

#### Scenario: 空切分结果不写入

- **WHEN** 草稿内容全为空或全为空行时用户提交
- **THEN** 应用 SHALL 不触发任何写入，不产生任何条目