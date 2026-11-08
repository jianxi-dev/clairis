# 规格对齐：阅读空间缩略图改为 64×48

## Why

#396 把阅读空间卡片右侧缩略图从 72×54 降到 64×48，以消除缩略图与上下文字的矩形重叠；该次只改了实现与测试，`openspec/specs/navigation/spec.md` 仍写 72×54。

规格与实现从此不一致，并且直接制造了假红：#430 的三条悬浮预览 e2e 按规格推出窄窗宽 392（基准 320 + 缩略图 72），而实现按 `CARD_RATIO_W` 得到 384。照规格写断言的人会持续踩到同一处。

## What Changes

- `navigation` 域「阅读空间密度与卡片规格」：缩略图尺寸 72×54 → 64×48（requirement 正文 1 处 + 「缩略图比例」场景 1 处）。
- 同步 `src/lib/railCards.ts` 与 `src/components/Rail/ReadingRail.tsx` 中描述该尺寸的注释。
- 不改变任何运行时行为：`CARD_RATIO_W = 64` / `CARD_RATIO_H = 48` 保持不变。

## Impact

- 规格：`navigation` 域 1 个 requirement 被修订，requirement 总数不变（17 域 / 153 条）。
- 代码：仅注释；无类型、无构建、无行为变化。
- 测试：约束悬浮预览宽度的来源仍是「基准宽 + 一个缩略图宽」，e2e 已改为常量派生（#439）。
