# Tasks: 产品文档重定位

> 本 change 只有一个交付任务（1 change = 1 issue = 1 PR）。

- [x] 1.1 按规格包 §八 重写产品定位文档：vision / Doctrine / scope / users / roadmap / CONTEXT 术语 / 4 个 ADR / 布局规格入 approved，并让 `npm run docs:check` 全绿

  执行步骤：

  1. `docs/product/vision.md`：定位一句话 + 三支柱 + 不为谁做。
  2. `docs/product/principles.md` → Doctrine：序言、D1–D10 表、不为谁做五条。
  3. `docs/product/scope.md`：§2.2 可折叠阅读空间；新增生成物/HTML 边界。
  4. `docs/product/users.md`：补零门槛。
  5. `docs/delivery/roadmap.md`：四阶段。
  6. `CONTEXT.md`：补 10 个术语（不改旧行）。
  7. `docs/architecture/decisions/0006-…`~`0009-…`：四个 ADR。
  8. `docs/design/approved/layout-portal/spec.md`：布局规格 v1.0 + frontmatter。
  9. 验证：`npm run docs:check`、`npx openspec validate --all --strict`、散文检查（无 TBD/占位符）。
