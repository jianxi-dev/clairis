## MODIFIED Requirements

### Requirement: E-22 编辑态悬停提示胶囊化

界面中一切自绘悬停提示 SHALL 为胶囊形（圆角半径 ≥ 提示高度的一半）；SHALL NOT 使用系统原生的矩形 `title` 提示。编辑态的选区轮盘 SHALL 在每个扇区（根扇区、二级单元、色条）被悬停时显示其中文名称提示。同一类**胶囊**提示（按钮提示、轮盘扇区提示）SHALL 共用同一胶囊外壳常量，SHALL NOT 出现矩形外壳。页签名信息窗 SHALL 为矩形圆角 8px 卡片（设计系统 §5 浮层档），是本条的**唯一豁免**；SHALL NOT 因本条把它改回胶囊。

提示胶囊 SHALL 带指向触发元素的箭头尾，箭头朝向按弹出方位取值（提示在触发元素上方时朝下、下方时朝上、左侧时朝右、右侧时朝左），SHALL 指向其描述的触发元素。提示内容 SHALL 按按钮形态区分：同时显示图标与文字的按钮，其提示 SHALL 只显示快捷键、SHALL NOT 重复按钮名称；纯图标按钮的提示 SHALL 显示图标名称与快捷键（如「下划线 (⌘ + U)」），并 SHALL 给出该动作的 markdown 用法提示（如 `Markdown: ~文本~ 空格`）。刻意以文字解释图标动作的按钮 SHALL 保留名称。

#### Scenario: 按钮提示为胶囊

- **WHEN** 用户把指针停在任一功能按钮上 600ms
- **THEN** SHALL 出现提示元素，其计算 `border-radius` SHALL ≥ 提示高度的一半
- **AND** 页面 SHALL NOT 弹出系统原生矩形提示

#### Scenario: 轮盘扇区显示提示

- **WHEN** 用户在 MD 编辑态唤出选区轮盘并把指针停在「转换」扇区上
- **THEN** SHALL 出现文案为「转换」的胶囊提示

#### Scenario: 胶囊提示与信息窗外壳分工

- **WHEN** 分别悬停功能按钮、轮盘扇区与页签名
- **THEN** 按钮提示与轮盘提示外壳 SHALL 为胶囊，计算 `border-radius` 均 ≥ 各自高度的一半；页签名信息窗外壳 SHALL 为 8px 圆角矩形；SHALL NOT 出现未圆角的直角外壳

#### Scenario: 提示气泡箭头指向触发元素

- **WHEN** 用户把指针停在任一功能按钮上并唤出提示
- **THEN** 提示气泡 SHALL 含箭头尾，箭头朝向该按钮（按弹出方位）

#### Scenario: 图标+文字按钮提示仅快捷键

- **WHEN** 用户悬停同时显示图标与文字的菜单项「复制」
- **THEN** 提示文本 SHALL 为 `⌘ + C`，SHALL NOT 含名称「复制」

#### Scenario: 纯图标按钮提示名称与快捷键

- **WHEN** 用户悬停纯图标按钮「下划线」
- **THEN** 提示文本 SHALL 为 `下划线 (⌘ + U)`，并 SHALL 含 markdown 用法提示 `Markdown: ~文本~ 空格`
