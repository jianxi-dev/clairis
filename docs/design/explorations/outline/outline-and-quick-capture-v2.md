---
title: "渐晰 — 大纲 + Quick Capture v2.2 设计"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: docs/design/approved/outline-quick-capture/spec.md
superseded_by: ../../approved/outline-quick-capture/spec.md
---

# 渐晰 — 大纲 + Quick Capture v2.2 设计

> 状态: v2.2 — Codex 2 轮对抗终审通过 + NW 修复
> 来源: 印哥需求 + Ponytail/Codex v1→v2→v2.2
> 替代: outline-and-quick-capture-design.md, outline-and-quick-capture-final.md (v1)

---

## 一、Quick Capture — `Cmd+Shift+.` overlay

### 1.1 空间:单 overlay,上输入下列表,零 mode

```
┌────────────────────────────────────────┐
│ [.] 继续想一个问题 _                    │  ← 顶栏 56px,永远 auto-focus
├─────────────────────────────────────────┤
│ . 怎么让 CM6 hover 不抢焦点       [✓]  │  ← 今日 entries
│ - 给 inbox 设计 review 流程      [✓]  │
│───────────────────────────────────────── │
│ 昨天                                    │  ← date separator,opacity 0.3
│ ! 大纲可以用 collapsible tree    [✓]  │
│ ? 为什么 hover 不用 200ms            [✓] │
│───────────────────────────────────────── │
│ 07-05                                   │
│ . 第一周计划                      [✓]  │
│                                         │
│ [     显示更早的... 20 条    ]           │  ← 扁平按钮,+20 条
└────────────────────────────────────────┘
```

### 1.2 触发

```
Cmd+Shift+.（系统级全局）:
  if (已聚焦渐晰) → overlay 弹出 + auto-focus 输入框
  if (其他 App)   → Dock bounce + overlay show（不抢焦点）
                    onFocusChanged → auto-focus 输入框
```

实现: 用 `onFocusChanged` 事件跟踪 `wasFocusedRef`,`mainWindow.isFocused()` 有 race。

### 1.3 输入与 prefix

```
placeholder: .问题  -待办  !灵感  ?思考

用户开始打字 → placeholder 消失
输入 . / - / ! / ? 作首字符 → 显示淡色提示 "↵ 保存为问题"
Enter → 保存为对应 prefix,清空输入,placeholder 回来
Backspace 删除前缀 → 淡色提示消失
长按 prefix 不改 → sticky 在输入框

无状态机。只识别首字符,不在 input 里加标记。
```

前缀语义:

| 前缀 | 含义 | frontmatter type |
|------|------|-----------------|
| `.` | 日常问题 | problem |
| `-` | 待办任务 | todo |
| `!` | 灵感 / 想法 | idea |
| `?` | 开放思考 | wonder |
| 无 | 普通笔记 | note |

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
- 内容保留 prefix 字符（可读）
- daily file,文件名 `inbox-YYYY-MM-DD.md`

### 1.5 条目操作

```
[✓] = archive → 移到 archive/inbox-YYYY-MM-DD.md (append + 原删)
                 实现顺序: append-then-delete,防 data loss
[⋯] = 菜单    → 编辑 / 删除
                 编辑: overlay 内展开 textarea 修改
                 删除: 警告确认 + 从 inbox 文件删除
```

hover 一行 → 右侧出现 `[⋯]` 图标,点击。或右键行 → 同级菜单。无 `[⇨]` 转正。

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
│ - 路线图 ←  │  渐晰是一款陪伴人类学习      │
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

## 三、文件结构

```
~/documents/inbox/
  inbox-2026-07-12.md    ← 当天
  inbox-2026-07-11.md    ← 昨天
  archive/
    inbox-2026-07-05.md  ← archive 文件
```

- 无 TTL,无 auto-delete
- archive → 移入 `archive/` 子文件夹
- auto-create 当 archive 不存在

---

## 四、Store 切片 (nav.ts)

```typescript
nav: {
  // Quick Capture
  captureOverlayOpen: boolean,
  captureInput: string,
  todayInbox: InboxEntry[],       // 今日缓存(overlay open 时刷新)
  inboxDisplayLimit: number,      // 当前显示条数(初始 5,+20 per click)
  
  // Headings
  headingsPaletteOpen: boolean,
  headingsQuery: string,
  headingsSelectedId: string,
  headingsList: HeadingEntry[],
}
```

删除的字段: quickCaptureMode / headingsCompareLeft / CompareRight / hoverSection / outlinePinned / outlineCollapsedSet。

---

## 五、快捷键总览

| 快捷键 | 行为 | 触发条件 | 阶段 |
|--------|------|---------|------|
| Cmd+P | 统一文件面板（三视图 + Ctrl+1~9 直开）| 应用焦点内 | R |
| Cmd+[/Cmd+] | 后退/前进历史导航 | 应用焦点内 | R |
| Cmd+Shift+E | toggle 大纲侧栏（**保留，但默认 hover 展开**）| 应用焦点内 | P1 |
| Cmd+Shift+. | Quick Capture（全局 + Dock bounce）| 任何 App 下 | P1 |
| Cmd+W / Esc | 关闭 capture overlay | overlay 打开时 | P1 |
| Cmd+R | Headings palette（浮层）| 应用焦点内 | P1 |
| Cmd+Shift+, | Review panel（如果未来需要独立入口）| 应用焦点内 | P2 |

注意:Cmd+Shift+E 与 Cmd+R 同时存在:
- Cmd+Shift+E = 大纲侧栏 pin（用户反馈保留 — 右侧有大纲小图标）
- Cmd+R = 浮动 palette（搜索 + Preview + 快速跳转）

两个入口满足不同场景:
- 用户想要"常驻侧栏,一直看到结构" → Cmd+Shift+E pin 模式
- 用户"找某一节 + 快速跳过去" → Cmd+R fuzzy + Preview

---

## 六、哲学对齐

| 原则 | 实现 |
|------|------|
| 无侧栏 | ✅ 大纲默认 hover 展开 / Cmd+R palette 浮层 |
| 内容优先 | ✅ overlay  palate 覆盖而非挤压 |
| 流状态 | ✅ 单 overlay 同框双功能(无 mode switch) |
| 低发现成本 | ✅ placeholder 即引导(discover via input,not hint) |
| 视觉洁癖 | ✓ hint 不是常驻,Capture overlay 56px |
| 极简操作 | ✓ 1 入口 1 出口。prefix 1 字符,条目 1 按钮 |

---

## 七、Codex 对抗总结

| 轮次 | Codex 结论 | Ponytail 回 |
|------|-----------|------------|
| R1 | 4 HIGH + 3 MED | 服 7,回 HIGH 1(双态 mode → 单 overlay 同框) |
| R2 | 8/8 全过,4 minor NWs | NW1 date separator / NW2 删转正 / NW3 加载更多按钮 / NW4 sentence-boundary truncate |
| R3 | (待释放) | NWs 全部修复 → v2.2 |

v2.2 = Codex R2 通过 + 4 NW micro-fix。预期 R3 终审 SHIP。

---

impl plan:

```
P1:
  capture overlay + Cmd+Shift+. global + Dock bounce
  placeholder prefix 引导
  inbox-YYYY-MM-DD.md save
  [✓] archive + date sep
  [⋯] 编辑/删除 menu
  "显示更早的" 加载更多
  Cmd+R palette (搜索 + Preview + 跳转)
  sentence-boundary truncate
  Cmd+Shift+E hover outline sidebar (可Pin)

P2:
  转正(灵感文件夹 / 当前文档)
  review Cmd+Shift+.(独立入口)
  filter / 搜索 inbox
  灵感合并 / 重组
```

---

// ponytail: v2.2 设计完整。三件事 + 一个 philosophy + 一条 shortcut 曲线。Codex R3 如果没有 HIGH,归化为终稿文档 `outline-and-quick-capture-final.md`。之后合并回 `CORE-REQUIREMENTS-clairis.md`。
