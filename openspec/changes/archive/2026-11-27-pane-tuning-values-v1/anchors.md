# 验收锚点 — pane-tuning-values-v1

锚点来源：用户 2026-11-27 确认的方向与边界、`docs/design/system/spec.md` §4.1 与 §7.7、一手实现观察（`src/styles/editor.css:1907-1953` zoom 白名单块、`src/App.tsx:88` `STATUS_HOTZONE_HEIGHT`、`src/App.tsx:209` 3000ms 计时器、`src/styles/editor.css:1847-1857` 提示线、`src/styles/editor.css:1979` `.status-hotzone`、`src/hooks/useConfig.ts:253` `applyPaneScale`、`src-tauri/src/surfaces.rs:482` `validate_reader_preset`）。R-1 对应 spec delta 的 DS-10 / CF-8 与 tasks.md 1.1；R-2 对应 DS-11 / G-13 与 tasks.md 1.2。

## R-1 关爱缩放面（care-scale）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 默认三档与倍率 | 有效集合恰 3 项（small 0.9 / medium 1.0 / large 1.2，标签 小/中/大），默认选中 medium | §4.1 / D6 |
| A-1.2 | exact | scale 边界与步长归整 | `scale` ∈ [0.8, 1.5]；非步长值归整到最近 0.05（1.27 → 1.25，1.28 → 1.30）后校验；越界项被过滤并聚合恰 1 条告警 | DS-10 / D2 |
| A-1.3 | state-machine | 消费端 CSS 变量 | 选中项 scale 写到 `<html>` 的 `--pane-scale-factor`；缺省/非法 → 1；`data-pane-scale-active` 仅在 factor ≠ 1 时为 `true` | DS-10 / D3 |
| A-1.4 | state-machine | zoom 白名单取值来源 | 白名单容器的计算 `zoom` 为 `var(--pane-scale-factor, 1)`；容器清单与 #1606 逐项一致（不增不减）；正文/预览/编辑器计算 `zoom` 为 1 | CF-8 / D3 |
| A-1.5 | state-machine | AI 可调与零迁移 | `patch_data_surface` 改 `care-scale` 档内参数生效并落盘、`items:null` 恢复默认、`restore_surface_snapshot` 可回滚；既有 `paneScale` 存储值仍是 id，无需迁移 | DS-10 / D4 / D5 |

## R-2 窗格模式面（pane-modes）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 默认三档与参数 | 有效集合恰 3 项：simple {hotzonePx 16, revealMs 0, hintLinePx 0} / standard {16, 0, 0} / hardcore {0, 3000, 1} | §7.7 / D6 |
| A-2.2 | exact | 三项参数边界 | `hotzonePx` ∈ [12,24]；`revealMs` ∈ [1000,10000] 或 0（仅非 hardcore 行）；`hintLinePx` ∈ [0,2]；越界项被过滤并聚合恰 1 条告警 | DS-11 / D2 |
| A-2.3 | state-machine | 热区/提示线消费端变量 | `.status-hotzone` 与顶部 peek 的高度取 `--pane-hotzone-px`；`.pane-leaf::before` 提示线厚度取 `--pane-hint-px` | DS-11 / D3 |
| A-2.4 | state-machine | hardcore 临时显现时长 | 临时显现计时器读选中项 `revealMs`（默认 3000）；`Cmd+Shift+U` 语义、Esc 收起、`readingMode` 优先、瞬态浮层排除均不变 | G-13 / D3 |
| A-2.5 | state-machine | AI 可调与行为不变 | `patch_data_surface` 改 `pane-modes` 档内参数生效并落盘、可回滚；切换后 chrome 显隐行为与今天一致（仅参数值可变） | DS-11 / D5 |
