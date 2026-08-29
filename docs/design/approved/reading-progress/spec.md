---
title: "A-9 阅读进度设计规格 v2"
type: design
status: accepted
last_updated: 2026-08-01
source_of_truth: supporting
---

# A-9 阅读进度设计规格 v2

> 来源：July 12, 2026 印哥 + Hermes 设计讨论 → Codex R1 对抗复审
> 变更：砍掉 hover 面板、剩余时间、字数统计、章节节点。只做墨线 + 位置恢复。不新建 JSON。
> 阶段：Phase R
> 关联：A-5 R2 沉浸态墨线透明度

---

## 1. 核心哲学

阅读只有两件事是刚需：
1. 知道自己在哪（位置感）
2. 下次打开还在那（记忆）

其他都是 Readwise Reader 的 feature creep。渐晰的进度系统应该是存在感最低的那个。

---

## 2. 常驻墨线（Ink Depletion Line）

### 2.1 视觉

| 属性 | 值 |
|------|---|
| 位置 | 右边缘，距右边距 3px |
| 宽度 | 2px |
| 高度 | 整个文档滚动区域（不是视口） |
| 已读部分（上） | rgba(0,0,0,0.14) |
| 未读部分（下） | rgba(0,0,0,0.04) |
| 分界线 | 无额外标记（0.14 到 0.04 的自然过渡即分界） |

### 2.2 行为

- **滚动时**：实时更新已读/未读比例（16ms requestAnimationFrame throttle）
- **沉浸态不显示**——沉浸态下一切 chrome 隐藏。需要知道进度时 Esc 浮出工具栏后墨线自然出现
- **编辑态不显示**——编辑态不需要阅读进度
- **不 hover 展开**——没有 hover 面板
- **窗口 resize 时**：重新计算比例，无动画

### 2.3 墨线与纸的隐喻

墨线 = 纸张右侧被墨水浸过的高度。读完一篇，整条纸从顶到底都被墨浸透。没读的纸是干的、浅的。

---

## 3. 位置恢复

### 3.1 存储（现有 `tabs.store`，无新增文件）

```typescript
// src/stores/index.ts tabs 已有 scrollPos 概念
// 扩展为：
interface TabState {
  scrollPos: number;     // 当前滚动位置（px from top）
  contentHeight: number; // 文档总高度（px）
}
```

### 3.2 写入时机

| 触发 | 行为 |
|------|------|
| 滚动停止 | 200ms debounce 后写入 `tabs[id].scrollPos` |
| 切换 tab | 立即写入旧 tab，不读入新 tab |
| 关闭 tab | 立即写入 |
| 关闭窗口 | 通过 `unload` event 写入（Tauri `close` 事件） |

### 3.3 恢复逻辑

```
打开文档时：
  1. 读取 tabs[filePath].scrollPos 和 contentHeight
  2. 如果 contentHeight 未变（文档未修改）→ 直接跳到 scrollPos
  3. 如果 contentHeight 变了 → position = scrollPos / oldContentHeight（百分比恢复）
  4. 如果找不到记录 → 跳到顶部
```

### 3.4 不做百分比存储

滚动位置存像素值，不存百分比。恢复时按百分比计算。

---

## 4. 分栏场景

| 场景 | 墨线行为 |
|------|---------|
| 单栏预览/阅读 | 正常显示（右边缘 3px 处） |
| 编辑+预览（左右分栏） | 预览 pane 墨线在预览区右侧；编辑区无墨线 |
| 上下分栏（两文档） | 两个 pane 各自显示自己的墨线 |

---

## 5. Store 变更

### 5.1 `tabs.ts`

```typescript
interface TabState {
  // ... 现有字段
  scrollPos: number;       // 滚动位置（px）
  contentHeight: number;   // 文档总高度（px）
  lastScrollAt: number;    // 上次滚动时间（用于 debounce）
}
```

### 5.2 新增 actions

```typescript
// 滚动时调用（组件层 RAF throttle）
function setScrollPos(scrollTop: number, contentHeight: number) {
  set((s) => {
    const id = s.activeTabId;
    if (!id) return s;
    return {
      tabs: {
        ...s.tabs,
        [id]: { ...s.tabs[id], scrollPos: scrollTop, contentHeight },
      },
    };
  });
}

// 打开 tab/切换 tab 时调用；contentHeight 变化时按百分比恢复
function getRestoredScrollPosition(filePath: string, currentContentHeight: number): number {
  const tab = get().tabs[filePath];
  if (!tab || tab.scrollPos == null) return 0;
  if (tab.contentHeight === currentContentHeight) return tab.scrollPos;
  const ratio = tab.scrollPos / (tab.contentHeight || 1);
  return ratio * currentContentHeight;
}
```

---

## 6. 不做的事（YAGNI 声明）

1. **不做 hover 展开面板**——不显示章节名、百分比、剩余时间
2. **不做百分比存储**——存像素值
3. **不做"阅读完成"检测**——用户知道读完了，不需要系统判断 95% + 停留 2s
4. **不做"读完后操作条"**——那是 A-5 收卷系统的职责
5. **不做阅读统计**（本周读了几篇、累计时长）——P2 成长系统
6. **不做阅读目标**（每天 30 分钟）——P2
7. **不做章节跳转节点**——P1 大纲侧栏 (`Cmd+Shift+E`) 的职责
8. **不做新 JSON 文件**——用现有 tabs store
9. **不做"读完标记"**——closed 文档自然记了 scrollPos，这也是"读完"的证据

---

## 7. 验收标准

| # | 场景 | 预期 |
|---|------|------|
| 9.1 | 打开文档向下滚动 | 墨线从上至下由浅变深 |
| 9.2 | 沉浸态 | 墨线不显示（沉浸态 chrome 全隐藏） |
| 9.3 | 沉浸态按 Esc 浮出工具栏 | 墨线重新显示 |
| 9.4 | 编辑态 | 墨线不显示 |
| 9.5 | 关闭再打开文档 | 滚动位置恢复 |
| 9.6 | 文档已修改（加段落）再打开 | 按比例恢复位置（可能略偏，可接受） |
| 9.7 | 快速滚动 | 不卡顿（RAF throttle） |
| 9.8 | 无历史位置的新文档 | 跳到顶部 |
| 9.9 | 分栏预览+编辑 | 仅预览 pane 有墨线 |
| 9.10 | 文档高度变化后恢复位置 | 百分比计算（文档未大改时误差 < 5%） |
