# Tasks

## 1. 规格对齐

- [x] 1.1 `openspec/specs/navigation/spec.md`「阅读空间密度与卡片规格」：缩略图 72×54 → 64×48（正文 + 场景）
- [x] 1.2 `src/lib/railCards.ts` 与 `src/components/Rail/ReadingRail.tsx` 中描述缩略图尺寸的注释同步为 64×48

## 2. 验证

- [x] 2.1 `openspec validate rail-thumb-spec-sync --strict` 通过
- [x] 2.2 `openspec validate --specs --strict` 通过
- [x] 2.3 `npx tsc --noEmit` 通过
- [x] 2.4 `npx vitest run src/__tests__/railCards.test.ts` 通过
