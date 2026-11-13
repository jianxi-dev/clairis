## ADDED Requirements

### Requirement: EX-7 Markdown 打印

应用 SHALL 提供 Markdown 打印入口，调用系统打印对话框并加载打印专用样式表。打印版式 SHALL 为 A4 纵向、页边距 10mm、无页眉页脚；SHALL 隐藏应用外壳、页签、工具条与浮层。代码块、引用块、表格与图片 SHALL 避免跨页断裂，一级标题 SHALL 另起一页。

#### Scenario: 打印入口可用

- **WHEN** 用户在 Markdown 文档的导出菜单点击「打印」
- **THEN** `window.print` SHALL 被调用 1 次，且打印样式表已加载

#### Scenario: 外壳不打印

- **WHEN** 打印媒体生效
- **THEN** 顶栏、页签、工具条、浮层的计算 `display` SHALL 为 `none`

#### Scenario: 分页完整性

- **WHEN** 文档含表格、图片、代码块
- **THEN** 这些元素的计算 `break-inside` SHALL 为 `avoid`

#### Scenario: 纸张与边距

- **WHEN** 读取 `@page` 规则
- **THEN** 纸张 SHALL 为 A4 纵向，页边距 SHALL 为 10mm
