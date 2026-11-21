# doc-property-panel 能力增量规格

## MODIFIED Requirements

### Requirement: P-1 面板落位与三模式

含 frontmatter 的文档中，文档属性块 SHALL 作为**正文流首块**渲染：位于正文标题之前、随文档内容滚动，SHALL NOT 固定在滚动容器之外。编辑态 SHALL 以「替换 frontmatter 源码块的块级 widget」承载（高度须计入编辑器坐标映射）；无 frontmatter 的文档 MAY 维持内容区上方的固定宿主（添加首个字段后转为嵌入形态）；**含 frontmatter 的文档在编辑态 SHALL NOT 使用固定宿主**（展开与折叠均嵌入正文流）。预览态 SHALL 渲染在预览内容流顶部；源码模式 SHALL NOT 渲染。预览态面板 SHALL 只读（禁用全部编辑交互）；编辑态默认展开、可折叠；面板显隐切换 SHALL NOT 修改文档内容（隐藏 ≠ 删除）。三模式切换 SHALL 使用 CSS display 切换，SHALL NOT 重建面板状态（不 remount）。属性块宽度 SHALL 对齐正文测量宽（`--type-measure`），且与正文段落同列轴心；属性块下方 SHALL 与正文首块保持约一个正文行高的间距（编辑嵌入态与预览态一致），SHALL NOT 与标题紧贴；**该间距 SHALL 由属性块自身的布局间距（margin）提供，SHALL NOT 依赖正文空行**（空行可被编辑删除而失效）。**面板可见且处于编辑态时，正文 SHALL 隐藏 frontmatter 源码块**：面板展开态与折叠态均 SHALL 由「替换 frontmatter 源码块的块级 widget」承载——展开态为完整属性卡片，折叠态为同一位置呈现的**折叠标题行**（倒三角 + 标题；字段区隐藏，随正文流滚动），SHALL NOT 在正文另行渲染「文档属性 · N 个字段」摘要标签（SHALL NOT 以按钮或虚线标签形式出现）；`⌘⇧Y` 隐藏面板后 SHALL NOT 在正文渲染 frontmatter 源码块，SHALL NOT 渲染「已隐藏，按 ⌘⇧Y 恢复」提示条——隐藏态 = 属性区与源码均不渲染，YAML 仅源码模式可见；恢复入口 SHALL 为页签信息窗字段显隐切换（见 P-11）。隐藏装饰 SHALL NOT 吞掉光标或选区，SHALL NOT 影响 undo 栈；源码态（YAML 必须完整可编辑）SHALL NOT 启用隐藏。

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

> 场景标题沿用旧名以保持条款可追溯；自本 change 起折叠态改为正文流内折叠标题行，正文不再渲染摘要标签。

- **WHEN** 用户折叠面板
- **THEN** 正文流内（原 frontmatter 位置）呈现折叠标题行（倒三角 + 标题），字段区 SHALL NOT 渲染任何字段行；SHALL NOT 出现「文档属性 · N 个字段」虚线标签或按钮；展开倒三角回到完整卡片

- **WHEN** 用户按 `⌘⇧Y` 隐藏面板
- **THEN** 正文 SHALL NOT 渲染 frontmatter 源码块，SHALL NOT 渲染「已隐藏，按 ⌘⇧Y 恢复」提示条；任何形式的属性块 SHALL NOT 渲染，恢复入口 SHALL 为页签信息窗字段显隐切换

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
- **THEN** 折叠标题行位于正文流首块位置并随正文滚动，SHALL NOT 悬浮固定在滚动容器之外

#### Scenario: 属性块与标题间距

- **WHEN** 编辑态（展开卡片或折叠标题行）或预览态属性块下方紧跟正文标题
- **THEN** 两者之间 SHALL 保持约一个正文行高的间距，且该间距来自属性块的布局间距——删除正文中的任何空行 SHALL NOT 使间距消失


### Requirement: P-3 字段类型系统与智能编辑

字段 SHALL 支持八类类型：文本、数字、日期、日期时间、下拉（选项可维护）、复选（多选）、布尔、列表（`[[` 文档链接）。类型选择器 SHALL 为字段名前的无边框纯图标（日期 = 日历 SVG、日期时间 = 时钟 SVG、列表 = 列表类图标，描边 1.7px），点击弹出图标+文字菜单直选。值编辑器 SHALL 按类型智能渲染：文本框（超 40 字符自动切多行文本域）、数字框、日期选择、日期时间选择、下拉、复选组、布尔开关、`[[` 文档链接菜单。**下拉与复选 SHALL 使用选项编辑器（SHALL NOT 回落为自由文本框，SHALL NOT 复用 `[[` 文档链接编辑器）：下拉点开列出现有选项（来源 = 已打开页签中同键出现过的值，SHALL NOT 新增配置或持久化键）并允许底部输入行新增选项，当前值高亮；复选为多选同构。复选与列表的值区输入框 SHALL 只在编辑态渲染，非编辑态 SHALL NOT 渲染常驻输入框；列表保留 `[[` 文档链接语义**。**复选、列表、标签三类 chip 编辑器 SHALL 在点击值区进入编辑态后才渲染输入框；Enter 确认后 SHALL 提交该项并保留输入框聚焦、继续弹出已有项菜单，供连续录入；Esc / 失焦 / 点击外部 SHALL 退出编辑态并隐藏输入框**。**日期与日期时间字段在编辑态的值区 SHALL 渲染为可编辑文本控件**：点击值区 SHALL 打开自绘面板；值区 SHALL 接受直接键入与粘贴；控件 SHALL 与面板同处既有 `DatetimeEditor`，SHALL NOT 新建第二个选择器，SHALL NOT 使用原生 `date` / `time` 控件。**日期时间字段 SHALL 提供单一面板选择器**（一个 popover 内同时完成日期与时间选择）：面板 SHALL 含月历网格（选日期）与紧邻日历右侧的时分滚轮列（选时间）；提交时 SHALL 把日期与时间组合为 `YYYY-MM-DDTHH:mm`，SHALL NOT 使用分离的「日期控件 + 时间控件」双控件，SHALL NOT 使用文本步进框 + 上下箭头的旧式时分控件。日期字段保持仅日期（不扩时间）。**日期字段单击日历日格 SHALL 立即写回所选 `YYYY-MM-DD` 并关闭面板**（「今天」同路径），该次选择 SHALL 只写回一次，SHALL NOT 因随后的失焦或外部点击重复提交；**日期时间字段的日格与时分操作 SHALL 只改草稿、SHALL NOT 提前提交**。**双击值区 SHALL 打开面板并把焦点移到时分输入（日期时间）或日历日格（日期），SHALL NOT 触发保存**。面板 SHALL 键盘可达（Tab 在月历与时分控件间移动、Enter 提交、Esc 取消）；日期时间面板内操作 SHALL NOT 触发提前提交，SHALL 沿用既有值编辑器 onBlur 提交链路（面板关闭或失焦时提交）；日期字段的日格单击是显式例外。写回前 SHALL 按类型做 YAML 合法性校验（数字为数值字面量、布尔为 `true/false`、日期为 `YYYY-MM-DD`、日期时间为 `YYYY-MM-DDTHH:mm`），非法输入 SHALL 还原原值并提示；**日期与日期时间的空输入 SHALL 视为合法空值并写回空值**（SHALL NOT 补「今天」、SHALL NOT 渲染 `—`）；**日期输入 SHALL 接受 `YYYY-MM-DD` 与 `YYYY/MM/DD` 并归一化为 `YYYY-MM-DD`；日期时间输入 SHALL 接受 `T` 或空格分隔、可选秒、以及以 `/` 分隔的日期部分，并归一化为 `YYYY-MM-DDTHH:mm`（秒为 `00` 时省略，秒非 `00` 时保留 `:ss`）**；**Enter / 失焦 SHALL 保存，Esc SHALL 回退原值，一次提交 SHALL 只发生一次**。**空值字段的值节点 SHALL NOT 渲染占位横线（如 `—`）或任何假值文案**，空态只以空白表示。**布尔字段的值内 SHALL NOT 出现「开/关」文字**：显示态与编辑态值内仅保留状态图形（true `◉` / false `○`），状态文案 SHALL 移至 `title` 提示（`已开启` / `已关闭`），编辑态 SHALL 保留 `role="switch"` 与 `aria-checked`/`aria-label` 状态语义。**空值字段与纯字符串字段的类型 SHALL 默认为 `text`**（空串、以及非日期/日期时间的纯字符串都不再回落未知类型；`unknown` 只保留给无法推断的非字符串值）；列表类型字段遇到非数组值时 SHALL 按单元素序列化展示与写回，SHALL NOT 抛错或崩溃。**日期字段 SHALL 改用与日期时间相同的自绘面板**（仅日期、无时分，提交 `YYYY-MM-DD`），SHALL NOT 使用原生 `date` 控件。**日期时间字段的展示格式 SHALL 为 `YYYY-MM-DD HH:mm`**（秒非 `00` 时才附 `:ss`，SHALL NOT 显示毫秒或时区后缀，YAML 原值不改写）。**面板内按 Tab 键 SHALL 在面板控件间移动焦点，SHALL NOT 把 Tab 写入正文**。**值区占位符 SHALL 显示格式（日期 `YYYY-MM-DD`、日期时间 `YYYY-MM-DD HH:mm`），SHALL NOT 使用「选择日期」「选择日期时间」这类动词短语；空字段打开面板时 SHALL 以当前日期与当前时刻预置草稿（时分 SHALL NOT 固定为 00:00）；面板 footer SHALL 含「清除」按钮，点击 SHALL 写回空值并关闭面板**。**日期与日期时间面板底部提示（`.dpb-dt-foot` 内的 `.dpb-dt-hint`）SHALL 默认隐藏（`opacity: 0`），指针进入 `.dpb-dt-hint` 文字自身区域（`:hover`）或该文字获得键盘焦点（`:focus-visible`）时 SHALL 显现；footer 行的其他区域悬停 SHALL NOT 触发；显隐 SHALL 只改透明度，SHALL NOT 改变 footer 与面板高度（无回流）**；两个选择器共用同一 footer，SHALL 一致生效；既有 Esc 取消 / Enter 保存 / 点击外部保存行为 SHALL 不变。

#### Scenario: 类型切换后编辑器随变

- **WHEN** 用户把某字段类型从文本切换为日期
- **THEN** 值编辑器变为日期选择器，切「源码」可核对该键写回为 YAML 日期字面量

#### Scenario: 日期时间为单一面板

- **WHEN** 用户在日期时间字段点击值区
- **THEN** SHALL 出现一个面板，同一面板内同时含月历网格与日历右侧的时分滚轮列；SHALL NOT 出现分离的日期控件与时间控件

#### Scenario: 面板组合提交

- **WHEN** 用户在面板内选定日期 2026-11-18 与时间 14:30 后提交
- **THEN** 该字段值 SHALL 等于 `2026-11-18T14:30`

#### Scenario: 面板键盘可达

- **WHEN** 面板打开后用户按 Tab 在月历与时分控件间移动，按 Enter 提交，按 Esc 取消
- **THEN** 焦点在月历与时分控件间移动；Enter 提交组合值；Esc 取消并回到原值

#### Scenario: 面板内操作不提前提交

- **WHEN** 用户在日期时间面板内点击月历日格或时分滚轮列（日期字段的日格单击是显式例外，见「日期日格单击即提交并关闭」）
- **THEN** 字段值 SHALL NOT 立即写回；面板关闭或失焦时 SHALL 提交

#### Scenario: 日期日格单击即提交并关闭

- **WHEN** 用户在日期字段面板单击日历日格 2026-11-18
- **THEN** 该字段 SHALL 立即写回 `2026-11-18` 并关闭面板，写回次数 SHALL 为 1（随后的失焦或外部点击 SHALL NOT 再次写回）

#### Scenario: 日期「今天」同路径

- **WHEN** 用户在日期字段面板点击「今天」
- **THEN** 该字段 SHALL 立即写回当天 `YYYY-MM-DD` 并关闭面板，写回次数 SHALL 为 1

#### Scenario: 日期字段直接键入

- **WHEN** 用户在日期字段值区键入 `2026/11/18` 并按 Enter
- **THEN** 该字段 SHALL 写回 `2026-11-18`，源码 YAML 中该键 SHALL 为 `2026-11-18`

#### Scenario: 日期时间直接键入

- **WHEN** 用户在日期时间字段值区键入 `2026-11-18 14:30`（或 `2026-11-18T14:30:00`）并按 Enter
- **THEN** 该字段 SHALL 写回 `2026-11-18T14:30`（秒为 `00` 时省略）

#### Scenario: 粘贴容错归一化

- **WHEN** 用户把 `2026/11/18 09:05` 粘贴进日期时间字段值区并提交
- **THEN** 该字段 SHALL 写回 `2026-11-18T09:05`；粘贴 `2026/11/18` 进日期字段 SHALL 写回 `2026-11-18`

#### Scenario: 双击值区定位输入

- **WHEN** 用户双击日期时间字段值区
- **THEN** 面板 SHALL 打开且焦点 SHALL 在小时输入；双击日期字段值区时焦点 SHALL 在日历日格；两次场景均 SHALL NOT 立即写回

#### Scenario: 清空即空值

- **WHEN** 用户清空日期或日期时间字段值区并提交
- **THEN** 该字段 SHALL 写回空值，SHALL NOT 自动填入今天，SHALL NOT 渲染 `—`；YAML 中该键 SHALL 为空字符串值

#### Scenario: 非法输入回退并提示

- **WHEN** 用户在日期或日期时间字段值区键入无法归一化的文本并提交
- **THEN** 该字段 SHALL 保留原值、SHALL NOT 写回，并 SHALL 显示格式错误提示；面板 SHALL 关闭

#### Scenario: 空值不显示占位符

- **WHEN** 一个文本字段值为空
- **THEN** 其值节点 SHALL 为空，SHALL NOT 出现 `—` 或占位横线

#### Scenario: 布尔值图形与提示分离

- **WHEN** 编辑态查看布尔字段（`flag: true`）
- **THEN** 值节点文本仅含状态图形 `◉`（不含「开」字），`title` 为「已开启」；切换为 false 后图形变 `○`、`title` 为「已关闭」，`aria-checked` 同步

#### Scenario: 列表字段 [[ 文档链接

- **WHEN** 用户在列表字段值区输入 `[[` 并从菜单选出文档
- **THEN** 该文档以 `[[文档名]]` 链接样式加入值列表，可移除；菜单行只显示文档名（不带 `[[` 前缀）

#### Scenario: 数字千分位

- **WHEN** 数字字段值为 1234567
- **THEN** 面板显示 `1,234,567`，而编辑器内与 YAML 源码保持原值 `1234567`

#### Scenario: 日期字段自绘面板

- **WHEN** 用户点击日期字段的值区
- **THEN** SHALL 出现与日期时间共用的自绘面板（仅日期、无时分），提交值 SHALL 为 `YYYY-MM-DD`；SHALL NOT 出现原生 `date` 控件

#### Scenario: 日期面板底部提示悬停显现

- **WHEN** 用户打开日期或日期时间选择器，指针未进入底部 footer
- **THEN** 底部提示「Esc 取消 · Enter 保存 · 点击外部保存」SHALL 不可见（计算 `opacity` 为 0）；指针进入 footer 任意位置或 footer 内元素获焦时 SHALL 可见；footer 高度保持不变，Esc / Enter / 点击外部保存行为不变

#### Scenario: 面板 Tab 不写入正文

- **WHEN** 光标在日期时间面板的时/分输入框内按 Tab
- **THEN** 焦点 SHALL 在面板控件间移动，正文 SHALL NOT 被写入缩进，文档首字符 SHALL 仍为 `-`

#### Scenario: 空值默认文本

- **WHEN** frontmatter 某键值为空且未命中别称
- **THEN** 该字段类型 SHALL 为 `text`，SHALL NOT 显示未知类型

#### Scenario: 纯字符串默认文本

- **WHEN** frontmatter 含 `priority: 高`（未命中别称、非日期字面量）
- **THEN** 该字段类型 SHALL 为 `text`，显示文本图标，SHALL NOT 显示「?」未知图标

#### Scenario: 非数组值按单元素列表

- **WHEN** frontmatter 含 `tags: "#"`
- **THEN** 该字段 SHALL 按单元素列表展示，抛错次数 SHALL 为 0

#### Scenario: 下拉选项菜单

- **WHEN** 用户点击下拉字段的值区
- **THEN** SHALL 列出现有选项（来源 = 已打开页签中同键出现过的值），当前值高亮，底部输入行可新增选项；SHALL NOT 回落为自由文本框或复用 `[[` 文档链接编辑器

#### Scenario: chip 按需输入接续

- **WHEN** 用户在复选 / 列表 / 标签值区点击进入编辑态并 Enter 确认一项
- **THEN** 该项 SHALL 提交，输入框 SHALL 保留聚焦并继续弹出已有项菜单供连续录入；Esc / 失焦 / 点击外部 SHALL 退出编辑态并隐藏输入框；非编辑态 SHALL NOT 渲染常驻输入框


### Requirement: P-4 字段行操作与选择模式

编辑态每个字段行 SHALL 带**行手柄**：**点击行手柄选中**（可多选、全选），拖动排序；**拖动 SHALL NOT 改变选中集，SHALL NOT 使工具条出现（单击手柄才选中并显示工具条）**，选中临近多行后拖动 SHALL 整块移动（拖拽阈值 5px 区分点击，拖动显示落点指示线）。字段行 SHALL 为**单行胶囊**结构：类型图标 + 字段名 + 值同行排列，字段名输入框固定单行高度、SHALL NOT 随内容撑高；行尾控件 SHALL 为**叉号（关闭语义）**，点击移除该行字段（沿用单一事务写回、可撤销）；**锁定字段（创建/修改日期）SHALL NOT 渲染删除与改名入口，并 SHALL 显示锁图标**。**选中高亮 SHALL 覆盖整块（含值）**：选中行整行（含类型图标、字段名与值）以高亮样式呈现；**值文本节点 SHALL NOT 属于可选中单位**（SHALL NOT 单独选中、SHALL NOT 进入全选），仅随所在行高亮。**改名入口**：无选中项时，单击字段名 SHALL 进入就地改名（Enter / Space 亦可），Enter / 失焦提交、Esc 取消；**已选中任一字段后，点击其他字段行任意位置（含字段名）SHALL 切换该行选中**（选中/取消），SHALL NOT 进入改名或值编辑——此为既有行为，SHALL 保留。选中后 SHALL 出现图标操作条（胶囊外形，水平居中悬浮于属性区标题行，SHALL NOT 占据字段区的一行）：复制 / 剪切 / 粘贴（插入所选行下方，粘贴键名自动去重）/ 上移 / 下移 / 删除 / 取消。**选中集复制载荷 SHALL 仅含字段类型 + 字段名称 + 未来字段属性，SHALL NOT 含值**；粘贴 SHALL 在目标文档重建同定义字段（同类型、同名、同未来属性）、**值为空**。**操作条与行内操作图标 SHALL 统一经仓库图标注册表（`src/ui/icons` 的 `iconSvg`）渲染**，SHALL NOT 使用 Unicode 字形或组件内联一次性 SVG；新增图标概念 SHALL 先补 `docs/design/system/spec.md` §2.3 条款再注册（24×24 viewBox、笔画 1.7、尺寸档 14/18/24）。**「全选」按钮 SHALL 为二态**：**可选中单位 SHALL 限定为字段名称与标签两类节点，值文本节点 SHALL NOT 参与选中**；0 个选中时按钮文案为「全选」，≥1 个选中时按钮文案为「反选」，按钮文案 SHALL 与当前选中集合一致；**「反选」SHALL 为反转当前选择集**（已选的取消、未选的选上），全选 SHALL 选中全部字段名与标签（标题位可手动选中，不进入全选）。**选择模式**：存在选中项时，行内一切点击（值、选项、类型图标、删除键）SHALL 变为选中/取消切换且不进入编辑，行 hover SHALL 显示选中提示（L/T 两态统一）；单击行外空白 SHALL 清空选中。**行内 SHALL NOT 渲染字段类型文字**，类型只由图标表达；类型图标、字段名与值 SHALL 垂直居中对齐。**文本 / 多行 / 列表 / 标签值编辑器宽度 SHALL 填满本行**；**A 一行条空值字段的输入区 SHALL 保有点击友好的最小宽度（≥ 200px / 约 16 字符）**，日期 / 日期时间 / 数字 / 布尔编辑器 SHALL 保留内在宽度。**行末尾删除叉号默认 SHALL 不可见**，行悬停、行内焦点或行选中时 SHALL 可见，占位宽度 SHALL 保持不变。**选中操作条 SHALL 使用中性表面色**，SHALL NOT 与选中行同色。**「全选」按钮 SHALL 前置全选图标**。

#### Scenario: 多选复制粘贴去重

- **WHEN** 用户选中「分类」「作者」两行执行复制，再粘贴到末行
- **THEN** 新增两行键名与原行一致；若目标已有同名键，粘贴行键名自动追加序号去重；粘贴行的值 SHALL 为空（见「粘贴重建空值字段」）

#### Scenario: 字段名单行高度

- **WHEN** 用户选中一个字段名很长的字段
- **THEN** 字段名输入框计算高度 SHALL 保持单行，面板 SHALL NOT 被撑高

#### Scenario: 行尾叉号删除

- **WHEN** 用户点击某字段行尾的叉号
- **THEN** 该字段被移除并可一次撤销恢复；叉号 SHALL 为关闭语义图标（非垃圾桶）

#### Scenario: 锁定字段锁图标

- **WHEN** 用户查看创建/修改日期字段行
- **THEN** 该行 SHALL 显示锁图标，SHALL NOT 渲染删除/改名入口

#### Scenario: 全选后反选

- **WHEN** 面板有 3 个可选字段行（不含标题与标签），用户点击「全选」再一次
- **THEN** 第一次点击后 3 行全部选中，按钮文案为「全选」后切换为「反选」；第二次点击后选中数为 0，按钮文案在两次分别为「全选」与「反选」

#### Scenario: 全选排除标题与标签

- **WHEN** 文档含标题行与标签行，用户点击「全选」
- **THEN** 标题行 SHALL 保持未选中；**标签行 SHALL 被选中**（标签属可选中单位），仅字段行与标签行被选中

#### Scenario: 选择模式行内点击

- **WHEN** 面板存在选中项，用户点击另一字段行内任意位置（含值区、类型图标与字段名）
- **THEN** 该行被选中/取消选中，不触发值编辑、类型菜单或改名

#### Scenario: 整块移动

- **WHEN** 用户选中临近的三行并拖动其中任一行手柄
- **THEN** 三行作为整块移动到落点位置，行内相对顺序不变

#### Scenario: 工具条图标同源

- **WHEN** 编辑态选中若干字段行，操作条出现
- **THEN** 操作条 SHALL 为胶囊外形、水平居中悬浮于属性区标题行，SHALL NOT 占据字段区的一行；七个按钮图标均为 `iconSvg` 渲染的 SVG（与 MD 横向工具条同一来源），按钮内无 Unicode 字形文本

#### Scenario: 选中一个即显示反选

- **WHEN** 面板有多个可选字段，用户只选中其中 1 个字段名
- **THEN** 按钮文案 SHALL 显示「反选」，SHALL NOT 等待全部选满才切换

#### Scenario: 反选反转选择集

- **WHEN** 用户选中部分字段名与标签后点击「反选」
- **THEN** 已选的字段名与标签被取消、未选的被选上，选择集变为原集合的补集，按钮文案随选中数切换

#### Scenario: 标签参与选择

- **WHEN** 文档含标签行，用户点击标签行
- **THEN** 标签行被选中（高亮落在标签胶囊），反选时标签同样被反转

#### Scenario: 值不进入选中

> 场景标题沿用旧名以保持条款可追溯；自本 change 起值文本节点仍不属可选中单位，但选中高亮改为覆盖整行（含值）。

- **WHEN** 用户选中某字段
- **THEN** 选中高亮落在整行（含值）；值文本节点 SHALL NOT 被当作可选中单位（SHALL NOT 单独选中、SHALL NOT 进入全选），仅随所在行高亮

#### Scenario: 选中整块高亮含值

- **WHEN** 用户选中某字段行
- **THEN** 该行整块（类型图标 + 字段名 + 值）计算样式呈现选中高亮，值区 SHALL NOT 保持未选中底色

#### Scenario: 选中集复制不含值

- **WHEN** 用户选中若干字段执行复制
- **THEN** 剪贴板载荷只含字段类型、字段名称与未来字段属性，SHALL NOT 含任何值；载荷为结构化 JSON（版本化）

#### Scenario: 粘贴重建空值字段

- **WHEN** 用户在目标文档执行粘贴
- **THEN** 按载荷重建同类型、同名字段，未来字段属性一并重建，值 SHALL 为空

#### Scenario: 单击字段名进入改名

- **WHEN** 面板无选中项，用户单击某字段名
- **THEN** 该字段名进入就地改名输入态（Enter / 失焦提交、Esc 取消），SHALL NOT 先进入选中

#### Scenario: 已选中后点击其他字段切换选中

- **WHEN** 面板已选中任一字段，用户点击其他字段行任意位置（含字段名）
- **THEN** 该行被选中/取消选中，改名与值编辑 SHALL NOT 触发

#### Scenario: 行手柄点击选中

- **WHEN** 用户点击某字段行的行手柄（< 5px 抬手的点击）
- **THEN** 该行被选中/取消选中；拖动超过阈值仍走整块排序

#### Scenario: 拖动不改变选中集

- **WHEN** 用户拖动字段行手柄超过阈值进行排序
- **THEN** 选中集 SHALL 不变，工具条 SHALL NOT 出现；单击手柄才选中并显示工具条

#### Scenario: 行内无类型文字

- **WHEN** 用户查看任一字段行
- **THEN** 行内 SHALL NOT 渲染字段类型文字，类型只由图标表达

#### Scenario: 行内垂直居中

- **WHEN** 测量类型图标、字段名与值的包围盒
- **THEN** 三者的垂直中心差 SHALL ≤ 1px

#### Scenario: 满行编辑器

- **WHEN** 字段类型为文本 / 多行 / 列表 / 标签
- **THEN** 值编辑器宽度 SHALL 填满本行；日期 / 日期时间 / 数字 / 布尔编辑器 SHALL 保留内在宽度

#### Scenario: 删除叉号悬停显现

- **WHEN** 用户查看字段行并将指针移入该行（或行内获得焦点 / 行被选中）
- **THEN** 删除叉号 `opacity` SHALL 为 1；默认态 SHALL 为 0，占位宽度保持不变

#### Scenario: 工具条中性表面

- **WHEN** 编辑态选中若干字段行，操作条出现
- **THEN** 操作条背景 SHALL 为中性表面色，且 SHALL NOT 与选中行高亮色相同

#### Scenario: 全选前置图标

- **WHEN** 用户查看「全选」按钮
- **THEN** 按钮文案前 SHALL 存在全选图标


### Requirement: P-5 标签彩色胶囊与建议输入

标签 SHALL 以彩色胶囊渲染：颜色由「标签名稳定哈希 → 精选预置色板」自动分配（同名同色、增删其他标签不漂移），SHALL NOT 提供手工改色。胶囊 SHALL 带标签形描边图标。编辑态标签可改名、可增删；改名/新增输入 SHALL 弹出**已有标签建议菜单**：↑↓ 换选、⏎ 选用选中项（无匹配时 Enter 用输入值）、⌘/Ctrl+1~9 直选，**选中行快捷键显示 ⏎、其余行显示 ⌘1~9**；菜单内 ⌘1~9 SHALL 优先于全局同名键段。**标签值区 SHALL 在点击进入编辑态时渲染输入框并弹出已有标签建议菜单；非编辑态 SHALL NOT 渲染输入框。输入框聚焦后 SHALL 直接弹出全部已有标签（无需先输入），列表可滚动。Enter 选用或新建后 SHALL 提交该标签、清空输入框并保持聚焦继续录入。标签胶囊 SHALL 可拖动调整顺序，SHALL 带删除图标（×）。**

#### Scenario: 稳定哈希配色

- **WHEN** 用户删除标签列表中间的一个标签
- **THEN** 其余标签颜色全部不变（按标签名哈希，不按位置）

#### Scenario: 建议菜单键盘选用

- **WHEN** 用户在标签输入框输入关键字，建议菜单出现匹配项
- **THEN** ↑↓ 移动高亮（选中行行尾快捷键显示 ⏎，其余 ⌘N），⏎ 选用高亮项，⌘2 直选第 2 项；无匹配时 Enter 以输入值新建

#### Scenario: 聚焦即列全部标签并连续录入

- **WHEN** 用户点击标签值区进入编辑态且输入框获得焦点
- **THEN** SHALL 直接弹出全部已有标签（无需先输入），列表可滚动；Enter 选用或新建后 SHALL 提交该标签、清空输入框并保持聚焦继续录入

#### Scenario: 标签拖动排序

- **WHEN** 用户拖动标签胶囊调整顺序
- **THEN** 标签顺序 SHALL 按拖动结果更新；每个标签胶囊 SHALL 带删除图标（×）


### Requirement: P-10 A/B 视觉锚点

面板视觉 SHALL 遵守设计系统：面板 SHALL 为**圆角卡片**内联在正文顶端，其宽度 SHALL 对齐正文测量宽度（`--type-measure` 口径），并随窗口宽度收缩；极端窄宽下字段 SHALL 换行而非横向溢出。卡片结构 SHALL 为：标题行（标题 + 标签胶囊 + 「+标签」）、操作行（添加字段 / 模板 / 全选 / 形态切换）、字段胶囊区、锁定字段区。A 一行条 / B 精排双列两态共享同一字段顺序与操作引擎；字段行采用 P-4 的单行胶囊结构（类型图标 | 字段名 | 值 | 叉号），A 胶囊列间距取设计系统 token（行手柄悬停显示于胶囊左外侧，不占布局）。**A 一行条字段胶囊 SHALL 为紧凑高度（垂直内距使胶囊高度 ≈ 文字行高 + 4px，取 `--dpb-chip-height`），SHALL NOT 继承正文行高形成大片留白**。**右侧按钮顺序两态一致**：A 与 B SHALL 均为「添加字段 → 模板 → 全选 → 形态切换」；折叠控件 SHALL NOT 位于右侧工具条，添加字段按钮索引 SHALL 为 0；**原「A 模式新建字段按钮位于末位」条款 SHALL 废止**。**footer 两态一致**：A 与 B 的底部 footer SHALL 均为「计数在左、托管日期在右」；**原「A footer 日期在左、计数在右」条款 SHALL 废止**。计数左缘 SHALL 与字段类型图标左缘对齐（B 模式越过 16px 手柄列）。**B 精排双列标签列 SHALL 固定为 8 个汉字宽（取 `--dpb-label-width`），名称左对齐、值列左对齐且各行左缘统一；任一名称超过 8 字时 SHALL 显示全名（SHALL NOT 省略），该列按面板内最长实际名称统一加宽，所有值列随之后移**；列间 SHALL NOT 渲染竖向分隔线。A 一行条胶囊遵循同一优先级：字段名在 cap 内完整显示、超出才省略号，值让位换行。**字段名与值字号 SHALL 随正文字号**（⌘+/- 同步变化），**字段值字重 SHALL 为常规（非粗体）**，**面板标题字号 SHALL 固定、不跟随正文字号**。**形态切换图标 SHALL 为字形语义**：A = L 形（左侧竖笔 + 底横向右伸出），B = T 形（顶横左右伸出 + 居中竖笔）。字段值两行截断（超两行隐藏）；**值被截断（两行截断或胶囊宽度截断）时 SHALL 以 `title` 属性暴露完整文本，A/B 两态一致**；B 预览态每行渲染静态类型图标并保持列位对齐；底部统计默认 SHALL 不可见（`opacity: 0`），指针进入「N 个字段」文字自身区域时 SHALL 显现。**footer 垂直内距 SHALL 取 design-system §3 间距刻度**；**footer 行高 SHALL 收至 `--dpb-footer-height`（约为上一版一半），SHALL NOT 因计数显隐改变布局高度**；**预览态字段计数 SHALL 与编辑态一致：无描边/无底色，同样默认不可见、指针进入文字自身区域时显现**；托管日期仍右对齐。

#### Scenario: 面板宽度跟随正文

- **WHEN** 用户在 1280 / 900 / 640 / 300 四档视口查看面板
- **THEN** 卡片宽度 SHALL 等于 `--type-measure`（容差 ≤2px），且页面横向溢出宽度 SHALL 为 0

#### Scenario: 窄宽换行不溢出

- **WHEN** 窗口宽度收缩到 300px
- **THEN** 面板内字段 SHALL 换行排列，SHALL NOT 出现横向滚动或裁切

#### Scenario: 按钮顺序两态一致

- **WHEN** 用户分别在 B 模式与 A 模式查看标题右侧按钮区
- **THEN** 两态按钮顺序 SHALL 均为「添加字段 → 模板 → 全选 → 形态切换」，添加字段按钮索引 SHALL 为 0；折叠控件 SHALL NOT 位于右侧工具条

#### Scenario: 新建字段按钮位次

- **WHEN** 用户分别在 B 模式与 A 模式查看标题右侧按钮区
- **THEN** 两态新建字段按钮索引 SHALL 均为 0（原「A 模式末位」口径已废止）

#### Scenario: footer 顺序两态一致

- **WHEN** 用户分别在 A / B 两态查看面板底部 footer
- **THEN** footer 顺序 SHALL 均为「计数在左、托管日期在右」，计数左缘 SHALL 与字段类型图标左缘对齐（B 模式越过 16px 手柄列）

#### Scenario: 字号跟随正文

- **WHEN** 用户按 ⌘+ / ⌘- 调整正文字号
- **THEN** 字段名与值的计算字号 SHALL 随正文字号同步变化，面板标题字号 SHALL 保持固定

#### Scenario: 形态切换图标语义

- **WHEN** 用户查看形态切换图标
- **THEN** A（L）形态 SHALL 为 L 形（左侧竖笔 + 底横向右伸出），B（T）形态 SHALL 为 T 形（顶横左右伸出 + 居中竖笔）

#### Scenario: B 预览态列位

- **WHEN** 用户在预览态查看 B 样式面板
- **THEN** 每行仍为胶囊结构（手柄/删除为占位），类型图标为静态不可点击，值列左缘对齐

#### Scenario: 截断值 title 全文

- **WHEN** 某字段值被两行截断或胶囊宽度截断
- **THEN** A/B 两态该值节点的 `title` SHALL 等于完整显示文本

#### Scenario: B 标签列随内容自适应

- **WHEN** 文档含长字段名与短字段名
- **THEN** B 行标签列宽随内容变化（不再固定 92px），长名在 cap 内完整显示、值列让位；行内无竖向分隔线

#### Scenario: B 标签列 8 字宽与超长加宽

- **WHEN** 文档字段名均不超过 8 个汉字
- **THEN** B 标签列 SHALL 固定为 8 个汉字宽（取 `--dpb-label-width`），名称左对齐、值列左对齐且各行左缘统一

- **WHEN** 某字段名超过 8 个汉字
- **THEN** 该列 SHALL 显示全名（SHALL NOT 省略），并按面板内最长实际名称统一加宽，所有值列随之后移

#### Scenario: 值字重常规

- **WHEN** 用户查看字段值
- **THEN** 值的计算字重为常规（非粗体），字号与字段名一致并随正文字号同步

#### Scenario: 预览计数胶囊

- **WHEN** 用户在预览态查看 footer 计数
- **THEN** 计数 SHALL 与编辑态一致：无描边/无底色，默认不可见、指针进入文字自身区域时显现；托管日期仍右对齐


### Requirement: 托管日期只读展示

托管日期（`created` / `updated`）SHALL 经 `isManagedDateKey` 从可编辑字段列表排除，SHALL NOT 作为字段行渲染。两日期 SHALL 以**只读形式**展示，带锁图标、SHALL NOT 出现输入框、SHALL NOT 可点击编辑。**新增值区输入能力 SHALL NOT 作用于托管日期**：`created` / `updated` SHALL NOT 渲染文本输入、SHALL NOT 接受键入或粘贴、双击 SHALL NOT 打开日期面板。**A 一行条模式与 B 精排双列模式的 footer SHALL 一致：计数在左、托管日期在右，计数默认不可见、指针进入计数文字自身区域时显现**（日期存在才追加）。**锁图标尺寸 SHALL 小于其他面板图标一档**。日期与计数 SHALL 使用更浅一档颜色；**计数默认低对比，footer 悬停或聚焦时 SHALL 恢复可读对比**。日期值 SHALL 取自 frontmatter，保存时由既有逻辑维护，SHALL NOT 新引入文件系统时间读取；frontmatter 缺失对应键时 SHALL NOT 渲染空壳。

#### Scenario: A 模式 footer 左侧只读日期

- **WHEN** 用户在 A 一行条模式查看含 `created` / `updated` 的文档
- **THEN** 底部 footer SHALL 显示「计数在左、创建/修改日期在右」，带锁图标，无可编辑输入框（原「日期在左」口径已废止）

#### Scenario: B 模式备注行右侧只读日期

- **WHEN** 用户在 B 精排双列模式查看含 `created` / `updated` 的文档
- **THEN** 备注行 SHALL 显示两日期在右、计数在左，带锁图标，无可编辑输入框

#### Scenario: footer 两态一致且计数恒显示

- **WHEN** 用户在 A 一行条模式或 B 精排双列模式查看含 `created` / `updated` 的文档
- **THEN** 两态 footer SHALL 一致显示「计数在左、托管日期在右」，计数默认不可见、指针进入计数文字自身区域时显现，带锁图标，无可编辑输入框

#### Scenario: 托管日期排除出字段行

- **WHEN** 文档含 `created` / `updated`
- **THEN** 两日期 SHALL NOT 作为字段行渲染，字段计数「N 个字段」SHALL NOT 计入日期

#### Scenario: 缺失日期不渲染空壳

- **WHEN** frontmatter 缺失 `created` 或 `updated`
- **THEN** 对应位置 SHALL NOT 渲染空壳日期项，仅渲染存在的日期

#### Scenario: 锁图标更小且计数弱化

- **WHEN** 用户查看 footer 的锁图标与计数
- **THEN** 锁图标渲染尺寸 SHALL 小于其他面板图标一档；计数默认低对比，footer 悬停或聚焦时 SHALL 恢复可读对比

#### Scenario: 托管日期无输入与双击入口

- **WHEN** 用户在编辑态对 footer 的 `created` / `updated` 键入、粘贴或双击
- **THEN** SHALL NOT 出现文本输入框或日期面板，日期值 SHALL 保持不变


### Requirement: 控件悬停显隐与折叠淡出

标签删除叉号、L/T 形态切换按钮 SHALL 默认不可见（`opacity: 0`），所在行 / 胶囊 / 工具条悬停（`:hover`）或获得焦点（`:focus-within` / `:focus-visible`）时 SHALL 可见；键盘 Tab 聚焦到该控件 SHALL 直接可见。**折叠倒三角 SHALL 默认不可见（`opacity: 0`），标题行悬停（`:hover`）或面板获得焦点（`:focus-within`）时 SHALL 可见；折叠态 SHALL 保持可见。**行拖拽手柄与行尾删除叉号 SHALL 维持既有悬停显隐（占位宽度不变）。面板折叠态 SHALL 完全透明（`opacity: 0`），悬停或聚焦时恢复 1；显隐 SHALL 只改透明度，SHALL NOT 改变布局高度（不回流）。

#### Scenario: 标签叉号悬停显现

- **WHEN** 用户悬停某个标签胶囊
- **THEN** 该标签的删除叉号 `opacity` SHALL 为 1；未悬停时为 0；Tab 聚焦到叉号时同样为 1

#### Scenario: 工具条按钮悬停显现

- **WHEN** 用户悬停属性面板工具条
- **THEN** L/T 形态切换按钮 `opacity` SHALL 为 1；未悬停时为 0；键盘聚焦到该按钮时可见

#### Scenario: 折叠态全透明

- **WHEN** 面板处于折叠态且指针不在面板内
- **THEN** 面板计算 `opacity` SHALL 为 0；悬停或聚焦时为 1；折叠切换 SHALL NOT 因透明度规则改变布局高度

## ADDED Requirements

### Requirement: P-11 页签信息窗字段显隐入口

页签信息窗 SHALL 在路径行下方新增字段显隐行：文案为「隐藏字段」或「显示字段」（随当前态切换）+「N 个字段」+ 快捷键说明 `⌘⇧Y`。点击 SHALL 切换属性面板显隐（复用 `docPropertyPanel.hidden`，SHALL NOT 新增持久化键）。`N` SHALL 与属性面板 footer 的字段计数同源（同一解析结果），SHALL NOT 单独维护计数。显隐行 SHALL 在按钮前置状态图标：面板可见（按钮「隐藏字段」）SHALL 使用 `eyeOff`，面板隐藏（按钮「显示字段」）SHALL 使用 `eye`；两图标 SHALL 经 `src/ui/icons.ts` 注册表渲染并成对存在（可逆动作成对），SHALL NOT 内联一次性 SVG。该行 SHALL 仅在该信息窗所属页签为当前活动页签时渲染；非活动页签 SHALL NOT 渲染该行（避免改变当前文档的显隐）。隐藏态下 SHALL NOT 在文档顶部渲染恢复提示条（见 P-1）。

#### Scenario: 隐藏后从信息窗恢复

- **WHEN** 用户按 `⌘⇧Y` 隐藏属性面板后打开当前页签信息窗
- **THEN** 字段显隐行文案为「显示字段」，点击 SHALL 恢复属性面板显示；正文 SHALL NOT 出现恢复提示条

#### Scenario: 计数同源

- **WHEN** 用户查看页签信息窗的字段显隐行
- **THEN** 「N 个字段」的 N SHALL 与属性面板 footer 计数同源（同一解析结果），SHALL NOT 单独维护计数

#### Scenario: 非活动页签不渲染

- **WHEN** 用户打开非当前活动页签的信息窗
- **THEN** 该信息窗 SHALL NOT 渲染字段显隐行

#### Scenario: 快捷键说明存在

- **WHEN** 用户查看字段显隐行
- **THEN** 该行 SHALL 含快捷键说明 `⌘⇧Y`


