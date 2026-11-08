# docs-governance Specification

## Purpose
TBD - created by archiving change docs-migration-governance. Update Purpose after archive.
## Requirements
### Requirement: G-1 文档体系结构

应用文档 SHALL 组织于 `docs/` 目录，按六类归档：产品（`docs/product/`）、设计（`docs/design/approved|explorations`）、架构（`docs/architecture/` 含 `decisions/`）、研究（`docs/research/`）、交付（`docs/delivery/` 含 `roadmap.md`）、归档（`docs/archive/`）。`docs/README.md` SHALL 为唯一权威入口，分类索引指向各目录。迁移台账 `docs/MIGRATION-REPORT.md` SHALL 记录历史文档逐项去向。

#### Scenario: 新文档归档路径

- **WHEN** 需要归档一份产品/设计/架构/研究/交付文档
- **THEN** SHALL 按上述分类放入 `docs/` 对应目录，并在 `docs/README.md` 索引中登记

#### Scenario: 历史文档追溯

- **WHEN** 需要确认某历史文档的迁移去向
- **THEN** `docs/MIGRATION-REPORT.md` SHALL 可追溯源路径 → 目标路径

### Requirement: G-2 引用与索引有效性门禁

文档 SHALL 通过 docs-governance 检查：`docs/README.md` 存在且索引完整；文档内相对引用路径 SHALL 可达；`docs/design/approved/README.md` 批准设计清单 SHALL 与目录一致。检查 SHALL 接入 CI 与 `scripts/verify.sh`，失效引用 SHALL 阻断交付。

#### Scenario: 失效引用阻断

- **WHEN** 文档中出现指向不存在路径的相对引用（如旧 `doc/` 残留）
- **THEN** docs-governance 检查 SHALL 报错，`bash scripts/verify.sh` SHALL 失败

#### Scenario: 门禁通过

- **WHEN** 全部文档引用可达、索引完整
- **THEN** docs-governance 检查 SHALL 通过，交付验证全绿

### Requirement: G-3 开发者上下文路由

`AGENTS.md` SHALL 将项目文档入口、上下文路由指向 `docs/README.md` 与 `docs/architecture/overview.md`，与 `docs/` 实际结构保持一致，不得指向已迁移的旧 `doc/` 路径。

#### Scenario: 路由同步

- **WHEN** 更新 AGENTS.md 项目文档路由
- **THEN** SHALL 指向 `docs/` 现行结构且与门禁检查结果一致

### Requirement: DG-1 产品定位文档唯一口径

产品方向文档（`docs/product/`）SHALL 以 Doctrine D1–D10、「不为谁做」五条与三支柱（omakase 精选默认 / malleability / agentic）为唯一口径；名称 SHALL 统一为标月 / Biaoyue；SHALL NOT 保留与新定位冲突的旧表述（如「无侧栏」）。

#### Scenario: Doctrine 取代旧原则

- **WHEN** 读者打开 `docs/product/principles.md`
- **THEN** 文档 SHALL 以 Doctrine D1–D10 为主体，并含「不为谁做」五条

#### Scenario: 布局口径一致

- **WHEN** 读者对照 `docs/product/scope.md` 与 `docs/design/approved/layout-portal/spec.md`
- **THEN** 两处关于阅读空间的表述 SHALL 一致为「可折叠阅读空间」，SHALL NOT 出现「无侧栏」作为现行方案

#### Scenario: 文档门禁

- **WHEN** 执行 `npm run docs:check`
- **THEN** SHALL 退出 0，frontmatter、相对链接与 canonical 唯一性全部通过

### Requirement: DG-2 设计系统为视觉数值唯一来源

跨界面复用的视觉数值 SHALL 由 `docs/design/system/spec.md`（`source_of_truth: canonical`）唯一定义，覆盖图标网格与笔画、图标尺寸、间距刻度、字号阶梯、圆角与阴影、三主题语义色与 L3 判据。单 feature 设计（`docs/design/approved/`）、缺陷票与 e2e 断言 SHALL 引用条款号或 token 名，SHALL NOT 复制具体像素值。该文档 SHALL 驻 `docs/README.md` §二权威矩阵第 4 层，与 canonical spec 或 ADR 冲突时以后者为准。存量硬编码 SHALL NOT 追溯改写。

#### Scenario: 新增视觉参数有出处

- **WHEN** 一次变更需要新增或修改可见视觉参数
- **THEN** 该参数 SHALL 能指向 `design-system:§N` 或 `ledger:<部件>`，SHALL NOT 以「上一次实现」为来源

#### Scenario: feature 设计不复制数值

- **WHEN** 编写或修改 `docs/design/approved/<feature>/` 下的设计稿
- **THEN** 数值 SHALL 以条款引用表达，SHALL NOT 出现与 spec 重复的像素字面量

#### Scenario: 规范无对应条款

- **WHEN** 某视觉参数在 spec 与台账中均无依据
- **THEN** SHALL 先补条款或追加台账行，再实施；该情形 SHALL 记为规范缺口而非例外放行

### Requirement: DG-3 append-only 决案台账

`docs/design/system/decisions.md` SHALL 记录用户已裁决的单部件视觉决定，每行四列：部件 / 决定 / 出处 / 日期。台账 SHALL 声明 `ledger: append-only`，并 SHALL 满足 `status: accepted`、`source_of_truth: canonical`、位于 `docs/design/system/`。合并后 SHALL 只允许追加行，SHALL NOT 修改或删除既有行；同一部件出现多行时 SHALL 以最新行为准，冲突行 SHALL 注明「取代第 N 行」。该例外 SHALL NOT 用于规范正文或 `archived` 文档。

#### Scenario: 追加裁决

- **WHEN** 用户在真机上裁决了一个具体视觉参数
- **THEN** SHALL 在台账追加一行，四列齐全，已落地行带 PR 号

#### Scenario: 已合并台账被改写

- **WHEN** 某次提交修改或删除了台账中已合并的既有行
- **THEN** 该提交 SHALL 被判为违例，修订 SHALL 改为追加一行并注明取代关系

#### Scenario: 台账被误用为规范正文

- **WHEN** 某文档声明 `ledger: append-only` 但内容包含通用规则条文
- **THEN** 该声明 SHALL 无效，文档 SHALL 按普通 canonical 文档的不可变规则处理

### Requirement: DG-4 票面视觉锚点

带 `ui-surface` 标签且未声明 `no-ui-impact` 的票 SHALL 在票面包含第七字段 `**视觉锚点**:`，取值为 `design-system:§N` 或 `ledger:<部件>`，多条以 `;` 分隔，SHALL NOT 写入像素值。该字段与 change 的 conformance 验收锚点（`A-<n>.<m>`）SHALL 保持区分。机检（C9）落地前，该字段 SHALL 由 G1 出口 code-review 人工核对。

#### Scenario: 票面缺视觉锚点

- **WHEN** 一张 `ui-surface` 票未声明 `no-ui-impact` 且缺少视觉锚点字段
- **THEN** 拆票自检 SHALL 拒绝（C9 机检落地后）；落地前 SHALL 由 code-review 拦截并记为已知弱点

#### Scenario: 锚点写入像素值

- **WHEN** 视觉锚点字段出现像素字面量而非条款引用
- **THEN** 该锚点 SHALL 被视为无效，数值 SHALL 回到 spec 定义

### Requirement: DG-5 视觉偏差缺陷承接

`docs/agents/defect-workflow.md` SHALL 定义非功能视觉缺陷：标签复用 `bug` + `ui-surface` + 模块标签，票面 SHALL 含规范锚点、现状值、期望值三要素，缺一 SHALL 回到 `needs-info`。同一部件 30 天内出现第 2 张视觉偏差票 SHALL 至少追加一行台账；累计 ≥3 张同源票 SHALL 按 DQ-7 升级为规范修订。

#### Scenario: 模糊反馈进票

- **WHEN** 用户给出「太大」「太丑」这类无锚点反馈
- **THEN** 执行者 SHALL 先补齐三要素并给出 2–3 个候选终态，再开票或直接修改

#### Scenario: 同一部件复发

- **WHEN** 同一部件在 30 天内出现第 2 张视觉偏差票
- **THEN** SHALL 追加台账行并写明复发；达到 ≥3 张同源票时 SHALL 产出规范修订

