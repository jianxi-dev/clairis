# 任务 — editor-surface-batch22

> 切片原则（QG-7）：每张票做完用户能在界面上看到变化；1 任务 = 1 票。
> 本 change **复用已重启的 #1053 / #1055**，不新建 issue；票面前缀沿用各票现状，tasks.md 用 `1.1 / 2.1` 编号。
> **Blocked by 语义**：`Blocked by` 为硬边，未解除不得开工。

## 依赖与阻塞总览

- 1.1（#1053）与 2.1（#1055）**无硬阻塞**，相互独立，可并行开工。
- 1.1 只改页签标题与页签条样式；2.1 只改搜索浮窗徽标与悬停选择，两者文件不重叠。

## 1. 页签

- [x] 1.1 [change=editor-surface-batch22/1.1] 页签标题单行全显 + 页签间距 32px（复用 #1053；PR #1086，已合并 b5e78a3）
  - 页签标题 SHALL 单行完整显示：SHALL NOT `text-overflow: ellipsis`、SHALL NOT 截断、SHALL NOT `-webkit-line-clamp`（含 `line-clamp`）、SHALL NOT 换行（`white-space: nowrap`）；页签总宽超过页签条可用宽度时页签条 SHALL 横向滚动
  - 相邻页签间距 SHALL 为 32px（±2px）
  - e2e：长页签标题计算 `text-overflow` ≠ `ellipsis`、`-webkit-line-clamp` = `none`、`white-space` = `nowrap`；相邻页签 `column-gap` = 32px（±2px）；页签条可横向滚动
  - QG-3 接线：本票改 `src/components/TabBar.tsx` 页签标题与页签条样式，无新导出
  - **数据面**: 无（CSS-only）
  - **验收锚点**: A-1.1、A-1.2、A-1.3、A-1.4、A-1.5

## 2. 搜索浮窗

- [x] 2.1 [change=editor-surface-batch22/2.1] 选中行徽标改回车图标 + 悬停更新 activeIndex（复用 #1055；PR #1087，已合并 637f727）
  - 选中 / 悬停行行尾徽标 SHALL 为键帽式回车图标（自绘静态 path，经 `src/ui/icons.ts` 与 `src/editors/icons.ts` 注册表渲染，可访问名「回车」），SHALL NOT 为裸文本「回车」
  - 指针悬停结果行 SHALL 更新 `activeIndex` 至该行（与 ↑↓ 同一选择态），徽标在该行显示
  - 既有 ↑↓ 移动 `activeIndex`、Enter 打开当前高亮结果、9 行上限、sticky 快捷键列保持不变
  - e2e：高亮 / 悬停行徽标内含 svg 图标节点且裸文本「回车」节点数 = 0；悬停行 k 后高亮 / `data-active` 移到 k；↑↓ 仍移动高亮
  - QG-3 接线：本票新注册的「键帽回车」图标名由本票接入 `src/ui/icons.ts`（`IconName` / `ICONS`）、`src/editors/icons.ts`（同步）与 `src/components/Content/SearchReplacePanel.tsx`（徽标渲染）
  - **数据面**: 规格,存储,校验,桥接,消费（新增「键帽回车」IconName）
  - **验收锚点**: A-2.1、A-2.2、A-2.3、A-2.4、A-2.5、A-2.6

## Open Questions

1. #1055 用户另报「定位一次后 ↑↓ 无法再移动」——独立缺陷，不在本 change 范围（见 design.md Open Questions）。
2. 页签间距 32px 是否需要设计系统补 `--space-32` 刻度条款（见 design.md Open Questions）。
