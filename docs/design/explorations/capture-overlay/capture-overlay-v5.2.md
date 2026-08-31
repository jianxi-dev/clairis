---
title: "Capture Overlay v5.2 — 细节敲定"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay v5.2 — 细节敲定

> **状态**: v5.2 — 印哥 8 条反馈驱动
> **替代**: v5.1
> **Ponytail**: archive-down animation · per-day file link · prefix safe · always-on-top pin · multi-screen follow cursor

---

## 零、印哥 8 条回应（逐条分析）

| # | 反馈 | v5.2 处置 |
|---|------|----------|
| 1 | 提交动画为何向上飞出 | → 第五节详细分析，采纳向下 |
| 2 | 每日记录后加"查看"链接 | → 第三节采纳，链接主窗口打开 |
| 3 | 存储机制详解 | → 第二节完整 filestructure |
| 4 | 文字大小/主题同步 | → 第六节设计 |
| 5 | 主窗口关闭 overlay 不关 | → 确认采纳 |
| 6 | 多屏建议 | → 第七节设计 |
| 7 | 钉住模式 always-on-top | → 确认采纳（包括全屏覆盖） |
| 8 | prefix 中英字符易错 | → 重新设计，兼容方案 |

---

## 一、Quiet Chrome（保留 v5.1）

```
状态 A (纯输入):
┌                                        ┐
│  .  _                                   │
│                                          │
└                                        ┘

状态 B (hover 显现):
┌────────────────────────────────────────┐
│ ≡ ⊕ Capture                   📌  ✕   │
├────────────────────────────────────────┤
│ .  _                                   │
└────────────────────────────────────────┘

状态 C (hover history):
│ !  hover 焦点怎么处理        [✓]  [⋯]  │  ← hover 项才显现 [查看]
```

---

## 二、存储机制详解（回应印哥 Q3）

### 2.1 物理文件结构

```
~/documents/inbox/
  ├── inbox-2026-07-14.md      ← 活跃 inbox（今天未处理的条目）
  ├── inbox-2026-07-13.md      ← 昨天的活跃 inbox
  ├── inbox-2026-07-05.md      ← 07-05 的活跃 inbox
  └── archive/
      ├── inbox-2026-07-13.md  ← 已归档（昨天及之前的已处理）
      └── inbox-2026-07-05.md  ← 已归档（07-05 已处理）
```

**命名规则**: `inbox-YYYY-MM-DD.md`

### 2.2 单次 Cmd+Enter 写入

文件内容格式:

```markdown
---
time: 2026-07-14T01:35:00+08:00
type: idea
---

! 怎么让 CM6 hover 不抢焦点
```

每提交一条 = 一次 Rust IPC invoke:

```rust
#[tauri::command]
async fn append_inbox(entry: InboxEntry) -> Result<(), String> {
    let path = format!("~/documents/inbox/inbox-{}.md", today());
    let content = format!("---\ntime: {}\ntype: {}\n---\n\n{} {}\n",
        entry.timestamp, entry.type, entry.prefix, entry.content);
    
    if !Path::new(&path).exists() {
        fs::write(&path, "")?;  // 创建空文件
    }
    let mut existing = fs::read_to_string(&path)?;
    existing.push_str(&content);
    fs::write(&path, existing)?;
    
    Ok(())
}
```

### 2.3 同一天多次提交

同一天多次 Cmd+Enter → 都追加到同一个 `inbox-YYYY-MM-DD.md`:

```markdown
---
time: 2026-07-14T01:35:00+08:00
type: idea
---

! 怎么让 CM6 hover 不抢焦点

---
time: 2026-07-14T09:20:00+08:00
type: todo
---

- 给 inbox 设计 review 流程

---
time: 2026-07-14T15:10:00+08:00
type: problem
---

. hover 为什么要 200ms
```

**存储优势**: 每日单文件 = 简单。用户在主窗口想回顾某天 → 打开该文件即可。

### 2.4 Archive 归档写入

Archive = 从活跃文件移到 archive 文件:

```rust
#[tauri::command]
async fn archive_entry(date: &str, entry_id: &str) -> Result<(), String> {
    let active_path = format!("~/documents/inbox/inbox-{}.md", date);
    let archive_path = format!("~/documents/inbox/archive/inbox-{}.md", date);
    
    // 读取活跃文件
    let content = fs::read_to_string(&active_path)?;
    
    // 按 entry_id 找到对应条目
    let entry = parse_entry(&content, entry_id)?;
    
    // append 到 archive（防 data loss）
    append_to_archive(&archive_path, &entry)?;
    
    // 从活跃文件删除
    delete_from_active(&active_path, entry_id)?;
    
    Ok(())
}
```

**顺序**: append-then-delete → 防 data loss。先确保 archive 写成功了再从 active 删除。

### 2.5 Archive 后怎样

1. **UI**: overlay 列表移除该条目
2. **磁盘**: 当日文件里有三条 → 归档一条 → 活跃文件剩两条 + archive 文件加一条
3. **主窗口**: 文件面板自动刷新，archive 文件夹在文件树中可见
4. **反悔**: 5s 内点击 [撤销] → 从 archive 移回 active

---

## 三、每日"查看"链接（回应印哥 Q2）

在日期分隔行增加 `[查看]` 按钮：

```
│ 今天 · 7 条              [查看]  [折叠 ▴]  │
│────────────────────────────────────────│
│ !  hover 焦点怎么处理        [✓]  [▽] │
```

点击 `[查看]`:
```ts
invoke('open_file', { 
  path: `~/documents/inbox/inbox-${date}.md` 
})
```

效果:
- 主窗口切换到该文件（如果在主窗口打开了其他 tab，在当前 panel 打开）
- overlay 可以继续留着，不影响当前窗口
- 主窗口显示完整的当日 active + archive 内容

**为什么不直接点击日期就跳转？**
日期分隔行已经有交互语义（折叠/展开）。"查看"是一个明确的次级操作，避免误触。

---

## 四、Archive 归档价值（补充说明）

value proposition:

| 短期使用者（当天） | 长期使用者（周/月回顾） |
|-------------------|------------------------|
| "今天 7 条还有 5 条要处理" | "07-05 那周我做了什么" |
| archive 就是 "done list" | archive 就是 "log" |
| 精力聚焦于活跃列表 | 历史可追溯 |

历史面板不是 "垃圾桶" — 是 **finished queue**。就像 Kanban 里的 Done 列。

---

## 五、提交动画方向（回应印哥 Q1）

### 印哥质疑: "为何不是向下的下载完成动画"

我的回答:

您说得对。**向下 (slide-down) 更自然**，理由:

**物理隐喻**: 
- 用户在 overlay textarea 里输入 "东西"
- Cmd+Enter = "松手，让它落到历史记录中"
- 重力的方向是下 → 内容向下飞入历史列表 = 自然
- 向上飞 = 反重力，违反直觉

**对比**:
- ❌ 向上飞出: 用户在提交瞬间感觉 "东西被抽走了"
- ✅ 向下飞出: 在提交瞬间感觉 "东西被保存到了下面"

**修正后的动画**:

```
Cmd+Enter 按下:
  1. textarea 内容: translateY: 10px → -20px, opacity: 1 → 0 (200ms)
  2. 历史列表顶部出现新条目: translateY: -10px → 0, opacity: 0 → 1 (250ms)
  3. textarea 清空 + border 闪品牌蓝 (150ms)
```

总时长 400ms 但 visibility = 250ms (用户看见新条目就安心了)。

### 对比下载动画

Safari 下载完成:
- 文件从地址栏飞向 Dock → **向左下飞向一个固定目标**
- 这是因为 Dock 在屏幕底部，有方向性

我们的场景:
- textarea 在新条目上方
- 新条目出现在正下方
- 不需要横向位移

所以 = **垂直向下 + fade**，更简洁。

---

## 六、文字大小与主题（回应印哥 Q4）

### 6.1 默认字体字号

| 维度 | overlay 默认 | 主窗口 | 差异理由 |
|------|-------------|--------|----------|
| font-family | Literata 或系统字体 | 保持一致 | overlay 也要有 Jianxi 气质 |
| font-size | **15px** | 默认 16px | overlay 比主窗口略小，克制 |
| line-height | 1.7 | 1.7 | 保持水平阅读舒适度 |
| font-weight | 400 (Regular) | 400 | 不用 bold，避免视觉攻击 |

**原因 15px**: Jianxi 主窗口目标是沉浸式阅读，16px 合适。overlay 是快速录入，3 秒内完成，信息密度反而要低一点。15px 在 Retina 上视觉大小 ≈ 主窗口的 14px。

### 6.2 字号调整

支持 overlay 内调整字号 (不影响主窗口):

| 操作 | 效果 |
|------|------|
| Cmd+= | overlay 字体 +1px |
| Cmd+- | overlay 字体 -1px |
| Cmd+0 | overlay 恢复默认 15px |
| 范围 | 12px – 22px |

**持久化**: overlay 字号写入 `~/.hermes/config.toml` 的 `[capture]` 段:

```toml
[capture]
font_size = 15
```

下次 overlay 打开时恢复。

### 6.3 主题同步

| 策略 | 优点 | 缺点 |
|------|------|------|
| 完全跟随主窗口 (dark/light) | 一致 | 不够灵活 |
| 独立 switch | overlay 可设置亮色 | 复杂度翻倍 |
| **跟随系统 + 主窗口双向同步** (推荐) | 多端一致 | 需文件面板刷新 |

**推荐方案**: overlay 主题跟随 Jianxi 主窗口 config，不独立配置。

实现:
```ts
const mainTheme = useEditorStore(s => s.config.theme);
// overlay 直接用 mainTheme 作为 CSS class
```

这样做的好处: 用户在主窗口设置了 dark → overlay 也是 dark。不需要额外记忆 "这个窗口是什么主题"。

**渐变动画**: 主窗口切换 dark/light 时，overlay 也跟随 transition (300ms background-color)。

---

## 七、多屏建议（回应印哥 Q6）

### 7.1 跟随鼠标所在屏

**规则**: overlay 显示在 **鼠标当前所在的屏幕** 上。

```ts
import { currentMonitor } from '@tauri-apps/api/window';

async function openOverlay() {
  const monitor = await currentMonitor();
  if (!monitor) return;
  
  // overlay 显示在 monitor 的 top-right, 距边 24px
  const x = monitor.size.width - 420 - 24;
  const y = 80;
  
  await appWindow.setPosition({ x: monitor.x + x, y: monitor.y + y });
}
```

### 7.2 与主窗口的关系

**选项 A (独立)**: overlay 独立于主窗口，可以在副屏打开 overlay 而主屏保持编辑器。适合:
- 主屏写代码 / 副屏快速记录灵感
- 不想打断主屏布局

**选项 B (跟随主窗口)**: overlay 永远显示在主屏上。适合:
- 单屏用户
- 把 overlay 当成主屏的一部分

**推荐**: **默认跟随主窗口**。overlay 打开时检测主窗口所在屏，在该屏显示 overlay。

### 7.3 胶囊的位置

胶囊停靠在当前屏的 bottom-right。不跟随主窗口 (因为 capsule 可能用户在副屏操作时还想看到)。

### 7.4 全屏应用时

Pin 模式下: overlay 永远置顶，覆盖全屏应用 (甚至在 Keynote 演示时)。

非 pin 模式下: overlay 不抢全屏应用的焦点。全屏应用在前 → overlay 在后。

---

## 八、钉住模式 Always-on-Top（回应印哥 Q7）

Pin = 窗口置顶，系统级:

```rust
// Rust 层
use tauri::Manager;

#[tauri::command]
async fn set_pinned(window: tauri::Window, pinned: bool) -> Result<(), String> {
    window.set_always_on_top(pinned)
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**Z-order 层级 (从高到低)**:
1. 🟥 系统键盘、Spotline (最高)
2. 🟧 Jianxi Overlay Pin 模式
3. 🟨 用户的所有窗口 (包括全屏应用)
4. 🟩 Wallpaper

**Mac 行为**: 即使某个 App 进入全屏模式 (PowerPoint/Keynote)，pin 的 overlay 仍在最上面。

**Pin 交互状态**:

```
未 pin:  窗口层级 = 普通。Keynote 全屏后 overlay 消失。
pin 后:  窗口层级 = 置顶。Keynote 全屏后 overlay 仍在上面。

视觉指示:
- pin 未激活: 顶栏 📌 icon = gray outline
- pin 激活后: 顶栏 📌 icon = filled #0071e3
```

---

## 九、Prefix 系统重设计（回应印哥 Q8）

### 问题

中英文输入法切换时:
- 中文状态下按 `.` → 输出 `。` (中文句号)
- 中文状态下按 `-` → 输出 `—` (中文破折号)  
- 中文状态下按 `!` → 输出 `!` (但中英文宽度不同)
- 中文状态下按 `?` → 输出 `？`

**误识别风险高**。

### 设计方案: 用 `:` 开头 + 关键字识别

```
:问题  怎么让 CM6...      → type = problem
:待办  review 流程         → type = todo
!      hover 焦点           → type = idea
%      为什么 hover         → type = wonder
```

| prefix | 命令字符 | 替代 | 设计风格 |
|--------|---------|------|---------|
| `.` | `:问题` | `:p` | 易读 `:问题 怎么让...` |
| `-` | `:待办` | `:t` | 易读 `:待办 提交代码` |
| `!` | `!` | 不变 | 视觉冲击力强，保留 |
| `?` | `:思考` | `:w` | 避免 `?` 中英文混淆 |
| `%` | `:灵感` | 新增 | `%` 在英文模式也很直觉 |

**中英兼容**: 
- `:问题` 中英文都能输入 (中文模式无需切换)
- `:p` 简写 → 识别为 problem (英文模式)
- `!` 保留 (中英文相同)

### 防错机制

```typescript
function detectPrefix(input: string): { prefix: string; content: string } {
  // 去除首尾空格
  const trimmed = input.trim()
  
  // 中文兼容映射
  if (trimmed.startsWith(':问题') || trimmed.startsWith(':p')) {
    return { prefix: '.', content: trimmed.slice(trimmed.startsWith(':问题') ? 3 : 2) }
  }
  if (trimmed.startsWith(':待办') || trimmed.startsWith(':t')) {
    return { prefix: '-', content: trimmed.slice(trimmed.startsWith(':待办') ? 3 : 2) }
  }
  if (trimmed.startsWith('!')) {
    return { prefix: '!', content: trimmed.slice(1) }
  }
  if (trimmed.startsWith(':思考') || trimmed.startsWith(':w')) {
    return { prefix: '?', content: trimmed.slice(trimmed.startsWith(':思考') ? 3 : 2) }
  }
  
  return { prefix: '', content: trimmed }  // 默认 (也可设默认 type)
}
```

**用户体验**: 用户输入 `:问题` 后空格 → 进入 problem mode → badge 变为黑色 `.` → 继续打字。

---

## 十、Cmd+N + 动画方向（融合）

向下飞出动画，已在第五节确认。Cmd+N 操作触发该动画。

---

## 十一、Update Checklist (P0)

念头到录入:
- [ ] Cmd+Shift+. 弹入 < 200ms (P90 < 500ms)
- [ ] textarea focus + 首字输入 < 100ms
- [ ] hover 顶栏淡入 200ms

录入流程:
- [ ] Enter 始终换行
- [ ] Cmd+Enter 始终提交
- [ ] Cmd+N = save + new (触发向下飞出动画)
- [ ] prefix 检测: `:问题`/`:待办`/`:思考`/`:p`/`:t`/`:w` + 中文兼容
- [ ] Double-Enter 重置
- [ ] 字号 Cmd+=/- 持久化到 config

历史处理:
- [ ] 日期分隔行 `[查看]` 链接主窗口
- [ ] `[折叠 ▴]` / `[展开 ▾]`
- [ ] ↑↓ 导航 + click inline detail
- [ ] hover [✓][⋯] 显现
- [ ] [✓] archive → 条目变绿 + "已归档 · [撤销]"
- [ ] 撤销 5s 内可达

胶囊:
- [ ] 44×44 触屏可达
- [ ] 拖动停靠四角/四边
- [ ] hover tooltip 完整内容
- [ ] 单击 popover preview (buffer + 最近 3 条)
- [ ] 双击恢复 overlay

顶栏与窗口:
- [ ] 主窗口关闭 → overlay 不关
- [ ] pin 模式 → always-on-top (覆盖全屏应用)
- [ ] 多屏时 overlay 跟随鼠标所在屏
- [ ] Single-instance overlay

数据:
- [ ] Cmd+Enter → append-inbox Rust IPC
- [ ] Archive → append-then-delete
- [ ] 关闭 buffer 兜底写 localStorage

---

## 十二、关键决策点

**C1（关键字 prefix 系统）**:
问题是印哥是否接受 `:问题`/`:待办`/`:思考` + 中文替换英文标点?
或者保留旧的 `.`/`-`/`!`/`?` + 兼容逻辑处理中英文?

**C2（默认字号 15px）**:
是否认可 overlay 字号比主窗口略小? 还是保持完全一致 16px?

**C3（Pin 置顶覆盖全屏）**:
是否在产品中先做出 always-on-top 行为?

**C4（Cmd+N 触发向下飞出动画）**:
确认动画方向?

---

## 十三、实施拆分

Phase A1 *(Quiet Chrome + 基础输入)*:
- textarea + Enter/Cmd+Enter/Cmd+N
- 顶栏 hover 淡入淡出
- prefix 检测 (中英文兼容)
- 字号 Cmd+=/- 持久化

Phase A2 *(胶囊 + 钉住)*:
- 胶囊状态机 + 拖动停靠
- Pin always-on-top
- hover tooltip + popover preview
- 多屏跟随鼠标屏

Phase A3 *(独立窗口)*:
- Tauri 多窗口 (capture-overlay.html)
- 主↔子 IPC 通信
- 主窗口关闭不影响 overlay

Phase B *(Rust I/O)*:
- append_inbox (追加到 inbox-*.md)
- archive_entry (归档到 archive/)
- load_history (按日期读取)

Phase C *(全局快捷键)*:
- Tauri GlobalShortcut::register("Cmd+Shift+.")

---

// ponytail: v5.2 = v5.1 + 向下飞出动画 + 每日查看链接 + 存储机制详解 + 字号15px + 多屏跟随鼠标 + pin always-on-top + prefix 中英文兼容。4 个 C-points 等印哥确认。
