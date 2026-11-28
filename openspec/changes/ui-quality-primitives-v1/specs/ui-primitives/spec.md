# ui-primitives 变更（delta）

## ADDED Requirements

### Requirement: UP-1 四基件单一来源与 token-only 样式

`src/ui/primitives/` SHALL 提供 Button / IconButton / Menu / Tooltip 四类基件的单一来源：`Button` props `{variant: primary|secondary|soft|ghost|danger|danger-soft, size: sm|md, icon?, loading?, disabled?}`；`IconButton` props `{icon, label, size: 14|18}`，命中区 ≥24×24 且 `label` 必填（供 tooltip 与 aria 双用）；`Menu` items `{id,label,icon?,shortcut?,disabled?,run}[]`。基件样式 SHALL 落在 `src/styles/primitives.css`，只用已定义 token（`--app-*` / `--space-*` / `--fs-*` / `--radius-*` / `--shadow-*`），SHALL NOT 出现裸色值或裸 px 字号。`primitives.css` SHALL 在 `src/main.tsx` 引入一次。

#### Scenario: 基件 CSS 出现裸色值被拒

- **WHEN** 在 `src/styles/primitives.css` 写 `#ff0000` 或 `font-size: 13px`
- **THEN** `node scripts/check-tokens.mjs` SHALL 退 1

#### Scenario: IconButton 命中区不足被拒

- **WHEN** 渲染 `IconButton` 并测量其命中区
- **THEN** 计算尺寸 SHALL ≥ 24×24

#### Scenario: 基件样式未接线

- **WHEN** 检查 `src/main.tsx`
- **THEN** SHALL 含 `import "./styles/primitives.css"`

### Requirement: UP-2 浮层定位与关闭仲裁共享

浮层定位 SHALL 抽 `useAnchoredPosition`（12 向 flip/shift，从 `useMenuPos` 演进并保留 `boundsOf` 容器夹取语义）；关闭仲裁 SHALL 抽 `useLayerDismiss`（Esc / 点外 / 滚动三源，按栈顺序只关最上层，对齐 interaction.md §4「Esc 只退场」）；portal 挂载点 SHALL 由 `PortalScope` 统一。`src/components/Content/useMenuPos.ts` SHALL 被取代后删除，全仓无残留引用。

#### Scenario: 容器夹取回归

- **WHEN** `useAnchoredPosition` 传入窄容器 `boundsOf` 且 anchor 在容器右缘外
- **THEN** 浮层右缘 SHALL 被夹到容器右缘内（#1017 回归）

#### Scenario: Esc 只关最上层

- **WHEN** 栈中有两层浮层时按 Esc
- **THEN** SHALL 只关闭栈顶层，下层保留

#### Scenario: 旧 hook 无残留

- **WHEN** 全仓 grep `useMenuPos`
- **THEN** 命中数 SHALL 为 0

### Requirement: UP-3 /showcase 对照场（dev-only）

`/showcase` SHALL 以 `?showcase` 查询参数 + `import.meta.env.DEV` 守卫在 `src/main.tsx` 分流（与 `?window=overlay` 同构），呈现 4 基件 × 6 态（default/hover/active/disabled/loading/focus）× 明暗双主题，每态挂 `data-showcase` 锚点。生产构建 SHALL NOT 含对照场代码。

#### Scenario: dev 下可打开

- **WHEN** `npm run dev` 后打开 `/?showcase`
- **THEN** 页面 SHALL 渲染 4 基件 × 6 态 × 2 主题 = 48 个 `data-showcase` 锚点

#### Scenario: 生产构建不含对照场

- **WHEN** `npm run build` 后 grep 产物中的 `showcase`
- **THEN** 命中数 SHALL 为 0

### Requirement: UP-4 图标纪检

`scripts/check-icons.mjs` SHALL 提供四项检查：① `src/ui/icons.ts` 与 `src/editors/icons.ts` 概念键集合相等；② 尺寸白名单（12px 仅 `DocPropertyBar` lock ×3 豁免）；③ 动作 → 图标映射唯一且都存在于两表；④ 无孤儿键。11 个高频 18px 图标 SHALL 按 spec §2.1 / §2.2 / §2.4 逐条裁决，结论落 `docs/design/system/decisions.md`（1 行汇总 + 11 行明细），改字形同步 `resources/icons.default.json`。

#### Scenario: 尺寸越档被拒

- **WHEN** 新增一处 `size={12}` 且不在白名单
- **THEN** `node scripts/check-icons.mjs` SHALL 退 1

#### Scenario: 动作映射孤儿被拒

- **WHEN** `COMMAND_ICON_NAME` 写一个两表都不存在的图标名
- **THEN** `node scripts/check-icons.mjs` SHALL 退 1

#### Scenario: 裁决表行数

- **WHEN** 查看 `docs/design/system/decisions.md` 的 Q3 裁决段
- **THEN** SHALL 含 1 行汇总 + 11 行明细

### Requirement: UP-5 基件迁移与「不自造 button」判据

Top3 迁移 SHALL 覆盖 7 处：Button×3（设置页）、IconButton×3（编辑器工具条 2 + AI 面板 1）、Menu×1（页签右键菜单，含 3 项），逐域列清单勾销。迁移后全仓裸 `<button>` 总数 SHALL 下降 ≥7（236 → ≤229）。新代码 SHALL NOT 自造 button 类字符串（PR 模板判据）；每屏 primary 按钮 ≤1 作 review 判据，不机检。

#### Scenario: 迁移总数下降

- **WHEN** 迁移完成后跑 `grep -rn "<button" --include='*.tsx' src | wc -l`
- **THEN** 结果 SHALL ≤ 229

#### Scenario: 迁移面可点

- **WHEN** `npm run dev` 打开设置页 / 编辑器工具条 / AI 面板 / 页签右键菜单
- **THEN** 7 处迁移面 SHALL 行为与迁移前一致（逐处截图对）
