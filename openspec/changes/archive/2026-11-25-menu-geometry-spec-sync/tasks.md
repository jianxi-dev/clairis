# Tasks

## 1. 规格对齐（#1434 裁决：32 为有意收紧）

- [x] 1.1 `openspec/changes/menu-geometry-spec-sync/specs/editing/spec.md`：E-7 / E-11 两个 requirement 的 MODIFIED delta（行高 36→32、图标 20→18，含 A-8.2 场景；全文由主规格程序化生成，受控替换 5 处）
- [x] 1.2 `openspec archive menu-geometry-spec-sync`：主规格 `openspec/specs/editing/spec.md` 由 archive 流程同步（本 PR 内完成）

## 2. 真值同步

- [x] 2.1 `e2e/fixtures/editor-anchors.ts`：`menu.rowHeight` 36 → 32
- [x] 2.2 `scripts/anchor-allowlist.tsv`：删除 `menu_row_height` 豁免行
- [x] 2.3 `.github/workflows/ci.yml`：锚点一致性步骤切 `--strict`

## 3. 验证

- [x] 3.1 `openspec validate menu-geometry-spec-sync --strict` 通过
- [x] 3.2 `bash scripts/anchor-consistency-check.sh --strict` 4/4 PASS（exit 0）
- [x] 3.3 `npx playwright test e2e/ui-fidelity.spec.ts e2e/block-menu.spec.ts e2e/menu-floating.spec.ts` 全绿
- [x] 3.4 `npx tsc --noEmit` 通过
