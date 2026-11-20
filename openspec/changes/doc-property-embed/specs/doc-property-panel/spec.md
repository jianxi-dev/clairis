# doc-property-panel（delta）

## MODIFIED Requirements

### Requirement: P-1 面板落位与三模式

含 frontmatter 的文档中，文档属性块 SHALL 作为**正文流首块**渲染：位于正文标题之前、随文档内容滚动，SHALL NOT 固定在滚动容器之外。编辑态 SHALL 以「替换 frontmatter 源码块的块级 widget」承载（高度须计入编辑器坐标映射）；无 frontmatter 的文档 MAY 维持内容区上方的固定宿主（添加首个字段后转为嵌入形态）。预览态 SHALL 渲染在预览内容流顶部；源码模式 SHALL NOT 渲染。预览态面板 SHALL 只读（禁用全部编辑交互）；编辑态默认展开、可折叠；面板显隐切换 SHALL NOT 修改文档内容（隐藏 ≠ 删除）。三模式切换 SHALL 使用 CSS display 切换，SHALL NOT 重建面板状态（不 remount）。属性块宽度 SHALL 对齐正文测量宽（`--type-measure`）。**面板可见且处于编辑态时，正文 SHALL 隐藏 frontmatter 源码块**：面板展开态用 CodeMirror decoration 隐藏整个 `--- ... ---` 块；面板折叠态显示一行摘要占位（如「文档属性 · N 个字段」）而不显示完整 YAML；`⌘⇧Y` 隐藏面板后 SHALL 恢复显示完整源码块。隐藏装饰 SHALL NOT 吞掉光标或选区，SHALL NOT 影响 undo 栈；源码态（YAML 必须完整可编辑）SHALL NOT 启用隐藏。

#### Scenario: 预览态只读

- **WHEN** 用户在预览态查看含 frontmatter 的文档
- **THEN** 属性面板完整展示字段与标签，所有编辑入口（值编辑、改名、类型菜单、行操作、增删字段）SHALL 不可用

#### Scenario: 源码态不渲染且数据不丢

- **WHEN** 用户切换到源码模式
- **THEN** 面板不渲染，frontmatter 以原始 YAML 文本呈现，切回编辑/预览后面板数据与选中状态恢复一致

#### Scenario: 面板可见时编辑态隐藏前言块

- **WHEN** 编辑态面板展开，文档含 frontmatter
- **THEN** 正文顶部不再出现 `--- ... ---` 源码块（被 decoration 隐藏）；光标移入正文首段后落位正确，Ctrl+Z 撤销前面板编辑不串位

#### Scenario: 折叠态摘要与隐藏态恢复

- **WHEN** 用户折叠面板再展开、或按 `⌘⇧Y` 隐藏面板
- **THEN** 折叠态正文仅显示一行「文档属性 · N 个字段」摘要；隐藏态恢复显示完整 `--- ... ---` 源码块

#### Scenario: 嵌入正文流首块

- **WHEN** 编辑态或预览态打开含 frontmatter 的文档
- **THEN** 属性块位于正文标题之前、作为内容第一个块呈现；源码态不出现该块

#### Scenario: 块随文档滚动

- **WHEN** 用户向下滚动正文
- **THEN** 属性块随内容一起移出视口，SHALL NOT 悬浮固定在内容区上方

#### Scenario: 块宽度对齐正文测量宽

- **WHEN** 属性块以 A 一行条或 B 精排双列任一形态呈现
- **THEN** 块宽度与正文段落测量宽一致（取 `--type-measure`），窄窗下不横向溢出
