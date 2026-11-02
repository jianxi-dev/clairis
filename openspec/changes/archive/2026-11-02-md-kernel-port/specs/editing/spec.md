## ADDED Requirements

### Requirement: E-6 编辑内核与插入入口

编辑模式 SHALL 支持块级装饰（表格、分栏、高亮块、图片、链接、分割线、代码围栏、引用、列表、标题）、插入入口（斜杠菜单、空行「+」、块手柄占位）与智能输入（`# ` `- ` `> ` `1. ` `- [ ] ` 自动转换）。装饰层 SHALL 通过 CM6 扩展装配，模式切换 SHALL NOT remount EditorView。

所有操作 SHALL 满足两条红线：
1. **源码无损**：操作后 Markdown 只在目标处变化，其余字节不变。
2. **显示=源码**：被操作元素的可见文本 SHALL 严格等于其在源码中的值。

#### Scenario: 表格单元格编辑

- **WHEN** 用户点击单元格并把 `B2` 改成 `B2XYZ`
- **THEN** 源码 SHALL 只在该单元格变化，且单元格**可见文本** SHALL 立即为 `B2XYZ`（不需要再点别处）

#### Scenario: 斜杠插入

- **WHEN** 用户在空行输入 `/h1`
- **THEN** 当前行 SHALL 变为一级标题，源码为 `# `，其余行逐字节不变

#### Scenario: 取消无残留

- **WHEN** 用户打开斜杠菜单后点击外部或按 Esc
- **THEN** 菜单 SHALL 关闭，输入框 SHALL NOT 残留 `/`
