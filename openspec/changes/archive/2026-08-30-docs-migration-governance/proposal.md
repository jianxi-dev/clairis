# Proposal: 文档体系迁移 doc→docs 与治理门禁

## Why

历史 `doc/` 目录混放产品、设计、架构、研究、交付文档，无统一入口与分类规范；文档与代码/规格容易漂移（多次评审发现文档与实现不一致）。需建立结构化文档体系与自动治理门禁，使 `docs/README.md` 成为唯一权威入口。

## What Changes

- **目录迁移**：`doc/` 全部内容整理迁移至 `docs/`，按产品（`docs/product/`）、设计（`docs/design/approved|explorations`）、架构（`docs/architecture/` + `decisions/`）、研究（`docs/research/`）、交付（`docs/delivery/` + `roadmap.md`）、归档（`docs/archive/`）归类；产出迁移台账 `docs/MIGRATION-REPORT.md`。
- **治理规范**：新增文档治理规范（README 索引、命名/归类约定、docs-governance 检查规则），规格引用统一指向 `docs/design/approved/` 现行路径。
- **自动门禁**：新增 docs-governance-check 检查（CI / pre-commit），校验文档引用路径有效性、README 索引完整性。
- **AGENTS.md 同步**：文档入口、项目上下文路由、命令说明更新为新结构。

## Capabilities

### New Capabilities

<!-- 无新能力——纯文档/基础设施变更 -->

### Modified Capabilities

<!-- 无功能规格变更 -->

## Impact

- 涉及大量 `.md` 移动与引用路径改写（历史文档 + 规格/说明文档中的旧 `doc/` 引用）。
- 新增脚本/CI 检查（docs-governance-check），纳入 `scripts/verify.sh` 与 CI 流程。
- 不改变任何运行时行为。