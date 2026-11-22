---
title: "layout-lists"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 源码级逆向分析：分栏布局 + 列表嵌套

> 分析对象：`/Users/mason/ToHighs/quiet-md-main`（MIT，Rust + GPUI，crates/core 无 GUI 可单测）
> 对照项目：`/Users/mason/ToHighs/clairis`（Tauri 2 + React 18 + CM6 + Zustand）
> 本文所有行号均来自 2026-02 时点的源码，路径相对各自仓库根。

---

## 0. 总纲：Quiet 的两个架构前提（决定了后面所有行为）

1. **文档 = 内存中的块树，编辑引擎操作树而非文本**。
   `crates/core/src/model.rs:852-881` 定义 `Block { id: BlockId, kind: BlockKind, text: RichText, children: Vec<Block>, ... }`；
   `crates/core/src/editor/core.rs:20-45` 定义位置为 `Pos { block: BlockId, offset: usize }`（UTF-8 字节偏移），选区为 `Selection { anchor: Pos, head: Pos }`。
   **关键推论**：分栏、列表嵌套都不是"文本约定"而是**一等树结构**。光标/选区用 `BlockId` 寻址，结构变化（拖拽、缩进、跨容器合并）后只更新树，`BlockId` 不变，选区天然不会漂移。

2. **所有结构性编辑收敛到 Core，view 只翻译事件**。
   `docs/ARCHITECTURE.md` 明文："Core owns all structural edits"。分栏增删、列表缩进、Enter/Backspace 的结构后果全部在 `crates/core/src/editor/core.rs`（约 4285 行，无 GUI 依赖，`cargo test -p fdl_core` 可测），另有 **随机编辑 fuzzer**（`crates/core/src/editor/fuzz_tests.rs`）在每次随机编辑后校验不变量，其中两条直接约束分栏与嵌套：
   - `fuzz_tests.rs:465-470`：`Column` 只允许出现在 `Grid` 直接子级，反之 `Grid` 的孩子只能是 `Column`；且 grid/column 不允许为空（空 column 会被塞入空段落，见下）。
   - `fuzz_tests.rs:521`：选区两端必须都在同一 scope（表格 cell 或 body）内的可见 caret stop 上——防"选区消失/错位"。

---

## 1. 分栏（Grid / Column）的实现

### 1.1 数据结构：分栏是容器块，不是 BlockKind 变体魔法

`crates/core/src/model.rs:724-768`：

```rust
pub enum BlockKind {
    ...
    Grid,                          // :753 分栏容器
    Column { ratio: f32 },         // :755 一栏，ratio = 宽度占比（0..1）
    ...
}
```

- `model.rs:790-794` `is_container()`：`Quote | Callout | Grid | Column` 都算容器，children 渲染在容器内部。
- **栏内可以嵌什么块？** 任何块。`units()`（`core.rs:233-263`）遍历时对 `is_container()` 的块只递归 children（`:256-258`），不产生自己的 unit——即 Grid/Column 本身不可选中、无光标，光标永远落在栏内某个文本块上。栏内放标题、列表、代码块、图片、表格，甚至再嵌一个 Grid，模型上都不需要特判。
- 序列化（DocxXML round-trip）：`crates/core/src/docxml.rs:945-961`，`<grid><column width-ratio="0.5">…</column></grid>`；解析在 `docxml.rs:295-300`。

### 1.2 分栏的创建：斜杠菜单

`src/editor/view.rs:1006-1014`（SlashKind::Grid）：

```rust
SlashKind::Grid => {
    let n = size.map_or(2, |s| s.1);          // 默认 2 栏
    let cols: Vec<Block> = (0..n)
        .map(|_| Block::new(BlockKind::Column { ratio: 1. / n as f32 }, ...)
                .with_children(vec![Block::text("")]))   // 每栏预置一个空段落
        .collect();
    let g = Block::new(BlockKind::Grid, ...).with_children(cols);
    let nid = self.core.insert_block(g);
    self.core.ensure_paragraph_after(nid);    // 分栏后面保证有段落可继续输入
    self.core.sel = Selection::caret(Pos::new(first, 0));  // 光标直接落进第一栏
}
```

要点：创建即带一个空段落（**分栏永不为空**，与 fuzzer 不变量一致），创建后光标落第一栏文本块内、不是落在 Grid 上。

### 1.3 栏宽分配与栏间 gap：纯展示层，宽度参数集中在一处

`src/editor/grid.rs:19-22` 三个常量：

```rust
const GAP: f32 = 20.;                  // 栏间视觉缝隙 20px
const HORIZONTAL_MIN: f32 = 578.;      // 容器宽 < 578px 时竖排（flex-col）
const ANIMATION: Duration = 250ms;     // 新增栏后宽度过渡动画
```

渲染（`grid.rs:168-258` `R::grid()`）：

- 每栏 `flex_basis: 0, flex_grow: ratio/sum, flex_shrink: 1`（`:225-229`），宽度由 **flex 分配**，不是硬算像素——容器宽度变化时自动重排，无 JS 重算逻辑。
- 宽度不足 578px 自动降级为竖向堆叠（`:186` `when(!horizontal, flex_col)`），移动窄窗不破版。
- 拖拽中/动画中的"实时宽度"与文档真值分离：`grid_ratios()`（`grid.rs:64-77`）优先返回 `col_drag.live`（拖拽快照），其次返回动画插值，最后才是文档里的 `ratio`。**文档数据在拖拽结束前从不被修改**。

### 1.4 新增栏 / 调宽 / 删栏 / 退出分栏：Core 里的四个入口

**新增栏**（`crates/core/src/editor/core.rs:2247-2275` `add_column` + `grid.rs:96-106` `add_column` UI）：
- 上限 `MAX_COLUMNS: usize = 10`（`core.rs:3315`）；超过直接拒绝。
- 宽度守恒算法（`core.rs:2249-2269`）：新栏取 `m = 1/(n+1)`，由"缩水后仍 ≥ `MIN_COLUMN_RATIO = 1/24`（`core.rs:3316`）"的旧栏按比例均摊，即 `i = m / Σ eligible`，每栏 `ratio *= 1-i`。**永远不会把某栏挤穿最小宽度**。
- 插入前先把所有空栏补一个空段落（`core.rs:2253-2255`），保证不变量。
- UI 上"新增分栏"圆点挂在栏间 gap 上方（`grid.rs:294-330`），hover 才显示（16px 圆点，150ms 缩放动画）；最后一栏的 gap 只有新增没有拖拽（`grid.rs:262` `let last = i+1==n`，`:283` `when(!last, …on_mouse_down)`）。

**拖拽调宽**（`grid.rs:117-152` `col_drag_to` / `end_col_drag`）：
- 只交换相邻两栏宽度：`live[gap] = s+o, live[gap+1] = a-o`，总量不变（`:141-143`）。
- 吸附：距均分 <0.01 吸到均分，距 1/10 整数倍 <0.01 吸到十分位（`:127-133`）。
- 下限：`o = o.max(MIN_COLUMN_RATIO - s).min(a - MIN_COLUMN_RATIO)`（`:134`），任何时刻两栏都不小于 1/24。
- **一次拖拽 = 一个 undo 步**：松手才调 `set_column_ratios`（`core.rs:2278-2291`），内部 `checkpoint(EditKind::Other)`，且值没变就不 checkpoint。

**删栏（最后一栏删掉会怎样？）**——没有显式"删栏"命令，而是**数据不变量 + normalize 收尾**：
- 每次结构性编辑后调用 `normalize()`（`core.rs:838-875`），其中 `core.rs:851-855`：
  ```rust
  if matches!(b.kind, BlockKind::Grid) {
      drop_empty_columns(&mut b.children);
  }
  ```
  `drop_empty_columns`（`core.rs:3318-3333`）：children 全空的 Column 直接移除，剩余栏按原比例归一化（`ratio /= left`）。注释原文："A column goes once its last block does, and the others share its width in proportion."
  即：**用户删掉某栏最后一个块（Backspace/合并/拖走），该栏自动消失，其余栏按比例接管宽度**。删除是隐式的、且必然发生在任何删除路径的收尾处。
- **分栏整体退出**：`normalize()` `core.rs:858-869`——Grid 剩 ≤1 栏时**溶解**：grid 块移除，栏的 children 平铺插回原位置（`list.splice(i..i, content)`）。剩一栏 = 用户"退出分栏"只需把另一栏内容删光，不需要专门命令。
- 空 Quote/Callout 也在 normalize 里删（`core.rs:857`），同类哲学：**容器空了就消失，永远不留空壳**。

**光标跨栏移动**：
- ↑/↓、←/→ 走 `units()` 的全局文档序（`core.rs:233-263`），栏内块在文档序中自然衔接，跨栏移动不需要任何特判（同 scope=None）。
- 点击栏下方空白：`grid.rs:231-241` 每栏底部垫一个 `flex_1` 的透明层，`on_mouse_down → core.focus_column_end(cid)`——`core.rs:2294-2311`：栏尾已有空段落就复用，没有就补一个空段落再落光标（reuse 时不 checkpoint，纯导航零 undo 噪音）。
- 块选择模式（Esc）里 Column 不可选中：`core.rs:2611-2630` `block_sel_horizontal` 明确 "Columns aren't selectable; go to the grid"，←/→ 选择父级时跳过 Column 直取 Grid；`block_order()`（`core.rs:2395-2433`）列表 BlockId 时跳过 `Column`（`:2405`）。

### 1.5 分栏的渲染与光标命中：每个块记录自己的 bounds，命中按几何最近

- **bounds 采集**：渲染时每个块挂一个 `record_bounds(id, map)` canvas 元素（`src/editor/render.rs:203-213`），把自身 `Bounds` 写进 `Editor.block_bounds: HashMap<BlockId, Bounds>`（`view.rs:120`）。分栏每栏也 record（`grid.rs:207`）。
- **点击 → 位置**（`src/editor/view.rs:2373-2411` `pos_at`）：
  1. 先查原子块（图片/表格等非 text unit）bounds 是否包含点击点 → 选中它。
  2. 否则对所有 text unit 的缓存布局跑 `hit_test`（`src/editor/text.rs:1558-1590`）：**候选块按"到点位的 dy、dx 距离"取最近者**——不是先猜父容器再猜子块，而是全局最近块。因为每个块的 bounds 都是渲染时真实记录的，栏 A 的文本永远离栏 A 内的点击点更近，**跨栏命中天然正确，零特判**。
  3. 表格有单独的 cell 归属修正（`view.rs:2391-2405`）。
- **块间缝隙点击插段落**（`src/editor/gap.rs`）：点击（位移 ≤ `SLOP=10px`，`:11`）落在块边缘 `REACH=16px` 内且两侧都是"无自有文本"的块（`one_line()`，`:18-33`，含 Grid）时插入空段落。`Walk::find`（`:51-99`）对 Grid 的处理（`:64-67`）：找到 bounds 包含点击点的栏，**递归进该栏的 children 继续找**——缝隙判定也是按栏内几何递归的。
- **跨栏选区怎么表示？** 就是 `Selection{anchor: Pos, head: Pos}`，两个端点各自是（栏内某块的 id, offset）。渲染选区按 `units()` 文档序逐块 `range_in`（`render.rs:303-305`），每块画出自己那一段。结构上没有"选区不能跨栏"的概念，拖拽跨栏选择、Shift+点击跨栏都直接工作。

### 1.6 分栏上的 undo

- 所有分栏操作（创建、加栏、调宽）都是 `EditKind::Other` = **永不合并的独立 undo 步**（`core.rs:624-641`：coalesce 只对 Typing/Delete/Equation 生效，`kind != EditKind::Other` 是硬条件）。
- undo/redo 是**整文档快照**（`Snapshot{doc: Document, sel: Selection}`，`core.rs:349-359`），上限 500 步 / 256MB（`core.rs:331-335`），恢复时 `fix_selection`（`core.rs:766-785`）把选区钳回有效块。**因此"加栏 → 撤销"恢复的是加栏前的完整树+选区，不存在选区指向已删块的问题。**
- 拖拽调宽只在松手时 checkpoint（`grid.rs:146-152`），拖拽过程零 undo 记录。

---

## 2. 列表嵌套

### 2.1 模型：列表项是块，children 即嵌套层

- `model.rs:795-802`：
  ```rust
  pub fn nests(&self) -> bool  // Text | Heading | Bullet | Ordered | Todo——可持有缩进子块
  pub fn is_list(&self) -> bool // Bullet | Ordered | Todo
  ```
- **嵌套 = 子块挂父块 children**，没有缩进字符串、没有 depth 字段。深度就是树深。`Ordered { seq: Option<u32> }`：`None` = 自动编号，`Some(n)` = 用户显式指定起始号。
- 渲染深度：`src/editor/render.rs:85-89` `flattens()`——nests 类块的非折叠 children 拆成独立行；`render.rs:660-665` `children_of()`：子层容器 `padding-left: list.indent`（CSS 变量），`Env.depth + 1` 传入。
- 项目符号样式随深度轮换（`render.rs:686-693`）：`depth % 3` → 实心圆 / 空心圆 / 小方块；有序标记 `ordered_marker(n, depth)`（`core.rs:3425-3431`）：`depth % 3` → `1.` / `a.` / `i.`（罗马）。**样式轮换是从树深推导的，用户永远不用手写。**

### 2.2 缩进 / 反缩进（Tab / Shift-Tab）：树操作 + 严格守卫

`src/editor/keymap.rs:136-137` 绑定；`src/editor/view.rs:1825-1874` `on_tab`/`on_shift_tab`（代码块内 Tab 退化为插 4 空格 / 删前导空格；表格内走 `cell_step` 移动 cell；其余进 Core）。

**Tab**（`core.rs:1625-1685`）：
- `selected_blocks()`（`core.rs:1610-1623`）取选区覆盖的"最顶层"块（去掉被祖先覆盖的），批量缩进。
- `can_indent`（`core.rs:1637-1650`）三个守卫：① 不是第一个兄弟；② 前一个兄弟 `nests()`；③ **不是 Column**（`!matches!(me.kind, BlockKind::Column{..})`）且树深 `nest_depth < MAX_NEST_DEPTH = 16`（`core.rs:212`）。
- `indent_one`（`core.rs:1659-1685`）：把块从兄弟序列摘出（连子树），**push 到前一个兄弟的 children 尾部**。这是唯一操作，numbering 无需显式重算（见 2.4）。

**Shift-Tab**（`core.rs:1687-1722` `outdent_one`）：
- 守卫：父必须是 `has_text()` 块、不在表格 cell 里。
- **关键语义**：把块移到父块之后（文档序），**父块中位于它之后的兄弟变成它的 children**（`:1710-1716`：`b.kind.nests()` 时 `b.children.extend(following)`）。
  即反缩进一个深层项时，它原来的"同级尾巴"整体成为它的子列表——这是 outliner 语义，保证 Shift-Tab 永远不产生"断层的树"。
- 批量 outdent 按**文档序倒序**逐个做（`core.rs:1694-1697`），先处理最深的，避免兄弟关系在中途变化。

**Backspace 在列表项行首**（`core.rs:1361-1444`）：非 Text 块 offset 0 先**降级为 Text**（`core.rs:1425-1429`，列表项 ← 段落），再按段落走 outdent/合并路径；缩进段落先 `outdent_one`（`:1434-1436`）；引用内第一段先 lift 出容器（`:1438-1443`）。**列表项的 Backspace 链：缩进→反缩进一层，未缩进→降级段落→再按段落合并**。

### 2.3 Enter 的全部行为（`core.rs:1240-1355`）

- 空列表项 Enter（`core.rs:1284-1292`）：**嵌套则 outdent_one（退一层），顶层则降级为 Text**——"空 Enter 退出列表"的 canonical 实现。
- 空段落且是 quote/callout 最后一个孩子（`core.rs:1294-1309`）：移出容器到容器之后（退出引用）。
- 分裂时新块类型（`core.rs:1310-1317`）：Heading→Text（回车不断标题），Ordered/Todo 保持同类型、`seq: None`/`done: false`；分裂中途的块走 `reset_for_split`（`core.rs:3349-3356`）重置 seq/done。
- 有 children 且未折叠：**新块成为第一个 child**（outliner 语义，`core.rs:1338-1341`）；折叠 heading 的新块插到折叠段之后（`fold_end`，`:1343-1345`）。

### 2.4 有序列表 numbering 的"层级重算"：不存状态，显示时现算

这是 Quiet 列表稳定的核心设计。**文档里只有一个 `seq: Option<u32>`，编号是纯函数**（`core.rs:3362-3378`）：

```rust
pub fn ordered_number(siblings: &[Block], index: usize) -> u32 {
    let mut n = 0; let mut i = index as isize;
    while i >= 0 {
        match siblings[i].kind {
            BlockKind::Ordered { seq } => {
                if let Some(s) = seq { return s.saturating_add(n); }  // 显式起点：起点+距离
                n += 1;                                               // 自动项：累计
            }
            _ => break,   // 非列表兄弟：run 结束
        }
        i -= 1;
    }
    n
}
```

- 编号 = 从当前项向上数到 run 起点；遇到显式 `seq: Some(s)` 返回 `s + 已计数`。
- **作用域 = 兄弟序列**（`core.rs:1724-1731` `ordered_number_options` 用 `siblings_at` 取同层）：不同缩进层各自计数，嵌套互不污染；cell/容器内的列表也天然隔离。
- **缩进/反缩进/拖拽/删除后不需要"重算编号"这个动作**——树变了，下次渲染 `ordered_marker(ordered_number(siblings, idx), depth)` 现算现画（`render.rs:710`）。不存在"编号缓存失效"这类 bug 类别。
- 用户改起始号：`set_ordered_number`（`core.rs:1732-1744`），"继续之前的编号" = `seq: None`（跟随 run），"开始新列表" = `seq: Some(1)`；UI 在 `src/editor/numbering.rs`（点编号本身打开菜单，`render.rs:694-700`）。
- 标题自动编号同理是纯函数：`heading_orders`（`core.rs:3387+`），每个容器（page/callout/column/cell）独立计数。

### 2.5 列表项之间的空块 / 换块 / 合并

- **列表项之间允许普通段落**：`ordered_number` 的 run 在遇到非列表兄弟时断开——列表项后插段落，编号自然重启，不需要"分隔符"概念。
- **合并**（Backspace 行首走 `merge_into_previous`，`core.rs:1450-1531`）：文本 append 到前一个 unit（文档序），当前块连子树移除；**前块若 nests()，子块并入其 children 尾部**（`:1523-1526`），否则 `insert_all_after` 跟在后面前同级位置。收尾必调 `normalize()`。
- 删除跨块选区（`delete_selection_inner`，`core.rs:877-951`）：中段块 `remove_lift` 逐个移除，尾块文本并入首块，尾块的 children 若可被首块持有（`nests()`）则并入，否则跟在后面（`:920-933`）。**子树跟随语义在所有删除路径一致**。

### 2.6 嵌套列表上的 undo

- 打字 coalesce：同块内 <700ms 的 Typing 合并（`core.rs:624-641`）；任何结构操作（缩进/回车建新块/合并）都是 `EditKind::Other` 独立步。
- 因此"Tab 缩进 → Ctrl+Z"精确退回缩进前树 + 选区（快照含 `sel`）。整文档快照策略下，嵌套结构的 undo 不可能部分生效。

---

## 3. Clairis 对应问题诊断与借鉴清单

### 问题 4：分栏——「文字编辑时重复显示」「栏内输入多格式内容后显示格式错乱」

**Clairis 现状**（`src/editors/decorations/columns.ts`，748 行）：
- 模型：分栏只是 **Markdown 围栏 div 约定** `::: {.col-N}`（`columns.ts:14-18`），不是树结构。`parseColumns`（`columns.ts:373-424`）逐行正则解析出 `ColumnBlock { from, to, count, widths, cells }`，`cells` 由 `splitCells`（`columns.ts:356-371`）按**空行**切顶层块。
- 编辑态：整个围栏 div（含 `:::` 标记）被一个 `Decoration.replace({block: true})` 换成 `ColumnsWidget`（`columns.ts:729-735`）。**widget 内不是 CM6 文档**：每栏正文是 `renderBlockDom(cell.text)` 生成的静态 DOM（`columns.ts:625` + `block-dom.ts:33-81`），点击某栏才打开一个**独立的 `<textarea>`**（`openColumnEditor`，`columns.ts:156-354`），Enter/blur 时把 textarea 文本经 `rebuildColumns`（`columns.ts:60-92`）整体重写围栏 div 写回文档。
- 预览态：`src/renderers/markdown.ts:249-310` 把 `::: {.col-N}` 预处理成占位注释再递归 marked，产出 `.layout-col-N`。

#### 4a.「文字编辑时重复显示」逐条诊断

| # | 病因（Clairis 代码位置） | Quiet 的对应做法 |
|---|---|---|
| 1 | **静态正文与就地 textarea 双活**。打开编辑器时靠 `host.replaceChildren()` 摘掉静态文本、Esc/commit 靠 `restoreNodes` 还原（`columns.ts:179-191`）。`columns.ts:183` 注释自证：*"不摘掉静态文本会重复显示同一段文字（A-4.1）"*——说明这类重复已修过一次，但**只要 teardown/commit 的时序被打破（blur 与 decoration 重建竞态、菜单路径 `teardown()` 后 `commit()` 里 `!area.isConnected` 早退，`columns.ts:196-198`），还原的静态节点与新 widget 就同屏**。根源：同一份内容有两个渲染真相源（widget 静态 DOM + CM6 源码），靠手工摘/还同步。 | 分栏内容就是 CM6 文档本身的文本块，**光标直接进文档，不存在第二编辑器**，因此结构上不可能重复显示（`core.rs:2247-2275` 创建栏时光标直接落栏内文本块；`grid.rs:231-241` 点击栏内即正常 CM6 光标）。 |
| 2 | **widget `eq()` 用文本快照判等**（`columns.ts:449-459`：比较 `cells.map(c=>c.text)` 的 JSON）。在栏 textarea 里打字不进 CM6 文档，`eq` 恒真、widget 不重建——但**一旦任何其它路径改了文档**（另一面板同步、任务复选框回写、粘贴、`ContentArea.tsx:737-753` 的「store content → CM 全文重放」effect），`eq` 失败 → 新 widget `toDOM` 重建。若此刻旧 textarea 还开着（焦点在菜单上、未 blur），旧 host 里的 `restoreNodes` 与新 widget 的静态 DOM 是两棵独立子树，**重复显示**。 | 数据只有一个（树），拖拽/动画宽度也只是视图快照（`grid.rs:64-77`），文档真值在拖拽结束前不被触碰；渲染每帧从真值派生，无第二真相源。 |
| 3 | **stale `blockFrom`**：commit 用打开时捕获的 `this.block.from` 找围栏（`columns.ts:205-208`），若文档在编辑期间位移（前面增删行、全文重放），`parseColumns(...).find(b => b.from === blockFrom)` 落空 → **静默 return，用户输入丢弃**（无提示）；若碰巧错位匹配到别的围栏 → 写错块。 | Core 所有结构操作都经 `BlockId` 寻址，id 永不因位移失效；undo/redo 后还有 `fix_selection` 钳位兜底（`core.rs:766-785`）。 |
| 4 | **全文重放放大器**：`ContentArea.tsx:737-753` 的同步 effect 在 `current !== tab.content` 时做 `changes: {from:0, to: current.length, insert: tab.content}` 全文替换。分栏 widget 的 `index` 键（`columns.ts:441` "分栏块序号"）和 `bracketFrom` 等偏移在全文替换后都会变，任何持有旧偏移的 widget/装饰在这一帧都是错位的。 | Quiet 没有"store 重放进编辑器"的回路：编辑器状态即唯一状态，持久化只单向 save。 |

#### 4b.「栏内输入多格式内容后显示格式错乱」逐条诊断

| # | 病因 | Quiet 的对应做法 |
|---|---|---|
| 1 | **栏正文渲染是"逐行 DOM 孪生"，只认标题/列表/行内**。`renderBlockDom`（`block-dom.ts:33-56`）逐行 `renderBlockLine`：headingRegex → 标题；`classifyListLine` → 列表行；其余全是普通行 + `renderCellText` 行内渲染。**代码围栏、表格、callout、图片、数学块在栏内统统按普通文本行输出**——输入多格式内容必然错乱。 | 栏内 children 就是完整的块列表，走与正文**同一条**渲染路径（`grid.rs:206` `self.blocks(&c.children, col_env, cx)`），任何块类型无需栏内特判。 |
| 2 | **`splitCells` 按空行切"顶层块"**（`columns.ts:356-371` 正则 `\S[^\n]*(?:\n(?!\s*\n)[^\n]*)*`）。多行结构（表格、代码块内部的空行、块间空行）会被切成多个"cell"，与栏数错位后 `padded` 重排（`columns.ts:77-81`）——**内容跨栏串位**。且 `rebuildColumns` 对嵌套围栏直接返回 null 拒绝（`columns.ts:70-73`），嵌套 `:::` 静默失效。 | 模型上栏的 children 是显式块列表，"哪一块属于哪栏"由树结构回答，不需要文本启发式。 |
| 3 | **textarea 是纯文本**：栏内"输入多格式"只能得到一段纯文本，写回后由上述孪生渲染再退化一层。格式在 栏编辑器↔文档 两处各降级一次。 | 不存在栏内第二编辑器；块类型转换走 Core 的 `turn_into`/slash 菜单，RichText runs 保持不丢。 |
| 4 | **编辑态与预览态是两套实现**（columns.ts 的 DOM 孪生 vs markdown.ts 的 marked 递归），`block-dom.ts:10-19` 注释自认这是"DOM 孪生"防漂移方案——但只孪生了 heading/list/inline 三种，其余必然漂移。 | 编辑态渲染与数据同源（树），预览导出走同一条 Markdown 序列化（`docxml.rs` ↔ `markdown.rs`），单一真相源。 |

#### 4c. 可落地修复建议（按性价比排序）

1. **（止血）给 `openColumnEditor` 的 commit 加 stale 防护**：`blockFrom` 改为打开时同时记录围栏首行内容（或 `cols:` 属性串），commit 时按内容匹配而非纯偏移；匹配失败时把 textarea 文本回填到 host 并 toast，而不是静默丢弃（对照 `columns.ts:205-208`）。
2. **（止血）widget 打开编辑器期间冻结重建**：利用 `index.ts` 已有的 `frozen` 机制（`index.ts:269-276` 只跳过纯选区事务）扩展为"存在 `.cm-column-editor` 时对涉及分栏范围的文档事务也冻结装饰重建"，消灭 4a-2 的双活窗口。
3. **（结构修复，建议立项）把分栏从"围栏 div + replace widget + textarea"升级为"块树 + 真实 CM6 块"**：参照 Quiet 的最小可行形态——
   - 文档模型加 `ColumnBlock { ratio, children }` 容器（对齐 Quiet `model.rs:753-755`）；
   - CM6 里分栏范围**不再整体 replace**，而是每个栏内容是普通可编辑 CM6 区间，仅两侧 `:::` 标记由 widget 装饰、栏的视觉分组由块 widget（`WidgetType` block + CSS flex）包裹实现；
   - 光标命中回归 CM6 自带的 posAtCoords，无需自研 textarea。这同时消灭 4a 全部四条与 4b-1/2/4。
   - 若暂不做树模型，次优解是把 `renderBlockDom` 的"逐行孪生"升级为**直接调用预览渲染器**（`src/renderers/markdown.ts` 的 marked 管道）渲染栏 cell，让栏内支持全部块类型，消灭 4b-1。
4. **空栏表示**：学习 Quiet 的"栏永不为空"不变量（创建即预置空段落、normalize 兜底），Clairis 的 `missingCell` 占位（`columns.ts:105-109`）可以保留，但空栏的源码表示要固定下来，避免 `splitCells` 把空栏当不存在（`columns.ts:36-49` 注释已记录此坑）。
5. **删栏/退出语义显式化**：Quiet 用"空栏自动溶解 + Grid≤1 栏溶解"（`core.rs:851-869`）达成"删光即删栏、删到一栏即退分栏"，无需 UI 命令。Clairis 若做树模型，直接照抄该 normalize 规则即可（两条 + 比例归一，实现 <30 行）。

### 问题 10：嵌套列表经常出问题

**Clairis 现状**：列表嵌套是**逐行正则分类 + CSS 缩进类**，没有结构：
- `src/editors/decorations/list.ts:66-99` `classifyListLine`：`depth = Math.min(3, Math.floor(indentLen / 2))`（`:81`）——**两空格一层、封顶 3 层**；4 层以上全部按 depth-3 渲染。
- 缩进判定依赖"前缀后的行首空白"（`:80`），**只看该行自己**：列表项的续行（lazy continuation，如多段落列表项的第二段）、跨行内容（代码块内）虽有 fence 排除（`list.ts:135-140`），但**表格单元格、引用深层、缩进不规范的行**都会错层。
- Tab/Shift-Tab 走 CM6 默认 `indentWithTab`（`src/editors/setup.ts:98`）→ `indentMore/indentLess` 按 syntax 缩进单元插空格，**与 `classifyListLine` 的"两空格一层"没有一致性保证**——用户用 Tab 得到 4 空格（或 1 个 tab），`indentLen/2` 立即算错层。
- `smart-input.ts:237-318` `smartEnter`：续写用**当前行**的 indent 原样复制、有序标记 +1——续写永远继承当前层，没有"新项比父项更深/更浅"的概念；空项退出（`:260-267, :276-283`）是删行，**不区分"退出嵌套层"与"退出列表"**（Quiet 在 `core.rs:1284-1292` 明确分这两支：嵌套项退一层，顶层项降级段落）。
- 有序编号：Clairis 的 ordered 标记是**源码字面量**（`list.ts:192-197` "永不替换"），`smartEnter` 续写时 `parseInt(marker)+1`——但**缩进重排后源码里的 `3.` 不会重算**（嵌套错层后编号全乱），也没有 Quiet 那种"seq 显式起点 + run 内自动计数"的语义。
- 预览态由 marked 按 CommonMark 解析，**与编辑态的 2 空格/层规则不一致**（CommonMark 需要 2-4 空格且与父标记宽度对齐）——编辑态显示 3 层、预览可能变 1 层，"编辑时好好的预览就乱"是典型症状。

#### 10a/10b 对照诊断（Quiet 做法 → Clairis 病因 → 建议）

1. **嵌套 = 树 vs 嵌套 = 缩进字符串**
   (a) Quiet：`nests()` 块的 children 即子列表（`model.rs:795-798`），深度是树深，样式轮换/编号作用域全部从树推导。
   (b) Clairis：`indentLen/2` 封顶 3 层（`list.ts:81`）；Tab 宽度不统一时整层错乱。
   (c) 建议（短期）：① Tab 处理改成列表感知——在列表行上 Tab 插入"与当前层语法一致的缩进量"（读当前行 marker 宽度 + 配置的 2 空格约定），Shift-Tab 删除一层；把 `indentWithTab` 从 markdown edit 模式的通用 keymap 里排除（`setup.ts:98` 加 per-language 条件）。② `smartEnter` 空项退出改为三态：有缩进 → 删一层缩进（同层续写）、顶层 → 删标记降级段落（对齐 Quiet `core.rs:1284-1292`）。③ `depth` 上限 3 至少提到 6 并让 CSS 类按数字生成（`list.ts:110-117` 的三元链改查表）。

2. **编号不重算 vs 编号纯函数**
   (a) Quiet：`ordered_number(siblings, index)` 渲染时从兄弟序列现算（`core.rs:3362-3378`），缩进/拖拽/删除零重算代码；显式 seq 仅作 run 起点。
   (b) Clairis：编号是源码字面量，续写 +1、重排后不重算（`smart-input.ts:274-296`）。
   (c) 建议：编辑态把 ordered 标记改为**计算型 widget**（像 task checkbox 那样 `Decoration.replace`）：按 `classifyListLine` 的 depth 把连续同层 ordered run 分组，widget 显示现算编号；**落盘时仍写规范字面量**（装饰消失/导出时由规范化 pass 重写字面量，或干脆落盘时保留用户原始字面量、仅显示层计算）。这样"缩进后编号自动对"无需改模型。

3. **列表项回车/合并的结构后果**
   (a) Quiet：Enter 分裂保持类型、新项成为首个 child（outliner）、Backspace 行首的 降级→反缩进→合并 链（`core.rs:1240-1355, 1361-1444`）；merge 时子树跟随 nests() 前块（`core.rs:1523-1526`）。
   (b) Clairis：`smartEnter` 只处理"行尾续写"，行中回车交给默认行为；没有"子树跟随"概念，多行列表项（续行内容）在回车/删除时被按普通行切断。
   (c) 建议：`smartEnter` 覆盖"光标在 marker 之后、行中间"的场景（分裂行为对齐 Quiet：后半保持同类型、去掉缩进继承歧义）；至少先把"列表行 + 后续行同属一项"的块模型引入 `block-model.ts`（现有 `getBlocks` 已有空块概念，可加 `continues` 标记），让活跃块判定（`index.ts:149-157`）不再把续行当独立块。

4. **编辑态/预览态一致性**
   (a) Quiet：编辑态与导出预览共享同一模型与序列化，不存在两套解析。
   (b) Clairis：编辑态 2 空格/层 vs 预览 marked 按 CommonMark——缩进语义不一致是"嵌套列表经常出问题"的观感放大器。
   (c) 建议：统一缩进约定——把编辑态的"一层"定义为 CommonMark 兼容的缩进（列表项内续行缩进 = marker 宽度或其倍数），并在 `markdownRender.test.ts` 增加固定用例：2/4/6/8 空格 + tab 混用下编辑态深度类与预览 `<ul>` 嵌套层数断言相等。

5. **undo**
   (a) Quiet：整文档快照 + 结构操作永不 coalesce（`core.rs:624-641`），任何嵌套操作 undo 一步还原树+选区。
   (b) Clairis：CM6 history 是文本粒度；`smartEnter` 的一次 dispatch（删行/插行）天然是 undo 单元问题不大，但 `ContentArea.tsx:725-735` 已知切页签要清 history（#321 注释），分栏下两个面板共享 `tab.content` 时（同文件两 tab）各自 history 独立——风险主要是"全文重放用 `addToHistory.of(false)`"导致的**重放后 undo 边界丢失**（重放前的编辑无法一步撤销到重放前）。
   (c) 建议：全文重放路径改用 CM6 `changeFilter`/精简 diff（最小 changes 而非 0..end 替换），或将重放限制在"内容确实来自外部"时；若做 4c-3 的树模型，可像 Quiet 一样在装饰层之上自建整文档快照 undo（对齐 `core.rs:349-359`），一次性解决结构 undo 粒度。

---

## 4. 一句话总结

Quiet 分栏与嵌套列表稳定的根本原因不是 UI 做得好，而是**它们在模型层就是结构（树），编辑层只有一套真相源**：位置用 BlockId 寻址（结构变化不漂移）、编号是渲染期纯函数（无重算失效）、容器空了 normalize 自动溶解（无空壳态）、整文档快照 undo（无部分撤销）。Clairis 的分栏/列表目前是"文本约定 + 装饰近似"，两套渲染真相源（widget DOM 孪生 + CM6 源码；编辑态正则 + 预览 marked）是全部四类症状的共同根源；短期可在现有架构内堵漏（stale 防护、冻结重建、Tab 列表感知、编号 widget 化），根治路线是把分栏与嵌套升级为块树模型——Quiet 的 `crates/core` 恰好是一个无 GUI、可单测 + fuzzer 的参考实现。
