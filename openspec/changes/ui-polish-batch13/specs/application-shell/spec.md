# application-shell（delta）— ui-polish-batch13

## ADDED Requirements

### Requirement: 页签栏空白双击新建文档

系统 SHALL 在双击页签栏空白区域时新建一个 Markdown 页签（编辑态），不误触已有页签、按钮或输入控件。

#### Scenario: 双击空白

- **WHEN** 用户双击页签栏右侧空白处
- **THEN** 页签数加 1，新页签标题为「未命名」且 `data-mode` 为 `edit`（A-7.1–A-7.2）

### Requirement: 页面宽度上限单一真源

系统 SHALL 让设置页行宽滑块与状态栏页面宽度滑块使用同一上限，状态栏宽度提示不带操作括号说明。

#### Scenario: 两处上限一致

- **WHEN** 用户分别打开状态栏宽度弹层与设置页行宽控件
- **THEN** 两个滑块 `max` 均为 1400；状态栏按钮 title 为「页面宽度 1080px」（A-6.2–A-6.3）
