# 任务清单：文档属性交互还原（二.1 / 二.2 / 二.4）

> 规格：`specs/doc-property-panel/spec.md`（P-2/P-4 MODIFIED）。设计：`design.md`（决策 D1～D8 + 数据面六栏表）。需求输入：GitHub #1152 评论「对账确认（2026-11-19）」。
>
> **切片说明（QG-7）**：每票贯穿交互/样式/数据→UI→测试全层，做完用户能在页面上看到或感受到东西；按语义风险倒序排布（交互语义 > 剪贴板数据语义 > 视觉 > 图标展示）。
>
> **测试归属（QG-2/QG-4）**：单测与 Playwright e2e 随各票交付（票面 AC 列明）。
>
> **数据面机检三连**：G0 阶段二 `./scripts/cw-data-surface.sh new` → G0-POST `tickets` → G1 出口 `diff`。仅 1.4 命中数据面（icons.ts），声明全部六行。
>
> **归档**：G4 收口后按 change-workflow 归档；子票 Parent = spec issue #1152。

## 1. 垂直切片

- [ ] 1.1 **还原上版三元组交互**：`RenameLabel` 恢复单击改名（`onClick=start`、title「点击改名」、Enter/Space 键盘可达）；`onPanelClickCapture` 恢复旧版语义（无选中 → 放行；有选中 → 命中 `[data-row-id]`（排除行手柄）即 `preventDefault + stopPropagation + toggleRow`）；移除 #1131 的 450ms 原地双击改名与 `lastSelectClickRef`。行手柄 <5px 抬手 `toggleRow` 不变；全选/反选按钮保留。AC：`npm run tauri dev` 打开含 frontmatter 文档 → 编辑态面板，无选中时单击字段名出现改名输入框（取消残留：Esc 后无输入框残留）；选中任一字段后点击其他字段行任意位置（含字段名）该行切换选中且改名输入框不出现；点击行手柄选中/取消；全选→3 行选中且按钮文案「反选」，再点→选中数 0 且文案「全选」；e2e 覆盖三态往返。锚点：P-4 场景「单击字段名进入改名」「已选中后点击其他字段切换选中」「行手柄点击选中」「全选后反选」。Blocked by：None。接线归属：无新增导出（改既有 `RenameLabel`/`onPanelClickCapture` 内部交互）。标签：ready-for-agent、ui-surface。粒度：用户可见交付物。**视觉锚点**: design-system:§7.3。**数据面**: 无

- [ ] 1.2 **选中集复制不含值 + 粘贴重建空值字段**：新增纯函数 `encodeFieldSelection(fields, indices)`（输出 `{version:1, fields:[{key,type,attrs?}]}`，剥离值）与 `decodeFieldSelection(payload)`（按类型重建空值：文本/数字/日期/日期时间/布尔为空串或类型默认、数组/复选为 `[]`）；新增模块级剪贴板 `src/lib/docPropertyClipboard.ts` 承载载荷（跨页签/跨文档可用）；`handleCopy` 改调 encode，`handlePaste` 用 decode 结果插回（沿用 `uniqueKey` 去重）。AC：打开页面选中「分类」「作者」复制 → 在另一文档粘贴 → 新增两行类型/名称一致且**值为空**（空态严格等于空，不含占位符）；原行值不受影响；粘贴键名冲突时自动去重；单测覆盖 encode 不含值/attrs 保留、decode 按类型重建空态。锚点：P-4 场景「选中集复制不含值」「粘贴重建空值字段」「多选复制粘贴去重」。Blocked by：None。接线归属：本票导出 `encodeFieldSelection`/`decodeFieldSelection`，接线位置 = `DocPropertyBar.tsx` `handleCopy`/`handlePaste`（本票内接）。标签：ready-for-agent、ui-surface。粒度：用户可见交付物。**视觉锚点**: design-system:§2.3。**数据面**: 无

- [ ] 1.3 **选中高亮恢复整块（含值）**：`doc-property.css` 恢复 `.dpb-row-selected` 行级基规则（`--app-accent-soft` 背景 / `--app-accent` 边框 / `--radius-4`），类挂载收敛到行容器（B 态 `.dpb-b-row`、A 态 `.dpb-a-title-cell`、标签/字段胶囊 `.dpb-chip`）；`.dpb-node-selected` 收敛为行级高亮的内部实现（保留类名不删，避免其它引用崩）；值文本节点不带可选中属性。AC：打开页面选中某字段行 → 整行（类型图标 + 字段名 + 值）计算背景为 `--app-accent-soft`，值区不保持未选中底色；标签行选中高亮落在标签胶囊；未选中行无高亮（无残留）；e2e 断言计算样式。锚点：P-4 场景「选中整块高亮含值」「值不进入选中」「标签参与选择」。Blocked by：None。接线归属：无新增导出（CSS + 既有类挂载）。标签：ready-for-agent、ui-surface。粒度：用户可见交付物。**视觉锚点**: design-system:§7.3。**数据面**: 无

- [ ] 1.4 **形态切换图标 L/T 语义与存储兼容**：先改 `docs/design/system/spec.md` §2.3「文档属性」行（`docPropertyVariant（L 一行条 / T 精排双列形态切换）` + 图形规范）与 `docs/design/system/decisions.md` append 台账；再改 `src/ui/icons.ts` 的 `docPropertyVariant` 图形（L=一行条 / T=双列）与 label；`DocPropertyBar.tsx` `variantToggle` 的 `title` 改 L/T 语义（`aria-label`/`aria-pressed` 不变）；`SettingsView.tsx` 显示样式标签改「L 一行条 / T 精排双列」。**存储值不动**：`docPropertyVariant` 仍 `A`/`B`、`normalizeDocPropertyVariant` 白名单不变、`displayStyle` 仍 `list`/`dual`。AC：打开页面 → 标题栏图标为 L/T 语义 SVG，悬停提示含「L 一行条 / T 精排双列」；点击切换形态并重开应用后仍为上次形态（存储 A/B 原值生效，用户既有 "B" 偏好不迁移）；设置区选项文案为 L/T；设计走查截图并排对比；CSS manifest 机检通过。锚点：P-2 场景「L/T 图标语义与存储兼容」「AB 图标切换并持久化」。Blocked by：None。接线归属：无新增导出（改既有 `docPropertyVariant` 概念与渲染）。标签：ready-for-agent、ui-surface。粒度：用户可见交付物。**视觉锚点**: design-system:§2.3。**数据面**: 规格,存储,校验,桥接,消费,回滚

- [ ] 1.5 **集成验收与交付**：`npm run tauri dev` 手动走查全量关键路径（三元组交互、整块高亮、复制→跨文档粘贴空值、L/T 图标与存储兼容），按仓库 UI 约定用功能说明性语言记录；`bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）；数据面机检 `diff` 收口；更新 `docs/delivery/requirements-status.md`；G4 归档。锚点：P-2/P-4 全量场景。Blocked by：1.1、1.2、1.3、1.4。接线归属：不适用（收口票）。标签：ready-for-agent、ui-surface。粒度：integrate-verify。**视觉锚点**: 无（收口票，不新增可见 UI）。**数据面**: 无

## 2. 来源映射

| 任务 | 来源 | 规格触点 |
|---|---|---|
| 1.1 | #1152 二.4 对账确认 | P-4 三元组交互 / 全选反选保留 |
| 1.2 | #1152 二.1 对账确认 | P-4 选中集复制不含值 / 粘贴重建空值 |
| 1.3 | #1152 二.1 对账确认 | P-4 选中整块高亮含值 / 值不进入选中反向修订 |
| 1.4 | #1152 二.2 对账确认 | P-2 L/T 图标语义 + 存储兼容 |
| 1.5 | 上述四票收口 | P-2/P-4 全量 |
