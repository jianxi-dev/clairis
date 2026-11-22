# Design — editor-interaction-batch2：Quiet.md 学习报告 批次 2：交互止血 + 图标一致性

## 规范前置核对（设计系统与源码事实）

- **设计系统 §2 图标系统**（`docs/design/system/spec.md` §2.1–§2.6）：网格与笔画（≤6 笔画）、尺寸档 14/18/24、成对语义、形状定案归 `docs/design/system/decisions.md` 台账。本批新增/替换的块型图标一律以 §2 为判据；单点裁决（表格网格图标、引用图标统一）append 到台账。
- **ADR 0004**：store 只存纯文本，`EditorView` 在模块级 Map——本批不改 store 内容模型，只改装饰层行为。
- **一手源码实读**（写 design 时已核对）：
  - `src/editors/orchestration/block-handle.ts:270` `if (update.docChanged) this.build();` 无条件全量重建；`:415 build()`；`:656-687` 先 DOM 行盒、再 `coordsAtPos`、再 `documentTop` 三层兜底；`:112 trimNewlines` / `:139-141 moveBlock` 对被移动区间外的文本做全文规范化。
  - `src/editors/decorations/imageCrop.ts:112 probe.onload`、`:147 scale = fullW/natW`、`:148 if (!(scale > 0)) return`、`:183-189 objectPosition/width/height`、`:295 frame.addEventListener("pointerup", finish)`。
  - `src/editors/decorations/list.ts:57-58 indentLen` → `Math.min(3, Math.floor(indentLen/2))`。
  - `src/editors/decorations/columns.ts:164 .cm-column-editor`、`:193-207 commit`（按 `b.from === blockFrom` 查找）、`:530 container.querySelector(".cm-column-editor")`。
  - `src/editors/orchestration/block-handle.ts:48 BLOCK_ICON_NAME`：现有 table→`DataSheetOutlined`、list→`DisorderListOutlined`、task→`TodoOutlined`、callout→`CalloutOutlined`、blockquote→`ReferenceOutlined`、paragraph→`FormatParagraphOutlined`、thematicBreak→`DividerOutlined`、fencedCode/codeBlock→`CodeblockOutlined`、image→`ImageOutlined`；`:91 blockHandleIcon(type, firstLine)` 已按 heading 级别返回 H1–H6、按有序/无序返回 Order/DisorderListOutlined、按图片首行扩展名返回 Video/Audio/ImageOutlined，未知类型回退 `DragHandleOutlined`。`htmlBlock` 与 `yamlFrontMatter` 无条目。
  - `src/editors/icons.ts`：已注册 `ImageOutlined`、`DividerOutlined`、`HorizontalRuleOutlined`、`DragHandleOutlined`、`AudioOutlined`、`VideoOutlined`、`TableChartOutlined`、`FormatQuoteOutlined`、`ReferenceOutlined`、`DataSheetOutlined`；`hasIcon` / `renderIconInto` / `ICON_REGISTRY`。跨入口现状：`COMMAND_ICON_NAME` 的 `insert-table`/`turn-into-table` 用 `TableChartOutlined`，`insert-quote` 用 `FormatQuoteOutlined`，`turn-into-quote` 用 `ReferenceOutlined`。

## D1 手柄增量对账 + 行盒定位（5.1）

- **现状**：`docChanged` 即 `build()`，每次都把全部手柄节点销毁重建，长段落与滚动后位置靠 `coordsAtPos` 多层兜底，容易闪跳/偏行（`:270`、`:656-687`）。
- **决策**：
  1. 手柄集合以「顶层块序号 + 块类型 + 解析出的图标名」为键。`docChanged` 时先对账：键集合不变 → 只重算几何（行盒）并同步块范围、重置 hover 可见态（旧 hover 对新区间失效），DOM 不重建；插入/删除/类型/图标变化 → 只重建受影响块及其后的手柄。图标渲染在 DOM 上，no-rebuild 路径不刷新图标，标题级别 / 有序无序 / 媒体类型变化必须进键才能触发重建。
  2. 位置以块首行渲染元素的行盒为准（`getBoundingClientRect` / 行元素几何）；测量失败或块不在视口内 → `display:none` 隐藏，下一帧 / 下次几何变化再重试；不使用 `coordsAtPos` / `documentTop` 兜底。mermaid 例外：整块 widget 取 widget 矩形并按指针 Y 夹取（沿用 A-3），不适用首行行盒。
  3. 块不在视口内时不渲染手柄。
- **理由**：DOM 重建是闪跳的直接来源；行盒是用户真实所见的位置，比高度图推算稳定。
- **风险**：对账键选取不当会漏更新或过度重建。缓解：键契约由单测钉死（序号+类型+图标变化才重建），e2e 断言输入/删除/滚动后手柄贴住块首行且 DOM 节点复用。
- **回滚**：还原为 `docChanged → build()` 全量重建（仅失去稳定性，功能不丢）。

## D2 手柄图标映射补齐与文末「+」入口（5.2）

- **现状**：`block-handle.ts:48 BLOCK_ICON_NAME` 已覆盖多数块型，`:91 blockHandleIcon` 已按 heading 级别、有序/无序、图片扩展名解析图标；但 `htmlBlock` 与 `yamlFrontMatter` 在 `BLOCK_ICON_NAME` 无条目，一律回退 `DragHandleOutlined`，表象不明确；文末没有「+」入口。
- **决策**：
  1. 沿用并扩展 `block-handle.ts` 的 `BLOCK_ICON_NAME`，补齐 `htmlBlock` / `yamlFrontMatter` 两个条目（值取本仓已注册图标名），使这两类块不再回退 `DragHandleOutlined`；既有条目保持不变。5.2 只负责该映射补齐 + 文末「+」入口，不新建第二张映射表。
  2. 文末最后一个块之后渲染不落盘的 `+` 形态手柄（`ADD_ICON_NAME`）；点击插入空段落并聚焦；该入口不写入文档、不进撤销历史。
- **理由**：多数块型图标已就位，真实缺口只是两个无条目块型；文末「+」消除「先把光标移到末尾」的空操作。
- **风险**：补齐条目若破坏 §2 笔画/尺寸约束会被门禁抓。缓解：新增条目一律走 §2 判据，单点裁决落台账（D7）。
- **回滚**：恢复原 `BLOCK_ICON_NAME` 条目并移除文末「+」节点，`htmlBlock`/`yamlFrontMatter` 回到 `DragHandleOutlined` 回退。

## D3 moveBlock 局部化（5.3，批次 1 移交）

- **现状**：`moveBlock` 对 `before`/`after`/`moved` 三段都跑 `trimNewlines`（`:139-141`），一次拖块把整篇空行规范化，撤销一步却看到全文变化。
- **决策**：只对**被移动区间**做换行规范化，其余字节逐字保留；重排仍走单次 dispatch，选择自动映射与光标不跳语义不变。
- **理由**：拖拽意图的作用域是被移动的块，全文规范化超出意图边界。
- **风险**：旧行为依赖全文规范化产生的排版。缓解：e2e 断言移动前后除目标区间外文档逐字节不变，且一次撤销完全还原本次移动。
- **回滚**：恢复三段 `trimNewlines`（回到批次 1 前行为）。

## D4 图片裁剪坐标系与保存可靠性（6.1）

- **现状**：进入裁剪用 `object-fit:none + object-position` 与另一套缩放（`:183-189`）；图片未加载完时 `scale <= 0` 静默返回（`:147-148`）；保存挂在裁剪框 `pointerup`（`:295`），装饰重建销毁框后保存丢失。
- **决策**：
  1. 进入前等 `img.complete`；未完成则监听 `load`，2s 超时后放弃并提示。
  2. 以清空裁剪样式后的整图显示宽度计算唯一 scale；框选、拖动、保存都在同一显示坐标里换算，写回时只把显示矩形换算成原图分数一次。
  3. 保存双入口：显式「保存」按钮 + window 级 `pointerup`；裁剪框被销毁时由 window 监听兜底完成或取消；Esc 取消不写回。
- **理由**：单一坐标系是「显示=写回」的前提；window 级监听解除保存对裁剪框存活的依赖。
- **风险**：显示宽度测量时机错误导致 scale 偏差。缓解：单测覆盖显示矩形→原图分数换算；e2e 断言裁剪后图片下方空白 ≤ 8px、缩放不跳变。
- **回滚**：还原进入裁剪的旧样式路径与 frame pointerup 保存（回到当前行为）。

## D5 列表层级缩进与编号一致性（7.1 / 7.2）

- **现状**：`list.ts:58` 深度封顶 3；Tab 宽度与分层规则不一致；空项回车不分「退一层/退列表」；有序编号是源码字面量不重算。
- **决策**：
  1. Tab/Shift-Tab 按当前列表 marker 宽度递进/回退；非列表行保持默认行为。
  2. 空项回车三态：「空项 + 有子项 → 退一层」「空项 + 无子项 → 退列表」「非空项 → 同级新项」。
  3. 深度上限 3 → 6。
  4. 编辑态按同级序号渲染计算值；列表结构变化（回车、缩进、删除、转换）时同步重写源码中的有序编号字面量。
- **理由**：三态与深度上限直接决定用户能否逐级退出；编号同步保证编辑态与预览一致。
- **风险**：编号重写误伤非列表数字文本。缓解：只在有序列表结构变化路径触发，单测覆盖嵌套/删除/缩进后源码字面量。
- **回滚**：还原 `Math.min(3, …)`、单态回车与字面量编号。

## D6 分栏防双活与 stale 提交（8.1）

- **现状**：`columns.ts:198` 只用打开时的 `blockFrom` 偏移找围栏，文档位移后匹配落空静默返回（丢字无提示）；`.cm-column-editor` 存在时装饰仍可能再开一套输入窗口（双活）。
- **决策**：
  1. `commit` 用围栏首行内容或 `cols:` 属性串匹配目标栏，而不是单靠 `from` 偏移；匹配失败把 textarea 文本回填宿主并 toast 提示。
  2. `.cm-column-editor` 存在时冻结该分栏 widget 的销毁/重建；关闭后强制刷新一次。
- **理由**：内容匹配对位移鲁棒；冻结重建消灭双输入窗口。
- **风险**：属性串重复导致多栏匹配歧义。缓解：优先用内容匹配，属性串做次级锚点；e2e 断言编辑位移后切走不丢字且有提示。
- **回滚**：还原 `from` 偏移匹配与既有重建路径。

## D7 块类型图标跨入口一致性收敛（5.4，数据面票）

- **现状**：同一语义跨入口不一致——手柄 `BLOCK_ICON_NAME` 的 table 用 `DataSheetOutlined`，命令/块菜单 `COMMAND_ICON_NAME` 的 table 用 `TableChartOutlined`；手柄 blockquote 用 `ReferenceOutlined`，命令 `insert-quote` 用 `FormatQuoteOutlined`、`turn-into-quote` 用 `ReferenceOutlined`。另有两个回退项：`htmlBlock` 与 `yamlFrontMatter` 无条目、回退 `DragHandleOutlined`。§2 一致性审计要求新增/替换条目满足 ≤6 笔画、14/18/24 档、成对语义，表格类图标需要一张更明确的网格图形。
- **决策**：以设计系统 §2 为判据（≤6 笔画、14/18/24 三档、成对语义），收敛本批触及的块类型图标：统一 table 的手柄与菜单图标（弃 `TableChartOutlined` 图表语义，改用自有网格 SVG 条目）；统一 quote 为 `FormatQuoteOutlined`；补齐 `htmlBlock`/`yamlFrontMatter` 的明确图标；对新增/替换条目做 §2 审计。单点裁决（表格图标=网格语义、引用图标统一）append 到 `docs/design/system/decisions.md`。**不复用 Quiet.md 的任何图形资产（版权约束）**，只用本仓 `src/ui/icons.ts` 词表与本仓自有 SVG path。
- **数据面**：见下方六栏表；5.4 票负责全部六行的落地与验收。
- **风险**：图标词表两套（`src/ui/icons.ts` 与 `src/editors/icons.ts`）漂移。缓解：判据要求本批新增只进 `src/editors/icons.ts` 的 `ICON_REGISTRY`，消费侧（手柄 `blockHandleIcon`）按名字读，不新增第二张映射表（见数据面约束 2）。
- **回滚**：恢复 `BLOCK_ICON_NAME`/`COMMAND_ICON_NAME` 原条目，恢复原 `TableChartOutlined` / 混用引用图标，移除新增网格条目。

## 风险与回滚汇总

| 决策 | 回滚方式 |
|---|---|
| D1 手柄增量对账/行盒定位 | 还原 `docChanged → build()` 全量重建 + coordsAtPos 主路径 |
| D2 图标映射补齐 + 文末「+」 | 恢复原 `BLOCK_ICON_NAME` 条目并移除「+」节点 |
| D3 moveBlock 局部化 | 恢复三段 `trimNewlines` |
| D4 裁剪坐标系 | 还原旧进入路径与 frame pointerup 保存 |
| D5 列表 | 还原深度 3、单态回车、字面量编号 |
| D6 分栏 | 还原 from 偏移匹配与既有重建 |
| D7 图标收敛 | 删新增条目，恢复旧图标 |

## 与既有 change 的边界

- `editor-foundation-batch1`（已归档）：提供同步与历史语义，本批不改其范围。
- `editor-surface-batch20`（进行中）：本批只动 `block-handle.ts`/`imageCrop.ts`/`list.ts`/`columns.ts`/`icons.ts`，与其表面票文件切面无交集；实现阶段按 G1 overlap 预检处理。
- 批次 3–5（高亮、表格块树、引用/提醒）不在本批。

## 数据面

> 信号命中：`src/editors/icons.ts` 在 `DATA_SURFACE_PATHS` 中；文案命中「图标」。六栏如下，5.4 票认领全部六行。

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 新增/替换的块型图标须满足 ≤6 笔画、尺寸落 14/18/24 档、成对语义，且经台账单点裁决 |
| 存储 | src/editors/icons.ts | ICON_REGISTRY | 图标名唯一 SSOT：新增/替换的块型图标（含 table 网格、quote 统一）先注册进 `ICON_REGISTRY`，值必须是已注册图标名 |
| 校验 | src/editors/icons.ts | hasIcon | 未注册图标名拒绝渲染（hasIcon 为 false），渲染层回退 `HANDLE_DEFAULT_ICON` |
| 桥接 | src/editors/icons.ts | renderIconInto | 消费侧按名字取 SVG，`data-icon` 属性即词表 token，两处图标表不漂移 |
| 消费 | src/editors/orchestration/block-handle.ts | blockHandleIcon | 手柄按块型读 `BLOCK_ICON_NAME`，与命令/块菜单读 `COMMAND_ICON_NAME` 的同一语义取同一 `data-icon` 名，不新增常量数组 |
| 回滚 | docs/design/system/decisions.md | 单点裁决行 | append-only 台账记录裁决与来源，误改可一步回落到原图标名/默认图标 |
