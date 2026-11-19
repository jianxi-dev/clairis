# 变更提案：文档属性交互还原（二.1 / 二.2 / 二.4）

## Why

文档属性面板（`doc-property-panel`）在 #1131（`566a8ed`）做「选择模式」改造时，把三处用户已习惯的行为一起改掉了：选中高亮从**整块（含值）**缩成只染字段名节点、字段名从**单击改名**改成单击选中 + 450ms 双击改名、AB 形态切换图标语义不清。维护者 2026-11-19 第三轮验收给出对账确认（GitHub #1152 评论，最终依据）：二.1 ★A 高亮整块 + 选中集复制不含值；二.2 采纳 **L/T** 替代 A/B；二.4 ★A 完整还原上版三元组交互，并显式保留「已选中后点其他字段任意位置即切换选中」。本 change 把这三项一次性收口，走 OpenSpec 闭环。

## What Changes

- **选中视觉恢复整块（含值）高亮**：恢复行级 `.dpb-row-selected` 基规则（或等效行容器挂类），选中字段行整行（含值）高亮；值文本节点仍不属可选中单位（不可单独选中/全选），仅随所在行高亮。
- **选中集复制语义变更（BREAKING 语义，非破坏性数据）**：选中集复制载荷 = **字段类型 + 字段名称 + 未来字段属性**，**不含值**；粘贴 = 在目标文档重建同定义（同类型/同名/同未来属性）字段、**值为空**。剪贴板载荷改为结构化 JSON（G0 决策格式）。原 `cloneFieldsForPaste`（拷贝含值）语义被替换。
- **还原上版三元组交互**：① 单击字段名 = 进入改名（`RenameLabel` `onClick=start`，title「点击改名」）；② 选中入口 = 行手柄点击（<5px 抬手 `toggleRow`）；③ **已选中任一字段后，点击其他字段任意位置 = 切换选中**（旧版 `onPanelClickCapture` 语义，用户强调既有行为必须保留）。移除 #1131 的 450ms 原地双击改名。全选/反选按钮保留（0=全选、≥1=反选、反选=补集）。
- **形态切换图标改用 L/T 语义**：L = List 一行条、T = Table 精排双列，替代 A/B 字样；图标图形、`title`/`aria-label` 提示语义同步。**存储兼容**：全局偏好 `docPropertyVariant` 的存储值仍为 `A`/`B` 不变（避免用户配置迁移），仅图标与提示语义改为 L/T；`normalizeDocPropertyVariant` 白名单不变。
- **规格修订**：P-4 MODIFIED（选中视觉、三元组交互、复制语义、「值不进入选中」反向修订、全选/反选保留）、P-2 MODIFIED（L/T 图标语义 + 存储兼容说明）。

## Capabilities

### New Capabilities

（无——三项均为既有能力 `doc-property-panel` 的需求修订。）

### Modified Capabilities

- `doc-property-panel`：P-4（选中视觉恢复整块含值；还原上版三元组交互；新增「选中集复制=类型+名称+未来属性、不含值」场景；「值不进入选中」反向修订；全选/反选保留）、P-2（形态切换图标改用 L/T 语义，存储值 A/B 不变）。其余 P-1/P-3/P-5～P-8 不改。

## Impact

- **前端**：`src/components/Content/DocPropertyBar.tsx`（`RenameLabel` 单击改名、`onPanelClickCapture` 三元组、450ms 双击移除、`handleCopy`/剪贴板载荷、`variantToggle` 提示语义）；`src/lib/frontmatter.ts`（`cloneFieldsForPaste` 语义替换为不含值载荷 + 粘贴重建）；`src/ui/icons.ts`（`docPropertyVariant` 图形改 L/T）；`src/styles/doc-property.css`（`.dpb-row-selected` 行级基规则恢复 / `.dpb-node-selected` 语义收敛）；`docs/design/system/spec.md` §2.3 条款 + `docs/design/system/decisions.md` 台账。
- **数据面**：命中 `src/ui/icons.ts`（图标）信号 → design.md 必含「## 数据面」六栏表，跑 `./scripts/cw-data-surface.sh new doc-property-restore`。
- **存储兼容**：`docPropertyVariant` 存储值 `A`/`B` 不变（`src/stores/docPropertyPanel.ts` / `src/hooks/useConfig.ts` 不动存储语义），仅展示层语义改 L/T。
- **测试**：单测（剪贴板载荷不含值 + 粘贴重建空值）；e2e（选中整行含值高亮、单击改名、选中后点行切换选中、复制→粘贴空值、L/T 图标与提示）；`bash scripts/verify.sh` 全绿。
- **不在范围**：二.5 嵌入正文（归 #1157 独立 change `doc-property-embed`）；二.3 720px 胶囊偏好污染（归缺陷票 #1147）；设置区显示样式文案的 A/B 字样是否改 L/T（G0 决策：设置区同步改 L/T 文案，保持全站语义一致）。
