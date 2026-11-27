# 验收锚点 — pane-presets-coverage-v1

锚点来源：用户 2026-11-27 反馈「不只是顶栏与状态栏两个，其他的显隐应该也有哇」与「悬停预览在硬核下保留；关爱界面：左侧浮窗、状态栏的浮窗菜单、大纲内文字，其他页面的功能都得同步调整，再排查遗漏之处」、`docs/design/system/spec.md` §7.7、一手实现观察（`src/App.tsx:1143-1210` 渲染闸门与 `Cmd+Shift+U` 处理、`src/styles/editor.css:1639-1655` `.pane-actions`、`src/styles/editor.css:1794-1845` hardcore 规则块、`src/components/Rail/ReadingRail.tsx:1084-1102` 左缘悬停、`ReadingRail.tsx:1128-1196` 悬停预览、`src/hooks/useConfig.ts:240` `applyPaneMode`）。R-1 对应 spec delta 的 G-13（MODIFIED）与 tasks.md 1.1。

## R-1 常驻 chrome 三档覆盖

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | simple 档常驻 chrome 全显 | 顶栏 `.app-chrome`、底部 `.app-status-bar`、阅读轨 `.rail-root` 恒显，栏目头 `.pane-actions` 计算 `opacity` 为 1 | G-13 场景 1 / §7.7 |
| A-1.2 | state-machine | standard 档与现状一致 | 顶栏恒显；状态栏隐藏态下指针进入底部 16px 热区即唤出；阅读轨仍按 `railState` 折叠 + 左缘悬停唤出；栏目头按钮仍仅 hover 显现 | G-13 场景 2 / §7.7 |
| A-1.3 | state-machine | hardcore 档隐藏且无悬停 | 顶栏、状态栏、阅读轨均隐藏；指针进入左缘不唤出阅读轨（`.rail-root` 不可见）；指针 hover 栏目头不显现 `.pane-actions`；悬停预览仍按用户预览开关照常触发 | G-13 场景 3 / §7.7 |
| A-1.4 | state-machine | `Cmd+Shift+U` 一并临时显现 | 按 `Cmd+Shift+U` 后顶栏、状态栏、阅读轨一并显现，`.pane-actions` 计算 `opacity` 为 1；3 秒无操作或按 Esc 一并收起 | G-13 场景 3 / §7.7 |
| A-1.5 | state-machine | 瞬态浮层不被隐藏且 `readingMode` 优先 | 硬核档下选区胶囊、AI 气泡、撤销条、捕获浮层、命令面板、快捷键帮助、右键菜单仍按既有动作 / 快捷键出现；`readingMode` 为真时 `paneMode` 不覆盖沉浸规则，切换三档后 EditorView 实例数不变 | G-13 场景 4 / §7.7 |

## R-2 关爱界面覆盖扩展

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | large 档新增容器缩放 | 阅读轨 `.rail-root`、大纲菜单、文档属性面板的计算 `zoom` 均为 1.2 | CF-8 场景 3 / §4.1 / D7 |
| A-2.2 | exact | 正文不受新增白名单影响 | 正文 / 预览 / 编辑器容器的计算 `zoom` 为 1，尺寸与缩放前逐像素一致 | CF-8 场景 3 / §4.1 |
| A-2.3 | state-machine | 浮窗菜单随档缩放 | 状态栏浮窗菜单与右键菜单在 large 下计算 `zoom` 为 1.2，且定位仍落在触发点附近（先修定位缺陷） | CF-8 场景 3 / D7 |
