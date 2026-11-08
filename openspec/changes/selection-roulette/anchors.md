# 验收锚点 — selection-roulette

锚点来源：批准设计 `docs/design/approved/selection-roulette/README.md` §4/§5/§7/§9、可交互原型 `.lavish/selection-roulette.html` 的 headless 自检记录、`design.md` R-D1…R-D9。

> 无截图 baseline（原型为可交互 HTML，非静态图）；锚点均为 `exact` 或 `state-machine`。

## R-1 轮盘几何

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 根环扇区数量 | 8 | 批准稿 §4.2 |
| A-1.2 | exact | 轮盘圆心与鼠标落点的最大偏差（px） | 1 | 批准稿 §5 |
| A-1.3 | exact | 圆心死区半径（px） | 24 | 批准稿 §5 |
| A-1.4 | exact | 轮盘包围盒尺寸（px） | 420 | 批准稿 §5 |
| A-1.5 | exact | 二级扇形总跨度上限（度） | 136 | 批准稿 §4.3 |
| A-1.6 | exact | 二级每格角度（度） | 15 | 批准稿 §4.3 |
| A-1.7 | state-machine | 三级在原位替换第二层，圆心出现返回 | "true" | 批准稿 §4.4 |

## R-2 颜色双圈

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 内圈文字色格数 | 9 | 批准稿 §4.5 |
| A-2.2 | exact | 外圈背景色格数 | 16 | 批准稿 §4.5 |
| A-2.3 | exact | 内圈格渲染的字符 | "A" | 批准稿 §8 第三轮 |

## R-3 命令写入

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | 3 栏动作写入源码的围栏 | "::: {.col-3}" | 批准稿 §10 |
| A-3.2 | state-machine | 「警告」高亮写入源码 | "> [!warning]" | 批准稿 §4.4 |
| A-3.3 | state-machine | 增加缩进写入源码 | "::: {.indent-1}" | 批准稿 §7.3 |
| A-3.4 | state-machine | 行内代码写入源码 | "`code`" | 批准稿 §2.3 |
| A-3.5 | state-machine | 一级标题写入源码 | "# " | 批准稿 §10 |

## R-4 格式刷与清格

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 格式刷跨两段后计数角标 | 2 | 批准稿 §7.1 |
| A-4.2 | state-machine | 清除格式后链接保留 | "true" | 批准稿 §7.2 |
| A-4.3 | exact | 清除格式后源码中 `mdb-color-` 出现次数 | 0 | 批准稿 §7.2 |
| A-4.4 | state-machine | 后退与 Mod-z 共用同一历史 | "true" | 批准稿 §7.4 |

## R-5 出现时机与交互

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 选区稳定后出现延迟（ms） | 90 | 批准稿 §5 |
| A-5.2 | state-machine | 双击选词时轮盘不在第二次点击前出现 | "true" | 批准稿 §5.1 |
| A-5.3 | exact | 指针离开整轮后收回扇形延迟（ms） | 240 | 批准稿 §5 |
| A-5.4 | exact | 已有展开层时换扇区驻留（ms） | 300 | 批准稿 §4.3 |

## R-6 HTML 编辑态

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | state-machine | HTML 编辑态选中元素后出现轮盘 | "true" | design R-D7 |
| A-6.2 | exact | HTML 编辑态 `.html-edit-toolbar` 横向条节点数 | 0 | design R-D7 |
| A-6.3 | state-machine | 轮盘换标签后 content 同步 | "true" | design R-D7 |

## R-7 单轨与可访问性

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 旧的 `.cm-floating-toolbar` 横向条节点数 | 0 | 批准稿 §9 |
| A-7.2 | exact | 根环扇区 `aria-label` 非空数量 | 8 | design R-D8 |
| A-7.3 | state-machine | 数字键 1–8 进入对应扇区 | "true" | 批准稿 §5 |
