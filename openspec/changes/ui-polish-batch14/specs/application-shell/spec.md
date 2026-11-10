# application-shell（delta）— ui-polish-batch14

## ADDED Requirements

### Requirement: 编辑历史快捷键

系统 SHALL 在 macOS 支持 `cmd+[` 后退、`cmd+]` 前进，走当前编辑器历史；输入框聚焦时不劫持。

#### Scenario: 后退与前进

- **WHEN** 用户在编辑器输入后按 `cmd+[`，再按 `cmd+]`
- **THEN** 内容先回退再前进（A-5.1–A-5.2）

### Requirement: 悬浮小窗编辑态为富文本

系统 SHALL 在悬浮小窗切到编辑态时以富文本渲染，不显示 Markdown 源码标记。

#### Scenario: 小窗编辑态

- **WHEN** 用户把悬浮小窗切到编辑态
- **THEN** 正文不出现 `**`/`##` 源码片段（A-6.1）

### Requirement: 弹窗以按钮图标中心对齐

系统 SHALL 让按钮弹窗的中心对齐触发按钮图标中心；贴边时按最短路径夹取并保持完整可见。

#### Scenario: 对齐与贴边

- **WHEN** 用户打开格头菜单或右键菜单，或触发按钮贴近视口边缘
- **THEN** 弹窗中心与图标中心水平偏差不超过 2px，且弹窗完整可见（A-9.1–A-9.2）
