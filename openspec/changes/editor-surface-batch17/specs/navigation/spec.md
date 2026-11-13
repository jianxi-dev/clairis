## ADDED Requirements

### Requirement: 页签右键菜单关闭协议

页签右键菜单 SHALL 在以下任一来源发生时关闭：菜单外部的 `pointerdown`（document capture 阶段）、`Escape` 键、窗口失焦（`window blur`）、窗口滚动或尺寸变化。菜单内部判定 SHALL 使用菜单自身的 `data-tab-menu` 标记，SHALL NOT 以 `.fixed.z-50` 之类样式类名判定「菜单内部」。当菜单在跨文档（iframe）场景打开时，父窗口收不到内部事件，SHALL 以窗口失焦关闭并以下一次外部 `pointerdown` 兜底。关闭后 SHALL NOT 残留菜单节点。

#### Scenario: 外点关闭

- **WHEN** 用户右键页签打开菜单后点击菜单外部
- **THEN** `[data-tab-menu]` 节点数 SHALL 为 0

#### Scenario: Esc 关闭

- **WHEN** 菜单打开时用户按 `Escape`
- **THEN** `[data-tab-menu]` 节点数 SHALL 为 0

#### Scenario: 失焦与滚动关闭

- **WHEN** 菜单打开时窗口失焦，或页面发生滚动 / 尺寸变化
- **THEN** `[data-tab-menu]` 节点数 SHALL 为 0，回到页面后不残留菜单

### Requirement: 左边栏展开与固定快捷键

`⌘\` SHALL 始终切换左边栏可见性：折叠态切到钉住，钉住 / 悬停态切到折叠；折叠态按 `⌘\` SHALL NOT 进入沉浸阅读。`⌘⌥\` SHALL 切换固定：钉住 ↔ 悬停；折叠态按 `⌘⌥\` 时 SHALL 先展开为钉住。pin 按钮与边缘热区行为保持不变。

#### Scenario: ⌘\ 展开与收起

- **WHEN** 左边栏处于折叠态时用户按 `⌘\`
- **THEN** `railState` SHALL 为 `pinned`；再按一次 `⌘\` 后 `railState` SHALL 为 `collapsed`

#### Scenario: ⌘⌥\ 固定切换

- **WHEN** 左边栏处于钉住态时用户按 `⌘⌥\`
- **THEN** `railPinned` SHALL 为 `true`；再按一次后 `railPinned` SHALL 为 `false`

### Requirement: 页签右键菜单文件动作

页签右键菜单 SHALL 提供导出、打开文件位置、刷新三项，并按以下顺序排列：导出位于「复制路径」之前，打开文件位置位于「复制路径」之后，刷新位于「关闭」之前。

#### Scenario: 菜单项顺序

- **WHEN** 用户右键任一文件页签
- **THEN** 菜单项索引 SHALL 满足 `idx(导出) < idx(复制路径) < idx(打开文件位置)` 且 `idx(刷新) < idx(关闭)`，三项各出现严格等于 1 次

#### Scenario: 取消菜单无残留

- **WHEN** 用户打开右键菜单后按 Esc 或点击外部
- **THEN** 菜单节点数 SHALL 严格等于 0
