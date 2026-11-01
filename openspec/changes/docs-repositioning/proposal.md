# Proposal: 产品文档重定位（C10）

## Why

改名（C1）只换了品牌串，产品文档的**内容**仍是旧定位：`docs/product/principles.md` 还是旧五原则、`vision.md` 没有三支柱、`scope.md` 还写着「无侧栏」、`roadmap.md` 是旧里程碑。wayfinder 地图 #22 已锁定新定位（被个人拥有、可被 AI 塑形）与 Doctrine D1–D10，规格包 §八给出了逐文件改写口径。文档是所有后续 change 的输入，不先对齐，C2/C3/C8 会各写各的。

## What Changes

- `docs/product/vision.md`：新名 + 定位一句话 + 三支柱（omakase 默认 / malleability / agentic）。
- `docs/product/principles.md` → **Doctrine**：序言 + D1–D10 + 「不为谁做」五条。
- `docs/product/scope.md`：§2.2 改为「可折叠阅读空间」；新增内容生成与 HTML 编辑边界。
- `docs/product/users.md`：补零门槛口径。
- `docs/delivery/roadmap.md`：替换为四阶段（地基 / 内容重 / 空间与入口 / 商业化与生态）。
- `CONTEXT.md`：补术语（Doctrine、可塑层、四入口、生成物、快照、SKILL.md、阅读空间、网格概览、pane 树、视图规格）。
- 新增 4 个 ADR：① 配置三层与快照；② 生成物=编译产物；③ AI 入口分期与语音第二输入源；④ 可折叠阅读空间取代无侧栏。
- `docs/design/approved/layout-portal/spec.md`：布局规格 v1.0 正文（来自 `.omo/wayfinder/layout-portal-spec.md`）。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `docs-governance`：新增「产品定位文档唯一口径」要求——产品方向文档 SHALL 以 Doctrine D1–D10 + 不为谁做 + 三支柱为准，名称为标月/Biaoyue，且与 `docs/design/approved/layout-portal/spec.md` 不冲突。

## Impact

- 纯文档，不改代码；`npm run docs:check` 必须通过（frontmatter、相对链接、canonical 唯一、archive 位置、legacy paths）。
- 历史归档与迁移账本不动；`docs/design/explorations/` 保持探索稿地位。
- 风险：低。可逆（`git revert`）。
