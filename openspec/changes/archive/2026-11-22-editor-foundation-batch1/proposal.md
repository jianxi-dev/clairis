# Proposal — editor-foundation-batch1：Quiet.md 学习报告 批次 1：地基加固

## Why

CodeMirror 6 编辑内核的四类地基缺陷正在放大所有后续编辑手术的风险。结论来自 `quiet-md-逆向学习总报告.md` §3.1 与域报告 `editor-core.md` §8.2/§8.3，并经本仓 HEAD 一手源码实读确认：

- **每键全文同步**：ADR 0003（accepted，2026-08-01）已裁定「内容回写 store 采用 300ms 防抖」，但 `ContentArea.tsx` 仍每键把整篇 `doc.toString()` 写入 store——本批把该决策真正落地，订阅组件不再每键全量重渲染。
- **整篇回灌**：内容同步 effect 遇不一致即 `from:0 → to:len` 全文替换，叠加 `addToHistory.of(false)`，产生「历史之外的文档状态」，内容突然丢失且撤不回；双面板同页签还会互相覆盖。
- **键位误绑**：`Mod-[`/`Mod-]` 被改绑为撤销/重做并排在 `defaultKeymap` 之前，覆盖其减少/增加缩进语义，用户习惯的「取消缩进」变成撤销。
- **历史边界缺失**：结构命令（标题升降、列表缩进、智能回车/退格、块转换）大量 dispatch 无 `userEvent` 注解，一次结构意图被拆成多次撤销步，程序回灌也未切断历史分组。

后续批次（手柄、裁剪、分栏、表格、块树）都建立在本批的同步与历史语义之上，不先加固，结构手术必翻车。

## What Changes

1. **回灌收口**：store→编辑器同步仅在页签/可见性首次装载时整篇灌入；同一页签后续变化按「写入者归属 + 修订号」最小 diff 应用，校验视图归属，杜绝旧闭包全文覆盖。
2. **输入节流**：键入时 store 内容快照 300ms 防抖 + 2000ms 截止；`dirty` 首键即置；在保存、另存为、导出、打印、切页签、进入预览、卸载、窗口关闭、外部回灌前强制 flush（以 live view 为准）。
3. **键位纠偏**：移除 `Mod-[`/`Mod-]` 的撤销/重做误绑，恢复 `defaultKeymap` 的减少/增加缩进语义。
4. **历史边界**：用户可感知变更带 `userEvent`；程序回灌不进历史但以 `isolateHistory` 切断分组；结构命令每意图一个独立 undo 步；补编辑器层 undo 不变量测试。

## Impact

- **受影响代码**：`src/components/Content/ContentArea.tsx`（updateListener、内容同步 effect、历史重置点）、`src/stores/index.ts`（内容写回与标题改写路径）、`src/App.tsx`（保存前 flush）、`src/editors/setup.ts`（键位表）、`src/editors/smart-input.ts` 与新增结构事务助手、`block-convert.ts`、新增 `structure-history.ts`、新增 `undoInvariants.test.ts` 与 e2e。
- **接口**：store 每页签新增 `contentRevision` 与 `lastWriter`；新增 `flushTabContent(tabId)`。
- **用户可感知**：输入更跟手；双面板同页签内容一致；一次撤销不再清空正文；`Mod-[` 恢复减少缩进；一次结构命令对应一次撤销步。

## Non-goals

- 跨页签保留 undo 历史（报告 §8.3(c)2，需 tab 级 HistoryState，另立项）。
- 拖拽重排 `moveBlock` 的 `trimNewlines` 全文规范化收口（报告 §8.2(c)3，属批次 2 手柄改造）。
- 手柄/图片裁剪/分栏止血/表格/块树（批次 2-5）。
- 不给 `smart-input.ts` 全部 28 个 dispatch 补注解：本批只覆盖「结构命令」四类；其余按历史边界原则在后续票逐步收口。
