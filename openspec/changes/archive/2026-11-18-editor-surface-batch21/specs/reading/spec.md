## MODIFIED Requirements

### Requirement: 文本与脚本预览语法

预览态对纯文本 / 脚本（代码）文件 SHALL 显示语法颜色与代码块缩进格式，SHALL NOT 以无差别纯文本回退。语法颜色 SHALL 复用既有代码高亮 token 与语言别名表；代码块前导缩进 SHALL 保留。**预览态对纯文本 / 脚本文件 SHALL 显示行号列**：每个可见行 SHALL 对应一个行号；行号的字体族与颜色 token SHALL 复用编辑态口径，行号与分隔线之间 SHALL 保留非零间隙（取设计系统小刻度）。Markdown 预览 SHALL NOT 引入行号列。

#### Scenario: 语法颜色

- **WHEN** 用户预览一个 `.js` / `.py` 等脚本文件
- **THEN** 代码 token 节点（`.tok-*`）数 SHALL ≥1

#### Scenario: 缩进保留

- **WHEN** 用户预览含缩进的代码块
- **THEN** 前导空白 SHALL 保留，行首缩进不丢失

#### Scenario: 预览态行号列

- **WHEN** 用户以预览态打开一个 `.txt` 或 `.js` 文件
- **THEN** 行号槽节点数 SHALL ≥1，且每个可见行对应一个行号

#### Scenario: 行号样式与间隙

- **WHEN** 用户查看预览态文本文件的行号
- **THEN** 行号计算 `font-family` 与颜色 SHALL 等于编辑态口径；行号与分隔线之间的水平间距 SHALL 大于 0

#### Scenario: Markdown 预览无行号

- **WHEN** 用户以预览态打开一个 `.md` 文件
- **THEN** 行号槽节点数 SHALL 为 0

## ADDED Requirements

### Requirement: 预览态选区工具条

预览态选中文字后出现的工具条，其横向位置 SHALL 取**鼠标落点优先、否则选区中心**：存在鼠标落点时，工具条水平中心 SHALL 对齐鼠标落点 x（容差取设计系统小刻度）；无鼠标落点（如键盘/脚本选区）时回落到选区中心。工具条 SHALL 做**视口左右边界钳制**，整体包围盒 SHALL 完整落在视口内，SHALL NOT 越出左右边缘；纵向 SHALL 保持在选区上方。工具条内容与既有编辑态选区动作保持一致。

#### Scenario: 工具条对齐鼠标落点

- **WHEN** 用户在预览态用鼠标选中文字
- **THEN** 工具条水平中心与鼠标落点 x 的偏差 SHALL ≤4px

#### Scenario: 视口钳制

- **WHEN** 选区靠近视口右缘
- **THEN** 工具条右缘 SHALL ≤ 视口宽度，左缘 SHALL ≥ 0

#### Scenario: 纵向在选区上方

- **WHEN** 用户选中文字并唤出工具条
- **THEN** 工具条下缘 SHALL 位于选区上缘之上

#### Scenario: 无鼠标落点回落选区中心

- **WHEN** 选区由键盘触发（无鼠标落点）
- **THEN** 工具条水平中心 SHALL 对齐选区中心 x
