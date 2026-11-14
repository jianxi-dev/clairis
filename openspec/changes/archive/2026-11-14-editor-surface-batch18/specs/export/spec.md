## MODIFIED Requirements

### Requirement: EX-7 Markdown 打印

应用 SHALL 提供 Markdown 打印入口，位于文件右键菜单「导出」正下方的独立菜单项；导出二级项 SHALL NOT 含打印。打印 SHALL 始终按 Markdown 预览态输出：调用系统打印对话框前 SHALL 以同一 Markdown 渲染管线构造打印专用视图并完成 mermaid 绘制，打印内容 SHALL 与屏幕预览一致，SHALL NOT 输出编辑器源码或源码态文本。打印版式 SHALL 为 A4 纵向、页边距 10mm、无页眉页脚；SHALL 隐藏应用外壳、页签、工具条与浮层。代码块、引用块、表格、图片与 mermaid 图 SHALL 避免跨页断裂，一级标题 SHALL 另起一页。打印结束后 SHALL 移除打印视图并恢复打印前的编辑/预览模式与滚动位置。

#### Scenario: 打印入口可用

- **WHEN** 用户在文件右键菜单点击「打印」
- **THEN** `window.print` SHALL 被调用 1 次，打印视图 SHALL 已存在且其正文来自 Markdown 渲染结果（SHALL NOT 含编辑器源码行），打印样式表 SHALL 已加载

#### Scenario: 外壳不打印

- **WHEN** 打印媒体生效
- **THEN** 顶栏、页签、工具条、浮层的计算 `display` SHALL 为 `none`

#### Scenario: 分页完整性

- **WHEN** 文档含表格、图片、代码块
- **THEN** 这些元素的计算 `break-inside` SHALL 为 `avoid`

#### Scenario: 纸张与边距

- **WHEN** 读取 `@page` 规则
- **THEN** 纸张 SHALL 为 A4 纵向，页边距 SHALL 为 10mm

#### Scenario: mermaid 打印为图形

- **WHEN** 文档含 mermaid 块且用户触发打印
- **THEN** 打印视图中该位置 SHALL 存在绘制后的 `svg`，SHALL NOT 只剩空白容器或原始图源码

#### Scenario: 编辑态触发仍打印预览

- **WHEN** 当前格处于编辑或源码模式，用户触发打印
- **THEN** 打印视图 SHALL 使用 Markdown 预览排版，SHALL NOT 出现 CodeMirror 源码行

#### Scenario: 打印后恢复现场

- **WHEN** 打印流程结束
- **THEN** 打印专用视图 SHALL 被移除，格模式与滚动位置 SHALL 与打印前一致

