---
title: "设计方案 — 设计规范的治理定位与落地机制"
type: design
status: draft
last_updated: 2026-11-08
source_of_truth: supporting
---

# 设计方案：让「产品的统一语言」真正在线

> **已被最终方案取代（2026-11-08）**：本文是初版探索稿。评审否决了其中两处——落点 `docs/design/approved/design-system/`（与既有 `docs/design/system/` 重复）与「五层裁决链」（与 6 级权威矩阵构成两套层级）。
> 现行方案见 [`docs/design/system/governance.md`](../../system/governance.md)（运行手册）与 change `2026-11-08-design-system-governance`；本文保留作历史调查。

## 一、设计规范在产品生命周期中的定位

```
产品定义层   Doctrine D1-D10（已有，canonical）
     │ 裁决「该不该有」
设计系统层   Design System spec（缺失 → 本方案新建）★
     │ 裁决「多大/多粗/什么比例/什么颜色」
功能设计层   docs/design/approved/<feature>/（已有）
     │ 裁决「这个 feature 长什么样」，引用设计系统条目
实现层       tokens.css + 组件 CSS（已有，需扩容）
     │ 规范的可执行形态
检查层       token lint + spec 引用复述 + T1/T2（需补设计维度）
缺陷层       ui-visual 缺陷通道（需新建）
```

**核心原则：设计规范不是一份文档，是一条贯穿五层的裁决链。** 每一层引用上一层作为依据，任何视觉决策都能追溯到条款号——这就是「AI 不能一会这样一会那样」的机制保证。

### 做到什么程度

三级深度，按返工频率排优先级：

| 级别 | 内容 | 程度 |
|------|------|------|
| L1 必检项 | 图标绘制规格、尺寸档位、间距刻度、语义色、字号阶梯 | **数值表 + token + 机检**。这是返工重灾区（三角大小、斜杠线长、缩略图尺寸全在这级） |
| L2 模式库 | 高频组件既定样式（按钮、弹窗、状态栏、悬浮卡） | spec 描述 + 实现即 token，不机检 |
| L3 原则判据 | 层次、留白、动效气质等审美判断 | 文字判据（如「越浅=越靠上=越重要」），人工裁决，不假装能机检 |

**不过度的地方**：不为每个像素立法。L1 只收敛已被返工证明会摇摆的维度；L3 承认审美判断存在自由度，用判据而非数值约束。

## 二、产出文档清单

| # | 文档 | 位置 | 状态 |
|---|------|------|------|
| 1 | **设计系统总规格** `spec.md`：图标规格、尺寸/间距/字号/圆角/阴影 token 表、语义色、组件模式、L3 判据 | `docs/design/approved/design-system/spec.md` | 新建。收敛三个来源：ui-design-philosophy §3 数值 + icon-system-v2 ICON-GUIDELINES（1.7px/24px 栅格定案，v2/v3 收敛为单一 canonical）+ tokens.css 现状 |
| 2 | **token 扩容**：补 `--space-1..8`、`--fs-*` 字号阶梯、`--icon-stroke`、`--radius-*` 梯度、`--shadow-*` | `src/styles/tokens.css` | 扩展现有文件 |
| 3 | **上下文路由**：「UI 实现前必读 design-system spec」写入 AGENTS.md 项目上下文路由 | `AGENTS.md` | 增补一条 |
| 4 | **视觉缺陷通道**：`ui-visual` 标签 + 「非功能视觉缺陷」定义 + 票面模板 | `docs/agents/defect-workflow.md` | 增补一节 |
| 5 | **反馈模板**：给用户的 UI 反馈四要素模板（见 §五） | `docs/agents/ui-feedback.md` | 新建，AGENTS.md 引用 |

## 三、检查机制：把「符合规范」放进三个关卡

### 关卡 1：实现前 — 规格复述（断点 3/4 的对治）

AGENTS.md 新增硬约定：**AI 动手改任何可见 UI 前，必须先复述将产出/修改元素的视觉规格并得到确认**——尺寸、间距、图标、对标参照（「同 X 组件一致」或「对齐 spec §N」）。复述不出来 = 依据不存在 = 先查 spec 或先问。

这一步把用户的「太丑」反馈转译前置成 AI 的「我打算做成 12px、描边 1.7px、对标状态栏图标」——把像素分歧消灭在写代码之前，而不是真机验收之后。

### 关卡 2：实现中 — token 机检（断点 2 的对治）

- 新增 stylelint 规则（或 CI 脚本，同 CSS manifest 检查的样式）：`src/` 新增代码中禁止新的硬编码尺寸/颜色字面量，必须走 `var(--*)`（白名单豁免机制）。
- 「每声明一个新 cm-* class 必须有 CSS」已有先例，照同样机制加「每新增视觉字面量必须有 token 出处」。

### 关卡 3：验证时 — 提缺陷（断点 5 的对治）

- e2e 视觉断言数值改为**从 tokens.css 读取**（断言「间距 = --space-2」而非「= 8」），规范改了测试不碎，测试永远锚定规范。
- 验证/QA 发现视觉偏差（含 headless e2e、真机手点、用户反馈）→ 按 defect-workflow 新章节提 **`ui-visual` 票**：引用 spec 条款号 + 现状值 + 期望值。规范成为缺陷的共同度量语言，「太丑」从此有法可依。

## 四、用户反馈语言：四要素模板

写进 `docs/agents/ui-feedback.md`，用户每次 UI 反馈尽量按此形态（不必严格，AI 负责补全并复述确认）：

```
1. 位置：哪里（状态栏主题按钮）
2. 对象：哪个元素（下拉三角）
3. 偏差：现在 vs 期望（现在占按钮一半高，期望同状态栏其他图标尺寸一致）
4. 对标：参照物（「对齐页签关闭按钮的尺寸」或 spec §N）
```

配套规则（对 AI）：收到模糊反馈时**先给 2-3 个候选终态描述让用户选**，不要直接猜一个数值去改——用一轮轻交互替代一轮真机返工。

## 五、落地顺序

| 步骤 | 内容 | 工作量 |
|------|------|--------|
| 1 | 收敛 icon-system v2/v3 + ui-philosophy 数值 → 起草 design-system spec（走 /opsx-propose 建 change） | 主要工作量，一次集中评审 |
| 2 | tokens.css 扩容 +存量硬编码迁移（可分批，只约束增量） | 中 |
| 3 | AGENTS.md 路由 + 复述约定 + ui-feedback.md + defect-workflow 视觉通道 | 小 |
| 4 | token 机检脚本进 CI + e2e 断言改锚 token | 小-中 |

建议 1-3 先行（规范与流程先立），4 随 change 一并落地。

## 六、与现有约定的一致性

- 不破坏 Doctrine：本方案是 D1-D10 的**词典化**，无冲突条款。
- 不违反「creative 不得自动升级 canonical」：design-system spec 走正常 approved 流程定案，探索稿留在 explorations。
- 复用已有机制而非新造：CSS manifest 检查的机检模式、change-workflow 的 ui-surface 标签与 T1/T2 骨架、defect-workflow 的票务体系——本方案全部是**在既有骨架上补设计维度**，不引入新流程。
