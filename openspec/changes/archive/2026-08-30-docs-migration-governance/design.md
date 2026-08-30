# Design: 文档体系迁移落地

## Context

- 旧结构：`doc/` 平铺混放（designs、architecture、product、README 等），无分类与索引。
- 新结构：`docs/` 六类（product / design / architecture / research / delivery / archive）+ `docs/README.md` 索引 + `docs/MIGRATION-REPORT.md` 台账。
- 治理：`docs-governance-check` 门禁校验引用路径与索引完整性；`AGENTS.md` 的「项目上下文路由」段指向 `docs/README.md` 与 `docs/architecture/overview.md`。

约束：文档中文 + 保留 markdown；不与用户确认不动跟踪表；规格引用指向 `docs/design/approved/` 现行路径。

## Goals / Non-Goals

**Goals**
- `docs/README.md` 成为唯一权威入口。
- 历史文档无丢失（台账逐项记录去向）。
- 引用路径全部有效（门禁保证）。

**Non-Goals**
- 不改文档内容语义（只移动/归类/修引用）。
- 不评审既有文档质量（治理门禁只管结构与引用）。

## 方案

1. **迁移执行**：按类型映射到 `docs/<category>/`，保留文件名，产出 `docs/MIGRATION-REPORT.md` 台账（源 → 目标 → 状态）。
2. **索引建立**：`docs/README.md` 分类索引；`docs/architecture/overview.md` 与 `docs/architecture/decisions/` 承接架构文档。
3. **引用修复**：grep 全仓旧 `doc/` 引用（规格、README、脚本注释），逐一改指新路径；`docs/design/approved/README.md` 更新批准设计清单。
4. **门禁**：新增 docs-governance-check 脚本：校验 `docs/README.md` 存在、文档内相对引用路径可达、`docs/design/approved/` 清单与目录一致；接入 CI 与 `scripts/verify.sh`。
5. **AGENTS.md**：文档入口、路由、命令段更新为 `docs/` 结构。

## 备选方案（已否决）

- **不迁移、仅建索引**：无法消除 `doc/` 混杂，门禁无法统一。
- **迁移后保留旧路径软链**：链接维护成本高、易漂移，不采用。

## 测试

- docs-governance-check 门禁在 CI / verify.sh 中通过。
- `docs/MIGRATION-REPORT.md` 台账逐项可追溯。
- 全仓 grep 无失效旧 `doc/` 引用（已排除 `docs/` 自身与 gitignore 目录）。