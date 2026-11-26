## ADDED Requirements

### Requirement: DS-9 阅读预设面

系统 SHALL 提供数据面 `reader-presets`：默认集合为三套预设（紧凑 / 标准 / 宽屏），项形状为 `{id, label, fontSize, width, skin}`。有效集合 SHALL 为「默认 ← 用户覆盖」合并结果（list 型整体替换）；`fontSize` SHALL 在 8–96、`width` SHALL 在 480–1400（步长 20）、`skin` SHALL ∈ {paper, indigo, moss, clay}；不满足的项 SHALL 被过滤并聚合为一条告警；覆盖为空或全部非法 SHALL 回落默认。设置页 SHALL 提供「阅读预设」入口，点选 SHALL 将三项配置一并应用并持久化。AI 的 `read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` SHALL 对该面可用。

#### Scenario: 默认三套预设可应用

- **WHEN** 应用首次启动且无用户覆盖
- **THEN** 有效集合 SHALL 恰为 3 项（紧凑 15/960/paper、标准 17/1080/paper、宽屏 19/1280/paper），设置页按钮文案与顺序一致

#### Scenario: 点选预设应用三项配置

- **WHEN** 用户在设置页点击「宽屏」
- **THEN** `readerFontSize` SHALL 变为 19、`readerWidth` SHALL 变为 1280、`readerSkin` SHALL 变为 paper，且三项 SHALL 被持久化到 `user/settings.json`

#### Scenario: 预设改名与越界过滤

- **WHEN** 用户覆盖把「宽屏」`label` 改为「超宽」并把另一项 `fontSize` 写成 120
- **THEN** 按钮文案 SHALL 显示「超宽」；`fontSize=120` 的预设 SHALL 被过滤，告警恰 1 条含该项 id，其余预设可用

#### Scenario: 恢复默认与回滚

- **WHEN** 对 `reader-presets` 调用 `patch_data_surface {"items": null}`
- **THEN** 用户覆盖 SHALL 被删除，有效集合回落三套默认，且可用 `restore_surface_snapshot` 回到重置前的覆盖
