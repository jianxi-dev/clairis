# 架构决策记录（architecture/decisions）

## 职责

存放 Clairis 的 **ADR（Architecture Decision Records）**：记录每个重要架构决策的背景、决定、后果与状态。这是“历史调查 / 为什么当初这么决定”类任务的首选入口之一。

## 不放在这里

- 当前架构现状总览 → `docs/architecture/overview.md`（将由后续任务创建）
- 产品方向 → `docs/product/`
- 已批准设计 → `docs/design/approved/`

## 进入条件

- 采用四位十进制编号（`0001`、`0002` …），**编号不回收**。
- 每条 ADR 保留 `context` / `decision` / `consequences` / `status` / `date`。
- 旧决定发生改变时，**只新增一条 superseding ADR**，不改写旧 ADR 正文。
- 新增文档须带 frontmatter（`title` / `type: adr` / `status` / `last_updated`），规范见 `../../GOVERNANCE.md`。

## 权威级别

已接受的 ADR / 架构现状在权威优先级矩阵中位于第 3 层，高于已批准设计、产品方向与研究历史。**仅 `accepted` 状态的 ADR 参与实现裁定**；被 superseded 的 ADR 转为历史调查用途。
