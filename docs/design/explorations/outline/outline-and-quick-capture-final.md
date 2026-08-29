---
title: "渐晰 — 大纲侧栏 + 灵感快速录入 最终设计"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: docs/design/approved/outline-quick-capture/spec.md
superseded_by: ../../approved/outline-quick-capture/spec.md
---

# 渐晰 — 大纲侧栏 + 灵感快速录入 最终设计

> 状态: 已定稿（Codex 3轮对抗审查通过）
> 来源: 印哥需求 + Ponytail/Codex 5+3 轮对抗
> 替代: outline-and-quick-capture-design.md（归档）

---

## 一、大纲侧栏 — Pin Only，无标签页

### 1.1 规格

| 项目 | 规格 |
|------|------|
| 位置 | 右侧，240px 宽（可拖至 400px） |
| 触发 | `Cmd+Shift+E` toggle（唯一模式） |
| 固定方式 | Pin（挤压主画布） |
| 悬浮模式 | **无** |
| Hover 模式 | **无** |

### 1.2 面板内部

```
┌─────────────────────┐
│ 大纲             [📌] │  ← Pin 图标；点击 toggle
│─────────────────────│
│ 1. 产品定义          │  H1, 缩进 0
│  1.1 一句话定义      │  H2, 缩进 12px
│  1.2 产品哲学        │  H2
│   1.2.1 红线是甚幺  │  H3, 缩进 24px
│ 2. 路线图            │  H1
│  2.1 Phase M        │  H2
│  ≠ 当前标题          │  ← 蓝色竖条 + 粗体
│ 3. 性能架构          │  H1
│─────────────────────│
│ [+ 记录]             │  ← 拉出 Quick Capture
└─────────────────────┘
```

### 1.3 交互

| 动作 | 行为 |
|------|------|
| 单击标题 | 文档滚动到对应位置 |
| hover 标题 | 显示位置百分比 |
| 当前标题 | 蓝色粗条 + 自动滚动到视口 |
| Cmd+Shift+E toggle | 打开/关闭侧栏 |
| 进入沉浸阅读 | 隐藏 |

### 1.4 实现

- 面板 Pin 状态持久化（config.ts）
- 大纲数据实时从文档 CM6 state 提取（H1-H6）
- 无 TabBar / Split 系统介入
- 不进入任何标签页系统

---

## 二、灵感快速录入 — Quick Capture Overlay

### 2.1 触发逻辑

```
Cmd+Shift+. 按下（系统级全局，任何 App 焦点下）:

if (主窗口有焦点 || onFocusChanged=true 最近) {
  overlay.show();
  overlay.focusInput();     // 立即 auto-focus
} else {
  window.requestUserAttention();  // Dock bounce
  overlay.show();           // 显示但不抢焦点
  // 用户 Cmd+Tab 渐晰后，onFocusChanged → overlay.focusInput()
}
```

> 实现细节：用 `onFocusChanged` 事件维护 `wasFocusedRef` 布尔值，不用 `isFocused()` 轮询——有 race condition。

### 2.2 窗口规格

```
┌─────────────────────────────────────┐
│ [+ 记录]  08-12 14:32          [×]  │
├─────────────────────────────────────┤
│                                      │
│ [永远 auto-focus 的输入框]         │
│                                     │
├─────────────────────────────────────┤
│ 已输入 42 字                         │
└─────────────────────────────────────┘
```

- 主窗口内 overlay（不需要新窗口）
- 宽 560px, 高 56px, 窗口顶部中央偏下
- 淡入 <80ms; 淡出 <60ms

### 2.3 键盘交互

| 键 | 行为 |
|----|------|
| Enter | 保存当前条 + 清空输入框 + 窗口保留 |
| Shift+Enter | 同 Enter（单行模式下无意义） |
| Cmd+Enter | 切换到多行模式（展开为 textarea） |
| Esc | 保存 + 关闭 overlay |
| Cmd+W | 关闭 overlay |

### 2.4 保存格式

```
~/documents/inbox/inbox-YYYY-MM-DD.md

每次保存追加:

---
time: 2026-07-12T14:32:00+08:00
---

这里写什么。原始内容,不 auto-tag,不 auto-detect。
空行分隔两条记录。
```

**不实现：** auto-tagging、frontmatter 自动检测、AI 分析。

### 2.5 文件组织结构

```
~/documents/inbox/
  inbox-2026-07-12.md    ← 当天录入
  inbox-2026-07-11.md    ← 昨天
  archive/               ← 处理过的条目移到这里
    inbox-2026-07-05.md
```

- 无 TTL / 自动删除
- `archive/` 不存在时自动创建
- 用户手动清理 archive 或 P2 加 TTL

---

## 三、P1 最小整理 — ✓ 已处理

### 3.1 入口

`Cmd+P` 空查询 → "继续"分组内每条 Quick Capture 条目旁有圆角按钮：

```
继续
  ● 无侧栏方案.md        引用过 · 2min前
  ◦ 开销的问题思考    [✓]  今天录入 · 7min前
  ◦ 想到的待办事项    [✓]  今天录入 · 12min前
```

### 3.2 动作

点击 `✓`:
1. 把该条目追加到 `archive/inbox-YYYY-MM-DD.md`（保持时间戳 header）
2. 从当天文件删除该条目
3. "继续"列表即时更新

实现顺序：append-to-archive → delete-from-inbox（防 data loss）

### 3.3 这就是 P1 唯一的整理动作。

**P2 R 阶段：** 转正（→ 灵感文件夹/正式文档）、合并、重组、标签系统。

---

## 四、已完成/已删除需求对照

| 原始需求 | 结果 |
|---------|------|
| 大纲不需要单独页签 | ✅ 完成（侧栏，toggle） |
| 栏目右侧小图标，hover 显示 | ❌ 删掉 hover（anti-pattern） |
| 点击固定按钮固定显示 | ✅ 完成（Pin toggle） |
| 随手记录日常问题、待办、临时 | ✅ 完成（daily inbox） |
| 灵感偶尔录入 | ✅ 完成（同一入口） |
| 窗口钉在最前面 | ❌ 删掉（主窗口 overlay 没有顶层独立窗口问题） |
| 窗口调整长宽比例 | ❌ 删掉（overlay 固定尺寸） |
| 窗口最小化图标显示 | ❌ 删掉（pill-minimize = research project） |
| 录入后查看整理是 R 级重点 | ⚠️ 降级（P1 最小=✓已处理，完整版 P2） |

---

## 五、Store 切片归属

| 功能 | Slice | 字段 |
|------|-------|------|
| 大纲 Pin 状态 | nav.ts | `outlinePinned` |
| 大纲当前选中标题 | nav.ts | `outlineActiveId` |
| 大纲展开层级 | nav.ts | `outlineCollapsedSet` |
| Quick Capture 条目列表 | nav.ts | `quickCaptures[]` |
| Quick Capture 窗口位置 | config.ts | `captureWindowPos` |
| Quick Capture archive 目录 | config.ts | `captureArchivePath` |

---

## 六、快捷键总结

```
Cmd+Shift+E     → toggle 大纲侧栏（Pin only）
Cmd+Shift+.     → Quick Capture（全局，不抢 focus 场景有 Dock bounce）
Cmd+W           → 关闭 overlay
Enter           → 保存 + 清空（overlay 保留）
Esc             → 保存 + 关闭 overlay
```

---

## 七、实施阶段

| 功能 | 阶段 |
|------|------|
| 大纲 Cmd+Shift+E toggle + Pin | P1 |
| 大纲缩进 + 当前标题高亮 | P1 |
| Quick Capture overlay（主窗口内） | P1 |
| Quick Capture global hotkey + Dock bounce | P1 |
| Quick Capture onFocusChanged + auto-focus | P1 |
| Quick Capture daily inbox save | P1 |
| Quick Capture archive 移动（✓ 已处理） | P1 |
| Cmd+P "继续" 分组 + Quick Capture 条目 | P1 |
| Quick Capture 转正/合并/重组 | P2 |

---

## 八、Codex 3 轮对抗总结

| 轮次 | Codex 结论 |
|------|-----------|
| R1 | 2 HIGH: hover+pin 是伪装 sidebar; multi-window 过工程 |
| R2 | 3 NEW: swingFocus config; continue 未定义; R stage 悬停 |
| R3 | **"No HIGHs, ship it."** |

// ponytail: 文档终稿。Codex R3 裁定 Focus 检测改用 onFocusChanged 事件实现，不用 isFocused() 轮询。归档。
