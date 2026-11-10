# Proposal: 轮盘视觉微调（roulette-visual-tuning）

## Why
用户 2026-11-10：圆心显示为透明色；三级出现后二级希望 0.8（原 0.7 太透）。

## What Changes
- 三级出现时二层不透明度 0.7 → 0.8（根环维持 0.7）。
- 圆心改实色底（accent 24% + surface），不用带 alpha 的软色。

## Capabilities
### Modified Capabilities
- `editing`：选区浮动工具条（二层透明度、圆心底色）。

## Impact
- 代码已随本 change 落地；台账已记一行（decisions.md #535）。
