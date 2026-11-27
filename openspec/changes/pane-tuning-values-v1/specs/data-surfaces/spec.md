## ADDED Requirements

### Requirement: DS-10 关爱缩放面（care-scale）

系统 SHALL 提供数据面 `care-scale`：默认集合为三档（小 0.9 / 中 1.0 / 大 1.2，标签 小/中/大），项形状为 `{id, label, scale}`。有效集合 SHALL 为「默认 ← 用户覆盖」按 id 并入结果；`scale` SHALL 在 [0.8, 1.5]，步长 0.05（非步长值先归整到最近步长再校验，与 `reader-presets` 的 `width` 语义一致）；不满足的项 SHALL 被过滤并聚合为一条告警；覆盖为空或全部非法 SHALL 回落默认。允许新增自定义 id（须自带完整字段）。配置键 `paneScale` SHALL 只存选中的 id（既有存储值本就是 id，零迁移）。消费端 SHALL 从面解析选中项并把 `--pane-scale-factor` 写到 `<html>`（缺省/非法 → 1），#1606 的 zoom 白名单块 SHALL 改用 `zoom: var(--pane-scale-factor, 1)` 且仅在 factor ≠ 1 时施加；白名单容器清单 SHALL 保持不变。AI 的 `read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` SHALL 对该面可用。

#### Scenario: 默认三档可应用

- **WHEN** 应用首次启动且无用户覆盖
- **THEN** 有效集合 SHALL 恰为 3 项（小 0.9 / 中 1.0 / 大 1.2），默认选中 medium，界面与改动前逐像素一致

#### Scenario: 非步长值归整后校验

- **WHEN** 用户覆盖把某档 `scale` 写成 1.27
- **THEN** 归整后 `scale` SHALL 为 1.25 并生效；写成 1.28 时 SHALL 为 1.30

#### Scenario: 越界过滤与告警

- **WHEN** 用户覆盖含 `scale = 1.6` 或 `scale = 0.7`
- **THEN** 该项 SHALL 被过滤并产生一条聚合告警，其余合法档 SHALL 正常生效

#### Scenario: 消费端 CSS 变量

- **WHEN** 选中项 `scale` 为 1.3
- **THEN** `<html>` 的 `--pane-scale-factor` SHALL 为 1.3，`data-pane-scale-active` SHALL 为 `true`，白名单容器的计算 `zoom` SHALL 为 1.3
- **AND WHEN** 选中项为 medium（1.0）或非法
- **THEN** `--pane-scale-factor` SHALL 为 1，`data-pane-scale-active` SHALL NOT 为 `true`

#### Scenario: 恢复默认与回滚

- **WHEN** 对 `care-scale` 调用 `patch_data_surface {"items": null}`
- **THEN** 用户覆盖 SHALL 被删除，有效集合回落三档默认，且可用 `restore_surface_snapshot` 回到重置前的覆盖

### Requirement: DS-11 窗格模式面（pane-modes）

系统 SHALL 提供数据面 `pane-modes`：默认集合为三档，项形状为 `{id, label, hotzonePx, revealMs, hintLinePx}`，默认 simple `{16, 0, 0}` / standard `{16, 0, 0}` / hardcore `{0, 3000, 1}`。有效集合 SHALL 为「默认 ← 用户覆盖」按 id 并入结果；`hotzonePx` SHALL 在 [12, 24]；`revealMs` SHALL 在 [1000, 10000]，0 表示不自动显现且 SHALL 仅对非 hardcore 行允许；`hintLinePx` SHALL 在 [0, 2]；不满足的项 SHALL 被过滤并聚合为一条告警；覆盖为空或全部非法 SHALL 回落默认。允许新增自定义 id（须自带完整字段）。配置键 `paneMode` SHALL 只存选中的 id（既有存储值本就是 id，零迁移）。消费端 SHALL 把热区高度与提示线厚度改为 CSS 变量 `--pane-hotzone-px` / `--pane-hint-px`（由既有 `.status-hotzone` / 顶部 peek / 提示线规则消费），hardcore 临时显现计时器 SHALL 读选中项的 `revealMs`。`readingMode` 优先级、`Cmd+Shift+U` 语义与瞬态浮层排除 SHALL 不变。AI 的 `read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` SHALL 对该面可用。

#### Scenario: 默认三档与今天一致

- **WHEN** 应用首次启动且无用户覆盖
- **THEN** 有效集合 SHALL 恰为 3 项（simple/standard/hardcore 参数如上），默认选中 standard，chrome 显隐行为与改动前一致

#### Scenario: 参数边界校验

- **WHEN** 用户覆盖含 `hotzonePx = 8`、`revealMs = 500` 或 `hintLinePx = 3`
- **THEN** 该项 SHALL 被过滤并产生一条聚合告警，其余合法档 SHALL 正常生效

#### Scenario: hardcore 行 revealMs=0 被拒

- **WHEN** 用户覆盖把 hardcore 行 `revealMs` 写成 0
- **THEN** 该项 SHALL 被过滤并告警（0 仅允许非 hardcore 行）

#### Scenario: 消费端变量与计时器

- **WHEN** 选中项 `hotzonePx` 为 20、`hintLinePx` 为 2、`revealMs` 为 5000
- **THEN** `.status-hotzone` 与顶部 peek 的计算高度 SHALL 为 20px，提示线计算厚度 SHALL 为 2px，hardcore 临时显现 SHALL 在 5000ms 后收起

#### Scenario: 恢复默认与回滚

- **WHEN** 对 `pane-modes` 调用 `patch_data_surface {"items": null}`
- **THEN** 用户覆盖 SHALL 被删除，有效集合回落三档默认，且可用 `restore_surface_snapshot` 回到重置前的覆盖
