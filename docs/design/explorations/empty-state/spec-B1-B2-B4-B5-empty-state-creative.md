---
title: "渐晰空状态 — 创意方案"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: docs/design/approved/empty-state/spec.md
superseded_by: ../../approved/empty-state/spec.md
---

# 渐晰空状态 — 创意方案

ponytail mode: full

---

## Codex 给的 5 个方向

**1. 写作驾驶舱**
- 仪表盘：左侧继续写 + 右侧"今天可以做什么" + 底部7天写作统计
- 数据：最近文件、编辑字数、剪贴板
- 难度：中等

**2. 灵感起笔区**
- 中央一组起笔卡片：写会议纪要 / 整理文章 / 做PRD / 写周报 / 从空白
- 每张卡片点开生成对应 Markdown 结构
- 数据：内置模板、最近使用频率排序
- 难度：低到中等

**3. 文档地图**
- 知识库入口：最近活跃文档 / 频繁打开 / 长期没更新但重要
- 视觉像轻量知识网络
- 数据：目录扫描、修改时间、打开次数、文件链接关系
- 难度：中到高

**4. 今日继续**
- 一句上下文提示："上次你停在《产品方案.md》的'定价策略'部分。"
- 3 个动作：继续编辑 / 查看改动 / 创建相关文档
- 数据：光标位置、最后编辑段落、未完成 TODO
- 难度：中等

**5. Markdown 能力展示台**
- 空状态本身就是一篇可交互 Markdown 示例
- 用户看到渐晰能呈现什么
- 数据：内置 Markdown 示例
- 难度：低

---

## ponytail 选择

**选 4（今日继续）。** 印哥要"继续的跳板"——这就是字面意义上的继续。

**原因**：
- 不是文件选择器（Cmd+P 已经做了）
- 不是起笔引导（Notion 做了，渐晰不是笔记 App）
- "上次停在哪"是阅读/写作场景的最高价值信息

**实现**（ponytail 最小化）：
- RecentFile 加两个可选字段：`scrollPos: number` + `lastEditOffset: number`（1行改动）
- 关闭文档时记录 `editor.state.selection.main.from` 到 store
- EmptyStateShell 渲染时：最近文件 = "上次停在这"卡片，点击滚动到该位置

RecentFile 加字段是"为以后铺路"吗？不是。scrollPos 现在在 CORE-REQUIREMENTS 里已经有 `tabs[].scrollPos`，只是 RecentFile 没同步加。补上它。

---

## 最终方案

EmptyStateShell 渲染 ReturnView 时：

```
继续上次

┌─────────────────────────────────┐
│  《无侧栏方案》                  │
│  ──────────────────             │
│  Desk 是用户的核心工作台。        │
│  它不是文件管理器，不是 SWOT...   │
│                                 │
│  上次停在这 ↓                    │
│  第 3 节 · 引用关系              │
│                                 │
│       [ 继续阅读 ]               │
│                                 │
└─────────────────────────────────┘

[打开文件夹]  [新建]

```

对比"3 个文件名"：
- 内容预览替代文件名
- 上次停在哪替代时间戳
- 主 CTA 是"继续阅读"不是"打开"

---

## ponytail 没选的

- 写作驾驶舱：需要字数统计 + 行为埋点，over-engineered
- 灵感起笔区：渐晰不是 Notion，起笔不是核心场景
- 文档地图：需要引用关系解析，R 阶段做不动
- Markdown 展示台：marketing 价值 > 实用价值，后续有空再做

---

## 需要确认

1. 这个方向对吗？
2. RecentFile 加 scrollPos/lastEditOffset 你接受吗？（可选字段，老数据为空时 fallback 到"上次打开的文档"）
3. 示例文件内容谁写？（ponytail: 0-欢迎.md 需要印哥给方向）

ponytail: 4+1 改动，最 lazy 的"继续"方案。
