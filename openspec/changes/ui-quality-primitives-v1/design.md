# 设计 — ui-quality-primitives-v1

来源：spec issue #1706；需求四要素见本文件 §Goals / Non-Goals（不另建 `docs/requirements/` 文件，四要素在此显式化）；交付方案 `docs/delivery/plans/malleability-delivery-plan.md` §1 Q2/Q3 与 §4 第 2 行。

## Context

2026-11-28 在本 worktree 复核的缺口（口径见括号内命令/位置）：

1. **236 个裸 button 各域自造**：全仓 `<button` **236** 处（`grep -rn "<button" --include='*.tsx' src`），无 `.btn*` 统一类；`src/ui/` 只有 `icons.ts`，无 `primitives/` 目录，也无 `src/styles/primitives.css`。四类基件里按钮最散，设置页一页就有 **56** 个 `<button>`（`src/components/SettingsView.tsx`）。
2. **浮层定位只有视口夹取**：`src/components/Content/useMenuPos.ts` 仅 **47** 行，只做视口右/下缘夹取 + 可选容器夹取（`boundsOf`，修过 #1017 嵌入态面板溢出），**无 12 向 flip/shift、无嵌套层关闭仲裁**。多个浮层同开时没有「只关最上层」的栈语义，与 interaction.md §4「Esc 只退场」的逐层关闭期望不齐。
3. **Tooltip 测量不可复用**：`src/components/TooltipLayer.tsx` **292** 行，`measureTip()` 用 DOM 探针（append 到 body → `getBoundingClientRect` → remove）量真实尺寸，方位只有 above/below/left/right 的 `chooseSide`。探针逻辑写死在组件里，其他浮层无法复用；纯估算在长文案 / 带 hint 时不准，故探针做法要保留、但要抽成 hook。
4. **图标 12px 越档 3 处**：`size={12}` 生产 **3** 处（`src/components/Content/DocPropertyBar.tsx` 行 3855 / 4009 / 4167 的 `lock` 图标）+ 测试 1 处（`src/__tests__/ui/icon.test.tsx:51`）；`IconSize = 12 | 14 | 18 | 24`（`src/ui/icons.ts:791`），spec §2.1 规定尺寸档 **14/18/24**，12 仅角标。`size={18}` **71** 处、`14` **21** 处、`24` **7** 处。
5. **两表键集无门禁**：`src/ui/icons.ts`（`IconName`/`ICONS`，**135** 键）与 `src/editors/icons.ts`（`ICON_REGISTRY` **106** 键 + `COMMAND_ICON_NAME`/`CONVERT_ICON_NAME`/`ACTION_ICON_NAME`/`hasIcon`/`renderIcon`）是不同命名空间（概念键 vs Material `XxxOutlined`），交集只有 `columns1..5`；现有对账测试只覆盖块类型跨入口一致（`src/__tests__/editor/icon-consistency.test.ts`）与默认面（`src/__tests__/lib/dataSurfacesIcons.test.ts`），**未覆盖尺寸与动作映射**，也没有「动作 → 图标」唯一性的门禁。
6. **无路由**：`src/main.tsx` 只用 `URLSearchParams` 的 `?window=overlay` 分流，无路由库。

B1 已交付归档（`ui-quality-gate-v1`）：`scripts/check-tokens.mjs` 存在且 A/B/C 三项绿，这是 Q2 样式「只用 token」的现成门禁；`docs/design/system/interaction.md` 四条条款与 `scripts/check-interaction.mjs` 已就位，本 change 的 `useLayerDismiss` 对齐其 §4「Esc 只退场」。

## Goals / Non-Goals

**Goals**

- Q2 基件 A：`Button` / `IconButton` + `src/styles/primitives.css`（token-only），在 `src/main.tsx` 引入一次。
- Q2 基件 B：`Menu` + `useAnchoredPosition`（12 向 flip/shift，保留 `boundsOf`）+ `useLayerDismiss`（Esc/点外/滚动三源、按栈只关最上层）+ `PortalScope`。
- Q2 基件 C：`useTipMeasure` hook（收敛 `TooltipLayer` 探针）+ above/below 自动翻转 + left/right 兜底。
- Q2 `/showcase`：dev-only 对照场，4 基件 × 6 态 × 明暗双主题，每态挂 `data-showcase` 锚点。
- Q3 图标纪检：`scripts/check-icons.mjs` 四项检查（两表概念键集合相等 / 尺寸白名单 / 动作→图标映射唯一 / 无孤儿键）+ 11 个高频 18px 图标裁决。
- Top3 迁移：Button×3（设置页）+ IconButton×3（编辑器工具条 2 + AI 面板 1）+ Menu×1（页签右键菜单，含 3 项），逐域列清单勾销。

**Non-Goals**

- 不实现 B3 命令目录（M1）、不做 M6 插件、不做 M3/M4/M5/M7。
- 不全量迁移 236 个 button（只迁 D6 点名的 7 处，见决策默认表）。
- 不引入路由库（`react-router` 等）、不新增任何依赖、不动 Rust。
- 不实现 Q5 px 专项、不迁移存量裸色值 / 1px 横线 / `window.prompt`。
- 不改 `docs/design/system/spec.md` §2.1 的尺寸档（12 仅角标已是现状条款，本 change 只加门禁）。

## Decisions

### D1 基件样式载体

**做法**：新建 `src/styles/primitives.css`，纯 CSS，只用已定义 token（`--app-*` / `--space-*` / `--fs-*` / `--radius-*` / `--shadow-*`），不引入 Tailwind 依赖、不加新依赖；`primitives.css` 在 `src/main.tsx` 引入一次（与既有 `tokens.css` 同批 import）。基件类名统一 `bp-*` 前缀（button primitives），避免与既有 `cm-*` / `dpb-*` 混淆。

**为什么**：B1 的 `check-tokens` A/B 项就是现成门禁——A 项扫组件层裸色值，B 项要求 `src` 内每个 `var(--x)` 已定义；token-only 可机检。Tailwind 已在仓内使用，但基件样式需可被单文件审阅（token 引用一目了然），且 `primitives.css` 是纯 CSS、不参与 Tailwind 的 content 扫描，不会引入构建期耦合。

**怎么验**：`node scripts/check-tokens.mjs` 绿；`src/styles/primitives.css` 内无裸色值 / 裸 px 字号（grep `#` 与 `font-size: <数字>px` 零命中，`border: 1px` 这类结构值除外）；`src/main.tsx` 含 `import "./styles/primitives.css"`。

### D2 Button / IconButton 契约

**做法**：逐字照交付方案 Q2：
- `Button` props `{variant: primary|secondary|soft|ghost|danger|danger-soft, size: sm|md, icon?, loading?, disabled?}`；`variant` 缺省 `secondary`，`size` 缺省 `md`。
- `IconButton` props `{icon, label, size: 14|18}`，命中区 ≥24×24（用 `::before` 或 `padding` 撑开，图标本体仍 14/18），`label` 必填（供 tooltip 与 `aria-label` 双用，缺省 `label` 视为契约违规）。
- 音量纪律「每屏 primary ≤1」只作 review 判据，不做机检（无可靠机检口径），写进 PR 模板勾选。

**为什么**：契约由交付方案逐字给定，本 change 不重新发明。`label` 必填是因为 `IconButton` 无可见文字，`aria-label` 与 tooltip 是同一份文案的两个消费者，拆成两个 prop 会漂移。

**怎么验**：`Button` 六 variant × 两 size 在 `/showcase` 各有 `data-showcase` 锚点；`IconButton` 命中区计算尺寸 ≥24×24（e2e 断言 `getBoundingClientRect().width >= 24`）；`label` 缺失时 TypeScript 报错（必填 prop）。

### D3 Menu 契约

**做法**：`items: {id, label, icon?, shortcut?, disabled?, run}[]`；定位抽 `useAnchoredPosition`（12 向 flip/shift，从 `useMenuPos` 演进并保留其「容器夹取」能力，`boundsOf` 语义不得丢——它修过 #1017 嵌入态面板溢出）；关闭仲裁抽 `useLayerDismiss`（Esc / 点外 / 滚动三源，按栈顺序只关最上层，对齐 interaction.md §4「Esc 只退场」）；`PortalScope` 统一 portal 挂载点（`createPortal` 到同一容器，供层叠上下文与 e2e 定位）。

**为什么**：`useMenuPos` 的 `boundsOf` 是嵌入态面板的回归修复，演进时丢掉等于重开 #1017；12 向 flip/shift 是菜单在视口角落不探出的通用解，比单向夹取少一类溢出。关闭仲裁抽出来，才能让 Menu / Tooltip / 未来浮层共享同一套「只关最上层」语义，而不是各写各的。

**怎么验**：`useAnchoredPosition` 单测覆盖 12 向（anchor 在视口四角时 flip 到对侧）；`boundsOf` 传入窄容器时 x 被夹到容器右缘（#1017 回归用例）；`useLayerDismiss` 单测覆盖 Esc 只关栈顶、点外关全部、滚动不关；`src/components/Content/useMenuPos.ts` 删除后全仓无引用。

### D4 Tooltip 契约

**做法**：把 `TooltipLayer` 的 `measureTip()` DOM 探针抽成 `useTipMeasure` hook（保留「隐藏探针 + 真实尺寸」做法，因为纯估算在长文案 / 带 hint 时不准），方位扩到 above/below 自动翻转 + left/right 兜底；`TooltipLayer` 改为消费该 hook，行为与现有 e2e（`src/__tests__/components/TooltipLayer.test.tsx`）保持等价。

**为什么**：探针做法本身是对的（真实尺寸比估算准），问题在它写死在 `TooltipLayer` 内部、其他浮层用不上。抽 hook 是最小改动：保留探针语义，只搬位置 + 加自动翻转。

**怎么验**：`src/__tests__/components/TooltipLayer.test.tsx` 全绿（行为等价）；`useTipMeasure` 在 anchor 贴视口顶缘时返回 `side="below"`、贴底缘时返回 `side="above"`（e2e 或单测断言）；`TooltipLayer.tsx` 内不再有 `document.createElement("div")` 探针代码。

### D5 /showcase 形态

**做法**：**默认 = `?showcase` 查询参数 + `import.meta.env.DEV` 守卫**，在 `src/main.tsx` 分流（与既有 `?window=overlay` 同构），不引入 `react-router`。验收仍按计划写「`/showcase` 可打开」，落地路径记为 `/?showcase`。

**为什么**：仓内无路由库，引入路由器为 4 天的基件工作背上 1 个新依赖与整仓重排风险；`?window=overlay` 已是本仓既有的「路由」形态，同构扩展成本最低。`import.meta.env.DEV` 守卫保证生产构建不含对照场。

**怎么验**：`npm run dev` 下打开 `/?showcase` 渲染对照场（4 基件 × 6 态 × 明暗）；`npm run build` 产物 grep `showcase` 零命中（dev-only 守卫生效）；无路由库依赖（`package.json` 无 `react-router*`）。

### D6 迁移范围

**做法**：计划写「每类先替换重复最多的 3 处」，点名四个面（设置页按钮 56 个 `<button>`、页签右键菜单、编辑器工具条、AI 面板）。**默认 = Button×3（设置页）+ IconButton×3（编辑器工具条 2 + AI 面板 1）+ Menu×1（页签右键菜单，含 3 项）**；不迁移其余 230+ 个 button。

**为什么**：迁移是演示基件可用，不是全量重构；4 个面各留一处对照截图即可证明可迁移性。全量迁移 236 处会把 4 天的基件工作膨胀成 10 天，且与后续 B3–B7 的功能改动混在一起。

**怎么验**：迁移清单逐项勾销（票面列 7 处 + 各自前后截图）；`grep -rn "<button" --include='*.tsx' src` 总数下降 ≥7（236 → ≤229）；新代码 review 禁止自造 button 类字符串（PR 模板判据）。

### D7 Q3 图标裁决口径

**做法**：计划要求「11 个高频 18px 图标人工裁决一轮（面/线、笔画粗细）」。**默认 = 以 spec §2.2 既有契约为裁决依据**（`fill="currentColor"` 面形为主；线条在 spec 允许的描边场景例外），脚本算出 top-11 高频 18px 图标后，逐个对照 §2.1 / §2.2 / §2.4 给出「保持 / 修正」结论与理由，落 `docs/design/system/decisions.md` 一行汇总（append-only）+ 11 行明细表，**不新增人工等待点**；结论若改字形，同步 `resources/icons.default.json` 对应键。

**为什么**：spec §2.1 / §2.2 / §2.4 已是图标形状与成对的裁决来源，再开一轮人工裁决等于重复立法；把既有条款作为裁决依据，结论可追溯、可复核，且不阻塞 change。改字形走既有 `icons` 数据面（`resources/icons.default.json`）+ 快照恢复通路，不新增可配置面。

**怎么验**：`docs/design/system/decisions.md` 含 1 行汇总 + 11 行明细（每行含「保持 / 修正」结论与条款引用）；`scripts/check-icons.mjs` 绿；若某行结论为「修正」，`resources/icons.default.json` 对应键的 `s`/`d` 已同步。

### D8 两表键集口径

**做法**：`scripts/check-icons.mjs` 的「两表概念键集合相等」按**概念键**比较：`src/ui/icons.ts` 的 `ICONS` 键集（`IconName`，135 键）与 `src/editors/icons.ts` 中**引用了 `UI_ICONS` 的条目**（`columnStrokePath` 取用的 `columns1..5`）+ 两表共有的概念键；`ICON_REGISTRY` 的 Material 命名键（`XxxOutlined`，101 个）是编辑器侧的第二命名空间，不进键集相等检查，而由「动作 → 图标映射唯一」与「无孤儿键」两项覆盖。

**为什么**：两表命名空间不同（概念键 vs Material 名），直接比键集会把 101 个合法 Material 键误报为「孤儿」。真正要门禁的是「同一动作永远同一图标」与「引用的概念键都存在」，而不是两套命名空间字面相等。

**怎么验**：`scripts/check-icons.mjs` 退 0；故意在 `COMMAND_ICON_NAME` 写一个不存在的图标名 → 退 1（映射唯一 / 孤儿键项）；删掉 `ICONS` 里一个被 `columnStrokePath` 引用的键 → 退 1。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2.1/§2.2/§2.4 | — | 图标尺寸档 14/18/24（12 仅角标）；面/线不混用；可逆动作成对 |
| 存储 | `src/ui/icons.ts` · `src/editors/icons.ts` | `IconName` / `IconSize` / `COMMAND_ICON_NAME` | 两表概念键集合相等；尺寸档 ∈ {12,14,18,24} |
| 校验 | `scripts/check-icons.mjs` | 四项检查 | 键集差集=0；12px 仅白名单 3 处（`DocPropertyBar` lock ×3）；动作→图标映射唯一；无孤儿键 |
| 桥接 | `src/styles/primitives.css` | `var(--app-*)` / `var(--space-*)` / `var(--radius-*)` / `var(--shadow-*)` | 只用已定义 token，`check-tokens` B 项「var() 有定义」继续绿 |
| 消费 | `src/ui/primitives/{Button,IconButton,Menu,Tooltip}.tsx` | 基件导出 | 迁移面逐项勾销；新代码不自造 button 类字符串（PR 模板判据） |
| 回滚 | `snapshots/surfaces/icons/` | `restore_surface_snapshot` | 本 change 不新增可配置面；图标仍是既有 `icons` 数据面，写前快照、一步恢复；缺省回落为 `resources/icons.default.json` |

## Risks

- **基件迁移引发视觉回归**：7 处逐处截图对（明/暗 × 1280/400）+ review；迁移只换载体不改布局与文案。
- **两表键集口径误报**：D8 先把「概念键」与 Material 命名空间分开，脚本先 report 差集再退 1；若首轮跑出大量误报，先核对口径再调基线，不直接放宽。
- **`useMenuPos` 删除的连带**：全仓 grep 引用后再删（`src/components/Content/useMenuPos.ts`），保留 `boundsOf` 语义进 `useAnchoredPosition`；#1017 回归用例随迁移一起跑。
- **`TooltipLayer` 行为漂移**：抽 hook 后原 e2e（`src/__tests__/components/TooltipLayer.test.tsx`）必须全绿才算等价；自动翻转只在贴缘时触发，非贴缘保持原方位。
- **`/showcase` 泄漏进生产**：`import.meta.env.DEV` 守卫 + `npm run build` 产物 grep 零命中双保险。

## 决策默认表

| # | 判断点 | 默认取值 | 理由 |
|---|---|---|---|
| D5 | `/showcase` 落地形态 | `?showcase` 查询参数 + `import.meta.env.DEV` 守卫，在 `src/main.tsx` 分流 | 仓内无路由库；引入路由器为 4 天基件工作背上 1 个新依赖与整仓重排风险；与既有 `?window=overlay` 同构 |
| D6 | 迁移范围 | Button×3（设置页）+ IconButton×3（编辑器工具条 2 + AI 面板 1）+ Menu×1（页签右键菜单，含 3 项），共 7 处 | 迁移是演示基件可用，不是全量重构；4 个面各留一处对照截图即可证明可迁移性；全量 236 处会膨胀到 10 天 |
| D7 | 11 个高频 18px 图标裁决口径 | 以 spec §2.1/§2.2/§2.4 既有契约为准，逐条给「保持 / 修正」结论，不新增人工等待点 | spec 已是裁决来源，再开一轮人工裁决等于重复立法；结论可追溯、不阻塞 change |
