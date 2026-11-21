# doc-property-panel 能力增量规格

## MODIFIED Requirements

### Requirement: P-3 字段类型系统与智能编辑

字段 SHALL 支持八类类型：文本、数字、日期、日期时间、下拉（选项可维护）、复选（多选）、布尔、列表（`[[` 文档链接）。类型选择器 SHALL 为字段名前的无边框纯图标（日期 = 日历 SVG、日期时间 = 时钟 SVG、列表 = 列表类图标，描边 1.7px），点击弹出图标+文字菜单直选。值编辑器 SHALL 按类型智能渲染：文本框（超 40 字符自动切多行文本域）、数字框、日期选择、日期时间选择、下拉、复选组、布尔开关、`[[` 文档链接菜单。**日期时间字段 SHALL 提供单一面板选择器**（一个 popover 内同时完成日期与时间选择）：面板 SHALL 含月历网格（选日期）与时分步进控件（选时间）；提交时 SHALL 把日期与时间组合为 `YYYY-MM-DDTHH:mm`，SHALL NOT 使用分离的「日期控件 + 时间控件」双控件。日期字段保持仅日期（不扩时间）。面板 SHALL 键盘可达（Tab 在月历与时分控件间移动、Enter 提交、Esc 取消）；面板内操作 SHALL NOT 触发提前提交，SHALL 沿用既有值编辑器 onBlur 提交链路（面板关闭或失焦时提交）。写回前 SHALL 按类型做 YAML 合法性校验（数字为数值字面量、布尔为 `true/false`、日期为 `YYYY-MM-DD`、日期时间为 `YYYY-MM-DDTHH:mm`），非法输入 SHALL 还原原值并提示。**空值字段的值节点 SHALL NOT 渲染占位横线（如 `—`）或任何假值文案**，空态只以空白表示。**布尔字段的值内 SHALL NOT 出现「开/关」文字**：显示态与编辑态值内仅保留状态图形（true `◉` / false `○`），状态文案 SHALL 移至 `title` 提示（`已开启` / `已关闭`），编辑态 SHALL 保留 `role="switch"` 与 `aria-checked`/`aria-label` 状态语义。**空值字段与纯字符串字段的类型 SHALL 默认为 `text`**（空串、以及非日期/日期时间的纯字符串都不再回落未知类型；`unknown` 只保留给无法推断的非字符串值）；列表类型字段遇到非数组值时 SHALL 按单元素序列化展示与写回，SHALL NOT 抛错或崩溃。**日期字段 SHALL 改用与日期时间相同的自绘面板**（仅日期、无时分，提交 `YYYY-MM-DD`），SHALL NOT 使用原生 `date` 控件。**日期时间字段的展示格式 SHALL 为 `YYYY-MM-DD HH:mm`**（秒非 `00` 时才附 `:ss`，SHALL NOT 显示毫秒或时区后缀，YAML 原值不改写）。**面板内按 Tab 键 SHALL 在面板控件间移动焦点，SHALL NOT 把 Tab 写入正文**。**日期与日期时间面板底部提示（`.dpb-dt-foot` 内的 `.dpb-dt-hint`）SHALL 默认隐藏（`opacity: 0`），指针进入整条 footer 行或 footer 获得键盘焦点（`:focus-within` / `:focus-visible`）时 SHALL 显现；显隐 SHALL 只改透明度，SHALL NOT 改变 footer 与面板高度（无回流）**；两个选择器共用同一 footer，SHALL 一致生效；既有 Esc 取消 / Enter 保存 / 点击外部保存行为 SHALL 不变。

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

### Requirement: P-8 外部未识别字段收编

打开外部来源文件时，**无法推断类型的非字符串值**（如 YAML 映射）SHALL 以「?（未识别）」类型显示、值原样保留不丢失；纯字符串已按 P-3 归为 `text`，SHALL NOT 落入「?」。用户点击「?」图标选择目标类型即**收编**（值按类型转换，转换失败 SHALL 保留原文并提示）。

#### Scenario: 未识别键收编

- **WHEN** 外部文件含值为 YAML 映射、无法推断类型的键，用户点其「?」图标选择目标类型
- **THEN** 该字段转为所选类型并可编辑，原值不丢失；转换失败时 SHALL 保留原文并提示

### Requirement: P-9 frontmatter 写回与数据无损

面板编辑 SHALL 经解析→状态→序列化单事务写回文档前部的 `--- ... ---` 块（CM6 事务，可撤销，与正文编辑一致）；未在面板预置的自由键 SHALL NOT 丢失；无 frontmatter 的文档 SHALL NOT 渲染空态引导文案（不显示「暂无 frontmatter 属性」类的说明或内嵌添加按钮）；首次添加字段时自动创建 frontmatter 块。

#### Scenario: 自由键不丢

- **WHEN** 文档 frontmatter 含面板未预置的自由键 `custom-note: x`，用户编辑其他字段后保存
- **THEN** `custom-note: x` 在源码中保持不变

#### Scenario: 撤销面板编辑

- **WHEN** 用户修改字段值后按 Ctrl+Z
- **THEN** 源码回退到修改前状态，面板随源码重新解析

### Requirement: P-10 A/B 视觉锚点

面板视觉 SHALL 遵守设计系统：面板 SHALL 为**圆角卡片**内联在正文顶端，其宽度 SHALL 对齐正文测量宽度（`--type-measure` 口径），并随窗口宽度收缩；极端窄宽下字段 SHALL 换行而非横向溢出。卡片结构 SHALL 为：标题行（标题 + 标签胶囊 + 「+标签」）、操作行（添加字段 / 模板 / 全选 / 折叠 / 形态切换）、字段胶囊区、锁定字段区。A 一行条 / B 精排双列两态共享同一字段顺序与操作引擎；字段行采用 P-4 的单行胶囊结构（类型图标 | 字段名 | 值 | 叉号），A 胶囊列间距取设计系统 token（行手柄悬停显示于胶囊左外侧，不占布局）。**右侧按钮顺序两态一致**：A 与 B SHALL 均为「添加字段 → 模板 → 全选 → 折叠 → 形态切换」，添加字段按钮索引 SHALL 为 0；**原「A 模式新建字段按钮位于末位」条款 SHALL 废止**。**footer 两态一致**：A 与 B 的底部 footer SHALL 均为「计数在左、托管日期在右」；**原「A footer 日期在左、计数在右」条款 SHALL 废止**。计数左缘 SHALL 与字段类型图标左缘对齐（B 模式越过 16px 手柄列）。**B 精排双列标签列宽 SHALL 随内容自适应**（上限取 design-system §7.2 `--dpb-label-max-width`），值列让位；列间 SHALL NOT 渲染竖向分隔线。A 一行条胶囊遵循同一优先级：字段名在 cap 内完整显示、超出才省略号，值让位换行。**字段名与值字号 SHALL 随正文字号**（⌘+/- 同步变化），**字段值字重 SHALL 为常规（非粗体）**，**面板标题字号 SHALL 固定、不跟随正文字号**。**形态切换图标 SHALL 为字形语义**：A = L 形（左侧竖笔 + 底横向右伸出），B = T 形（顶横左右伸出 + 居中竖笔）。字段值两行截断（超两行隐藏）；**值被截断（两行截断或胶囊宽度截断）时 SHALL 以 `title` 属性暴露完整文本，A/B 两态一致**；B 预览态每行渲染静态类型图标并保持列位对齐；底部统计显示全部字段数。**footer 垂直内距 SHALL 取 design-system §3 间距刻度**；**预览态字段计数 SHALL 渲染为左对齐胶囊**（描边 + 全圆角），编辑态保持纯文本；托管日期仍右对齐。

#### Scenario: 面板宽度跟随正文

- **WHEN** 用户在 1280 / 900 / 640 / 300 四档视口查看面板
- **THEN** 卡片宽度 SHALL 等于 `--type-measure`（容差 ≤2px），且页面横向溢出宽度 SHALL 为 0

#### Scenario: 窄宽换行不溢出

- **WHEN** 窗口宽度收缩到 300px
- **THEN** 面板内字段 SHALL 换行排列，SHALL NOT 出现横向滚动或裁切

#### Scenario: 按钮顺序两态一致

- **WHEN** 用户分别在 B 模式与 A 模式查看标题右侧按钮区
- **THEN** 两态按钮顺序 SHALL 均为「添加字段 → 模板 → 全选 → 折叠 → 形态切换」，添加字段按钮索引 SHALL 为 0

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

#### Scenario: 值字重常规

- **WHEN** 用户查看字段值
- **THEN** 值的计算字重为常规（非粗体），字号与字段名一致并随正文字号同步

#### Scenario: 预览计数胶囊

- **WHEN** 用户在预览态查看 footer 计数
- **THEN** 计数渲染为左对齐胶囊（有描边、全圆角）；编辑态为纯文本；托管日期仍右对齐

### Requirement: 添加字段控件区

编辑态点「添加字段」SHALL 展开**字段控件区**（调色板）：控件区位于面板左侧，窄宽时改到工具条区；清单 SHALL 为八类类型联合，每项复用既有类型图标与类型文案。用户把控件拖入字段区的落点后，SHALL 在该位置插入一个**对应类型的空字段**并进入字段名编辑态；拖放落点 SHALL 复用现有行排序的落点计算。插入 SHALL 是**一次可撤销**的单一事务写回。控件区展开/关闭 SHALL NOT 修改文档内容。**页签右键菜单 SHALL 提供「添加字段」命令**，点击后打开该页签文档的字段调色板并关闭菜单；分屏下 SHALL 只打开被右键页签对应文档的面板。

#### Scenario: 控件区展开

- **WHEN** 用户点击「添加字段」
- **THEN** 控件区 SHALL 出现，含八类类型项，每项带类型图标与文案

#### Scenario: 拖入生成对应类型字段

- **WHEN** 用户把「日期」控件拖到两个字段行之间释放
- **THEN** 落点处 SHALL 出现一个日期类型的空字段，类型图标为日历，字段名进入编辑态

#### Scenario: 插入可一次撤销

- **WHEN** 用户拖入一个新字段后按 Ctrl+Z
- **THEN** 该字段 SHALL 消失，文档 frontmatter 恢复到插入前状态

#### Scenario: 关闭控件区不改文档

- **WHEN** 用户展开控件区后再次点击「添加字段」或点击外部关闭
- **THEN** 控件区 SHALL 收起，文档内容 SHALL 保持不变

#### Scenario: 页签右键打开调色板

- **WHEN** 用户右键某页签并点击「添加字段」
- **THEN** 该页签文档的字段调色板 SHALL 打开、菜单 SHALL 关闭；Esc 或点击外部 SHALL 收起调色板

## ADDED Requirements

### Requirement: 控件悬停显隐与折叠淡出

标签删除叉号、L/T 形态切换按钮与折叠按钮 SHALL 默认不可见（`opacity: 0`），所在行 / 胶囊 / 工具条悬停（`:hover`）或获得焦点（`:focus-within` / `:focus-visible`）时 SHALL 可见；键盘 Tab 聚焦到该控件 SHALL 直接可见。行拖拽手柄与行尾删除叉号 SHALL 维持既有悬停显隐（占位宽度不变）。面板折叠态 SHALL 完全透明（`opacity: 0`），悬停或聚焦时恢复 1；显隐 SHALL 只改透明度，SHALL NOT 改变布局高度（不回流）。

#### Scenario: 标签叉号悬停显现

- **WHEN** 用户悬停某个标签胶囊
- **THEN** 该标签的删除叉号 `opacity` SHALL 为 1；未悬停时为 0；Tab 聚焦到叉号时同样为 1

#### Scenario: 工具条按钮悬停显现

- **WHEN** 用户悬停属性面板工具条
- **THEN** L/T 形态切换按钮与折叠按钮 `opacity` SHALL 为 1；未悬停时为 0；键盘聚焦到任一按钮时可见

#### Scenario: 折叠态全透明

- **WHEN** 面板处于折叠态且指针不在面板内
- **THEN** 面板计算 `opacity` SHALL 为 0；悬停或聚焦时为 1；折叠切换 SHALL NOT 因透明度规则改变布局高度
