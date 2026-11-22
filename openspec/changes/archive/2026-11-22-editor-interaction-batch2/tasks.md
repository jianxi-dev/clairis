# Tasks — editor-interaction-batch2

> 切片原则：每张票贯穿「入口 → 行为 → e2e」，做完用户能在界面上看到变化。
> 票标题前缀 `[change=editor-interaction-batch2/<任务号>]`；1 任务 = 1 票。
> 依赖：5.2 Blocked by 5.1；5.4 Blocked by 5.2；7.2 Blocked by 7.1；其余无依赖。
> 集成 checkpoint（QG-6）：本 change 8 票，每完成 ≤4 票合并到集成分支并在浏览器走查一次。

## 1. 手柄与图标

- [x] 5.1 手柄增量对账 + 行盒定位
  - `docChanged` 按顶层块序号+块类型做键对账：键不变只重算几何；插入/删除/类型变化只重建受影响块及其后手柄
  - 位置以块首行行盒为准；视口外不渲染；移除 `coordsAtPos` 三层兜底作为主路径
  - AC：在 `npm run dev` 打开页面，长段落连续输入后手柄上沿与首行行盒偏差 ≤ 1px 且 DOM 标识不变；把段落转标题后仅受影响手柄被替换；块滚出视口后手柄节点数为 0，取消滚动后恢复（取消/残留）
  - e2e：`e2e/editors/handle-incremental.spec.ts`
  - **视觉锚点**: design-system:§3; ledger:手柄菜单宽度
  - **数据面**: 无

- [x] 5.2 扩展 `BLOCK_ICON_NAME` 补齐 htmlBlock/yamlFrontMatter + 文末「+」入口（Blocked by 5.1）
  - 扩展 `block-handle.ts` 的 `BLOCK_ICON_NAME`，补齐 `htmlBlock` / `yamlFrontMatter` 两个条目（值取本仓已注册图标名），既有条目保持不变；不新建第二张映射表
  - 文末渲染不落盘的「+」手柄，点击插入空段落并聚焦，不进撤销
  - AC：在 `npm run dev` 打开页面，指针移到 H1/H2/列表/引用/表格/图片块上时手柄 `data-icon` 仍与既有映射一致；`htmlBlock` / `yamlFrontMatter` 块手柄 `data-icon` 为明确条目、不再回退 `DragHandleOutlined`；文档末尾出现「+」，点击后文末严格等于原内容加一个空段、光标落入其中，一次撤销后该空段消失（严格等于）
  - e2e：`e2e/editors/handle-icon-add.spec.ts`
  - **视觉锚点**: design-system:§2; ledger:手柄菜单宽度
  - **数据面**: 无

- [x] 5.4 跨入口统一（table/quote）+ 表格网格图标 + §2 审计（Blocked by 5.2）
  - 跨入口同语义统一：手柄与命令/块菜单的 table 用同一图标（弃 `TableChartOutlined`，改用自有网格条目）；quote 统一 `FormatQuoteOutlined`；按设计系统 §2 对新增/替换条目做审计
  - 单点裁决（表格=网格、引用统一）append 到 `docs/design/system/decisions.md`；不复用 Quiet 图形资产
  - AC：在 `npm run dev` 打开页面，同一语义在手柄与块菜单的 `data-icon` 名严格相等；表格块 `data-icon` 为网格条目且不含 `TableChartOutlined`；引用块 `data-icon` 严格等于 `FormatQuoteOutlined`；新增/替换条目满足 §2 笔画与尺寸约束
  - e2e：`e2e/editors/icon-consistency.spec.ts`
  - **视觉锚点**: design-system:§2
  - **数据面**: 规格,存储,校验,桥接,消费,回滚

## 2. 拖拽与裁剪

- [x] 5.3 moveBlock 局部重排 / trimNewlines 局部化（批次 1 移交）
  - 只对被移动区间做换行规范化，其余字节逐字保留；单次 dispatch 重排语义与选择映射不变
  - AC：在 `npm run dev` 打开页面，把第 2 段拖到第 1 段前松手后，除两段外文档其余字节严格等于操作前；一次撤销后与操作前逐字节相同
  - e2e：`e2e/editors/move-block-local.spec.ts`
  - **视觉锚点**: design-system:§3
  - **数据面**: 无

- [x] 6.1 裁剪坐标系 + 加载门 + 保存双入口
  - 进入前等 `img.complete`/load（2s 超时提示）；以清空样式后的整图显示宽度计算唯一 scale；框选/拖动/保存同坐标系，写回只换算一次
  - 保存按钮 + window 级 `pointerup` 双入口；框销毁由 window 监听兜底；Esc 取消不写回
  - AC：在 `npm run dev` 打开页面，打开裁剪并保存后图片显示宽度比值严格等于 1；未加载完打开裁剪给出可见提示且不静默失败；触发装饰重建后再松手裁剪仍写回；Esc 后无残留裁剪框、源码不含 `crop`
  - e2e：`e2e/editors/crop-coordinate.spec.ts`
  - **视觉锚点**: design-system:§5
  - **数据面**: 无

## 3. 列表

- [x] 7.1 列表 Tab/Shift-Tab + 空项三态 + 深度 6
  - Tab/Shift-Tab 按 marker 宽度递进/回退，非列表保持默认；空项回车三态；深度上限 3 → 6
  - AC：在 `npm run dev` 打开页面，连续按 5 次 Tab 后深度为 5、第 6 次不再增加；有子项空项回车退一层、无子项空项回车退出列表成为段落且列表项数减少 1；Shift-Tab 在非列表行不改变文本（严格等于）
  - e2e：`e2e/editors/list-indent-exit.spec.ts`
  - **视觉锚点**: design-system:§3
  - **数据面**: 无

- [x] 7.2 有序编号计算显示 + 源码同步（Blocked by 7.1）
  - 编辑态按同级序号渲染计算值；结构变化（回车、缩进、删除、转换）时同步重写源码字面量
  - AC：在 `npm run dev` 打开页面，在两个有序项之间插入新项并回车后编辑态显示 1、2、3；源码中有序编号字面量与显示一致；删除中间项后剩余编号重算且无空态残留
  - e2e：`e2e/editors/list-number-sync.spec.ts`
  - **视觉锚点**: design-system:§3
  - **数据面**: 无

## 4. 分栏

- [x] 8.1 分栏内容匹配 + 冻结重建
  - `commit` 用围栏首行内容或 `cols:` 属性串匹配；失败回填宿主并 toast；`.cm-column-editor` 存在时冻结 widget 销毁/重建，关闭后强制刷新一次
  - AC：在 `npm run dev` 打开页面，在分栏单元格输入期间在其前插入新块使偏移改变后切走，内容落回正确单元格且页面出现可见提示（取消/残留）；重复点击同一单元格时 `.cm-column-editor` 节点数严格等于 1
  - e2e：`e2e/editors/columns-commit.spec.ts`
  - **视觉锚点**: design-system:§5
  - **数据面**: 无
