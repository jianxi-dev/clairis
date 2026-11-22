## Problem

编辑器内核的四类地基缺陷在放大所有后续编辑手术的风险，均有本仓 HEAD 一手证据：

1. 每键把整篇 `doc.toString()` 写入 store（`ContentArea.tsx:600-609`），订阅组件每键全量重渲染——ADR 0003 早已裁定 300ms 防抖，但代码未落地。
2. store→编辑器回灌遇不一致即整篇替换 + `addToHistory.of(false)`（`ContentArea.tsx:729-758`），产生「历史之外的文档状态」；双面板同页签互相覆盖。
3. `Mod-[`/`Mod-]` 被改绑为撤销/重做并排在 `defaultKeymap` 之前（`setup.ts:93-94`），用户习惯的「取消缩进」变成撤销。
4. 结构命令大量 dispatch 无 `userEvent`（`smart-input.ts` 全文仅 1 处），一次结构意图被拆成多个撤销步。

## Solution

按报告批次 1 的四项落地，执行顺序为**回灌先行、节流随后**（先节流会让旧快照回灌覆盖新输入）：

- 回灌收口：写入者归属 + 修订号 + 最小 diff + view 归属校验；整篇灌入只发生在页签/可见性首次装载。
- 输入节流：300ms 防抖 + 2s 截止（落地 ADR 0003 + 新 ADR 0012），dirty 首键即置，九个出口前从 live view flush。
- 键位纠偏：删两条误绑，恢复 `defaultKeymap` 的减少/增加缩进。
- 历史边界：三原则落 ADR 0012；结构命令走 `structureTransaction`（`userEvent` + `isolateHistory.of("full")`）；补 undo 不变量测试。

## User Stories

- 作为编辑长文的人，我连续快速输入时不希望输入卡顿，也不希望侧栏/属性面板跟着每个字闪烁。
- 作为同时开两个面板的人，我在一个面板输入时，另一个面板应跟随同一内容，而不是把彼此的光标和撤销链打断。
- 作为习惯用快捷键的人，我在列表里按 `Mod-[` 时应减少缩进，而不是撤回上一步。
- 作为依赖撤销的人，我希望一次结构操作对应一次撤销，不要「回退过头」或「撤不回来」。

## Out of Scope

- 跨页签保留 undo 历史（需 tab 级 `HistoryState`，另立项）。
- 拖拽重排 `moveBlock` 的全文空行规范化收口（属批次 2 手柄改造）。
- 手柄/图片裁剪/分栏止血/表格/块树（批次 2-5）。
- 不给 `smart-input.ts` 全部 28 个 dispatch 补注解；本批只覆盖四类结构命令。

## Testing

- 单测：slice 节流计数、dirty 首键、flush 后一致、undo 不变量（确定性伪随机序列）。
- e2e：双面板同页签镜像；外部回灌后一次撤销不清空正文；`Mod-[` 减少一级缩进；一次标题降级一次 ⌘Z 完全还原；连续两次结构命令一次 ⌘Z 只回退最后一次。
- 机检：`openspec validate --strict`、`cw-conformance verify`、`cw-data-surface signals`（hit 0）。
