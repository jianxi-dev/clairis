# 验收锚点 — selection-roulette

锚点来源：批准设计 `docs/design/approved/selection-roulette/README.md` §4/§5/§7/§9、原型 `prototype.html` 常量（1310–1315 行）、`design.md` R-D1…R-D9。

> 原型是可交互 HTML，不产静态 baseline；全部锚点为 `exact` 或 `state-machine`。

## R-1 轮盘几何

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 根环扇区数量 | 8 | 批准稿 §4.2 |
| A-1.2 | exact | 根环内半径（px） | 30 | 原型 §10 常量 |
| A-1.3 | exact | 根环外半径（px） | 86 | 原型 §10 常量 |
| A-1.4 | exact | 二层环带内/外半径（px） | "92/122" | 原型 §10 常量 |
| A-1.5 | exact | 三层环带内/外半径（px） | "126/152" | 原型 §10 常量 |
| A-1.6 | exact | 二层每格角度（度） | 15 | 批准稿 §4.3 |
| A-1.7 | exact | 扇形缝隙（度） | 0.35 | 原型 §10 常量 |
| A-1.8 | exact | 轮盘包围盒尺寸（px） | 420 | 批准稿 §5 |
| A-1.9 | exact | 根环标签所在半径（px） | 60 | 原型 §10 渲染 |

## R-2 三层与透明度

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 三级出现时二层仍可见且不透明度 | 0.7 | 批准稿 §4.4 / 第九轮 |
| A-2.2 | exact | 三级扇形中心角与所点二层区块中心角之差（度） | 0 | 批准稿 §4.4 第八轮 |
| A-2.3 | state-machine | 展开下级后根环不透明度 | 0.7 | 批准稿 §4.4 / 第九轮 |
| A-2.4 | state-machine | 三级在场时圆心显示返回符号 | "‹" | 批准稿 §4.1 |

## R-3 颜色双圈

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 内圈文字色段数 | 9 | 批准稿 §4.5 |
| A-3.2 | exact | 外圈背景色段数 | 16 | 批准稿 §4.5 |
| A-3.3 | exact | 内圈色带内/外半径（px） | "90/106" | 原型 §10 常量 |
| A-3.4 | exact | 外圈色带内/外半径（px） | "111/127" | 原型 §10 常量 |
| A-3.5 | exact | 内圈渲染的字母 | "A" | 批准稿 §8 第三轮 |

## R-4 出现时机与交互

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 松手后出现延迟（ms） | 90 | 批准稿 §5 |
| A-4.2 | state-machine | 按住拖选期间轮盘节点数 | 0 | 批准稿 §5.1 |
| A-4.3 | exact | 圆心死区半径（px） | 0 | 批准稿 §5.1 第七轮 |
| A-4.4 | exact | 离开整轮后收回下级延迟（ms） | 400 | 批准稿 §5 |
| A-4.5 | exact | 圆心与鼠标落点最大偏差（px） | 1 | 批准稿 §5 |
| A-4.6 | exact | 根环数字键直达范围 | "1-8" | 批准稿 §5 |

## R-5 命令与标注类型

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 转换二层·段落形态项数 | 7 | 批准稿 §4.4 |
| A-5.2 | exact | 转换二层·标题形态项数 | 8 | 批准稿 §4.4 |
| A-5.3 | exact | 标题三层档数（H1–H6） | 6 | 批准稿 §4.4 |
| A-5.4 | exact | 高亮三层类别数 | 5 | 批准稿 §4.4 |
| A-5.5 | state-machine | 选择「注意」写入源码 | "> [!note]" | 批准稿 §4.4 |
| A-5.6 | state-machine | 选择「六级标题」写入源码 | "###### " | 批准稿 §4.4 |
| A-5.7 | state-machine | 选择「3 栏」写入源码 | "::: {.col-3}" | 批准稿 §10 |
| A-5.8 | exact | 格式二层项数 | 6 | 批准稿 §4.2 |
| A-5.9 | exact | 格式二层第一项 | "链接" | 批准稿 §8 第九轮 |
| A-5.10 | exact | 对齐二层项数 | 5 | 批准稿 §4.2 |

## R-6 HTML 分工与胶囊

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | state-machine | HTML 源码编辑态选中文字后横向条节点数 | 1 | design R-D7 |
| A-6.2 | exact | HTML 源码编辑态轮盘节点数 | 0 | design R-D7 |
| A-6.3 | state-machine | HTML 可视化编辑态轮盘节点数 | 0 | E-19 / E-22 |
| A-6.4 | state-machine | MD 编辑态选中文字后胶囊节点数 | 0 | HANDOFF §7.5 |
| A-6.5 | state-machine | 阅读态选中文字后胶囊节点数 | 1 | HANDOFF §7.5 |
| A-6.6 | state-machine | HTML 拖拽越过阈值后跟随幽灵节点数 | 1 | design R-D8 |
| A-6.7 | exact | 拖拽阈值（px） | 4 | E-20 |
