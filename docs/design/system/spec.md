---
title: "标月设计系统规格"
type: design
status: accepted
last_updated: 2026-11-08
source_of_truth: canonical
---

# 标月设计系统规格

> 本文件是**视觉数值的唯一来源**。任何界面、票面、e2e 断言需要具体像素值时引用本文件条款号，不复制数值。
> 具体部件的单点裁决记在 [decisions.md](./decisions.md)（append-only 台账），与本文件分工见 §9。

## 1. 定位与权威

- **位置**：`docs/design/system/`，属 approved design 范畴，在权威优先级矩阵中位于**第 4 层**（见 `docs/README.md` §二、`GOVERNANCE.md` §5）。
- **冲突裁定**：本文件与 canonical spec（`openspec/specs/`）或 ADR 冲突时，**后者胜**，本文件修订。
- **对外关系**：单 feature 设计（`docs/design/approved/<feature>/`）**只引用条款号，不复制数值**；票面同理。
- **本文的性质**：**誊写 + 收敛**，不是发明。下表每个数值都能追溯到"已在用"或"已被用户裁决"；无来源的新档位一律不写进来。
- **不在本文范围**：交互行为阈值（如拖拽判定 3–5px）、动画时长与缓动、键盘映射。这些属于交互规范，不因本文的"数值唯一来源"规则被收编。
- **状态**：`accepted`（2026-11-08 定案）。刻度级修订走 supersede；单点裁决追加台账。
- **token 名称是目标**：`--space-*` / `--fs-*` / `--radius-*` 尚未在 `tokens.css` 定义；落地前以本表字面值为准，不假装 token 已存在。
- **存量不追溯**：`docs/design/approved/` 现有约 86 处 px 字面量（9 个文件）与 `src/styles/` 的存量值不强制改写；本规则只约束新增与本次触及的代码。

## 2. 图标系统

吸收 `explorations/icon-system-v2/ICON-GUIDELINES.md` 的规则框架 + `icon-system-v3/PROTOTYPE-QA.md` 七轮评审的最终形状决案（v3 晚于 v2，冲突时 v3 胜）。两代原文已标 superseded，仅作历史。

### 2.1 网格与笔画

| 项 | 规范 |
|---|---|
| viewBox | `0 0 24 24` |
| 安全区 | 四周 2px，所有笔画落在 2..22 |
| 等效笔画 | **1.7px**（1.6–1.8 区间）；`stroke-linecap="round"` `stroke-linejoin="round"` |
| 圆角 | 容器 2px；小元素 1–1.5px |
| 光学对齐 | 按视觉重心居中，不按包围盒硬居中；圆形元素比方形大 0.5px |
| 密度 | 单个图标内部 ≤6 条独立笔画，超出则简化语义 |
| 尺寸 | **14 / 18 / 24 三档**（`IconSize`，`src/ui/icons.ts`）：14 仅用于密集工具条与卡片内联小图标，18 为常规档，24 用于主操作与空态；不新增第四档 |
| 颜色 | path 内不写死颜色，一律 `currentColor`；类型色由容器 `--type-*` 提供 |

### 2.2 实现契约

保留现有 `Icon` 组件 `fill="currentColor"` 契约：描边图标在 path 上写
`fill="none" stroke="currentColor" stroke-width="1.7"`。新增概念必须同时更新 `src/ui/icons.ts` 的 `ICONS` 表，禁止组件内联一次性 SVG。

### 2.3 语义分组（33 概念）

| 组 | 概念 |
|---|---|
| 文件类型（8） | markdown / html / text / pdf / video / image / code / audio |
| 导航与外观（10） | folder / file / search / grid / pin / chevronLeft / chevronRight / sun / moon / monitor |
| 动作（10） | close / settings / expand / more / eye / pencil / export / share / locate / copyPath |
| 状态（2） | check / warning |
| 分屏（2） | splitRight / splitDown |
| AI（1） | sparkle |

**覆盖范围（缺口）**：本表沿用 icon-system-v2 的 33 概念分组；`src/ui/icons.ts` 实现现有 **61 个键**，多出媒体控件（play / pause / prev / next / volume / volumeMute / playlist / loop×3 / subtitle / timestampNote / keyboardHints / pip / speed / home / heart×2）、导出族（exportWord / exportZip / exportMdpkg）与其余（pinOff / collapse / sunBright / sunWarm / closeOthers / chevronDown）。本表不声称穷举；未归组的概念不是"规范缺省"，是**待归组的缺口**。

### 2.4 状态对规则

可逆动作**必须成对**：pin / pinOff、expand / collapse、volume / volumeMute、play / pause、heart / heartFilled、沉浸进入 / 退出（v3 QA 第 20 格核到 6 对）。禁止出现单向孤儿（只能进不能出的图标）。

### 2.5 形状定案的归属

具体形状与几何参数（settings 齿数与半径、pin / pinOff 钉身、immersive 轮廓、speed 表盘、split 虚实格间距、markdown 字重等）**只在 [decisions.md](./decisions.md) 记录一次**，本节不复制。

本节只保留跨概念的规则：

- **html / code 必须靠斜杠区分**：html 带斜杠 `</>`，code 无斜杠 `<>`。
- **export 与 share 不得共用构图**：export 是向上箭头 + 开口托盘，share 是三节点连线。
- **可逆动作成对**（见 §2.4）。

### 2.6 注意事项

- `collapse` 在 18px 下四角括号内收后形态略接近「+」：必须保留 tooltip 与 `aria-pressed` 兜底；QA 原文对加大内收位移措辞是"可考虑"，当前实现未调整，下次触及该图标时再改，不单独开票。
- **实现偏差（已知）**：`src/ui/icons.ts` 的 pinOff 斜杠仍是贯穿整格的版本，尚未对齐台账定案；按缺口处理，不阻断本文档落地。
- 新增概念先问「能否用已有概念表达」，不能才增，避免概念表膨胀。

## 3. 间距刻度

来源：`src/styles/*.css` 实际取值频次统计（2026-11-08）。下表只登记**已在实际使用**的值，按频次收敛为刻度。

| 规范值 | 值 | 出现次数 | 用途 |
|---|---|---|---|
| `--space-2` | 2px | 56 次 | 图标与文字的紧贴间距、微调 |
| `--space-4` | 4px | 52 次 | 紧凑内距、行内元素间隔（主力档） |
| `--space-6` | 6px | 38 次 | 控件内距、按钮水平 padding |
| `--space-8` | 8px | 29 次 | 常规内距、列表项间隔 |
| `--space-10` | 10px | 19 次 | 行高补偿、中等内距 |
| `--space-12` | 12px | 27 次 | 区块内距 |
| `--space-16` | 16px | 17 次 | 区块间间隔 |
| `--space-24` | 24px | 8 次 | 区域分隔、大留白 |

**不进入刻度的值**：`1px`（93 次）为发丝线与边框，语义固定，不入刻度也不 token 化；`3px`（14 次）/ `5px`（7 次）/ `14px`（7 次）为微调值，允许出现但不作为新代码的首选档；`20px` / `22px` 多为容器宽高，不是间距。

`24px` 入档凭**语义**（区域分隔与图标大档），不凭频次；`3px` 保留为存量微调档，不新增使用。

**新代码规则**：新增布局间距从刻度取值；确需刻度外值时，在 PR 说明理由，不得默默写数。

## 4. 字号阶梯

来源同上（`font-size` 频次统计）。

| 规范值 | 值 | 出现次数 | 用途 |
|---|---|---|---|
| `--fs-11` | 11px | 5 次 | 极小标注、状态栏副信息 |
| `--fs-12` | 12px | 13 次 | 次级 UI 文本（主力） |
| `--fs-13` | 13px | 6 次 | 常规 UI 文本（主力） |
| `--fs-14` | 14px | 3 次 | 强调 UI 文本、按钮 |

**正文字号不在此表**：阅读区字号由用户阅读设置控制（见 `approved/reader-typography/`），不受 UI 档位约束。

## 5. 圆角与阴影

**现存矛盾（必须知道）**：`tokens.css` 定义 `--app-radius: 6px`，但实际 CSS 中 `border-radius: 4px` 出现 21 次、`6px` 仅 5 次。规范按**实际使用**裁定，`6px` 保留为存量值，不新增使用。

| 名称 | 值 | 用途 |
|---|---|---|
| `--radius-4` | 4px | 控件、按钮、菜单行（基准） |
| `--radius-8` | 8px | 卡片、浮层、弹窗 |
| `--radius-full` | 999px | 胶囊、圆形 |
| `--app-radius` | 6px | **存量**，不新增使用 |

阴影：**现存矛盾，不假装只有一处**。`tokens.css` 定义 `--app-shadow`，但 `src/styles/*.css` 另有 20 处 `box-shadow` 声明、13 种字面量（含 `0 4px 12px rgba(0,0,0,.18)` ×3、`0 8px 24px rgba(31,26,20,.12)` ×2），`reader.css` 还有独立的 `--reader-shadow`。规则：**新代码一律用 `--app-shadow`**；存量字面量登记为待收敛，不追溯，下次触及该组件时改引 token。

## 6. 语义色

来源：`src/styles/tokens.css` 三主题现状**誊写**（不重新设计）。

| 变量 | 亮（:root） | 暗（.dark） | 暖（.warm） |
|---|---|---|---|
| `--app-accent` | `#6366f1` | `#818cf8` | `#0071e3` |
| `--app-bg` | `#f7f7f6` | `#131316` | `#f2e9da` |
| `--app-surface` | `#fbfaf8` | `#1a1b1e` | `#fbf4e8` |
| `--app-sunken` | `#f4f2ec` | `#22242a` | `#efe3d0` |
| `--app-text` | `#24262b` | `#d8dade` | `#3b3024` |
| `--app-text-strong` | `#16181c` | `#eceef1` | `#241c12` |
| `--app-text-2` | `#55595f` | `#a7abb3` | `#6b5a45` |
| `--app-text-3` | `#8b8f96` | `#75797f` | `#96826a` |
| `--app-border` | `#e7e3db` | `#2e3138` | `#e0d2bc` |
| `--app-border-strong` | `#d8d3c8` | `#3d4149` | `#cdbca1` |

**类型色**（三主题不换色，类型色是识别标志）：markdown `#6366f1`、html `#f59e0b`、text `#64748b`、pdf `#ef4444`、video `#a855f7`、image `#10b981`、code `#06b6d4`、audio `#ec4899`。

**错误 / 危险语义色**：亮色 `#a8402f`、暗色 `#e08b7a`（callout danger/error 与错误文本在用）。**红色只用于错误**，绝不用于脏状态、未保存、警告提示。注意 `--type-pdf` 的 `#ef4444` 是**文件类型色**，不是错误色，两者不可混用。

**已知缺口**：错误色尚无独立 token（现值散落在 `editor.css` / `reader.css`）；`--app-accent-soft` 各主题 alpha 不同（亮 .10 / 暗 .14 / 暖 .08）。两处均在第二个 change 的 token 扩容时处理，本文件先登记，不假装已完成。

## 7. 审美判据（L3，人工裁决，不机检）

来源：`explorations/ui-philosophy/ui-design-philosophy.md` §六检验清单（该文其余数值已作废，仅此清单回收）。每个视觉决策过一遍：

- 能删吗？删掉会影响核心功能吗？
- 能合并吗？能不能和其他入口合并？
- 默认出现吗？用户需要时它在那里吗？
- 能直觉发现吗？不看书能不能找到？
- 能一键完成吗？操作路径 = 1？
- 提醒打扰吗？不打扰，除非出错。
- 心智模型一致吗？和浏览器 / 系统习惯一致吗？

## 8. 明确不做

不为每个像素立法；不做组件模式库；不做动效规范；不做品牌指南；不机检 §7 判据；不因本文件重画已定案图标。

## 9. 变更方式

| 变更性质 | 方式 |
|---|---|
| 某个具体部件的单点裁决（尺寸/形状/边框） | 追加 [decisions.md](./decisions.md) 一行，不改本文件 |
| 刻度级修订（间距/字号/圆角/语义色档位） | supersede：新建本文件新版，旧版标 `status: superseded` + `superseded_by`（`GOVERNANCE.md` §2.3） |
| 发现本文件缺条款（spec gap） | 先补条款再实现；票面报 gap 是健康信号，不是失败 |

<!-- 数值溯源与复现：间距/字号/圆角频次统计于 2026-11-08。
     复现命令（注意必须只传单一 glob；同时传 src/**/*.css 会递归包含 src/styles/*.css 导致数值翻倍）：
     python3 -c "import re,glob,collections;pat=re.compile(r'(?<![\d.])(\d+)px');c=collections.Counter();[c.update(int(m) for m in pat.findall(open(f,encoding='utf-8').read())) for f in glob.glob('src/styles/*.css')];print(sorted(c.items(),key=lambda x:-x[1]))"
     图标规格溯源自 icon-system-v2 §1–§2 与 v3 QA 第一至七轮；语义色逐值誊自 tokens.css。 -->

