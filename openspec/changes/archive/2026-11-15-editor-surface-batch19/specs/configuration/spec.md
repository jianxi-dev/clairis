## MODIFIED Requirements

### Requirement: CF-6 阅读设置归属与设置窗自适应

字号、行宽、配色 SHALL 仅在设置场景提供入口，SHALL NOT 在正文右上角常驻浮层。设置场景 SHALL 在窄窗口内可纵向滚动且不越出视口；阅读空间的布局/密度/卡片高度 SHALL 保留在设置中。「沉浸」SHALL 作为阅读模式的唯一用户可见名称。

设置中 SHALL 提供「左边栏固定隐藏」开关，写入 `rail_pin_hidden` 并即时生效；标题逐级字体（H1–H6）的选择入口 SHALL 位于设置场景内。

#### Scenario: 正文无设置浮层
- **WHEN** 用户打开 Markdown 阅读态
- **THEN** 正文右上角 SHALL NOT 显示字号/行宽/配色浮层

#### Scenario: 设置窗自适应
- **WHEN** 应用窗口高度小于设置内容高度
- **THEN** 设置内容区 SHALL 可滚动，底部内容 SHALL 可到达且不越出窗口

#### Scenario: 沉浸命名
- **WHEN** 用户查看顶栏阅读入口
- **THEN** 按钮文案 SHALL 为「沉浸」

#### Scenario: 左边栏固定隐藏开关
- **WHEN** 用户在设置中切换「左边栏固定隐藏」开关
- **THEN** 配置 `rail_pin_hidden` SHALL 写入并持久化，左边栏行为 SHALL 即时变化

#### Scenario: 标题字体设置入口
- **WHEN** 用户打开设置场景
- **THEN** SHALL 存在 H1–H6 逐级字体选择入口

## ADDED Requirements

### Requirement: 标题字体逐级配置

系统 SHALL 支持为每一级标题（H1–H6）配置字体，字体从本机已安装字体中选择。配置字段为 `heading_fonts`（按级别键控），SHALL 持久化并在重启后生效。未配置时 SHALL 回落到 md-bundle 预览态字体（`--type-font-sans`）。非法字体值 SHALL 被拒绝并回落到默认值。该配置 SHALL 同时作用于编辑态与预览态的标题面，SHALL NOT 改变正文与代码字体。

#### Scenario: 逐级配置持久化

- **WHEN** 用户为 H1 选择字体 A 并保存设置
- **THEN** 配置 `heading_fonts` SHALL 含 H1 键且值为字体 A，重启后仍生效

#### Scenario: 默认回落

- **WHEN** 用户未配置任何标题字体
- **THEN** H1–H6 计算 `font-family` SHALL 等于 `--type-font-sans`

#### Scenario: 非法值拒绝

- **WHEN** 配置写入一个系统不可用 / 为空的字体值
- **THEN** 该校验 SHALL 拒绝并回落到默认值
