## ADDED Requirements

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