## MODIFIED Requirements

### Requirement: 标题字体逐级配置

系统 SHALL 支持为每一级标题（H1–H6）配置字体，字体从本机已安装字体中选择。配置字段为 `heading_fonts`（按级别键控），SHALL 持久化并在重启后生效。未配置时 SHALL 回落到 md-bundle 预览态字体（`--type-font-sans`）。非法字体值 SHALL 被拒绝并回落到默认值。该配置 SHALL 同时作用于编辑态与预览态的标题面，SHALL NOT 改变正文与代码字体。**设置面板 SHALL 在加载时通过原生命令枚举本机已安装字体族并填充候选列表**；枚举失败时 SHALL 降级为可手输并给出提示。

#### Scenario: 逐级配置持久化

- **WHEN** 用户为 H1 选择字体 A 并保存设置
- **THEN** 配置 `heading_fonts` SHALL 含 H1 键且值为字体 A，重启后仍生效

#### Scenario: 默认回落

- **WHEN** 用户未配置任何标题字体
- **THEN** H1–H6 计算 `font-family` SHALL 等于 `--type-font-sans`

#### Scenario: 非法值拒绝

- **WHEN** 配置写入一个系统不可用 / 为空的字体值
- **THEN** 该校验 SHALL 拒绝并回落到默认值

#### Scenario: 本机字体候选列表

- **WHEN** 用户打开设置场景并加载标题字体设置
- **THEN** 候选列表 SHALL 非空，其内容 SHALL 来自原生枚举命令返回的本机已安装字体族，SHALL NOT 是写死的常量数组

#### Scenario: 枚举失败降级手输

- **WHEN** 原生字体枚举命令返回失败或空数组
- **THEN** 设置面板 SHALL 降级为可手输，SHALL 显示枚举失败提示，手输合法字体值 SHALL 仍可保存并生效
