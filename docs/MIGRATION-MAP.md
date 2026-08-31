# 文档迁移账本（MIGRATION-MAP）

> 本文件是 Clairis 文档治理「任务 3」的唯一交付物：为任务 1 基线清单中的**每一个**产品文档逐行记录处置，
> 目标是让后续迁移**零判断**——每行的去向、类型、状态、权威性、动作均已在此固定。
>
> - 数据来源（只读）：`.omo/evidence/ulw/clairis-doc-governance/task-1/baseline-manifest.json`（173 条目）与 `exclusion-ledger.json`。
> - 覆盖：根目录 9 + `index.html.artifact.json` 1、`doc/` HEAD 47、`docs/` 工作区 100、`openspec/` 1、`.opencode/` 16，合计 174 行。
> - 状态无法确认的文件一律标 `needs-review`，**禁止后续自动移动**；**严禁**依据文件名中的 final/SPEC/vN 推断状态。
> - 本账本**不移动、不删除、不修改**任何源文件；仅记录处置决定。

## 字段与枚举说明

- **current_path**：任务 1 基线清单中的源路径（唯一键，每个源文档恰好出现一次）。
- **target_path**：迁移目标路径。`待定（needs-review，禁止自动移动）` 表示尚未裁定、禁止自动移动；`不适用` 表示排除/生成物，不参与迁移。
- **type**（任务 2 枚举）：`product / design / architecture / adr / research / delivery / guide / archive`。`product` 作为未确认 markdown 的安全缺省，最终以人工裁定为准。
- **status**（任务 2 枚举）：`draft / in-review / accepted / implemented / deprecated / superseded / archived`。未确认状态统一记 `draft`。
- **authority**（任务 2 枚举）：`canonical / supporting / historical`。
- **action**（本任务精确枚举）：`keep / move / split / archive / remove-after-verify / exclude / needs-review`。
  - `needs-review`：未裁定，**禁止自动移动**。
  - `exclude`：排除项，不移动不删除（GBrain 探针、生成物、OS 元数据）。
  - `keep`：保持原位（已在归档目录的历史稿、工具配置等）。
  - `archive`：已裁定移入归档分组的文件——含工作区已删除的 `doc/` HEAD 历史树（恢复后落点）与 docs/ 根历史稿（移入 legacy-docs/）；目标为归档落点。
  - `move`：已裁定迁移目标（见 §1/§3 处置表），执行普通移动。
  - `remove`：已裁定删除（test.html，4 字节测试文件）。
  - `split / remove-after-verify`：本账本暂不使用。
- **replacement**：仅 `remove-after-verify` 行必填且须指向具体目标路径；本账本无此类行。
- **notes**：处置依据与约束。

## 固定处置（计划硬规定，不得改动）

| current_path | action | authority | 约束 |
|---|---|---|---|
| `_cap_check2.md` | `exclude` | `historical` | GBrain 探针，不移动、不删除 |
| `index.html.artifact.json` | `exclude` | `historical` | 生成物，不进产品文档迁移 |
| `index.html` | `exclude` | `supporting` | Vite 构建入口（`<div id="root">` + `/src/main.tsx`），非文档 |
| `test.html` | `remove` | `historical` | 4 字节测试文件，删除 |
| `landing.html` | `move` | `supporting` | 移入 `docs/design/explorations/landing/`（落地页原型） |

## 逐文件迁移账本

### 1. 根目录文档（9 行）

| current_path | target_path | type | status | authority | action | replacement | notes |
|---|---|---|---|---|---|---|---|
| `AGENTS.md` | `不适用` | `guide` | `implemented` | `supporting` | `keep` |  | 仓库 Agent 路由配置文件，入口文件，保留原处。 |
| `CONTEXT.md` | `不适用` | `product` | `implemented` | `supporting` | `keep` |  | 共享词汇与架构决策入口，保留原处；line 9 引用 Bundle ID 手册，移 delivery 后链接改 `docs/delivery/…`。 |
| `CORE-REQUIREMENTS-clairis.md` | `删除` | `product` | `superseded` | `historical` | `remove` |  | 根目录过时副本（rebrand 前旧版，内容与 docs/ 副本不一致）已删除；同源 `docs/CORE-REQUIREMENTS-clairis.md` 保留为历史存根（superseded + redirect→docs/product/README.md），内容可从 git 历史与 MIGRATION-REPORT §四 哈希核对。 |
| `PLAN-REVIEW-LOG.md` | `docs/archive/2026/reading-completion/PLAN-REVIEW-LOG.md` | `delivery` | `archived` | `historical` | `keep` |  | 账本补正：文件已在此（上一轮归档），行从 needs-review → keep。 |
| `PLAN.md` | `docs/archive/2026/reading-completion/PLAN.md` | `delivery` | `archived` | `historical` | `keep` |  | 账本补正：文件已在此（上一轮归档），行从 needs-review → keep。 |
| `_cap_check2.md` | `不适用` | `archive` | `archived` | `historical` | `exclude` |  | 固定处置：GBrain 探针文件，不移动、不删除、不参与迁移。 |
| `index.html` | `不适用` | `guide` | `implemented` | `supporting` | `exclude` |  | 账本修正：Vite 构建入口（`<div id="root">` + `/src/main.tsx`），非文档；由 needs-review → exclude。 |
| `landing.html` | `docs/design/explorations/landing/landing.html` | `design` | `draft` | `supporting` | `move` |  | 落地页原型，移入探索组；固定处置表 line 33 同步更新。 |
| `test.html` | `删除` | `design` | `deprecated` | `historical` | `remove` |  | 4 字节测试文件，删除。 |

### 2. doc/ HEAD 历史树（工作区已删除）（47 行）

| current_path | target_path | type | status | authority | action | replacement | notes |
|---|---|---|---|---|---|---|---|
| `doc/09-html-exploration.md` | `docs/archive/历史稿/09-html-exploration.md` | `research` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/09-html-exploration.md 恢复。标 historical，禁止自动移动。 |
| `doc/ARCHITECTURE.md` | `docs/archive/历史稿/ARCHITECTURE.md` | `architecture` | `archived` | `historical` | `archive` |  | HEAD 架构稿（旧名 doc/），工作区已删除；现行为 docs/ARCHITECTURE.md（SHA 不同）。标 historical，禁止自动移动。 |
| `doc/CORE-REQUIREMENTS-v3-archived.md` | `docs/archive/历史稿/CORE-REQUIREMENTS-v3-archived.md` | `product` | `archived` | `historical` | `archive` |  | HEAD 核心需求历史版本，工作区已删除；内容可从 git show HEAD:doc/CORE-REQUIREMENTS-v3-archived.md 恢复。标 historical，禁止自动移动。 |
| `doc/CORE-REQUIREMENTS-v4.md` | `docs/archive/历史稿/CORE-REQUIREMENTS-v4.md` | `product` | `archived` | `historical` | `archive` |  | HEAD 核心需求历史版本，工作区已删除；内容可从 git show HEAD:doc/CORE-REQUIREMENTS-v4.md 恢复。标 historical，禁止自动移动。 |
| `doc/CORE-REQUIREMENTS-渐明.md` | `docs/archive/历史稿/CORE-REQUIREMENTS-渐明.md` | `product` | `archived` | `historical` | `archive` |  | HEAD 核心需求历史版本，工作区已删除；内容可从 git show HEAD:doc/CORE-REQUIREMENTS-渐明.md 恢复。标 historical，禁止自动移动。 |
| `doc/CORE-REQUIREMENTS.md` | `docs/archive/历史稿/CORE-REQUIREMENTS.md` | `product` | `archived` | `historical` | `archive` |  | HEAD 核心需求历史版本，工作区已删除；内容可从 git show HEAD:doc/CORE-REQUIREMENTS.md 恢复。标 historical，禁止自动移动。 |
| `doc/DESIGN-REVIEW.md` | `docs/archive/历史稿/DESIGN-REVIEW.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/DESIGN-REVIEW.md 恢复。标 historical，禁止自动移动。 |
| `doc/DEVEX-REVIEW.md` | `docs/archive/历史稿/DEVEX-REVIEW.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/DEVEX-REVIEW.md 恢复。标 historical，禁止自动移动。 |
| `doc/EXECUTION-PLAN.md` | `docs/archive/历史稿/EXECUTION-PLAN.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/EXECUTION-PLAN.md 恢复。标 historical，禁止自动移动。 |
| `doc/JIANMING-NAMING-REGISTRATION.md` | `docs/archive/历史稿/JIANMING-NAMING-REGISTRATION.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/JIANMING-NAMING-REGISTRATION.md 恢复。标 historical，禁止自动移动。 |
| `doc/MVP-渐明-v1.md` | `docs/archive/历史稿/MVP-渐明-v1.md` | `product` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/MVP-渐明-v1.md 恢复。标 historical，禁止自动移动。 |
| `doc/MVP-需求跟踪表.md` | `docs/archive/历史稿/MVP-需求跟踪表.md` | `product` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/MVP-需求跟踪表.md 恢复。标 historical，禁止自动移动。 |
| `doc/QUALITY-STANDARDS.md` | `docs/archive/历史稿/QUALITY-STANDARDS.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/QUALITY-STANDARDS.md 恢复。标 historical，禁止自动移动。 |
| `doc/SOURCE-MANAGEMENT.md` | `docs/archive/历史稿/SOURCE-MANAGEMENT.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/SOURCE-MANAGEMENT.md 恢复。标 historical，禁止自动移动。 |
| `doc/archive/HTML-SUPPORT-DESIGN.md` | `docs/archive/历史稿/HTML-SUPPORT-DESIGN.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 已归档历史稿，工作区已删除；内容可从 git show HEAD:doc/archive/HTML-SUPPORT-DESIGN.md 恢复。标 historical，禁止自动移动。 |
| `doc/archive/MDWRT-HANDOVER.md` | `docs/archive/2026/MDWRT-HANDOVER.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 已归档历史稿，工作区已删除；内容可从 git show HEAD:doc/archive/MDWRT-HANDOVER.md 恢复。标 historical，禁止自动移动。 |
| `doc/archive/QUALITY-IMPROVEMENT.md` | `docs/archive/历史稿/QUALITY-IMPROVEMENT.md` | `delivery` | `archived` | `historical` | `archive` |  | HEAD 已归档历史稿，工作区已删除；内容可从 git show HEAD:doc/archive/QUALITY-IMPROVEMENT.md 恢复。标 historical，禁止自动移动。 |
| `doc/archive/markdown阅读器.md` | `docs/archive/历史稿/markdown阅读器.md` | `research` | `archived` | `historical` | `archive` |  | HEAD 已归档历史稿，工作区已删除；内容可从 git show HEAD:doc/archive/markdown阅读器.md 恢复。标 historical，禁止自动移动。 |
| `doc/designs/design-codex-brief.md` | `docs/archive/历史稿/design-codex-brief.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/design-codex-brief.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/design-concept-v3.md` | `docs/archive/历史稿/design-concept-v3.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/design-concept-v3.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/design-consultation-20260702.md` | `docs/archive/历史稿/design-consultation-20260702.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/design-consultation-20260702.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/folio-breakthrough-20260704/design-concept.md` | `docs/archive/历史稿/design-concept.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/folio-breakthrough-20260704/design-concept.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/folio-breakthrough-20260704/finalized.html` | `docs/archive/历史稿/finalized.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/folio-breakthrough-20260704/finalized.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/folio-breakthrough-20260704/finalized.json` | `docs/archive/历史稿/finalized.json` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/folio-breakthrough-20260704/finalized.json 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/folio-nextgen-compare.html` | `docs/archive/历史稿/folio-nextgen-compare.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/folio-nextgen-compare.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/ink-desk-prototype.html` | `docs/archive/历史稿/ink-desk-prototype.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/ink-desk-prototype.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/ink-river-prototype.html` | `docs/archive/历史稿/ink-river-prototype.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/ink-river-prototype.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/jianming-nextgen-design-codex.md` | `docs/archive/历史稿/jianming-nextgen-design-codex.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/jianming-nextgen-design-codex.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/jianming-nextgen-design-prototype.html` | `docs/archive/历史稿/jianming-nextgen-design-prototype.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/jianming-nextgen-design-prototype.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/no-sidebar-design.html` | `docs/archive/历史稿/no-sidebar-design.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/no-sidebar-design.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/no-sidebar-design.md` | `docs/archive/历史稿/no-sidebar-design.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/no-sidebar-design.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/no-sidebar-prototype-fixed.html` | `docs/archive/历史稿/no-sidebar-prototype-fixed.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/no-sidebar-prototype-fixed.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/no-sidebar-prototype.html` | `docs/archive/历史稿/no-sidebar-prototype.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/no-sidebar-prototype.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-dna.html` | `docs/archive/历史稿/prototype-dna.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-dna.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-erosion.html` | `docs/archive/历史稿/prototype-erosion.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-erosion.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-kaleidoscope-b.html` | `docs/archive/历史稿/prototype-kaleidoscope-b.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-kaleidoscope-b.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-kaleidoscope-c.html` | `docs/archive/历史稿/prototype-kaleidoscope-c.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-kaleidoscope-c.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-kaleidoscope.html` | `docs/archive/历史稿/prototype-kaleidoscope.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-kaleidoscope.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-magnetic-field.html` | `docs/archive/历史稿/prototype-magnetic-field.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-magnetic-field.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-wind-a.html` | `docs/archive/历史稿/prototype-wind-a.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-wind-a.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-wind-b.html` | `docs/archive/历史稿/prototype-wind-b.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-wind-b.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-wind-c.html` | `docs/archive/历史稿/prototype-wind-c.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-wind-c.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototype-wind.html` | `docs/archive/历史稿/prototype-wind.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototype-wind.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/prototypes-all.html` | `docs/archive/历史稿/prototypes-all.html` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/prototypes-all.html 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/the-desk-concept.md` | `docs/archive/历史稿/the-desk-concept.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/the-desk-concept.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/designs/three-column-layout.md` | `docs/archive/历史稿/three-column-layout.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 设计探索稿，工作区已删除；内容可从 git show HEAD:doc/designs/three-column-layout.md 恢复，对应原型现多存于 docs/designs/。标 historical，禁止自动移动。 |
| `doc/渐明-重新定义.md` | `docs/archive/历史稿/渐明-重新定义.md` | `design` | `archived` | `historical` | `archive` |  | HEAD 历史稿，工作区已删除；内容可从 git show HEAD:doc/渐明-重新定义.md 恢复。标 historical，禁止自动移动。 |

### 3. docs/ 工作区文档（100 行，needs-review 行已按 clairis-root-docs-organize 处置完毕）

| current_path | target_path | type | status | authority | action | replacement | notes |
|---|---|---|---|---|---|---|---|
| `docs/.DS_Store` | `不适用` | `archive` | `archived` | `historical` | `exclude` |  | macOS 元数据文件，非产品文档；不参与迁移，建议从备份中剔除。 |
| `docs/0-welcome.md` | `不适用` | `product` | `implemented` | `supporting` | `keep` |  | 活规格（真相源 src-tauri/samples/0-welcome.md），保留 docs/ 根。 |
| `docs/09-html-exploration.md` | `docs/archive/2026/legacy-docs/09-html-exploration.md` | `research` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs。 |
| `docs/ARCHITECTURE.md` | `docs/archive/2026/legacy-docs/ARCHITECTURE.md` | `architecture` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs（被 docs/architecture/overview.md + ADR 0001-0005 取代，仍用旧名 MDWRT）。 |
| `docs/CLAIRIS-NAMING-REGISTRATION.md` | `docs/delivery/CLAIRIS-NAMING-REGISTRATION.md` | `delivery` | `draft` | `supporting` | `move` |  | 命名/上架/注册三件套，移入 delivery/。 |
| `docs/CORE-REQUIREMENTS-clairis.md` | `不适用` | `product` | `superseded` | `historical` | `keep` |  | superseded 存根，被 product/ + openspec/specs/ 取代。 |
| `docs/DESIGN-PHILOSOPHY.md` | `不适用` | `design` | `accepted` | `canonical` | `keep` |  | 顶层权威（与 docs/README.md、GOVERNANCE.md 同级），保留 docs/ 根。 |
| `docs/DESIGN-REVIEW.md` | `docs/archive/2026/legacy-docs/DESIGN-REVIEW.md` | `design` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs。 |
| `docs/DEVEX-REVIEW.md` | `docs/archive/2026/legacy-docs/DEVEX-REVIEW.md` | `delivery` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs。 |
| `docs/EXECUTION-PLAN.md` | `docs/archive/2026/legacy-docs/EXECUTION-PLAN.md` | `delivery` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs。 |
| `docs/METHODOLOGY.md` | `不适用` | `guide` | `accepted` | `canonical` | `keep` |  | 顶层权威，保留 docs/ 根。 |
| `docs/MVP-渐明-v1.md` | `docs/archive/2026/legacy-docs/MVP-渐明-v1.md` | `delivery` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs。 |
| `docs/MVP-需求跟踪表.md` | `不适用` | `product` | `implemented` | `supporting` | `keep` |  | 活规格（openspec 规格直接引用跟踪表），保留 docs/ 根。 |
| `docs/QUALITY-STANDARDS.md` | `docs/archive/2026/legacy-docs/QUALITY-STANDARDS.md` | `delivery` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs。 |
| `docs/SOURCE-MANAGEMENT.md` | `docs/archive/2026/legacy-docs/SOURCE-MANAGEMENT.md` | `delivery` | `archived` | `historical` | `archive` |  | 归档至 legacy-docs。 |
| `docs/architecture-store-slices.md` | `不适用` | `architecture` | `implemented` | `supporting` | `keep` |  | 活规格（CORE-REQUIREMENTS-clairis.md:531 引用），保留 docs/ 根。 |
| `docs/archive/CORE-REQUIREMENTS-V4-2-archived.md` | `docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-V4-2-archived.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/CORE-REQUIREMENTS-v3-archived.md` | `docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/CORE-REQUIREMENTS-v4-archived.md` | `docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-v4-archived.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/CORE-REQUIREMENTS-渐明-archived.md` | `docs/archive/2026/legacy-requirements/CORE-REQUIREMENTS-渐明-archived.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/HTML-SUPPORT-DESIGN.md` | `docs/archive/2026/legacy-requirements/HTML-SUPPORT-DESIGN.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/QUALITY-IMPROVEMENT.md` | `docs/archive/2026/legacy-requirements/QUALITY-IMPROVEMENT.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/markdown阅读器.md` | `docs/archive/2026/legacy-requirements/markdown阅读器.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/no-sidebar-desk-file-list-proposal.md` | `docs/archive/2026/legacy-requirements/no-sidebar-desk-file-list-proposal.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/archive/渐晰Markdown 阅读编辑器 会话移交文档.md` | `docs/archive/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md` | `archive` | `archived` | `historical` | `keep` |  | 已位于 docs/archive/ 归档目录的历史稿；保持原位，禁止自动移动。 |
| `docs/capture-overlay-SPEC.md` | `不适用` | `product` | `implemented` | `supporting` | `keep` |  | 活规格，保留 docs/ 根。 |
| `docs/capture-overlay-问题及想法记录-1.md` | `docs/design/explorations/capture-overlay/capture-overlay-问题及想法记录-1.md` | `design` | `draft` | `historical` | `move` |  | 并入既有 capture-overlay 探索组。 |
| `docs/designs/archive/spec-A5-immersive-reading-r1-archived.md` | `docs/design/explorations/immersive-reading/spec-A5-immersive-reading-r1-archived.md` | `archive` | `archived` | `historical` | `move` |  | 已位于 docs/designs/archive/ 归档目录的设计历史稿；保持原位，禁止自动移动。 |
| `docs/designs/archive/spec-A6-font-size-scaling-r1-archived.md` | `docs/design/explorations/font-size-scaling/spec-A6-font-size-scaling-r1-archived.md` | `archive` | `archived` | `historical` | `move` |  | 已位于 docs/designs/archive/ 归档目录的设计历史稿；保持原位，禁止自动移动。 |
| `docs/designs/archive/spec-A9-reading-progress-r1-archived.md` | `docs/design/explorations/reading-progress/spec-A9-reading-progress-r1-archived.md` | `archive` | `archived` | `historical` | `move` |  | 已位于 docs/designs/archive/ 归档目录的设计历史稿；保持原位，禁止自动移动。 |
| `docs/designs/capture-overlay-v3-critique.md` | `docs/design/explorations/capture-overlay/capture-overlay-v3-critique.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v3-draft.md` | `docs/design/explorations/capture-overlay/capture-overlay-v3-draft.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v3.1.md` | `docs/design/explorations/capture-overlay/capture-overlay-v3.1.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v4.1.md` | `docs/design/explorations/capture-overlay/capture-overlay-v4.1.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v4.md` | `docs/design/explorations/capture-overlay/capture-overlay-v4.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v5.1.md` | `docs/design/explorations/capture-overlay/capture-overlay-v5.1.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v5.2.md` | `docs/design/explorations/capture-overlay/capture-overlay-v5.2.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v5.3.md` | `docs/design/explorations/capture-overlay/capture-overlay-v5.3.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/capture-overlay-v5.md` | `docs/design/explorations/capture-overlay/capture-overlay-v5.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/clairis-theme-system-6V.md` | `docs/design/explorations/theme/clairis-theme-system-6V.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/clairis-themes-o0.html` | `docs/design/explorations/theme/clairis-themes-o0.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/clairis-themes-o1.html` | `docs/design/explorations/theme/clairis-themes-o1.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/clairis-themes.html` | `docs/design/explorations/theme/clairis-themes.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/design-codex-brief.md` | `docs/design/explorations/design-codex/design-codex-brief.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/design-concept-v3.md` | `docs/design/explorations/design-codex/design-concept-v3.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/design-consultation-20260702.md` | `docs/design/explorations/design-codex/design-consultation-20260702.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/folio-breakthrough-20260704/finalized.html` | `docs/design/explorations/folio-breakthrough/finalized.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/folio-breakthrough-20260704/finalized.json` | `docs/design/explorations/folio-breakthrough/finalized.json` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/folio-breakthrough-20260704/无侧栏桌面 — 突破设计概念.md` | `docs/design/explorations/folio-breakthrough/无侧栏桌面 — 突破设计概念.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/folio-nextgen-compare.html` | `docs/design/explorations/folio-breakthrough/folio-nextgen-compare.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/ink-desk-prototype.html` | `docs/design/explorations/ink-desk/ink-desk-prototype.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/ink-river-prototype.html` | `docs/design/explorations/ink-river/ink-river-prototype.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/jianming-nextgen-design-codex.md` | `docs/design/explorations/jianming-nextgen/jianming-nextgen-design-codex.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/jianming-nextgen-design-prototype.html` | `docs/design/explorations/jianming-nextgen/jianming-nextgen-design-prototype.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/module-g-shell-ui.md` | `docs/design/approved/shell-ui/spec.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-design.html` | `docs/design/explorations/no-sidebar/no-sidebar-design.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-design.md` | `docs/design/explorations/no-sidebar/no-sidebar-design.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-doc-navigation-v2.md` | `docs/design/explorations/no-sidebar/no-sidebar-doc-navigation-v2.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-doc-navigation.md` | `docs/design/explorations/no-sidebar/no-sidebar-doc-navigation.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-nav-final.md` | `docs/design/approved/navigation/spec.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-prototype-fixed.html` | `docs/design/explorations/no-sidebar/no-sidebar-prototype-fixed.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-prototype-v2.html` | `docs/design/explorations/no-sidebar/no-sidebar-prototype-v2.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-prototype-v3.html` | `docs/design/explorations/no-sidebar/no-sidebar-prototype-v3.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/no-sidebar-prototype.html` | `docs/design/explorations/no-sidebar/no-sidebar-prototype.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/outline-and-quick-capture-design.md` | `docs/design/explorations/outline/outline-and-quick-capture-design.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/outline-and-quick-capture-final.md` | `docs/design/explorations/outline/outline-and-quick-capture-final.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/outline-and-quick-capture-v2.md` | `docs/design/explorations/outline/outline-and-quick-capture-v2.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/outline-quick-capture-final.md` | `docs/design/approved/outline-quick-capture/spec.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-dna.html` | `docs/design/explorations/prototypes/prototype-dna.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-erosion.html` | `docs/design/explorations/prototypes/prototype-erosion.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-kaleidoscope-b.html` | `docs/design/explorations/prototypes/prototype-kaleidoscope-b.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-kaleidoscope-c.html` | `docs/design/explorations/prototypes/prototype-kaleidoscope-c.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-kaleidoscope.html` | `docs/design/explorations/prototypes/prototype-kaleidoscope.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-magnetic-field.html` | `docs/design/explorations/prototypes/prototype-magnetic-field.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-wind-a.html` | `docs/design/explorations/prototypes/prototype-wind-a.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-wind-b.html` | `docs/design/explorations/prototypes/prototype-wind-b.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-wind-c.html` | `docs/design/explorations/prototypes/prototype-wind-c.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototype-wind.html` | `docs/design/explorations/prototypes/prototype-wind.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/prototypes-all.html` | `docs/design/explorations/prototypes/prototypes-all.html` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/spec-A5-immersive-reading.md` | `docs/design/approved/immersive-reading/spec.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/spec-A6-font-size-scaling.md` | `docs/design/approved/font-size-scaling/spec.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/spec-A9-reading-progress.md` | `docs/design/approved/reading-progress/spec.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/spec-B1-B2-B4-B5-empty-state-creative.md` | `docs/design/explorations/empty-state/spec-B1-B2-B4-B5-empty-state-creative.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/spec-B1-B2-B4-B5-empty-state.md` | `docs/design/approved/empty-state/spec.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/the-desk-concept.md` | `docs/design/explorations/the-desk/the-desk-concept.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/three-column-layout.md` | `docs/design/explorations/three-column/three-column-layout.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/designs/ui-design-philosophy.md` | `docs/design/explorations/ui-philosophy/ui-design-philosophy.md` | `product` | `draft` | `supporting` | `move` |  | 状态未确认（任务 1 基线未判定）；按治理规则标 needs-review，禁止自动移动。 |
| `docs/fanbox-analysis.md` | `docs/research/competitors/fanbox-analysis.md` | `research` | `draft` | `historical` | `move` |  | 任务9.5 确认为竞品研究，迁入 research/competitors；原 needs-review 仅因首轮保守标记。 |
| `docs/单页vs双页阅读效果深层对比研究.md` | `docs/research/interaction/单页vs双页阅读效果深层对比研究.md` | `research` | `draft` | `historical` | `move` |  | 任务9.5 确认为交互/体验研究，迁入 research/interaction；原 needs-review 仅因首轮保守标记。 |
| `docs/渐晰-vs-Obsidian-竞品深度分析.md` | `docs/research/competitors/渐晰-vs-Obsidian-竞品深度分析.md` | `research` | `draft` | `historical` | `move` |  | 任务9.5 确认为竞品研究，迁入 research/competitors；原 needs-review 仅因首轮保守标记。 |
| `docs/渐晰-vs-Typora-Bear-Ulysses-四象限对比.md` | `docs/research/competitors/渐晰-vs-Typora-Bear-Ulysses-四象限对比.md` | `research` | `draft` | `historical` | `move` |  | 任务9.5 确认为竞品研究，迁入 research/competitors；原 needs-review 仅因首轮保守标记。 |
| `docs/渐晰-重新定义.md` | `不适用` | `product` | `implemented` | `supporting` | `keep` |  | 保留 docs/ 根（product/vision.md、users.md、scope.md 引用为来源）。 |
| `docs/渐晰UI设计.html` | `docs/design/explorations/ui-html/渐晰UI设计.html` | `design` | `draft` | `historical` | `move` |  | UI HTML 探索稿，移入 ui-html 探索组。 |
| `docs/渐晰UI设计2.html` | `docs/design/explorations/ui-html/渐晰UI设计2.html` | `design` | `draft` | `historical` | `move` |  | UI HTML 探索稿，移入 ui-html 探索组。 |
| `docs/渐晰颜色设计体系.md` | `docs/design/system/渐晰颜色设计体系.md` | `design` | `draft` | `supporting` | `move` |  | 设计 token 与视觉规则，移入 design/system。 |
| `docs/渐晰（Clairis）App Bundle ID 标准化方案与注册运维手册.md` | `docs/delivery/渐晰（Clairis）App Bundle ID 标准化方案与注册运维手册.md` | `delivery` | `draft` | `supporting` | `move` |  | 命名/上架/注册三件套，移入 delivery/。 |
| `docs/渐晰（Clairis）App 商店上架全套命名方案（国内App Store + 海外App Store双适配）.md` | `docs/delivery/渐晰（Clairis）App 商店上架全套命名方案（国内App Store + 海外App Store双适配）.md` | `delivery` | `draft` | `supporting` | `move` |  | 命名/上架/注册三件套，移入 delivery/。 |
| `docs/统一整套布局方案：主画布分栏规则 + 悬浮面板「可嵌入分栏」必要性与完整设计.md` | `docs/design/explorations/ui-html/统一整套布局方案：主画布分栏规则 + 悬浮面板「可嵌入分栏」必要性与完整设计.md` | `design` | `draft` | `historical` | `move` |  | UI 布局探索稿，移入 ui-html 探索组。 |
| `docs/网站UI效果.html` | `docs/design/explorations/ui-html/网站UI效果.html` | `design` | `draft` | `historical` | `move` |  | UI HTML 探索稿，移入 ui-html 探索组。 |
| `docs/阅读写作软件「展卷仪式」功能需求清单.md` | `不适用` | `product` | `draft` | `supporting` | `keep` |  | P1 功能需求，保留 docs/ 根；待转 openspec/specs/ritual/（后续独立变更）。 |

### 4. OpenSpec 配置（1 行）

| current_path | target_path | type | status | authority | action | replacement | notes |
|---|---|---|---|---|---|---|---|
| `openspec/config.yaml` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | OpenSpec 配置文件，非产品文档迁移对象；状态未确认，禁止自动移动。 |

### 5. .opencode/ 工具配置（16 行）

| current_path | target_path | type | status | authority | action | replacement | notes |
|---|---|---|---|---|---|---|---|
| `.opencode/.gitignore` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/commands/opsx-apply.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/commands/opsx-archive.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/commands/opsx-explore.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/commands/opsx-propose.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/commands/opsx-sync.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/commands/opsx-update.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/package-lock.json` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/package.json` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/project-tree.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/skills/openspec-apply-change/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/skills/openspec-archive-change/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/skills/openspec-explore/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/skills/openspec-propose/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/skills/openspec-sync-specs/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |
| `.opencode/skills/openspec-update-change/SKILL.md` | `待定（needs-review，禁止自动移动）` | `guide` | `draft` | `supporting` | `needs-review` |  | .opencode/ 工具配置/技能，非产品文档迁移对象；状态未确认，禁止自动移动。 |

### 6. 生成物（exclusion ledger）（1 行）

| current_path | target_path | type | status | authority | action | replacement | notes |
|---|---|---|---|---|---|---|---|
| `index.html.artifact.json` | `不适用` | `archive` | `archived` | `historical` | `exclude` |  | 固定处置：生成物（landing.html 的产物快照），不进产品文档迁移，仅登记于 exclusion ledger。 |

## 验收摘要（自动生成核对见证据目录脚本）

- 覆盖率：基线清单 173 个 `path` 在本账本 `current_path` 列恰好各出现一次（100%）。
- 另含 `index.html.artifact.json` 1 行（来自 exclusion ledger，不在基线 path 集合内）。
- `target_path` 列在“非待定/非不适用”的真实目标上无重复；所有 `待定` 行均为 needs-review，禁止自动移动。
- 四个固定处置精确存在：`_cap_check2.md=exclude`、`index.html.artifact.json=exclude`、`index.html=exclude`、`test.html=remove`（四个固定处置精确存在的条目）。

