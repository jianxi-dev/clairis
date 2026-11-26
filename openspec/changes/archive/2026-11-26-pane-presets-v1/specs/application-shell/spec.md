## ADDED Requirements

### Requirement: G-13 Chrome 显隐三档（熟练模式）

应用外壳 SHALL 提供 `paneMode` 三档（`simple | standard | hardcore`，默认 `standard`），只驱动应用根节点的 `data-pane-mode` 属性，SHALL NOT 写回 `statusBarHidden`、侧栏基态或 `immersiveChromeVisible`。simple SHALL 使范围内 chrome（顶栏 `.app-chrome` 与底部 `.app-status-bar`）恒显；standard SHALL 保持现状：顶栏恒显，状态栏默认隐藏并由底部 16px 热区唤出；hardcore SHALL NOT 提供热区，SHALL 以 `Cmd+Shift+U` 临时显现，显现后 3 秒无操作或按 Esc SHALL 收起，并 SHALL 保留一条 1px 顶部提示线。`readingMode`（沉浸）SHALL 优先于 `paneMode`。切换 SHALL NOT 重建 EditorView。

范围内 chrome 仅为顶栏 `.app-chrome` 与底部 `.app-status-bar`；侧栏与交互触发的浮层不在本要求内。

#### Scenario: simple 常显

- **WHEN** `paneMode` 为 `simple`
- **THEN** 顶栏 `.app-chrome` 与底部 `.app-status-bar` SHALL 恒显，SHALL NOT 响应热区或快捷键

#### Scenario: standard 热区唤出

- **WHEN** `paneMode` 为 `standard` 且状态栏处于隐藏态
- **THEN** 顶栏 SHALL 恒显；指针进入窗口底部 16px 热区 SHALL 唤出状态栏，移出后 SHALL 隐藏

#### Scenario: hardcore 快捷键临时显现

- **WHEN** `paneMode` 为 `hardcore`，指针进入顶部或底部热区
- **THEN** chrome SHALL NOT 显现
- **AND WHEN** 用户按 `Cmd+Shift+U`
- **THEN** chrome SHALL 临时显现，顶部 SHALL 有 1px 提示线；3 秒无操作或按 Esc SHALL 收起

#### Scenario: 沉浸优先且不重建编辑器

- **WHEN** `readingMode` 为真且 `paneMode` 为 `hardcore`
- **THEN** chrome 显隐 SHALL 遵循沉浸规则，`paneMode` SHALL NOT 覆盖
- **AND WHEN** 用户切换 `paneMode` 三档
- **THEN** EditorView SHALL NOT 被重建，编辑态与选区 SHALL 保留
