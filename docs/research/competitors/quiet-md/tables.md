---
title: "tables"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 表格系统逆向分析报告（表格域完整拆解）

> 对象：`/Users/mason/ToHighs/quiet-md-main`（MIT，Rust + GPUI）。分析时间基于当前源码快照。
> 目的：为 Clairis（Tauri 2 + CM6 + Zustand）的表格能力升级提供实现级参考。
> 所有行号均来自真实源码，可直接定位。

---

## 0. 总览：Quiet 有两套完全独立的表格

| | 富文本表格（本文重点） | 数据表（DataTable） |
|---|---|---|
| 块类型 | `BlockKind::Table(Table)` — `crates/core/src/model.rs:752` | `BlockKind::DataTable(TableRef)` — `crates/core/src/model.rs:767`（"a view onto a `.sqlite` file"） |
| 存储 | 文档树内嵌（DocxXML `<table>`） | 独立 `.sqlite` 文件，块内只存 `src`/`width`/`height`/视图状态 |
| 编辑引擎 | `crates/core/src/editor/table_ops.rs`（527 行）+ `model.rs` 内 Table 方法 | `crates/core/src/table/`（model/ops/field/formula/query/calc/csv/sqlite，另 1600+ 行，含公式解析器） |
| UI | `src/editor/table.rs`（818 行） | `src/editor/datatable.rs`（198 行）+ `src/table/`（grid/cell/fields/record/menus/panels） |
| 形态 | 页面内渲染的表格块 | 页面内窄视图 + 全屏展开（画板式，`src/editor/datatable.rs:97-110` `open_table`/`close_table`），类似多维表格 |

`src/editor/datatable.rs` 不是"另一种表格块"的重复实现：它是外部数据库文件的嵌入视图，块本身不存数据（`datatable.rs` 头注释："The block only names its file; the view reads and writes it"）。本报告聚焦富文本表格；DataTable 的字段类型/公式系统只作为 Clairis 远期参考。

**分层原则（值得学）**：表格的**结构操作全部在 core**（`table_ops.rs`，无 GPUI 依赖，可单测可 fuzz），`src/editor/table.rs` 只做指针/几何交互，把意图转成 Core 调用。ARCHITECTURE.md 明确"Implement new structural operations in Core and add a corresponding random operation to the fuzzer's `step`"。

---

## 1. 表格数据模型（crates/core/src/model.rs）

### 1.1 结构定义

```rust
// model.rs:399-426
pub struct TableCell {
    pub blocks: Vec<Block>,      // 单元格 = 嵌套块容器，不是纯文本！
    pub bg: Option<ColorName>,   // 背景色（命名色）
    pub valign: Option<String>,  // "middle" / "bottom"（None = top）
    pub colspan: u32,
    pub rowspan: u32,
}

// model.rs:429-441
pub struct Table {
    pub col_widths: Vec<f32>,    // 每列显式宽度，ncols() = col_widths.len()
    pub header_rows: usize,      // 0 或 1（标题行开关）
    pub header_col: bool,        // 标题列开关
    pub rows: Vec<Vec<TableCell>>, // 完整 rows×cols 网格
}
pub const DEFAULT_WIDTH: f32 = 100.;   // model.rs:440
pub const MIN_WIDTH: f32 = 50.;        // model.rs:441
```

### 1.2 merged cell 的表示：covered slot，不是 span 列表

**关键设计**：网格始终保持完整矩形 `Vec<Vec<TableCell>>`。合并后，被遮挡的槽位是 `TableCell::covered()` —— `colspan: 0, rowspan: 0, blocks: []`（`model.rs:419-426`），原格持有 `rowspan/colspan > 1`。判断 `is_covered()` 只查 `colspan == 0`（`model.rs:423`）。DocxXML 序列化时 covered 槽位直接省略（`docxml.rs:1012-1014`，FORMAT.md "DocxXML simply omits them"）。

辅助方法（全部在 `model.rs`）：
- `origin(r, c) -> (or, oc)`（:448）：从 (r,c) 反向扫描找覆盖该槽位的可见格——处理合并格命中。
- `cells()`（:461）：阅读序遍历**可见**格（过滤 covered）。
- `expand(CellRange)`（:621）：把任意槽位矩形**迭代扩张**到"没有合并格跨界"的最小矩形（选择框遇合并格自动包含整格）。
- `cells_in(range)`（:642）：范围内的可见格列表。
- `repair()`（:471）：**不变式修复器**——行补齐到列数、span 裁剪到边界且不得撞上前面格已占的槽、孤儿 covered 槽复活为空格、header_rows 截断。每个结构操作后调用（`table_ops.rs:163` `edit_table` 统一收尾）。fuzzer 不变式："Column proportions sum to one and merged table cells do not overlap"（ARCHITECTURE.md）。
- `take_cells()`/`put_cells()`（:512/:525）：把网格展平成 `(row, col, rowspan, colspan, cell)` 列表再重铺——插入/删除行列的通用底座。

### 1.3 单元格富文本怎么存

cell 内是 `Vec<Block>`，每个 `Block` 有 `RichText`（text + style runs `Vec<Run>`，marks 含 bold/italic/strike/underline/code/color）+ 可选 `children` + `Inline{kind, xml}` 行内对象（公式/文件/按钮/日期提醒/文档引用，各占一个 U+FFFC，`model.rs:58-127`）。所以 **cell 可以装任意块**：段落、标题、列表、引用、代码块、图片、甚至嵌套表格（内存模型允许；粘贴导入时丢弃嵌套表 `paste.rs:724`）。渲染时 `Env { cell: true }`（`src/editor/render.rs:138`）只是降级呈现：字号 14/22、无拖拽把手、无折叠箭头、无空块占位提示（`render.rs:300,347,493,536,614`）。

### 1.4 结构操作的边界行为（合并格 × 行列操作）

这是最容易出错的部分，Quiet 的做法是**纯几何映射**：

- `insert_row(at)`（`model.rs:546-555`）/ `insert_col(at)`（:557-568）：take → 对每个可见格计算新 `(top, end)`，**跨插入边界的合并格 span 加一**（`end = r + rs + (r + rs > at)`），否则列号平移。put 回去。即：合并格骑在新行上时自动变高，不会被切断。
- `delete_rows(range)`（:571-583）：坐标映射 `f(x)`——删除区间内的行号坍缩为 `a`，跨区间合并格**收缩**；起点在区间内的合并格连同内容**移到区间后第一行**（内容跟随）。`delete_cols`（:586-598）对称，并 `col_widths.drain(a..b)`。
- `move_rows/move_cols(range, to)`（:605-615）：纯排列 `reordered()` + `permute()`（:718-727），后 `repair()` 兜底。**约束**：调用方保证合并格不跨界（UI 层 `table_drop_at` 的 checkCanDrop 保证，见 §4）；测试 `moved_rows_keep_merged_cells`（`table_ops.rs:516`）验证：选中一行会自动 `expand` 吞下骑在上面的合并格，移动后合并格保持 `rowspan=2` + covered 完好。
- `merge(r)`（:648-673）：expand → 阅读序把范围内**非空**格的 blocks 追加到左上格（空格丢弃，原格 rebuild），origin 设 `rowspan/colspan`，其余置 covered。
- `unmerge(r, c)`（:675-686）：origin 缩回 1×1，覆盖范围内的 covered 槽位复活为 `TableCell::empty()`，内容留在第一格。

---

## 2. 编辑操作引擎（crates/core/src/editor/table_ops.rs）

### 2.1 选区模型

```rust
// table_ops.rs:8-45
pub enum CellSelKind { Range, Rows, Cols }   // 矩形拖选 / 整行（行条）/ 整列（列条）
pub struct CellSel {
    pub table: BlockId,
    pub anchor: (usize, usize),   // 网格槽位
    pub head: (usize, usize),
    pub kind: CellSelKind,
}
impl CellSel { pub fn raw(&self, t: &Table) -> CellRange } // clamp 到网格，Rows 补满整行宽度，Cols 补满整列高度
```

- `cell_of(id) -> Option<(table, r, c)>`（:90）：从块路径 `Seg::Cell(r,c,k)` 反查所在格——光标定位的核心。
- `cell_range()`（:98）：`t.expand(s.raw(t))` —— **选择框永远包含完整合并格**。
- `merged_selected()`（:128）：选中区恰好是一个合并格时返回它（拆分入口）。
- `select_cells()`（:156）：设置 cell_sel，同时把**caret 收缩进 anchor 格**（`caret_in_cell` :145 → `first_leaf` 首块首偏移）——cell 选区与文本光标并存，键盘继续可用。
- `cell_text_blocks()`（:112）：选区内所有文本块（递归含嵌套），供工具条读格式状态。

### 2.2 操作清单（每个都是一步 undo）

统一骨架 `edit_table(id, f)`（:163-170）：`checkpoint(EditKind::Other)` → 闭包改 Table → `t.repair()`。**任何表格操作 = 恰好一个 undo 快照步**。

| 操作 | 函数（table_ops.rs） | 行为要点 |
|---|---|---|
| 插入行/列 | `table_insert` :218 | `table_insert_at` 后 `cell_sel = None`，caret 落进新行首格/新列首格（:221-223） |
| 删除行/列 | `table_delete_selected` :227 | 仅 Rows/Cols kind 生效；**选中全部行（或列）→ 删除整个表格**：caret 落到表格后继 unit（`units()` 记忆首格下标，:239-245），无后继落到末尾或标题 |
| 合并 | `table_merge` :258 | 选区 <2 格拒绝；合并后选区收缩为左上格 |
| 拆分 | `table_unmerge` :268 | 仅当选区是单个合并格；拆分后**原 span 范围保持选中**（:271-274） |
| 单元格背景 | `table_set_bg` :282 | 批量写选区内每格 `bg` |
| 垂直对齐 | `table_set_valign` :287 | "middle"/"bottom"/None |
| 列对齐 | `table_align_columns` :293 | Markdown 表对齐是列级的：给选中列**所有行**的每个文本块（含嵌套）设 `align`，跨列合并格按 `c <= right && c + colspan > left` 判重叠（:310-314）；无选区时回退到 caret 所在列 |
| 清空选区 | `table_clear_cells` :319 | Backspace/⌘X 触发；每格重置为 `[Block::text("")]`，**选区保持** |
| 列宽 | `table_set_width` :326 | clamp 到 `MIN_WIDTH`(50)，round；**无实际变化返回 false 不入 undo**（:329-331） |
| 均分列宽 | `table_distribute` :335 | 总宽/列数，逐列覆盖 |
| 标题行/列开关 | :342/:346 | `header_rows` 0↔1，`header_col` 布尔 |
| 移动行列 | `table_move_selected(to)` :352 | 仅 Rows/Cols；(a..=b+1).contains(to) 视为原地不动返回 false；移动后**选区跟随**（:362-365）；列移动连 `col_widths` 一起重排 |
| 复制选区 | `selected_cells_content` :372 | 构造子 Table（裁 col_widths、header 仅当含首行/首列）+ `repair()` + `fresh_ids()`——即复制的是**结构化表格块**，不是文本 |
| 粘贴表格矩阵 | `paste_table_matrix` :131 | 粘贴内容恰好是一张表（忽略空段落）且目标在格内/有 cell 选区：从选区左上角起写入，**行列不够自动扩**（:145-148），covered 槽位跳过、背景色复制（:152-158），完成后选中粘贴矩形 |

### 2.3 删除整表的入口

1. 选中所有行或所有列 + 工具条垃圾桶（`overlays.rs:1800-1824`，`table_delete_selected`）。
2. 块把手菜单「删除」（`BlockAct::Delete`，`overlays.rs:1964` `table_block_menu`）。
3. 在格内连续 Backspace：cell 全空 → Backspace 选中**整个表格块**（`core.rs:1463-1486`），下一次 Backspace 删表。

---

## 3. 单元格编辑（光标模型 / 键盘 / 格式）

### 3.1 光标模型

cell 是嵌套块容器，**没有独立的 cell 光标对象**——全局 `Pos { block, offset }`，块 id 全局唯一，路径 `Seg::Child(i)` / `Seg::Cell(r,c,k)`（`core.rs:47,76-79`）。选区不变式（fuzzer 强制）："Both selection endpoints are visible caret stops **in the same scope (one table cell or the body)**"——文本选区不能跨格。

### 3.2 Tab / Shift-Tab：格间移动，越界补行

- 绑定 `keymap.rs:136-137`（`tab`/`shift-tab`），view.rs:1825 `on_tab` → `core.cell_step(true)`（`core.rs:2461-2499`）。
- `cell_step` 顺序 = `t.cells()` 阅读序（含合并格只算 origin）；目标格 caret 放到**末尾**（该格最后一个可见 unit 的末尾，:2483-2491）。
- **最后一格 Tab → 追加一行**：`checkpoint + t.insert_row(n)`，caret 到新行首格（:2477-2481）。Shift-Tab 在第一格：返回 true 但不动（:2483）。
- Tab/Shift-Tab 与缩进共用按键：cell 内 `cell_step` 优先于 `indent`/`outdent`（view.rs:1831/1852）；cell 内普通块**不能 outdent 出格**（`can_outdent` 明确排除 `Seg::Cell`，core.rs:1654-1657；outdent_one 同 :1702-1704）。

### 3.3 ↑/↓ 离格导航

`core.cell_vertical(us, i, down)`（core.rs:2437-2459，view.rs:1403 调用）：
- 下一 unit 仍在本格 → 返回 None（走正常行间移动）。
- 否则目标 = **同列**（`t.origin(r±1, c)`，跨行合并格取 origin 格）中本格下方/上方的第一个光标停靠点。
- 已是首行/末行 → 移到表格**外**前/后的第一个 unit；`Some(None)` = 表后无内容。

### 3.4 Enter / Backspace / Delete

- **Enter**（`core.enter` core.rs:1240）：cell 内文本块正常 split（`insert_after` 沿 `Seg::Cell` 路径索引，落在同一 cell 内成为新段落）。空段退出容器的分支只查 Quote/Callout（:1293-1300），**cell 内空段 Enter 不会退出表格**——离开表格靠 ↓、Tab 到末格补行后的逻辑或点击。
- **Backspace**（core.rs:1458-1487）："Backspace never leaves a cell"。cell 首块为空文本段且后面还有段 → 删该段 caret 给下一段；cell 全空 → 选中整个表格块（连续按住 Backspace 最终删表）。
- **Delete** 不吸入下一格（core.rs:1571-1573）。
- **块级 Backspace 边界**：前一个 unit 是表格的格、当前是表后空段 → 空段消失、表格被选中（core.rs:1489-1495）。

### 3.5 cell 内支持的格式

- **行内 marks**：粗体/斜体/删除线/下划线/行内代码/文字颜色——cell 工具条直接提供（`overlays.rs:1612` `table_toolbar` 的 `mark_btn` 行）。
- **行内对象**：模型层 `Inline{kind,xml}` 支持 公式/文件/按钮/日期提醒/文档引用（`model.rs:64-127`），cell 内文本块与正文同构，所以**格内可插公式和图片类行内对象**。
- **块类型转换**：工具条 TurnInto 下拉（`overlays.rs:1753-1787`）对 cell 内首块可转为 `TURN_ITEMS` 中的类型（段落/标题/列表/引用等；Callout 被跳过）。
- **块级嵌套**：cell 内可放列表（Tab 缩进列表项）、代码块、引用——渲染只是降级呈现，模型无限制。
- **Markdown 文件模式**（`self.markdown`）：工具条宽度裁剪（`overlays.rs:1630`），隐藏背景色/文字颜色/垂直对齐——因为 Markdown 语法表达不了。

---

## 4. 交互细节（src/editor/table.rs）

### 4.1 行列条（bar）与插入 pin

- 行条宽/列条高 = `BAR: f32 = 10.`（table.rs:20），网格用 GPUI grid，第 1 行/列留给 bar（`grid_col_widths` cols_tpl = [BAR, ...widths]，table.rs:500）。
- bar 段点击选整行/列（shift 扩展）；点击**已选中**段进入移动模式（`bar_down` :144-171）。
- 插入 pin：列边界 dot 15×16px（叠加在 T−24..T−8），hover 放大为 22×24 pin（0.2s scale 动画，table.rs:520-527）；行 pin 19×15 → 24×22，hover 时出 2px 蓝色插入指示线（:560-570）。末行/末列提供两个边界点（`ks: &[usize]` 逻辑，:526/:553）。

### 4.2 列宽拖拽

- 热区：**10px 宽**，左边缘 = 列边界 −7px（即右缘越过边界 3px），`cursor: ResizeLeftRight`，hover 显示 2px 主色线（table.rs:731-752）。
- 拖拽中：`Drag::Resize { x0, w0, live }`，live = w0 + dx，min 50（table.rs:177-180）；`table_widths`（:77）把 live 宽注入渲染，`table_override`（:91）用 `live.to_bits()` 做 hash key 强制每帧重新测量行高。
- **释放才入 undo**：`end_table_drag`（:303）→ `table_set_width`（无变化 false 不 checkpoint）→ `changed_preserving_viewport`（viewport/caret/选区保持）。拖拽过程零 undo 步。
- 拖拽期间全页盖一层 occlude + 光标保持（`table_drag_overlay` :331）。

### 4.3 行高

**没有显式行高**。行高 = 内容自然高度 + 单元格 padding（pt 9 / pb 9 / px 10，Feishu 风格 8/8，table.rs:536-540）；垂直对齐用 flex `justify_center/end`（:533-535）。列宽是唯一被存储的几何属性（`col_widths`）。

### 4.4 行列拖拽移动（含合并格约束）

- 启动：bar 上按住已选段，**移动超过 2px 才算拖**（table.rs:186-190），纯点击 = 只选该行/列（`end_table_drag` :312-320）。
- 落点计算 `table_drop_at`（:211-275）：
  - 20px 热区（`hot = px(20.)` :212）吸附到行/列边界；表首/尾 20px 内直接落首/尾。
  - 指针下的格：取该格 origin 所占 span 的首/末边界（:258-263）——跨合并格拖动落点是整格边界。
  - **checkCanDrop**（:268-271）：落点边界若穿过任何合并格（`t.origin(k, e)` 不等于 e）→ 拒绝落点。这保证了 `move_rows/move_cols` 的"合并格不跨界"前置条件。
  - 拖动快照显示「共 N 行/列」标签（`move_snapshot` :355）。
- 页面顶/底 20px 内自动滚动 600px/s（`table_autoscroll` :277-296，动画帧驱动）。

### 4.5 表头吸顶 + 横向滚动

- 吸顶条件：`header_rows > 0` 且首行无跨行合并格（table.rs:505）；`Sticky` 自定义元件把首行钉在视口顶 +26px（`STICKY_TOP` :23），上方铺背景色带遮挡滚过的行（:415-450）。
- 表格超宽：`overflow_x_scroll` + 底部 12px 专用横向滚动条（table.rs:604-620）；裁切边缘画 1px 闭合线 + 10px 黑 5%→0 渐变阴影（:575-602，仿 Feishu）。
- 页级表格可向左右页边距"出血"（`bleed`，行插入 pin 需左侧 26px 余量，:606-608）。

### 4.6 单元格选择与拖选

- **文本拖拽跨格** → 自动转 cell 矩形选择：`cell_drag_to`（table.rs:117-142）——anchor 是按下时所在格，head 是指针当前格（`t.origin` 吸收合并格），拖回首格恢复文本选择。
- **行/列条拖拽**（`Drag::Bars`）沿条扩展 head（:181-192）。
- 选中格盖 8% 选中色叠层（table.rs:545-546）；工具条删除键 hover 时选中格变红（`danger` 标志，table.rs:55, 531-534）。

### 4.7 插入新表的入口

- slash 菜单「表格」（`menus.rs:153`）→ 9×9 尺寸选择器（`overlays.rs:627-686`，标题「插入支持富文本的表格」，实时 "c x r" 读数）。
- 快捷键 ⌘⌥A（`keymap.rs:172` `InsertTable`）。

### 4.8 复制粘贴

- **复制**（`copy_selection` view.rs:1906-1920）：cell_sel 存在 → `selected_cells_content()` 得到结构化子 Table → 文本走 `plain_text()`、**DocxXML 序列化作为 JSON metadata 一起进剪贴板**。**复制为 Markdown**（⌘⇧C 类，view.rs:1924-1932）→ `markdown.rs` 导出。
- **粘贴进表格**：剪贴板 JSON 元数据解析回块 → `core.paste`（core.rs:3098）→ `paste_table_matrix`（§2.2）矩阵式写入。
- **HTML 粘贴进表格/页面**（`paste.rs`）：`table()`（paste.rs:672-749）完整解析 `<table>`：colspan/rowspan（covered 槽补齐 :715-723）、`<col>` 宽度（:636-669，clamp 到 MIN_WIDTH）、thead→header_rows、**嵌套表格丢弃**（:724）。Markdown 管道表：`pipe_table`（:1202-1253），分隔行解析对齐、`header_rows=1`、按首行内容估列宽（:1257）。
- **HTML 粘贴进格**：HTML 表格解析器支持合并格 → 粘贴带 colspan 的 HTML 表进 Clairis 式 markdown 流也能保留结构（在 Quiet 里落到块层）。

### 4.9 表格 → Markdown 导出（merged cell 的命运）

`markdown.rs:708-733` `table()`：
- 逐行直接遍历 `t.rows`（**含 covered 槽位**）→ covered 槽导出为**空字符串**——合并格信息完全丢失（GFM 无合并语法，Quiet 选择"保内容不保结构"）。
- cell 内多块：`inline()` 导出各块后用 **`<br>`** 连接（:711-713）——cell 的"多段落"在 Markdown 里压成一行。
- `|` → `\|`（:713）；列对齐 = 该列各格 `align` 的**众数**（并列取表头的，:719-725——注释说明是"让后加的行不改变列对齐"）。
- 表头行导出 separator（:727-731）。

### 4.10 磁盘格式（DocxXML，docs/FORMAT.md + docxml.rs:999-1040）

`<colgroup><col width="…"/></colgroup>` + thead/tbody；covered 槽位省略；`th/td` 带 `colspan`/`rowspan`/`background-color` 属性（测试 `docxml.rs:1349-1362` 展示完整往返）。cell 内容**单行写**，内容换行编码 `&#10;`（FORMAT.md:84）。已知缺陷：cell 内嵌套块文本的尾随空格/tab 在读回时丢失（FORMAT.md:107，reader 丢弃嵌套块前缩进）。

---

## 5. undo 表现

- **全文档快照式**：每个 `Snapshot` 保存完整 `Document`，VecDeque 500 步 / 256MB 预算（ARCHITECTURE.md §Undo）。表格任何操作不特殊——`edit_table` 的一个 `checkpoint` = 一格 undo；合并 2×2（merge 自身+repair）在测试里就是两步 undo 回原状（`table_ops.rs:443-449`）。
- 拖拽类交互（列宽/移动）**释放时才 checkpoint**，拖拽过程不入栈。
- 每次变更递增 `generation`，渲染缓存/目录/字数据此失效——列宽拖拽每帧 live 值不触发（只在 commit 时）。
- fuzzer 不变式覆盖表格："merged table cells do not overlap"、"Saving and reloading preserves the document"、"Undoing and then redoing every step returns to the same state"（ARCHITECTURE.md）。`table/fuzz_tests.rs` 还为 DataTable 单独 fuzz。

---

## 6. UI 层分工：table.rs / datatable.rs / 菜单

- **`src/editor/table.rs`（818 行）**：富文本表格的渲染 + 全部指针交互（bar/pin/resize/move/sticky/滚动/拖选）。不含任何结构操作——全部转调 `core.table_*`。状态放 `TableUi`（insert pin hover、drag、danger、geo 缓存、sticky、hscroll，table.rs:35-46）。
- **`src/editor/datatable.rs`（198 行）**：数据表块 = `.sqlite` 视图。每块缓存一个 `Entity<TableView>`（:77-103 `sync_tables`）；块宽拖拽（MIN_W 320，双击还原文本列宽，:55-73）；全屏展开/收回（:97-124）；保存/离开前 `commit_tables` 提交未落盘的 cell 编辑（:130-133）。表格数据/公式引擎全在 `crates/core/src/table/`。
- **工具条**（选中格时，`overlays.rs:1612` `table_toolbar`）：合并/拆分（merged 状态切图标）、单元格背景色板（2×8 色 + 恢复默认，:1913-1960）、TurnInto、水平+垂直对齐、B/S/I/U/code、文字颜色、（行/列选时）删除行列。定位：矩形选区上方，首行时挂到列条上方 22px，视口内双向 clamp（:1633-1637）。**选区存在时文本工具条让位**（overlays.rs:1285）。
- **块把手菜单**（`overlays.rs:1964` `table_block_menu`）：缩进子菜单、剪切、复制、删除、**标题行/标题列开关**、**均分列宽**、在下方添加。
- 插入尺寸选择器见 §4.7。

---

## 7. Clairis 对应差距与借鉴清单

### 7.0 Clairis 现状核对（`/Users/mason/ToHighs/clairis/src/`）

表格能力集中在两处：
- **`src/editors/decorations/table.ts`（1725 行）**：GFM 管道表格解析（`TABLE_ROW_RE`/`TABLE_SEP_RE` :52-53，`findTables` :156）→ 渲染为 `<table>` widget（`TableWidget` :776，根 `contenteditable="false"`，**markdown 源码是唯一真相源**）。单元格编辑 = 点击开临时 `<input>`（`openCellEditor` :450，纯文本 + `sanitizeCellText`，IME 处理 :587-596，编辑暂存 per-view dirty map，blur/Enter/Tab/外点时**单事务写回**，绝不在 CM6 update 内派发 :309-316）。
- **`src/editors/decorations/cell-selection.ts`（131 行）**：视图级矩形格选区（anchor/head，行 `-1` 表示表头行），WeakMap 按视图存 + 极小 pub/sub（刻意不派发 CM6 事务），拖拽/shift-click 设置。
- 已有操作：插入行/列（边界圆点 + 气泡按钮「＋插入列/行 －删除列/行」，table.ts:1365-1500，删除拒最后一列/最后一行 :846-880）、Tab 右移格越列换行（table.ts:628-644）、单元格背景（`mdb-bg-*` span 类映射 `<td>` 类，table.ts:250-253）、slash「表格」尺寸选择器（`src/editors/slash.ts:267,986,1066-1076`，标题同样写「插入支持富文本的表格」）、cell 把手插 `/` 菜单（:885-995）。

**没有的**：合并/拆分单元格、列宽拖拽与存储、行列拖拽排序、多块/富文本 cell 内容（input 单行纯文本）、垂直对齐、表头吸顶、表格区域结构化复制、删除整表的专用入口（只能靠块菜单删除行级块）。

### 7.1 逐条差距与落地建议

每条：(a) Quiet 做法 (b) Clairis 现状/差距 (c) CM6 + Markdown 架构下的可落地建议。

**1. 单元格富文本 / 多块内容**
- (a) cell = `Vec<Block>` 任意嵌套块（model.rs:399），渲染降级（无把手/无折叠），Markdown 导出时 `<br>` 连接、多块压一行（markdown.rs:711）。
- (b) `<input>` 单行纯文本；`/` 菜单只能插行内片段（context 插入 table.ts:559-604），无法放列表/代码/多段。
- (c) 把 `<input>` 换成**嵌入式 CM6 实例**或至少 `contenteditable` div：cell 富文本限为「inline marks + 硬换行」层级，序列化为单行 markdown（`<br>` 或行内 HTML），与 Quiet 的导出策略对齐。块级内容（列表/代码块）在 pipe 表里无法无损表示，建议先不支持、UI 禁用（工具条 TurnInto 只开放 inline 能表达的类型）。分两档：inline 富文本（行内 CM6）/ 块级富文本（HTML 表分支）。

**2. 合并/拆分单元格（最大差距）**
- (a) covered-slot 网格 + `repair()` 不变式修复器（model.rs:471）+ `expand` 选择包含整格（:621）+ move/insert/delete 全部走 take/put 纯几何映射（:512-568）；UI 用 checkCanDrop 禁止把行/列拖进合并格中间（table.rs:268）。
- (b) 无。cell-selection.ts 的矩形选择已是合并格的**选区前提**（只差结构层）。
- (c) **merged cell 与 Markdown 双向转换策略建议**——三种候选：
  1. **GFM 超集注释语法**（自造，如 `| a <|` 表示跨列）：不可逆风险高、与生态冲突，不推荐。
  2. **HTML `<table>` 分支**（推荐）：GFM 本就允许内嵌 HTML 表。合并格启用时把整张表序列化为 `<table>`（`<td colspan rowspan>`），Clairis 的 widget 解析器用 `DOMParser` 复用 Quiet `paste.rs:672-749` 同款规则（colspan/rowspan → covered 补齐、`<col>` 宽度、thead）。**单向降级**：导出纯 Markdown（或用户选「转纯 Markdown」）时 unmerge：合并内容按阅读序 `<br>` 连接进左上格、其余格清空——正是 Quiet `markdown.rs:708` 的策略。
  3. **真相源分层**（如果后续做 AST 层）：markdown 源是序列化视图、内存 Table 结构（covered slot 布局照抄 model.rs:399-441）是编辑真相源，CM6 事务重写表格行。代价：与「源码唯一真相源」的现有架构冲突，仅在表格复杂度撑不起源码往返时再考虑。
  实现上先做：结构解析层（pipe + HTML 双格式 → `TableGrid{rows: Cell[][]}`，covered slot 表示合并）→ ops（merge/unmerge 照抄 model.rs:648-686，含 repair）→ 序列化（merge 过的表写 HTML，纯 pipe 表保持 pipe）。

**3. 列宽调整**
- (a) `col_widths: Vec<f32>`（MIN 50px），10px 热区拖拽（border−7..+3），拖拽 live 不入 undo、释放一步 checkpoint，`table_distribute` 均分。
- (b) 无列宽概念；表格 auto 布局，input `size=1` 防 min-content 撑宽（table.ts:474 注释）。
- (c) pipe 表无列宽语法 → 宽度存 HTML 属性：该表落 HTML 分支后用 `<col width>`（照抄 docxml.rs:1002-1006 的表示）；或轻量方案 `<!-- w:120,80,100 -->` 注释行。交互层在 widget 上加 10px 热区拖拽（直接照抄 table.rs:731-752 的几何参数），释放时**一个 CM6 事务**写回（带 `"table-resize"` annotation 便于 undo 合并），拖拽中用 widget 内联样式实时反馈。

**4. 行列移动 / 删除整表**
- (a) bar 上点击已选段进入拖动（2px 阈值区分点击/拖拽——与 AGENTS.md 拖拽阈值条款一致），20px 吸附、checkCanDrop、顶底自动滚 600px/s；选中全部行/列 = 删整表，caret 落后继 unit。
- (b) 只有插入/删除气泡按钮，无移动；删表无专用路径。
- (c) Clairis 已有行/列边界气泡，可加「移动」：拖拽在 widget DOM 层实现（pointer 事件 + 几何计算照抄 table.rs:211-275 的边界/热区算法），落定时**一个事务**重写表格行序。删整表：气泡加「删除表格」或块菜单已有删除块入口确认即可。

**5. Tab / Enter / Backspace 语义**
- (a) Tab 格间移动、末格补行（core.rs:2461-2499）；Enter 格内分段不退出；Backspace 空格→选中整表。
- (b) Tab 已右移/换行（table.ts:628-644），但末格 Tab 不补行；Enter 提交（无多行概念）；无 Backspace 语义。
- (c) 换嵌入式编辑器后：Enter = cell 内换行、Tab = 移动（末格补行：往文档表格块尾行追加 `| | |`，事务级）；Shift-Tab 首格不动。补行操作在 pipe 表里就是文本插入，天然 undo 友好。

**6. 表头吸顶 + 宽表横滚**
- (a) Sticky 首行（26px 偏移、首行禁跨行合并）、横滚条 + 裁切边缘渐变阴影（table.rs:505, 575-620）。
- (b) 无。
- (c) widget 是普通 `<table>`，CM6 行装饰不参与——在 widget 内实现：外层容器 `overflow-x: auto` + `position: sticky; top` 表头（CSS 原生即可，比 Quiet 的自定义元件便宜得多）；列宽拖拽后自动出横滚。

**7. 单元格区域复制粘贴**
- (a) 复制 = 结构化子表 + DocxXML 元数据（view.rs:1906）；表贴表 = 矩阵写入自动扩行列（table_ops.rs:131）；HTML 粘贴解析 colspan/rowspan（paste.rs:672）；Markdown 导出 covered→空格。
- (b) cell-selection 已有矩形，但复制只走普通文本选区路径。
- (c) 剪贴板写三格式：`text/plain` = TSV（Excel 互操作）、`text/html` = `<table>`（保留合并/背景）、`application/vnd.clairis.table+json` 或直接 markdown HTML 片段（应用内往返）。粘贴时按来源降级： Clairis JSON → 结构写回；HTML → DOMParser 解析（含 colspan）；TSV → 按行列铺。这与现有 `clipboard` 写入管线（Tauri）兼容。

**8. undo**
- (a) 全文档快照、每 op 一步、拖拽释放才 checkpoint、fuzzer 全操作覆盖。
- (b) CM6 原生 undo，cell input 编辑经单事务写回已入栈；但插入/删除行列是否与紧邻的手输入合并没有 annotation 分组。
- (c) 已够用，补两点：所有表格结构事务加 `Transaction.annotation`（如 `table-op: true`）+ `isolate`，保证一次拖拽/插入 = 一步 undo；拖拽中的视觉状态不进事务（对齐 Quiet「释放才 checkpoint」）。

**9. 表格 → Markdown 导出细节**
- (a) `|` 转义、`<br>` 连接块、列对齐众数（并列取表头）、covered 导出空格（markdown.rs:708-733）。
- (b) Clairis 的 markdown 是真相源，「导出」= 原文，无需转换；但若做「复制为 Markdown」（含 HTML 分支表），需同款降级逻辑。
- (c) 直接移植 `markdown.rs:708-733` 的规则（含众数对齐这个细节——它解决「后加的行不改列对齐」的真实痛点）。

**10. 架构性借鉴（不依赖 GPUI）**
- Quiet 最值得抄的是**分层 + 不变式**：结构 ops 纯函数化（take/put + repair）→ 可单测可 fuzz；Clairis 可把 `TableGrid` 做成纯 TS 模块（`src/editors/table/grid.ts`），merge/insert/delete/expand/repair 全部纯函数 + vitest 表驱动测试（对照 `table_ops.rs:388-527` 的测试清单逐条写：bar 选择、删整表、合并拆分、插入 caret、样式、移动、合并格跨界），CM6 widget 只做几何与指针。
- 尺寸/交互参数直接复用（引用条款化）：插入 pin dot 15×16 → pin 22×24、行 pin 19×15 → 24×22、resizer 10px 热区（−7/+3）、拖拽阈值 2px、落点吸附 20px、MIN 列宽 50、默认列宽 100、cell padding 9/10、BAR 10px、吸顶偏移 26px、自动滚 600px/s。

### 7.2 建议的落地顺序

1. 结构层：`TableGrid` 纯模块（covered-slot 模型 + repair + expand）+ 测试。
2. 接线 pipe 表解析/序列化（现有 `findTables`/`buildTableMarkdown` 升级为走 Grid）。
3. 合并/拆分（选区已有）→ HTML 序列化分支 + 降级导出。
4. 列宽拖拽 + 行列移动 + 删整表。
5. cell inline 富文本（嵌入式编辑器）→ 粘贴导出三格式 → 吸顶/横滚。

---

## 附：关键文件索引

| 文件 | 内容 |
|---|---|
| `crates/core/src/model.rs:399-441` | TableCell/Table 数据结构 |
| `crates/core/src/model.rs:448-727` | Table 全部结构方法 + CellRange |
| `crates/core/src/editor/table_ops.rs` | 选区 + 全部表格操作（527 行，含 9 个单测） |
| `crates/core/src/editor/core.rs:90-230` | Seg::Cell 路径系统 |
| `crates/core/src/editor/core.rs:1240,1458,1571,2437,2461` | Enter/Backspace/Delete/↑↓/Tab 在 cell 内的语义 |
| `crates/core/src/markdown.rs:708-733` | Markdown 导出 |
| `crates/core/src/docxml.rs:999-1040` | DocxXML 表格序列化 |
| `crates/core/src/paste.rs:672-749,1202-1253` | HTML/Markdown 表格导入 |
| `docs/FORMAT.md:84,107` | cell 单行编码 `&#10;`、嵌套块尾空白缺陷 |
| `src/editor/table.rs` | 表格 UI 全部指针交互（818 行） |
| `src/editor/overlays.rs:627-686,1612,1964` | 尺寸选择器 / 单元格工具条 / 块菜单 |
| `src/editor/view.rs:1825,1906,1924` | Tab 键、复制、复制为 Markdown |
| `src/editor/datatable.rs` | 数据表块嵌入视图（198 行） |
| `docs/ARCHITECTURE.md` | 分层原则、undo、fuzzer 不变式 |
