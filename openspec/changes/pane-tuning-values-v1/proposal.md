## Why

`pane-presets-v1`（已归档）与 `pane-presets-coverage-v1`（进行中）把 `paneMode` / `paneScale` 落成了**闭集枚举**：三档 id 写死在代码里，档内的数值参数（缩放倍率、热区高度、临时显现时长、提示线厚度）同样写死在 CSS 与 `App.tsx`。用户 2026-11-27 确认：这些**数值参数**应作为数据面暴露给 AI，在既定边界内可调，默认值不变。本轮只覆盖第一层（数值参数），第二层（逐档元素覆盖清单）与第三层（缩放白名单作为数据）显式延后。

## What Changes

- 新增两个数据面，配置键仍只存选中的 id（既有存储值本就是 id，零迁移）：
  - `care-scale`：项 `{ id, label, scale }`，默认 small 0.9 / medium 1.0 / large 1.2（标签 小/中/大）。`scale` ∈ [0.8, 1.5]，步长 0.05（非步长值先归整到最近步长再校验，沿用阅读预设 `width` 语义）。允许新增自定义 id（须自带完整字段）；越界项被过滤并聚合为一条告警。
  - `pane-modes`：项 `{ id, label, hotzonePx, revealMs, hintLinePx }`，默认 simple {16, 0, 0} / standard {16, 0, 0} / hardcore {0, 3000, 1}。边界：`hotzonePx` ∈ [12, 24]；`revealMs` ∈ [1000, 10000]（0 = 不自动显现，仅非 hardcore 行允许）；`hintLinePx` ∈ [0, 2]。
- 消费端改为 CSS 变量驱动：
  - `applyPaneScale` 从 `care-scale` 面解析选中项，把 `--pane-scale-factor` 写到 `<html>`（值为该项 `scale`；缺省/非法 → 1）。#1606 的 zoom 白名单块从硬编码 `zoom: 0.9/1.2` 改为 `zoom: var(--pane-scale-factor, 1)`，仅在选中因子 ≠ 1 时施加（属性驱动、与 id 无关，如 `html[data-pane-scale-active="true"] …`）。**白名单容器清单本身不变**。
  - 热区高度与提示线厚度改为 CSS 变量 `--pane-hotzone-px` / `--pane-hint-px`，由既有 `.status-hotzone` / 顶部 peek / 提示线规则消费；hardcore 临时显现计时器读该项的 `revealMs`。
- AI 通路：两面注册进面登记表后，`read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` 自动可用，按 id 并入语义与 `reader-presets`（#1579）一致。
- `readingMode` 优先级、`Cmd+Shift+U` 语义、瞬态浮层排除：均不变。

## Capabilities

### New Capabilities

- `data-surfaces`：新增 DS-10 关爱缩放面（`care-scale`）与 DS-11 窗格模式面（`pane-modes`）——默认源、校验边界、按 id 并入、消费端、热应用。

### Modified Capabilities

- `configuration`：修改 CF-8 窗格预设配置——两键存 id、定义来自面、AI 经 `patch_data_surface` 可调档内参数（含越界拒绝场景）。
- `application-shell`：修改 G-13 Chrome 显隐三档——热区 / 临时显现时长 / 提示线厚度的参数来源改为 `pane-modes` 面（取值在 §7.7 边界内）；行为场景不变。

## Impact

- 代码：`src-tauri/src/surfaces.rs`（`SurfaceShape` 追加两形状 + `SURFACES` 登记两行 + 两个校验器）、`src-tauri/src/resources/care-scale.default.json` 与 `pane-modes.default.json`（新增默认源）、`src-tauri/src/config.rs`（`SKILL_MAP` 增补两面说明）、`src/hooks/useConfig.ts`（`applyPaneScale` 改为读面写 CSS 变量；新增热区/提示线/reveal 的读取）、`src/App.tsx`（`STATUS_HOTZONE_HEIGHT` 与 3000ms 计时器改为读面）、`src/styles/editor.css`（zoom 白名单块改 `var(--pane-scale-factor)`；`.status-hotzone` / peek / 提示线改 CSS 变量）。
- 设计系统：`docs/design/system/spec.md` §4.1 与 §7.7 supersede（默认值逐字保留，新增可调边界）；`docs/design/system/decisions.md` 追加两行。
- 测试：Rust 校验用例（两面边界、归整、越界过滤、按 id 并入、`items:null` 恢复默认）、前端契约（CSS 变量与 zoom 落点）、e2e（AI 改参数即时生效、默认值不变）。
- 兼容：既有 `paneMode` / `paneScale` 存储值仍是 id，零迁移；`readingMode` 行为不变；正文排版不变；#1606 白名单容器清单不变。
