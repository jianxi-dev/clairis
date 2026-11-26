# #1560 QG-5 证据纪要（editor-surface-batch23/1.2）

验证基于 HEAD: `feat/b2-crop-jump-fix`（工作区未提交；源基线 origin/main b72dc142）
采集时间: 2026-11-26

## 自动化验证原始输出

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 退出 0 |
| `npm test` | 2252 tests 全过 |
| `npx playwright test e2e/editors/crop-jump-measure.spec.ts e2e/editors/crop-cleanup-sync.spec.ts --timeout=120000` | 6 passed (13.2s) |

## 逐帧测量（rAF ≥20 帧，原始输出摘录）

**余量场景**（40 行 + 图 + 20 行；scrollTop < max）：
`CROP-JUMP max|Δ| scrollTop before=0 after=0 widgetTop before=0 after=0 freshTop after=0 widgetRebuilt=true` → 确认瞬间零位移

**贴底场景**（12 行 + 单图；scrollTop === max）：
`CROP-JUMP-BOTTOM after-internal max|Δ| freshTop=0 scrollTop=0; scrollTop 393->373; scrollHeight 1059->1039`
→ 确认后帧内零抖动（Δ0）；scrollTop -20 与 scrollHeight -20 一一对应 = 文档变短的贴底夹取，物理必然
→ 帧序列：`75/75/475/741 | 75/75/475/741 | 55/55/495/721 | 55/55/495/721 | …（其后 28 帧恒定）` 一次性 clamp，无过渡帧双跳、无跳顶

## 多态证据（.artifacts/1560/state-coverage.json，4 态全 passed）

before-crop / crop-open / after-confirm-once-clamp / reenter-keeps-rect

## 代码审查要点

- 改动仅一处：cleanup 尾部 1px 滚动回弹（scrollTop+1 再回，真改滚动位置）→ `scroller.style.filter="blur(0px)"` + rAF 清回（不动滚动位置）
- 包含块风险已排查：`.cm-image-toolbar` / `.cm-image-maximize` / `.cm-embed-panel` 均为 body 级 fixed 浮层，非 `.cm-scroller` 后代，不受其 filter 影响
- 回退无价值改动：estimatedHeight getter、确认时写 cropDisplayCache（实测均不减少位移）

## 未能自动化的项（显式声明）

- **WKWebView 合成层残影**：scroller 上 filter 是否等效清除真机残影，headless 无法验证。旧 1px 回弹是历史真机验证过的手段，本轮换成不动滚动位置的 filter——**需真机连续裁剪确认残影不回归**。
