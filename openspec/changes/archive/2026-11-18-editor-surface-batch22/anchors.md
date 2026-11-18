# 验收锚点 — editor-surface-batch22

锚点来源：重启的 #1053（页签）/ #1055（搜索浮窗）用户反馈 + design.md D1–D2 与主规格条款。R-1 对应 tasks.md 1.1（页签），R-2 对应 tasks.md 2.1（搜索徽标）。断言值取自用户明示数值、主规格条款或一手代码观察；视觉观感类一律用可机检的计算样式 / 状态，不写未定义的像素值。锚点编号为本 change 独立空间，不复用 batch21 的 A-17.2 等。

## R-1 页签标题单行全显 + 页签间距 32px

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 相邻页签间距（px，容差 ±2） | 32 | #1053 用户反馈 / navigation 页签条与格头 |
| A-1.2 | exact | 生效 `text-overflow: ellipsis` 的页签标题节点数 | 0 | #1053 / code obs TabBar |
| A-1.3 | exact | 页签标题计算 `-webkit-line-clamp` 为 `none` 的节点数下限 | 1 | #1053（line-clamp 达上限仍渲染省略号） |
| A-1.4 | exact | 页签标题计算 `white-space` 为 `nowrap` 的节点数下限 | 1 | #1053（单行不换行） |
| A-1.5 | state-machine | 页签总宽超过页签条可用宽度 → 页签条可横向滚动 | 溢出→可滚动 | #1053 / navigation 长页签可滚动 |

## R-2 选中行徽标为回车图标 + 悬停更新 activeIndex

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 高亮 / 悬停行徽标内 svg 图标节点数下限 | 1 | #1055 / design-system §2.1 |
| A-2.2 | exact | 高亮 / 悬停行徽标内裸文本「回车」节点数 | 0 | #1055（要图标，不要「回车」两个字） |
| A-2.3 | exact | 徽标可访问名（`aria-label` / `title`）为「回车」的布尔 | 1 | #1055 / 可访问性 |
| A-2.4 | state-machine | 鼠标悬停结果行 k → 该行成为 `activeIndex` 高亮行且徽标显示 | 悬停→选中 | #1055 |
| A-2.5 | state-machine | ArrowDown / ArrowUp → `activeIndex` 高亮行变化，徽标跟随 | 按键→高亮变 | #1055 / search-replace-float S-3 |
| A-2.6 | state-machine | Enter → 打开当前高亮结果并滚动到可视区 | 回车→定位命中 | search-replace-float S-3 |
