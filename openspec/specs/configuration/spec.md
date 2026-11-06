# configuration Specification

## Purpose
TBD - created by archiving change text-config-layer. Update Purpose after archive.
## Requirements
### Requirement: CF-1 配置三层与合并

配置 SHALL 分为三层：`defaults/settings.json`（只读默认）、`user/settings.json`（用户与 AI 可写）、`state/state.json`（派生状态）。应用加载的**有效配置** SHALL 为 defaults 与 user 的深合并（user 同名键覆盖 defaults），`recentFiles` 与 `scrollPositions` SHALL 只来自 state 层。对外暴露的 `AppConfig` JSON 结构 SHALL 保持不变。

#### Scenario: user 覆盖 defaults

- **WHEN** defaults 的 `theme` 为 `light`，user 的 `theme` 为 `dark`
- **THEN** 有效配置的 `theme` SHALL 为 `dark`

#### Scenario: 派生状态不写进 user 层

- **WHEN** 应用保存一次配置
- **THEN** `user/settings.json` SHALL NOT 含 `recentFiles` 或 `scrollPositions`

### Requirement: CF-2 原子写与失败不变

保存配置 SHALL 先写同目录临时文件再原子 rename 到目标路径。任何一步失败 SHALL 保留写入前的原文件，不得留下截断或半截 JSON。

#### Scenario: 写入失败保留旧文件

- **WHEN** 原子写在中途失败
- **THEN** `user/settings.json` 的内容 SHALL 与写入前逐字节一致

### Requirement: CF-3 快照与回滚

每次成功写入 user 配置前，应用 SHALL 先把当前 `user/settings.json` 复制进 `snapshots/`；快照 SHALL 只保留最近 10 份。应用 SHALL 提供列出快照与恢复快照的能力，恢复前 SHALL 先为当前状态创建一份快照。

#### Scenario: 保留十份

- **WHEN** 连续保存 12 次
- **THEN** `snapshots/` 下的快照 SHALL 恰好为 10 份，且为最新的 10 份

#### Scenario: 恢复前先快照

- **WHEN** 用户恢复到某个历史快照
- **THEN** 恢复前的当前内容 SHALL 作为一份新快照存在，可再次恢复

### Requirement: CF-4 校验失败拒绝写入

保存配置前 SHALL 校验：字号 8–96、阅读宽度 480–2400、侧栏宽度 0–800、分栏比例 0–1、主题属于 `light|dark|warm|system`、皮肤属于 `paper|plain`。任一非法 SHALL 返回校验错误且不写盘。

#### Scenario: 非法字号不落盘

- **WHEN** 提交 `fontSize = 200`
- **THEN** 保存 SHALL 返回校验错误，`user/settings.json` SHALL 保持原内容

### Requirement: CF-5 外部改动热应用

`user/settings.json` 被外部进程修改后，应用 SHALL 在 1 秒内向前端发出一次配置变更事件；前端 SHALL 据此重载配置且不打断当前编辑。

#### Scenario: 外部改主题

- **WHEN** 应用运行中有人把 user 配置的 `theme` 改成 `dark`
- **THEN** 前端 SHALL 在 1 秒内收到 `config-changed` 并对新配置生效

### Requirement: C-6 阅读设置归属与设置窗自适应

字号、行宽、配色 SHALL 仅在设置场景提供入口，SHALL NOT 在正文右上角常驻浮层。设置场景 SHALL 在窄窗口内可纵向滚动且不越出视口；阅读空间的布局/密度/卡片高度 SHALL 保留在设置中。「沉浸」SHALL 作为阅读模式的唯一用户可见名称。

#### Scenario: 正文无设置浮层
- **WHEN** 用户打开 Markdown 阅读态
- **THEN** 正文右上角 SHALL NOT 显示字号/行宽/配色浮层

#### Scenario: 设置窗自适应
- **WHEN** 应用窗口高度小于设置内容高度
- **THEN** 设置内容区 SHALL 可滚动，底部内容 SHALL 可到达且不越出窗口

#### Scenario: 沉浸命名
- **WHEN** 用户查看顶栏阅读入口
- **THEN** 按钮文案 SHALL 为「沉浸」

