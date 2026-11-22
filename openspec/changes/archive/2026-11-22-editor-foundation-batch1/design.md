# Design — editor-foundation-batch1：Quiet.md 学习报告 批次 1：地基加固

## 规范前置核对（ADR）

- **ADR 0003（accepted，2026-08-01）已裁定**：编辑器内容回写 store 采用 300ms 防抖，且「300ms 为固化决策值，调整需经新 ADR」。当前 `ContentArea.tsx:600-609` 每键直写，与该 ADR 不一致——本批是**把已接受的 ADR 落地**，不是重新决策；300ms 保持不变。
- 新增的 2000ms 截止、写入者归属/修订号协议、历史边界三原则写入**新 ADR 0012**（不 supersede 0003）；ADR 索引 README 同步到 0001–0012。
- **ADR 0004（accepted）**：store 只存纯文本，`EditorView` 在 `src/editors/editorRef.ts` 的模块级 Map。本批新增的 `contentRevision` / `lastWriter` 是纯数据元信息，不把编辑器对象放进 store，符合 0004。

## D1 执行顺序反转为「回灌先、节流后」

- **现状**：报告 §3.1 把 1（输入节流）排在 2（回灌收口）之前；若按此顺序先做节流，store 里的旧快照仍会经回灌 effect 整篇覆盖用户刚敲的字，节流反而放大覆盖窗口。
- **决策**：执行顺序反转，1.1（回灌收口）先落地，1.2（输入节流）Blocked by 1.1。回灌协议建立前不做任何节流改动。
- **理由**：回灌是节流安全性的前提；旧快照全文覆盖是「刚敲的字丢失」的直接机制，必须先以修订号协议收口，再让节流只影响快照写频率。
- **风险**：若 1.1 验收不过即开工 1.2，会带病叠加，返工面变大。缓解：1.2 的 ticket 显式声明 Blocked by 1.1，G0 出口以 1.1 锚点 R-1 全绿为放行条件。

## D2 同步协议：写入者归属 + 修订号

- **现状**：`ContentArea.tsx:729-758` 的同步 effect 依赖 `tab?.content`，不一致即 `{ from: 0, to: len, insert }` 整篇替换 + `addToHistory.of(false)`（一手证据 `ContentArea.tsx:600-609`、`ContentArea.tsx:729-758`）。双面板同页签时互相回灌，且无归属判定。
- **决策**：每个 tab 增加 `contentRevision`（单调递增）与 `lastWriter`（面板 id 或 `"external"`）；每个 EditorView 记 `lastAppliedRevision`。写入者自己的回声（`lastWriter === 本面板`）跳过；其余变化按公共前后缀裁剪最小 diff 应用，事务附 `annotations: [Transaction.addToHistory.of(false), isolateHistory.of("before")]`（`isolateHistory` 取值仅 `before`/`after`/`full`，取 `before` 在程序回灌前切断上一用户分组）。应用前校验 view 归属（`getEditorView(panelId)` 与 ref 一致），位置 clamp 到文档范围内。整篇灌入只允许发生在页签首次装载或可见性首次置真。
- **理由**：修订号让回声可判定，最小 diff 保留其余字节不动，`isolateHistory` 切断程序回灌与用户编辑的相邻历史分组，配合 D5 三原则形成完整历史语义。
- **风险**：最小 diff 裁剪在极端并发下可能丢字符。缓解：应用前校验归属且 clamp 位置，diff 不合法时退化为整篇灌入并记录告警，由 undo 不变量测试（D6）覆盖边界。

## D3 节流与 flush

- **现状**：ADR 0003 已裁定 300ms 防抖，但 `ContentArea.tsx:600-609` 仍每键全量写 store（一手证据），订阅组件每键重渲染；`App.tsx:206-236` 保存直接读 `activeTab.content` 快照，无 flush 步骤（一手证据 `App.tsx:206-236`）。
- **决策**：按 ADR 0003 落地 300ms 防抖，并新增 2000ms 截止；`dirty` 首键立即置位。flush 点为：保存、另存为、导出（PDF/HTML/PNG/docx/mdpkg）、打印、切页签、进入预览、组件卸载、窗口关闭、外部回灌前。flush 从 live `EditorView.state.doc` 取全文写 store，新增 `flushTabContent(tabId)`；保存/导出/打印一律先调 flush 再读快照。
- **理由**：把每键 O(doc) 降为每 300ms 一次；flush 点覆盖所有「以 store 快照为准」的消费出口，避免保存到过期快照。
- **风险**：遗漏 flush 点导致落盘内容滞后。缓解：flush 点清单在设计中固定，保存与导出入口强制先 flush，e2e 断言键入后 50ms 保存的落盘一致性（R-2 A-2.3）。

## D4 键位纠偏

- **现状**：`src/editors/setup.ts:93-94` 把 `{ key: "Mod-[", run: undo }` 与 `{ key: "Mod-]", run: redo }` 排在 `defaultKeymap` 之前，覆盖其缩进语义（一手证据 `setup.ts:93-94`）；`defaultKeymap` 本身已有 `Mod-[`→`indentLess`（证据 `node_modules/@codemirror/commands/dist/index.js:1792`）。
- **决策**：删除 `setup.ts` 中 `Mod-[`→undo 与 `Mod-]`→redo 两条；不新增绑定。保留 `historyKeymap` + `ctrlHistoryBindings` 负责 `Mod-Z`/`Ctrl-Z`。
- **理由**：覆盖条目移除即恢复 `defaultKeymap` 常规语义，零新增绑定，语义零改动风险最小。
- **风险**：依赖被误绑键位的既有操作习惯短期不适应。缓解：本批只动 `Mod-[`/`Mod-]`，不动 `Mod-Z`/`Ctrl-Z`（见 D7）；e2e 断言有序列表按 `Mod-[` 减少一级缩进且内容不回退（R-3 A-3.1）。

## D5 历史边界三原则与结构事务助手

- **现状**：`smart-input.ts` 全文仅 1 处 `userEvent`（:804），标题升降、智能回车、缩进等结构 dispatch 无注解，一次结构意图被拆成多个撤销步；程序回灌 `addToHistory.of(false)` 未切断与相邻用户编辑的历史分组。
- **决策**：落地三原则：① 用户可感知变更必带 `userEvent`；② 程序回灌不进历史但必须以 `isolateHistory` 切断相邻分组；③ 结构命令每意图一个独立 undo 步。实现为新文件 `src/editors/structure-history.ts` 的 `structureTransaction(spec)`，附加 `userEvent: "app.structure"` + `isolateHistory.of("full")`（每个结构意图自成一组），接入 `smart-input.ts` 的标题升降、列表缩进、智能回车、智能退格与 `block-convert.ts`；**不接入**拖拽重排 `block-handle.ts` 的 `moveBlock`（属批次 2）。三原则写入 `docs/architecture/decisions/0012-editor-history-boundaries.md`（当前最大编号 0011），由 2.2 负责，并同步 `docs/architecture/decisions/README.md` 索引。
- **理由**：结构命令是「一个意图、一次撤销」的用户心智；统一助手保证接入面一致，不接入 moveBlock 避免与批次 2 手柄改造重叠。
- **风险**：结构命令种类多，接入漏项导致个别命令仍多步撤销。缓解：接入清单在 2.2 票面固化，不变量测试（D6）驱动公共链路覆盖结构命令场景。

## D6 不变量测试

- **现状**：仓库无编辑器层 undo 不变量测试，回灌、节流、结构事务的边界行为没有回归网。
- **决策**：新增 `src/__tests__/editor/undoInvariants.test.ts`。用确定性伪随机序列驱动输入、删除、结构命令、外部回灌、模拟切页签，断言：undo 全量回到起点、redo 全量回到终点、选区合法。必须驱动公共链路（`EditorView.dispatch`/keymap），禁止直接调内部函数。
- **理由**：随机序列暴露顺序依赖，公共链路保证测的是用户真实路径；不变量是本批地基语义的回归底线。
- **风险**：确定性序列覆盖不到稀有路径。缓解：序列种子固定并记录，边界场景（空文档、单字符、超长行）单列在测试内。

## D7 与 editor-surface-batch20 的边界

- **现状**：`editor-surface-batch20` 4.3（D3 逗号→/ 与撤销键）与本批的撤销键语义相邻。
- **决策**：本批只移除 `Mod-[`/`Mod-]`，不动 `Mod-Z`/`Ctrl-Z`；batch20 4.3 的「恢复键生效」相邻但不重叠，后续实现时 rebase 即可。范围外项按 requirements.md 的 Non-goals 原样保留。
- **理由**：两变更切面不同，强行合并会放大回归面；相邻不重叠即按各自锚点独立验收。
- **风险**：两个变更并行落地产生实现冲突。缓解：两变更文件切面无交集（键位表 vs 恢复键），实现阶段先落本批，batch20 rebase 合并。

## 风险与回滚

- **回灌协议失效**：D2 应用前校验 view 归属，不合法退化整篇灌入并告警；回滚方式为还原同步 effect 至整篇替换逻辑（历史行为恢复，仅失去最小 diff）。
- **节流丢字**：D3 所有 flush 点强制从 live view 取全文；回滚方式为移除节流、恢复每键全量写（性能回退，行为不丢）。
- **键位回归**：D4 只删两条绑定，回滚方式为还原 `setup.ts` 两条条目。
- **结构事务越界**：D5 助手只覆盖本批四类结构命令，回滚方式为撤下 `structure-history.ts` 接入，恢复原 dispatch（历史步数回退，不丢内容）。
- **不变量测试误报**：D6 驱动公共链路且种子固定，回滚方式为收窄序列或修正测试环境，不改产品代码以迁就测试。

## 数据面

无。本批四要素（回灌收口、输入节流、键位纠偏、历史边界）只触及编辑器同步、历史事务与键位绑定的实现逻辑，不落任何字段级存储、主题或命令集合的落点，本批无数据面。
