## ADDED Requirements

### Requirement: 菜单与浮窗圆角阴影语法

全部右键菜单、下拉菜单、块/斜杠菜单与类型浮层（菜单级）SHALL 使用面板圆角 `--radius-12`（12）、行圆角 `--radius-6`（6）、行高 32、面板内距 6、行左右 inset 5、阴影 `--shadow-menu`。hover SHALL 使用中性黑 4.5%，SHALL NOT 使用强调色；键盘 ↑↓ 与 hover SHALL 共用同一高亮；右键菜单出现 SHALL 无动画；快捷键 SHALL 以 12px 灰色列展示。浮动预览、浮动工具条与 popovers（浮层级）SHALL 使用面板圆角 12 与 `--shadow-panel`，卡片用 `--shadow-card`，按钮用 `--shadow-button`。临时 rgba 阴影 SHALL 全部收敛到本要求引入的 5 档 token。

#### Scenario: 菜单级几何与阴影

- **WHEN** 打开页面并唤起右键菜单（或斜杠菜单、块菜单）
- **THEN** 菜单面板计算样式的圆角 SHALL 为 12、行圆角为 6、行高为 32、阴影 SHALL 等于 `--shadow-menu` 变量值

#### Scenario: 浮层级阴影

- **WHEN** 打开浮动预览或浮动工具条
- **THEN** 浮层阴影 SHALL 等于 `--shadow-panel`；卡片与按钮分别 SHALL 使用 `--shadow-card` 与 `--shadow-button`

#### Scenario: hover 与键盘同步、右键菜单无动画

- **WHEN** 用键盘 ↓ 移动菜单选中项，或 hover 某一行
- **THEN** 两者 SHALL 落在同一高亮类上；hover 背景 SHALL 为中性黑 4.5%（不含强调色）；右键菜单出现时 transition SHALL 严格等于 none

### Requirement: 首页宫格响应式

首页宫格列数 SHALL 按网格容器内容宽（avail，非视口宽）动态计算，`gap = 16`：`wide = floor((avail + gap) / (200 + gap))`；`wide >= 4` 时 `n = min(8, max(4, floor((avail + gap) / (240 + gap))))`，否则 `n = min(3, max(1, floor((avail + gap) / (160 + gap))))`。1×1 / 2×1 / 2×2 三种 tile 跨度与 168px 行高 SHALL 保持不变。hover SHALL 使用 3px 中性 7% 外环，SHALL NOT 使用上浮与加重阴影。5:6 宽高比 SHALL NOT 在本要求内引入。

#### Scenario: 列数随宽度变化

- **WHEN** 首页网格容器内容宽（avail）为 1440 / 1024 / 800
- **THEN** 每行卡片数 SHALL 严格等于 5 / 4 / 3，网格 gap SHALL 严格等于 16px

#### Scenario: hover 环与跨度不变

- **WHEN** hover 任一卡片
- **THEN** 卡片外圈 SHALL 出现 3px 中性 7% 的环，移开后无残留；1×1 / 2×1 / 2×2 跨度 SHALL 与引入前一致，窄于下限时列数 SHALL 保持 1
