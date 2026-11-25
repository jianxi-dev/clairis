# data-surfaces Specification

## Purpose
TBD - created by archiving change data-surface-contract-v1. Update Purpose after archive.
## Requirements
### Requirement: DS-1 数据面默认源与有效集合

每个已登记数据面 SHALL 有唯一默认来源：仓库内 JSON 默认文件（构建内嵌，首次运行物化到 defaults 层）。面的有效集合 SHALL 为「默认 ← 用户覆盖」合并结果；用户覆盖中的未知 id SHALL 被过滤并聚合为一条告警；覆盖为空或全部非法 SHALL 回落默认。默认文件缺失或损坏时 SHALL 回落内嵌默认并 SHALL 能重建物化文件。本变更登记面为 `html-toolbar`（横向工具条按钮集合与顺序），默认集合内容与既有内置顺序一致。

#### Scenario: 默认文件物化

- **WHEN** 应用首次启动（defaults 层无该面文件）
- **THEN** `defaults/surfaces/html-toolbar.json` SHALL 被写入，内容与内嵌默认逐值一致

#### Scenario: 覆盖合并与未知 id 过滤

- **WHEN** 用户覆盖 `["format-bold","nope","format-italic"]`
- **THEN** 有效集合 SHALL 为 `["format-bold","format-italic"]`（默认剩余项不自动补回），且产生一条含 `nope` 的聚合告警

#### Scenario: 空覆盖回落默认

- **WHEN** 用户覆盖为空或不合法
- **THEN** 有效集合 SHALL 等于默认集合，SHALL NOT 出现空工具条

#### Scenario: 默认文件损坏回落内嵌

- **WHEN** 物化的默认文件被改坏（非法 JSON）
- **THEN** 有效集合 SHALL 回落内嵌默认，物化文件 SHALL 可重建

### Requirement: DS-2 面级加载与变更事件

应用 SHALL 提供 `load_surfaces` 命令，返回全部已登记面的有效集合与告警。已登记面的数据文件被外部修改后，应用 SHALL 在 1 秒内发出 `surfaces-changed(id)` 事件；该事件的消费端 SHALL 只重载对应面，SHALL NOT 触发全量配置重放（pane 布局、编辑器状态等 SHALL NOT 被触碰）。

#### Scenario: 外部修改即时生效

- **WHEN** 应用运行中外部进程修改已登记面文件
- **THEN** 前端 SHALL 在 1 秒内收到 `surfaces-changed`，对应面消费端 SHALL 呈现新有效集合

#### Scenario: 全量重放不被触发

- **WHEN** `surfaces-changed` 事件到达
- **THEN** pane 布局与编辑器 undo/选区状态 SHALL 保持不变（只重载对应面）

