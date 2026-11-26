# 验收锚点 — editor-surface-batch23

锚点来源：一手观察（用户 2026-11-26 反馈 + 截图取证 `.artifacts/editor-surface-batch23/`）与既有规格条款（E-24/E-44）。无原型 change，来源均为显式决策或一手观察。

## R-1 裁剪清理可靠性（E-44 新增 scenario：多轮裁剪零残留 / 已加载图片标识线必现）

连续裁剪后页面无裁剪标识残留；已加载图片点击裁剪必现标识线，未加载显示提示。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 连续 5 次裁剪确认后页面无残留 | `.cm-image-crop-frame, .cm-image-crop-shade, .image-crop-mark` 节点计数 = 0 | e2e 断言 + 用户反馈 #3（截图 4 条深灰短横线） |
| A-1.2 | state-machine | 已加载图片点裁剪 → 标识线立现；未加载 → 加载提示 | 已加载→立现裁剪框节点；未加载→出现「加载中」提示节点 | 用户反馈 #5 + 一手观察（代码两处 return 路径） |
| A-1.3 | exact | 裁剪确认前后图片位置零位移 | 探针滚动位移测量 ≤ 1px（before/after 成对） | cropJumpProbe 实测 + 用户反馈 #1 |

## R-2 重置按钮条件显示（E-24 / E-39 既有条款的实现清偿）

仅在有 crop 属性时显示「重置图片」。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 无 crop 图选中 → 重置按钮不可见；裁剪确认后 → 可见；拖回整图重置后 → 不可见 | display 三态翻转：'none'→''→'none'（计算样式） | E-39 规格原文（openspec/specs/editing/spec.md L174）+ 用户反馈 #2 |

## R-3 工具条滚动期行为（ADDED：图片选中工具条滚动期行为方案A）

滚动期隐藏、停滚一次定位、无逐帧抖动。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | 滚动进行中工具条隐藏；停滚 ≤50ms 重现且与图片相对位置一致 | is-scrolling 计算样式 display:none → 停滚后移除 | 用户确认方案A + 用户反馈 #4a |
| A-3.2 | exact | 滚动 2 秒期间工具条状态翻转次数 = 1（进入隐藏一次，不出现中间显示态） | is-scrolling 状态翻转计数 ≤ 1 | 用户反馈 #4a（「不要再抖再跳」） |

## R-4 放大层增强（E-24 新增 scenario：tooltip / ± / 百分比 / 多图切换）

自定义 tooltip、± 缩放、百分比显示、多图切换与索引。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | state-machine | 悬停按钮 ≤300ms 出现气泡提示，移开消失 | tooltip 节点出现→消失状态翻转 | quiet 参考截图（图片查看工具条.png「下一张」气泡）+ 用户反馈 #6 |
| A-4.2 | exact | 点击 ± 缩放且百分比同步、边界禁用 | 每次点击百分比变化 ≥1 步；边界按钮 disabled='true' | quiet 截图（79% 显示）+ 用户反馈 #6 |
| A-4.3 | exact | 多图切换：下一张索引「2/3」、左方向键回第 1 张、边界禁用 | 3 图文档索引文本严格等于 '2/3'；边界按钮 disabled='true' | quiet 截图（「1/2」索引）+ 用户反馈 #6 |

## R-5 预览态图片双击查看（reading ADDED）

预览模式双击图片打开放大层；容器缩放不被复位。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | 预览双击 → 放大层打开（含裁剪呈现）；双击/Esc 退出无遮罩残留 | 放大层节点出现→消失 | 用户反馈 #7 |
| A-5.2 | state-machine | 预览容器自身缩放不被双击复位 | 容器缩放值双击前后差值严格等于 0 | 既有行为（PreviewView dblclick 缩放复位）与 #7 并存 |
