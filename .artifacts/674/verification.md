# #674 轮盘动作搜索与固定快捷键列 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 3.1，delta: 轮盘召唤与动作搜索 A-3.1–A-3.5）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-3.1 | 搜索结果 ≤9 行可见、首行默认选中、不含层级名、无重复 | PASS（e2e：「一级」1 行 hot；「高亮」13 行 id 去重断言；`.sr-filter-group` 计数 0） |
| A-3.2 | 每行右侧快捷键：首行「回车」、其后 ⌘2…⌘9 | PASS（DOM 实测 ["回车","⌘2","⌘3","⌘4","⌘5","⌘6"]；data-shortcut=2 存在且文本含 2） |
| A-3.3 | 滚动后快捷键列横向坐标不变 | PASS（scrollTop 拉到底后 x 不变；scrollWidth ≤ clientWidth；切换查询后单行 x 与滚动前一致） |
| A-3.4 | ⌘/Ctrl+2~9 执行对应行 | PASS（⌘2 执行第二行：文档写出「## 第一段正文」且轮盘关闭） |
| A-3.5 | 关闭搜索后轮盘回原态、无残留 | PASS（Esc：面板 hidden、行清零、轮盘仍在且 data-form=disk、扇区可见） |

## 实现要点

- `matchCommandsIn`：加 `seen` Set（item.id 去重，跨分组不重复）。
- 行渲染：移除 `sr-filter-group` 层级名 span，只留 icon + label + 快捷键列；`data-action`=item.id。
- 快捷键列：`.sr-filter-shortcut` flex 固定右缘（min-width 3.5em + tabular-nums），列表 `max-height: 9×26px`、`overflow-x: hidden` + `scrollbar-gutter: stable` —— 横向坐标由布局保证。
- 执行：Meta/Ctrl+2~9 在搜索打开态直接 `runLeaf(matches[n-1].item)`；首行 Enter 走输入框既有处理。
- closeFilter：清 matches/hot/列表 DOM/输入值，轮盘形态不变。

## 回归（亲测）

- `npx playwright test e2e/roulette-`：28 passed / 3 skipped（含 4 条新 roulette-search 用例）
- `npx playwright test e2e/floating-toolbar e2e/selection-pill e2e/tooltip-pill`：28 passed
- `npx vitest run`：123 文件 / 1526 用例
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
- Rust 未改动（数据面：无）
