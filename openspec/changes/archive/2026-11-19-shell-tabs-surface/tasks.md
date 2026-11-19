# 任务清单：页签等比伸缩与信息窗复制动作 / 悬浮提示（shell-tabs-surface）

> 规格：`specs/navigation/spec.md`（「页签条与格头」MODIFIED）、`specs/application-shell/spec.md`（「G-6 顶栏职责与页签身份」MODIFIED）。设计：`design.md`（决策 1～8 + 数据面六行表）。需求输入：GitHub #1155 及其评论「对账确认（2026-11-19）：全按 ★ 默认实施」（最终依据）。
>
> **切片说明（QG-7）**：按垂直切片拆票，每票贯穿样式 / 交互 / 图标 → UI → 测试全层，做完用户能在页面上直接看到变化。1.1（页签布局）与 1.2（信息窗动作）按语义风险倒序排列（布局 > 图标 / 提示）；两票都改 `src/styles/editor.css`，串行避免同文件冲突。
>
> **测试归属（QG-2/QG-4）**：Playwright e2e 随各票交付（票面 AC 列明）；2.1 只做全量收口。
>
> **数据面机检三连**：G0 阶段二 `./scripts/cw-data-surface.sh new` → G0-POST `tickets` → G1 出口 `diff`。1.1 认领 规格 / 消费；1.2 认领 规格 / 存储 / 校验 / 桥接 / 消费 / 回滚（存储 / 校验 / 桥接 / 回滚为「本 change 不触及」声明，见 change 六栏表）。
>
> **不新建子票**：子票由编排器 G0-POST 统一建（Parent=#1155），本清单只出任务。

## 依赖与阻塞总览

- 1.1 无阻塞（首批开工票）。
- 1.2 Blocked by 1.1（同改 `src/styles/editor.css`，先定页签布局再改信息窗样式，避免同文件叠加）。
- 2.1 Blocked by 1.1、1.2。

## 1. 垂直切片

- [x] 1.1 **页签弹性等比伸缩 + 最小宽度保底**
  - 用户做完后能：拖窄窗格时，多个页签的宽度一起同比缩小（不再只有右侧被裁切），间距保持 32px、互不覆盖、不溢出；继续拖窄到保底后页签条可横向滚动。
  - 先补设计系统：`docs/design/system/spec.md` 新增 §7.5 定义 token `--tab-min-width`；`docs/design/system/decisions.md` append 一行取代 `:81` 的 120px 行。
  - `src/styles/tokens.css`：新增 `--tab-min-width`，删除 `--tab-title-max-width`。
  - `src/components/TabBar.tsx`：页签条（:478）去 `shrink-0`、改 `min-w-0`；页签（:553）去 `shrink-0`，改 `flex-1 min-w-0` + `min-width: var(--tab-min-width)`；标题（:597）移除 `style={{ maxWidth: "var(--tab-title-max-width)" }}`，保留 `min-w-0 overflow-hidden text-ellipsis whitespace-nowrap`。
  - `src/styles/editor.css`：同步页签弹性规则（如需）。
  - e2e：`e2e/tab-selection.spec.ts:57` 间距断言保持；`:96` 改为「长标题省略号 + 短标题随伸缩拉伸」；`:160` 改为「保底被击穿后才横向滚动」；新增「窗格变窄时多页签等比收缩、无覆盖、无溢出」。
  - AC：`npm run tauri dev` 打开 3 个以上页签 → 拖窄窗格，各页签宽度同比缩小、相邻间距仍 32px、无互相覆盖、页签条不溢出；继续拖窄至保底后页签条出现横向滚动；标题单行省略号；拖宽后页签恢复伸展。
  - 锚点：navigation 场景「窗格变窄时页签等比收缩」「页签名无省略号」「长页签可滚动」；application-shell 场景「窗格变窄时页签等比收缩」。
  - Blocked by：无。
  - 接线归属：无新增导出（改既有 `TabBar` 内部布局与 token）。
  - 标签：ready-for-agent、ui-surface。
  - 视觉锚点：design-system:§7.5。
  - 数据面：规格,消费

- [x] 1.2 **信息窗复制图标换位 + 图形可区分 + 悬浮 toast**
  - 用户做完后能：悬停页签名，两个复制图标在「最近保存时间」行右侧且一眼可辨；点击复制后按钮旁浮出胶囊提示、约 2 秒自动消失，路径行内不再出现成功文本。
  - 先补设计系统：`docs/design/system/spec.md` §2.3 动作组更新 `copyPath`（路径语义图形）并新增 `copyFile`（文件语义图形）；`docs/design/system/decisions.md` append 图形台账。
  - `src/ui/icons.ts`：`copyPath` 图形改为「斜杠 + 文件夹」；新增 `copyFile` = 「文档 + 向右上箭头」；`copy` 不动。
  - `src/components/TabInfoPopover.tsx`：`tab-info__copy` 区块从文件名行移到时间行（`tab-info__time`）右侧；两按钮换用 `copyPath` / `copyFile`；移除 `tab-info__notice` 行内文本，改 toast state（文本 + 触发按钮锚点），约 2000ms 自动消失。
  - `src/styles/editor.css`：`.tab-info__copy` 位置规则、toast 胶囊样式（`border-radius: 999`、深色底、`pointer-events: none`）。
  - e2e：`e2e/tab-info-popover.spec.ts:130-149` 复制按钮位置改到时间行、成功提示断言改 toast；`:233-283` 改为「复制图标在时间行右侧 + 两图形可区分」；新增 toast 出现 / 约 2000ms 自动消失 / 不阻挡指针断言。
  - AC：`npm run tauri dev` 悬停页签名 → 时间行右侧出现两个图形不同的复制按钮（复制路径 ≠ 复制文件）；点击「复制路径」剪贴板 = 绝对路径，点击「复制文件」剪贴板含文件引用；两次点击均浮出锚定按钮的圆角胶囊 toast，约 2000ms 后消失；信息窗路径行内无成功文本。
  - 锚点：navigation 场景「信息窗复制路径与复制文件」「复制成功悬浮提示」。
  - Blocked by：1.1。
  - 接线归属：无新增导出（改既有 `TabInfoPopover` 内部与 `ICONS` 表）。
  - 标签：ready-for-agent、ui-surface。
  - 视觉锚点：design-system:§2.3。
  - 数据面：规格,存储,校验,桥接,消费,回滚

## 2. 验收与交付

- [x] 2.1 **集成验收与交付**
  - 用户做完后能：页签等比伸缩与信息窗复制动作在真机桌面上一起可观测成立，既有页签 / 信息窗行为不回归。
  - `npm run tauri dev` 手动走查全量关键路径（多页签拖窄等比收缩、保底后滚动、信息窗两图标位置与区分度、复制 toast 出现与消失），按仓库 UI 约定用功能说明性语言记录；`bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）；数据面机检 `diff` 收口；更新 `docs/delivery/requirements-status.md`；G4 归档。
  - 涉及文件：`docs/delivery/requirements-status.md`（无 src 改动）。
  - 验证命令：`bash scripts/verify.sh`。
  - Blocked by：1.1、1.2。
  - 接线归属：不适用（收口票）。
  - 视觉锚点：design-system:§7.5、§2.3。
  - 数据面：无

## 3. 来源映射

| 任务 | 来源 | 规格触点 |
|---|---|---|
| 1.1 | #1155 五.2 对账确认（★A 弹性等比伸缩） | navigation「页签条与格头」弹性伸缩场景；application-shell「G-6」同步 |
| 1.2 | #1155 五.3 对账确认（★A 换位 + 换图标 + toast） | navigation「信息窗复制路径与复制文件」「复制成功悬浮提示」 |
| 2.1 | 上述两票收口 | navigation / application-shell 全量 |
