## Why

品质线第一（维护者 2026-11-27 裁定），B1 品质地基（`ui-quality-gate-v1`）已交付归档，本 change 是 B2：把「按钮 / 图标按钮 / 菜单 / 提示」四类基件与图标纪律落成可机检的单一来源。实测缺口（本 worktree 复核）：

- 全仓裸 `<button>` **236** 处（`grep -rn "<button" --include='*.tsx' src`），各域自造类名与内距，无 `.btn*` 统一类；`src/ui/` 只有 `icons.ts`，无 `primitives/` 目录，也无 `src/styles/primitives.css`。
- 浮层定位只有 `src/components/Content/useMenuPos.ts`（**47** 行）：做视口右/下缘夹取 + 可选容器夹取（`boundsOf`，修过 #1017 嵌入态面板溢出），**无 12 向 flip/shift、无嵌套层关闭仲裁**。
- `src/components/TooltipLayer.tsx`（**292** 行）内含 `measureTip()`：append 隐藏探针到 body → `getBoundingClientRect` → remove 量尺寸，方位只有 above/below/left/right 的 `chooseSide`，探针逻辑不可复用。
- 图标尺寸：`size={18}` **71** 处、`size={14}` **21** 处、`size={24}` **7** 处、`size={12}` **4** 处（生产 **3** 处：`src/components/Content/DocPropertyBar.tsx` 行 3855 / 4009 / 4167 的 `lock` 图标；测试 1 处：`src/__tests__/ui/icon.test.tsx:51`）。`IconSize = 12 | 14 | 18 | 24`（`src/ui/icons.ts:791`），而 spec §2.1 规定尺寸档 **14/18/24**，12 仅角标。
- 两套图标表无键集门禁：`src/ui/icons.ts`（`IconName`/`ICONS`，**135** 键）与 `src/editors/icons.ts`（`ICON_REGISTRY` **106** 键 + `COMMAND_ICON_NAME`/`CONVERT_ICON_NAME`/`ACTION_ICON_NAME`/`hasIcon`/`renderIcon`）；交集只有 `columns1..5` 五个键，两表是不同命名空间（概念键 vs Material `XxxOutlined`），现有对账测试只覆盖块类型跨入口一致（`src/__tests__/editor/icon-consistency.test.ts`）与默认面（`src/__tests__/lib/dataSurfacesIcons.test.ts`），未覆盖尺寸与动作映射。
- 无路由：`src/main.tsx` 只用 `URLSearchParams` 的 `?window=overlay` 分流（本仓既有「路由」形态），无 `react-router`。

## What Changes

- **基件 A（Button + IconButton + primitives.css）**：新建 `src/ui/primitives/Button.tsx`、`IconButton.tsx` 与 `src/styles/primitives.css`（纯 CSS、只用已定义 token），在 `src/main.tsx` 引入一次。
- **基件 B（Menu + 定位/关闭仲裁）**：新建 `Menu.tsx`，定位抽 `useAnchoredPosition`（12 向 flip/shift，从 `useMenuPos` 演进并保留 `boundsOf` 容器夹取），关闭仲裁抽 `useLayerDismiss`（Esc/点外/滚动三源、按栈只关最上层），`PortalScope` 统一 portal 挂载点。
- **基件 C（Tooltip 测量 hook + 自动翻转）**：把 `TooltipLayer` 的 `measureTip()` DOM 探针抽成 `useTipMeasure` hook，方位扩到 above/below 自动翻转 + left/right 兜底；`TooltipLayer` 改为消费该 hook，与现有 e2e 行为等价。
- **/showcase 对照场**：`?showcase` 查询参数 + `import.meta.env.DEV` 守卫，在 `src/main.tsx` 分流（与 `?window=overlay` 同构），4 基件 × 6 态 × 明暗双主题，每态挂 `data-showcase` 锚点。
- **Q3 图标纪检**：新建 `scripts/check-icons.mjs`（两表概念键集合相等 / 尺寸白名单 / 动作→图标映射唯一 / 无孤儿键四项），11 个高频 18px 图标按 spec §2.1/§2.2/§2.4 逐条裁决，结论落 `docs/design/system/decisions.md`。
- **Top3 迁移**：设置页按钮（`SettingsView.tsx` 56 个 `<button>`）改 Button×3、编辑器工具条 2 + AI 面板 1 改 IconButton、页签右键菜单改 Menu（含 3 项）；逐域列清单勾销。

## Capabilities

### New Capabilities

- `ui-primitives`：四基件（Button / IconButton / Menu / Tooltip）单一来源、token-only 基件样式、浮层定位与关闭仲裁共享、dev-only `/showcase` 对照场、图标纪检四项门禁。

### Modified Capabilities

- 无。主规格在 G4 合并后由 `/opsx-sync` 同步；本 change 只带 `specs/ui-primitives/spec.md` delta。

## Impact

- **新增**：`src/ui/primitives/{Button,IconButton,Menu,Tooltip}.tsx`、`src/ui/primitives/useAnchoredPosition.ts`、`useLayerDismiss.ts`、`PortalScope.tsx`、`useTipMeasure.ts`、`src/styles/primitives.css`、`scripts/check-icons.mjs`、`src/components/Showcase.tsx`（dev-only）、e2e 守护用例。
- **修改**：`src/main.tsx`（引入 `primitives.css` + `?showcase` 分流）、`src/components/TooltipLayer.tsx`（改消费 `useTipMeasure`）、`src/components/Content/useMenuPos.ts`（由 `useAnchoredPosition` 取代，保留 `boundsOf` 语义）、`SettingsView.tsx` / 编辑器工具条 / AI 面板 / 页签右键菜单（Top3 迁移）、`docs/design/system/decisions.md`（11 行裁决 + 1 行汇总）。
- **无** Rust 改动、无新增依赖、无数据迁移、不引入路由库。
- **风险**：基件迁移引发视觉回归 → 逐处截图对 + review；两表键集差集口径需先对齐（见 design.md D7）；`/showcase` 只在 dev 生效，不进生产包。
