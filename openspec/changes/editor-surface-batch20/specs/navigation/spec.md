## MODIFIED Requirements

### Requirement: 页签右键菜单文件动作

页签右键菜单 SHALL 提供导出、打开文件位置、刷新三项，并按以下顺序排列：导出位于「复制路径」之前，打开文件位置位于「复制路径」之后，刷新位于「关闭」之前。导出 SHALL 展开全部导出二级项并直接执行，SHALL NOT 跳转格头菜单；打印 SHALL 作为导出下方的独立菜单项出现，且 SHALL NOT 出现在导出二级项中。「导出」二级项 SHALL 在鼠标滑入时自动展开（无需点击）；指针移出「导出行 ∪ 导出二级面板」并集后 SHALL 收起（并集内保持可见）。「移动到」图标 SHALL 带向右箭头，且 SHALL 与「打开文件位置」图标不同（不同概念 SHALL NOT 复用同一图标形状）。

#### Scenario: 菜单项顺序

- **WHEN** 用户右键任一文件页签
- **THEN** 菜单项索引 SHALL 满足 `idx(导出) < idx(复制路径) < idx(打开文件位置)` 且 `idx(刷新) < idx(关闭)`，三项各出现严格等于 1 次

#### Scenario: 取消菜单无残留

- **WHEN** 用户打开右键菜单后按 Esc 或点击外部
- **THEN** 菜单节点数 SHALL 严格等于 0

#### Scenario: 导出就地展开

- **WHEN** 用户右键文件页签并点击「导出」
- **THEN** 同一菜单 SHALL 就地出现导出二级项，右键菜单 SHALL NOT 关闭后跳到格头菜单

#### Scenario: 打印入口独立

- **WHEN** 用户右键文件页签并查看菜单
- **THEN** 「打印」SHALL 位于「导出」正下方且二者为同级项；打开导出二级项后其中 SHALL NOT 含「打印」

#### Scenario: 导出并集内保持可见

- **WHEN** 用户把指针从「导出」行滑入其二级项
- **THEN** 导出二级项 SHALL 保持可见

#### Scenario: 移出并集后收起

- **WHEN** 用户把指针移出「导出行 ∪ 导出二级面板」并集
- **THEN** 导出二级项节点数 SHALL 为 0

#### Scenario: 移动到图标带右箭头且不重复

- **WHEN** 用户打开页签右键菜单
- **THEN** 「移动到」图标 SHALL 含向右箭头，其 path SHALL 与「打开文件位置」不同

### Requirement: 左边栏展开与固定快捷键

`⌘\` SHALL 始终切换左边栏可见性：折叠态切到钉住，钉住 / 悬停态切到折叠；折叠态按 `⌘\` SHALL NOT 进入沉浸阅读。`⌘⌥\` SHALL 切换固定：钉住 ↔ 悬停；折叠态按 `⌘⌥\` 时 SHALL 先展开为钉住。pin 按钮与边缘热区行为保持不变。

系统 SHALL 提供「固定隐藏」态与快捷键（`⌘⇧X`）：进入固定隐藏后左边栏箭头区域 SHALL 彻底消失，鼠标滑入触发区 SHALL NOT 显示左边栏；取消固定隐藏后箭头区域 SHALL 恢复，鼠标滑入触发区 SHALL 自动显示。设置中 SHALL 提供对应开关（`rail_pin_hidden`）。该快捷键 SHALL 在任何场景（含网格概览 / 预览打开时）均生效，SHALL NOT 与网格概览快捷键冲突。

#### Scenario: ⌘\ 展开与收起

- **WHEN** 左边栏处于折叠态时用户按 `⌘\`
- **THEN** `railState` SHALL 为 `pinned`；再按一次 `⌘\` 后 `railState` SHALL 为 `collapsed`

#### Scenario: ⌘⌥\ 固定切换

- **WHEN** 左边栏处于钉住态时用户按 `⌘⌥\`
- **THEN** `railPinned` SHALL 为 `true`；再按一次后 `railPinned` SHALL 为 `false`

#### Scenario: 固定隐藏彻底的箭头消失

- **WHEN** 用户进入左边栏固定隐藏态
- **THEN** 左侧箭头区域节点数 SHALL 为 0，鼠标滑入触发区 SHALL NOT 显示左边栏

#### Scenario: 取消固定隐藏恢复

- **WHEN** 用户取消固定隐藏
- **THEN** 箭头区域 SHALL 恢复，鼠标滑入触发区 SHALL 自动显示左边栏；设置开关写入 `rail_pin_hidden`

#### Scenario: 网格概览打开时快捷键仍生效

- **WHEN** 网格概览（或网格预览）处于打开状态，用户按 `⌘⇧X`
- **THEN** 固定隐藏状态 SHALL 切换（`rail_pin_hidden` 翻转），快捷键 SHALL NOT 被场景门吞掉
