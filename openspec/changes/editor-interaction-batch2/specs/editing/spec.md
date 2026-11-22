## ADDED Requirements

### Requirement: E-42 块手柄增量对账与块型图标

编辑态块手柄 SHALL 按「顶层块序号 + 块类型」键做增量对账：纯内容变更（键不变）SHALL 只重算几何、不重建手柄 DOM；插入/删除/类型变化 SHALL 只重建受影响块及其后的手柄。手柄位置 SHALL 以块首行渲染元素的行盒为准，SHALL NOT 以多层 `coordsAtPos` 兜底作为主路径；块不在视口内时 SHALL NOT 渲染手柄。

每个块型 SHALL 映射到唯一的手柄图标：既有 `blockHandleIcon` / `BLOCK_ICON_NAME` 已按 heading 级别取 H1–H6、按有序/无序取列表图标、按图片首行扩展名取 Video/Audio/Image；本批 SHALL 为 `htmlBlock` 与 `yamlFrontMatter` 补齐明确条目，使其不再回退默认拖拽图标。文档末尾 SHALL 提供不落盘的「+」入口，点击插入空段落并聚焦；该入口 SHALL NOT 写入文档、SHALL NOT 进入撤销历史。

#### Scenario: 输入后手柄贴住块首行且不重建

- **WHEN** 用户在一个长段落中连续输入若干字符
- **THEN** 手柄矩形上沿与该块首行行盒上沿的垂直偏差 SHALL ≤ 1px，且手柄根节点的 DOM 标识在输入前后保持不变

#### Scenario: 块型变化只重建受影响手柄

- **WHEN** 用户把一个段落转换为标题，再插入一个新段落
- **THEN** 仅该段落与受影响之后的节点被替换，其余手柄节点复用；文档中不被影响的块手柄数 SHALL 严格等于转换前减去受影响的数量

#### Scenario: 文末「+」插入段落

- **WHEN** 用户在文档最末块之后点击「+」入口
- **THEN** SHALL 新增一个空段落且光标落入其中，文档末尾严格等于「原末尾内容 + 一个空段」；按一次撤销后该空段消失

### Requirement: E-43 拖拽重排只作用于被移动区间

用块手柄拖拽重排 SHALL 只对被移动区间做换行规范化，其余字节 SHALL 逐字保留。一次拖拽重排 SHALL 是单个 undo 步，撤销一步 SHALL 完全还原本次移动且不产生其它空行变化。

#### Scenario: 拖块后仅区间规范化

- **WHEN** 用户把第 2 段拖到第 1 段之前并松手
- **THEN** 除两段之外文档其余字节严格等于操作前，且一次撤销后文档与操作前逐字节相同

### Requirement: E-44 图片裁剪坐标系与保存可靠性

进入图片裁剪前 SHALL 等待图片加载完成（`img.complete` 或 load 事件），2s 超时 SHALL 放弃并提示，SHALL NOT 在 `scale <= 0` 时静默失败。框选、拖动与写回 SHALL 使用同一显示坐标系；写回时 SHALL 只把显示矩形换算为原图分数一次。保存 SHALL 同时由显式保存按钮与 window 级 `pointerup` 触发，SHALL NOT 依赖裁剪框存活；Esc SHALL 取消且不写回。

#### Scenario: 裁剪缩放不跳变

- **WHEN** 用户打开裁剪、拖动裁剪框后保存
- **THEN** 保存前后图片显示宽度的比值 SHALL 严格等于 1，裁剪框矩形与 `crop` 值 SHALL 一一对应

#### Scenario: 保存不随裁剪框销毁丢失

- **WHEN** 用户在裁剪过程中触发一次装饰重建（裁剪框被销毁）后再松手
- **THEN** 裁剪结果 SHALL 仍被写回，源码 `crop` 属性 SHALL 等于最终显示矩形换算值；若最终取消则 SHALL NOT 残留裁剪框

### Requirement: E-45 列表层级缩进与编号一致性

列表 Tab/Shift-Tab SHALL 按当前 marker 宽度递进/回退，非列表行 SHALL 保持默认行为。深度上限 SHALL 为 6。空项回车 SHALL 三态判定：空项且有子项 → 退一层；空项且无子项 → 退出列表；非空项 → 同级新项。有序列表编号 SHALL 在编辑态按同级序号计算显示，并在列表结构变化（回车、缩进、删除、转换）时同步重写源码字面量，使编辑态与预览一致。

#### Scenario: 缩进到第六层

- **WHEN** 用户在同一列表项上连续按 5 次 Tab
- **THEN** 该项深度 SHALL 等于 5（相对首层），第 6 次 Tab 后深度不再增加（上限 6）

#### Scenario: 空项逐级退出

- **WHEN** 用户在一个有子项的空列表项上按回车，随后在无子项的空项上按回车
- **THEN** 第一次回车后该项退一层且子项保留；第二次回车后该项退出列表成为同级段落，列表项数减少 1

#### Scenario: 编号随结构重算

- **WHEN** 用户在两个有序项之间插入一个新项并回车
- **THEN** 编辑态显示编号 SHALL 依次为 1、2、3，源码中的有序编号字面量 SHALL 与显示一致

### Requirement: E-46 分栏编辑防双活与 stale 提交

分栏单元格的编辑窗口与宿主 SHALL NOT 同时接收输入：存在 `.cm-column-editor` 时 SHALL 冻结该分栏 widget 的销毁/重建，关闭后 SHALL 强制刷新一次。`commit` SHALL 用围栏首行内容或 `cols:` 属性串匹配目标栏，SHALL NOT 只依赖打开时的 `from` 偏移；匹配失败 SHALL 把 textarea 文本回填宿主并 toast 提示，SHALL NOT 静默丢弃。

#### Scenario: 编辑期间位移不丢字

- **WHEN** 用户在分栏单元格 A 输入内容，期间文档在 A 之前插入了一个新块使 A 的偏移改变，然后切走焦点触发 commit
- **THEN** A 的新内容 SHALL 落回正确单元格，页面 SHALL 出现可见提示；未匹配到栏位时文本 SHALL 回填且不含丢失

#### Scenario: 只有一个输入窗口

- **WHEN** 用户打开某分栏单元格的编辑窗口后再点击同一单元格
- **THEN** `.cm-column-editor` 节点数 SHALL 严格等于 1，且两个窗口不同时接收输入

### Requirement: E-47 块类型图标一致性

本批触及的块类型图标 SHALL 按设计系统 §2 收敛：语义唯一、笔画密度 ≤6、尺寸落在 14/18/24 档、成对语义一致。同一语义在手柄与块菜单 SHALL 取同一个 `data-icon` 名：表格块统一改用网格语义图标，SHALL NOT 使用图表语义的 `TableChartOutlined`；引用块 SHALL 统一为 `FormatQuoteOutlined`。`htmlBlock` 与 `yamlFrontMatter` SHALL 各有明确的自有图标条目。全部图标 SHALL 来自本仓图标词表与自有 SVG，SHALL NOT 复用 Quiet.md 的图形资产。

#### Scenario: 图标词表唯一

- **WHEN** 用户召唤任一受支持块型的手柄与块菜单
- **THEN** 同一语义在手柄与菜单的 `data-icon` 名 SHALL 严格相等，且引用块 `data-icon` SHALL 为 `FormatQuoteOutlined`

#### Scenario: 表格图标为网格语义

- **WHEN** 用户查看表格块的柄/菜单图标
- **THEN** `data-icon` SHALL 指向网格图标条目，SHALL NOT 为 `TableChartOutlined`；该条目满足 §2 笔画与尺寸约束
