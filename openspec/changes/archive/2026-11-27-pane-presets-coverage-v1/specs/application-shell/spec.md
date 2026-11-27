## MODIFIED Requirements

### Requirement: G-13 Chrome 显隐三档（熟练模式）

应用外壳 SHALL 提供 `paneMode` 三档（`simple | standard | hardcore`，默认 `standard`），只驱动应用根节点的 `data-pane-mode` 属性，SHALL NOT 写回 `statusBarHidden`、`railState` 持久化、`railPinHidden`、`immersiveChromeVisible` 或预览设置。范围内常驻 chrome 为顶栏 `.app-chrome`、底部 `.app-status-bar`、阅读轨 `.rail-root`、栏目头动作按钮 `.pane-actions` 与悬停预览（`FloatingPreviewList` / `previewSettings`）。simple SHALL 使范围内 chrome 恒显：顶栏、状态栏、阅读轨恒显，栏目头按钮恒显，悬停预览仍受用户预览开关约束；standard SHALL 保持现状：顶栏恒显，状态栏默认隐藏并由底部 16px 热区唤出，阅读轨按自身状态（折叠 + 左缘悬停唤出），栏目头按钮仅 hover 显现，悬停预览按用户开关；hardcore SHALL 使顶栏、状态栏、阅读轨全部隐藏且 SHALL NOT 提供任何悬停热区（左缘不唤出阅读轨、hover 不唤出栏目头按钮），SHALL 以 `Cmd+Shift+U` 临时一并显现全部范围内 chrome，显现后 3 秒无操作或按 Esc SHALL 一并收起，并 SHALL 保留一条 1px 顶部提示线；栏目头按钮 SHALL 仅在临时显现期间显现；悬停预览 SHALL NOT 因档位被门控，三档均受用户预览开关约束；`Cmd+Shift+V` 钉住预览开关 SHALL 仍可用。交互触发的浮层（选区胶囊、AI 气泡、撤销条、捕获浮层、命令面板、快捷键帮助、右键菜单）SHALL NOT 被 `paneMode` 隐藏，仍按既有动作 / 快捷键出现。阅读轨在 simple / hardcore 下的档内显隐 SHALL 使用会话内呈现态覆盖（进入时记住用户 `railState`、切回 standard 时恢复），SHALL NOT 写穿持久状态。`readingMode`（沉浸）SHALL 优先于 `paneMode`。切换 SHALL NOT 重建 EditorView。

#### Scenario: simple 常显

- **WHEN** `paneMode` 为 `simple`
- **THEN** 顶栏 `.app-chrome`、底部 `.app-status-bar`、阅读轨 `.rail-root` SHALL 恒显，栏目头 `.pane-actions` SHALL 恒显（计算 `opacity` 为 1），SHALL NOT 响应热区或快捷键；悬停预览 SHALL 仍受用户预览开关约束

#### Scenario: standard 热区唤出

- **WHEN** `paneMode` 为 `standard` 且状态栏处于隐藏态
- **THEN** 顶栏 SHALL 恒显；指针进入窗口底部 16px 热区 SHALL 唤出状态栏，移出后 SHALL 隐藏；阅读轨 SHALL 按 `railState` 折叠 + 左缘悬停唤出；栏目头按钮 SHALL 仅 hover 显现；悬停预览 SHALL 按用户开关

#### Scenario: hardcore 隐藏且无悬停

- **WHEN** `paneMode` 为 `hardcore`，指针进入顶部、底部或左缘热区
- **THEN** 顶栏、状态栏、阅读轨 SHALL NOT 显现；栏目头 `.pane-actions` SHALL NOT 因 hover 显现；悬停预览 SHALL 仍按用户预览开关照常触发

#### Scenario: hardcore 快捷键临时显现

- **WHEN** `paneMode` 为 `hardcore`，用户按 `Cmd+Shift+U`
- **THEN** 顶栏、状态栏、阅读轨 SHALL 一并临时显现，栏目头 `.pane-actions` SHALL 显现（计算 `opacity` 为 1），顶部 SHALL 有 1px 提示线；3 秒无操作或按 Esc SHALL 一并收起

#### Scenario: 瞬态浮层不被隐藏

- **WHEN** `paneMode` 为 `hardcore`，用户触发选区胶囊、AI 气泡、撤销条、捕获浮层、命令面板、快捷键帮助或右键菜单
- **THEN** 对应浮层 SHALL 按既有动作 / 快捷键出现，SHALL NOT 因 `paneMode` 被隐藏

#### Scenario: 沉浸优先且不重建编辑器

- **WHEN** `readingMode` 为真且 `paneMode` 为 `hardcore`
- **THEN** chrome 显隐 SHALL 遵循沉浸规则，`paneMode` SHALL NOT 覆盖
- **AND WHEN** 用户切换 `paneMode` 三档
- **THEN** EditorView SHALL NOT 被重建，编辑态与选区 SHALL 保留
