# #1612 QG-5 证据纪要

验证基于分支 `feat/maximize-button-order`（源基线 origin/main 09a48ff6）

## 自动化验证
| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` | 182 files / 2265 tests 全过 |
| `npx playwright test maximize-button-order + maximize-tooltip-zoom + maximize-multinav + crop-cleanup-sync` | **15 passed** |

## 运行时证据（原始输出）
```
MAX-ORDER img-max-reset → img-max-zoom-out → img-max-zoom-in → img-max-scale
          → img-max-rotate → img-max-download → img-max-clear-crop → img-max-close
ICON-PATHS rotate=M15.55...(旋转箭头) reset=M13 3c-4.97...(时钟回退)
→ 顺序符合验收（恢复原始尺寸第一、重置图片在关闭前）；图标 path 不同
```

## 截图覆盖说明（诚实声明）
4 态由运行时 DOM 顺序断言与 SVG path 断言承载（按钮顺序/图标是结构性事实，e2e 断言即证据；单帧截图无法表达顺序）。

## 实现要点
- 「重置图片」图标：RotateOutlined → **ExpandOutlined**（icons.ts L622 既有图标，语义=清除裁剪恢复整图；此前未被任何按钮使用，无撞形）。编辑态与放大层同步改，同一动作统一图标
- 「恢复原始尺寸」appendChild 移到 controls 第一位
- refreshNavUi 的 clearCropBtn 挂载：appendChild 末尾 → **insertBefore(clearCropBtn, closeBtn)**（有 crop 时插到关闭前）
- 数据面：复用既有图标概念（无新增概念），六栏表沿用 batch23 design.md 既有行
