# doc-property-panel（delta）

## MODIFIED Requirements

### Requirement: P-1 面板落位与三模式

含 frontmatter 的文档中，文档属性块 SHALL 作为**正文流首块**渲染：位于正文标题之前、随文档内容滚动，SHALL NOT 固定在滚动容器之外。编辑态 SHALL 以「替换 frontmatter 源码块的块级 widget」承载（高度须计入编辑器坐标映射）；无 frontmatter 的文档 MAY 维持内容区上方的固定宿主（添加首个字段后转为嵌入形态）；**含 frontmatter 的文档在编辑态 SHALL NOT 使用固定宿主**（展开与折叠均嵌入正文流）。预览态 SHALL 渲染在预览内容流顶部；源码模式 SHALL NOT 渲染。预览态面板 SHALL 只读（禁用全部编辑交互）；编辑态默认展开、可折叠；面板显隐切换 SHALL NOT 修改文档内容（隐藏 ≠ 删除）。三模式切换 SHALL 使用 CSS display 切换，SHALL NOT 重建面板状态（不 remount）。属性块宽度 SHALL 对齐正文测量宽（`--type-measure`），且与正文段落同列轴心；属性块下方 SHALL 与正文首块保持约一个正文行高的间距（编辑嵌入态与预览态一致），SHALL NOT 与标题紧贴；**该间距 SHALL 由属性块自身的布局间距（margin）提供，SHALL NOT 依赖正文空行**（空行可被编辑删除而失效）。**面板可见且处于编辑态时，正文 SHALL 隐藏 frontmatter 源码块**：面板展开态与折叠态均 SHALL 由「替换 frontmatter 源码块的块级 widget」承载——展开态为完整属性卡片，折叠态为同一位置呈现的**折叠条**（含「展开 / 添加字段 / 模板 / 全选」操作，随正文流滚动），SHALL NOT 在正文另行渲染「文档属性 · N 个字段」摘要标签（SHALL NOT 以按钮或虚线标签形式出现）；`⌘⇧Y` 隐藏面板后 SHALL 恢复显示完整源码块。隐藏装饰 SHALL NOT 吞掉光标或选区，SHALL NOT 影响 undo 栈；源码态（YAML 必须完整可编辑）SHALL NOT 启用隐藏。

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

> 场景标题沿用旧名以保持条款可追溯；自本 change 起折叠态改为正文流内折叠条，正文不再渲染摘要标签。

- **WHEN** 用户折叠面板
- **THEN** 正文流内（原 frontmatter 位置）呈现折叠条（「展开 / 添加字段 / 模板 / 全选」），SHALL NOT 出现「文档属性 · N 个字段」虚线标签或按钮；点击「展开」回到完整卡片

- **WHEN** 用户按 `⌘⇧Y` 隐藏面板
- **THEN** 正文恢复显示完整 `--- ... ---` 源码块，任何形式的属性块 SHALL NOT 渲染

#### Scenario: 嵌入正文流首块

- **WHEN** 编辑态或预览态打开含 frontmatter 的文档
- **THEN** 属性块位于正文标题之前、作为内容第一个块呈现；源码态不出现该块

#### Scenario: 块随文档滚动

- **WHEN** 用户向下滚动正文
- **THEN** 属性块随内容一起移出视口，SHALL NOT 悬浮固定在内容区上方

#### Scenario: 块宽度对齐正文测量宽

- **WHEN** 属性块以 A 一行条或 B 精排双列任一形态呈现
- **THEN** 块宽度与正文段落测量宽一致（取 `--type-measure`），窄窗下不横向溢出

#### Scenario: 折叠条嵌入正文流

- **WHEN** 编辑态面板折叠，文档含 frontmatter
- **THEN** 折叠条位于正文流首块位置并随正文滚动，SHALL NOT 悬浮固定在滚动容器之外

#### Scenario: 属性块与标题间距

- **WHEN** 编辑态（展开卡片或折叠条）或预览态属性块下方紧跟正文标题
- **THEN** 两者之间 SHALL 保持约一个正文行高的间距，且该间距来自属性块的布局间距——删除正文中的任何空行 SHALL NOT 使间距消失
