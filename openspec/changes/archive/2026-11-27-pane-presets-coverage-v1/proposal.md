## Why

`pane-presets-v1`（已归档）落地的 `paneMode` 只覆盖顶栏 `.app-chrome` 与状态栏 `.app-status-bar` 两块 chrome。用户 2026-11-27 反馈：「不只是顶栏与状态栏两个，其他的显隐应该也有哇」——三档语义应同样支配其余常驻 chrome（阅读轨、栏目头按钮、悬停预览），否则「简洁 / 常规 / 硬核」在界面上只成立一半：硬核档下阅读轨仍能被左缘悬停唤出、栏目头按钮仍随 hover 浮现、悬停预览仍被指针触发，与「chrome 常隐」的语义自相矛盾。本轮把 `paneMode` 的覆盖面从两块扩展到全部常驻 chrome，并显式排除交互触发的浮层。

## What Changes

- 扩展 `paneMode` 三档的覆盖范围，除既有顶栏 `.app-chrome` 与状态栏 `.app-status-bar` 外，纳入三块常驻 chrome：
  - 阅读轨（`src/components/Rail/ReadingRail.tsx`，根类 `.rail-root`，状态 `collapsed | hover | pinned`）；
  - 栏目头动作按钮（`.pane-actions`，`src/styles/editor.css`，当前仅 hover 显现）；
  - 悬停预览（`FloatingPreviewList` / `previewSettings`，hover 驱动）。
- 三档行为：
  - `simple`：顶栏、状态栏、阅读轨恒显；栏目头按钮恒显；悬停预览仍受用户预览开关约束。
  - `standard`：保持现状——顶栏恒显；状态栏默认隐藏 + 底部热区；阅读轨按自身状态（折叠 + 左缘悬停）；栏目头按钮仅 hover；悬停预览按开关。
  - `hardcore`：顶栏、状态栏、阅读轨全部隐藏且无悬停热区；`Cmd+Shift+U` 临时一并显现（3 秒空闲或 Esc 收起）；栏目头按钮仅在临时显现期间出现；悬停预览不随 hover 触发（既有 `Cmd+Shift+V` 钉住预览开关仍可用）。
- 显式排除：交互触发的浮层（选区胶囊、AI 气泡、撤销条、捕获浮层、命令面板、快捷键帮助、右键菜单）SHALL NOT 被 `paneMode` 隐藏，仍按既有动作 / 快捷键出现。
- `readingMode` 仍优先于 `paneMode`，行为不变。
- 仅呈现，不写穿：不写回 `statusBarHidden`、`railState` 持久化、`railPinHidden`、`immersiveChromeVisible` 或预览设置；阅读轨在 `simple` / `hardcore` 下使用会话内呈现态覆盖（进入时记住用户 `railState`、退出时恢复），不新增配置键。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `application-shell`：修改 G-13 Chrome 显隐三档（熟练模式）——把 `paneMode` 覆盖面从顶栏 + 状态栏扩展到阅读轨、栏目头动作按钮与悬停预览；hardcore 下 `Cmd+Shift+U` 一并临时显现全部常驻 chrome；显式排除交互触发浮层；`readingMode` 优先且不重建 EditorView。

## Impact

- 代码：`src/App.tsx`（`Cmd+Shift+U` 临时显现闸门扩到阅读轨与栏目头按钮、悬停预览门控）、`src/components/Rail/ReadingRail.tsx`（或一个小的呈现态包装组件，承载 `simple` / `hardcore` 的会话内覆盖与恢复）、`src/styles/editor.css`（`.pane-actions` 与 `.rail-root` 的三档规则）、`src/components/SettingsView.tsx`（熟练模式设置文案）。
- 设计系统：`docs/design/system/spec.md` §7.7 更新三档表与范围句；`docs/design/system/decisions.md` 追加一行。
- 测试：e2e（三档切换下阅读轨 / 栏目头按钮 / 悬停预览的显隐与 `Cmd+Shift+U` 临时显现、瞬态浮层不被隐藏）。
- 兼容：既有 `statusBarHidden` / `railState` / `railPinHidden` / `immersiveChromeVisible` / 预览设置不被写穿；`readingMode` 行为不变；正文排版不变；既有 `paneScale`（CF-8）不受影响。
