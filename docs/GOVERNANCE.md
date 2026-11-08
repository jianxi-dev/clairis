---
title: 文档治理规范
type: guide
status: accepted
last_updated: 2026-11-08
source_of_truth: canonical
---

# 文档治理规范（GOVERNANCE）

本文件是 Biaoyue 仓库所有产品文档的治理规范与元数据契约。后续新建或迁移的文档均须遵循本规范。

---

## 1. 文档域定义

| 域 | 职责 | 不得承载 |
|---|---|---|
| product | 产品方向、愿景、用户画像、竞品分析、功能清单 | 具体技术方案、架构决策、实现细节 |
| design | 设计规范、交互方案、视觉系统 | 最终验收标准（属 OpenSpec）、代码实现 |
| design/approved | 已批准的 feature 设计方案 | 探索性草稿、未决方案 |
| design/explorations | 探索性设计草稿、未决方案对比 | 已批准方案、生产规范 |
| design/system | 设计系统：色板、字体、组件规范、设计令牌 | 单个 feature 的方案 |
| architecture | 当前架构概览、模块划分、技术栈选型 | 已废弃方案、探索性调研 |
| architecture/decisions | ADR（架构决策记录），每条决策一个文件 | 产品需求、设计稿 |
| research | 调研、竞品分析、技术原型、实验结论 | 已接受的设计方案、生产决策 |
| delivery | 版本发布记录、CHANGELOG、交付清单 | 长期架构规范、探索性内容 |
| archive | 已归档的历史文档、被替代的旧版文档 | 当前生效的规范或方案 |

---

## 2. 生命周期与状态转移

### 2.1 status 枚举（恰好 7 个）

```
draft, in-review, accepted, implemented, deprecated, superseded, archived
```

### 2.2 状态转移表

| 当前状态 | 允许转移到 |
|---|---|
| draft | in-review, deprecated, superseded, archived |
| in-review | accepted, draft, deprecated, superseded, archived |
| accepted | implemented, deprecated, superseded, archived |
| implemented | deprecated, superseded, archived |
| deprecated | archived |
| superseded | archived |
| archived | （终态，不可再转移） |

主路径：`draft → in-review → accepted → implemented`

任意状态均可转入 `deprecated`、`superseded`、`archived`。

### 2.3 不可变规则

- `accepted` 和 `archived` 状态的文档**不可原地改写**内容。
- 需要变更时，必须通过 supersede 链：创建新文档，旧文档标记为 `superseded` 并填写 `superseded_by`。
- **append-only 台账例外**：声明 `ledger: append-only` 的台账类文档，允许**追加**新行，禁止修改或删除既有行；同一主题出现多行时以最新行为准。修订既有行只能通过在其后追加新行并注明取代关系完成。该例外只适用于台账文档，不得用于规范正文或任何规则条文。
- 台账文件的 diff 必须是**纯追加**（旧版内容是新版的前缀），否则视为违例；台账限定为 `docs/design/system/` 下的单文件，且必须 `status: accepted` + `source_of_truth: canonical`。
- 同一部件的新行若与既有行冲突，必须在决定列注明「取代第 N 行」；该例外不适用于 `archived` 文档。

---

## 3. frontmatter 契约

### 3.1 必填字段（恰好 4 个）

```
title, type, status, last_updated
```

- `title`：文档标题，字符串。
- `type`：文档类型，见第 4 节枚举。
- `status`：生命周期状态，见第 2 节枚举。
- `last_updated`：最后更新日期，格式 YYYY-MM-DD。

### 3.2 可选字段

- `owner`：文档负责人。单维护者仓库中可省略，不强制历史文档补充。
- `source_of_truth`：权威性标识，枚举如下。缺省为 `supporting`。
- `superseded_by`：**仅当** `status=superseded` 时必填，指向替代文档的相对路径。其余状态**禁止出现**此字段。
- `ledger`：**仅**台账类文档使用，唯一合法值 `append-only`。同时必须满足 `status=accepted`、`source_of_truth=canonical`、位于 `docs/design/system/` 之下；声明后适用 §2.3 的追加例外。台账须保持稳定表头与固定列。
- `redirect`：`superseded` / `archived` 文档指向替代文档的相对路径，供留在原位置的旧稿使用（与 `superseded_by` 并存，两者语义相同）。

### 3.3 source_of_truth 枚举（恰好 3 个）

```
canonical, supporting, historical
```

| 值 | 含义 |
|---|---|
| canonical | 该主题的当前权威文档，同主题唯一 |
| supporting | 辅助参考文档（缺省值） |
| historical | 历史参考，不再维护 |

### 3.4 frontmatter 示例

**canonical spec 示例：**

```yaml
title: 核心需求规格
type: product
status: accepted
last_updated: 2026-07-01
source_of_truth: canonical
owner: mason
```

**supporting design 示例：**

```yaml
title: 阅读器分栏布局探索
type: design
status: draft
last_updated: 2026-06-15
source_of_truth: supporting
```

**superseded archive 示例：**

```yaml
title: 旧版存储架构方案
type: architecture
status: superseded
last_updated: 2025-12-01
source_of_truth: historical
superseded_by: ../architecture/0003-store-slices.md
```

---

## 4. type 枚举（恰好 8 个）

```
product, design, architecture, adr, research, delivery, guide, archive
```

| 值 | 适用场景 |
|---|---|
| product | 产品方向、愿景、需求清单 |
| design | 设计规范、交互/视觉方案 |
| architecture | 架构概览、模块设计 |
| adr | 架构决策记录 |
| research | 调研、实验、技术原型 |
| delivery | 版本发布、交付文档 |
| guide | 指南、规范、操作手册 |
| archive | 已归档历史文档 |

---

## 5. canonical 冲突规则

**同一主题不得存在两个 `source_of_truth=canonical` 文档。**

冲突时按以下权威优先级矩阵裁定（高 → 低，低层不得覆盖高层）：

```
1. active change delta（仅该变更范围内）
2. canonical current spec
3. accepted ADR / architecture
4. approved design
5. product direction
6. research / history
```

发现冲突时，低优先级文档应被降级为 `supporting` 或进入 supersede 流程。

### 5.1 解释条款（不改变上表排序）

**条款 A · 具体性优先**：同一事实，若低层文档给出更具体的规定且**不与高层文档矛盾**，两者共存，不构成冲突。高层管原则，低层管具体。

**条款 B · 矛盾即缺陷**：若低层文档与高层文档**矛盾**（例如 approved design 违反 product direction 的某条铁律），按矩阵高层胜，且**低层文档必须修订**。矩阵裁定的对象是「同一事实的重复表述」；产品方向对设计的约束通过**评审**落地（G1 出口 code-review 的 Spec 轴核对 D#），不在矩阵内另设一条权威。

---

## 6. 更新与归档规则

### 6.1 活文档更新

- `draft` / `in-review` 状态的文档原地更新。
- `accepted` / `implemented` 状态的**内容修订**走 supersede 链（§2.3）；台账类文档按 §2.3 的追加例外处理。
- 历史变更交给 Git 版本历史追溯，不额外维护版本副本。

### 6.2 不可变快照（仅三种情况生成）

| 触发条件 | 产物 |
|---|---|
| 重要架构决策 | ADR 文件（architecture/decisions/NNNN-xxx.md） |
| 一次功能变更完成 | OpenSpec change 归档 |
| 正式产品发布 | CHANGELOG 条目 + Git tag |

### 6.3 归档规则

- 归档文档必须设置 `status=archived`。
- 归档文档必须位于 `archive/` 目录或通过 redirect 指向替代文档。
- `superseded` 文档同样必须位于 `archive/` 目录或声明 `redirect`（治理检查器按此执行）。
- 归档后文档内容不可修改。

---

## 7. 命名规则

| 文档类型 | 路径模式 | 说明 |
|---|---|---|
| ADR | `architecture/decisions/NNNN-kebab.md` | NNNN 为四位十进制序号（0001-9999），不回收 |
| 归档文档 | `archive/YYYY/<origin>/xxx.md` | YYYY 为归档年份，origin 为来源域 |
| 已批准 feature 设计 | `design/approved/<feature>/xxx.md` | feature 为 kebab-case 名称 |
| 探索性设计 | `design/explorations/<feature>/xxx.md` | feature 为 kebab-case 名称 |

---

## 8. 链接规则

- 跨文档引用使用**相对 Markdown 链接**，格式 `[显示文本](../path/to/file.md)`。
- 所有 `source_of_truth=canonical` 文档必须从 `docs/README.md` 索引可达。
- 禁止使用绝对 URL 指向本仓库内部文档。
- `superseded` 文档的 `superseded_by` 字段值为相对路径链接目标。
