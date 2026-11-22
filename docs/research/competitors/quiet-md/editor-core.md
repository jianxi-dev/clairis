---
title: "editor-core"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 编辑器核心引擎逆向分析（对照 Biaoyue/Clairis）

> 分析对象：`/Users/mason/ToHighs/quiet-md-main`（MIT，Rust + GPUI，约 9 万行）
> 对照仓库：`/Users/mason/ToHighs/clairis`（Tauri 2 + React 18 + CM6 + Zustand）
> 本文所有 quiet-md 引用均给出 `文件:行号`。行号以当前 checkout 为准。
> 只读分析，未修改任何文件。

---

## 0. 摘要（TL;DR）

Quiet.md 的编辑器是**单一块树模型 + 全量快照 undo + 每次编辑过 Core 校验**的架构。它和 Clairis 的根本差异不是"原生 vs Web"，而是：

1. **Quiet 的文档只有一个真相（块树），渲染是从树单向投影**；Clairis 的真相是 Markdown 明文，"块"是从 Lezer 语法树现算的视图，每次交互都是"文本双向手术"。
2. **Quiet 的每次键盘事件都先过 `Core::checkpoint` 拍快照再改树**，任何路径都不可能产生"不可还原"的状态；Clairis 用 CM6 默认 history，但旁路很多（store→CM 全量同步、程序性 dispatch、切页签清历史），任何一个旁路都可能破坏可还原性。
3. **Quiet 的手柄是渲染期与块同帧布局的元素**（永不漂移），hover 检测是"整块行区域 + 每帧收集的 handle_targets"；Clairis 的手柄是 ViewPlugin 在 docChanged 时**全量重建 DOM** 的绝对定位元素，重建时机与位置计算都是稳定性隐患。

下面分节拆解，最后按 Clairis 的三个问题逐条给出病因与修复建议。

---

## 1. 架构总览

`docs/ARCHITECTURE.md`（quiet-md-main）自述分层：

```
crates/core (fdl_core, ~36k 行，无 GPUI 依赖，可独立 cargo test)
  model.rs      纯数据：Document / Block / BlockKind / RichText / Inline
  docxml.rs     DocxXML ↔ Document 双向转换（保真 round-trip）
  editor/core.rs 编辑引擎：全部结构变更 + 选区校验 + undo 栈
  editor/fuzz_tests.rs 随机编辑 fuzzer（不变量检查）
src/ (quiet_md, GPUI 应用层)
  editor/view.rs    Editor 状态、键盘/指针事件 → Core 调用、changed()
  editor/render.rs  页面渲染（虚拟化 List）、手柄挂载
  editor/overlays.rs 手柄/斜杠菜单/块菜单/浮动工具条
  editor/drag.rs    块拖拽
  editor/gap.rs     块间空隙点击插入
  history.rs / file_history.rs 版本抽屉 / 文件操作历史
  app.rs            Workspace：防抖保存、冲突对话框
```

依赖单向：application → core。**core 不 import GPUI**，全部编辑操作在 core 层可单测、可 fuzz（ARCHITECTURE.md "Editing engine" 一节）。

---

## 2. 块模型（crates/core/src/model.rs）

### 2.1 数据结构

- `BlockId(u64)`：全局原子自增，`model.rs:14-25`。**特意不实现 Default**（注释：避免读起来像固定值）。
- `Marks`（`model.rs:59-71`）：`bold/italic/underline/strike/code` 五布尔 + `link: Option<String>` + 前景/背景 `ColorName` + `inline: Option<Inline>`。
- `RichText`（`model.rs:212-216`）：**明文 + run-length 标记列表**。
  ```rust
  pub struct RichText { pub text: String, pub runs: Vec<Run> }
  // 不变量（doc 注释）：runs 覆盖整个 text（Σlen == text.len()），
  // 无零长 run，相邻 run 标记不同。Run { len, marks } (model.rs:203-206)
  ```
  关键操作全部**重建 runs** 而非原地改：`push`（合并同标记，`model.rs:256`）、`replace`（`model.rs:329`）、`slice`（`model.rs:316`）、`update_marks`（`model.rs:349`）、`split_off`（`model.rs:342`）。`clamp()`（`model.rs:310-314`）把越界 range 夹回并落到字符边界——**过期的 offset 永远不会 panic**（debug_assert + floor_char_boundary）。
- `Inline`（`model.rs:79-91`）：行内对象（公式/按钮/提醒/文档链接），`xml` 原样保留（round-trip 无损），`kind` 载入时解析一次。**行内对象占一个 U+FFFC 字符位**（`EQUATION: &str = "\u{fffc}"`，`editor/core.rs:411`）——这是"对象即字符"的设计，光标/选区/删除全部按普通字符处理。
- `Block`（`model.rs:883-897`）：`{ id, kind, text: RichText, align, bg, children: Vec<Block>, folded }`。
- `Document`（`model.rs:943-950`）：`{ title: RichText, icon, cover, blocks: Vec<Block> }`，默认 `blocks: vec![Block::text("")]`（`model.rs:952-960`）——**文档永远至少有一个空段落**。
- `BlockKind`（`model.rs:724-771`）：20 个变体（Text / Heading{level} / Bullet / Ordered{seq} / Todo{done} / Code / Quote / Callout / Divider / Image / Table / Grid / Column / SubPageList / Countdown / File / Board / DataTable / Raw）。

### 2.2 嵌套规则 `BlockKind::nests()`

`model.rs:795-800`：

```rust
pub fn nests(&self) -> bool {
    matches!(self, Text | Heading{..} | Bullet | Ordered{..} | Todo{..})
}
```

只有这 5 种"带文本的块"能收孩子（Tab 缩进、拖拽成FirstChild）。配套谓词：

- `has_text()`（`model.rs:774-785`）：Text/Heading/Bullet/Ordered/Todo/Code 有可进光标的富文本行。Quote/Callout/Grid/Column 是**容器**（`is_container()`，`model.rs:787-793`），孩子渲染在容器内部。
- 嵌套深度上限 `MAX_NEST_DEPTH: usize = 16`（`editor/core.rs:212`），`nest_depth()`（`core.rs:216`）从最近容器数起。缩进/拖拽全部先检查深度（`core.rs:1665-1672`、`drag.rs:14`）。

### 2.3 块 → 渲染行映射

- `units(&doc)`（`editor/core.rs:233-262`）：**文档序遍历出所有"可停光标单元"** `Unit { id, text: bool, scope: Option<BlockId> }`（`core.rs:54-60`）。规则：
  - 标题折叠时，同层级或更高级标题之前的兄弟**不进 units**（`core.rs:237-245`）——选区永远不会落在折叠区里。
  - 容器的孩子以同一 scope 递归展开；表格单元格以表格 id 为 scope（`core.rs:252-259`）——**选区永不跨表格边界**。
- 渲染侧（`src/editor/render.rs`）：GPUI `List` 的 Item 分为 Header（标题区）/ 可见顶层块 / Below（反向引用区）；Text/Heading/列表块的**孩子独立成行**（`flattens`），容器（Quote/Callout/Grid/Column）的孩子画在容器行内。`sync_items` 用 `hash_block` 做行 key，只对变更行重测高度（ARCHITECTURE.md "Rendering and virtualization"）。

### 2.4 为什么它的"格式"不会程序性错乱

1. **格式是模型属性，不是文本前缀**。`# ` 不是文本而是 `BlockKind::Heading{level}`；`**x**` 不是文本而是 run.marks。用户永远不可能"输入一个破坏结构的字符"——所有字符都只是 `text` 里的字节。
2. **每个结构变更是 core 里的一个显式函数**（enter/backspace/indent/turn_into/move_blocks...），函数内部自己维护不变量（孩子归属、容器非空、表格外矩形），最后统一过 `normalize()`（`core.rs:838-876`：清掉空 Quote/Callout、单列 Grid 溶解、表格 repair、保证文档非空）和 `fix_selection()`（`core.rs:766-783`：把选区夹回存在的块与字符边界）。
3. **不变量由 fuzzer 随机验证**（`editor/fuzz_tests.rs`，ARCHITECTURE.md 列出的 7 条：选区端点可见且同 scope、块 id 唯一、run 在界内不重叠、只有 nests 块有孩子、代码块无标记、存取 round-trip、undo+redo 回到原状）。

---

## 3. 编辑引擎（crates/core/src/editor/core.rs，4285 行）

### 3.1 位置与选区表示

- `Pos { block: BlockId, offset: usize }`（`core.rs:19-27`）——**块内 UTF-8 字节偏移**，不是文档偏移。
- `Selection { anchor, head }`（`core.rs:29-40`）；标题用保留 id `TITLE = BlockId(0)`（`core.rs:14`）。
- 跨嵌套块：选区端点只是两个 `Pos`，"哪块在前"由 `ordered_in(&units)` 按 `units()` 里的文档序判定（`core.rs:571-587`）；范围覆盖中间块时用 `unit_index` + `len_of` 拼出每块的局部 range（`range_in`，`core.rs:596-616`）。**嵌套深度不体现在选区里**——层级属于树，选区只认 `(块, 偏移)`。
- 路径 memo：`Core.paths: RefCell<HashMap<BlockId, Path>>`（`core.rs:556-565`）带自愈逻辑——命中时**先验证 entry 还指向该块**（`core.rs:483-490`），stale 则按退避策略重建 `path_index`（`core.rs:490-503`）。注释写明"edits never need to invalidate it; a stale entry triggers a rebuild"。

### 3.2 输入管线全流（一个键 → 界面更新）

以打字为例（`src/editor/view.rs:2706-2734 type_text`）：

1. 平台 InputHandler（macOS NSTextInputClient / IME）回调 `replace_text_in_range`（`view.rs:2807-2830`）→ 组合态走 `replace_and_mark_text_in_range`（`view.rs:2844-2884`，`marked` 记预编辑 range，`core.replace_in_block` 原地替换）。
2. `type_text` → `core.insert_text(s)`（`core.rs:985-1005`）：
   - `checkpoint(EditKind::Typing)`（拍快照/合并，见 3.3）
   - `delete_selection_inner()` 清选区
   - 取 marks：`pending_marks`（⌘B 预设）或 `text.marks_at(offset)`（`model.rs:285-307`——**链接/行内码/行内对象不延续**，见 `typing_marks` `model.rs:381-390`）
   - `t.insert_plain(offset, s, marks)`，光标 = `offset + s.len()`
3. view 后处理：空格触发块级 markdown 快捷转换、`/`/`、` 开斜杠菜单、`@` 开提及（`view.rs:2722-2731`）。
4. `self.changed(window, cx)`（`view.rs:578-614`）：
   - `core.reveal_caret()`（`core.rs:2075-2083`）——展开遮住选区的折叠祖先/标题（`is_hidden` 判定 `core.rs:2047-2073`，`unfold_to` `core.rs:1999-2045`）；折叠的代码块光标进入即展开（`view.rs:589-591`）
   - `dirty` 为真：清 `caret_row_end`、置 `typing=true`（**抑制手柄**，`view.rs:598`）、发 `EditorEvent::Changed`、刷新 find/斜杠/提及
   - `autoscroll = reveal` → 本帧渲染时 `apply_reveal`（`render.rs:1295-1359`）把光标 rect 滚进视口（margin 40px，块级目标重试 ≤3 帧）
   - `restart_blink` + `cx.notify()`
5. Workspace 收到 Changed → `schedule_save`（`app.rs:1141-1170`）：**SAVE_DELAY=500ms 防抖，SAVE_MAX_DELAY=2s 截止**（`app.rs:24-25`）——连续打字时每次编辑重置 500ms 定时器，但最老未保存编辑满 2s 必落盘。失败时文档保持未保存、顶栏报错、切档/退出前弹冲突对话框（重试/从盘重载/存恢复副本），ARCHITECTURE.md "Editing flow" 第 4 步。

### 3.3 undo 快照策略：checkpoint / generation / dirty

`Core::checkpoint`（`core.rs:624-637`）：

```rust
pub fn checkpoint(&mut self, kind: EditKind) {
    self.generation += 1;
    let now = Instant::now();
    let block = self.sel.head.block;
    let coalesce = matches!(
        self.last_edit,
        Some((k, t, b)) if k == kind && kind != EditKind::Other && b == block
            && (kind == EditKind::Equation || now.duration_since(t) < Duration::from_millis(700))
    );
    if !coalesce { self.push_undo(Snapshot::new(self.doc.clone(), self.sel)); }
    self.last_edit = Some((kind, now, block));
    self.redo.clear();
    self.dirty = true;
}
```

要点：
- **快照是整个 Document 的深拷贝**（`Snapshot { doc, sel, bytes }`，`core.rs:326-333`），挂在 `Arc` 上。字打快、省心的代价由内存预算控制：`UNDO_STEPS=500`、`UNDO_BYTES=256MB`、`UNDO_MIN_STEPS=20`（`core.rs:331-335`，`push_undo` `core.rs:705-714` 超预算从头弹出）。`doc_bytes`（`core.rs:337-355`）估堆大小；画板 scene 用 `Arc` 在快照间共享直到修改（`model.rs:759-762`）。历史基准：百万字文档打字时同步帧处理中位 5.06ms（ARCHITECTURE.md "Undo"）。
- **合并窗口 700ms、滑动**：同一 kind 且同一块内、距上次 <700ms 的打字不新拍快照。窗口是"距上一次键"不是"距快照"，所以连续打字 10 分钟也只有一个 undo 步（每键续 700ms）。`EditKind::{Typing, Delete, Equation, Other}`（`core.rs:413-425`）——**Other 永不合并**：Enter/Backspace出块/转换/缩进/拖拽每个都是独立 undo 步。`break_coalescing()`（`core.rs:701-703`）显式断开合并。
- **generation**：每次文档变更（含折叠）+1（`core.rs:625`，`block_mut` 也 +1 `core.rs:526`）。渲染缓存、TOC、字数用它检测 stale（`render.rs:1418-1424`：`frame.generation == Some(generation)` 才复用 units）。
- **dirty**：只有真变更置位；`changed_with_scroll` 里消费并清零（`view.rs:593-598`）。折叠本身不改文本但置 dirty（`toggle_fold` `core.rs:1953-1959` 直接 `generation += 1; dirty = true`，且**折叠进文档持久化、是 undoable 的单事务**——注释：folded 是文档一部分）。
- **undo/redo 时不还原的两样东西**：文档图标与折叠态。`keep_outside_history`（`core.rs:375-401`）在 undo/redo 恢复文档前把"现在"的 icon 与逐块 folded 抄回快照——用户 Undo 不会意外展开/收起标题。undo 还把当前态压入 redo（`core.rs:734-748`），redo 反向压回 undo（`core.rs:749-764`），选区来自快照并过 `fix_selection()`。
- **结构性操作的原子化**：`move_blocks`（`core.rs:2180-2220`）先克隆、后删、再插，**若结果与原来相同则回滚且不拍快照**（"False when nothing would change"）；先比对 `doc.blocks == before`，有差异才 `checkpoint`。
- 快照还会被**跨历史修补**：`relink_image`（`core.rs:640-680`，粘贴的 web 图转本地后 undo 不得带回过期链接）与 `receive_file_title`（`core.rs:716-733`，侧栏改名同步所有快照并按 grapheme 夹选区）用 `Arc::make_mut` 改写 undo/redo 链。

### 3.4 关键编辑原语

- `enter()`（`core.rs:1240-1345`）：标题内 Enter → 拆标题入正文（`core.rs:1248-1266`）；代码块 Enter → 复制当前行缩进（`core.rs:1282-1291`）；空列表项 Enter → 嵌套时 outdent、顶层时退化为 Text（`core.rs:1293-1302`）；容器末空段 Enter → 退出容器（`core.rs:1305-1320`）；光标在块首且非空 → **上方插入同型空块**（标题例外插 Text，`core.rs:1328-1340`）；其余 → `split_off` 尾部、新块 kind 按"下一项"规则（Heading→Text、Ordered/Todo 续型、折叠标题续同 level，`core.rs:1341-1345`）；有未折叠孩子时**新块成为第一个孩子**（outliner 语义，`core.rs:1360-1363`），折叠标题插到 `fold_end` 之后。
- `backspace()`（`core.rs:1361-1440`）：选区→删；块内→按 grapheme 删（`prev_grapheme` `core.rs:264-267`）；偏移 0 时逐级降级——非 Text 块先退化为段落、缩进段落 outdent、引用首段 lift 出容器、最后 `merge_into_previous`（`core.rs:1450-1530`：尾部文本接前块、孩子按 `nests()` 归属或后置、光标落在接缝处 `at = len_of(prev)`）。表格内 backspace **永不跨单元格**（`core.rs:1460-1490`），空单元格 backspace 两次才删表。
- `delete_selection_inner`（`core.rs:877-975`）：跨块删除时"尾块残段拼入首块 + 中间块 lift 移除 + 尾块孩子按 nests 归属"，最后 normalize。
- `turn_into/toggle_turn_into`（`core.rs:1746-1799`）：Quote/Callout 用 `wrap_blocks`（相邻兄弟打包成容器，`core.rs:1801-1834`），取消时 `lift_out_of_container`（`core.rs:1836-1859`）把容器从中间切开成 before/me/after 三段。`turn_one`（`core.rs:1861-1893`）处理折叠标记清除、代码块清标记、非 nests 块的孩子外提。
- Markdown 快捷转换（core 内，非 view）：`markdown_block_trigger`（`core.rs:2884-2928`）——空格/Enter 触发 `# `→H*、`- `→列表、```` ``` ````→代码等；**触发字符是独立 undo 步，转换再一步**，所以第一次 ⌘Z 恢复字面前缀（注释原话）。`markdown_divider`（`core.rs:2929-2955`）、`autolink`（`core.rs:2956-2982`，排除标点后缀、已有 link/code/inline 的 range）、`markdown_inline_shortcut`（`core.rs:2984-3070`）——9 条规则按固定优先序（`***`,`___`,`**`,`__`,`*`,`_`,`~~`,`~`→下划线,`` ` ``），**要求两侧定界符精确等长、内侧不以空白/同字符开头/结尾**，`$x$`/`$$x$$` 转公式且排除数字货币（`is_numeric_math`）。

---

## 4. 行手柄（重点）

### 4.1 手柄的显示判定与挂载

**不是独立 overlay 去猜位置，而是每个块行渲染时同帧布局**：

- `render.rs:496-510`（`R::block` 内）：
  ```rust
  let handle = (!env.cell && !env.in_callout && !self.ghost && self.ed.handle_block() == Some(b.id))
      .then(|| { let first_line = /* 块首行行高 */; self.ed.handle(b.id, first_line, cx) })
      .flatten();
  ```
  手柄作为块行的 child、相对行盒绝对定位（`overlays.rs:363-418 handle()`：`top = (first_line - 26.) / 2.`，即**垂直居中于块首行**）。注释（`overlays.rs:361-362`）："The handle, laid out together with its block (not from last frame's bounds) so it never lags behind when the block changes height."——**手柄永不漂移的根因**。
- hover 目标块：`Editor.hover`（`view.rs:158`）。`on_hover_move`（`view.rs:2530-2604`）在**无按键按下**时遍历本帧渲染收集的 `handle_targets`（`render.rs:1283` 每帧 extend、`render.rs:1425` 每帧 clear），命中区域是**块左缘向左扩 60px、整块高**的矩形：
  ```rust
  let ext = Bounds::from_corners(point(b.left() - px(60.), b.top()), b.bottom_right());
  if ext.contains(&p) { /* 取面积最小的命中块（最内层） */ }
  ```
  （`view.rs:2585-2598`）。`handle_targets` 只含**可见且可选手柄**的块——视口外、单元格内、callout 内不收集。
- 抑制链（`handle_block()`，`overlays.rs:350-358`）：`read_only || dragging || slash.is_some() || block_drag.started` → 无手柄；块菜单/Add 菜单打开 → 手柄钉在那个块上；`typing == true`（上次编辑后指针未动）或 `hover_clipped`（块的顶部滚出视口，`render.rs:1382-1385` 判定）→ 不显示。**打字立即藏手柄（`view.rs:598`），鼠标一动（`on_hover_move` `view.rs:2563-2566`）立即恢复**——无 300ms 延迟。
- 键盘导航也维护 hover 语义：↑/↓ 移光标时不改 hover，但 `changed_with_scroll` 后手柄隐藏到鼠标再动。

### 4.2 图标按 BlockKind 的映射表

`overlays.rs:62-93 kind_icon()`：

| BlockKind | 图标 |
|---|---|
| Text | `type` |
| Heading{level} | `heading-1` … `heading-6`（6 级显式映射，_ → `heading`） |
| Bullet / Ordered / Todo | `list` / `list-ordered` / `todo` |
| Code | `braces` |
| Quote / Callout | `quote` / `callout` |
| Divider / Image / Table | `divider` / `image` / `table` |
| Grid / Column | `columns-2` |
| Raw | `file-text`；SubPageList `list-tree`；Countdown `timer`；Board `palette`；DataTable `table`；File `paperclip` |

`kind_color`（`overlays.rs:95-108`）给图标按家族着色（列表=INDIGO、代码=GREEN、分割线/Callout=ORANGE、图片=YELLOW、表格=TEAL、文件=WATHET、其余=BLUE）——与斜杠菜单同色系。

手柄本体（`overlays.rs:379-396`）：42×26 药丸（1px 内边距 + 24px 类型图标盒（14px 字形带家族色）+ 14px `grip-vertical` 把手），圆角 6、1px 边框、hover 变 `handle_active` 底色；`add` 形态退化为 28 宽单段 `+`（14px plus 图标、PointingHand 光标）。

### 4.3 位置精修参数

- `handle_dx`（`overlays.rs:292-303`）：默认手柄左缘在块左缘外 48px（add 形态 34px）；**可折叠块再多退 14px 给折叠箭头**（`can_fold`）；Quote 的孩子再把 Quote 自己的位置让出来（再 -14px）。
- 表格特殊：`TABLE_HANDLE_DX=44.5`、`TABLE_HANDLE_DY=16.5+13`（`overlays.rs:21-23`），手柄放在**网格上方列点行**（`overlays.rs:285-289`）。
- 代码块：`top = b.top + 3`、行高按 32（与工具条行对齐，`overlays.rs:278`、`render.rs:501-508`）。
- 垂直居中用**块首行的行盒**（`Probe::Point(Pos::new(id, 0))` 取 position_for + line_height，`overlays.rs:274-283`）而不是块盒——长段落折行时手柄对齐第一行文字。

### 4.4 新增块机制：三个入口

1. **空块退化 "+"**：`is_empty_line`（`overlays.rs:305-307`）= `Text 且 text 空 且 children 空`。hover 到空段落，手柄变成 28 宽 `+`，光标 PointingHand。按下不进拖拽（`overlays.rs:399-401`：`if !add { e.press_handle(...) }`），直接 `open_block_menu(id, add=true)`（`view.rs:2609-2623`）→ 光标置该块、开 `Menu::Add`（插入面板，高亮延迟到 hover/↑↓）。
2. **块菜单"在下方添加 ›"**：普通手柄按下 → `press_handle`（按下即 select_block）+ `open_block_menu`（`Menu::Block`），菜单第一组末行是 `add_below_row`（`overlays.rs:178-189`），hover 展开插入面板（`Menu::BlockSub::Add`），面板锚定在 `handle_rect(block, true)`（`overlays.rs:427-445`）。
3. **块间空隙点击**（`src/editor/gap.rs` 全文）：点击落在**距块边 16px（REACH）以内**、且按下位移 ≤10px（SLOP）时，若相邻块无可进光标的文本（`one_line` 判定：Code/Quote/Callout/Divider/Image/Table/Grid/... `gap.rs:19-33`），在该处**插入空段落**（`gap_release` → `core.insert_blocks_at(vec![Block::text("")], target, place)` → 光标置新块，`gap.rs:100-121`）。`Walk::find` 递归处理容器/列内部，条件分支精细（上文/下文/两侧组合，`gap.rs:56-92`）。

**末尾空行**：文档末尾**永远存在**可编辑的空段（`Document::default` 即含空段，`normalize`/`ensure_non_empty` 保底 `core.rs:847-850`）。点击内容区下方空白 `on_click_below`（`view.rs:2605-2615`）→ `core.trailing_line()`（`core.rs:2555-2568`）——最后块已是空段落就直接返回，否则 **checkpoint 后追加一个空段落**（且注释说明这是"离开末尾代码块/表格的唯一出口"）。块模式 ↓ 到最后也走这里（`block_sel_move`，`core.rs:2615-2617`）。所以"末尾空行显示手柄"不是特殊渲染，而是**它就是一个真实的空 Text 块**，走与其他块完全相同的 hover/手柄路径。

### 4.5 拖拽（src/editor/drag.rs）

- 按下手柄 `press_handle`（`drag.rs:303-330`）：Grid/Column 不可拖；多块选择含该块则整组拖，否则 `select_block(id)`（折叠标题**携带整个隐藏 section**，`drag.rs:312-317`）。记录拖动块的当前屏幕尺寸（ghost 卡用）。
- 启动阈值 **2px**（`drag.rs:341-343`：`m.x.hypot(m.y) <= 2.` 才不算开始）；开始后隐藏菜单/工具条。
- 落点判定 `Walk::level`（`drag.rs:90-160`）：自上而下找指针所在块；y < 块中心 → Before（且看前一块），y > 中心 → After 或 FirstChild（**指针 x 超过块左缘 36px 且块可嵌套时**才 FirstChild，`drag.rs:155-156`、`before()` `drag.rs:170-180`）；拖动块自身跳过；左侧 5px 内从子级逃逸回父级 After（`drag.rs:120-127`）。引用/Callout 命中内部时先看孩子 span；网格命中最近列。
- 深度/容器约束（`find_drop` `drag.rs:213-268`）：链深 +1 > 16 拒绝；Grid 不能进容器、Quote 不嵌 Quote、Callout/Table 不进 Quote/Callout。
- 视觉反馈：2px accent 落点线 + 左侧 25px 渐弱 hint 段（表示还能往外弹几级，alpha = `256*(1-1/(n+2))`，`drag.rs:393-407`）；拖动块重绘在 ghost 卡上（大块按 `(365/w).max(78/h)` 缩比，`drag.rs:432-470`）；页面边缘 20px 内自动滚动 600px/s（`block_autoscroll` `drag.rs:295-325`，帧间隔 clamp 0.05s）。
- 松手阈值：位移 >10px 且有落点才 `move_blocks`；成功后拖过的块 **accent 闪烁 2s**（FLASH=2000ms，`drag.rs:16`、`drop_flash_el` `drag.rs:327-339`，透明度三段式 0.2 快入/平台/0.2 快出）。
- 失焦取消：窗口失活时 `block_drag = None`（`drag.rs:299-304`）——离开窗口不丢东西。

---

## 5. 光标/选区与稳定输入

- `fix_selection`（`core.rs:766-783`）：undo/redo/折叠/移动后统一调用；块不存在→回退到 units 首个可停位（跳过折叠代码块，`Core::new` `core.rs:594-604` 同规则选初始光标）；offset 越界→夹回并落在 char boundary。**任何路径都不存在悬空选区**。
- `reveal_caret`（`core.rs:2075-2083`）：选区两端（块选区则 anchor+head）`is_hidden` 就 `unfold_to`。`is_hidden`（`core.rs:2047-2073`）实现的是 `units()` 的折叠规则但**只走路径不遍历全文**：折叠祖先，或同级以上存在折叠且中间无同级以上标题。`unfold_to`（`core.rs:1999-2045`）循环展开"最内层的遮挡者"，因为展开一个可能暴露另一个。
- 折叠后的光标转移：`fix_selection_after_fold`（`core.rs:2085-2104`）——折叠把选区藏住 → 光标移到折叠块末尾；块选区触及被藏块 → 直接解散块选区。
- IME（`view.rs:2791-2884 EntityInputHandler`）：`marked: Option<(BlockId, Range)>` 记预编辑；组合内每次更新走 `replace_and_mark_text_in_range` → `core.replace_in_block`（`core.rs:1007-1021`，**每次组合更新也是一次 Typing checkpoint**，Equation kind 有独立合并通道）；跨块选区/原子块光标先清理再进组合。UTF-8↔UTF-16 转换在 `to16/from16`（view.rs），`reported_range` 只上报 head 块内的选区（`view.rs:2736-2748`）——平台看到的世界永远是单块文本。
- 渲染端光标定位 `point_of`/`position_for`（缓存 per-block 布局 `self.cache`，`overlays.rs:265-268`），行尾特例 `caret_row_end`（折行行尾光标用 `position_at_row_end`，`view.rs:2924-2928`）。

---

## 6. undo/redo 与文件级历史

### 6.1 编辑内 undo（见 3.3）

全量快照（Document clone）+ VecDeque，**块级语义**（快照里是整棵树），合并只发生在"同块连续打字/删除/公式编辑"。因为快照完整、选区随快照恢复、且 restore 后必过 `fix_selection`，**不存在"无法还原"的状态**——fuzzer 的最后一条不变量就是"undo 全部再 redo 全部回到原状"。

### 6.2 版本历史（文件级）

- 保存成功后 `Store::save_now` 把上一版内存正文快照到 `history/<id>/`；**自动快照节流：每 5 分钟一份，每文档 1-30 份，库总额 200MiB**（ARCHITECTURE.md；实现在 `crates/core/src/versions.rs`）。恢复某版本前**先强制快照当前正文**（不丢现场）。
- `src/history.rs`：右侧抽屉按天分组，选版本 → 原位只读预览（`Editor::set_preview` 进入 read-only，`flush/schedule_save/sync_document` 短路防写历史内容，`history.rs:1-10` 模块注释）；`Preview { core: Core, reading, name }`（`history.rs:31-36`）**整体保存编辑器状态（含 undo 栈）**，"返回当前"原样放回（`exit_preview` `history.rs:186-200`）。改动高亮：块级 LCS（`crates/core/src/changes.rs`）+ 行级 LCS 计数（`diff.rs`）；高亮必须用同一解析的块 id（`history.rs:110-120` 注释）。
- `restore_selected`（`history.rs:255-290`）：恢复失败时**当前版本原样保留**（先试保存再动编辑器）。

### 6.3 文件操作历史（src/file_history.rs）

创建/复制/改名/移动/删除/恢复有**独立 undo 栈**：`Record { token, label, changes: Vec<FileDelta>, entries }`，上限 100 步（`file_history.rs:45-53`）。在 store 写锁下记录（其他实例的变更排除在外）；异步删除落盘后用真实记录替换预览记录（`confirm_tree_history`）。undo 时检查文件状态与层级、从盘读内容（ARCHITECTURE.md "Undo for folders and file operations"）。与文档内 undo 的路由：`capture_file_history`（`file_history.rs:107-116`）——视图在文档页且无待定文件操作时 ⌘Z 归编辑器，否则归文件历史（`prefer_files` 粘滞）。

---

## 7. 可移植性评估

### 7.1 可直接抄的交互参数与边界行为（不依赖 GPUI/块模型）

| 参数/行为 | Quiet 值 | 出处 |
|---|---|---|
| 手柄 hit 区域 | 块左缘向左 60px + 整块高，取面积最小命中块 | `view.rs:2585-2598` |
| 手柄尺寸 | 42×26（add 28×26），圆角 6，图标 14/grip 14 | `overlays.rs:379-396` |
| 手柄水平退让 | 基准 -48px；可折叠 -14；Quote 子块再 -14 | `overlays.rs:292-303` |
| 打字隐手柄 | 编辑瞬间藏，指针一动即显（无延迟） | `view.rs:598, 2563-2566` |
| hover 命中 | 无按键按下才换 hover；块菜单开着钉住 | `view.rs:2573-2583` |
| 块间点击插入 | REACH=16px、SLOP=10px、相邻块须 one_line | `gap.rs:6-11` |
| 拖拽启动 | 2px | `drag.rs:341-343` |
| 拖拽成子级 | 指针过块左缘 36px 才 FirstChild；左侧 5px 逃逸回父级 | `drag.rs:155-156,120-127` |
| 拖拽松手 | 位移 >10px 才算移动；成功后闪烁 2s | `drag.rs:354-364, 16` |
| 自动滚动 | 边缘 20px 内，600px/s，dt clamp 50ms | `drag.rs:295-325` |
| 嵌套深度 | 16（缩进与拖拽同限） | `core.rs:212` |
| undo 合并窗口 | 700ms 滑动，同块同 kind；Other 永不合并 | `core.rs:624-637` |
| undo 容量 | 500 步 / 256MB / 最少 20 步 | `core.rs:331-335` |
| 保存防抖 | 500ms 防抖 + 2s 截止 | `app.rs:24-25,1141` |
| 版本快照 | 5 分钟/份，1-30 份，库 200MiB | ARCHITECTURE.md |
| undo 不还原 | 折叠态与文档图标 | `core.rs:375-401` |
| 折叠时选区 | 被藏 → 光标移折叠块末尾 | `core.rs:2085-2104` |
| 文档末尾 | 永远存在空段；点击空白聚焦/创建之 | `core.rs:2555-2568` |
| markdown 转换 undo | 触发字符独立一步，转换再一步（⌘Z 先回字面） | `core.rs:2895-2899` |
| 行内格式输入 | link/code/inline 对象不随打字延续 | `model.rs:381-390` |
| inline 快捷判定 | 定界符两侧精确等长 + 边界字符集（含中文标点） | `core.rs:2984-3070` |

### 7.2 交互模式可移植、实现不可直接移植

- **手柄与块同帧布局**：CM6 下对应做法是把手柄做成块行的伪元素/装饰（或 hover 时按 `visualLineAt` 实时算），而不是"渲染一次、之后 offset 定位"。Quiet 的核心思路"位置来自本帧行盒，永不用上一帧"必须保留。
- **"空段即 +"与末尾常驻空行**：Clairis 是 Markdown，末尾没有语义空块——但可以完全复刻这个**视图层协议**：文档末尾没有空行时，hover/点击下方空白时虚拟出一个手柄，落点=文档末尾。
- **选区自愈**：任何程序性变更后把选区夹回合法位置（CM6 的 selection mapping 大体做到了，但**跨事务的程序性替换**不行，见 §8）。
- **单点写入口**：Quiet 一切结构变更过 Core。Clairis 对应物是"一切结构性编辑收敛到少数几个 dispatch helper，且都带 userEvent 标注"，便于 history 分组与回滚。

### 7.3 不可移植（依赖 GPUI/块树）

- 全量快照 undo 的性能特征（Document clone 5ms 级）——CM6 应继续用增量 undo（HistoryState），但**要抄它的分组与选区语义**（见 §8.3）。
- `hash_block` 虚拟化、块 id 稳定引用、表格列宽等模型能力。
- `Arc<Board>` 快照共享、DocxXML round-trip。

---

## 8. Clairis 对应问题诊断与借鉴清单

> 依据：`src/editors/block-model.ts`、`src/editors/orchestration/block-handle.ts`、`src/editors/smart-input.ts`、`src/editors/setup.ts`、`src/editors/decorations/index.ts`、`src/components/Content/ContentArea.tsx`、`src/stores/index.ts`、`src/editors/keybindings.ts`。

### 8.1 问题 1：行手柄（位置不精、图标不全、新增不稳、末尾空行不显示）

**(a) Quiet 的做法**（§4 全节）
- 位置：手柄与块**同帧渲染**，垂直居中于块**首行行盒**，水平退让按块型/折叠态/父容器动态计算；表格/代码块有专用锚点。
- 图标：`kind_icon` 对 20 种 BlockKind 全量映射，标题精确到 1-6 级，列表分有序/无序/待办，另有 per-家族着色。
- 新增：空段自动变 "+"（悬停开插入面板）；块间 16px 空隙点击插入；块菜单"在下方添加"二级面板。
- 末尾空行：文档恒有尾空段，点击下方空白 `trailing_line` 补建，走普通块路径。
- hit 区域：块左缘外 60px × 整块高，**面积最小（最内层）块胜出**。

**(b) Clairis 病因（读 `orchestration/block-handle.ts`、`block-model.ts` 核对）**

1. **每个 docChanged 全量重建手柄 DOM**：`BlockHandlePlugin.update()`（`block-handle.ts:251-256`）`if (update.docChanged) { this.build(); return; }`；`build()`（`block-handle.ts:415-507`）`clearHandles()` 再逐块 `addHandle`（新建 div、重建 icon/grip DOM、重挂监听）。后果：
   - **打字时（docChanged）手柄全部销毁重建**——正好在用户编辑时闪断；拖拽中的 entry 被换成新对象，监听/定时器状态丢失风险。
   - 每次重建重扫全文档（`getBlocks` + `parseMermaidBlocks(docText)` 全文正则 + 逐空行循环 `block-handle.ts:492-497`）——大文档 O(doc)。
   - 重建后 `position()` 依赖 `coordsAtPos`/`lineRectAt`，首帧可能未测量（代码自己承认：`block-handle.ts:286-288` 注释 + `position()` 的三层 fallback `block-handle.ts:660-710`），落 0,0 等 reposition 修正——**这就是"位置不精致/手柄闪跳"的直接来源**。
2. **图标覆盖不全**：`blockHandleIcon`（`block-handle.ts:47-79`）只对 heading/list 从首行正则细分，`heading` 匹配失败退化成 `DragHandleOutlined`（用户看到"一排把手"——注释自己引用 #104）；callout 有图标但**没有 per-类型着色**（Quiet 的 kind_color）；`htmlBlock/yamlFrontMatter/quote 内的 list/task 嵌套项`等类型映射缺失或依赖首行猜测。`blockquote` 内嵌套块通过 `getNestedBlocks` 补手柄（`block-handle.ts:447-482`），但类型从 Lezer 节点名映射，`task` 依赖首行正则，可靠性同上。
3. **空行手柄/末尾空行**：`build()` 对"不被任何块覆盖的空行"建 `+` 手柄（`block-handle.ts:492-497`）。但 Markdown 里**空行也是顶层 Paragraph 的一部分或块间分隔**——`getBlocks`（`block-model.ts:182-287`）取的是 Lezer 顶层节点，空行常落在相邻 Paragraph 的 `to` 之内（带尾空行的段落）或两个块之间没有节点，`covered(line.from)` 判定实际取决于解析树形状；结果是**有的空行有 +、有的没有**，末尾空行（文件以 `\n` 结尾时 doc.lines 少一行；不以 \n 结尾时最后一空行属于最后段落）覆盖不稳定。Quiet 的答案是"末尾永远有一个真块"，Clairis 没有——**它靠文本重排 `trimNewlines` + `join("\n\n")`（`moveBlock`，`block-handle.ts:97-121`）制造空行**，悬停/插入点随解析漂移。
4. **hover 命中是"指针 pos ∈ [from,to] + 最小区块"**（`block-handle.ts:327-347`），但没有 Quiet 的"块左缘外扩 60px"命中带：指针在块**文字区域内**就能召唤（SUMMON_ZONE 只是左缘 25% 的额外限制），而 Quiet 是"左缘 60px 内或块上"——Clairis 的召唤区约束（左 25%）反而让右 75% 完全无手柄，与 Quiet"整块都算"不同，发现性差。
5. **位置锚定 anchorPos 追指针可视行**（`block-handle.ts:355-358` 注释承认对齐 md-bundle 的 showHandleAt），但 `reposition()` 只在 `geometryChanged || viewportChanged`（`block-handle.ts:255-258`）时跑——**指针在长段内移动时 anchorPos 更新了却无人调用 position()**（onDomPointerMove 里只 `hit.anchorPos = ...`，没有 reposition 调用），手柄停在旧行，直到下一次 geometry 变化才跳过去。

**(c) 修复建议（可落地）**

1. **把手柄从"重建"改成"增量对账"**（Quiet `handle_targets` 每帧 clear+extend 的对应物）：build 改为 diff——按 `${from}:${to}:${type}:${empty}` key 复用已有 DOM，只增删差集；docChanged 时不重建、只对 docChanged 影响的 range 重算块列表（`getBlocks` 本来就是 O(改动块)，但 `parseMermaidBlocks(docText)` 全文正则要改成增量或砍掉，改用 Lezer FencedCode + info 串判断 mermaid）。
2. **位置改为"行盒同帧"**：把手柄定位从 ViewPlugin 的绝对定位元素改成**每行 `.cm-line` 内的伪元素/子元素**（CSS `::before` 或 CM6 decoration widget 挂在行首），垂直居中交给行盒布局——这直接消灭"coordsAtPos 未测量/首帧 0,0/长段 anchorPos 不跟随"三类问题，等价于 Quiet 的"laid out together with its block"。若保留浮动手柄，至少：`onDomPointerMove` 里更新 anchorPos 后**同步 position()**；`build()` 后强制 rAF reposition（已有，但只在构造时）。
3. **图标表对齐 Quiet**：按 Lezer 节点名映射到 1-6 级标题（`ATXHeading1..6`/`SetextHeading*` 都能直接给 level，不需要正则首行）、有序/无序/任务、引用/Callout/代码/表格/图片/HTML/Frontmatter；补 per-家族着色。`block-model.ts` 的 `Block` 已带 `level`（`block-model.ts:47`），手柄图标层却没用它——先接上。
4. **末尾空行协议**：view 层保证"文档末尾永远渲染一个虚拟空行手柄"——`doc` 末尾非空时在 `build()` 里对 `doc.length` 位置追加一个 `type:"" empty` 手柄，点击/悬停落点=文档末尾（可用零宽 decoration 行实现视觉空行），等价 Quiet 的 `trailing_line` 但不写进文档（或写入——Markdown 惯例允许尾空行）。空行判定改为"**Lezer 空段落**（Paragraph 且 text.trim()==''）或两块之间的空行"统一规则，消除 `covered()` 的树形依赖。
5. **hit 区域抄 Quiet**：命中带 = 块左缘外 60px ∪ 块行区域（不只左 25%）；命中优先级 = 范围最小（已实现 `hit.block.to - hit.block.from < ...`，保留）。

### 8.2 问题 2：输入卡顿、内容丢失、格式错乱、崩溃

**(a) Quiet 的做法**（§3.2-3.4）
- 键入只改**当前块内的一个小字符串区间**（`insert_plain`），runs 重建但代价 O(该块 runs)；
- 每次编辑走 `checkpoint`（快照）→ 改模型 → `fix_selection` → `reveal_caret` → 单帧渲染；
- 保存 500ms 防抖 + 2s 截止，失败有恢复路径；
- IME 全部经 `replace_in_block`（组合更新即 checkpoint），不绕过模型；
- 不变量由 fuzzer 随机验证 + 每步 `normalize`/`fix_selection` 兜底。

**(b) Clairis 病因**

1. **每个键入做 O(全文) 的字符串复制 + 全 store 广播**：`ContentArea.tsx:600-608`：
   ```ts
   EditorView.updateListener.of((update) => {
     if (update.docChanged) {
       const content = update.state.doc.toString();   // ← 每键全文 copy
       useStore.getState().updateTabContent(tabId, content);  // ← Zustand 全量替换
     }
   })
   ```
   `updateTabContent`（`stores/index.ts:673-684`）整体替换 tab 对象 → **所有订阅 `tab.content` 的 React 组件每键重渲染**（预览模式还有 `PreviewView` 整篇重渲染；属性面板 `parseFrontmatter(tab.content)` 每键重解析，`stores/index.ts:703`）。这就是"输入偶发卡顿"的第一来源。CM6 自己的渲染是增量的，被这一层全量同步抹平了。
2. **store→CM 反向同步是"全文替换 + 不进历史"**：`ContentArea.tsx:736-757` 的 effect 依赖 `tab?.content`，一旦发现 `view.state.doc.toString() !== tab.content` 就：
   ```ts
   view.dispatch({ changes: { from: 0, to: current.length, insert: tab.content },
     annotations: Transaction.addToHistory.of(false) });
   ```
   任何让两者短暂不一致的竞态都会触发**整篇替换**：
   - React 并发渲染 / effect 闭包里的旧 `tab.content`（effect 依赖数组 vs 最新 store 的时序差）；
   - 其他写 store 的路径（`refreshTabContent` `stores/index.ts:685-691`、HTML 可视化编辑回写 `ContentArea.tsx:880-887`、标题字段改写 `stores/index.ts:703-723` 的 `setFrontmatterField`——它会在打开文档时**改写 content 并标 dirty**）；
   - 两个面板（左右分屏）同时打开同一 tab（`updateTabContent` 按无面板 id 写 store，另一面板的 effect 立即全文替换它的视图——**丢光标位置、丢选区、丢 undo 连续性**）。
   整篇替换还会**重置 CM6 增量解析与视口**（性能+滚动跳动），且 `addToHistory.of(false)` 让用户 undo **不能恢复到替换前**——这就是"内容突然丢失且撤不回来"最可疑的机制。注释里自己写过案例（#321："一次 Ctrl+Z 会退回同步前的空文档，把整篇正文清空且无法恢复"）——该 case 修了，但**同类竞态（旧 content 回灌）并没有结构性消除**。
3. **格式错乱的来源**：Clairis 的"块"是 Lezer 树视图，所有结构操作都是**文本手术**。`smart-input.ts` 的智能回车/退格/缩进全靠正则匹配行文本（`smartEnter` `smart-input.ts:262-334`、`smartBackspace` `smart-input.ts:421-460`、`indentList/outdentList` `smart-input.ts:700-756`），边界情况必然漏：
   - `isInsideCodeBlock`（`smart-input.ts:336-349`）用**全文逐行数 ``` ** ——行内的 ` ``` ` 文本、嵌套围栏缩进（列表内 4 空格缩进的围栏首行是 `  ``` `，`trim().startsWith("```")` 能对上但普通文本行含 ``` 也误判）、`~~~` 围栏全不识别；而 Lezer 树 `FencedCode` 一查便知（`inProtectedRegion` 已经这么做了，`smart-input.ts:761-783`）。
   - `smartEnter` 只在 `main.head === line.to` 时接管（`smart-input.ts:270-272`），中段回车行为与列表续写不一致；有序列表续写 `parseInt(marker) + 1`（`smart-input.ts:307-310`）不识别 `1)` 格式与 Lezer 实际编号规则。
   - **markdown 语法 vs 装饰层的双轨**：`decorations/` 下 28 个装饰模块（heading/list/quote/callout/table…）各自正则/解析文本加 decoration，任何一个与 Lezer 视图不一致（例如 `structuralTags`、`alignFence` 的自定义语法）都会造成"看起来错乱"或"装饰残留"。Quiet 没有这一层——**渲染即模型**。
   - 崩溃风险：`posAtCoords`/`posAtDOM`/`domAtPos` 在未测量/视口外会 throw（`block-handle.ts` 里已有 try/catch 的一处 `lineRectAt`，但 `position()` 主路径 `coordsAtPos` 裸调用在 mermaid 分支外的 fallback `block-handle.ts:694-701` 有 try；`highlightBlock` 的 `posAtDOM` 每行一次 try/catch——捕获了但 O(lines) 慢）；更危险的是**手柄/菜单对失效 pos 的 dispatch**（`openBlockMenu(view, block, anchorPos)` 若 block 已被并发事务改变，anchor 夹取失败可 RangeError）。
4. **程序性 dispatch 的 undo 归属混乱**：`block-menu.ts:462`、`toolbar-shared.ts:157`、`OutlineMenu.tsx:328`、`block-handle.ts:842` 都是"全文替换"式 dispatch（拖拽重排、块转换、大纲跳转）。全文替换（a) 生成一个巨大 change set，undo 一步可回（好）；但（b) 因为 `moveBlock` 用 `trimNewlines` 规范化**非本次移动的块间空行**（`block-handle.ts:97-121` 的注释承认"移动后块与块之间用单个空行相接"），一次拖拽会把全文的 `\n\n\n` 都压缩——**未请求的格式改写**，用户视角就是"格式错乱"。Quiet 的 `move_blocks` 只动被拖块，其余逐字不动（`core.rs:2180-2220`）。

**(c) 修复建议**

1. **切断"每键全文 toString → store"**：store 只存"脏标记 + 节流快照"。两个方案取一：
   - 最小改：`updateListener` 里只 `updateTabContent` 改为写**节流版**（150-300ms 防抖 + 2s 截止，抄 Quiet `SAVE_DELAY/SAVE_MAX_DELAY` 语义），dirty 立即置位（保存/关闭拦截用 dirty，不用 content）；
   - 结构改：store 存 CM State 引用或版本号，需要 content 的消费者（预览/属性面板/搜索）自己从 view 读或订阅防抖流。属性面板解析改为只在 frontmatter 相关事务（transactionFilter 或 userEvent 过滤）后重跑。
2. **store→CM 同步改为"仅初始化 + 显式命令"**：effect 只在 `tab.id` 变化时灌入一次；此后**任何** content 回灌必须走显式函数（如 `replaceTabContent(tabId, text)`），且（a) 用最小 diff（CM6 `ChangeSet` 或简单公共前缀/后缀裁剪）而不是整篇替换，（b) 带语义 userEvent（`"input.program"`）并允许 undo（不加 `addToHistory.of(false)`，或作为独立分组 `isolateHistory`），（c) 调用前先确认 `view` 归属该 tab（currentTabIdRef 校验），杜绝旧闭包回灌。
3. **把"全文替换式 dispatch"收口**：拖拽/块转换/大纲跳转改为**最小 changes**——只对受影响块间的 gap 做 change（`moveBlock` 可以产出 splice 指令：`[{from: block.from, to: block.to}, {from: insertAt, insert: moved}]` 映射回原文档），放弃 `trimNewlines` 全文规范化；确需规范化空行，做成独立的、用户可感知的"格式整理"命令（带自己的 undo 步），不夹带在拖拽里。这是 Quiet `move_blocks` "before/after 比对、无变化不提交"精神的对应物。
4. **所有结构判断走 Lezer 树**：删掉 `isInsideCodeBlock` 的行数数 ```，改 `syntaxTree(state).resolveInner(pos, -1)` 向上找 `FencedCode`/`CodeBlock`（`inProtectedRegion` 已是这个模式，提出来复用）；智能回车/退格/缩进的行首标记识别用 Lezer `ListItem`/`Blockquote` 边界而非正则——**这不改变 CM6 架构，只是把"猜"换成"查"**。
5. **程序性 dispatch 前的选区/pos 防御**：所有从手柄/菜单发起的 dispatch 前重新读 `view.state`（不缓存 pos 跨事务），pos 先 `clamp` 到 doc.length；dispatch 统一 helper 里 catch RangeError 并记日志——崩溃点收口到一个函数。
6. **undo 分组显式化**（配合 §8.3）：`smart-input` 的每次 dispatch 补 `userEvent`（`"input.type"` 之外的用 `addToHistory.of(true)` + `isolateHistory: "app"` 或自定义组名），使"一次用户意图 = 一次 undo 步"，等价 Quiet 的 `EditKind` 分类（Typing 合并、Other 永不合并）。

### 8.3 问题 3：撤销/恢复有时无法还原

**(a) Quiet 的做法**（§3.3、§6）
- 每次变更前 `checkpoint` 拍**全量快照**，undo 恢复文档+选区+折叠外围态，`fix_selection` 兜底；
- 打字 700ms 合并、结构操作各自独立步、markdown 转换两步设计；
- move_blocks 无变化不进历史；undo/redo 后 redo 栈正确交替；
- 版本抽屉预览**整体保留 Core（含 undo 栈）**，返回即还原。

**(b) Clairis 病因**

1. **history 被旁路清除/绕过**：
   - 切页签 `historyCompartment.reconfigure([])` 再 `reconfigure(history())`（`ContentArea.tsx:720-727`）——设计如此（#321），但副作用是**一次面板内页签切换 = undo 栈全清**，用户在 A 页签打字、切 B 再切回，undo 没了。Quiet 没有"页签共享 view"概念（每文档一个 Core）。
   - store→CM 全文同步 `addToHistory.of(false)`（§8.2 病因 2）——**任何**触发同步的竞态都产生一个"历史之外的文档状态"，undo 链在这一点断开：undo 一步回到替换前的内容，而替换后的变更（若用户已打字）丢失或重叠错乱。
   - 程序性 dispatch 若不带 `userEvent`，CM6 history 按"相邻 input.type 合并"规则可能把拖拽/转换与后续打字**并成一步**，用户感觉"一次 ⌘Z 回退过头/回不到位"。
2. **`Mod-[`/`Mod-]` 绑定成 undo/redo**（`setup.ts:93-94`）：`Mod-[` 在 CM 默认键位是 `indentLess`、`Mod-]` 是 `indentMore`。现在 Tab 缩进由 `indentWithTab` 处理，而 `Mod-[` 被改绑 undo——用户习惯性的"取消缩进"变成撤销，误触后又要 undo 回来，体感就是"撤销错乱"。（这大概率是迁移期遗留，值得核对设计稿。）
3. **undo 跨"模式切换/重配置"不保**：`decorCompartment` 在 edit/source 切换时重配（`setup.ts:44-50` 注释），CM6 的 history field 本身保留，但**装饰重建可能触发 selection reset 或 readOnly 事务**，若期间有 dispatch（如 frontmatter 重写 `stores/index.ts:703-723`），undo 栈里混入了"打开文档时改写标题字段"这种程序步骤——用户 ⌘Z 第一跳是标题改写回退，而不是自己的编辑。
4. **没有"undo 后选区校验"层**：CM6 的 selection mapping 处理映射，但全文替换类 change（§8.2）映射后的选区可能落在 widgets/装饰区（mermaid 整块 widget、fold 隐藏区），视觉上"光标消失"≈"恢复失败"。

**(c) 修复建议**

1. **约定"历史边界"三原则**（对应 Quiet checkpoint 语义，落地为 code review 规则 + 单测）：
   - 一切**用户可感知**的文档变更必须带 `userEvent`；
   - 一切**程序性回灌**（打开/外部修改/模式切换）不得进历史，但**必须紧跟一次 `view.dispatch` 的 `annotate(isolateHistory)` 或在 undo 前打断**，且不允许发生在用户编辑事务之间（排队到 idle）；
   - 结构性命令（拖拽/转换/缩进/智能回车）每意图一个 `isolateHistory` 组，打字由 CM6 默认合并——等价 `EditKind::Other 永不合并 / Typing 700ms 合并`。
2. **页签切换不丢 undo**：两个方案：
   - 每面板一 view 的现状下，把 `HistoryState` 存到 tab 级（切换时 `view.dispatch` 前保存 `historyField.state`，回来时用 `HistoryState.of`/自定义 StateEffect 恢复）——工程量中等，收益是跨页签 undo 保留；
   - 或退一步：切换时**不清**而用 per-tab doc+selection+history 快照（CM6 `EditorState.toJSON` 不含 history，需要自存 HistoryState）。至少要在 UI 上把"切页签清 undo"变成可感知行为（切回时 undo 不可用的状态不再误导）。
3. **移除/恢复 `Mod-[`/`Mod-]`**：改绑 `indentLess/indentMore` 或干脆移除该绑定，让 `ctrlHistoryBindings` 只管 `Mod-z`/`Mod-Shift-z`/`Mod-y` 与 Ctrl 系。
4. **全文替换改为最小 diff + 可撤销**（同 §8.2 建议 2）：最小 diff 本身就消除了大部分"历史外状态"；必须替换时用 `annotations: isolateHistory.of("sync")` + 记录替换前 HistoryState，undo 先跳过 sync 组。
5. **undo 链自检（对齐 Quiet fuzzer 思想）**：加一个 dev/单测钩子——随机执行"输入/删除/拖拽/转换/切页签/外部回灌"序列后，断言 `undo 全部 + redo 全部` 后 `doc.toString()` 与起点一致、选区合法。现有 `src/__tests__/` 只有 store 测试，编辑器层没有这个不变量测试——这是最高性价比的一条：**Quiet 之所以敢说 undo 稳定，不是因为快照大，而是因为 fuzzer 天天打它**。

---

## 9. 一页纸对照表

| 关注点 | Quiet.md | Clairis 现状 | 可抄 |
|---|---|---|---|
| 块真相 | 块树（单一真相） | Lezer 树视图（Markdown 明文为真相） | 交互参数/边界行为；模型级重构不建议 |
| 手柄 | 块行内同帧布局；20 型图标；空段→"+"；尾空段常驻 | ViewPlugin 全量重建 DOM；图标缺级；空行判定随树漂 | 同帧行盒定位、hit 区域、图标表、末尾虚拟空行协议 |
| 输入 | 每键 O(块) 改模型 | 每键 O(doc) toString→store→React 全广播 | 节流/去全量同步；保存防抖+截止 |
| 格式稳定 | 结构变更=Core 函数+normalize+fix_selection | 正则文本手术 + 28 个装饰模块双轨 | 结构判断走 Lezer；拖拽不夹带全文规范化 |
| undo | 全量快照+700ms 合并+Other 不合并+fuzzer | CM6 history + 三类旁路（reconfigure/addToHistory(false)/缺 userEvent） | 三条历史边界原则、HistoryState 跨页签、undo 自检测试 |
| 悬停时序 | 打字即藏、动即显；无 show 延迟 | 300ms show/150ms hide/60ms 菜单/120ms 关闭 | Quiet 更跟手；可把 show 延迟降到 0-100ms 并保留 hide 缓冲 |

> 附注：本报告的行号基于 `quiet-md-main` 与 `clairis` 当前 checkout；若后续两仓有合并，先 grep 函数名再对行。
