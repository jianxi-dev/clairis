# 验收锚点 — shell-editor-batch5

锚点来源：本 change `design.md` D1–D22、`specs/*/spec.md` delta（G-3/G-7/G-8/G-10、状态栏、图标体系、阅读空间卡片、悬浮预览窗、页签条与格头、E-10…E-17、C-4/C-6、PDF 预览）、用户 2026-11-08 反馈与两张工具条截图、仓库现状代码实测（spec issue #311）。

> 无原型 baseline（本 change 无 `baseline/*.png`）；锚点均为 `exact` / `state-machine`，来源为 spec / design / 一手观察。

## R-1 分栏 · 页签 · 沉浸（反馈 1 / 2 / 3 / 9 / 10）

悬浮条跟随指针格、跨格拖拽可用、无露白、空格兜底、ghost 跟手、单格全屏、折叠边无色。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 沉浸态指针移入第二格后唤出的悬浮条所列页签集 | """second-pane""" | spec G-10 |
| A-1.2 | exact | 沉浸态悬浮条与屏幕顶部之间的可见透明空行高度 | 0 | spec G-10 |
| A-1.3 | state-machine | 沉浸态悬浮条对应空格时的兜底文案存在 | """true""" | spec G-10 |
| A-1.4 | state-machine | 沉浸态从悬浮条把页签拖到另一格后目标格页签数 | 1 | spec G-10 |
| A-1.5 | state-machine | 拖拽页签时 ghost 元素存在且文本含页签标题 | """true""" | spec G-8 |
| A-1.6 | exact | 单格工作区全屏按钮数量 | 1 | spec G-7 |
| A-1.7 | exact | 阅读空间折叠态边缘条计算背景 alpha | 0 | spec 阅读空间竖排栏 |
| A-1.8 | state-machine | 双击页签名改名回车后页签标题 | """新名""" | spec 页签条与格头 |

## R-2 图标体系（反馈 7 / 15）

export 族三形、subtitle↔keyboardHints 可区分、播放器控件同尺寸、沉浸图标、钉住切 pinOff。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 导出二级菜单 Word/ZIP/.mdpkg 三项图标名互不相同 | 3 | spec 图标体系 |
| A-2.2 | exact | subtitle 与 keyboardHints 的 path 字符串不同 | """true""" | spec 图标体系 |
| A-2.3 | exact | 视频全屏控件与其它自绘控件渲染尺寸相等 | """true""" | spec 图标体系 |
| A-2.4 | exact | 顶栏沉浸入口含 `svg[data-icon=immersive]` | 1 | spec 图标体系 |
| A-2.5 | state-machine | 钉住后按钮 `data-icon` | """pinOff""" | spec 图标体系 |

## R-3 PDF 预览（反馈 5 / 6）

无缩放按钮、捏合可缩放、滚动无底栏、顶部可翻页、卡片真缩略图。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | PDF 顶栏放大/缩小按钮数量 | 0 | spec PDF 预览缩放 |
| A-3.2 | state-machine | 双指捏合后 PDF 缩放比例变化 | """changed""" | spec PDF 预览缩放 |
| A-3.3 | exact | 滚动 PDF 组合成事件后底部页码工具条数量 | 0 | spec PDF 页码工具条位置 |
| A-3.4 | state-machine | PDF 卡片缩略图为真实位图而非占位线块 | """image""" | spec PDF 卡片缩略图 |

## R-4 Markdown 编辑（反馈 18 / 19 / 20 / 21 / 23 / 24 / 25 / 26）

全角斜杠触发、手柄滑入显菜单、大纲按钮形态、标题折叠、选区工具条、前进后退恢复、对齐。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | state-machine | 行首输入顿号后斜杠命令菜单打开 | """open""" | spec E-13 |
| A-4.2 | state-machine | 指针滑入已显示手柄后块菜单打开 | """open""" | spec E-17 |
| A-4.3 | state-machine | 大纲按钮钉住后 `data-pinned` | """true""" | spec E-10 |
| A-4.4 | exact | 有下级内容的标题前折叠三角数量 | 1 | spec 标题折叠 |
| A-4.5 | state-machine | 选中文字后文字工具条控件名集合 | """workbuddy-text-set""" | spec 选区浮动工具条 |
| A-4.6 | state-machine | 预览→编辑同步后按一次 Ctrl+Z 正文非空 | """true""" | spec 前进后退恢复 |
| A-4.7 | state-machine | 应用居中后源码含对齐标记 | """true""" | spec 块对齐 |

## R-5 阅读空间卡片 · 状态栏 · 新建（反馈 11 / 13 / 14 / 16 / 22）

动作左下与顺序、进度时间右上、更名收藏、窄窗、底部按钮重显、状态栏四图标、新建默认 md 并跳转。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 卡片动作按钮顺序 | """open,split-right,split-down,favorite,path""" | spec 阅读空间密度与卡片规格 |
| A-5.2 | exact | 分段标签中含「收藏」且不含「置顶」 | """true""" | spec 阅读空间竖排栏 |
| A-5.3 | exact | 阅读空间右侧 1/2 触发窗宽 ≤ 缩略图宽+内边距 | """true""" | spec 悬浮预览窗 |
| A-5.4 | state-machine | 底部按钮高度区悬停后三按钮可见 | """true""" | spec 悬浮预览窗 |
| A-5.5 | exact | 状态栏右侧图标数量 | 4 | spec 状态栏 |
| A-5.6 | exact | 顶栏四个入口图标数量 | 0 | spec G-3 |
| A-5.7 | state-machine | 首页点新建后 scene | """workspace""" | spec C-4 |
| A-5.8 | state-machine | 新建页签类型图标 | """markdown""" | spec C-4 |

## R-6 视频 / HTML / 既有失败（反馈 8 / 4 / 12）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | state-machine | 切换视频文件后页签标题为 B 文件名 | """B""" | spec C-6 |
| A-6.2 | state-machine | 复杂 HTML 编辑态可见节点数 > 0 | """true""" | spec E-16 |
| A-6.3 | exact | 修复后 tauri-mock 导出/ai-entry 失败数 | 0 | 一手观察（base 复现 5 failed） |
| A-6.4 | exact | 修复后 ai-forms 快照面板失败数 | 0 | 一手观察（base 复现 1 failed） |
