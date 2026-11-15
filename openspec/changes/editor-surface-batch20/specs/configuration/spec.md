## MODIFIED Requirements

### Requirement: 标题字体逐级配置

系统 SHALL 支持为每一级标题（H1–H6）配置字体，字体从本机已安装字体中选择。配置字段为 `heading_fonts`（按级别键控），SHALL 持久化并在重启后生效。未配置时 SHALL 回落到 md-bundle 预览态字体（`--type-font-sans`）。非法字体值 SHALL 被拒绝并回落到默认值。该配置 SHALL 同时作用于编辑态与预览态的标题面，SHALL NOT 改变正文与代码字体。

字体输入 SHALL 显示当前生效字体（含默认字体），SHALL NOT 显示为空。可选项 SHALL 由本机已安装字体与一组预置的中英开源字体构成；SHALL NOT 预置各国专有字体。

#### Scenario: 逐级配置持久化

- **WHEN** 用户为 H1 选择字体 A 并保存设置
- **THEN** 配置 `heading_fonts` SHALL 含 H1 键且值为字体 A，重启后仍生效

#### Scenario: 默认回落

- **WHEN** 用户未配置任何标题字体
- **THEN** H1–H6 计算 `font-family` SHALL 等于 `--type-font-sans`

#### Scenario: 非法值拒绝

- **WHEN** 配置写入一个系统不可用 / 为空的字体值
- **THEN** 该校验 SHALL 拒绝并回落到默认值

#### Scenario: 显示当前字体

- **WHEN** 用户打开标题字体设置且未配置任何字体
- **THEN** 字体输入 SHALL 显示当前生效的默认字体值，SHALL NOT 为空

#### Scenario: 预设不含国家专有字体

- **WHEN** 用户查看字体预设列表
- **THEN** 列表 SHALL 由本机字体与预置中英开源字体构成，SHALL NOT 含各国专有字体硬编码项
