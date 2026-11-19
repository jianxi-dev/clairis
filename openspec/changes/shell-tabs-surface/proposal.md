# 变更提案：页签等比伸缩与信息窗复制动作 / 悬浮提示（五.2 / 五.3）

## Why

页签条当前把每个页签固定为不伸缩（`shrink-0`）+ 标题固定最大宽度 120px（token `--tab-title-max-width`），窗格调小时右侧页签标题被裁切 / 覆盖，靠左页签宽度不变，无法按可用宽度等比收缩（GitHub #1155 对账 五.2，附截图证据）。信息窗的「复制路径 / 复制文件」两个图标都放在文件名行、图形区分度不足（两个重叠方块），成功提示以行内文本嵌在路径后 1400ms，易被忽略（五.3）。维护者 2026-11-19 第三轮验收对账确认（#1155 评论「全按 ★ 默认实施」）：页签改弹性等比伸缩；两图标移到「最近保存时间」行右侧 + 换区分度更高图标 + 成功提示改悬浮 toast（照 VideoPlayer shot-toast 范式）。

## What Changes

- **页签弹性等比伸缩**：页签改为弹性布局，按页签条可用宽度在各页签间等比伸缩（flex 分配），设**最小宽度保底**；标题在伸缩后的可用宽度内仍以省略号收尾、单行不换行。仅当可用宽度不足以容纳全部页签的最小宽度保底时，页签条才横向滚动。**保持**：相邻页签间距 32px、页签内标题右缘↔关闭钮 ≤6px、拖拽排序、双击重命名。
- **信息窗复制动作移到「最近保存时间」行右侧**：两个复制图标不再位于文件名节点之后。
- **复制图标区分度**：复制路径与复制文件改用可区分图形（复制路径 = 斜杠 + 文件夹；复制文件 = 文档 + 箭头），经 `src/ui/icons.ts` 注册表；新增概念先补设计系统 §2.3 条款与 decisions 台账。
- **成功提示改悬浮 toast**：复制成功后以锚定触发按钮、圆角胶囊、约 2000ms 自动消失的悬浮 toast 呈现，不再以行内文本嵌在路径后、不阻挡指针。
- **规格修订**：`navigation`「页签条与格头」MODIFIED（页签弹性伸缩；信息窗复制图标位置 / 区分度 / toast）；`application-shell`「G-6 顶栏职责与页签身份」MODIFIED（与 navigation 明文「两处 SHALL 一致」，同步 120px 口径）。既有场景标题逐字保留。

## Capabilities

### New Capabilities

（无——两项均为既有能力的需求修订。）

### Modified Capabilities

- `navigation`：「页签条与格头」MODIFIED：页签弹性等比伸缩 + 最小宽度保底（取代固定 120px 上限）；信息窗「复制路径 / 复制文件」移到「最近保存时间」行右侧、图形可区分、成功提示改悬浮 toast。
- `application-shell`：「G-6 顶栏职责与页签身份」MODIFIED：页签标题显示与间距由固定 120px 上限改为弹性等比伸缩 + 最小宽度保底，与 navigation 保持一致（该域是页签标题的权威表述）。

## Impact

- **前端**：`src/components/TabBar.tsx`（页签条 / 页签弹性布局类，移除 `shrink-0` 与固定 `max-width`，改 flex 伸缩 + `min-width`）；`src/components/TabInfoPopover.tsx`（复制按钮移到时间行、换图标、toast）；`src/ui/icons.ts`（复制路径 / 复制文件图标图形）；`src/styles/editor.css`（`.tab-strip` / `[data-tab-id]` 弹性规则、`.tab-info__copy` 位置、toast 样式）；`src/styles/tokens.css`（新增页签最小宽度保底 token，`--tab-title-max-width` 退役）。
- **设计系统**：`docs/design/system/spec.md` §2.3（动作组新增 / 改写复制图标概念）+ §7.5（页签最小宽度保底 token）；`docs/design/system/decisions.md` 台账（新图标图形、页签伸缩裁决、取代 120px 行）。
- **数据面**：命中 `src/ui/icons.ts`、`src/styles/tokens.css` 路径信号 → design.md 必含「## 数据面」六行表，跑 `./scripts/cw-data-surface.sh new shell-tabs-surface`。
- **测试**：e2e（窗格缩小时多页签等比收缩、无覆盖 / 无溢出；信息窗复制按钮在时间行右侧、图形可区分、toast 出现并自动消失）；`bash scripts/verify.sh` 全绿。
- **不在范围**：页签右键菜单的动作与文案（保持；其「复制路径」图标随 `copyPath` 概念更新）；页签名信息窗宽度 `--tab-info-width`（保持 256px）；页签拖拽排序 / 双击改名 / 生命周期；格头菜单。
