## ADDED Requirements

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
