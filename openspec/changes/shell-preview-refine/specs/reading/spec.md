## MODIFIED Requirements

### Requirement: 文本与脚本预览语法

预览态对纯文本 / 脚本（代码）文件 SHALL 显示语法颜色与代码块缩进格式，SHALL NOT 以无差别纯文本回退。语法颜色 SHALL 复用既有代码高亮 token 与语言别名表；代码块前导缩进 SHALL 保留。**预览态对纯文本 / 脚本文件 SHALL 显示行号列**：每个可见行 SHALL 对应一个行号；行号的字体族与颜色 token SHALL 复用编辑态口径，行号与分隔线之间 SHALL 保留非零间隙（取设计系统小刻度）。Markdown 预览 SHALL NOT 引入行号列。**整文件预览分支 SHALL 按文件扩展名查 LANGUAGES 表**：命中语言的扩展名 SHALL 渲染语法颜色，未命中的扩展名 SHALL 回退纯文本，SHALL NOT 新写高亮器。

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

#### Scenario: 整文件预览扩展名查表

- **WHEN** 用户以预览态打开一个 `.js` 文件
- **THEN** 预览分支 SHALL 按扩展名 `js` 查 LANGUAGES 表并渲染语法颜色

- **AND WHEN** 用户以预览态打开一个 `.unknownext` 文件
- **THEN** 预览分支 SHALL 回退纯文本渲染，SHALL NOT 渲染语法颜色
