---
title: "设计体系（design/system）"
type: design
status: accepted
last_updated: 2026-11-08
source_of_truth: supporting
---

# 设计体系（design/system）

## 职责

存放 Biaoyue 的**跨界面共享设计规范**：色彩、字体、间距、栅格、组件样式、暗色模式等设计 token 与视觉语言。回答“整个应用的视觉规则是什么”。

## 不放在这里

- 单个界面/流程的交互稿 → `docs/design/approved/`
- 尚未定案的探索草图 → `docs/design/explorations/`
- 可验收的功能行为 → `openspec/specs/`

## 进入条件

- 内容是**会被多个界面复用**的设计规则，而非一次性草图。
- 已批准后方可进入；草案与比稿先在 `../explorations/` 沉淀。
- 新增文档须带 frontmatter（`title` / `type: design` / `status` / `last_updated`），规范见 `../../GOVERNANCE.md`。

## 权威级别

设计体系属于 approved design 范畴，在权威优先级矩阵中位于第 4 层，低于活动变更、canonical spec 与已接受 ADR。

## 文档清单

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [spec.md](./spec.md) | 设计系统规格：图标、间距、字号、圆角阴影、语义色、审美判据。面向全应用的通用刻度与规则 | in-review · canonical |
| [decisions.md](./decisions.md) | 设计决案台账：具体部件的单点裁决，append-only，以最新行为准 | accepted · canonical |
| [biaoyue-颜色设计体系.md](./biaoyue-颜色设计体系.md) | 早期颜色主题草稿（空壳），内容已被 spec.md §6 吸收 | superseded |

> 数值只在 `spec.md` 定义一次；单 feature 设计（`design/approved/`）与票面**引用条款号，不复制数值**。

