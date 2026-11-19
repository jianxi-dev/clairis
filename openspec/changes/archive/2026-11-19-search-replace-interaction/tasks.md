# 任务清单：搜索替换交互修补（search-replace-interaction）

> 规格：`specs/search-replace-float/spec.md`（MODIFIED S-3、MODIFIED S-4）。设计：`design.md`（决策 1～7 + 数据面六栏表）。需求输入：GitHub #1153 及其评论「对账确认（2026-11-19）」（最终依据）。
>
> **切片说明（QG-7）**：按垂直切片拆票，每票贯穿逻辑 / 样式 / e2e 全层，做完用户能在页面上直接看到变化。1.1～1.4 为四处行为修正，按**语义风险倒序**排列（悬停 gate → 预览态按钮 → inline diff → 斑马纹）；2.1 集成验收。
>
> **测试归属（QG-2/QG-4）**：e2e 断言随各票交付（票面 AC 列明）；2.1 只做全量收口，不重复实现。
>
> **数据面**：信号命中「快捷键 / 图标 / 轮盘 / 开关」关键词（design.md 决策 7 的否定式枚举触发），按契约在 design.md「## 数据面」填六栏；结论为**无可配置面变更**，各票「数据面」字段填「无（见 change 六栏表）」。
>
> **不新建子票**：子票由编排器 G0-POST 统一建（Parent=#1153），本清单只出任务。

## 依赖与阻塞总览

- 1.1 无阻塞（首批开工票）。
- 1.2 Blocked by 1.1（同改输入行 ⇄ 区域，先定悬停行为再定按钮态，避免同区域叠加改）。
- 1.3 Blocked by 1.2（同改结果行渲染与替换态分支，先定按钮与预览态再删 diff）。
- 1.4 Blocked by 1.3（斑马纹与 diff 同在结果行，先删 diff 再加交替底色，避免同区域反复）。
- 2.1 Blocked by 1.1～1.4。

## 1. 行为修正（语义风险倒序）

- [x] 1.1 [change=search-replace-interaction/1.1] 悬停全文预览放开 `replaceMode` gate
  - 用户做完后能：普通搜索态（编辑 / 源码态）悬停结果行也浮出全文预览卡，不必先切到替换模式。
  - `onHitMouseEnter`（`src/components/Content/SearchReplacePanel.tsx:459`）判断由 `if (!replaceMode || !canReplace || !container) return;` 改为 `if (!canReplace || !container) return;`；预览态（`canReplace=false`，:408）仍不弹卡。
  - e2e：`e2e/search-float.spec.ts:764`「替换模式悬停结果行弹全文预览卡，普通搜索不弹」反向改写为「普通搜索态与替换模式悬停均弹卡，预览态不弹」。
  - 涉及文件：`src/components/Content/SearchReplacePanel.tsx`、`e2e/search-float.spec.ts`
  - **验证命令**：`npx playwright test e2e/search-float.spec.ts -g "悬停"`
  - **Blocked by**：无
  - **接线归属**：无新导出 API；改动封闭在 `SearchReplacePanel` 的 `onHitMouseEnter` 内，本票即为接线票。
  - **视觉锚点**：无（交互行为）
  - **数据面**：无（见 change 六栏表）
  - **标签建议**：ui-surface

- [x] 1.2 [change=search-replace-interaction/1.2] 预览态 ⇄ 替换按钮可见但灰置禁用
  - 用户做完后能：预览态打开浮窗时，输入行 ⇄ 按钮就在眼前（不再「消失」），但灰置禁用并带 title 说明，点击不进替换模式。
  - `src/components/Content/SearchReplacePanel.tsx:849` 的 `{canReplace && (...)}` 改为无条件渲染该按钮，追加 `disabled={!canReplace}`；`title` 在 `!canReplace` 时为「预览态不可替换」，否则维持「切换替换」；`aria-pressed` / `onClick` 语义不变。替换行仍由 `:864` 的 `canReplace && replaceMode` 把关。CSS 追加 `.search-float-replace-toggle:disabled` 灰置（取既有语义色，不新增 token）。
  - e2e：`e2e/search-float.spec.ts:800`「预览态 ⌘F：无替换切换按钮、无替换行」改写为「预览态 ⇄ 可见、`disabled` 为真、title 为『预览态不可替换』、点击不出现替换行」；`:239` 预览态搜索可用断言保持。
  - 涉及文件：`src/components/Content/SearchReplacePanel.tsx`、`src/styles/search-float.css`、`e2e/search-float.spec.ts`
  - **验证命令**：`npx playwright test e2e/search-float.spec.ts -g "预览态"`
  - **Blocked by**：1.1
  - **接线归属**：无新导出 API；`canReplace` 为组件内既有常量，本票改其渲染分支，本票即为接线票。
  - **视觉锚点**：design-system:§6（灰置取既有语义色，禁新增色 token）
  - **数据面**：无（见 change 六栏表）
  - **标签建议**：ui-surface

- [x] 1.3 [change=search-replace-interaction/1.3] 移除替换模式结果行 inline diff
  - 用户做完后能：替换模式结果行只显示命中行本身，不再出现「原词 → 新词」的删除线 / 强调色 diff 条。
  - 删除 `src/components/Content/SearchReplacePanel.tsx:993-1013` 的 `{canReplace && replaceMode && (...)}` diff 块（`[data-testid="search-float-diff"]` 的 `del` / `ins`）；删除 `src/styles/search-float.css:380-405` 的 `.search-float-diff*` 规则。保留 `buildReplaceChanges` / `applyReplaceChanges` / `replaceOne` / `replaceAll`（替换事务、自动跳下一处、计数不变）。
  - e2e：`e2e/search-float.spec.ts:687`「替换模式结果行内联 diff：原词删除线、新词强调色；普通搜索无 diff」反向改写为「替换模式结果行无 `[data-testid="search-float-diff"]` 元素」。
  - 涉及文件：`src/components/Content/SearchReplacePanel.tsx`、`src/styles/search-float.css`、`e2e/search-float.spec.ts`
  - **验证命令**：`npx playwright test e2e/search-float.spec.ts -g "diff"`
  - **Blocked by**：1.2
  - **接线归属**：无新导出 API；仅删展示层，替换逻辑不动，本票即为接线票。
  - **视觉锚点**：无（删除项）
  - **数据面**：无（见 change 六栏表）
  - **标签建议**：ui-surface

- [x] 1.4 [change=search-replace-interaction/1.4] 结果行交替背景色（斑马纹）
  - 用户做完后能：结果区相邻两行底色不同，行距与行界一眼可辨；悬停行与当前命中行仍各自覆盖交替底色。
  - `src/styles/search-float.css` 在 `.search-float-hit`（:184）基规则之后、`:hover`（:199）/ `-cur`（:203）之前插入 `.search-float-hit:nth-child(odd)` / `:nth-child(even)` 背景规则，奇数行取 `--app-surface`、偶数行取 `--app-sunken`（`docs/design/system/spec.md` §6 既有语义色，禁新增色 token）；靠源码顺序让悬停 / 选中覆盖交替底色。
  - e2e：新增「结果行交替背景色」用例——结果区 ≥2 行时断言相邻两行计算背景色不同，且悬停行 / 当前命中行背景覆盖交替底色。
  - 涉及文件：`src/styles/search-float.css`、`e2e/search-float.spec.ts`
  - **验证命令**：`npx playwright test e2e/search-float.spec.ts -g "斑马"`
  - **Blocked by**：1.3
  - **接线归属**：无新导出 API；纯样式规则，本票即为接线票。
  - **视觉锚点**：design-system:§6（`--app-surface` / `--app-sunken` 语义色，禁写像素值）
  - **数据面**：无（见 change 六栏表）
  - **标签建议**：ui-surface

## 2. 验收与交付

- [x] 2.1 [change=search-replace-interaction/2.1] 集成验收与交付
  - 用户做完后能：四处修正一起在真机桌面上可观测成立，既有 search-float 行为不回归。
  - `npm run tauri dev` 手动走查 1.1～1.4 关键路径（普通搜索态悬停弹卡、预览态 ⇄ 灰置、替换模式无 diff、结果行斑马纹），按仓库 UI 测试约定用功能说明性语言记录；`bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）；更新 `docs/delivery/requirements-status.md`。
  - 涉及文件：`docs/delivery/requirements-status.md`（无 src 改动）
  - **验证命令**：`bash scripts/verify.sh`
  - **Blocked by**：1.1、1.2、1.3、1.4
  - **接线归属**：验收与交付，不新增代码接线。
  - **视觉锚点**：design-system:§6
  - **数据面**：无（见 change 六栏表）
  - **标签建议**：integration
