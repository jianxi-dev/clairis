## ADDED Requirements

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
