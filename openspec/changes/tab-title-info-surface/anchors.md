# 验收锚点 — tab-title-info-surface

锚点来源：维护者对 #1053（页签标题全显 + 间距 32px）的复看反馈、本次对话的技术实测（WKWebView / Chromium 的 ⌃+双击不派发 `dblclick`）、主规格 `application-shell` G-6 与「页签空白双击切换窗口全屏」、`navigation`「页签条与格头」、`editing` E-22，以及 `design.md` D1–D5。R-1…R-4 对应 tasks.md 1.1–3.1 与规范收口。

断言值全部取自用户明示数值（120px、8px）、主规格条款或设计系统既有刻度（`--radius-8`、32px 间距）；不引入未定义像素值。

> DQ-9（真机偏差类验收分级）：A-2.1/A-2.2 属布局测量、A-3.3 属系统剪贴板原生能力——headless 绿单独不构成关闭条件；实现票须附真机清单项（见 tasks.md 各票 AC 的「真机清单」）。

## R-1 页签标题固定宽度与省略号

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 超长页签标题容器的计算 `max-width`（px） | 120 | application-shell G-6（120px 上限）/ design D1 |
| A-1.2 | exact | 超长页签标题的计算 `text-overflow` 等于 `ellipsis` 的布尔 | 1 | application-shell G-6 |
| A-1.3 | exact | 短标题容器渲染宽度等于文本实际宽度（未被拉伸到 120px）的布尔 | 1 | application-shell G-6「短标题按实际长度显示」 |
| A-1.4 | exact | 相邻页签的计算 `column-gap`（px） | 32 | application-shell G-6（间距不变） |

## R-2 信息窗 R8 与文件名换行

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 页签名信息窗的计算 `border-radius`（px） | 8 | design-system §5 `--radius-8` / design D2 |
| A-2.2 | exact | 超长文件名行计算 `white-space` 不等于 `nowrap` 的布尔 | 1 | navigation「页签条与格头」信息窗条款 |
| A-2.3 | exact | 信息窗文件名容器 `scrollWidth` ≤ `clientWidth`（换行不溢出）的布尔 | 1 | navigation 同上 |
| A-2.4 | exact | 350px 以上视口下信息窗的计算宽度（px） | 320 | navigation「页签条与格头」信息窗条款（固定宽度）/ design D2 |

## R-3 信息窗复制路径 / 复制文件

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 路径行末尾复制图标按钮数 | 2 | navigation「页签条与格头」复制动作条款 |
| A-3.2 | state-machine | 点击「复制路径」→ 剪贴板文本等于该页签文件绝对路径 | 点击→路径入剪贴板 | navigation 同上 |
| A-3.3 | state-machine | 点击「复制文件」→ 系统剪贴板含该文件引用（macOS 访达可粘贴） | 点击→文件入剪贴板 | navigation 同上 / DQ-9 真机 |

## R-4 空白双击全屏稳定化与规范收口

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | state-machine | 两记按下位移 ≤4px 的双击 → 全屏状态切换一次 | 双击→全屏切换 | application-shell「页签空白双击切换窗口全屏」 |
| A-4.2 | exact | 上述双击过程中 `startDragging` 调用次数 | 0 | application-shell（双击内第二记按下 SHALL NOT 启动窗口拖动） |
| A-4.3 | exact | 位移 >4px 后松开时全屏状态变化次数 | 0 | application-shell「超过阈值不触发全屏」 |
| A-4.4 | exact | 主规格中「页签栏空白双击新建文档」requirement 条数 | 0 | application-shell REMOVED |
| A-4.5 | exact | 全屏条款 Scenario 中断言 `isMaximized()` 的条数 | 0 | application-shell「页签空白双击切换窗口全屏」 |
