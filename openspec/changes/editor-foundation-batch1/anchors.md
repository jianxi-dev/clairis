# 验收锚点 — editor-foundation-batch1

锚点来源：`quiet-md-逆向学习总报告.md` §3.1 批次 1（地基加固）+ 域报告 `editor-core.md` §8.2/§8.3 + 本仓 HEAD 一手源码实读；design.md D1–D7 与「数据面（无）」。R-1…R-4 对应 tasks.md 1.1–2.2。

## R-1 回灌收口

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 外部回灌后（回灌事务不进历史）按一次撤销，正文不被清空 | 撤销后文档长度 ≥ 1 | 报告批次1-2 / 一手证据 ContentArea.tsx:729-758 |
| A-1.2 | exact | 双面板同页签，A 连续输入 5 次后 B 文本与 A 相同 | 差异字符数 0 | 报告批次1-2 / 一手证据 ContentArea.tsx:729-758 |
| A-1.3 | exact | 回灌前后 undoDepth 之差 | 0 | 报告批次1-2 / editor-core §8.3(b) |

## R-2 节流

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 200ms 内 10 次键入，store 快照更新次数上限 | 2 | 报告批次1-1 / ADR 0003 / 一手证据 ContentArea.tsx:600-609 |
| A-2.2 | exact | 首次键入后 dirty | true（1） | 报告批次1-1 / 一手证据 stores/index.ts:673-684 |
| A-2.3 | exact | 键入后 50ms 内保存，落盘与编辑器全文差异字符数 | 0 | 报告批次1-1 / 一手证据 App.tsx:206-236 |
| A-2.4 | exact | 键入后 2100ms，store 与编辑器全文差异字符数 | 0 | 报告批次1-1 / ADR 0003 / 一手证据 ContentArea.tsx:600-609 |

## R-3 键位

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 有序列表按 Mod-[ 后减少的缩进级数 | 1 | 报告批次1-4 / 一手证据 setup.ts:93-94 |
| A-3.2 | exact | 键位表中 Mod-[ 绑定 undo 的条目数 | 0 | 报告批次1-4 / 一手证据 setup.ts:93-94 |

## R-4 历史分组

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 一次标题降级后一次 ⌘Z 与操作前字符差异数 | 0 | 报告批次1-4 / editor-core §8.3(c) |
| A-4.2 | exact | 两次结构命令后一次 ⌘Z 仅回退最后一次 | 回退 1 步，撤销后与第二次操作前状态差异字符数 0 | 报告批次1-4 / editor-core §8.3(c) |
| A-4.3 | state-machine | 随机 50 步序列 undo 全量 / redo 全量 | 回到起点 / 回到终点 | 报告批次1-3 / editor-core §8.3(c) |
