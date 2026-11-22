# Tasks — editor-foundation-batch1

> 切片原则：每张票贯穿「入口 → 行为 → e2e」，做完用户能在界面上看到变化。
> 票标题前缀 `[change=editor-foundation-batch1/<任务号>]`；1 任务 = 1 票。
> 依赖：1.2（输入节流）Blocked by 1.1（回灌收口）；其余无依赖。

## 1. 同步与节流

- [x] 1.1 回灌收口（ContentArea 同步 effect + stores 修订号/写入者 + 标题改写/可视化回写路径）
  - store 每页签新增 `contentRevision`（单调递增）与 `lastWriter`（面板 id 或 `"external"`）；每个 EditorView 记 `lastAppliedRevision`
  - ContentArea 同步 effect 仅在页签首次装载/可见性首次置真时整篇灌入；同一页签后续变化按写入者归属判定：`lastWriter === 本面板` 的回声跳过，其余变化按公共前后缀裁剪最小 diff 应用，事务附 `annotations: [Transaction.addToHistory.of(false), isolateHistory.of("before")]`；应用前校验 view 归属（`getEditorView(panelId)` 与 ref 一致）并 clamp 位置
  - 标题改写与可视化回写路径走同一同步协议，不产生旧闭包全文覆盖
  - AC：外部回灌后按一次撤销，正文不被清空（文档长度 ≥ 1）；双面板同页签，A 连续输入 5 次后 B 文本与 A 相同；回灌前后 undoDepth 之差为 0
  - e2e：双面板同页签镜像、外部回灌后一次撤销不清空正文
  - **数据面**: 无

- [x] 1.2 输入节流与 dirty（Blocked by 1.1）
  - 按 ADR 0003 落地 store 内容快照 300ms 防抖，并新增 2000ms 截止（截止值记入 ADR 0012）；`dirty` 首键立即置位
  - 新增 `flushTabContent(tabId)`，从 live `EditorView.state.doc` 取全文写 store
  - 保存、另存为、导出（PDF/HTML/PNG/docx/mdpkg）、打印、切页签、进入预览、组件卸载、窗口关闭、外部回灌前强制 flush；保存/导出/打印一律先调 flush 再读快照
  - AC：200ms 内 10 次键入，store 快照更新次数 ≤ 2；首次键入后 dirty 为 true；键入后 50ms 内保存，落盘与编辑器全文差异字符数为 0；键入后 2100ms，store 与编辑器全文差异字符数为 0
  - e2e + 单测：快照更新次数上限、dirty 首键置位、键入后 50ms 保存落盘一致、2100ms 截止后一致
  - **数据面**: 无

## 2. 键位与历史

- [x] 2.1 键位纠偏
  - 删除 `src/editors/setup.ts` 中 `{ key: "Mod-[", run: undo }` 与 `{ key: "Mod-]", run: redo }` 两条
  - 保留 `historyKeymap` + `ctrlHistoryBindings` 负责 `Mod-Z`/`Ctrl-Z`，不动撤销/重做主键位
  - AC：有序列表按 `Mod-[` 后减少的缩进级数为 1；键位表中 `Mod-[` 绑定 undo 的条目数为 0
  - e2e：有序列表按 `Mod-[` 减少一级缩进且内容不回退
  - **数据面**: 无

- [x] 2.2 结构命令历史分组 + 三原则 ADR + 不变量测试
  - 新增 `src/editors/structure-history.ts` 的 `structureTransaction(spec)`，附加 `userEvent: "app.structure"` + `isolateHistory.of("full")`
  - 接入 `smart-input.ts` 的标题升降、列表缩进、智能回车、智能退格与 `block-convert.ts`；不接入拖拽重排 `block-handle.ts` 的 `moveBlock`
  - 三原则写入 `docs/architecture/decisions/0012-editor-history-boundaries.md`（含 frontmatter），并同步 `docs/architecture/decisions/README.md` 索引到 0001–0012
  - 新增 `src/__tests__/editor/undoInvariants.test.ts`，确定性伪随机序列（输入/删除/结构命令/外部回灌/模拟切页签）后断言 undo 全量回到起点、redo 全量回到终点、选区合法；驱动公共链路（`EditorView.dispatch`/keymap），禁止直接调内部函数
  - AC：一次标题降级后一次 ⌘Z 与操作前字符差异数为 0；两次结构命令后一次 ⌘Z 仅回退最后一次，回退字符数等于第二次 change 长度；随机 50 步序列 undo 全量回到起点、redo 全量回到终点
  - e2e：一次标题降级后一次 ⌘Z 完全还原；连续两次结构命令，一次 ⌘Z 只回退最后一次
  - **数据面**: 无
