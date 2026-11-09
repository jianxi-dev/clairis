# Design: 选区轮盘工具条重制（selection-roulette v2）

> 批准设计：`docs/design/approved/selection-roulette/README.md`（canonical，2026-11-09 第七至第九轮）。
> 本文件只登记**实现决策**，不复制批准稿数值；数值以批准稿 §4/§6 与原型
> `docs/design/approved/selection-roulette/prototype.html` 的常量为准。
> 视觉锚点：`design-system:§2.1;§4;§5;§6` + `ledger:选区轮盘`。

## R-D1 渲染形态：SVG 扇形，不再用圆钮

- `roulette-view.ts` 改为单张 420×420 SVG：根环、二层、三层、颜色带都是 `path` 扇形（`sectorPathAt(rIn, rOut, a0, a1)`）。
- 图标与两字标签是叠在 SVG 之上的绝对定位节点（根环半径 60px；二三层取 `(rIn + rOut) / 2`）。
- 圆心是独立 `button`（格式刷 / `‹` 返回），不参与 SVG 命中。
- 纯几何进 `roulette.ts`：常量、`polar`、`fanAngles`、`ringAngles`、`sectorPath`、`clampBoxCenter`、`angleOfPoint`。
- 不再保留圆钮 `.sr-sector` 布局；`data-testid="sector-<id>"` 落在 SVG `path` 上。

## R-D2 几何常量（原型 1310–1315 行）

| 名称 | 值 |
|---|---|
| 画布 | 420 × 420，中心 210,210 |
| 根环 | 30 – 86，扇区 45°，缝隙 0.35° |
| 根环标签/图标 | 半径 60 |
| 二层 | 92 – 122，每格 15°，缝隙 0.35° |
| 三层 | 126 – 152，每格 15°，中心 = 被点击二层区块的中心角 |
| 颜色内圈 | 90 – 106，文字色 9 段 |
| 颜色外圈 | 111 – 127，背景色 16 段 |
| 圆心半径 | 31（`--radius-full`） |

## R-D3 层级状态机

- 状态：`root` → `fan`（某根扇区展开）→ `third`（某二层分组展开）。
- `third` **不替换**二层：二层保留并降到 0.7，三层画在 126–152，中心取该二层区块中心角；圆心变 `‹`。
- 点同一根扇区收回；`Esc` 依次 筛选 → 三层 → 二层 → 关闭；离开整只轮盘 400ms 收回下级。
- 「清格」是直接动作，点根扇区立即执行并关闭。

## R-D4 颜色双圈

- 内圈 9 段（默认 + 8 色）：段内画平切于圆的字母 A（随段角旋转；浅色自动深色字；默认段加斜杠 A/）。
- 外圈 16 段（无 + 15 色）：只画色条，无色卡。
- 点击立即套用，轮盘保持展开，可连续设文字色与背景色。
- 取消独立色板浮层；颜色只走双圈。

## R-D5 出现时机与锚点

- `mousedown` / `pointerdown` 立即取消待开计时；按住期间 `selectionchange` 不排期。
- `pointerup` / `mouseup` 后 90ms 出现；使用最近一次指针落点（`pointerup` 的 clientX/Y）。
- 键盘选区无指针落点：取 `coordsAtPos(selection.main.head)` 的矩形末端。
- 圆心不做死区；`clampBoxCenter` 把整轮夹进视口（8px 安全边）。
- 选区塌陷或焦点离开编辑器：收起。

## R-D6 命令映射

- 行内格式复用 `toolbar-shared` 的 `toggleWrap` / `toggleRangeSpan`。
- 转换复用 `block-convert.ts`；高亮落 `> [!kind]`，五类与 `calout-types` 对齐。
- 分栏 `::: {.col-N}`；缩进 `::: {.indent-N}`（0–4）。
- 复制：`navigator.clipboard.writeText`，失败回退 `document.execCommand("copy")`。
- 清除格式：只解包与选区相交的节点，保留链接；一次 `dispatch`。
- 后退/前进：CM `undo` / `redo`，与 `Mod-z` / `Mod-Shift-z` 同一历史。
- 格式刷：读取 `{bold, italic, underline, strike, code, color, bg}`，新选区自动幂等套用并计数；刷完仍展开。

## R-D7 HTML 两态分工

- **源码编辑态（CM6）**：使用横向文字工具条（`.cm-floating-toolbar`），不挂轮盘。横条沿用既有 12 项口径的文字格式子集：AI 改写/翻译/润色 + 加粗/斜体/下划线/删除线/行内代码/链接/对齐/字色/清除格式。
- **可视化编辑态**：保持现有 `.html-edit-toolbar` 横向条，按节点类型分化（E-19/E-22）；不引入轮盘。
- 挂载点：`ContentArea.createLanguageExtension` 对 `markdown` 挂轮盘、对 `html`/代码类挂横条；`setup.ts` 的公共装配不再无条件挂轮盘。
- `floatingToolbar()` 保留为兼容导出，内部按 `toolbarStyle` 参数分派 `roulette` / `bar`。

## R-D8 HTML 拖拽修复

- 越过 4px 阈值后：
  1. 为被拖元素建一个 `position: fixed` 的克隆幽灵，跟随指针（`pointer-events: none`，opacity 0.9）；
  2. 原元素加 `.cm-drag-source`（opacity 0.4）；
  3. 落点候选用 `elementFromPoint`，并加 6px 滞回：只有指针越过目标中线 ±6px 才切换 before/after；
  4. 指示线只在候选变化时改写位置，避免每帧抖动。
- `mouseup` 后移除幽灵与类名，发 `moveNode`；清理必须幂等（重复 up 不重复提交）。
- 截图模式与文本编辑态不进入拖拽。

## R-D9 可访问性与测试

- 轮盘 `role="menu"`，扇区/格 `role="menuitem"` + 中文 `aria-label`；焦点不进入轮盘。
- 单测：`src/__tests__/editor/roulette.test.ts` 覆盖扇区角度、扇形 path 边界、夹取、层级不透明度、颜色环分段。
- e2e：`selection-roulette.spec.ts` 覆盖出现时机、8 扇区、三层外环、颜色双圈、命令写入；`html-source-roulette.spec.ts` 反转为「横条在、轮盘不在」；`html-edit-drag-capture.spec.ts` 覆盖幽灵跟随与稳定落点。
