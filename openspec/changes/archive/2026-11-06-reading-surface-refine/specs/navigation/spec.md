## ADDED Requirements

### Requirement: N-1 本机最近文件自动发现

阅读空间 SHALL 在无用户选择的情况下自动展示本机最近文档，按文件修改时间倒序；来源 SHALL 限于用户主目录下常见文档目录与受支持扩展名。每条 SHALL 显示类型图标、文件名、父文件夹名与相对时间；SHALL NOT 显示完整路径 tooltip。点击父文件夹 SHALL 调用系统文件管理器打开该目录。

#### Scenario: 启动即显示最近文件
- **WHEN** 用户启动应用且本机存在最近文档
- **THEN** 阅读空间 SHALL 自动列出最近文档，按修改时间倒序，无需用户先打开文件

#### Scenario: 父文件夹可打开
- **WHEN** 用户点击某条目的父文件夹名
- **THEN** 系统文件管理器 SHALL 打开该文件所在目录

### Requirement: N-2 阅读空间预览触发区与列表回顶

阅读空间条目的悬浮预览 SHALL 仅在指针位于条目右半区时触发；指针位于左半区 SHALL NOT 打开预览。点击阅读空间三点菜单中的布局/密度/筛选项后，列表 SHALL 自动滚动回顶部。

#### Scenario: 左半区不触发
- **WHEN** 指针进入某条目的左半区
- **THEN** 悬浮预览 SHALL 保持关闭

#### Scenario: 右半区触发
- **WHEN** 指针进入某条目的右半区并停留 250ms
- **THEN** 悬浮预览 SHALL 打开并锚定到该条目

#### Scenario: 菜单切换后回顶
- **WHEN** 用户从阅读空间三点菜单切换布局或密度
- **THEN** 列表 SHALL 滚动到顶部

### Requirement: N-3 本机标题与正文检索

阅读空间搜索 SHALL 支持本机文件检索，范围包含文件名、frontmatter title、H1 与正文全文；SHALL 支持按文件类型与修改时间筛选。检索 SHALL NOT 改变当前打开文档或分栏结构。

#### Scenario: 正文命中
- **WHEN** 用户在本机检索框输入只出现在某文件正文中的词
- **THEN** 结果 SHALL 包含该文件并高亮命中片段

#### Scenario: 类型筛选
- **WHEN** 用户选择「Markdown」类型筛选
- **THEN** 结果 SHALL 只包含 Markdown 文件
