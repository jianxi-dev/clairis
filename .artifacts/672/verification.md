# #672 顶栏去名与窗口按钮落点重构 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 9.1，design D11；anchors A-9.1–A-9.5）

| 锚点 | 断言 | 实测 |
|---|---|---|
| A-9.1 | 顶栏产品名文本长度为 0 | `pane-header` innerText 无「标月/Biaoyue」（现状本就无产品名，本票补断言锁死） |
| A-9.2 | 左栏不含「阅读空间」文本 | 已删 `ReadingRail.tsx` 头部标题；`rail-panel` / `rail-edge` innerText 均不含 |
| A-9.3 | 未钉住：按钮在栏目页签栏区域，首个页签与按钮右缘间距 ≥ 2px | reserve width=78 / reserveRight=78 / tabLeft=82 → **间距 4px** |
| A-9.4 | 钉住：按钮在左栏，首个页签回原位（偏差 ≤ 2px） | stripLeft=240 / railRight=240 → **偏差 0px** |
| A-9.5 | 切换后无残留错位 | 连续切换 2 次：reserve 单实例、几何仍满足 |

## 实现要点

- `src-tauri/tauri.conf.json`：主窗口加 `"titleBarStyle": "Overlay"` + `"hiddenTitle": true` —— 内容延伸到原生标题栏下方，红黄绿灯因此落在栏目页签栏 / 左栏顶部（「下移」的落地方式）。
- `src/components/Content/PaneTreeView.tsx`：`WINDOW_CONTROLS_RESERVE_PX = 78` 保留区，仅在 `topLeft` 格且 `!railPinned` 时渲染；`topLeftLeafId()` 沿 `children[0]` 求最左上格；切换钉住即增删该元素。
- `src/components/Rail/ReadingRail.tsx`：删除「阅读空间」可见标题，首个布局按钮加 `ml-auto` 保持右对齐（左区留空正好避开红黄绿灯）。
- 新视觉数值按 AGENTS.md 设计约定追加到 `docs/design/system/decisions.md`（append-only）：实测三枚 14px 按钮、间距 9px、左起 9px → 簇右缘 69px，保留区取 78px。

## 平台边界（重要，如实记录）

- e2e 在 Chromium 中运行，**没有原生红黄绿灯**；`window-controls-reserve` 是原生按钮占位的等价物，断言的是**布局几何**（避让宽度与复位偏差），而非原生按钮像素位置。原生按钮由 macOS 绘制。
- 因此本票的「按钮落点」在真实窗口中的最终观感需在 `npm run tauri dev` 下人工确认一次（本会话无法做交互式 GUI 验收）。几何前提已由 e2e 锁死：未钉住 78px 避让、钉住归零复位。

## 回归（亲测）

- `npx playwright test e2e/immersive-chrome e2e/auto-layout --workers=1`：8 passed（含 2 条新用例）
- `npx playwright test e2e/chrome-colors e2e/tab-selection --workers=1`：4 passed
- `npx vitest run`：124 文件 / 1532 用例
- `npx tsc --noEmit` / css-manifest / eslint（0 error）/ `cargo check`（30 条存量 warning）通过
- `tauri.conf.json` JSON 校验通过（titleBarStyle=Overlay, hiddenTitle=true）

## 过程记录

首次委派失败：子代理只加了 `// TEMP-PROBE` 调试副作用（每次挂载写 `/tmp/biaoyue-probe.txt`）且功能零实现。已打回重做，重做版本 TEMP-PROBE 已删除、无任何调试残留（`grep TEMP-PROBE|/tmp/ src/` 为空）。
