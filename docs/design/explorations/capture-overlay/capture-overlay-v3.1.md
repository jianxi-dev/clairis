---
title: "Capture Overlay — v3.1 (post-5-round collision)"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay — v3.1 (post-5-round collision)

> 状态: v3.1 — 印哥确认后实施
> 来源: v3 draft + 5轮碰撞合并
> 替代: v3 draft

---

## 碰撞结果合并

| # | 发现 | 处置 |
|---|------|------|
| 1 | Placeholder hints row — 8彩色项偷走注意力 | 删除 hints 行。placeholder 纯文本 "记录…"，颜色前缀只在用户输入后才出现 |
| 2 | Escape 在 pinned 态下不还原 | 三态机 CLOSED → PINNED → NORMAL。Esc 逐级降级 |
| 3 | 合盖/拔屏后坐标越界 | 恢复/创建时 clamp 到 `screen.workArea` |
| 4 | 保存 flash 高度0不可见 + 推挤 history | 删除 toast。item 出现在 history 中 = 反馈 |
| 5 | archive 条目滑出后 undo 按钮不可见 | 先保持原位显示 "已归档·[撤销]" 5s，超时后再滑出。commit-on-click（非 timeout）|
| 6 | 键盘覆盖缺失 | ↑↓ 在 history 中导航，Enter 聚焦项 archive，Esc 逐级降级，modal focus trap，drag-dot 非 focusable |
| 7 | store 字段缺失 | 新 `captureOverlay.ts` slice，15 字段 + 3 types |

---

## 一、布局

```
┌──────────────────────────────────────────┐
│ ●                           ⊟  ✕         │  top bar 44px
│ ⊕ 记录                          3 条未处理 │
│                                          │
│ [记录…]                                  │  input 52px
│                                          │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ 今天                                     │
│ ! 怎么让 CM6 hover 不抢焦点    ✓  ⋯      │
│ - 给 inbox 设计 review        ✓  ⋯      │
│ ? 为什么 hover 不用 200ms     ✓  ⋯      │
│                                          │
│ [展开历史 ▾] 7 条              [钉住]     │
└──────────────────────────────────────────┘
```

---

## 二、设计决策

### 2.1 Top Bar (44px)
- **left: drag dot** — 拖动移动位置，4px 灰点，hover 放大 1.5x、cursor col-resize
- **center: label** — "⊕ 记录"，淡灰小字
- **right controls**（absolute top-right, 6px inset）：
  - ⊟ minimize：点击 → 浮窗缩小为胶囊停靠右侧底部
  - ✕ close：hover 红色圆角背景（macOS red #ff5f57）

### 2.2 输入区
- 打开即 auto-focus
- input height 52px
- 前缀指示器显示在输入框左侧 8px，随 mode 变色（. 黑 - 橙 ! 紫 ? 蓝）
- placeholder 统一为 "记录…"，**不在输入区上方展示 hints 前缀说明**

### 2.3 保存反馈（Delete toast → 删除）
- **v3 draft 有 toast "已保存" 500ms 淡出 → 删除**
- item 出现在 history 列表即 = 视觉反馈
- YAGNI — 不新增动画层

### 2.4 前缀与 double-Enter 重置
- 空状态输入 `.problem` → Enter → 保存 + 清空 + 切换到 `. mode`
- `. mode` 输入 anything → Enter → 保存 + 清空 + 保持 `. mode`
- `. mode` 为空时再按 Enter → 清除 prefix，回到空状态
- **用户只按 Enter 不需要 Delete**

### 2.5 历史列表
- 默认显示今天分组
- `[展开历史 ▾]` 按钮显示 count
- 每条：左侧 prefix symbol（彩色）+ 内容，右侧 archive ✓ 按钮 + ⋯ menu
- **← ↑↓ 箭头键导航 history（5轮碰撞新增）**
- 聚焦项高亮（bg-blue-50/brand-blue 10%），Enter on focused item = archive
- 默认折叠（Collapsible）

### 2.6 归档 + Undo
- 点击 [✓] → 条目保持原位，文字变 "已归档 · [撤销]"，5s 倒计时
- "已归档" 为绿色文字，[撤销] 为品牌蓝色按钮
- 5s 内点击 [撤销] → 撤销归档，恢复原状态
- 5s 后 → 条目淡黄色闪烁，slideOut 300ms 消失
- **commit-on-click**：点击时即写入 archive 文件，非 timeout-time

### 2.7 Minimize Capsule
- 44×44px 胶囊停靠屏幕右下角
- 白色背景 + 轻微阴影（shadow-sm），圆角 11px（macOS 小控件尺寸）
- hover → tooltip "⊕ Jianxi Quick Capture"
- 点击 → 恢复浮窗
- **窗口坐标 clamp 到 screen.workArea，防止多屏/合盖越界**

### 2.8 Pin 模式
- 钉住按钮（右上角，⊌ icon）
- 钉住时 overlay 变为固定在屏幕右上角的 persistent 小窗
- 钉住时 Esc → 先 unpin 回到 NORMAL，再 Esc 才 Capsule/Closed
- **状态优先级：Capsule > Pin > Normal**（Capsule 是最终最小态）

### 2.9 状态机

```
CLOSED ──Cmd+Shift+.──→ NORMAL ──Escape(有内容)──→ 清空 input
                          │
                    Escape(空) ──→ CLOSED
                          │
                    点 ⊟ 或 Escape+空 ──→ CAPSULE
                          │
                    Escape(pinned) ──→ 先 unpin 到 NORMAL

CAPSULE ──点击胶囊──→ NORMAL (恢复原位置, clamp to workArea)

NORMAL ──点钉住──→ PINNED
PINNED ──Escape──→ NORMAL
PINNED ──点 ⊟ ──→ CAPSULE
```

### 2.10 键盘覆盖

| 输入框 | 行为 |
|--------|------|
| Enter | 保存当前内容（如有）或空保存 |
| Escape (有内容) | 清空输入 |
| Escape (空) | Capsule / Close |

| History List | 行为 |
|--------------|------|
| ↑↓ | 上下导航 |
| Enter (focus on item) | archive 聚焦项 |
| Tab | 从 input 跳到 history item |
| Shift+Tab | 反向 |
| Escape | 逐级降级 (PINNED → NORMAL → CLOSED) |

- **Drag-dot 非 focusable**（mouse-only by design）
- **Escape 在 IME composition 期间禁用**（compositionstart/end 监听）
- **Modal focus trap**: Tab 循环在 overlay 内部（Shift+Tab 在 input 时停止，不在 input 时跳到 history 末项）

---

## 三、颜色语义

```css
:root {
  --overlay-bg: rgba(255, 255, 255, 0.88);
  --overlay-bg-dark: rgba(28, 28, 28, 0.90);
  --overlay-blur: 24px;
  --overlay-border: rgba(0, 0, 0, 0.07);
  --overlay-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0,0,0,0.06);
  --prefix-note: #1f2937;
  --prefix-todo: #f59e0b;
  --prefix-idea: #a855f7;
  --prefix-wonder: #0071e3;
  --archive-green: #10b981;
  --macos-red: #ff5f57;
  --macos-yellow: #febc2e;
  --macos-green: #28c840;
  --spring: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

---

## 四、Animation

```css
@keyframes overlayIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.overlay-enter { animation: overlayIn 0.22s var(--spring); }

@keyframes capsuleIn {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}
.capsule-enter { animation: capsuleIn 0.18s var(--spring); }

@keyframes archiveSlideOut {
  0%   { transform: translateX(0); opacity: 1; background: rgba(254,243,199,0.4); }
  100% { transform: translateX(100%); opacity: 0; }
}
.archive-out { animation: archiveSlideOut 0.3s var(--spring); }
```

// ponytail: zero CSS/JS animation libs, native only

---

## 五、Store — `captureOverlay.ts` 新 slice

```typescript
export type CaptureStatus = 'closed' | 'normal' | 'pinned' | 'capsule';
export type CapturePrefix = '' | '.' | '-' | '!' | '?';

export interface InboxEntry {
  id: string;
  type: 'problem' | 'todo' | 'idea' | 'wonder' | 'note';
  prefix: CapturePrefix;
  content: string;
  capturedAt: string;  // ISO
  archivedAt?: string;
}

export interface UndoState {
  entryId: string;
  deadline: number;    // Date.now() + 5000
}

export interface CaptureOverlayState {
  status: CaptureStatus;
  input: string;
  history: InboxEntry[];
  displayLimit: number;
  collapsed: boolean;
  selectedIndex: number;     // -1 = input, 0+ = history index
  undo: UndoState | null;
  position: { x: number; y: number };
  savedAckId: string | null; // last saved entry id (for 100ms flash)

  // Actions
  open: () => void;
  toggle: () => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  togglePin: () => void;
  setPrefix: (p: CapturePrefix) => void;
  setInput: (v: string) => void;
  appendInput: (v: string) => void;
  commitEntry: () => void;    // Input Enter → save + clear + mode switch
  archiveEntry: (id: string) => void;
  undoArchive: (id: string) => void;
  tickUndo: () => void;       // fire on 1s interval, slide-out after deadline
  selectNext: () => void;
  selectPrev: () => void;
  expandHistory: () => void;
  collapseHistory: () => void;
  loadMore: () => void;
  clampPosition: () => void;
}
```

**字段合并到 layoutStore 而非独立 store**：因 overlay 是瞬时 UI 状态，不持久化到 disk（只持久化 position）。layoutStore = stores/index.ts 内新增 `captureOverlay` 子 slice。

---

## 六、文件结构

```
src/
  stores/
    index.ts              ← 合并 captureOverlay slice
    captureOverlay.ts     ← 独立文件：InboxEntry, CaptureOverlayState 类型 + actions
  types/
    index.ts              ← 新增 InboxEntry, UndoState, CaptureStatus, CapturePrefix re-export
  components/
    CaptureOverlay/
      CaptureOverlay.tsx   ← 主组件 (~220 lines)
      useCaptureShortcut.ts ← Cmd+Shift+. hook
  hooks/
    useCaptureOverlayStore.ts ← 暴露 useStore((s) => s.captureOverlay) 的 selector shortcut

docs/designs/
  capture-overlay-v3-draft.md (不变，归档)
  capture-overlay-v3.1.md (本文)
```

// ponytail: ~2 新文件 + 修改 stores/index.ts + types + App.tsx

---

## 七、Tauri 全局快捷键

```
Cmd+Shift+. (macOS):
  if (已聚焦渐晰) → open overlay, focus input
  if (其他 App)   → JS 监听 dock-focus → jump to overlay on focus

Tauri GlobalShortcut::register("Cmd+Shift+.", handler)
  handler → invoke frontend method: window.__clairis_toggle_capture()
  onFocusChanged → auto-focus input (prevent race with mainWindow.isFocused())
```

// ponytail: 复用 App.tsx 现有 captureHandler pattern

---

## 八、碰撞通过总览

| 轮次 | 主治 | 碰撞结果 |
|------|------|---------|
| R1 | 外观 chrome | Placeholder hints row 删除 |
| R2 | 状态机 | 三态 Esc 降级 + clamp + Capsule>Pin |
| R3 | 时序 | Save toast 删除 + archive inline undo 5s |
| R4 | 键盘 | ↑↓ Enter Esc focus trap + IME guard |
| R5 | Store | 新 captureOverlay slice 15字段 |

---

## 九、排除清单（YAGNI）

- ❌ 保存 toast (item in history = feedback)
- ❌ prefix hints row (revealed after typing)
- ❌ 自定义动画库 (CSS native only)
- ❌ toast/snackbar (inline archive confirmation)
- ❌ 多窗口模式 (one BrowserWindow instance only)
- ❌ batch select / promote / filter (P2)

---

// ponytail: v3.1 = v3 − prefix hints − save toast + Esc 三态机 + 键盘覆盖 + archive inline undo + clamp。~220 lines TSX + 80 lines store + 30 lines types.
