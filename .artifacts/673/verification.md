# #673 栏目更多操作菜单按窗口边界翻转 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 11.1，A-11.1–A-11.3）

| 锚点 | 断言 | 实测几何 |
|---|---|---|
| A-11.1 | 收窄视口后菜单完整可见，右缘越出 0px | 700 宽：菜单 [560..692]，右缘 692 ≤ 700；top 30.5、bottom 280.5 均在视口内 |
| A-11.2 | 缩放窗口后仍不越界 | resize 640：重算后 [500..632]，右缘 632 ≤ 640 |
| A-11.3 | 关闭后无残留浮层 | Esc 后 `[data-testid="pane-menu"]` 计数 0 |
| 不误翻转 | 宽视口正常展开 | 1400 宽：[1260..1392]，右缘 1392 ≤ 1400 |

## 实现要点

- `PaneTreeView.tsx` 新增 `measureMenu()`：以菜单容器（`.relative`）为定位基准，**水平轴**中心对齐按钮后夹进 `[8, vw-8-menuW]`；**垂直轴**默认按钮下方 4px，下方放不下则翻到上方 4px，再夹进 `[8, vh-8-menuH]`。两轴独立判定。
- `useLayoutEffect`（打开即测量，避免首帧闪烁）+ `window resize` 监听（rAF 节流、关闭即移除监听与 rAF）。
- 菜单容器由「`absolute top-full mt-1 left:50% translateX(-50%)`」改为「测量结果直写 left/top、`transform:none`」，未测量前保留旧居中样式兜底。

## 回归（亲测）

- `npx playwright test e2e/tab-context-menu e2e/menu-anchor --workers=1`：9 passed / 1 skipped（含新用例）
- `npx vitest run`：124 文件 / 1532 用例
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
- Rust 未改动（数据面：无）
- 无调试残留（`grep TEMP-PROBE|/tmp/|console.log` 于 diff 中为空）
