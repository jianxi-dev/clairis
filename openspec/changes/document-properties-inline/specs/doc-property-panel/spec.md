# doc-property-panel Specification (delta)

## MODIFIED Requirements

### Requirement: P-2 显示样式两态与显隐配置

显示样式 SHALL 提供 **A 一行条 / B 精排双列** 两态，SHALL 可在设置中切换，两态共享同一字段顺序与操作引擎。预览/编辑模式 SHALL 分别可设默认「展开 / 折叠 / 隐藏」；新建文档的默认显隐 SHALL 为全局设置（不做模板级或文件级覆盖）。`⌘⇧Y` SHALL 一键切换面板显隐。**形态切换 SHALL 写入全局偏好 `docPropertyVariant` 并持久化**（取值 A 或 B，默认 A，为面板形态的唯一来源）；**属性区标题栏右侧按钮区 SHALL 提供 AB 切换图标**（与模板 / 折叠 / 设置同组），点击在 A / B 间切换；**窄窗（窗口宽度 < 720px）SHALL 默认使用胶囊形态，用户手动切换后 SHALL 以用户选择为准**（用户手动切换的优先级高于窄窗自动覆盖，仅当用户从未手动切换且窄窗时走胶囊）。

#### Scenario: 样式切换

- **WHEN** 用户在设置中把显示样式从 A 一行条切换为 B 精排双列
- **THEN** 当前面板立即以 B 形态渲染，字段内容与顺序不变

#### Scenario: 全局新建默认

- **WHEN** 用户把「新建默认显隐」设为隐藏后新建文档
- **THEN** 新文档的面板默认隐藏并显示恢复提示（⌘⇧Y 可恢复），此设置全局生效

#### Scenario: AB 图标切换并持久化

- **WHEN** 用户在属性区标题栏点击 AB 切换图标
- **THEN** 面板在 A 一行条与 B 精排双列间切换，切换写入全局偏好 `docPropertyVariant` 并持久化，重开应用后仍为上次形态

#### Scenario: 窄窗自动胶囊

- **WHEN** 用户从未手动切换形态且窗口宽度小于 720px
- **THEN** 属性区自动使用胶囊（B）形态，用户不被挤成一列

#### Scenario: 手动切换优先于窄窗

- **WHEN** 用户已手动切换过形态，随后窗口宽度变化（含跨过 720px）
- **THEN** 面板保持用户选择的形态，窄窗自动覆盖 SHALL NOT 生效

### Requirement: P-4 字段行操作与选择模式

编辑态每个字段行 SHALL 带**行手柄**：点击选中（可多选、全选），拖动排序，选中临近多行后拖动 SHALL 整块移动（拖拽阈值 5px 区分点击，拖动显示落点指示线）。字段行 SHALL 为**单行胶囊**结构：类型图标 + 类型名 + 字段名 + 值同行排列，字段名输入框固定单行高度、SHALL NOT 随内容撑高；行尾控件 SHALL 为**叉号（关闭语义）**，点击移除该行字段（沿用单一事务写回、可撤销）；**锁定字段（创建/修改日期）SHALL NOT 渲染删除与改名入口，并 SHALL 显示锁图标**。选中后 SHALL 出现图标操作条：复制 / 剪切 / 粘贴（插入所选行下方，粘贴键名自动去重）/ 上移 / 下移 / 删除 / 取消。**操作条与行内操作图标 SHALL 统一经仓库图标注册表（`src/ui/icons` 的 `iconSvg`）渲染**，SHALL NOT 使用 Unicode 字形或组件内联一次性 SVG；新增图标概念 SHALL 先补 `docs/design/system/spec.md` §2.3 条款再注册（24×24 viewBox、笔画 1.7、尺寸档 14/18/24）。**「全选」按钮 SHALL 为二态**：**可选中单位 SHALL 限定为字段名称与标签两类节点，值文本节点 SHALL NOT 参与选中**；0 个选中时按钮文案为「全选」，≥1 个选中时按钮文案为「反选」，按钮文案 SHALL 与当前选中集合一致；**「反选」SHALL 为反转当前选择集**（已选的取消、未选的选上），全选 SHALL 选中全部字段名与标签（标题位可手动选中，不进入全选）。**选择模式**：存在选中项时，行内一切点击（值、选项、类型图标、删除键）SHALL 变为选中/取消切换且不进入编辑，行 hover SHALL 显示选中提示（A/B 两态统一）；单击行外空白 SHALL 清空选中。

#### Scenario: 多选复制粘贴去重

- **WHEN** 用户选中「分类」「作者」两行执行复制，再粘贴到末行
- **THEN** 新增两行键名与原行一致；若目标已有同名键，粘贴行键名自动追加序号去重

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

- **WHEN** 面板存在选中项，用户点击另一字段行内任意位置（含值区与类型图标）
- **THEN** 该行被选中/取消选中，不触发值编辑或类型菜单

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

- **WHEN** 用户选中某字段
- **THEN** 选中高亮落在字段名上，值文本节点 SHALL NOT 被圈入选中范围

## ADDED Requirements

### Requirement: 托管日期只读展示

托管日期（`created` / `updated`）SHALL 经 `isManagedDateKey` 从可编辑字段列表排除，SHALL NOT 作为字段行渲染。两日期 SHALL 以**只读形式**展示，带锁图标、SHALL NOT 出现输入框、SHALL NOT 可点击编辑：**A 一行条模式 SHALL 显示在底部 footer 左侧，与「N 个字段」同行**；**B 精排双列模式 SHALL 显示在备注行右侧**。日期值 SHALL 取自 frontmatter，保存时由既有逻辑维护，SHALL NOT 新引入文件系统时间读取；frontmatter 缺失对应键时 SHALL NOT 渲染空壳。

#### Scenario: A 模式 footer 左侧只读日期

- **WHEN** 用户在 A 一行条模式查看含 `created` / `updated` 的文档
- **THEN** 底部 footer 左侧显示「创建 YYYY-MM-DD · 修改 YYYY-MM-DD」，带锁图标，与「N 个字段」同行，无可编辑输入框

#### Scenario: B 模式备注行右侧只读日期

- **WHEN** 用户在 B 精排双列模式查看含 `created` / `updated` 的文档
- **THEN** 备注行右侧显示两个日期，带锁图标，无可编辑输入框

#### Scenario: 托管日期排除出字段行

- **WHEN** 文档含 `created` / `updated`
- **THEN** 两日期 SHALL NOT 作为字段行渲染，字段计数「N 个字段」SHALL NOT 计入日期

#### Scenario: 缺失日期不渲染空壳

- **WHEN** frontmatter 缺失 `created` 或 `updated`
- **THEN** 对应位置 SHALL NOT 渲染空壳日期项，仅渲染存在的日期

### Requirement: AB 形态切换入口与窄窗自适应

属性区标题栏右侧按钮区 SHALL 提供 **AB 形态切换图标**（与模板 / 折叠 / 设置同组），SHALL 经仓库图标注册表（`src/ui/icons` 的 `iconSvg`）渲染，SHALL NOT 使用 Unicode 字形或组件内联一次性 SVG；点击 SHALL 在 A 一行条与 B 精排双列间切换并写入全局偏好 `docPropertyVariant`。**窄窗自适应**：窗口宽度 < 720px 且用户从未手动切换形态时 SHALL 使用胶囊（B）形态，用户手动切换后 SHALL 以用户选择为准。

#### Scenario: AB 图标位于标题栏右侧

- **WHEN** 用户查看属性区标题栏
- **THEN** 标题栏右侧按钮区 SHALL 含 AB 切换图标，与模板 / 折叠 / 设置同组

#### Scenario: 点击 AB 图标切换并持久化

- **WHEN** 用户点击 AB 切换图标
- **THEN** 面板在 A / B 间切换，写入 `docPropertyVariant` 并持久化，重开应用后保持

#### Scenario: 窄窗自动胶囊且手动优先

- **WHEN** 窗口宽度小于 720px 且用户从未手动切换
- **THEN** 属性区自动使用胶囊形态；用户手动切换后窗口宽度变化，面板保持用户选择的形态
