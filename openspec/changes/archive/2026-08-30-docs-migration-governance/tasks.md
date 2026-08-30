# Tasks: 文档体系迁移与治理门禁

## 1. 目录迁移

- [x] 1.1 将 `doc/` 全部内容按产品/设计/架构/研究/交付/归档六类迁移至 `docs/`。验收：`docs/` 分类目录齐全，无文件丢失。
- [x] 1.2 产出迁移台账 `docs/MIGRATION-REPORT.md`（源 → 目标 → 状态逐项）。验收：台账与 `docs/` 实际目录一致。

## 2. 索引与规范

- [x] 2.1 建立 `docs/README.md` 分类索引（产品/设计/架构/研究/交付/归档 + 入口导航）。验收：`docs/README.md` 指向所有分类入口。
- [x] 2.2 制定文档治理规范（命名/归类/引用约定），规格设计引用统一指向 `docs/design/approved/` 现行路径。验收：`docs/design/approved/README.md` 清单与目录一致。

## 3. 引用修复

- [x] 3.1 全仓修复旧 `doc/` 引用（规格、README、脚本注释、AGENTS.md）。验收：grep 旧 `doc/` 引用无失效项（排除 `docs/` 自身与 gitignore 目录）。

## 4. 治理门禁

- [x] 4.1 新增 docs-governance-check 检查：`docs/README.md` 存在、文档内相对引用可达、`docs/design/approved/` 清单一致。验收：脚本可独立运行且对失效引用报错。
- [x] 4.2 门禁接入 CI（docs-governance 工作流/步骤）与 `scripts/verify.sh`。验收：`bash scripts/verify.sh` 包含该检查且全绿。

## 5. AGENTS.md 同步

- [x] 5.1 `AGENTS.md` 文档入口与项目上下文路由更新为 `docs/` 新结构。验收：入口与 `docs/README.md` 一致。