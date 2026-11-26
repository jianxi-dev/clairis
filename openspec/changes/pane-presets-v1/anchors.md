# 验收锚点 — pane-presets-v1

锚点来源：issue #1583（spec + `## 输入对账` 确认）、`docs/design/system/spec.md` §4.1 与 §7.7、一手实现观察（`src/App.tsx:106` 状态栏隐藏态、`src/App.tsx:622` 既有 `Cmd+Shift+T` 占用、`src/styles/editor.css:1707` `.app-chrome`、`src/styles/editor.css:1743` `.app-status-bar`、`src/hooks/useConfig.ts:468` `applyRustConfig`、`src-tauri/src/config.rs:616` `validate_config`）。R-1 对应 spec delta 的 G-9 与 tasks.md 1.1；R-2 对应 CF-8 与 tasks.md 1.2。

## R-1 熟练模式三档

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 设置页 `paneMode` 三档与默认值 | 恰 3 个选项（simple/standard/hardcore），默认选中 standard | §7.7 / D2 |
| A-1.2 | state-machine | simple 档 chrome 可见性 | 顶栏 `.app-chrome` 与底部 `.app-status-bar` 恒显，热区与快捷键均不改变其可见性 | G-9 场景 1 |
| A-1.3 | state-machine | standard 档与现状一致 | 顶栏恒显；状态栏隐藏态下指针进入底部 16px 热区即唤出，移出即隐藏 | G-9 场景 2 |
| A-1.4 | state-machine | hardcore 档快捷键与提示线 | 热区不唤出；`Cmd+Shift+U` 临时显现且顶部存在 1px 提示线；3 秒无操作或 Esc 收起 | G-9 场景 3 / §7.7 |
| A-1.5 | state-machine | `readingMode` 优先且不重建编辑器 | 沉浸态下 `paneMode` 不覆盖沉浸规则；切换三档后 EditorView 实例数不变、编辑态保留 | G-9 场景 4 / D6 |

## R-2 关爱界面三档

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 设置页 `paneScale` 三档与倍率 | 恰 3 个选项（small/medium/large），倍率依次 0.9 / 1.0 / 1.2，默认 medium | §4.1 / D2 |
| A-2.2 | state-machine | large 档缩放落点 | 顶栏 `.app-chrome`、状态栏 `.app-status-bar`、设置场景容器的计算 `zoom` 均为 1.2 | CF-8 场景 3 / §4.1 |
| A-2.3 | exact | 正文不受缩放影响 | 正文/预览/编辑器容器的计算 `zoom` 为 1，尺寸与缩放前逐像素一致 | CF-8 场景 3 / §4.1 |
