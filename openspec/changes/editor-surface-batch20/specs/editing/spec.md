## MODIFIED Requirements

### Requirement: E-22 编辑态悬停提示胶囊化

界面中一切自绘悬停提示 SHALL 为胶囊或圆角方形（圆角半径 ≥ 提示高度的一半）；SHALL NOT 使用系统原生的矩形 `title` 提示——SHALL NOT 因 `aria-haspopup` / `aria-expanded` / `data-no-tip` 等属性而绕过自绘，弹层打开期间 SHALL NOT 放行原生 `title`。编辑态的选区轮盘 SHALL 在每个扇区（根扇区、二级单元、色条）被悬停时显示其中文名称提示。同一类提示（按钮提示、轮盘扇区提示、页签名信息窗）SHALL 共用同一外壳常量，SHALL NOT 出现矩形外壳。

提示响应时间 SHALL 跟随全局「提示时长」设置（`noticeDuration`）；未配置时回退值 SHALL 与底部提示同口径（单一来源）。

提示胶囊 SHALL 优先在触发元素的上方或下方弹出；仅当上下均无空间时才左右弹出。底部状态栏按钮的提示 SHALL 出现在该图标的正上方。

提示胶囊 SHALL 带指向触发元素的箭头尾，箭头朝向按弹出方位取值（提示在触发元素上方时朝下、下方时朝上、左侧时朝右、右侧时朝左），SHALL 指向其描述的触发元素。提示内容 SHALL 按按钮形态区分：同时显示图标与文字的按钮，其提示 SHALL 只显示快捷键、SHALL NOT 重复按钮名称；纯图标按钮的提示 SHALL 显示图标名称与快捷键（如「下划线 (⌘ + U)」），并 SHALL 给出该动作的 markdown 用法提示（如 `Markdown: ~文本~ 空格`）。刻意以文字解释图标动作的按钮 SHALL 保留名称。

#### Scenario: 按钮提示为胶囊

- **WHEN** 用户把指针停在任一功能按钮上 600ms
- **THEN** SHALL 出现提示元素，其计算 `border-radius` SHALL ≥ 提示高度的一半
- **AND** 页面 SHALL NOT 弹出系统原生矩形提示

#### Scenario: 轮盘扇区显示提示

- **WHEN** 用户在 MD 编辑态唤出选区轮盘并把指针停在「转换」扇区上
- **THEN** SHALL 出现文案为「转换」的胶囊提示

#### Scenario: 同类提示外壳一致

- **WHEN** 分别悬停功能按钮、轮盘扇区与页签名
- **THEN** 三者提示外壳 SHALL 均为胶囊，计算 `border-radius` 均 ≥ 各自高度的一半，SHALL NOT 出现矩形外壳

#### Scenario: 提示气泡箭头指向触发元素

- **WHEN** 用户把指针停在任一功能按钮上并唤出提示
- **THEN** 提示气泡 SHALL 含箭头尾，箭头朝向该按钮（按弹出方位）

#### Scenario: 图标+文字按钮提示仅快捷键

- **WHEN** 用户悬停同时显示图标与文字的菜单项「复制」
- **THEN** 提示文本 SHALL 为 `⌘ + C`，SHALL NOT 含名称「复制」

#### Scenario: 纯图标按钮提示名称与快捷键

- **WHEN** 用户悬停纯图标按钮「下划线」
- **THEN** 提示文本 SHALL 为 `下划线 (⌘ + U)`，并 SHALL 含 markdown 用法提示 `Markdown: ~文本~ 空格`

#### Scenario: 无原生矩形提示

- **WHEN** 用户悬停带 `aria-haspopup` 的控件（如状态栏主题按钮）或菜单项
- **THEN** SHALL NOT 出现系统原生矩形 `title`；出现的提示 SHALL 为自绘外壳

#### Scenario: 提示优先上下方位

- **WHEN** 用户悬停一个位于视口左侧、上下均有余量的按钮
- **THEN** 提示 SHALL 出现在该按钮的上方或下方，SHALL NOT 出现在左侧或右侧

#### Scenario: 状态栏提示在图标正上方

- **WHEN** 用户悬停底部状态栏右侧的入口图标
- **THEN** 提示浮层上缘 SHALL 位于按钮上缘之上，且水平中心与按钮水平中心偏差 SHALL ≤4px

#### Scenario: 提示响应时间跟随全局设置

- **WHEN** 用户把「提示时长」设为 1.0 秒并悬停按钮
- **THEN** 提示 SHALL NOT 在 1000ms 前出现，且在约 1100ms 时出现

### Requirement: 编辑态工具条归属

Markdown 编辑态与 HTML 可视化编辑态 SHALL 各自使用各自的选区工具条，SHALL NOT 混用。Markdown 编辑态选中文本后呈现的工具条按钮集合 SHALL 收敛为更少的集合（约 12 键量级，对齐文本文件工具条的数量级），SHALL NOT 承载轮盘全量动作；图标 SHALL 取自本仓 `icons.ts`。HTML 可视化编辑态的格式条与改写条 SHALL 只在 HTML 编辑态出现。

文本与脚本（非 Markdown）文件的编辑态与预览态工具条 SHALL 只显示「复制」按钮，SHALL NOT 显示其它动作。

#### Scenario: md 编辑态不出现 html 工具条

- **WHEN** 用户在 Markdown 编辑态选中一段文本
- **THEN** 出现的工具条 SHALL NOT 含 HTML 可视化编辑专属按钮

#### Scenario: md 工具条按钮集合收敛

- **WHEN** 用户在 Markdown 编辑态选中文本
- **THEN** 工具条按钮数 SHALL 等于收敛后的目标数量级（约 12），SHALL NOT 等于轮盘全量动作数

#### Scenario: 文本文件工具条只含复制

- **WHEN** 用户在编辑态或预览态打开一个 `.txt` / `.css` / `.json` 文件
- **THEN** 该文件工具条的按钮数 SHALL 为 1 且为「复制」

### Requirement: E-26 插入菜单表格与分栏

插入菜单的表格选择器 SHALL 在指针滑入任意格时选中「左上第一格到指针格」的完整矩形，滑动过程 SHALL 不重建网格。分栏入口 SHALL 渲染 5 根竖向柱子（无文字标签），指针自左向右滑过即选中第 1..i 根，单击第 i 根 SHALL 插入 `::: {.col-i}` 围栏。

表格与分栏选择器顶部的说明文字与其读数（已选栏数 / `R × C`）SHALL 同行显示，读数位于说明文字右侧；表格读数 SHALL 与网格最右侧边框线右对齐；分栏读数 SHALL 与第 5 根柱子的水平中心对齐；分栏展开的子菜单 SHALL 与其触发行上下居中。

#### Scenario: 滑入选中矩形

- **WHEN** 用户把指针滑到表格网格第 3 行第 4 列
- **THEN** 处于选中态的格子数 SHALL 为 12

#### Scenario: 回滑收缩矩形

- **WHEN** 用户从第 3 行第 4 列直接滑回第 1 行第 1 列
- **THEN** 处于选中态的格子数 SHALL 为 1

#### Scenario: 分栏横向选择

- **WHEN** 用户展开分栏菜单并把指针从左滑到第 3 根柱子
- **THEN** 柱子数 SHALL 为 5，选中柱子数 SHALL 为 3，单元 `textContent` SHALL 为空

#### Scenario: 单击插入分栏

- **WHEN** 用户单击第 3 根柱子
- **THEN** 文档 SHALL 插入 `::: {.col-3}` 围栏，浮层 SHALL 关闭且无残留

#### Scenario: 表格读数右对齐

- **WHEN** 用户打开表格选择器
- **THEN** 读数文字右缘与网格最右边界线 x 差 SHALL ≤1px，且读数位于说明文字右侧

#### Scenario: 分栏读数居中第五栏

- **WHEN** 用户打开分栏选择器
- **THEN** 读数文字水平中心与第 5 根柱子的水平中心偏差 SHALL ≤2px

#### Scenario: 分栏子菜单垂直居中

- **WHEN** 用户滑入分栏选项展开子菜单
- **THEN** 子菜单垂直中心与其触发行垂直中心偏差 SHALL ≤2px

### Requirement: 文本与脚本文件行号

编辑态对非 Markdown 的纯文本 / 脚本（代码）文件 SHALL 显示行号；Markdown 编辑态 SHALL NOT 显示行号槽（沿用 E-8）。行号槽 SHALL 紧贴正文（行号文字右缘与正文文本左缘的间距 SHALL 取设计系统小刻度，SHALL NOT 因正文居中/内边距叠加而出现过大的空白）；行号文字 SHALL 使用次级色且不参与文本选择。

编辑态与预览态的文本/代码显示 SHALL 共用一套格式：代码块的内边距、宽度、底与字体族、语法配色 SHALL 一致；语法配色 SHALL 以既有 `.tok-*` token 为唯一来源，SHALL NOT 另立色板。

#### Scenario: 文本与脚本文件显示行号

- **WHEN** 用户以编辑态打开一个 `.txt` 或 `.js` 文件
- **THEN** 行号槽节点数 SHALL ≥1，且每个可见行对应一个行号

#### Scenario: Markdown 编辑态无行号槽

- **WHEN** 用户以编辑态打开一个 `.md` 文件
- **THEN** 行号槽节点数 SHALL 为 0

#### Scenario: 行号紧贴正文

- **WHEN** 用户以编辑态打开一个 `.txt` 文件
- **THEN** 行号文字右缘与正文文本左缘的水平间距 SHALL ≤ 设计系统小刻度（≤12px）

#### Scenario: 编辑与预览代码格式一致

- **WHEN** 同一段代码在编辑态与预览态显示（若该文件类型两者皆可显示）
- **THEN** 代码块的计算 `font-family`、背景色与内边距 SHALL 一致
