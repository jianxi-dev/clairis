## ADDED Requirements

### Requirement: X-1 数据文件扩展点

系统 SHALL 从 `~/.config/clairis/snippets/*.md` 与 `~/.config/clairis/templates/*.md` 读取用户扩展，且 SHALL NOT 执行其中的任何代码。snippets SHALL 以 frontmatter 声明的 `id`/`label`/`keywords` 出现在斜杠菜单中，插入 SHALL 为单事务且可撤销；templates SHALL 以文件名作为模板名，并支持 `{{date}}` 与 `{{title}}` 两个占位符。单个文件格式非法 SHALL 只跳过该文件并记录原因，不得影响其它文件或启动。

#### Scenario: 放入 snippet 即可用

- **WHEN** 用户把带 `id/label` frontmatter 的 Markdown 放进 `~/.config/clairis/snippets/`
- **THEN** 斜杠菜单 SHALL 出现该命令，插入后源码等于文件正文，其余行逐字节不变

#### Scenario: 非法文件隔离

- **WHEN** 同一目录里有一个缺少 `id` 的文件
- **THEN** 该文件 SHALL 被跳过并在设置里列出原因，其它扩展 SHALL 正常可用

#### Scenario: 模板占位替换

- **WHEN** 用户选择名为 `周报` 的模板新建文件 `2026-11-02.md`
- **THEN** `{{title}}` SHALL 替换为 `2026-11-02`，`{{date}}` SHALL 替换为当天日期，未知占位符原样保留

### Requirement: X-2 主题 token 覆盖

系统 SHALL 支持 `~/.config/clairis/theme.toml` 覆盖内置设计 token；只接受已声明的 `--app-*` 名与合法颜色值，未知键或非法值 SHALL 被忽略并聚合为一条告警，不得导致样式崩溃或应用启动失败。

#### Scenario: 合法覆盖生效

- **WHEN** `theme.toml` 写入 `accent = "#c2410c"`
- **THEN** 界面的 `--app-accent` SHALL 生效，内置 CSS 文件不被修改

#### Scenario: 非法值被忽略

- **WHEN** `theme.toml` 写入 `accent = "url(http://evil)"` 或未声明的键
- **THEN** 该键 SHALL 被忽略，其余合法键仍生效，并产生一条聚合告警

### Requirement: X-3 核心能力开关

系统 SHALL 为内置能力提供幂等的 `enable()/disable()`，默认全开，入口位于设置深处，不出现常驻 UI、弹窗或红点。关闭能力 SHALL 移除其扩展与监听，但 SHALL NOT 删除用户数据。

#### Scenario: 关闭再打开

- **WHEN** 用户关闭「图表水合」后再打开
- **THEN** 关闭后图不再渲染、源码仍可见；重新打开后恢复渲染，且不出现重复监听或重复 DOM

#### Scenario: 默认全开

- **WHEN** 用户首次安装并未进入设置
- **THEN** 所有内置能力 SHALL 处于开启状态，界面上 SHALL NOT 出现任何常驻开关入口
