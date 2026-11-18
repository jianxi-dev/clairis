# 验收锚点 — editor-surface-batch23

锚点来源：重启的 #1054（搜索浮窗）/ #1050（大纲）/ #1049（预览态选区工具条）/ #1044（日期时间字段）用户反馈 + design.md D1–D4 与主规格条款。R-1…R-4 对应 tasks.md 1.1–4.1。断言值取自用户明示数值、主规格条款或一手代码观察；视觉观感类一律用可机检的计算样式 / 状态，不写未定义的像素值。锚点编号为本 change 独立空间（R-1…R-4 / A-1.x…A-4.x），不复用 batch21 / batch22 的编号。

> DQ-9（真机偏差类验收分级）：本批触及字体 / 布局测量（#1054 字号）、拖拽指示与正文同步（#1050）、用户语义裁定（#1044 面板语义）——这些锚点虽可机检，但 headless / mock 绿单独不构成关闭条件；实现票须附真机清单项（见 tasks.md 各票 AC 的「真机清单」）。

## R-1 搜索浮窗顶栏 / 状态栏 / 输入框 / 字号（#1054）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 浮窗顶栏内含标题「搜索和替换」的文本节点数下限 | 1 | #1054 用户反馈 / search-replace-float S-1 |
| A-1.2 | exact | 顶栏内位于关闭按钮右侧的兄弟节点数 | 0 | #1054（关闭按钮在顶栏最右侧，不在视图切换图标之后） |
| A-1.3 | exact | 状态栏文案中「（局部 · 浮窗内）」出现次数 | 0 | #1054 / search-replace-float S-6 |
| A-1.4 | exact | 状态栏文案等于「↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达 · Esc 关闭」的布尔 | 1 | #1054 / search-replace-float S-6 |
| A-1.5 | state-machine | 搜索输入非空 → 出现一键清空按钮；点击后关键词清空 | 输入→清空 | #1054 / search-replace-float S-1 |
| A-1.6 | exact | 结果定位行计算 font-size（px） | 11 | #1054 / design-system §4 |
| A-1.7 | exact | 结果上下文片段计算 font-size（px） | 12 | #1054 / design-system §4 |
| A-1.8 | exact | 行尾快捷键徽标计算 font-size（px） | 11 | #1054 / design-system §4 |

## R-2 大纲插入指示条 / 正文顺序同步 / 层级标识（#1050）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 拖动大纲条目期间出现插入位置指示条并随指针移动 | 拖动→指示条出现 | #1050 / editing E-10 |
| A-2.2 | state-machine | 松手后正文标题顺序与大纲顺序一致 | 松手→正文同步 | #1050（缺陷复现）/ editing E-10 |
| A-2.3 | exact | 三个连续同级二级标题各自持有的层级标识节点总数 | 3 | #1050（每个大纲前都有标识） |
| A-2.4 | exact | 非悬停项中可见的层级标识节点数 | 0 | #1050（仅鼠标滑入项显示标识） |
| A-2.5 | state-machine | 鼠标悬入某大纲项 → 该项层级标识可见 | 悬停→标识显示 | #1050 |
| A-2.6 | exact | 层级标识计算 color 等于 `--app-text-3` 解析值的布尔 | 1 | #1050 / design-system §6 |

## R-3 预览态选区工具条显示时机（#1049）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 拖选过程中（鼠标未松开）工具条节点数 | 0 | #1049 / reading 预览态选区工具条 |
| A-3.2 | state-machine | 鼠标松开（选区完成）后工具条出现 | 松开→工具条出现 | #1049 / reading 预览态选区工具条 |
| A-3.3 | exact | 工具条水平中心与鼠标落点 x 的偏差上限（px） | 4 | #1049 / reading 预览态选区工具条 |

## R-4 日期时间单面板（#1044）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 日期时间值编辑器内分离的 `input[type=date]` + `input[type=time]` 节点数 | 0 | #1044 / doc-property-panel P-3 |
| A-4.2 | state-machine | 打开值编辑器 → 单一面板出现（月历网格 + 时分步进） | 打开→单面板 | #1044 / doc-property-panel P-3 |
| A-4.3 | state-machine | 面板选定 2026-11-18 与 14:30 后提交 → 字段值等于 `2026-11-18T14:30` | 选定→组合提交 | #1044 / doc-property-panel P-3 |
| A-4.4 | state-machine | Tab 在月历与时分间移动、Enter 提交、Esc 取消 | 键盘→可达 | #1044 / doc-property-panel P-3 |
| A-4.5 | state-machine | 面板内操作不触发提交；面板关闭 / 失焦才提交 | 面板内→不提交 | #1044 / doc-property-panel P-3 |
