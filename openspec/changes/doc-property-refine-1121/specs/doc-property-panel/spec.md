# doc-property-panel 能力增量规格

## MODIFIED Requirements

### Requirement: P-3 字段类型系统与智能编辑

字段 SHALL 支持八类类型：文本、数字、日期、日期时间、下拉（选项可维护）、复选（多选）、布尔、列表（`[[` 文档链接）。类型选择器 SHALL 为字段名前的无边框纯图标（日期 = 日历 SVG、日期时间 = 时钟 SVG、列表 = 列表类图标，描边 1.7px），点击弹出图标+文字菜单直选。值编辑器 SHALL 按类型智能渲染：文本框（超 40 字符自动切多行文本域）、数字框、日期选择、日期时间选择、下拉、复选组、布尔开关、`[[` 文档链接菜单。**日期时间字段 SHALL 提供单一面板选择器**（一个 popover 内同时完成日期与时间选择）：面板 SHALL 含月历网格（选日期）与时分步进控件（选时间）；提交时 SHALL 把日期与时间组合为 `YYYY-MM-DDTHH:mm`，SHALL NOT 使用分离的「日期控件 + 时间控件」双控件。日期字段保持仅日期（不扩时间）。面板 SHALL 键盘可达（Tab 在月历与时分控件间移动、Enter 提交、Esc 取消）；面板内操作 SHALL NOT 触发提前提交，SHALL 沿用既有值编辑器 onBlur 提交链路（面板关闭或失焦时提交）。写回前 SHALL 按类型做 YAML 合法性校验（数字为数值字面量、布尔为 `true/false`、日期为 `YYYY-MM-DD`、日期时间为 `YYYY-MM-DDTHH:mm`），非法输入 SHALL 还原原值并提示。**空值字段的值节点 SHALL NOT 渲染占位横线（如 `—`）或任何假值文案**，空态只以空白表示。**布尔字段的值内 SHALL NOT 出现「开/关」文字**：显示态与编辑态值内仅保留状态图形（true `◉` / false `○`），状态文案 SHALL 移至 `title` 提示（`已开启` / `已关闭`），编辑态 SHALL 保留 `role="switch"` 与 `aria-checked`/`aria-label` 状态语义。**空值字段的类型 SHALL 默认为 `text`**（不再回落未知类型）；列表类型字段遇到非数组值时 SHALL 按单元素序列化展示与写回，SHALL NOT 抛错或崩溃。**日期字段 SHALL 改用与日期时间相同的自绘面板**（仅日期、无时分，提交 `YYYY-MM-DD`），SHALL NOT 使用原生 `date` 控件。**日期时间字段的展示格式 SHALL 为 `YYYY-MM-DD HH:mm`**（秒非 `00` 时才附 `:ss`，SHALL NOT 显示毫秒或时区后缀，YAML 原值不改写）。**面板内按 Tab 键 SHALL 在面板控件间移动焦点，SHALL NOT 把 Tab 写入正文**。

#### Scenario: 类型切换后编辑器随变

- **WHEN** 用户把某字段类型从文本切换为日期
- **THEN** 值编辑器变为日期选择器，切「源码」可核对该键写回为 YAML 日期字面量

#### Scenario: 日期时间为单一面板

- **WHEN** 用户在日期时间字段点击值编辑器
- **THEN** SHALL 出现一个面板，同一面板内同时含月历网格与时分步进控件；SHALL NOT 出现分离的日期控件与时间控件

#### Scenario: 面板组合提交

- **WHEN** 用户在面板内选定日期 2026-11-18 与时间 14:30 后提交
- **THEN** 该字段值 SHALL 等于 `2026-11-18T14:30`

#### Scenario: 面板键盘可达

- **WHEN** 面板打开后用户按 Tab 在月历与时分控件间移动，按 Enter 提交，按 Esc 取消
- **THEN** 焦点在月历与分时控件间移动；Enter 提交组合值；Esc 取消并回到原值

#### Scenario: 面板内操作不提前提交

- **WHEN** 用户在面板内点击月历或步进控件
- **THEN** 字段值 SHALL NOT 立即写回；面板关闭或失焦时 SHALL 提交

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

- **WHEN** 用户点击日期字段的值编辑器
- **THEN** SHALL 出现与日期时间共用的自绘面板（仅日期、无时分），提交值 SHALL 为 `YYYY-MM-DD`；SHALL NOT 出现原生 `date` 控件

#### Scenario: 面板 Tab 不写入正文

- **WHEN** 光标在日期时间面板的时/分输入框内按 Tab
- **THEN** 焦点 SHALL 在面板控件间移动，正文 SHALL NOT 被写入缩进，文档首字符 SHALL 仍为 `-`

#### Scenario: 空值默认文本

- **WHEN** frontmatter 某键值为空且未命中别称
- **THEN** 该字段类型 SHALL 为 `text`，SHALL NOT 显示未知类型

#### Scenario: 非数组值按单元素列表

- **WHEN** frontmatter 含 `tags: "#"`
- **THEN** 该字段 SHALL 按单元素列表展示，抛错次数 SHALL 为 0

### Requirement: P-4 字段行操作与选择模式

编辑态每个字段行 SHALL 带**行手柄**：**点击行手柄选中**（可多选、全选），拖动排序，选中临近多行后拖动 SHALL 整块移动（拖拽阈值 5px 区分点击，拖动显示落点指示线）。字段行 SHALL 为**单行胶囊**结构：类型图标 + 字段名 + 值同行排列，字段名输入框固定单行高度、SHALL NOT 随内容撑高；行尾控件 SHALL 为**叉号（关闭语义）**，点击移除该行字段（沿用单一事务写回、可撤销）；**锁定字段（创建/修改日期）SHALL NOT 渲染删除与改名入口，并 SHALL 显示锁图标**。**选中高亮 SHALL 覆盖整块（含值）**：选中行整行（含类型图标、字段名与值）以高亮样式呈现；**值文本节点 SHALL NOT 属于可选中单位**（SHALL NOT 单独选中、SHALL NOT 进入全选），仅随所在行高亮。**改名入口**：无选中项时，单击字段名 SHALL 进入就地改名（Enter / Space 亦可），Enter / 失焦提交、Esc 取消；**已选中任一字段后，点击其他字段行任意位置（含字段名）SHALL 切换该行选中**（选中/取消），SHALL NOT 进入改名或值编辑——此为既有行为，SHALL 保留。选中后 SHALL 出现图标操作条：复制 / 剪切 / 粘贴（插入所选行下方，粘贴键名自动去重）/ 上移 / 下移 / 删除 / 取消。**选中集复制载荷 SHALL 仅含字段类型 + 字段名称 + 未来字段属性，SHALL NOT 含值**；粘贴 SHALL 在目标文档重建同定义字段（同类型、同名、同未来属性）、**值为空**。**操作条与行内操作图标 SHALL 统一经仓库图标注册表（`src/ui/icons` 的 `iconSvg`）渲染**，SHALL NOT 使用 Unicode 字形或组件内联一次性 SVG；新增图标概念 SHALL 先补 `docs/design/system/spec.md` §2.3 条款再注册（24×24 viewBox、笔画 1.7、尺寸档 14/18/24）。**「全选」按钮 SHALL 为二态**：**可选中单位 SHALL 限定为字段名称与标签两类节点，值文本节点 SHALL NOT 参与选中**；0 个选中时按钮文案为「全选」，≥1 个选中时按钮文案为「反选」，按钮文案 SHALL 与当前选中集合一致；**「反选」SHALL 为反转当前选择集**（已选的取消、未选的选上），全选 SHALL 选中全部字段名与标签（标题位可手动选中，不进入全选）。**选择模式**：存在选中项时，行内一切点击（值、选项、类型图标、删除键）SHALL 变为选中/取消切换且不进入编辑，行 hover SHALL 显示选中提示（L/T 两态统一）；单击行外空白 SHALL 清空选中。**行内 SHALL NOT 渲染字段类型文字**，类型只由图标表达；类型图标、字段名与值 SHALL 垂直居中对齐。**文本 / 多行 / 列表 / 标签值编辑器宽度 SHALL 填满本行**，日期 / 日期时间 / 数字 / 布尔编辑器 SHALL 保留内在宽度。**行末尾删除叉号默认 SHALL 不可见**，行悬停、行内焦点或行选中时 SHALL 可见，占位宽度 SHALL 保持不变。**选中操作条 SHALL 使用中性表面色**，SHALL NOT 与选中行同色。**「全选」按钮 SHALL 前置全选图标**。

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
- **THEN** 七个按钮图标均为 `iconSvg` 渲染的 SVG（与 MD 横向工具条同一来源），按钮内无 Unicode 字形文本

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

### Requirement: P-6 字段名编辑与别称识别

字段名 SHALL 可就地改名（改的就是 YAML 键，冲突校验拦截重名）；显示 SHALL 为输入原样（输入中文显示中文、输入英文显示英文）。**别称表** SHALL 为**应用级可维护配置** `AppConfig.propAliasMap`（键名 → 类型映射）：解析 frontmatter 时命中即自动赋予对应类型，SHALL NOT 改写字段显示名、SHALL NOT 重命名用户 YAML 键；未命中的键回落到内置默认集合（由 `ALIAS`/`CANON_TYPE` 常量转来的 8 组预设）。`propAliasMap` SHALL 经 Rust `validate_config` 白名单校验（值为八类类型枚举、键名合法），SHALL 支持设置区管理与热应用。创建/修改日期（`created`/`updated`）SHALL 自动托管、只读、键名锁定，格式复用 `todayStamp()`；`updated` 仅在内容保存时刷新。**内置别称 SHALL 含以下映射**：`type → select`、`source_kind → select`、`captured_via → text`、`ingested_via → text`、`captured_at → datetime`、`ingested_at → datetime`、`read_date → date`、`rating → number`、`book_title → text`。**`title` 字段的显示与编辑 SHALL NOT 包含文档扩展名**（`.md` / `.markdown` / `.txt`）。

#### Scenario: 输入原样显示

- **WHEN** 用户把某字段改名为英文 `priority`
- **THEN** 面板显示 `priority`，源码中 YAML 键为 `priority`；不显示任何中文归一名

#### Scenario: 外部键类型识别

- **WHEN** 打开含 `createdate: 2026-11-14` 的外部文件
- **THEN** 该键自动识别为日期类型（图标为日历 SVG），显示名保持 `createdate` 原样

#### Scenario: 配置映射优先于内置默认

- **WHEN** 用户在设置中新增映射 `customdate → 日期` 后打开含 `customdate: 2026-11-17` 的外部文件
- **THEN** 该键自动识别为日期类型、显示名保持 `customdate` 原样；改配置后重新打开即生效（热应用）

#### Scenario: 映射恢复默认

- **WHEN** 用户点击映射区「恢复默认」
- **THEN** 自定义映射被清空，映射表现回内置 9 组（`createdate` 等重新可识别）

#### Scenario: 自动托管日期只读

- **WHEN** 用户在编辑态查看创建/修改日期字段
- **THEN** 两字段不可编辑、不可改名、不可删除；保存正文后修改日期自动刷新

#### Scenario: 内置别称识别

- **WHEN** 打开含 `read_date: 2026-11-18` 的外部文件
- **THEN** 该键自动识别为日期类型（日历图标），显示名保持 `read_date` 原样

#### Scenario: 标题不含扩展名

- **WHEN** 文档标题为 `笔记.md`，用户查看或编辑属性面板的标题字段
- **THEN** 显示与编辑态 SHALL 只呈现主名 `笔记`，SHALL NOT 含 `.md` / `.markdown` / `.txt`

### Requirement: P-10 A/B 视觉锚点

面板视觉 SHALL 遵守设计系统：面板 SHALL 为**圆角卡片**内联在正文顶端，其宽度 SHALL 对齐正文测量宽度（`--type-measure` 口径），并随窗口宽度收缩；极端窄宽下字段 SHALL 换行而非横向溢出。卡片结构 SHALL 为：标题行（标题 + 标签胶囊 + 「+标签」）、操作行（添加字段 / 模板 / 全选 / 折叠 / 形态切换）、字段胶囊区、锁定字段区。A 一行条 / B 精排双列两态共享同一字段顺序与操作引擎；字段行采用 P-4 的单行胶囊结构（类型图标 | 字段名 | 值 | 叉号），A 胶囊列间距取设计系统 token（行手柄悬停显示于胶囊左外侧，不占布局）。**右侧按钮顺序两态一致**：A 与 B SHALL 均为「添加字段 → 模板 → 全选 → 折叠 → 形态切换」，添加字段按钮索引 SHALL 为 0；**原「A 模式新建字段按钮位于末位」条款 SHALL 废止**。**footer 两态一致**：A 与 B 的底部 footer SHALL 均为「计数在左、托管日期在右」；**原「A footer 日期在左、计数在右」条款 SHALL 废止**。计数左缘 SHALL 与字段类型图标左缘对齐（B 模式越过 16px 手柄列）。**字段名与值字号 SHALL 随正文字号**（⌘+/- 同步变化），**面板标题字号 SHALL 固定、不跟随正文字号**。**形态切换图标 SHALL 为字形语义**：A = L 形（左侧竖笔 + 底横向右伸出），B = T 形（顶横左右伸出 + 居中竖笔）。字段值两行截断（超两行隐藏、滑入 title 显示全部）；B 预览态每行渲染静态类型图标并保持列位对齐；底部统计显示全部字段数。

#### Scenario: 面板宽度跟随正文

- **WHEN** 用户在 1280 / 900 / 640 / 300 四档视口查看面板
- **THEN** 卡片宽度 SHALL 等于 `--type-measure`（容差 ≤2px），且页面横向溢出宽度 SHALL 为 0

#### Scenario: 窄宽换行不溢出

- **WHEN** 窗口宽度收缩到 300px
- **THEN** 面板内字段 SHALL 换行排列，SHALL NOT 出现横向滚动或裁切

#### Scenario: 按钮顺序两态一致

- **WHEN** 用户分别在 B 模式与 A 模式查看标题右侧按钮区
- **THEN** 两态按钮顺序 SHALL 均为「添加字段 → 模板 → 全选 → 折叠 → 形态切换」，添加字段按钮索引 SHALL 为 0

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

### Requirement: 托管日期只读展示

托管日期（`created` / `updated`）SHALL 经 `isManagedDateKey` 从可编辑字段列表排除，SHALL NOT 作为字段行渲染。两日期 SHALL 以**只读形式**展示，带锁图标、SHALL NOT 出现输入框、SHALL NOT 可点击编辑。**A 一行条模式与 B 精排双列模式的 footer SHALL 一致：计数在左、托管日期在右，计数恒显示**（日期存在才追加）。**锁图标尺寸 SHALL 小于其他面板图标一档**。日期与计数 SHALL 使用更浅一档颜色；**计数默认低对比，footer 悬停或聚焦时 SHALL 恢复可读对比**。日期值 SHALL 取自 frontmatter，保存时由既有逻辑维护，SHALL NOT 新引入文件系统时间读取；frontmatter 缺失对应键时 SHALL NOT 渲染空壳。

#### Scenario: footer 两态一致且计数恒显示

- **WHEN** 用户在 A 一行条模式或 B 精排双列模式查看含 `created` / `updated` 的文档
- **THEN** 两态 footer SHALL 一致显示「计数在左、托管日期在右」，计数恒可见，带锁图标，无可编辑输入框

#### Scenario: 托管日期排除出字段行

- **WHEN** 文档含 `created` / `updated`
- **THEN** 两日期 SHALL NOT 作为字段行渲染，字段计数「N 个字段」SHALL NOT 计入日期

#### Scenario: 缺失日期不渲染空壳

- **WHEN** frontmatter 缺失 `created` 或 `updated`
- **THEN** 对应位置 SHALL NOT 渲染空壳日期项，仅渲染存在的日期

#### Scenario: 锁图标更小且计数弱化

- **WHEN** 用户查看 footer 的锁图标与计数
- **THEN** 锁图标渲染尺寸 SHALL 小于其他面板图标一档；计数默认低对比，footer 悬停或聚焦时 SHALL 恢复可读对比

## ADDED Requirements

### Requirement: frontmatter 解析容错与外部文档适配

frontmatter 解析 SHALL 先尝试整块 YAML 解析；**整块解析失败时 SHALL 逐条顶层键兜底解析**，单条解析失败 SHALL 保留原文按文本展示，SHALL NOT 丢弃其他字段。不可解析块的编辑 SHALL 只改写目标键的连续行块，其余字节 SHALL 保持原样。**「声明列表但值为字符串」的输入**（如 `tags: "#"`）SHALL 按单元素列表展示，SHALL NOT 抛错或导致窗格崩溃。

#### Scenario: 整块失败逐条兜底

- **WHEN** frontmatter 含模板占位（如 `{{date}}`）导致整块 YAML 解析失败
- **THEN** 面板 SHALL 逐条顶层键兜底解析并显示各字段，SHALL NOT 显示「0 个字段」或整块丢失

#### Scenario: 单条失败保留原文

- **WHEN** 某顶层键的值不可解析
- **THEN** 该键 SHALL 保留原文按文本类型展示，其余键 SHALL 正常解析

#### Scenario: 行级写回不丢字节

- **WHEN** 文档整块不可解析，用户编辑其中一个键的值
- **THEN** SHALL 只改写该键的连续行块，其余字节（含注释、缩进、模板占位）SHALL 逐字节保持原样

#### Scenario: 字符串列表值不崩

- **WHEN** 文档含 `tags: "#"`
- **THEN** 面板 SHALL 按单元素列表展示该字段，抛错次数 SHALL 为 0
