---
title: "A-9 阅读进度设计规格"
type: design
status: archived
last_updated: 2026-08-01
source_of_truth: historical
redirect: docs/design/approved/reading-progress/spec.md
---

# A-9 阅读进度设计规格

> 来源：July 12, 2026 印哥 + Hermes 设计讨论
> 阶段：Phase R
> 关联：A-5 沉浸阅读（进度在沉浸态下的行为）、A-6 字号缩放（字号影响阅读速度计算）

---

## 1. 问题陈述

当前没有阅读进度指示。用户不知道自己在文档的哪个位置，不知道还有多少没读，不知道"读完"是什么感觉。

真正的阅读进度不是百分比数字——是**位置感**。像实体书的手指夹在书页间，像 Kindle 的 location 标记。

渐晰的进度设计必须服从"墨语言"：不是进度条，是墨色的深浅变化。

---

## 2. 三层进度呈现

### 2.1 第一层：常驻墨线（Ink Depletion Line）

**位置**：页面右侧边缘，距右边距 4px 处。

**视觉**：
- 宽度：3px
- 高度：100% 视口高度
- 已读部分（从顶部到当前阅读位置）：`rgba(0,0,0,0.18)` — 像墨迹干透
- 未读部分（从当前位置到底部）：`rgba(0,0,0,0.04)` — 像纸的纹理
- 分界线：1px 的 `rgba(0,0,0,0.25)` 横线，像"墨水面"

**行为**：
- 滚动时墨线分界点实时跟随（16ms throttle）
- 不 hover 时完全安静，不吸引注意力
- 沉浸态下 opacity 从 1.0 降至 0.7（不打扰但余光可取）
- 编辑态下墨线不显示（编辑态不需要阅读进度）

**为什么右侧？** 右手持鼠标/触控板时，右侧是视觉余光最不干扰的区域。左侧是文字区，顶部是标题区，底部是滚动条区——右侧是唯一"空着"的边缘。

### 2.2 第二层：Hover 展开面板

**触发**：鼠标悬停墨线区域（3px + 左右各 8px 热区 = 19px 宽）。

**展开面板**：
```
┌─────────────────────────┐
│ 第三章：设计哲学           │  ← 当前章节名
│ 3 / 7 章                  │  ← 章节进度
│ 47%                       │  ← 百分比
│ 剩余 8 分钟               │  ← 预估剩余时间
│ ──────○───────            │  ← 章节节点标记
│ 已读 1,847 字             │  ← 已读字数
└─────────────────────────┘
```

**位置**：墨线右侧展开，距墨线 8px。面板宽度 160px。

**样式**：
- 背景：`rgba(255,255,255,0.95)`（浅色模式）/ `rgba(26,26,46,0.95)`（深色模式）
- 圆角：6px
- 阴影：`0 2px 12px rgba(0,0,0,0.08)`
- 字号：12px
- 行高：1.6
- 颜色：`rgba(0,0,0,0.6)`

**章节检测逻辑**：
- 按 Markdown H1/H2 标题分章
- 当前章节 = 阅读位置上方最后一个标题
- 如果无标题，显示"无章节"

**预估剩余时间**：
- 阅读速度：400 字/分钟（中文平均）
- 剩余字数 = 总字数 - 已读字数
- 剩余分钟 = ceil(剩余字数 / 400)
- 如果剩余 < 1 分钟，显示"即将完成"

**章节节点标记**：
- 面板底部一条横线，长度 100%
- 每个标题位置对应一个小圆点（4px 直径）
- 当前章节对应点放大至 6px，颜色加深
- hover 节点显示该章节名（tooltip）

### 2.3 第三层：读完触发（收卷信号）

**触发条件**：
- 阅读位置 ≥ 95% 总高度
- 用户在底部停留 ≥ 2 秒
- 或用户主动滚动到底部

**触发行为**：
1. 墨线"脉动"一次：已读部分从 `rgba(0,0,0,0.18)` → `rgba(0,0,0,0.3)` → 回到原值，0.6s
2. 底部边距展开（当前 padding-bottom 从 0 → 80px，0.4s ease-out）
3. 展开后显示收卷动作条（参考 no-sidebar-design.md §三"10 秒细读"）：
   - [重读] [标记已读] [打开下一篇]
4. 如果 10 秒内无操作，收卷动作条自动淡出（0.4s）

**读完状态持久化**：
```typescript
interface ReadingCompletion {
  filePath: string;
  completedAt: number;
  readDurationMs: number;  // 总阅读时长（估算）
}
```

---

## 3. 阅读位置恢复

### 3.1 存储

```json
// ~/.config/clairis/reading-progress.json
{
  "version": 1,
  "entries": [
    {
      "filePath": "/Users/mason/docs/设计哲学.md",
      "position": 0.47,
      "totalHeight": 3200,
      "viewportHeight": 800,
      "lastReadAt": 1720782000000,
      "completed": false
    }
  ]
}
```

### 3.2 写入策略

| 事件 | 写入时机 |
|------|---------|
| 滚动停止 | 200ms debounce 后写入 |
| 切换文档 | 立即写入当前文档位置 |
| 关闭文档 | 立即写入 |
| 进入沉浸 | 写入（作为快照一部分） |
| 退出沉浸 | 写入最终位置 |

### 3.3 恢复策略

- 打开文档 → 读取 `reading-progress.json` 中该文件的 entry
- 如果存在且 `totalHeight` 未变（文档未修改）→ 恢复到 `position`
- 如果文档已修改（`totalHeight` 变化）→ 按比例恢复（`newPosition = oldPosition * oldTotalHeight / newTotalHeight`）
- 如果 `completed=true` → 恢复到文档顶部（重读场景）

### 3.4 容量限制

- 最多保留 50 个文档的进度
- 超出时淘汰 `lastReadAt` 最早的条目
- 每 7 天清理一次已完成且 30 天未读的条目

---

## 4. 字号与阅读进度的关系

字号变化影响阅读进度计算：

- 字号增大 → 同一屏幕显示内容减少 → 百分比增长变慢
- 字号减小 → 同一屏幕显示内容增多 → 百分比增长变快

**进度计算基于实际像素位置，不基于字数。** 因为：
- 用户关心的是"我看了多少"，不是"我读了多少字"
- 像素位置是用户可直接感知的

预估剩余时间基于字数，但字号变化时重新计算：
```
剩余字数 = 总字数 × (1 - position)
剩余分钟 = ceil(剩余字数 / 400)
```

---

## 5. 分栏场景

| 分栏场景 | 进度行为 |
|---------|---------|
| 左右双栏（编辑+预览） | 预览栏显示进度，编辑栏不显示 |
| 上下双栏（文档 A + 文档 B） | 两个文档各自独立进度，各自墨线 |
| 单栏 | 正常显示 |

**双栏时墨线位置**：
- 左右双栏：墨线在预览 pane 的右边缘
- 上下双栏：墨线在整个视口的右边缘（两个文档共享）

---

## 6. Store 变更

### 6.1 `tabs.ts` slice

```typescript
interface ReadingProgressEntry {
  filePath: string;
  position: number;        // 0-1 浮点数（百分比）
  totalHeight: number;     // 内容总高（px）
  viewportHeight: number;  // 视口高度（px）
  lastReadAt: number;      // Date.now()
  completed: boolean;
  updatedAt: number;       // 上次写入时间（用于 throttle）
}

interface ReadingProgressState {
  entries: Record<string, ReadingProgressEntry>;
  /** 当前 hover 状态 */
  hoverProgress: boolean;
  /** 当前展开面板显示的章节名 */
  currentChapter: string | null;
}
```

### 6.2 新增 action

```typescript
// 滚动时更新进度（throttled）
updateReadingProgress(filePath: string, scrollTop: number, totalHeight: number, viewportHeight: number): void {
  const position = totalHeight <= viewportHeight 
    ? 1 
    : scrollTop / (totalHeight - viewportHeight);
  
  this.readingProgress.entries[filePath] = {
    filePath,
    position: Math.min(1, Math.max(0, position)),
    totalHeight,
    viewportHeight,
    lastReadAt: Date.now(),
    completed: position >= 0.95,
    updatedAt: Date.now(),
  };
  
  // Throttled save (200ms)
  this.scheduleProgressSave();
}

// 恢复阅读位置
restoreReadingPosition(filePath: string): number | null {
  const entry = this.readingProgress.entries[filePath];
  if (!entry) return null;
  if (entry.completed) return 0; // 重读从顶部开始
  return entry.position * entry.totalHeight;
}
```

---

## 7. 不做的事（YAGNI 声明）

1. **不做"阅读统计面板"**（本周读了多少篇、累计阅读时长）— P2 "成长系统"需要时再加
2. **不做"阅读目标"**（每天读 30 分钟）— P2 功能
3. **不做"阅读历史时间线"**（什么时候读了什么）— 那是 Time Bands 的职责（P2）
4. **不做"阅读进度同步到云端"**— 本地阅读位置不需要同步
5. **不做"阅读进度导出"**— 没有场景需要这个
6. **不做"阅读进度分享"**— 渐晰是私人阅读工具
7. **不做"章节跳转侧栏"**— 那是大纲侧栏（Cmd+Shift+E P1）的职责，不重复造

---

## 8. 验收标准

| # | 场景 | 预期 |
|---|------|------|
| 9.1 | 打开文档，滚动到中间 | 右侧墨线显示，已读部分深色，未读部分浅色 |
| 9.2 | hover 墨线 | 展开面板显示章节名、百分比、剩余时间 |
| 9.3 | 滚动到底部并停留 2s | 墨线脉动一次，底部展开收卷动作条 |
| 9.4 | 关闭文档再打开 | 滚动位置恢复到上次阅读位置 |
| 9.5 | 编辑态 | 墨线不显示 |
| 9.6 | 沉浸态 | 墨线 opacity 降至 0.7 |
| 9.7 | 字号从 16px 调整到 24px | 百分比重新计算（同一位置百分比变小） |
| 9.8 | 分栏（编辑+预览） | 预览栏显示墨线，编辑栏不显示 |
| 9.9 | 文档修改后打开 | 按比例恢复位置 |
| 9.10 | 读完文档（completed=true）再打开 | 恢复到文档顶部 |
| 9.11 | 无标题文档 | hover 面板显示"无章节" |
| 9.12 | 快速滚动（<200ms） | 不触发写入，避免 IO 过载 |
