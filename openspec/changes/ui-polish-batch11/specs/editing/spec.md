## ADDED Requirements

### Requirement: 第十一批走查修正（菜单与折叠）

块菜单的颜色与缩进二级面板 SHALL 在触发行右侧展开；越界时 SHALL 翻转到左侧并保持完整可见。块菜单「对齐与缩进」入口 SHALL 显示图标，其子项 SHALL 保留图标。斜杠菜单「插入 CSS」入口 SHALL 显示图标。

MD 编辑态标题折叠三角与标题可见文字之间的水平距离 SHALL 不超过 2px。

#### Scenario: 二级面板向右展开

- **WHEN** 用户打开块菜单并展开「颜色」或「对齐与缩进」
- **THEN** 二级面板左缘 SHALL 位于父行右缘右侧，SHALL NOT 覆盖父菜单

#### Scenario: 图标齐全

- **WHEN** 用户打开块菜单与斜杠菜单
- **THEN** 「对齐与缩进」入口与「插入 CSS」入口 SHALL 各含一个 `svg[data-icon]`

#### Scenario: 折叠三角贴近标题

- **WHEN** 指针进入左侧召唤区并显示某标题的折叠三角
- **THEN** 三角右缘与标题文字左缘的距离 SHALL ≤2px
