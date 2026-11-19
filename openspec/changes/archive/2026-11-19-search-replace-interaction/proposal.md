# 变更提案：搜索替换交互修补（一.1 / 一.3 + 新增①②）

## Why

搜索替换浮窗（`search-replace-float`）第三轮验收对账（GitHub #1153，以票面评论「对账确认（2026-11-19）」为最终依据）确认四处交互问题：① 普通搜索态悬停结果行不弹全文预览（预览卡自始被 `replaceMode` gate 拦住，非回归但不符合用户预期）；② 预览态打开浮窗时替换按钮不可见（用户误以为「新 bug」）；③ 替换模式每行内联「原词 → 新词」diff 信息冗余；④ 结果区纯色背景难辨行距。本 change 一次性收口，走 OpenSpec 闭环。

## What Changes

- **移除替换模式每行 inline diff**：结果行不再显示「搜索词 → 替换词」的删除线/强调色 diff 预览，仅保留命中行本身。修订 S-4 对应条款。
- **结果行交替背景色（斑马纹）**：结果区相邻两行以不同背景色区分（隔行交替），底色取设计系统既有 surface / sunken 语义色，悬停 / 选中态覆盖交替底色。S-3 新增场景。
- **悬停全文预览放开 `replaceMode` gate**：普通搜索态与替换模式均弹出全文预览卡（所在块完整内容 + `L行号 · 块标题`）。S-4「悬停全文预览仅替换模式」场景反向修订。
- **预览态替换按钮灰置禁用**：预览态打开浮窗时输入行 ⇄ 替换模式按钮可见但灰置禁用，`title` 说明「预览态不可替换」，点击不进入替换模式。S-4 新增场景。

## Capabilities

### New Capabilities

（无——四项均为既有能力 `search-replace-float` 的需求修订。）

### Modified Capabilities

- `search-replace-float`：S-4（移除 inline diff；「悬停全文预览仅替换模式」反向修订为两种模式均弹；新增「预览态替换按钮灰置禁用」场景）、S-3（新增「结果行交替背景色（斑马纹）」场景；「悬浮全文预览为渲染态」条件同步去掉替换模式限定）。其余 S-1/S-2/S-5/S-6 不改。

## Impact

- **前端**：`src/components/.../SearchReplacePanel.tsx`（悬停预览 gate `replaceMode` 条件、预览态 `canReplace` 分支下 ⇄ 按钮渲染与禁用态、移除 inline diff 渲染、结果行斑马纹类）；`src/styles/search-float.css`（结果行交替底色、灰置按钮样式）；`e2e/`（普通搜索态悬停弹卡、预览态 ⇄ 可见灰置、结果行交替背景色断言）。
- **规格**：`openspec/specs/search-replace-float/spec.md` 的 S-3/S-4 经本 change delta 修订；主规格待 G4 合并后同步。
- **数据面**：不命中数据面识别信号（G0 跑 `./scripts/cw-data-surface.sh new` 确认并记录原始输出）。
- **测试**：e2e 断言普通搜索态悬停弹卡、预览态 ⇄ 可见且灰置禁用、结果行相邻背景色不同；`bash scripts/verify.sh` 全绿。
- **不在范围**：S-3 的「指针悬停更新 activeIndex」语义、S-6 状态栏、替换事务 / 计数 / 自动跳下一处等既有能力。
