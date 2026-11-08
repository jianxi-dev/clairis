## MODIFIED Requirements

### Requirement: E-10 编辑器大纲浮层

编辑模式与预览模式 SHALL 在内容区右上角提供大纲入口；入口按钮 SHALL 距内容区右缘为容器宽度的 2/3（窄窗口下仍完整可见）。大纲入口按钮 SHALL 为方形圆角背景图形，默认背景透明；钉住态 SHALL 显示背景色（强调色系）。悬停 SHALL 展开浮层，点击按钮 SHALL 钉住，Esc 与点击浮层外部 SHALL 收起。浮层未钉住时 SHALL NOT 绘制边框；钉住态 SHALL 绘制 1px 细边框。浮层 SHALL 列出当前页签文档的全部 ATX 标题（`#`–`######`），SHALL 跳过围栏代码块（``` 与 ~~~，含未闭合围栏）内的行，并按层级缩进显示。文档不含任何 ATX 标题时 SHALL NOT 渲染大纲入口。

点击大纲项 SHALL 把内容区滚动到对应标题：编辑/源码模式按文档行号定位并置于视口顶部，预览模式按标题元素滚到容器顶部。切换页签或编辑模式后，浮层 SHALL 只反映当前页签的标题。

#### Scenario: 列出标题并跳过代码块

- **WHEN** 用户悬停大纲按钮，文档含 `# 第一章` 与一个包含 `# 代码里的井号` 的围栏代码块
- **THEN** 浮层 SHALL 只列出真实标题，不得出现代码块内的行

#### Scenario: 点击跳转

- **WHEN** 用户点击大纲里的第二个标题
- **THEN** 编辑区 SHALL 滚动到该标题行，且该行位于内容区顶部附近

#### Scenario: 同名标题

- **WHEN** 文档含两个文本相同的标题
- **THEN** 点击第二个大纲项 SHALL 跳到第二个标题，不得跳到第一个

#### Scenario: 多页签跟随

- **WHEN** 用户切换到另一篇文档
- **THEN** 大纲 SHALL 只列出新页签的标题

#### Scenario: 按钮形态与钉住底色

- **WHEN** 大纲按钮未钉住 / 已钉住
- **THEN** 未钉住时 SHALL 为透明底的方形圆角图形；钉住时 SHALL 显示背景色

#### Scenario: 按钮距右缘三分之二

- **WHEN** 测量大纲入口按钮右侧到内容区右缘的距离
- **THEN** 该距离 SHALL 约等于容器宽度的 2/3（误差不超过 4px）

#### Scenario: 未钉住无边框

- **WHEN** 用户悬停大纲按钮但未钉住
- **THEN** 浮层四边 `border-width` SHALL 为 0px

#### Scenario: 钉住显示细边框

- **WHEN** 用户点击钉住大纲浮层
- **THEN** 浮层边框宽度 SHALL 为 1px

### Requirement: E-11 块菜单结构与图标体系

块菜单 SHALL 由「转为」图标网格与结构动作组两段组成。「转为」SHALL 渲染为 5 列 × 2 行共 10 项（正文、H1、H2、H3、有序、无序、待办、代码、引用、高亮），当前块型 SHALL 高亮。结构动作组 SHALL 至少包含 复制、剪切、删除；并 SHALL 提供 颜色 与 合并后的「对齐与缩进」入口——缩进（增加 / 减少）与对齐（左 / 中 / 右）SHALL 收在同一个入口的二级菜单内，SHALL NOT 各占一行。对齐三项 SHALL 各带图标。缩进图标 SHALL 使用语义正确的缩进/反缩进图形（SHALL NOT 复用好似「左对齐/清除」的错位图标）。颜色 SHALL 使用共享调色板（字色 8 色 + 底色 15 色的实色观感），SHALL NOT 呈现为偏淡的浅色块。菜单项图标 SHALL 为 20px，行高 SHALL 为 36px，菜单宽 SHALL 为 264px（2026-11-03「放大一档」，与 E-7 一致）；新增手柄菜单与转换手柄菜单 SHALL 共用该宽度常量，SHALL NOT 出现两级菜单宽度不一致。菜单内标题行与无序列表项之间的前两行间距 SHALL 收紧，小于其它相邻行间距。「在下方添加」行 SHALL 带图标与右侧展开指示，形态与其它行一致。

表格块 SHALL 与文本块共用同一组结构动作（复制、剪切、删除等），SHALL NOT 只显示「在下方添加」。不可用项 SHALL 以禁用态呈现，SHALL NOT 从菜单中消失。

> 2026-11-03 维护者裁定：**不再提供** 标题行 / 标题列 / 均分列宽 三个开关。GFM 表格恒有表头行、没有列宽与标题列的表达方式；为这三项引入非 GFM 扩展不值得（#137 已关闭）。

#### Scenario: 转为网格形态

- **WHEN** 用户打开任意文本块的块菜单
- **THEN** 「转为」区域 SHALL 为 5 列 2 行、共 10 个图标单元，且当前块型单元处于高亮态

#### Scenario: 表格块菜单有结构动作

- **WHEN** 用户打开表格块的块菜单
- **THEN** 菜单 SHALL 含 复制块、剪切块、删除块 与「在下方添加」；SHALL NOT 出现 标题行 / 标题列 / 均分列宽

#### Scenario: 每一行都有图标

- **WHEN** 用户打开块菜单
- **THEN** 菜单中每一行（含「在下方添加」）SHALL 各含一个 `svg[data-icon]`，图标渲染尺寸为 20px

#### Scenario: 对齐与缩进合并在二级菜单

- **WHEN** 用户打开块菜单
- **THEN** 菜单中 SHALL 只有一个「对齐与缩进」入口；展开其二级菜单后 SHALL 含 左对齐 / 居中 / 右对齐 / 减少缩进 / 增加缩进 五项，且对齐三项 SHALL 各带图标

#### Scenario: 两级菜单同宽

- **WHEN** 分别测量新增手柄菜单与转换手柄菜单的宽度
- **THEN** 两者的 `offsetWidth` SHALL 相等

#### Scenario: 菜单前两行间距收紧

- **WHEN** 审查块菜单中标题行与无序列表行的垂直间距
- **THEN** 该间距 SHALL 小于菜单其它相邻行的间距

#### Scenario: 缩进图标语义正确

- **WHEN** 审查「对齐与缩进」二级菜单里的增加缩进 / 减少缩进两项
- **THEN** 两项图标 SHALL 为缩进与反缩进语义图形，SHALL NOT 与对齐类图标混淆

#### Scenario: 颜色观感为实色

- **WHEN** 用户展开块菜单的颜色面板
- **THEN** 色板 SHALL 呈现实色观感（字色与底色两组），SHALL NOT 呈现为偏淡的浅色块

## ADDED Requirements

### Requirement: 颜色面板二级保持

块菜单的颜色入口展开二级调色板后，指针离开父项 SHALL NOT 使调色板消失；调色板 SHALL 仅在选择颜色、按 Esc 或点击菜单外部时关闭。

#### Scenario: 指针移出父项后调色板仍在

- **WHEN** 用户展开颜色二级调色板后把指针移出该父项
- **THEN** 调色板 SHALL 仍然可见

#### Scenario: 点击外部关闭

- **WHEN** 调色板展开时用户点击菜单外部
- **THEN** 调色板 SHALL 关闭

### Requirement: 编辑态工具条归属

Markdown 编辑态与 HTML 可视化编辑态 SHALL 各自使用各自的选区工具条，SHALL NOT 混用。Markdown 编辑态选中文本后呈现的工具条 SHALL 为 md-bundle 的按钮集合（改写 / 翻译 / 润色 + 格式组），图标 SHALL 取自本仓 `icons.ts`。HTML 可视化编辑态的格式条与改写条 SHALL 只在 HTML 编辑态出现。

#### Scenario: md 编辑态不出现 html 工具条

- **WHEN** 用户在 Markdown 编辑态选中一段文本
- **THEN** 出现的工具条 SHALL NOT 含 HTML 可视化编辑专属按钮

#### Scenario: md 工具条集合与 md-bundle 一致

- **WHEN** 用户在 Markdown 编辑态选中文本
- **THEN** 工具条按钮集合 SHALL 等于 md-bundle 的集合（改写 / 翻译 / 润色 + 格式组）

### Requirement: 撤销与重做快捷键

撤销 / 重做 SHALL 同时响应 `Mod`（macOS 上为 Command）与 `Control` 两套修饰键：撤销接受 `Mod-Z` 与 `Ctrl-Z`，重做接受 `Mod-Shift-Z`、`Ctrl-Shift-Z` 与 `Ctrl-Y`。Markdown 编辑与 HTML 可视化编辑 SHALL 使用同一映射。

#### Scenario: Ctrl 撤销生效

- **WHEN** 用户在编辑态按 `Control+Z`
- **THEN** 内容 SHALL 回退一步，行为与 `Command+Z` 相同

#### Scenario: Ctrl 重做生效

- **WHEN** 用户按下 `Control+Shift+Z` 或 `Control+Y`
- **THEN** 内容 SHALL 前进一步

#### Scenario: 颜色观感为实色

- **WHEN** 用户展开块菜单的颜色面板
- **THEN** 色板 SHALL 呈现实色观感（字色与底色两组），SHALL NOT 呈现为偏淡的浅色块

