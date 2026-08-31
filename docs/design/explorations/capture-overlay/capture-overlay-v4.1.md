---
title: "Capture Overlay v4.1 — 多行 + pin + 胶囊 + 预览"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay v4.1 — 多行 + pin + 胶囊 + 预览

> 状态: v4.1 — 碰撞后终稿候选，印哥确认
> 替代: v4
> Ponytail: full · 多行 textarea 驱动重写 · Cmd+Enter 提交 · 关闭时一次写入 · 全栏 drag + dblclick min · 胶囊 popover preview

---

## 零、从 v3.1 学到的

为什么翻车:

1. 我把 **Double-Enter 语义读错** — v3.1 里 Enter 保存 + Enter 清空。实际是 "prefix mode 下 Cmd+Enter 空内容退出 mode"
2. **单行 input** — 违背多行情绪输出需求
3. **3 个分散按钮 (drag dot / ⊟ / ✕)** — 与全顶栏拖拽 + 双击最小化冲突
4. **胶囊单击直接恢复** — 缺 preview state

v4.1 重写输入/顶栏/胶囊交互，store/颜色/animation 层复用 v3.1。

---

## 一、多行输入 (P1)

textarea 替代 input:

- font 14px / line-height 1.6 / padding 10px 12px
- min-height 40px (1行) / max-height 144px (6行) / auto-resize
- 超 6 行内部滚动

Enter 行为:

| 修饰 | 行为 |
|------|------|
| Enter (无) | 换行 |
| Shift+Enter | 换行 (兼容某些布局) |
| Cmd+Enter | commit |
| Tab | 插入 2 空格 |

Cmd+Enter 提交语义:

```
buffer 非空 → 写入 inbox-YYYY-MM-DD.md
            → 清空 textarea
            → 保持当前 prefix
            → history 列表顶部插入

buffer 空 + 有 prefix → Double-Enter 清空 prefix → 回空 mode
buffer 空 + 无 prefix → 静默 (不提示)
```

prefix 检测 — 仅 textarea 为空时输入 `./ - !/?` 单字符触发:

| mode | placeholder | badge 颜色 |
|------|-------------|-----------|
| . | 输入问题… | #1f2937 黑 |
| - | 输入待办… | #f59e0b 橙 |
| ! | 记录灵感… | #a855f7 紫 |
| ? | 开放思考… | #0071e3 蓝 |
| 空 | 记录… | – |

---

## 二、自动保存 (P2 — 碰撞后改)

> **碰撞结论**: timer-based 保存过度设计。draft 纯内存 + 关闭时写一次。

行为:

- 整个 overlay 生命周期 buffer 只在 store.draftContent *(memory)*
- 不写 draft.md

Cmd+Enter 时:

```ts
await invoke('append_inbox', { entry: formattedEntry })
clear draftContent
```

关闭 overlay 时 *(Esc / 关闭按钮 / 双击 min)*:

```ts
if (draftContent.trim())
  await invoke('append_inbox', { entry })  // 静默, 防丢失
```

崩溃恢复: overlay 瞬时设计, macOS 崩溃恢复不覆盖 *(YAGNI)*

---

## 三、新建 (P3)

入口:
1. 输入框左侧 ⊕ 按钮 *(prefix badge 旁)*
2. Cmd+N *(overlay 内)*

Cmd+N 行为:

```
overlay 关闭 → open + 清空 buffer
overlay 打开 + 有 buffer → commit 当前 + 清空 + 保持 prefix
overlay 打开 + 空 buffer → 静默
```

顶栏显示 **"7 条"** 仅此一处; 折叠按钮不再重复数字。

---

## 四、Top Bar (P4 + P5)

44px 全栏拖拽 *(Apple Notes 传统)*:

```
┌────────────────────────────────────────┐
│ ≡ ⊕ Jianxi Quick Capture       7 条  📌 ✕ │
└────────────────────────────────────────┘
 ↑                       ↑             ↑  ↑
 drag reg. 40px    label(no-drag)   钉住 关闭
```

HTML + CSS (-webkit-app-region):

```html
<div class="top-bar" style={{ WebkitAppRegion: 'drag' }}>
  <span style={{ WebkitAppRegion: 'no-drag' }}>⊕ Jianxi</span>
  <button style={{ WebkitAppRegion: 'no-drag' }}>📌</button>
  <button style={{ WebkitAppRegion: 'no-drag' }}>✕</button>
</div>
```

**P4 双击最小化** — 双击 top bar 任意非按钮区域 → minimize
- 200ms 守卫, 拖拽阈值 > 5px 取消双击计时 *(防误触)*

**P5 拖拽** — 整个 bar `cursor: grab`, button `cursor: default`

---

## 五、胶囊 (P6)

44×44px 停靠 bottom-right 24px:

```
按住 → 拖拽 (整个 capsule draggable)
      松开吸附最近边 (top/bottom/left/right)
单击 → popover preview *(200ms defer)*
双击 → restore 录入窗口 *(取消 pending 单击)*
```

Preview Popover *(280×360, 半透明)*:

- 只读 store.draftContent
- 最近 3 条 history *(预览级, 不交互)*
- Esc / 点击外部 → 关闭 popover, capsule 保留

Clamp: 超出 workArea 自动反向翻转 *(^ ↑ / v ↓ / < ← / > →)*

---

## 六、键盘覆盖

| 快捷键 | 上下文 | 行为 |
|--------|--------|------|
| Cmd+Shift+. | 全局 | toggle overlay |
| Cmd+Enter | overlay | commit buffer |
| Cmd+N | overlay | 新建 (commit + 清空) |
| Enter | textarea | 换行 |
| Tab | textarea | 2 空格 |
| Esc (buffer 非空) | overlay | 清空 buffer |
| Esc (buffer + prefix) | overlay | 退出 prefix mode |
| Esc (buffer 空) | overlay | minimize → capsule |
| Esc (popover) | capsule popover | 关闭 popover |
| ↑↓ | history 展开 | 导航 |
| Enter (item focused) | history | archive 聚焦项 |
| Cmd+Z / Cmd+Shift+Z | textarea | 原生 undo / redo |

**Focus trap**: Tab 循环在 overlay 内部; Shift+Tab 在 textarea 时跳到末 focusable
**IME 防护**: compositionstart 禁用 Esc 清空 *(防中文输入法误触)*

---

## 七、撤销

Cmd+Enter commit 后不实现 in-app undo toast *(v3.1 4s 倒计时已删)*。撤销走文件层: history [⋯] → 删除/还原。

---

## 八、Layout ASCII

overlay 打开 (未展开 history):

```
┌──────────────────────────────────────────┐
│ ≡ ⊕ Jianxi Quick Capture       7 条  📌 ✕ │
├──────────────────────────────────────────┤
│ .  _                                     │
│                                          │
│                                          │
└──────────────────────────────────────────┘
  [展开历史 ▾ 7条]              [钉住 ▴]
```

capsule (最小化):

```
┌────┐
│ ⊕  │  ← 按住拖 / 单击 popover / 双击恢复
└────┘
```

capsule popover (单击后):

```
      ┌──────────────────┐
      │ 当前 buffer:      │
      │ . 正在写的问题     │
      │                  │
      │ 最近:            │
      │ - review 流程    │
      │ !  hover 焦点    │
      └──────────────────┘
```

---

## 九、差异对比 (v3.1 → v4.1)

| 维度 | v3.1 | v4.1 |
|------|------|------|
| 输入 | 单行 input | 多行 textarea |
| 保存触发 | Enter | Cmd+Enter |
| 换行 | 否 | Enter |
| Double-Enter 重置 | Enter + Enter | Cmd+Enter 空 → 退出 mode |
| 自动保存 | 无 | 关闭一次写入 |
| 顶部计数 | 重复 | 仅顶栏一处 |
| 新建 | 按钮 | 按钮 + Cmd+N |
| 移动 | drag dot | 全栏 44px |
| 最小化 | ⊟ 按钮 | dblclick top bar |
| 胶囊 | 单击恢复 | 单击 popover + 双击恢复 |
| Esc | 缺 | 全流程 |
| ↑↓ | 无 | history 导航 |
| focus trap | 无 | overlay 内循环 |
| undo | 4s toast | 文件层处理 |

---

## 十、印哥待确认 (C1–C4)

- **C1** 新建按钮 — 输入框左侧 [⊕新建] + Cmd+N *(见 layout §八)*
- **C2** 顶部数字 — 仅顶栏 "7 条" 一处保留
- **C3** Cmd+N — 仅 overlay 内; 主窗口 Cmd+N 保持 tab 新建
- **C4** capsule popover — 显示 buffer + 最近 3 条 history *(只读)*

---

## 十一、实施拆分

Phase A *(纯前端)*:
- textarea 替代 input · Cmd+Enter · 全栏 drag · dblclick min
- capsule popover preview · Esc 全流程 + ↑↓ · focus trap

Phase B *(Rust IPC)*:
- append_inbox (写 inbox-YYYY-MM-DD.md + frontmatter)
- 关闭时 commit

Phase C *(全局快捷键)*:
- Tauri GlobalShortcut Cmd+Shift+.

Phase D *(颜色/animation polish)*:
- textarea auto-resize · popover fade-in · capsule scale

---

// ponytail: v4.1 = v3.1 重写输入/顶栏/胶囊 · store 复用 + draftContent/draftPrefix · ~300 lines TSX + 40 lines Rust + 30 lines store
