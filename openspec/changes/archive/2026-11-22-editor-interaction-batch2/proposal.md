# Proposal — editor-interaction-batch2：Quiet.md 学习报告 批次 2：交互止血 + 图标一致性

## Why

批次 1（同步与历史语义）已合入归档，但用户每天都摸到的四类交互仍在放大那份不稳的地基：手柄在每次文档变化时整组重建、位置靠多层兜底；图片裁剪的显示坐标与写回坐标不是同一套；列表深度写死 3 层、编号不重算；分栏编辑双活且 stale 匹配静默丢字。结论来自 `docs/research/competitors/quiet-md-逆向学习总报告.md` §3.1 批次 2（第 5–8 项），并经本仓 HEAD 一手源码实读定位到行号：

- **手柄不稳、看不懂**：`src/editors/orchestration/block-handle.ts:270` 在 `docChanged` 时无条件 `build()` 全量重建；`:687` 用 `coordsAtPos` 三层兜底猜位置。手柄已有按块型的 `BLOCK_ICON_NAME` / `blockHandleIcon`（含 H1–H6、有序/无序、图片/视频/音频），但 `htmlBlock` / `yamlFrontMatter` 无条目、回退 `DragHandleOutlined`；文末没有「+」入口。
- **图片裁剪会跳、会丢**：`src/editors/decorations/imageCrop.ts:112/147/183` 混用 `object-fit:none + object-position` 与另一套 scale；`:148` 图片未加载完时 `scale <= 0` 静默失败；`:295` 保存挂在裁剪框的 `pointerup`，装饰重建销毁框后保存丢失。
- **列表层级与编号不跟手**：`src/editors/decorations/list.ts:58` 把深度封顶为 `Math.min(3, …)`；Tab 宽度与分层规则不一致；空项回车不分「退一层 / 退列表」；有序编号是源码字面量，结构变化不重算。
- **分栏编辑双活与静默丢字**：`src/editors/decorations/columns.ts:198` 只用打开时的 `blockFrom` 偏移找围栏，文档位移后匹配落空即静默返回；`.cm-column-editor` 存在时装饰仍可能再开一套输入窗口。
- **块类型图标不统一**：跨入口同语义不一致——table 手柄用 `DataSheetOutlined` 而命令/块菜单用 `TableChartOutlined`，quote 手柄用 `ReferenceOutlined` 而 `insert-quote` 用 `FormatQuoteOutlined`；`htmlBlock` / `yamlFrontMatter` 无条目回退 `DragHandleOutlined`；笔画密度与尺寸档未按设计系统 §2 收敛。

这些都不需要改文档模型，是批次 1 收口后在现有架构内可止血的部分，且每一条都能在页面上被用户直接看到。

## What Changes

1. **手柄**：`docChanged` 改为按「顶层块序号 + 块类型」键做增量对账，纯内容变更只重算几何不重建 DOM；位置以块首行行盒为准，移除 `coordsAtPos` 三层兜底，视口外不渲染；沿用既有 `blockHandleIcon` 映射并补齐 `htmlBlock` / `yamlFrontMatter` 条目；文末提供不落盘的「+」入口。
2. **拖拽重排局部化**（批次 1 移交）：`moveBlock` 只替换被移动区间，不再全文 `trimNewlines` 规范化。
3. **图片裁剪**：统一到单一显示坐标系；进入前等 `img.complete` / load（2s 超时提示）；保存改为「保存按钮 + window 级 pointerup」双入口，不依赖裁剪框存活。
4. **列表**：Tab/Shift-Tab 列表感知缩进；空项回车三态（同级新项 / 退一层 / 退列表）；深度上限 3 → 6；有序编号在编辑态按同级序号计算显示，并在结构变化时同步源码字面量。
5. **分栏**：`commit` 改用围栏首行内容或 `cols:` 属性串匹配目标栏；失败回填并 toast；`.cm-column-editor` 存在时冻结该分栏 widget 的销毁/重建。
6. **块类型图标一致性**：按设计系统 §2（≤6 笔画、14/18/24 三档、成对语义）收敛本批触及的块类型图标；统一 table 的手柄与菜单图标并改为网格语义、统一 quote 为 `FormatQuoteOutlined`、补 `htmlBlock` / `yamlFrontMatter` 明确图标。全部使用本仓图标词表与自有 SVG，**不复用 Quiet.md 的图形资产（版权约束）**。

## Capabilities

### New Capabilities

（无。本批全部是对既有 `editing` 能力行为的加固与新增 requirement，不新建能力域。）

### Modified Capabilities

- `editing`：新增 E-42 手柄增量对账与块型图标、E-43 图片裁剪坐标系与保存可靠性、E-44 列表层级缩进与编号一致性、E-45 分栏编辑防双活与 stale 提交、E-46 块类型图标一致性收敛。既有 E-7/E-28/E-39 等不删除、不改写，新要求并行生效。

## Impact

- **受影响代码**：`src/editors/orchestration/block-handle.ts`（docChanged 对账、行盒定位、moveBlock、扩展 `BLOCK_ICON_NAME` 补 htmlBlock/yamlFrontMatter）、`src/editors/decorations/imageCrop.ts`、`src/editors/decorations/list.ts`、`src/editors/decorations/columns.ts`、`src/editors/icons.ts`（新增自有网格/frontmatter/html 图标注册、统一 table 与 quote 图标）、相关 e2e 与单测。
- **接口**：不新增第二张块型映射表——`block-handle.ts` 沿用并扩展既有 `BLOCK_ICON_NAME`；`icons.ts` 仅新增图标注册条目；`moveBlock` 的重排区间契约不变，仅内部规范化范围收敛。
- **用户可感知**：长段落/滚动后手柄贴住块首行、多数块型图标保持正确且 htmlBlock/frontmatter 不再回退、文末可直接加段；拖块撤销一步只回退本次移动；裁剪缩放不跳变、点得快也存得上；列表能缩到第 6 层、空项逐级退出、编号即时正确；分栏不再双活、stale 时有提示；表格/引用等图标跨入口语义统一且表格更像「表格」。
- **数据面**：本批触及 `src/editors/icons.ts`（图标词表 SSOT），命中数据面信号路径，design.md 落六栏表；5.4 票声明负责落点。
- **版权**：不复用 Quiet.md 的任何图形资产；仅用本仓 `src/ui/icons.ts` 词表与本仓自有 SVG path。
