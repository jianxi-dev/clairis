---
title: "A-5 沉浸阅读设计规格"
type: design
status: archived
last_updated: 2026-08-01
source_of_truth: historical
redirect: docs/design/approved/immersive-reading/spec.md
---

# A-5 沉浸阅读设计规格

> 来源：July 12, 2026 印哥 + Hermes 设计讨论
> 阶段：Phase R
> 核心哲学对照：`CORE-REQUIREMENTS-clairis.md` "产品哲学：沉浸、仪式、留白"  

---

## 1. 问题陈述

当前 `readingMode: boolean` 实现太粗暴——它是"有/无"二态，所有 chrome 一次性消失。这不是沉浸，是恐惧。用户按 Esc 出来后不知道"我在哪"。

真正的沉浸不是剥夺信息，是**把信息调到正确的层次**——像沉入水底听岸上的声音变小，不是耳朵塞住。

---

## 2. 进入沉浸：沉入

### 2.1 触发入口

| 触发器 | 来源 |
|--------|------|
| `Cmd+\\` | 当前实现（保留） |
| 双击文档正文右下角 | 新增：手势隐喻"合上书" |
| 完成收卷动画 | 读完当前文档后自动过渡到下一篇时触发 |

### 2.2 进入快照（Pre-Immersion Snapshot）

进入前立即冻结 store：

```typescript
interface ImmersionSnapshot {
  toolbarVisible: boolean;       // 工具栏当时的可见性
  leftSidebarVisible: boolean;   // 左栏状态
  rightSidebarVisible: boolean;  // 右栏状态
  splitDirection: SplitDirection; // 当前是否分屏
  splitTabIds: [string, string] | null;
  readingProgress: number;       // 进入时的阅读位置（0-100）
  timestamp: number;             // 进入时刻
}
```

**为什么？** 用户可能"已经沉浸了"（工具栏本来就是隐藏的），进入只是加深。退出时不对齐当前布局 = 用户觉得界面"乱跳"。

### 2.3 沉浸过渡动画

不是 `display:none` 切换，是 0.4s 的合成层过渡：

| 元素 | 过渡方式 |
|------|---------|
| 工具栏 | opacity 1→0, translateY(0→-4px), 0.4s ease-out |
| 侧栏 | opacity 1→0, scale(1→0.98), blur(0→2px), 0.4s |
| Tab 栏 | opacity 1→0, 同步工具栏 |
| 主文档区 | 保持完全可见，无任何变化 |
| 背景 | 保持当前底色（不切换主题） |

**总计过渡时长视动效可感知度，用户第一次看到后自然接受 0.3-0.4s。**

---

## 3. 沉浸态内部：隐与显的边界

### 3.1 浮出触发器

沉浸态下用户可以主动唤起 chrome：

| 触发 | 浮出内容 | 时长 |
|------|---------|------|
| 鼠标逼近屏幕上边缘 2px | 工具栏淡入（opacity 0→1），鼠标离开 2s 后淡出 | 0.3s |
| 鼠标逼近屏幕左边缘 3px | 侧栏淡入（draggable handle 样式），离开 1.5s 后收回 | 0.3s |
| `Cmd+Option` 按下 | 全部 chrome 保持可见直到松开 | 按住即显 |
| 中键点击 | 唤起上下文菜单（保留在沉浸态内） | — |

**不浮出：状态栏、字数统计、Tab 栏。它们不应该在沉浸态打扰用户。**

### 3.2 字号调整在沉浸态的行为

沉浸态阅读时按 `Cmd+=/-` → 字号增大 1px（范围 12-32），0.6s 后屏幕正中央偏上 1/5 高度处浮现当前字号数字（如 "20px"），opacity 0→1→0 总时长 1.2s。

### 3.3 阅读进度在沉浸态的行为

沉浸态下进度指示器（A-9 墨线）继续存在且**视觉权重微降**（rgba 透明度从 1.0 降至 0.7），不打扰但余光可取。

---

## 4. 退出沉浸：浮出水面

### 4.1 短按 Esc（轻退出）

- 工具栏淡入（0.3s），侧栏保持隐去
- 文档继续当前位置，不跳转
- 光标变为可读状态（文本选择可操作）
- 标题栏（macOS 原生）浮出

**用于："我想用一下工具，但还在读书"**

此时再按一次 Esc，进入完全退出（见下）。

### 4.2 短按 Esc 后再按 Esc / 长按 Esc（完全退出）

- 快照恢复：toolbarVisible、sidebars、split 状态按快照还原
- 如果快照和原状态有差异（进入后用户手动改过），以 **用户最后意图** 为准
- 过渡时长 0.4s，不是跳切

### 4.3 用其他方式退出

| 操作 | 视为 |
|------|------|
| `Cmd+↑` (Desk) | 完全退出 + 打开 Desk |
| `Cmd+P` (File Panel) | 完全退出 + 打开文件面板 |
| `Cmd+N` (New) | 完全退出 + 新建文档 |
| `Cmd+O` (Open) | 完全退出 + 打开文件对话框 |
| `Cmd+W` (Close) | 完全退出 + 关闭当前文档 |
| 读完文档触发收卷 | 自动退出沉浸，执行收卷动画 |

---

## 5. 特殊场景

### 5.1 编辑模式 → 沉浸

默认禁止。编辑态切换沉浸，先存"编辑位置"（cursor position），沉浸退出后光标可恢复。

如果用户在编辑态按下 `Cmd+\\`：
- 如果当前文档未保存（dirty），弹一次确认："正在编辑中，进入沉浸将自动保存" [进入并保存] [取消]
- 如果已保存，直接进入

### 5.2 分屏 + 沉浸

分屏模式下进入沉浸：
- 分屏分割线在沉浸态不显示
- 两个文档并排，共享同一条墨线（叠加显示）
- 两个文档字号同步缩放
- Esc 退出后恢复分屏线条

### 5.3 全屏与沉浸

全屏（macOS 原生全屏按钮）+ 沉浸：
- 沉浸在全屏下正常工作
- 全屏退出前，先退出沉浸，再退出全屏
- 或者：先"淡入"工具栏（告诉用户"你正在离开沉浸"），再需要鼠标移到屏幕顶部触发 macOS 原生菜单栏显示

---

## 6. 技术规格

### 6.1 Store 变更

```typescript
// tabs.ts slice 新增（沉浸式阅读用）
interface ImmersionState {
  active: boolean;
  snapshot: ImmersionSnapshot | null;
  enteredAt: number | null;
  /** 沉浸态期间字号覆盖值（null = 使用全局默认） */
  fontSizeOverride: number | null;
  /** 沉浸态下"软退出"= 仅工具栏可见，非完全退出 */
  softExit: boolean;
}

// ReadingProgress（跨 A-5/A-9）
interface ReadingProgressEntry {
  filePath: string;
  position: number;        // 0-100 百分比
  lastReadAt: number;      // Date.now()
  totalHeight: number;     // 内容总高（px）
  viewportHeight: number;
  updatedAt: number;       // 上次写入时间（用于 throttle）
}
```

### 6.2 CSS 变量命名约定

```css
:root {
  --immersion-toolbar-opacity: 1;
  --immersion-sidebar-opacity: 1;
  --immersion-transition-duration: 0.4s;
}
```

沉浸态给 `<html>` 加 `data-immersion="active"` 属性，所有 chrome 的 transition 走 CSS 变量。这一点保证沉浸态切换只需要一次 class toggle，零 JS 动画逻辑。

### 6.3 持久化策略

| 数据 | 存储位置 | 说明 |
|------|---------|------|
| 沉浸快照 | 内存（store） | 关闭文档时丢弃 |
| 字号覆盖 | 内存（store） | 关闭文档时丢弃 |
| 阅读位置 | `~/.config/clairis/reading-progress.json` | 跨会话恢复，最多 50 条 |
| 全局字号偏好 | `~/.config/clairis/config.json` | 持久化 |

阅读位置写入 throttle：滚动停止 200ms 后再写入，避免磁盘 IO 过载。

---

## 7. 不做的事（YAGNI 声明）

1. **不做"沉浸主题"切换**（深色/浅色/护眼在沉浸态不变）— 用户选择主题是因为喜欢，不是因为沉浸。后续 P2 "感知仪式"会用。
2. **不做"专注模式"= 聚焦当前段落，其余 blur**— 那是另一条产品线，渐晰的沉浸是"少 chrome"，不是"少内容"。
3. **不做"自动进入沉浸"设置**（如打开文件 N 秒后自动进入）— 太打扰，非用户主动触发。
4. **不做"沉浸计时器"**（统计本次沉浸多久）— P2 "成长系统"需要时再加。
5. **不做沉浸态内的图片预览放大**— 现有媒体预览已支持，不因为沉浸态改逻辑。

---

## 8. 验收标准

| # | 场景 | 预期 |
|---|------|------|
| 5.1 | 工具栏可见时按 Cmd+\\ | 沉浸过渡 0.4s，工具栏淡出，文档不动 |
| 5.2 | 沉浸态按一次 Esc | 工具栏淡入（0.3s），侧栏不动 |
| 5.3 | 5.2 后再按 Esc | 完全退出，布局快照还原 |
| 5.4 | 沉浸态鼠标移到顶部 2px 边缘 | 工具栏淡入，离开 2s 后淡出 |
| 5.5 | 沉浸态按 Cmd+= | 字号 +1px，"18px" 淡入淡出 1.2s |
| 5.6 | 编辑态 dirty 按 Cmd+\\ | 弹确认框；选"进入并保存"后保存+进入沉浸 |
| 5.7 | 沉浸态读完触发收卷 | 收卷动画完成后，自动退出沉浸 |
| 5.8 | 沉浸态打开另一篇文档 | 当前文档字号覆盖记忆丢弃，恢复到新文档的字号覆盖或全局默认 |
| 5.9 | 全屏 +沉浸 + Esc | 工具栏淡入（告诉用户退出沉浸中），再按 Esc / 移鼠标触发 macOS 菜单 |
| 5.10 | 分屏+沉浸+字号调整 | 两个文档字号同步变化 |
