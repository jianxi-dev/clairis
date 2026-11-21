# doc-property-panel 能力增量规格

## MODIFIED Requirements

### Requirement: P-3 字段类型系统与智能编辑

字段 SHALL 支持八类类型：文本、数字、日期、日期时间、下拉（选项可维护）、复选（多选）、布尔、列表（`[[` 文档链接）。类型选择器 SHALL 为字段名前的无边框纯图标（日期 = 日历 SVG、日期时间 = 时钟 SVG、列表 = 列表类图标，描边 1.7px），点击弹出图标+文字菜单直选。值编辑器 SHALL 按类型智能渲染：文本框（超 40 字符自动切多行文本域）、数字框、日期选择、日期时间选择、下拉、复选组、布尔开关、`[[` 文档链接菜单。**日期与日期时间字段在编辑态的值区 SHALL 渲染为可编辑文本控件**：点击值区 SHALL 打开自绘面板；值区 SHALL 接受直接键入与粘贴；控件 SHALL 与面板同处既有 `DatetimeEditor`，SHALL NOT 新建第二个选择器，SHALL NOT 使用原生 `date` / `time` 控件。**日期时间字段 SHALL 提供单一面板选择器**（一个 popover 内同时完成日期与时间选择）：面板 SHALL 含月历网格（选日期）与时分步进控件（选时间）；提交时 SHALL 把日期与时间组合为 `YYYY-MM-DDTHH:mm`，SHALL NOT 使用分离的「日期控件 + 时间控件」双控件。日期字段保持仅日期（不扩时间）。**日期字段单击日历日格 SHALL 立即写回所选 `YYYY-MM-DD` 并关闭面板**（「今天」同路径），该次选择 SHALL 只写回一次，SHALL NOT 因随后的失焦或外部点击重复提交；**日期时间字段的日格与时分操作 SHALL 只改草稿、SHALL NOT 提前提交**。**双击值区 SHALL 打开面板并把焦点移到时分输入（日期时间）或日历日格（日期），SHALL NOT 触发保存**。面板 SHALL 键盘可达（Tab 在月历与时分控件间移动、Enter 提交、Esc 取消）；日期时间面板内操作 SHALL NOT 触发提前提交，SHALL 沿用既有值编辑器 onBlur 提交链路（面板关闭或失焦时提交）；日期字段的日格单击是显式例外。写回前 SHALL 按类型做 YAML 合法性校验（数字为数值字面量、布尔为 `true/false`、日期为 `YYYY-MM-DD`、日期时间为 `YYYY-MM-DDTHH:mm`），非法输入 SHALL 还原原值并提示；**日期与日期时间的空输入 SHALL 视为合法空值并写回空值**（SHALL NOT 补「今天」、SHALL NOT 渲染 `—`）；**日期输入 SHALL 接受 `YYYY-MM-DD` 与 `YYYY/MM/DD` 并归一化为 `YYYY-MM-DD`；日期时间输入 SHALL 接受 `T` 或空格分隔、可选秒、以及以 `/` 分隔的日期部分，并归一化为 `YYYY-MM-DDTHH:mm`（秒为 `00` 时省略，秒非 `00` 时保留 `:ss`）**；**Enter / 失焦 SHALL 保存，Esc SHALL 回退原值，一次提交 SHALL 只发生一次**。**空值字段的值节点 SHALL NOT 渲染占位横线（如 `—`）或任何假值文案**，空态只以空白表示。**布尔字段的值内 SHALL NOT 出现「开/关」文字**：显示态与编辑态值内仅保留状态图形（true `◉` / false `○`），状态文案 SHALL 移至 `title` 提示（`已开启` / `已关闭`），编辑态 SHALL 保留 `role="switch"` 与 `aria-checked`/`aria-label` 状态语义。**空值字段与纯字符串字段的类型 SHALL 默认为 `text`**（空串、以及非日期/日期时间的纯字符串都不再回落未知类型；`unknown` 只保留给无法推断的非字符串值）；列表类型字段遇到非数组值时 SHALL 按单元素序列化展示与写回，SHALL NOT 抛错或崩溃。**日期字段 SHALL 改用与日期时间相同的自绘面板**（仅日期、无时分，提交 `YYYY-MM-DD`），SHALL NOT 使用原生 `date` 控件。**日期时间字段的展示格式 SHALL 为 `YYYY-MM-DD HH:mm`**（秒非 `00` 时才附 `:ss`，SHALL NOT 显示毫秒或时区后缀，YAML 原值不改写）。**面板内按 Tab 键 SHALL 在面板控件间移动焦点，SHALL NOT 把 Tab 写入正文**。**日期与日期时间面板底部提示（`.dpb-dt-foot` 内的 `.dpb-dt-hint`）SHALL 默认隐藏（`opacity: 0`），指针进入整条 footer 行或 footer 获得键盘焦点（`:focus-within` / `:focus-visible`）时 SHALL 显现；显隐 SHALL 只改透明度，SHALL NOT 改变 footer 与面板高度（无回流）**；两个选择器共用同一 footer，SHALL 一致生效；既有 Esc 取消 / Enter 保存 / 点击外部保存行为 SHALL 不变。

#### Scenario: 类型切换后编辑器随变

- **WHEN** 用户把某字段类型从文本切换为日期
- **THEN** 值编辑器变为日期选择器，切「源码」可核对该键写回为 YAML 日期字面量

#### Scenario: 日期时间为单一面板

- **WHEN** 用户在日期时间字段点击值区
- **THEN** SHALL 出现一个面板，同一面板内同时含月历网格与时分步进控件；SHALL NOT 出现分离的日期控件与时间控件

#### Scenario: 面板组合提交

- **WHEN** 用户在面板内选定日期 2026-11-18 与时间 14:30 后提交
- **THEN** 该字段值 SHALL 等于 `2026-11-18T14:30`

#### Scenario: 面板键盘可达

- **WHEN** 面板打开后用户按 Tab 在月历与时分控件间移动，按 Enter 提交，按 Esc 取消
- **THEN** 焦点在月历与时分控件间移动；Enter 提交组合值；Esc 取消并回到原值

#### Scenario: 日期时间面板内操作不提前提交

- **WHEN** 用户在日期时间面板内点击月历日格或时分步进控件
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

### Requirement: 托管日期只读展示

托管日期（`created` / `updated`）SHALL 经 `isManagedDateKey` 从可编辑字段列表排除，SHALL NOT 作为字段行渲染。两日期 SHALL 以**只读形式**展示，带锁图标、SHALL NOT 出现输入框、SHALL NOT 可点击编辑。**新增值区输入能力 SHALL NOT 作用于托管日期**：`created` / `updated` SHALL NOT 渲染文本输入、SHALL NOT 接受键入或粘贴、双击 SHALL NOT 打开日期面板。**A 一行条模式与 B 精排双列模式的 footer SHALL 一致：计数在左、托管日期在右，计数恒显示**（日期存在才追加）。**锁图标尺寸 SHALL 小于其他面板图标一档**。日期与计数 SHALL 使用更浅一档颜色；**计数默认低对比，footer 悬停或聚焦时 SHALL 恢复可读对比**。日期值 SHALL 取自 frontmatter，保存时由既有逻辑维护，SHALL NOT 新引入文件系统时间读取；frontmatter 缺失对应键时 SHALL NOT 渲染空壳。

#### Scenario: A 模式 footer 左侧只读日期

- **WHEN** 用户在 A 一行条模式查看含 `created` / `updated` 的文档
- **THEN** 底部 footer SHALL 显示「计数在左、创建/修改日期在右」，带锁图标，无可编辑输入框（原「日期在左」口径已废止）

#### Scenario: B 模式备注行右侧只读日期

- **WHEN** 用户在 B 精排双列模式查看含 `created` / `updated` 的文档
- **THEN** 备注行 SHALL 显示两日期在右、计数在左，带锁图标，无可编辑输入框

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

#### Scenario: 托管日期无输入与双击入口

- **WHEN** 用户在编辑态对 footer 的 `created` / `updated` 键入、粘贴或双击
- **THEN** SHALL NOT 出现文本输入框或日期面板，日期值 SHALL 保持不变
