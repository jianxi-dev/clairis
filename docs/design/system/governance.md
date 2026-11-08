---
title: "设计治理运行手册"
type: guide
status: in-review
last_updated: 2026-11-08
source_of_truth: supporting
---

# 设计治理运行手册

> 本文回答一个问题：**权威矩阵的六层，怎么真正贯穿到日常设计与实现里**。
> 数值与规则见 [spec.md](./spec.md)，单点裁决见 [decisions.md](./decisions.md)；本文只描述**怎么用**。
> 依据：change `2026-11-08-design-system-governance`、`docs/GOVERNANCE.md` §5/§5.1、`docs/README.md` §二。

---

## 0. 先分清两个轴（这是全篇的前提）

原提案曾把「产品铁律 → 设计系统 → 功能设计 → token → 检查 → 缺陷」画成一条**裁决链**。评审否决了这个画法：它把两个正交的轴拧成了一条，制造出第二套层级。

| 轴 | 内容 | 回答的问题 | 权威来源 |
|---|---|---|---|
| **权威轴（6 层）** | 文档类别之间谁说了算 | 两份文档对同一事实说了不同的话，听谁的 | `docs/README.md` §二 + `GOVERNANCE.md` §5 |
| **生命周期轴（G0–G4）** | 一件事从触发到归档经过哪些阶段 | 现在该做什么、做完算什么 | `.opencode/skills/change-workflow/` |

**六层里没有「检查层」和「缺陷层」**——检查是生命周期里的门（G1 出口 / CI），缺陷是生命周期里的入口（G1 的缺陷回路）。**设计系统也不是第 7 层**，它住在第 4 层内部：

```
第 4 层 approved design
├── design/system/     ← 跨界面共享数值与裁决（唯一来源）
└── design/approved/   ← 单 feature 形态（只引用，不复制数值）
```

**「贯穿」的实体不是链条，是每条跨层边上的三件套**：

1. **引用契约**——下层必须引用上层的哪个标识；
2. **机检**——谁验、在哪一步验；
3. **退役条件**——这层何时失效、失效后还能不能被引用。

下文每层都按这三件套写。

---

## 1. 六层运行手册

### L1 · active change delta（变更内的临时真相）

- **目标**：让「这次改动」在实施期间有唯一可裁定的说法，且死后不留魂。
- **内容**：`openspec/changes/<change>/` 的 proposal / design / tasks / specs delta；G0 程序化生成的 `conformance.json` + `baseline/*.png`（哈希锁）。
- **方式方法**：`/opsx-propose` 生成；M0 锚点门（每 requirement ≥1 anchor，anchor 必须有 `source`）；G0 生成一致性制品后锁哈希，实施期只消费、禁篡改。
- **机检**：`cw-conformance.sh verify`（G0-POST）、`openspec validate --strict`、`cw-tickets-check.sh` C1–C8（C9 待上游）。
- **失效模式**：
  - **delta 留驻**——归档后仍被当依据，变成影子规范；
  - anchor 的 `source` 写成「上次实现」（`ai-forms.spec.ts` 的 285×260 就是这么来的）；
  - baseline 被改 = 核验失效。
- **注意事项**：
  1. anchor 的合法来源只有四种：`design-system:§N`、`spec:§`、`principles:D#`、一手观察（附证据）。
  2. 纯文档 change 会 `validate --strict` 失败（schema 要求至少一个 spec delta）→ 补最小 delta，或显式非 strict 并写明理由。
- **退役**：G4 归档后降为 L6；**canonical 文档禁止引用 archived delta**（此检查尚未机检）。

### L2 · canonical current spec（功能行为的唯一真相）

- **目标**：回答「这个功能怎么算对」，供验收与回归。
- **内容**：`openspec/specs/` 现有 17 域的 requirement + scenario。
- **方式方法**：**只由 change delta 合入**，禁止手改主规格；G4 归档时 sync。
- **机检**：`openspec validate --strict`；归档时 `openspec archive` 自动合入并校验。
- **失效模式**：requirement 与实现漂移（写了没做/做了没写）；scenario 不可观测。
- **注意事项**：**spec 不写视觉数值**——写「按钮为紧凑档」并引用 `design-system:§4`。数值只活在第 4 层，写两处必漂。
- **退役**：被新 delta 修改，不删除；旧行为靠 Git 追溯。

### L3 · accepted ADR / architecture overview（为什么这么选）

- **目标**：防止同一个架构争论被重新吵一遍。
- **内容**：`docs/architecture/decisions/NNNN-*.md`（编号不回收）、`overview.md` 现状。
- **方式方法**：只在「重要架构决策」时产出（`GOVERNANCE.md` §6.2 三种不可变快照之一）；ADR 四段固定：背景 / 决策 / 备选与弃因 / 后果。
- **机检**：目前只有 frontmatter + canonical 唯一性。**缺口**：没有「ADR 是否被引用/索引可达」的检查。
- **失效模式**：ADR 写成散文（没有可引用的决策句）；`overview.md` 与代码漂移。
- **注意事项**：ADR 不写产品需求、不写设计稿；overview 靠每次跨模块 change 顺手核对，不设定期仪式。
- **退役**：被新 ADR supersede（`superseded_by` 必填）。

### L4 · approved design + design/system（视觉的唯一数值来源）

- **目标**：任何视觉决策能追到条款号；数值只定义一次。
- **内容**：
  - [spec.md](./spec.md) — 跨界面规则：图标、间距、字号、圆角阴影、三主题语义色、L3 判据；
  - [decisions.md](./decisions.md) — append-only 部件裁决台账；
  - `docs/design/approved/<feature>/spec.md` — 单 feature 形态。
- **方式方法**：
  - 数值变更 → spec 走 supersede（`GOVERNANCE.md` §2.3）；
  - 单点裁决 → 台账追加一行；
  - feature 稿写「§3.2 间距 `--space-2`」，不写「8px」。
- **机检**：canonical 唯一性（`docs-governance-check.mjs`，按标题判重）；**票面视觉锚点 C9 尚未机检**，当前由 code-review 执行。
- **失效模式**：
  - **规范腐烂**——写了没人引用，三个月就是下一个 `ui-philosophy`；
  - feature 稿复制数值后改一处忘另一处；
  - 规范与 spec 抢真相。
- **注意事项**：
  1. **L4 低于 L2**：设计稿与 spec 冲突时 spec 胜，改设计稿。
  2. 只收敛**已被返工证明会摇摆**的维度；不为每个像素立法。
  3. 存量硬编码不追溯，规则只管新增与本次触及的代码。
- **退役**：feature 设计被取代 → supersede；刻度级修订 → 新文件 + 旧文件 superseded。

### L5 · product direction（取舍原则）

- **目标**：回答「该不该有、为谁做、删不删」。
- **内容**：`docs/product/`（vision / users / scope）、`principles.md`（D1–D10 + 「不为谁做」）。每条铁律带「检验问题」，天然可引用。
- **方式方法**：编号稳定；合并/降级必须写进文末变更记录（现有实践：D3/D8 并入即留痕）。
- **机检**：**不该机检哲学**。可做健康指标：每条 D# 是否被至少一处设计/规格引用（引用率为 0 = 事实上已死）。
- **失效模式**：被当实现依据（「D2 减法至上」≠「删掉所有元素」）；原则膨胀。
- **注意事项**：矩阵里 approved design(4) 高于 product direction(5)，这是**冲突裁定的次序，不是派生方向**；见 `GOVERNANCE.md` §5.1 条款 A/B。
- **退役**：几乎不退役；被取代的原则标 deprecated 并留档。

### L6 · research / history（当时为什么这么想）

- **目标**：保留探索轨迹，**且保证它不会被当成依据**。
- **内容**：`docs/design/explorations/`、`docs/research/`、`docs/archive/`、历史 ADR。
- **方式方法**：只进不出；唯一出口是「吸收 → 新 canonical → 旧稿 superseded/archived」。
- **机检**：**越界检查缺失**（应检查 canonical/spec/approved/ADR 是否引用 explorations）。
- **失效模式**：**探索稿被当依据**——`ui-philosophy` 已发生一次；v2/v3 这类「有数值、有截图、无身份」的半成品最危险。
- **注意事项**：本次处置即范例——内容吸收进 spec/台账，v2 与 v3 QA 标 superseded + redirect，不再参与裁定。
- **退役**：终态，不再维护。

---

## 2. 跨层引用契约（「贯穿」的实体表）

| 边 | 契约 | 现状 | 机检 |
|---|---|---|---|
| L5 → L4 | spec 每条规则显式标 D# 依据（可写「—」但要显式） | 未强制 | 评审清单（人工） |
| L4 system → L4 feature | 只引用条款，不复制数值 | 规则已立 | **未机检** |
| L4 → L1 | ui-surface / 可见 UI 票面必须有 `**视觉锚点**` | 规则已立 | **C9 未落地**（上游工具包） |
| L2 → L1 | requirement ↔ delta 双射 | 有 | `validate --strict` |
| L1 → L2 | 归档 delta 合入 specs | 有 | G4 / `openspec archive` |
| L1 → L3 | 架构性变更必须产 ADR | 弱（靠自觉） | 人工 |
| L6 → L4 | 吸收后旧稿标 `superseded_by` + `redirect` | 有 | `docs-governance-check.mjs` |

**两条解释条款**（已写入 `GOVERNANCE.md` §5.1）：

- **条款 A · 具体性优先**：同一事实，低层更具体且不矛盾 → 共存，不算冲突。
- **条款 B · 矛盾即缺陷**：低层与高层矛盾（如设计违反 D#）→ 高层胜，且**低层文档必须修订**；产品方向对设计的约束通过评审落地，不在矩阵内另设权威。

---

## 3. 三个回路（规范怎么长、怎么记、怎么查）

### 回路 1：规范更新

| 档 | 触发 | 形态 | 门 |
|---|---|---|---|
| 小裁决（某个尺寸定了） | 用户裁决 / 缺陷票定案 | **追加一行**到 `decisions.md` | risk-low 文档 PR |
| 刻度级修订（间距/字号/色档） | 规范不足 / 多次 gap | spec supersede（新文件 + 旧文件 superseded） | 评审 |
| 发现缺条款（gap） | 票面锚点找不到对应条款 | **先补条款再写码**；gap 记为正常信号 | 无（不阻断） |

### 回路 2：append-only 台账

- 四列固定：部件 / 决定 / 出处 / 日期；已落地行**必须带 PR 号**。
- 合并后只追加；同部件冲突须写「取代第 N 行」。
- 例外边界：只约束**已合并**台账；同一 PR 内定稿前更正不受限（合并版为唯一发布内容）。

### 回路 3：漂移巡检

| 检查 | 现状 | 缺口 |
|---|---|---|
| frontmatter / canonical 唯一性 / 相对链接 / 归档位置 | `npm run docs:check`，已接 `scripts/verify.sh` 第 3b 步 | **未接 CI** |
| explorations 越界 | 无 | 待补规则 |
| 票面视觉锚点 | 无 | C9（工具包上游） |
| e2e 断言锚定 spec | 无（如 285×260 硬编码） | 待后续 change |
| spec ↔ `tokens.css` 漂移 | 无 | spec 头部声明为快照；待补 |
| T2 感知核验 | `CMD_FIDELITY` 未配置 → **静默跳过** | 配或明确不声称 |

---

## 4. 生命周期 × 六层：谁在哪一步写哪层

| 阶段 | 产出到哪层 | 门 |
|---|---|---|
| 触发（issue / 反馈 / 缺陷） | 无层（意图） | 归一化 |
| G0-PRE `to-spec` | 收集 L5/L4 引用 | L-1 契约门（纯文档票可豁免 `no-ui-impact`） |
| G0 阶段二 `propose` | **L1** delta + M0 锚点 | M0 四规则机检 |
| G0-POST `to-tickets` | **L1** 票面 | C1–C8（+ C9 待落地） |
| G1 实施 | 代码落地 **L4** 数值 | QG-5 证据（before/after 成对） |
| G1 出口 | 证据 + 视觉锚点核对 | code-review → review（risk≥medium） |
| G2 PR | **L1** | `pr-automation.sh` |
| G3 | **L6**（learn 沉淀） | 无 |
| G4 收尾 | **L2** 合入、**L1** 退役、架构性则 **L3** ADR | `validate --strict` |

**唯一允许写代码的阶段是 G1。** 这条没有机检，但能挡掉「设计讨论顺手改了 CSS」这类越层操作。

---

## 5. 现状台账（诚实版）

| 机制 | 状态 | 位置 |
|---|---|---|
| 设计系统数值唯一来源 | ✅ 已落地 | `docs/design/system/spec.md`（accepted · canonical） |
| 单点裁决台账 | ✅ 已落地 | `docs/design/system/decisions.md`（append-only） |
| 治理条款（台账例外 / 字段 / 解释条款） | ✅ 已落地 | `docs/GOVERNANCE.md` §2.3 / §3.2 / §5.1 / §6 |
| 上下文路由（实现 UI 前读规范） | ✅ 已落地 | `AGENTS.md`「项目上下文路由」「设计」 |
| 视觉缺陷通道 + 四要素反馈 | ✅ 已落地 | `docs/agents/defect-workflow.md`、`docs/agents/ui-feedback.md` |
| 票面视觉锚点（人工执行） | ✅ 规则已立 | `AGENTS.md`；C9 前由 code-review |
| C9 机检 | ⬜ 待上游 | 方案见 `docs/delivery/plans/c9-visual-anchor.md` |
| tokens.css 扩容 / 存量迁移 | ⬜ 待后续 change | `--space-*` 等尚未定义 |
| e2e 断言锚定条款 | ⬜ 待后续 change | 现为硬编码数值 |
| spec ↔ tokens 漂移检查 | ⬜ 未规划 | — |

---

## 6. 怎么判断这套东西是否失败

**不看「文档写完了没有」，只看两个数：**

1. **主指标**：同一 UI 部件在 30 天内被 ≥2 张票重复修改视觉参数的事件数（按部件计，免疫批次规模）。基线：本次复盘前 3 天 4 个部件。
2. **先行指标**：可见 UI 票的视觉锚点引用率。**100% 才健康**；恒为 0 说明票面在绕过规范；出现 gap 票是健康信号，不是失败。

失败信号：规范写完 4–8 周内，票面从不引用、台账零新增、视觉返工照旧——那就是第三个被 superseded 的手册。

---

## 7. 明确不做

不做组件模式库、不写动效规范、不做品牌指南、不做像素级审计、不机检审美判据、不为每个像素立法、不追溯改写存量硬编码。

---

## 8. 延伸阅读（建议顺序）

按这个顺序读，先有地图再进细节：

| # | 文档 | 读它回答什么 |
|---|---|---|
| 1 | 本文 | 整套机制怎么转起来（地图） |
| 2 | [设计复盘（retro.md）](../explorations/design-governance/retro.md) | 为什么要做：五个断点与返工证据链 |
| 3 | [设计系统规格（spec.md）](./spec.md) | 具体数值与规则：图标 / 间距 / 字号 / 圆角 / 色彩 / 判据 |
| 4 | [决案台账（decisions.md）](./decisions.md) | 已经裁决过的具体部件，以及每条的出处 |
| 5 | [文档治理规范（GOVERNANCE.md）](../../GOVERNANCE.md) §2.3 / §3.2 / §5.1 / §6.3 | 台账例外、`ledger` 与 `redirect` 字段、矩阵解释条款、归档要求 |
| 6 | [AGENTS.md](../../../AGENTS.md)「项目上下文路由」「设计」 | agent 实际被约束成什么样 |
| 7 | [C9 视觉锚点机检方案](../../delivery/plans/c9-visual-anchor.md) | 唯一剩下的机检怎么实现（交 cw 工具包上游） |
| 8 | [change 归档：design-system-governance](../../../openspec/changes/archive/2026-11-08-design-system-governance/proposal.md) | 这次治理变更的完整 Why / What / Delta |

阅读提示：L3（ADR）与 L6（越界检查）目前只有人工约束，没有机检——那两处是本文最虚的地方，读到时按现状理解，不要当成已自动化。
