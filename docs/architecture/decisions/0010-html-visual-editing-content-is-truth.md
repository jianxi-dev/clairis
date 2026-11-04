---
title: HTML 可视化编辑以 content 字符串为唯一真相，不照抄 pnid 回写
type: adr
status: accepted
last_updated: 2026-11-04
---

# ADR 0010 — HTML 可视化编辑：content 为唯一真相，不做 pnid 回写

- **Status**: accepted
- **Date**: 2026-11-04
- **Implemented by**: change `html-visual-editing`（`openspec/changes/archive/…`），切片 1–5

## Context

`.html` 文件的可视化编辑（点选、双击改字、拖拽样式）参考了 WorkBuddy 5.9.3 的逆向结论
（`docs/research/technical/workbuddy-html-visual-editing-逆向报告.md`）。报告给的两条方案
我们**没有照抄**，理由如下。

报告的状态模型是「HTML → 节点模型（janusData）→ 编辑事件改模型 → patch 回 iframe」，
即模型是真相、DOM 与文本都是投影。同一条链上就有三份互相拷贝的状态。

报告还建议首次打开文件时若缺 `data-page-node-id`，就把带 id 的版本**写回原文件**
（pnid 回写），以换取下次打开时的对齐速度。

## Decision

1. **`content` 字符串是唯一真相。** 节点模型只是 `content` 的派生缓存；iframe DOM 是渲染
   产物，只上报「哪个节点、做了什么事」，永不反向覆盖 `content`。编辑提交走纯函数
   `applyTextEdit` / `applyBlockSplit`，输出再经 `cleanSnapshot` 清洗。
2. **不做 pnid 回写。** 打开文件不产生任何磁盘写入。锚点 id 由 DOM 路径 + 序号在内存中
   现算（`tag:index`），同一份 `content` 每次得到相同 id，因此不需要持久化也能对齐。
3. **保存写 `content`，不反拍 iframe DOM。** 若在保存时反拍 DOM，就把「DOM 当真相」重新
   请了回来，正是第 1 条要消灭的那类同步 bug。
4. **编辑态与预览态是两条渲染通道、两套 CSP**：预览 `script-src 'none'`；编辑态只放行
   带 nonce 的注入运行时，用户文件里的脚本仍然不执行。

## Consequences

- 好：没有三份状态要同步，undo/保存/对比只认一个字符串；打开文件零副作用（不改 mtime、
  不弄脏 Git 工作区）。
- 代价：每次打开多做一次解析（在渲染进程内，毫秒级），锚点 id 不跨会话稳定——目前没有
  跨会话引用节点的需求。
- 代价：编辑提交是整块文本覆盖，所以被编辑块内的行内标记（`<strong>`、链接、`<br>`）会被
  拍平；doctype 会归一化。要保住行内结构得改成最小文本 diff，留到有真实需求时再做。

## Alternatives considered

- **照抄 pnid 回写**：用「静默改写用户文件」换打开速度。在 Git 管理的笔记库里不可接受，
  且与「保存写回字节不变」的验收直接冲突。否决。
- **保存时反拍 iframe DOM**：能顺带兜住「DOM 有、content 没有」的脏状态，但把真相源
  变成两个。否决。
