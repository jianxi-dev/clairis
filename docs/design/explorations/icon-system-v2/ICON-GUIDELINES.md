---
title: 标月图标体系规范 v2（草案）
type: design
status: draft
last_updated: 2026-11-07
---

# 标月图标体系规范 v2（草案）

> 状态：待评审。本文只定义规范与原型，不修改现有 `src/` 代码。
> 原型：同目录 `icon-system-v2.html`（单文件、离线可开）。

## 1. 设计原则

1. **一概念一图标**：同一概念全产品只有一个形状，不因位置换画法。
2. **形状先于颜色**：18px 下即使去掉类型色，也应能靠轮廓区分；颜色是辅助，不是唯一线索。
3. **不混风格**：同一套内不混「实心块」「线性描边」「字母块」三种语言。本规范选**线性描边**为主，实心只用于播放键、星芒这类「点状强调」。
4. **禁 emoji**：emoji 跨平台字形不可控，不进入产品界面。
5. **两档尺寸**：18px（页签、卡片、菜单行）与 24px（空态、主操作、图标抽屉）。不出现第三档。
6. **颜色继承**：`currentColor`，由外层 `color` 决定；不在 path 里写死颜色。

## 2. 网格与笔画

| 项 | 规范 |
|---|---|
| viewBox | `0 0 24 24` |
| 安全区 | 四周 2px，所有笔画落在 2..22 |
| 等效笔画 | 1.7px（1.6–1.8 区间）；`stroke-linecap="round" stroke-linejoin="round"` |
| 圆角 | 容器 2px；小元素 1–1.5px |
| 光学对齐 | 以视觉重心居中，不按包围盒硬居中；圆形元素比方形大 0.5px |
| 密度 | 单个图标内部不超过 6 条独立笔画；超出则简化语义 |

实现约定：`<svg viewBox="0 0 24 24" fill="currentColor">`；描边图标在 path 上写
`fill="none" stroke="currentColor" stroke-width="1.7"`。这样保留了现有 Icon 组件
`fill="currentColor"` 的契约，又统一了笔画语言。

## 3. 语义分组（33 个概念）

| 组 | 概念 |
|---|---|
| 文件类型（8） | markdown / html / text / pdf / video / image / code / audio |
| 导航与外观（10） | folder / file / search / grid / pin / chevronLeft / chevronRight / sun / moon / monitor |
| 动作（10） | close / settings / expand / more / eye / pencil / export / share / locate / copyPath |
| 状态（2） | check / warning |
| 分屏（2） | splitRight / splitDown |
| AI（1） | sparkle |

## 4. 现有图标问题清单（对照 `src/ui/icons.ts`）

1. **类型图标用几何块拼字母**：markdown 的 M 由矩形拼、pdf 的 P 由实心块拼，18px 下糊成色块。→ 改为「文档轮廓 + 1.7px 符号」，符号本身用笔画而非实心字母。
2. **html 与 code 同形**：两者都用尖括号，菜单里并排时无法区分。→ html 用 `</>`（带斜杠，表示闭合标签），code 用 `<>`（无斜杠）。
3. **export 语义与形状相反**：画成向下箭头（下载），标签却叫「导出」。→ 改为向上箭头出托盘。
4. **export 与 share 近似**：都画托盘 + 箭头，只差方向。→ share 改为「三个节点连线」，语义独立。
5. **pin 形状歧义**：读起来像上箭头/伞。→ 改为「圆头 + 针身 + 底部横托」的图钉。
6. **close 过细**：两根细条交叉，视觉偏弱且交叉点脏。→ 1.7px 圆头 X，端点留 1px 内缩。
7. **grid 过重**：四个方块各带内框，实心后成四个黑块。→ 四个 1.7px 圆角方框，间距 4px。
8. **audio 过密**：八分音符带符尾，18px 下细节噪。→ 简化为「符头 + 符干 + 单符尾」三笔。
9. **folder/file 过重**：全实心块与线性图标密度差异大。→ 统一为线性轮廓；需要强调状态时用类型色，不靠加粗。

## 5. 逐概念推荐画法

| 概念 | 画法 | 实心/描边 |
|---|---|---|
| markdown | 文档轮廓 + `#`（两竖两横） | 描边 |
| html | 文档轮廓 + `</>` | 描边 |
| text | 文档轮廓 + 三行横线（长度递减） | 描边 |
| pdf | 文档轮廓 + `P`（竖干 + 半环碗） | 描边 |
| video | 圆角矩形 + 实心三角播放键 | 混合（三角实心） |
| image | 圆角矩形 + 圆日 + 折线山 | 描边 |
| code | `<>` 双尖括号，无斜杠 | 描边 |
| audio | 符头 + 符干 + 单符尾 | 描边 |
| folder | 圆角文件夹 + 顶部标签缺口 | 描边 |
| file | 文档 + 右上折角 | 描边 |
| search | 圆环 + 45° 手柄 | 描边 |
| grid | 2×2 四个圆角方框 | 描边 |
| pin | 圆头 + 针身 + 横托 | 描边 |
| sun / moon / monitor | 现有形状保留，统一 1.7px | 描边 |
| close | 圆头 X | 描边 |
| settings | 齿轮（现有形状保留，减一轮齿） | 描边 |
| expand | 四角箭头 | 描边 |
| more | 三个圆点 | 实心点 |
| eye | 杏仁轮廓 + 瞳孔 | 描边 |
| pencil | 笔身 + 笔尖 | 描边 |
| export | 向上箭头 + 开口托盘 | 描边 |
| share | 三节点连线 | 描边 |
| locate | 准星 | 描边 |
| copyPath | 两页叠放 | 描边 |
| chevronLeft/Right | 单折线 | 描边 |
| check | 对勾 | 描边 |
| warning | 三角 + 感叹号 | 描边 |
| splitRight/Down | 外框 + 一条分栏线 | 描边 |
| sparkle | 四角星 + 两颗小星 | 实心 |

## 6. 落地规则

1. 新增概念必须同时更新 `src/ui/icons.ts` 的 `ICONS` 表与图标抽屉可见性；不在组件里内联一次性 SVG。
2. 类型色沿用 `src/styles/tokens.css` 的 `--type-*`；图标本身只用 `currentColor`。
3. 尺寸只用 18 / 24；需要更大时用外层容器缩放，不新增 20/22/28。
4. 图标与文字并排时，图标垂直居中于文字行高，不按容器居中。
5. 评审通过后一次性替换 `ICONS` 表；替换前保留旧表，避免半套新旧混用。
