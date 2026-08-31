---
title: "Capture Overlay — v3 设计草稿（供 Codex 碰撞）"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay — v3 设计草稿（供 Codex 碰撞）

> 基于 outline-quick-capture-final.md v2.3 + ui-design-philosophy + 印哥指令

## 一、核心目标
用户最高频窗口。必须是 Apple/Xcode 水准：打开就写，操作即所得，无打扰。

## 二、布局

```
┌──────────────────────────────────────────────────┐
│  ●                              ⊟  ✕               │ ← 44px top bar
│  ┌─pin btn──┘  ┌─minimize──┘    ┌─close─┘        │
│                                                  │
│  ⊕ 记录                                 3 条未处理  │ ← placeholder + count
│  .问题  -待办  !灵感  ?思考                       │
│                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  今天                                            │
│  ! 怎么让 CM6 hover 不抢焦点            ✓ ⋯      │
│  - 给 inbox 设计 review               ✓ ⋯      │
│  ? 为什么 hover 不用 200ms            ✓ ⋯      │
│                                                  │
│  [展开历史 ▾] 7 条                     [钉住]    │
└──────────────────────────────────────────────────┘
```

## 三、设计决策

### 3.1 Top Bar（44px）
- **left: drag dot** — 拖动移动窗口位置，4px 小灰点，hover = col-resize + 放大 1.5x
- **center: label** — "⊕ 记录" 小字，淡色
- **right controls**（positioned absolute top-right, 6px inset）：
  - ⊟ minimize（方框）：淡入淡出 100ms，点击后浮窗缩小为浮动胶囊停靠左下
  - ✕ close ×：hover 红色圆角背景（macOS 红绿灯色）

### 3.2 输入区
- Auto-focus on open
- Input height 52px (自适应 font-size)
- Prefix indicator 显示在左侧 8px，color-coded（. 黑, - 橙, ! 紫, ? 蓝）
- Placeholder随prefix切换：
  - ""  → ".问题  -待办  !灵感  ?思考"
  - "." → "输入问题…"
  - "-" → "输入待办…"
  - "!" → "记录灵感…"
  - "?" → "开放思考…"

### 3.3 保存反馈
- 保存成功：输入框下方 0px 高度弹出一行灰色文字 "已保存" → 500ms 后淡出并 collapse
- Apple Notes 风格的 subtle confirmation，不做成 toast

### 3.4 History 列表
- 默认显示今天的分组
- 历史折叠按钮 `[展开历史 ▾]` 显示 count
- 每条左侧：prefix symbol（彩色）+ 内容
- 每条右侧：archive ✓ 按钮 + ⋯ menu
- archive 执行 → 项淡黄色闪烁一次 + 滑动出列表（300ms）+ 4s undo 倒计时（"已归档"）

### 3.5 Minimize 模式
- 浮窗缩小为 44×44px 胶囊停靠屏幕右下角
- 白色背景 + 轻微阴影 + 圆角 11px（macOS small button size）
- hover 显示 tooltip "⊕ Jianxi Quick Capture"
- 点击恢复

### 3.6 Pinned 模式
- 钉住按钮（右上角，⊌icon 形式）
- 钉住时 overlay 变为固定在屏幕右上角的 persistent 小窗
- 钉住状态下仍可输入、保存（不打断专注模式）

## 四、颜色语义

```css
:root {
  --overlay-bg: rgba(255, 255, 255, 0.85); /* glassmorphism */
  --overlay-bg-dark: rgba(28, 28, 28, 0.85);
  --overlay-blur: 20px;
  --overlay-border: rgba(0, 0, 0, 0.06);
  --overlay-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  --prefix-color-note: #1f2937;
  --prefix-color-todo: #f59e0b;
  --prefix-color-idea: #a855f7;
  --prefix-color-wonder: #0071e3;
  --archive-green: #10b981;
  --macos-red: #ff5f57;
  --macos-yellow: #febc2e;
  --macos-green: #28c840;
}
```

## 五、Animation

```css
/* Spring pop open */
@keyframes overlayIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.overlay-enter {
  animation: overlayIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Archive slide out */
@keyframes slideOut {
  to { transform: translateX(100%); opacity: 0; background: rgba(254,243,199,0.5); }
}

/* Save confirmation fade */
@keyframes saveFlash {
  0%   { opacity: 1; transform: translateY(0); }
  70%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-4px); }
}
```

// ponytail: all native CSS deps, zero JS animation libs
