## Context

全站图标是单条静态 path 表（`src/ui/icons.ts`）：`IconDef` 只有 `d` 与 `label`，`IconName` 为 33 个概念的联合类型；`Icon.tsx` 只渲 `<path fill=currentColor>`。v2 提案里的 `fill="none" stroke=…` 会被当实心填充渲染成色块——这是 v3 必须先解决的架构问题。

`PaneTreeView.tsx:550-565` 的全屏按钮写死 `name="expand"`，`aria-pressed` 已存在但图标不随状态换形。`VideoPlayer.tsx:92-97` 自建本地 `ICONS`（22px / stroke-2）与含 `<text>` 角标的 `LOOP_ICONS`（`:55-59`），从未 import `src/ui/icons`。

e2e 硬约束（`e2e/icon-system.spec.ts`）：svg 元素的计算 fill 必须等于类型色；6 个类型图标的 `<path>` 数量恰好为 1。像素签名用例（`:120-137`）克隆 svg 后强制 `fill="#000"` 且不设 stroke。

用户已批准 v3 小样（`docs/design/explorations/icon-system-v3/icon-system-v3-proto.html`），坐标以该页 `ICONS` 注册表为唯一真相源。

## Goals / Non-Goals

**Goals:**

- 让 `Icon` 同时支持实心（`d`）与描边（`s`）渲染，且不破坏现有 e2e 断言。
- 用一张表承载约 49 个概念，含五组状态对。
- 全屏按钮随 `fullscreenPaneId` 在 `expand` / `collapse` 间切换。
- 播放器自绘控件与全站共用同一图标源。
- 修订 `navigation`「图标体系」与 `application-shell` G-7 两条 requirement。

**Non-Goals:**

- 不引入图标库、sprite、mask-CSS 或构建步骤。
- 不覆盖 ArtPlayer 原生控件图标。
- 不重排布局、不新增 20px 档、不改现有 `IconName` 字符串。
- 不批量改写 `docs/design/approved/`。

## Decisions

### D1 · `IconDef` 双字段（否决单 flag）

`{ d?: string; s?: string; label: string }`（二者至少其一）。

- `d` = 实心子路径，svg 上的 `fillRule/clipRule="evenodd"` 继续生效。
- `s` = 描边子路径，渲成 `fill="none" stroke="currentColor" strokeWidth={1.7}`。
- 纯图标只渲存在的那一个 path（恰好 1 个 `<path>`，满足 e2e）；混合图标（video：描边壳 + 实心三角）渲 2 个 path，不在该断言采样内。

否决 `stroke?: boolean` 单 flag：表达不了 video 混合。否决 keep-fill-only：违背 v3 描边本体。

### D2 · svg 根保留 `fill="currentColor"`，`fill="none"` 只写 path

e2e 断言 svg 元素的计算 fill 等于类型色。`fill="none"` 若写到 svg 根，该断言直接变红。故 svg 根恒为 `fill="currentColor"`，描边 path 自己覆盖为 `fill="none"`。

### D3 · `color` prop 必须转发到 stroke

`stroke={color ?? "currentColor"}`。否则给描边图标传 `color` 的调用点会静默错色（svg 级 fill 被 path 的 `fill="none"` 覆盖，颜色只认 stroke）。

### D4 · 状态对 = 成对 `IconName`，调用点选

新增 `collapse` / `pinOff` / `volumeMute` / `play` / `pause` / `loopNone` / `loopSingle` / `loopPlaylist`。调用点按 next action 选（`PaneTreeView` 已有 `eye/pencil` 三元式先例）。不给 `Icon` 加 `state` prop，不做语义映射表——`Icon` 保持哑组件。

### D5 · 播放器接缝 = 序列化器 + 自绘控件换源

新增 `iconSvg(name, size=22): string`（与 `Icon.tsx` 同规则读 `ICONS`）。删除 `VideoPlayer` 的本地 `ICONS` / `LOOP_ICONS`；循环三态升级为表内三个条目（`1`/`N` 画成笔画，干掉 `<text>`），`innerHTML` 换图标机制保留。原生控件走 ArtPlayer 构造函数 `icons` 选项——本期不做，登记为后续待办。

### D6 · 同 commit 约束

引用新 IconName 的调用点、`fileType.test.ts:42`（改为 `(d ?? s).length > 0`）、整张 `ICONS` 表、`Icon.tsx` 的 color→stroke 转发必须同一提交。TS 会挡住半套迁移。

### D7 · 规格裁定：universe-icon → 静态 path 表

`navigation` 规格现写「统一为 universe-icon」，与已批准 draft 的 A5「不引入图标库」冲突。裁定继续静态 path 表：无运行时依赖、可 tree-shake、与现有契约（图标抽屉列举、e2e `data-icon` 断言）一致。在 delta spec 中 MODIFIED 该 requirement。

### D8 · 像素签名用例的描边处理

`e2e/icon-system.spec.ts:120-137` 克隆 svg 后 `clone.setAttribute("fill", "#000")` 且不设 stroke，纯描边图标会栅格化成空白。实现时二选一：克隆后同时设 `stroke="#000"`，或把该用例限定为实心图标。优先补 stroke（保留全部 8 个类型的签名校验）。

## Risks / Trade-offs

- **18px 下 1.7 笔画 ≈ 1.27px 设备像素**（1x 屏 / 暖色可能发虚，M 可辨性成败在此）→ 三主题 × 18px 逐格 QA 已 PASS；实现后用 e2e 截图复核。
- **`collapse` 在 18px 下略像「+」** → 保留 tooltip 与 `aria-pressed` 兜底；实现阶段可考虑把内收位移从 5 加到 6。
- **`fileType.test.ts` 的 `d` 断言** → 同 commit 改 `(d ?? s)`。
- **像素签名用例栅格化** → 见 D8。
- **ArtPlayer 版本漂移导致图标键名静默失效** → 本期不覆盖原生控件，风险降级。
- **图标抽屉用例只断言 `n >= 13`** → 新增名字安全。

## Migration Plan

按依赖顺序分 commit：

1. `IconDef` 双字段 + `Icon.tsx` 描边渲染 + `fileType.test.ts` 同步（契约 prefactor）
2. `ICONS` 表文件类型族（8 概念）
3. `ICONS` 表动作族（约 27）
4. `ICONS` 表媒体族（约 16）+ `iconSvg` 序列化器
5. 状态对接线（`PaneTreeView` 全屏退出）
6. 播放器控件换源
7. 规格同步（`navigation` + `application-shell`）

回滚：`git revert` 单个 commit 即可；②–④ 为纯数据改动，无行为副作用。

## Open Questions

1. `prev` / `next` 是否采用「描边竖线 + 实心三角」混合模式（需 `d` + `s` 两段）？
2. `loopNone` 的 0.45 透明度由播放器控制项 class 承担，若未使用该 class 则退化为全不透明。
