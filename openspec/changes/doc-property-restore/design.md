# 设计：文档属性交互还原（二.1 / 二.2 / 二.4）

## Context

- 需求输入：GitHub #1152（spec issue）+ 其评论「对账确认（2026-11-19）」，为最终依据。二.1 ★A 高亮整块 + 选中集复制不含值；二.2 采纳 L/T 替代 A/B；二.4 ★A 完整还原三元组交互并显式保留「已选中后点其他字段任意位置即切换选中」。
- 基准：`openspec/specs/doc-property-panel/spec.md`（P-2/P-4 现状）；`openspec/changes/archive/2026-11-17-doc-property-refine/`（P-4 上一版形态）；旧版交互 `git show 566a8ed^:src/components/Content/DocPropertyBar.tsx`。
- 现状代码（探查实证）：
  - 高亮：`src/styles/doc-property.css:1030-1036` 只剩 `.dpb-node-selected`（挂字段名/标签 span）与 `.dpb-a-title-cell.dpb-row-selected`；行级 `.dpb-row-selected` 基规则被 #1131 删除，类仍被添加（`DocPropertyBar.tsx:2719/2823/2889/2957`）但成死类 → 值不染色。
  - 改名：现版 `RenameLabel` 无 `onClick`，`title="双击改名"`；`onPanelClickCapture`（`DocPropertyBar.tsx:2336-2370`）用 450ms 原地双击设 `pendingRenameKey`；选中节点 `data-select-node` 点击即 `toggleRow`。旧版 `RenameLabel` `onClick=start`（单击改名）+ `onPanelClickCapture` 在 `selected.size>0` 时点击行 `toggleRow`（`stopPropagation`）。
  - 复制：`handleCopy`（:2176-2195）用 `cloneFieldsForPaste(fields, idxs)`（`frontmatter.ts:767-781`）——**含值**深拷贝；`handlePaste`（:2197-2211）直接插回原字段（含值）。
  - 图标：`src/ui/icons.ts:713-717` `docPropertyVariant`（外框 + 中缝 + 四横线）；渲染 `DocPropertyBar.tsx:2622`；提示 `title` 用 A/B（:2618）；设置区标签 `SettingsView.tsx:194-195`「A 一行条 / B 精排双列」。
  - 存储：`src/stores/docPropertyPanel.ts` `DocPropertyVariant = "A" | "B"` + `normalizeDocPropertyVariant`（仅 A/B）；`useConfig.ts:479` 回填；设置 `displayStyle` 值为 `list`/`dual`。
- 硬约束：三模式 CSS display 切换不 remount；新增/改动 `cm-*` 类须同步 `src/styles/`（CSS manifest）；数据面契约见下文六栏表；delta spec 逐字保留既有场景标题（archive abort 防线）。

## Goals / Non-Goals

**Goals:**
- 选中高亮恢复整块（含值），值节点不属可选中单位（不可单独选中/全选），仅随行高亮。
- 选中集复制 = 字段类型 + 字段名称 + 未来字段属性（不含值）；粘贴 = 重建同定义空值字段。
- 还原上版三元组交互（单击字段名改名 / 手柄选中 / 已选中后点行切换选中），移除 450ms 双击改名；全选/反选保留。
- 形态切换图标与文案改用 L/T 语义，存储值 A/B 与 `displayStyle` list/dual 不变（零配置迁移）。

**Non-Goals:**
- 二.5 属性块嵌入正文（归 #1157 `doc-property-embed`）。
- 二.3 720px 胶囊偏好污染（归缺陷票 #1147）。
- 跨应用 OS 剪贴板互操作（本 change 只定义面板内选中集载荷；不写系统剪贴板）。
- 值编辑、类型菜单、拖拽排序、模板、别称映射等既有能力。

## Decisions

1. **选中高亮：恢复行级基规则，类挂载收敛到行容器**。在 `doc-property.css` 恢复 `.dpb-row-selected` 基规则（背景 `--app-accent-soft` / 边框 `--app-accent` / `--radius-4`），并把该类挂到**行容器**（B 态 `.dpb-b-row`、A 态标题单元格 `.dpb-a-title-cell`、标签/字段胶囊 `.dpb-chip`）；字段名/标签 span 上的 `.dpb-node-selected` 收敛为行级高亮的内部实现或移除（保留类名不删，避免其它引用崩）。理由：用户要「整块（含值）高亮」；行容器挂类天然覆盖值区，比逐节点染色简单且不易漏。值文本节点仍不带可选中属性（`data-select-node` 只挂字段名/标签），满足「值不进入可选中单位」。
2. **三元组交互：恢复旧版 capture 语义 + 单击改名**。`RenameLabel` 恢复 `onClick={renameable ? start : undefined}`、`title="点击改名"`、`role=button`/`tabIndex=0`/Enter+Space 键盘改名；`onPanelClickCapture` 恢复旧版「`selected.size===0` 直接返回；否则命中 `[data-row-id]`（排除 `dpb-row-handle`）即 `preventDefault + stopPropagation + toggleRow`」；删除 450ms 双击判定与 `lastSelectClickRef`。行手柄点击（<5px 抬手 `toggleRow`）不变。效果：无选中时点字段名 = 改名（capture 不拦截，label 自身 `onClick` 触发）；有选中时点行任意位置（含字段名）= capture 先拦截并 `stopPropagation` → 切换选中、不进改名——即用户强调的「已选中后点其他字段任意位置即切换选中」。保留：Enter/Space 改名、新建字段自动聚焦改名、全选/反选按钮。
3. **选中集复制载荷：版本化结构化 JSON，不含值**。定义 `DocPropertyClipboardPayload`：
   ```ts
   interface DocPropertyClipboardPayload {
     version: 1;
     fields: Array<{
       key: string;              // 字段名称
       type: FrontmatterType;    // 字段类型
       attrs?: Record<string, unknown>; // 未来字段属性扩展位（当前预留，序列化时携带）
     }>;
   }
   ```
   纯函数 `encodeFieldSelection(fields, indices): DocPropertyClipboardPayload`（剥离 `value`/`display`，只留 key/type/attrs）与 `decodeFieldSelection(payload): FrontmatterField[]`（重建 `value` 为空值：文本/数字/日期/日期时间/布尔/URL 类为空串或 `null` 按类型默认、数组/复选为 `[]`、`display` 为空）。`handleCopy` 改调 `encodeFieldSelection`；`handlePaste` 用 `decodeFieldSelection` 的结果插回（键名去重沿用 `uniqueKey`）。理由：满足「类型 + 名称 + 未来属性，不含值」；`attrs` 位让未来属性可扩展而不改载荷版本；纯函数可单测。替代方案（继续传 `FrontmatterField[]` 再清值）会漏属性扩展位且把值结构耦合进剪贴板，弃。
4. **剪贴板生命周期：提升到模块级单例**。现有 `clipboard` 是组件 `useState`，跨页签/跨文档粘贴不可用（与「在目标文档重建」语义冲突）。新增 `src/lib/docPropertyClipboard.ts` 模块级持有 `DocPropertyClipboardPayload | null`（`set`/`get`/`clear`），`handleCopy`/`handlePaste` 走该模块；不进 Zustand（非响应式需求，避免重渲染）。理由：最小改动拿到跨文档语义；不污染 store。
5. **L/T 图标语义 + 存储兼容**：`icons.ts` 的 `docPropertyVariant` 图形改为 L/T 双形态表达（L = 一行条：单行横条；T = 精排双列：两列分行），`label` 改「属性面板形态切换（L 一行条 / T 精排双列）」；`docs/design/system/spec.md` §2.3「文档属性」行改 `docPropertyVariant（L 一行条 / T 精排双列形态切换）` 并补图形规范（24×24 viewBox、笔画 1.7、14 档密集工具条）；`docs/design/system/decisions.md` append 一行台账。**存储值不变**：`docPropertyVariant` 仍 `A`/`B`、`normalizeDocPropertyVariant` 白名单不变、`displayStyle` 仍 `list`/`dual`；展示层做映射 `A→L 一行条`、`B→T 精排双列`。`variantToggle` 的 `title` 改为「切换到 L 一行条 / T 精排双列」、`aria-label` 保持「切换属性面板形态」、`aria-pressed` 语义不变；设置区标签 `{value:"list",label:"L 一行条"}` / `{value:"dual",label:"T 精排双列"}`。理由：用户要「图标看得出是模式切换」；保留存储值避免已存 "B" 的用户被迁移（#1147 已证实用户偏好为 "B"，迁移会误伤）。
6. **全选/反选保留**：现版 `handleSelectAll`（0→全选；≥1→可选集内补集，标题位手动态保留）已满足「0=全选、≥1=反选、反选=补集」，本 change 不动其逻辑，仅在 P-4 明文保留为场景。理由：用户未抱怨全选/反选，且现版语义与规格一致。
7. **delta 口径**：P-4 的「值不进入选中」场景**反向修订**为「值不属可选中单位、但随行高亮」；新增「选中集复制=类型+名称+未来属性（不含值）」与「粘贴重建空值字段」场景；P-2 新增/改写 L/T 图标与存储兼容场景。所有既有场景标题逐字保留（含反向修订项，标题不改，正文加 `>` 可追溯注记）。
8. **测试口径**：单测覆盖 `encodeFieldSelection` 不含值/含类型/attrs 保留、`decodeFieldSelection` 按类型重建空值、`uniqueKey` 去重；e2e 断言「选中行整行（含值）计算样式高亮」「单击字段名进改名、选中后点另一行切换选中、全选/反选文案」「复制→另一文档粘贴得到同类型同名字段且值为空」「标题栏图标为 L/T 语义 SVG 且提示含 L/T」；`verify.sh` 全绿。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2.3 | — | `docPropertyVariant` 条款改为 L/T 语义（L=List 一行条 / T=Table 精排双列）+ 图形规范；缺条款不得改图标 |
| 存储 | src/stores/docPropertyPanel.ts | docPropertyVariant | 存储值仍为 `A`/`B`（含 `displayStyle` list/dual），旧配置读为原值不迁移 |
| 校验 | src/hooks/useConfig.ts | normalizeDocPropertyVariant | 白名单仍只认 `A`/`B`，未知值回落 null，不新增存储值 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | `docPropertyVariant` 回填链路不变，`preference ?? (narrow ? "B" : fallback)` 语义不动 |
| 消费 | src/components/Content/DocPropertyBar.tsx | variantToggle | 图标图形与 title/aria 提示用 L/T 语义；设置项标签同步 L/T |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照，误改形态偏好一步恢复 |

（三道机检时点：G0 阶段二 `./scripts/cw-data-surface.sh new`、G0-POST `tickets`、G1 出口 `diff`。）

## Risks / Trade-offs

- [行级高亮与 `.dpb-a-title-cell.dpb-row-selected` 既有规则叠加] → 统一由行级基规则接管，移除/收敛节点级规则，e2e 断言选中行**含值区**计算背景为 `--app-accent-soft`。
- [三元组：单击改名与选中后点行切换的手势冲突] → 靠 capture 阶段 `stopPropagation` 分工（无选中放行 label、有选中拦截）；e2e 覆盖「无选中点字段名→改名输入框出现」「有选中点另一行→选中切换且改名不出现」。
- [剪贴板载荷不含值导致用户以为「复制丢失内容」] → 操作条/提示明示「复制字段定义（不含值）」；粘贴结果为空值字段，AC 写清。
- [跨文档粘贴依赖模块级单例生命周期] → 模块级持有，应用会话内有效；不持久化到磁盘（无隐私/泄密面）。
- [L/T 文案与存储 A/B 不一致引发困惑] → 设计明确「L/T 是展示语义，A/B 是存储值」；设置与图标只出现 L/T，代码内类型/存储保持 A/B（不改类型名，避免全局重命名噪声）。
- [e2e 与 CSS manifest] → 若新增 `cm-*` 类须同步 `src/styles/`；本 change 只改 `dpb-*`，预期不触发 manifest 新增。

## Migration Plan

1. 高亮：CSS 行级基规则 + 类挂载收敛（无行为回归）。
2. 交互：RenameLabel 单击改名 + capture 三元组 + 移除双击改名。
3. 剪贴板：`encode/decode` 纯函数 + 模块级单例 + handleCopy/handlePaste 改接。
4. 图标：design-system §2.3 + decisions 台账 + icons.ts 图形 + 提示/设置文案（存储值不动）。
5. 测试与 `verify.sh` 收口。
- 每步可独立合入 main（存储结构零变更；交互/高亮/剪贴板为行为修正，图标为展示层）。
- 回滚：按提交粒度回退；形态偏好未改存储值，无需数据迁移/回滚脚本。

## Open Questions

- **OQ-1**：L/T 图形是否需要两种明显不同构（L 单横条 vs T 双列），还是沿用同一外框内换排布？G0 倾向「同一外框语言、内部排布区分」，保持与既有 40 概念分组一致；实现时若辨识度不足再回设计。
- **OQ-2**：`attrs` 当前无实际字段属性可填（select 选项等未入字段模型），是否本批就把 select `options` 纳入？G0 倾向**不纳入**（无用户诉求、避免扩 P-3 类型系统），仅预留扩展位。
