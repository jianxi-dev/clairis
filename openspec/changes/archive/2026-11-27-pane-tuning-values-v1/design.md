## Context

`pane-presets-v1` 把 `paneScale` 落成为根节点 `data-pane-scale` 三档（`small|medium|large`），CSS 对显式列举的 chrome 容器施加硬编码 `zoom: 0.9/1.2`（`src/styles/editor.css:1907-1953`，#1606 已把白名单扩到全界面浮窗）。`paneMode` 三档的热区高度（`src/App.tsx:88` `STATUS_HOTZONE_HEIGHT = 16`、`src/styles/editor.css:1979` `.status-hotzone`）、hardcore 临时显现时长（`src/App.tsx:209` 硬编码 `3000`）与提示线厚度（`src/styles/editor.css:1847-1857` 硬编码 `1px`）同样写死。缺的是：这些**数值参数**没有暴露成可配置面，AI 无法在既定边界内调整，用户也只能接受三档固定值。

## Goals / Non-Goals

- Goals：把两个预设族内的数值参数数据化——`care-scale`（缩放倍率）与 `pane-modes`（热区高度 / 临时显现时长 / 提示线厚度）；配置键仍存 id、零迁移；消费端改 CSS 变量驱动；两面进面登记表，AI 三面工具自动可用；默认值逐字保留。
- Non-Goals：**第二层**（逐档元素覆盖清单作为数据）与**第三层**（缩放白名单容器清单作为数据）显式延后到后续 change；本 change **不改** #1606 的 zoom 白名单容器清单；不改 `readingMode` 优先级、`Cmd+Shift+U` 语义、瞬态浮层排除；不改既有 DS-1..DS-9、CF-8 白名单措辞、G-13 行为场景。

## Decisions

### D1 两个新数据面，配置键仍存 id

`care-scale` 与 `pane-modes` 各登记为一面：项形状分别为 `{id,label,scale}` 与 `{id,label,hotzonePx,revealMs,hintLinePx}`。`paneScale` / `paneMode` 配置键**仍只存选中的 id**（既有存储值本就是 id，零迁移）。面提供档内参数的定义与校验，配置键提供「选哪一档」。

### D2 边界与归整（mirror reader-preset width 语义）

- `care-scale`：`scale` ∈ [0.8, 1.5]，步长 0.05；非步长值先归整到最近步长再校验（如 1.27 → 1.25，1.28 → 1.30），与 `validate_reader_preset` 的 `width` 按 20px 步长归整同构。
- `pane-modes`：`hotzonePx` ∈ [12, 24]；`revealMs` ∈ [1000, 10000]，0 表示不自动显现且**仅非 hardcore 行允许**；`hintLinePx` ∈ [0, 2]。
- 越界 / 缺字段 / 类型错的项被过滤并聚合为一条告警；覆盖为空或全部非法回落默认。允许新增自定义 id，须自带完整字段。

### D3 消费端改 CSS 变量驱动

- `applyPaneScale` 从 `care-scale` 面解析选中项，写 `--pane-scale-factor` 到 `<html>`（缺省/非法 → 1）。#1606 zoom 白名单块从 `html[data-pane-scale="small"] … { zoom: 0.9 }` / `html[data-pane-scale="large"] … { zoom: 1.2 }` 改为 `html[data-pane-scale-active="true"] … { zoom: var(--pane-scale-factor, 1) }`，属性驱动、与 id 无关。**白名单容器清单不变**。
- 热区高度 → `--pane-hotzone-px`（`.status-hotzone` 与顶部 peek 消费）；提示线厚度 → `--pane-hint-px`（`.pane-leaf::before` 消费）；hardcore 临时显现计时器读该项 `revealMs`。

### D4 零迁移

`paneScale` / `paneMode` 的既有存储值（`small|medium|large` / `simple|standard|hardcore`）正是新面的默认 id，读取路径不变；老配置无需迁移，升级无感。

### D5 面注册表驱动，AI 通路自动可用

两面进 `SURFACES` 登记表（各追加一行 `SurfaceSpec` + 一个默认文件 + 一个形状校验器），`read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` 自动可用，按 id 并入语义与 `reader-presets`（#1579）一致；`items:null` 删除该面用户覆盖并先快照（恢复默认可回滚）。

### D6 默认值逐字保留

默认三档的数值与今天完全一致（0.9/1.0/1.2；16/0/0、16/0/0、0/3000/1）。重置（`items:null`）后界面与改动前逐像素一致。

## 数据面

两面各一张六栏表（`care-scale` 与 `pane-modes`），合并在本小节内。

**面 `care-scale`**

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§4.1 | — | 判据 = 本变更 anchors R-1 逐条断言 |
| 存储 | src-tauri/src/resources/care-scale.default.json | care-scale | 默认三档 0.9/1.0/1.2，唯一默认源 |
| 校验 | src-tauri/src/surfaces.rs | validate_care_scale | scale ∈ [0.8,1.5] 步长 0.05，归整后校验，越界过滤并聚合告警 |
| 桥接 | src/hooks/useConfig.ts | applyPaneScale | 从面解析选中 id 写 `--pane-scale-factor`，缺省/非法 → 1 |
| 消费 | src/styles/editor.css | --pane-scale-factor | zoom 白名单块读变量，仅在 factor ≠ 1 时施加；容器清单不变 |
| 回滚 | snapshots/surfaces/care-scale/ | restore_surface_snapshot | 写前快照，`items:null` 恢复默认可回滚 |

**面 `pane-modes`**

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§7.7 | — | 判据 = 本变更 anchors R-2 逐条断言 |
| 存储 | src-tauri/src/resources/pane-modes.default.json | pane-modes | 默认三档 16/0/0、16/0/0、0/3000/1，唯一默认源 |
| 校验 | src-tauri/src/surfaces.rs | validate_pane_mode | hotzonePx ∈ [12,24]；revealMs ∈ [1000,10000] 或 0（仅非 hardcore）；hintLinePx ∈ [0,2] |
| 桥接 | src/hooks/useConfig.ts | applyPaneMode | 从面解析选中 id，写热区/提示线 CSS 变量与 reveal 时长 |
| 消费 | src/styles/editor.css | --pane-hotzone-px / --pane-hint-px | `.status-hotzone` / peek / `.pane-leaf::before` 读变量；计时器读 revealMs |
| 回滚 | snapshots/surfaces/pane-modes/ | restore_surface_snapshot | 写前快照，`items:null` 恢复默认可回滚 |

票面第 8 字段（数据面）：T1=`存储,校验,桥接,消费,回滚`；T2=`存储,校验,桥接,消费,回滚`；T3=`规格`。

## Risks / Trade-offs

- **归整方向**：`scale` 非步长值归整到最近步长（四舍五入），与 reader-preset `width` 一致；若用户写 1.27 期望 1.30 而得到 1.25，属既定语义，告警不含归整提示（沿用既有行为）。
- **`revealMs=0` 的语义**：仅非 hardcore 行允许 0；hardcore 行若写 0 会被过滤，避免「硬核档永不自动收起」的歧义。
- **CSS 变量回退**：`var(--pane-scale-factor, 1)` 在变量未设置时回落 1；`data-pane-scale-active` 属性由桥接在 factor ≠ 1 时设置，避免 medium 档施加 `zoom: 1` 的无效规则。
- **白名单清单不变**：本 change 只改 zoom 的**取值来源**，不改 #1606 的容器清单；第二层 / 第三层延后。

## Open Questions

无。范围以用户 2026-11-27 确认的方向与边界、上述 Non-Goals 为准。
