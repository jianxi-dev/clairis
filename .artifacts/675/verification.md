# #675 轮盘历史剪切与颜色透明项可辨识 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 10.1）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-10.1a | 打开历史分组：剪切按钮索引严格等于 2（复制之后、前进之前） | PASS（e2e：序列 [undo, copy, **cut**, redo, delete]，indexOf(history-cut) === 2） |
| A-10.1b | 颜色二级透明项有可见棋盘格/描边、文字可读 | PASS（SVG pattern 双格棋盘 + `--app-border-strong` 实线描边；标签 text-3→text-2；e2e 断言 fill 含 sr-checker + 计算色相等；cw-vision 复核网格纹理可见） |
| A-10.1c | 关闭后无残留节点 | PASS（Esc 后 `.selection-roulette` 计数 0） |
| e2e | 扩展 `e2e/roulette-regression-566.spec.ts` | PASS（+4 用例：序列/剪切执行/棋盘格/关闭无残留） |

## 实现要点

- 历史组现状序列 [undo, copy, redo, delete] → 在 copy 与 redo 之间插入 `history-cut`（索引 2）。
- 剪切动作 = `navigator.clipboard.writeText(selectionText)` + `view.dispatch` 删除选区（复用既有复制/删除的通道，无新命令注册）。
- 新图标 `scissors`（IconName + ICONS 表 + 中文 label）。
- 透明项：`svg > defs > pattern#sr-checker`（6×6，bg=--app-surface，cell=--app-border），`.sr-sec.sr-color.bare` 由 `fill: transparent + 虚线` 改为 `fill: url(#sr-checker) + 实线描边`；`.sr-color-A.none` 颜色 text-3 → text-2。

## 回归（亲测）

- `npx playwright test e2e/roulette-`：32 passed / 3 skipped（含 4 条新用例）
- `npx playwright test e2e/floating-toolbar e2e/selection-pill e2e/tooltip-pill`：28 passed
- `npx vitest run`：123 文件 / 1526 用例
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
- Rust 未改动（数据面：规格,消费）
