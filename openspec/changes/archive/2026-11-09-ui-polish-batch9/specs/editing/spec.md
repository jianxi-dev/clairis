## MODIFIED Requirements

### Requirement: E-10 编辑器大纲浮层

编辑模式与预览模式 SHALL 在内容区右上角提供大纲入口；入口按钮的右缘 SHALL 与栏目头右侧操作区（模式/全屏/更多/关闭）的右缘对齐，误差不超过 1px。大纲入口按钮 SHALL 为 28×28 的方形圆角图形：未钉住态 SHALL NOT 绘制边框，背景透明；钉住态 SHALL 显示 1px 细边框与强调色系背景。悬停 SHALL 展开浮层，点击按钮 SHALL 钉住，Esc 与点击浮层外部 SHALL 收起。浮层未钉住时 SHALL NOT 绘制边框；钉住态 SHALL 绘制 1px 细边框。浮层 SHALL 列出当前页签文档的全部 ATX 标题（`#`–`######`），SHALL 跳过围栏代码块内的行，并按层级缩进显示。文档不含任何 ATX 标题时 SHALL NOT 渲染大纲入口。

#### Scenario: 大纲按钮与栏目操作区右缘对齐

- **WHEN** 测量大纲入口按钮右缘与栏目头「更多操作」按钮右缘
- **THEN** 两者差值 SHALL ≤1px

#### Scenario: 未钉住无边框

- **WHEN** 大纲未钉住
- **THEN** 按钮计算 `border-width` SHALL 为 0px，浮层计算 `border-width` SHALL 为 0px

#### Scenario: 钉住细边框

- **WHEN** 用户点击大纲按钮钉住
- **THEN** 按钮与浮层的计算 `border-width` SHALL 均为 1px

### Requirement: E-12 标题折叠（MD 编辑态）

有下级内容的 ATX 标题 SHALL 在标题行首渲染一个可点击的折叠三角；三角图形 SHALL 为 20×20（原 10×10 的一倍），点击 SHALL 折叠/展开该标题到下一个同级或更高级标题之间的内容。

折叠三角默认 SHALL 隐藏（计算 `opacity` 为 0）；指针进入 `.cm-content` 左缘 25% 的块手柄召唤区时 SHALL 显示，指针离开召唤区后 SHALL 隐藏；三角自身悬停、键盘聚焦或已处于折叠态时 SHALL 始终显示。

折叠替换范围 SHALL 保留标题行末尾的换行符：替换起点为标题行末之后一个字符。多个相邻标题分别折叠后，每个标题 SHALL 仍占据独立行，SHALL NOT 合并为同一行。

#### Scenario: 三角尺寸与默认隐藏

- **WHEN** 指针位于正文右侧 75% 区域
- **THEN** 折叠三角的渲染宽高 SHALL 为 20×20，计算 `opacity` SHALL 为 0

#### Scenario: 召唤区显示

- **WHEN** 指针移入 `.cm-content` 左缘 25% 区域
- **THEN** 该区域所在标题的折叠三角计算 `opacity` SHALL 为 1

#### Scenario: 相邻折叠不合并

- **WHEN** 用户依次折叠四个相邻的一级标题
- **THEN** 四个标题 SHALL 分处四个 `.cm-line`，不得出现 `# A# B` 这类同一行文本

#### Scenario: 折叠态保持可见

- **WHEN** 某标题已折叠且指针移出召唤区
- **THEN** 该标题的三角 SHALL 保持可见，以便再次点击展开
