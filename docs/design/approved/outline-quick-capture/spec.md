---
title: "标月 — 大纲 + Quick Capture v2.3 设计"
type: design
status: accepted
last_updated: 2026-08-01
source_of_truth: supporting
---

# 标月 — 大纲 + Quick Capture v2.3 设计

> 状态: v2.3 — Enter reset + History collapse + main-window review
> 来源: 印哥反馈 v2.3 + Ponytail/Codex v1→v2→v2.2→v2.3
> 替代: v2.2 (已归档)

---

## 一、Quick Capture — `Cmd+Shift+.` overlay

### 1.1 空间:单 overlay,默认仅输入,历史折叠

```
默认状态:                               展开历史后:
┌────────────────────────────────────┐  ┌────────────────────────────────────────┐
│ .  _                                │  │ .  _                                    │
│                                     │  ├─────────────────────────────────────────│
│ [展开历史 ▾] 3 条                     │  │ . 怎么让 CM6 hover 不抢焦点       [✓]  │
└────────────────────────────────────┘  │ - 给 inbox 设计 review 流程      [✓]  │
                                      │ ! 大纲可以用 collapsible tree    [✓]  │
                                      │───────────────────────────────────────── │
                                      │ 昨天                                    │
                                      │ ? 为什么 hover 不用 200ms            [✓] │
                                      │───────────────────────────────────────── │
                                      │ 07-05                                   │
                                      │ . 第一周计划                      [✓]  │
                                      │                                         │
                                      │ [     显示更早的... 20 条    ]           │
                                      └─────────────────────────────────────────┘
```

### 1.2 触发

```
Cmd+Shift+.（系统级全局）:
  if (已聚焦标月) → overlay 弹出 + auto-focus 输入框
  if (其他 App)   → Dock bounce + overlay show（不抢焦点）
                    onFocusChanged → auto-focus 输入框
```

实现: 用 onFocusChanged 事件跟踪 wasFocusedRef，mainWindow.isFocused() 有 race 风险。

### 1.3 输入与 prefix — 双 Enter 重置

```
placeholder: .问题  -待办  !灵感  ?思考

前缀行为:
  空状态输入 .problem  → Enter → 保存 + 清空 + 切换到 . mode
  . mode 输入 anything → Enter → 保存对应 prefix + 清空 + 保持 . mode
  . mode 输入为空时再按 Enter → 清除 prefix,回到空状态

→ Double-Enter 重置: 连按两次 Enter = 退出 prefix 模式,回到空状态
  1. Enter = 保存当前内容(如有)或空保存
  2. 再按 Enter = 退出 prefix,回到空状态

← 不需要 Delete 键。手指始终在 Enter 上。
```

前缀语义:

| 前缀 | 含义 | frontmatter type |
|------|------|-----------------|
| .    | 日常问题 | problem |
| -    | 待办任务 | todo |
| !    | 灵感 / 想法 | idea |
| ?    | 开放思考 | wonder |
| 无   | 普通笔记 | note |

placeholder: .问题  -待办  !灵感  ?思考

### 1.4 保存

```
~/documents/inbox/inbox-YYYY-MM-DD.md

---
time: 2026-07-12T14:32:00+08:00
type: problem|todo|idea|wonder|note
---

. 怎么让 CM6 hover 不抢焦点
```

- 前置问题:type 在 frontmatter
- 内容保留 prefix 字符(可读)
- daily file,文件名 inbox-YYYY-MM-DD.md

### 1.5 条目操作

```
[✓] = archive → 移到 archive/inbox-YYYY-MM-DD.md
                 实现顺序: append-then-delete,防 data loss
[⋯] = 菜单    → 编辑 / 删除
                 编辑: overlay 内展开 textarea 修改
                 删除: 警告确认 + 从 inbox 文件删除
```

### 1.6 时间间隔.sep

```typescript
type InboxItem = { type: 'item'; entry: Entry }
             | { type: 'sep'; label: string };
// 3 层 flat: 今天 / 昨天 / YYYY-MM-DD
```

- 今天 / 昨天 / date label(07-05)
- 不交互,纯视觉
- opacity 0.3 灰线 + 日期文字

### 1.7 加载更多

```
首次 5 条 → 下方按钮 [显示更早的... 20 条]
点击 +20 → 再次判断 bottom
到达 14 天内无更多 → 灰字 "已全部显示" + 0 interactive
无 infinite scroll / skeleton
```

---

## 二、大纲 — `Cmd+R` Floating Headings Palette

### 2.1 触发

```
Cmd+R (应用焦点内):

┌──────────────────────────────────┐
│ > _                              │  ← 永远 auto-focus,打字即搜索
│──────────────────────────────────│
│ 1. 产品定义                       │
│   1.1 一句话定义                  │
│   1.2 哲学                       │ 选中行高亮 + 右侧 Preview
│ 2. 路线图                        │
│   2.1 Phase M                    │
└──────────────────────────────────┘
```

- 非模态浮层,零持久占用空间
- 输入框 auto-focus,fuzzy 搜索
- Enter → 关闭 palette + 文档滚动到对应位置
- ↑↓ 选择 → 右侧淡入 Preview
- Esc → 关闭

### 2.2 Peek Preview

```
选中标题后右侧面板:

┌─────────────┬──────────────────────────────┐
│ 大纲        │  Peek Preview                │
│─────────────│──────────────────────────────│
│ + 产品定义  │                              │
│   + 一句话  │  # 1. 产品定义               │
│ - 路线图 ←  │  标月是一款陪伴人类学习      │
│   + PM      │  成长的精神伙伴——懂你、...  │
│ + 性能      │                              │
│             │  [38 字 · 2 小节 · H2]      │
└─────────────┴──────────────────────────────┘
```

按 sentence 边界截断,max 200 字:

```typescript
function truncateSection(content: string, max = 200): string {
  if (content.length <= max) return content;
  const boundary = content.slice(0, max).search(/[。！？.!?]/);
  const fallback = content.slice(0, max).search(/[\n\r]/);
  let cut = -1;
  if (boundary >= 0) cut = boundary + 1;
  else if (fallback >= 0) cut = fallback;
  return cut > max * 0.6 ? content.slice(0, cut) : content.slice(0, max) + '…';
}
// ponytail: sentence-or-newline boundary, backward search from max. regex-safe impl.
```

### 2.3 关闭 palette

- Enter → 滚动到对应位置 + close
- Esc → close
- 点击其他区域 → close

### 2.4 鸟瞰 → 聚焦

```
Phase 1: 鸟瞰 Bird's-eye
  Cmd+R → 全标题可见 → 1-2 秒看全局骨架
  ↑↓ 浏览 → Peek Preview 实时更新

Phase 2: 聚焦 Focused Reading
  光标到目标 → Enter → 画布滚动到位
  蓝色闪烁 2 秒 + active indicator

❌ Phase 3: 对比 Compare Mode
  不实现。需要对比 → macOS 分屏 / 双文档。
```

---

## 三、标月主窗口中的查看/操作 (R)

### 3.1 文件面板 `Cmd+P` 接入

文件面板空查询时 "继续" 分组包含 Quick Capture 条目:

```
继续
  ● 无侧栏方案.md        引用过 · 2min前
  ◦ 开销的问题思考    [✓]  今天录入 · 7min前    ← Quick Capture 条目
  ◦ 想到的待办事项    [✓]  今天录入 · 12min前
  ◦ The Desk 概念        分屏对照 · 昨天
```

### 3.2 Quick Capture 条目标识

在文件面板中 Quick Capture 条目使用特殊样式:

```
◦ .开销的问题思考        今天 14:32 · 问题    [✓]
◦ -给 inbox 设计 review  今天 14:33 · 待办    [✓]
◦ !大纲可以用 tree        今天 14:34 · 灵感    [✓]
```

- 前缀符号 `.` `-` `!` `?` 保留,作为视觉 identifier
- 时间显示为 "今天 HH:MM" / "昨天 HH:MM" / "MM-DD"
- 类型标识文字 "问题 / 待办 / 灵感 / 思考 / 笔记"

### 3.3 主窗口中的操作

| 操作 | 入口 | 行为 |
|------|------|------|
| [✓] | 直接按钮 | archive → archive/inbox-YYYY-MM-DD.md |
| [⋯] | hover/右键行 | 编辑 / 删除 |

### 3.4 Quick Capture Detail View

```
┌────────────────────────────────────────┐
│ ✕                                       │
│ 2026-07-12 14:32                        │
│ 类型: 问题 (problem)                     │
├────────────────────────────────────────┤
│ 怎么让 CM6 hover 不抢焦点               │
│                                         │
│ -- 编辑后可修改 --                       │
├────────────────────────────────────────┤
│ [已处理 ✓] [删除] [编辑]                │
└────────────────────────────────────────┘
```

- 点击文件面板 QC 条目行 → 弹出 detail view
- Detail view 可编辑原始内容
- [转正为→]: P2。转正为灵感文件夹 / 当前工作目录 .md 文档

### 3.5 Review 面板 — Cmd+Shift+,

```
Cmd+Shift+, (应用焦点内):

┌────────────────────────────────────────┐
│ > _                              [筛选 ▾] │
├─────────────────────────────────────────┤
│ 今天 3 条                                 │
│───────────────────────────────────────── │
│ . 怎么让 CM6 hover 不抢焦点  [✓][⋯]       │
│ - 给 inbox 设计 review        [✓][⋯]     │
│ ! 大纲可以用 tree            [✓][⋯]      │
├──────────────────────────────────────────┤
│ 昨天 7 条  [展开]                         │
│ 07-05 14 条 [展开]                       │
└──────────────────────────────────────────┘
```

P1 唯一操作: 单条 archive ([✓]) + 展开/折叠日期段 + 关键词搜索 (输入框,复用 Cmd+P 的模糊匹配逻辑)。
P2 添加: filter tabs / batch select / promote。

### 3.6 与文件面板的统一

```
Quick Capture 数据流:
  Cmd+Shift+.        → capture overlay → 写入 inbox-YYYY-MM-DD.md
  Cmd+P              → 文件面板 "继续" 分组显示今日条目
  点击行             → detail view (可编辑/删除/转正)
  Cmd+Shift+, (R)    → review overlay (flat list + search + archive + 转正)

                         ┌──────────────┐
                         │  灵感文件夹   │ ← 转正目标位置
                         │  (正式文档)   │
                         └──────────────┘
                              ↑
                              │ Cmd+Shift+, [转正为→]
                              │
  Cmd+Shift+. → inbox.md ─→ 文件面板 ─→ detail view
                              ↓
                         ┌──────────────┐
                         │  archive/     │ ← 已处理
                         └──────────────┘
```

---

## 四、文件结构

```
~/documents/inbox/
  inbox-2026-07-12.md    ← 当天
  inbox-2026-07-11.md    ← 昨天
  archive/
    inbox-2026-07-05.md  ← archive 文件
```

- 无 TTL,无 auto-delete
- archive → 移入 archive/ 子文件夹
- auto-create 当 archive 不存在

---

## 五、Store 切片 (nav.ts)

```typescript
nav: {
  // Quick Capture
  captureOverlayOpen: boolean,
  captureInput: string,
  captureMode: '' | '.' | '-' | '!' | '?',  // sticky prefix (R3 add back, simpler)
  todayInbox: InboxEntry[],
  inboxDisplayLimit: number,
  inboxCollapsed: boolean,           // R3: history 默认折叠
  quickCaptureDetailOpen: boolean,   // detail view for main window
  quickCaptureSelectedId: string,
  
  // Headings
  headingsPaletteOpen: boolean,
  headingsQuery: string,
  headingsSelectedId: string,
  headingsList: HeadingEntry[],
}
```

- quickCaptureMode: R3 简化回字段(只在 capture overlay 内部,不需要 store slice 持久化)
- inboxCollapsed: R3 新增。overlay 打开时历史列表是否折叠
- quickCaptureDetailOpen / quickCaptureSelectedId: R3 新增。主窗口 detail view 状态

---

## 六、快捷键总览

| 快捷键 | 行为 | 触发条件 | 阶段 |
|--------|------|---------|------|
| Cmd+P | 统一文件面板 | 应用焦点内 | R |
| Cmd+[/Cmd+] | 后退/前进 | 应用焦点内 | R |
| Cmd+Shift+E | toggle 大纲侧栏 Pin | 应用焦点内 | P1 |
| Cmd+Shift+. | Quick Capture | 任何 App 下 | R   |
| Cmd+Shift+, | Quick Capture review（flat list + search + archive + 转正）| 应用焦点内 | R   |
| Cmd+Shift+T | 翻译面板 | 应用焦点内 | P1  |
| Cmd+W / Esc | 关闭 overlay | overlay 打开时 | R   |
| Cmd+R | Headings palette | 应用焦点内 | R   |

---

## 七、Codex 3 轮对抗总结

| 轮次 | Codex 结论 | Ponytail 回 |
|------|-----------|------------|
| R1 | 4 HIGH + 3 MED | 服 7,回 HIGH 1 |
| R2 | 8/8 全过,4 NW | NW1 date sep / NW2 删转正 / NW3 加载按钮 / NW4 sentence truncate |
| R3 | **No HIGHs, SHIP** | regex impl fix,归化为终稿 |

**R3 实施细节:**
- String.prototype.lastIndexOf 不接受 regex,原 impl 会 silent fallback。改为 search(regex) + backward from max。
- append-then-delete 防 data loss,hotkey race 用 onFocusChanged 事件。
- Codex R3 裁定 "3 small things + philosophy + shortcut curve" = P1 ready。

**v2.3 新增 (印哥反馈):**
- 印哥 R3.1: prefix sticky 用 double-Enter 重置,不需要 Delete 键
- 印哥 R3.2: 历史默认折叠,[展开历史 ▾] 按钮显示数量
- 印哥 R3.3: 主窗口可以查看/操作 Quick Capture 条目

---

## 八、P1 vs P2 实施计划

| 功能                                                 | 阶段  |
| -------------------------------------------------- | --- |
| capture overlay + Cmd+Shift+. global + Dock bounce | R   |
| placeholder prefix 引导 (double-Enter reset)         | R   |
| inbox-YYYY-MM-DD.md daily save                     | R   |
| [✓] archive + date sep                             | R   |
| history collapsed by default                       | R   |
| [展开历史 ▾] + per-day count                       | R   |
| 文件面板 "继续" 分组显示 QC 条目                     | R   |
| 文件面板 click → detail view (编辑/删除)             | R   |
| Cmd+R palette (搜索 + Preview + 跳转)                | R   |
| sentence-boundary truncate                         | R   |
| Cmd+Shift+E hover outline sidebar (可Pin)           | P1  |
| 加载更多按钮 +20 条                                       | R   |
|                                                    |     |
| 转正(灵感文件夹 / 当前文档)                                   | P2  |
| Cmd+Shift+, review panel                           | R   |
| filter / 搜索 inbox                                  | P2  |
| 批量 archive / 批量转正                                  | P2  |
| 灵感合并 / 重组                                          | P2  |

---

// ponytail: v2.3 = v2.2 SHIP + 印哥 3 点反馈。Double-Enter reset,history collapse,main-window review。Codex R3 已通过,v2.3 是终稿。
