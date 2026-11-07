---
name: overview-design-liyy
description: 从客户需求文档自动生成 OA 系统概要设计说明书。
---

<objective>
将客户提供的需求文档自动转换为标准化的概要设计说明书。
</objective>

<essential_principles>
## 核心原则

**1. 大文档处理**

- 检测到文档超过 50 页时自动启用分块模式
- 每块处理完成后立即提取关键信息
</essential_principles>

<routing>
## 意图路由

| 用户信号 | 意图 |
|----------|------|
| 生成/概要设计 | 生成方案 |
</routing>

<reference_index>
| 文件 | 用途 |
|----------|------|
| template-structure.md | 模板章节结构详解 |
</reference_index>

## 正常标题

| 流程 | 用途 |
|----------|------|
| intake.md | 素材接收与预检 |

<constraints>
## 约束条件

- 不得引入额外依赖
- 输出必须可复现
</constraints>

```text
<fenced_tag>
围栏内的标签是代码内容，不应被隐藏。
```
