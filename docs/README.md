# Clairis 文档索引

这是 Clairis 文档的**统一入口**，供人类维护者与 Agent 共同使用。所有文档的组织规则、生命周期与元数据契约见 [文档治理规范](./GOVERNANCE.md)。

> 说明：本索引是文档统一入口与路由表。各域正文与规格已就位（见下表各入口）；仍在原位待人工裁定的文件登记于 [迁移账本](./MIGRATION-MAP.md)。

---

## 零、核心文档速查

| 你想做什么 | 读哪个文件 |
| --- | --- |
| 了解产品是什么 | [docs/product/vision.md](./product/vision.md) |
| 了解设计原则 | [docs/product/principles.md](./product/principles.md) |
| 了解目标用户 | [docs/product/users.md](./product/users.md) |
| 了解产品边界 | [docs/product/scope.md](./product/scope.md) |
| 查某功能怎么算对 | `openspec/specs/<domain>/spec.md`（reading/editing/file-management/navigation/capture/application-shell） |
| 看当前架构 | [docs/architecture/overview.md](./architecture/overview.md) |
| 查架构决策 | [docs/architecture/decisions/](./architecture/decisions/README.md)（ADR 0001-0005） |
| 看路线图 | [docs/delivery/roadmap.md](./delivery/roadmap.md) |
| 查某功能批准设计 | `docs/design/approved/<feature>/` |
| 查迁移去向 | [docs/MIGRATION-REPORT.md](./MIGRATION-REPORT.md) |
| 了解治理规则 | [docs/GOVERNANCE.md](./GOVERNANCE.md) |
| 查进行中变更 | `openspec/changes/`（5 个变更：4 项已完成待归档、1 项进行中） |

---

## 一、任务路由

按下表把任务路由到唯一首选入口。每个任务类型只对应一个首选路径；冲突时按下方优先级矩阵裁定。

| 任务类型 | 首选入口 | 说明 |
| --- | --- | --- |
| 产品方向（愿景/原则/用户/范围/方向） | [docs/product/](./product/README.md) | 长期稳定的产品定义，不含功能行为细节 |
| 可验收行为（功能怎么算对） | `openspec/specs/`（当前规格真相源） | 逐功能 requirement 与 scenario 的 canonical 归属（6 个功能域规格已建立） |
| 当前架构（现状是什么样） | [docs/architecture/overview.md](./architecture/overview.md) | 架构现状总览；现状改变只通过 ADR 记录 |
| 设计体验（界面/交互/视觉定案） | [docs/design/approved/](./design/approved/README.md) | 已批准的生效设计；探索稿不在此 |
| 进行中工作（正在改什么） | `openspec/changes/`（活动变更） | 进行中的变更 delta，仅在该变更范围内有效 |
| 历史调查（过去是什么样/为什么） | [docs/architecture/decisions/](./architecture/decisions/README.md)、`docs/archive/`、[docs/design/explorations/](./design/explorations/README.md) | ADR + 归档 + 设计探索，仅用于回溯 |

---

## 二、权威优先级矩阵

冲突时按以下顺序裁定，**高层覆盖低层，低层不得覆盖高层**：

1. active change delta（仅该变更范围）
2. canonical current spec（`openspec/specs/`）
3. accepted ADR / architecture overview
4. approved design
5. product direction
6. research / history

**铁律：低层不得覆盖高层；archive 与 explorations 默认不参与实现裁定，只用于历史调查。**

裁定示例：一个 `docs/design/explorations/` 草图与 `openspec/specs/` 的 requirement 冲突时，以 canonical spec（第 2 层）为准，草图（第 6 层）仅作历史参考。同一事实**只允许一个 canonical 首选路径**；若发现两个文档都自称 canonical，即为冲突，必须提交裁定，不得并存。

---

## 三、目录结构与子域

| 子域 | 入口 | 一句话职责 |
| --- | --- | --- |
| 产品方向 | [docs/product/](./product/README.md) | 愿景、原则、用户、范围、方向 |
| 设计体系 | [docs/design/system/](./design/system/README.md) | 跨界面共享的设计 token 与视觉规则 |
| 已批准设计 | [docs/design/approved/](./design/approved/README.md) | 已批准、当前生效的设计 |
| 设计探索 | [docs/design/explorations/](./design/explorations/README.md) | 未定案的草图与比稿（不参与裁定） |
| 架构决策 | [docs/architecture/decisions/](./architecture/decisions/README.md) | ADR 决策记录 |
| 架构现状 | [docs/architecture/overview.md](./architecture/overview.md) | 架构现状总览 |
| 调研 | [docs/research/](./research/README.md) | 竞品 / 交互 / 技术调研（不参与裁定） |
| 交付 | [docs/delivery/roadmap.md](./delivery/roadmap.md) | 路线图与里程碑 |
| 归档 | [docs/archive/2026/](./archive/2026/README.md) | 2026 年被取代/停用的文档（不参与裁定） |
| 治理规范 | [docs/GOVERNANCE.md](./GOVERNANCE.md) | 域、生命周期、元数据契约 |
| 迁移账本 | [docs/MIGRATION-MAP.md](./MIGRATION-MAP.md) | 逐文件迁移去向与状态 |
| OpenSpec 规格 | `openspec/specs/` | 功能行为真相源（6 个功能域规格已建立） |
| OpenSpec 变更 | `openspec/changes/` | 进行中的变更（5 个：4 项已完成待归档、1 项进行中） |

调研子域进一步划分：[竞品分析](./research/competitors/README.md)、[交互研究](./research/interaction/README.md)、[技术调研](./research/technical/README.md)。
