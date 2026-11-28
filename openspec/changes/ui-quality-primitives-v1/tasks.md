# 任务 — ui-quality-primitives-v1

> 切片原则：每张票贯穿「基件 → 接线 → 守护」，做完有可点可核验的交付物；票标题前缀 `[change=ui-quality-primitives-v1/<任务号>]`；1 任务 = 1 票。
> 依赖：2.1 / 2.2 / 2.3 / 2.5 无依赖可并行；2.4 依赖 2.1 + 2.2 + 2.3（对照场要挂四基件）；2.6 依赖 2.1 + 2.2（迁移要用 Button / IconButton / Menu）。
> 票数 6 ≥ 6，**集成 checkpoint**：2.1 + 2.2 + 2.3 + 2.5 四票完成后做一次——合并到集成分支 → `npx tsc --noEmit` → `npm run dev` 打开 `/?showcase` → 记录「用户现在能看到什么」。

## 2. 基件与图标纪律

- [x] 2.1 基件 A：Button + IconButton + primitives.css
  - 新增 `src/ui/primitives/Button.tsx`（六 variant × 两 size）、`IconButton.tsx`（命中区 ≥24×24、`label` 必填）、`src/styles/primitives.css`（`bp-*` 类，只用 token）
  - `src/main.tsx` 引入 `primitives.css` 一次；`node scripts/check-tokens.mjs` 绿（基件 CSS 无裸色值 / 裸 px 字号）
  - 守护：`/showcase` 未建前先用 e2e 断言 Button 六 variant × 两 size 与 IconButton 命中区 ≥24×24
- [x] 2.2 基件 B：Menu + useAnchoredPosition + useLayerDismiss + PortalScope
  - 新增 `Menu.tsx`（`items: {id,label,icon?,shortcut?,disabled?,run}[]`）、`useAnchoredPosition.ts`（12 向 flip/shift，保留 `boundsOf`）、`useLayerDismiss.ts`（Esc/点外/滚动三源、按栈只关最上层）、`PortalScope.tsx`
  - `src/components/Content/useMenuPos.ts` 由 `useAnchoredPosition` 取代后删除，全仓无残留引用；#1017 嵌入态面板溢出回归用例随迁移跑
  - 守护：`useAnchoredPosition` 12 向单测 + `useLayerDismiss` 栈顶单测
- [x] 2.3 基件 C：Tooltip 测量 hook + 自动翻转（收敛 TooltipLayer 探针）
  - 新增 `useTipMeasure.ts`（保留隐藏探针 + 真实尺寸），`TooltipLayer.tsx` 改为消费该 hook，方位扩到 above/below 自动翻转 + left/right 兜底
  - `src/__tests__/components/TooltipLayer.test.tsx` 全绿（行为等价）；`TooltipLayer.tsx` 内不再有 `document.createElement("div")` 探针
  - 守护：贴视口顶缘 → `side="below"`、贴底缘 → `side="above"` 的 e2e / 单测断言
- [x] 2.4 /showcase 基件对照场（dev-only，4 基件 × 6 态 × 明暗）
  - 新增 `src/components/Showcase.tsx`，在 `src/main.tsx` 用 `?showcase` + `import.meta.env.DEV` 分流（与 `?window=overlay` 同构）
  - 4 基件 × 6 态（default/hover/active/disabled/loading/focus）× 明暗双主题，每态挂 `data-showcase` 锚点
  - 守护：`npm run dev` 打开 `/?showcase` 渲染对照场；`npm run build` 产物 grep `showcase` 零命中
- [x] 2.5 Q3 图标纪检：check-icons.mjs + 尺寸白名单 + 两表键集 + 11 行裁决
  - 新增 `scripts/check-icons.mjs` 四项检查（两表概念键集合相等 / 尺寸白名单 12px 仅 `DocPropertyBar` lock ×3 / 动作→图标映射唯一 / 无孤儿键）
  - 11 个高频 18px 图标按 spec §2.1/§2.2/§2.4 逐条裁决，落 `docs/design/system/decisions.md` 一行汇总 + 11 行明细；改字形同步 `resources/icons.default.json`
  - 守护：`node scripts/check-icons.mjs` 绿；注入一个不存在的图标名 → 退 1
- [ ] 2.6 Top3 迁移：设置页按钮 / 页签右键菜单 / 编辑器工具条与 AI 面板按钮
  - Button×3（设置页）、IconButton×3（编辑器工具条 2 + AI 面板 1）、Menu×1（页签右键菜单，含 3 项），逐域列清单勾销
  - 迁移面逐处截图对（明/暗 × 1280/400）；`grep -rn "<button" --include='*.tsx' src` 总数下降 ≥7
  - 守护：新代码不自造 button 类字符串（PR 模板判据）；迁移后 `npm run dev` 手动点一遍关键路径
