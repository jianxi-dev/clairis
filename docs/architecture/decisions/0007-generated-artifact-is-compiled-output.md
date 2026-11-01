---
title: 生成物=编译产物，源 md 唯一事实源
type: adr
status: accepted
last_updated: 2026-11-01
---

# ADR 0007 — 生成物=编译产物，源 md 唯一事实源

- **Status**: accepted
- **Date**: 2026-11-01

## Context

contentweave 并入后，需要裁定生成 `.html` 与源 `.md` 的关系。若允许直接编辑生成物，会出现双事实源：重渲染覆盖手改（踩 D8 不可逆），或保留手改破坏编译语义。同时生成物必须断网可看、零外部子资源（D9）。

## Decision

- **源 md 是唯一事实源**：编辑 = 改源 md；**保存即后台重渲染**（渲染足够便宜，qa 异步）。
- **生成 `.html` = 编译产物**：默认只读查看，走现有 HtmlPreview 的 asset 协议直载；**不进入编辑管线**。
- **输出位置**：源 md 同目录、同名 `.html`。
- **外来 `.html` 文件照旧全能力编辑**（现状不变，不受本裁定影响）。
- **双事实源被否决**：直编生成物 → 重渲染覆盖手改或保留手改破坏编译语义。

## Consequences

- 单一事实源，重渲染语义清晰，满足 D8（误操作可逆）与 D9（生成物离线单文件）。
- 生成物只读，用户改内容必须回源 md；外来 html 不受影响，保留既有编辑能力。
- 文件监听走父目录监听 + 文件名过滤，规避 rename 丢 watch。

## 关联

- 产品铁律：`docs/product/principles.md` D8/D9。
- 布局规格：`docs/design/approved/layout-portal/spec.md` §14 验收第 12 条。
- 摘要登记：`CONTEXT.md` §二 决策 #7。
