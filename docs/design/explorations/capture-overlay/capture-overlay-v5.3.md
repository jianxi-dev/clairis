---
title: "Capture Overlay v5.4 — 三个关键修正 + 可调布局"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay v5.4 — 三个关键修正 + 可调布局

> **状态**: v5.4 — v5.3 基础上增补可调布局、X 关闭、capsule tooltip 移除
> **替代**: v5.3
> **核心增补**: 窗口宽高可调 + 双面板拖拽分隔 + X 按钮保存关闭 + capsule tooltip 移除

---

## 零、印哥 3 条回应

| # | 反馈 | v5.3 处置 |
|---|------|----------|
| A | 配置路径错了 + 持久化/恢复含义 | → 修正为 `~/.clairis/config.toml`，明确写入/读取时机 |
| B | 多屏: 默认主屏，可拖至副屏 | → 简化，不做"跟随鼠标" |
| C | prefix 系统评估 + todo 完成标记 | → **回到单字符 + IME 兼容映射** |

---

## 一、Quiet Chrome

```
状态 A (纯输入) - 默认:
┌                                        ┐
│  [_]  _                                 │
│  [_]  _                                 │
│  [_]  _                                 │
│                                          │
└                                        ┘

状态 B (鼠标放上顶栏):
┌────────────────────────────────────────┐
│ ≡  Capture              N 条  📌  ✕   │
├────────────────────────────────────────┤
│  [_]  _                                 │
│                                          │
└────────────────────────────────────────┘

状态 C (鼠标放上底栏):
┌                                        ┐
│  [_]  _                                 │
│                                          │
├────────────────────────────────────────┤
│ [展开历史 ▾]              ↑↓  ↵  Esc │
└────────────────────────────────────────┘
```

**触发规则**:
- **顶栏**: 鼠标放上顶栏区域 → 顶栏淡入(200ms)；鼠标移开 → 淡出
- **底栏**: 鼠标放上底栏区域 → 底栏淡入(200ms)；鼠标移开 → 淡出
- **独立触发**: 顶栏和底栏互不影响，鼠标放顶栏只显顶栏，放底栏只显底栏
- **textarea 区域**: 鼠标经过输入框区域不触发任何显示——安静模式保持
- **边框移入/移出**: 不触发显示——只有精确的顶栏/底栏区域才响应

**实现要点**:
- 顶栏 div: `onMouseOver={showTop}` / `onMouseOut={hideTop}`
- 底栏 div: `onMouseOver={showBottom}` / `onMouseOut={hideBottom}`
- 无 setTimeout 延迟（避免竞态导致"显示后再也无法关闭"的 bug）
- textarea 区域无_mouse事件监听

---

## 二、字号配置路径 + 持久化机制（回应 A）

### 配置路径

```
~/.clairis/config.toml              ← Jianxi 的主配置
└── [capture] overlay 子段
```

**不是** `~/.hermes/config.toml`（那个是 Hermes Agent 自己的配置——印哥说得对）。

### 持久化含义

> "持久化" = 用户做了操作 → 立刻写到磁盘文件
> "恢复" = 下次打开 overlay → 先读文件 → 用保存的值

**时机**:

```
用户按下 Cmd+=:
  1. overlay font-size: 15px → 16px (即时生效)
  2. dispatch(setFontSize(16))
  3. store.fontSize = 16
  4. debounce 500ms → invoke('save_config', { capture_font_size: 16 })
  5. ~/.clairis/config.toml 写入完成
```

```
下次打开 overlay:
  1. invoke('load_config')
  2. 读取 capture_font_size = 16
  3. store.fontSize = 16
  4. textarea 渲染为 16px
```

**效果**: 用户昨天调到 18px → 今天打开 overlay 仍然是 18px。"调一次，永远生效"。

### 配置格式

```toml
# ~/.clairis/config.toml

[capture]
font_size = 15          # overlay 字号 (12-22)
pinned = false          # 上次是否 pin 住
position_x = 80         # 上次窗口位置
position_y = 80
capsule_position_x = 940  # 上次胶囊位置
capsule_position_y = 760
overlay_width = 420       # v5.4: 窗口宽度 (320~600)
overlay_height = 500      # v5.4: 窗口高度 (280~800)
panel_ratio = 0.4         # v5.4: textarea 占比 (0.2~0.8)
```

---

## 三、多屏简化（回应 B）

### 规则

| 项目 | 规则 |
|------|------|
| overlay 打开时 | 显示在 **主窗口所在的屏幕** |
| overlay 拖动时 | 跟鼠标走，可拖到副屏 |
| 拖到副屏后 | 该 overlay 记住位置，下次在该屏打开 |
| 胶囊 | 跟随 overlay 所在屏停靠 |
| pin 置顶 | 在当前屏置顶 |

### 实现

```rust
// 获取主窗口所在屏
let main_window = app.get_window("main").unwrap();
let monitor = main_window.current_monitor().unwrap();

// overlay 显示在该屏右上角
let x = monitor.size().width - 420 - 24;
let y = 80;
```

不做 "follow mouse cursor on open" — 主屏为锚点，用户拖动才是副屏入口。

---

## 四、Prefix 系统重设计（回应 C）

### 印哥质疑

之前我给的是 `:问题`/`:待办`/`:思考` 命令式风格。评估结果:

| 维度 | `:问题` 命令式 | 单字符 `. - ! ?` |
|------|---------------|-----------------|
| 输入速度 | 慢 (3+ 字符) | **快 (1 字符)** |
| 心智负荷 | 要想 "我要打什么命令" | **想打 `.` 就是问题** |
| 与 Jianxi 主产品一致性 | 主产品没有命令式入口 | **全局统一** |
| Apple Notes 对标 | ✗ Notes 没命令 | **✓ Notes 也没命令** |
| 后端复杂度 | 高 (parse 字符串) | **低 (首字符映射)** |
| 中文 IME 兼容 | 兼容 (中文也能打) | **需要兼容处理** |

**结论**: 单字符回归。通过 IME 兼容方案处理中英文标点。

### 单字符 + IME 兼容映射

只在 textarea **从空到有内容**的那一瞬间检测首字符:

```typescript
const IME_PREFIX_MAP: Record<string, CapturePrefix> = {
  '.': 'prefix_problem',    // 英文句号
  '。': 'prefix_problem',   // 中文句号 (CN IME)
  '-': 'prefix_todo',       // 短横线 (中英文通常一致)
  '—': 'prefix_todo',       // em-dash (少见但兼容)
  '!': 'prefix_idea',       // 英文感叹号
  '！': 'prefix_idea',      # 中文感叹号 (极少数 IME)
  '?': 'prefix_wonder',     // 英文问号
  '？': 'prefix_wonder',    // 中文问号 (CN IME)
};

function onTextareaChange(text: string) {
  if (text.length === 1) {
    // 首次输入
    const detected = IME_PREFIX_MAP[text];
    if (detected) {
      store.setPrefix(detected);
      store.setDraftContent('');  // 清除 prefix 字符本身
    } else {
      store.setPrefix('');
      store.setDraftContent(text);
    }
  }
}
```

### 主程序中 todo 完成标记

印哥: "要不要考虑任务项，在主程序中如何标记任务已完成"

#### 核心认知

Jianxi 主产品的 "." / "-" / "?" / "!" → 是 **产品类型维度**，不是任务管理维度。

- "." = 问题 (problem) → "已解决" = archive
- "-" = 待办 (todo) → "已完成" = archive
- "!" = 灵感 (idea) → "已记录/已转正" = archive
- "?" = 思考 (wonder) = "已想通/不再问" = archive

四种类型的 "完成状态" 语义不同，但物理操作相同: **归档 (archive) = 从活跃列表移到 archive/**。

#### overlay 对完成的表达

**统一的 `[✓]` button** = "我处理完了，别再让我看到它"。

视觉:
```
点击 [✓] 后:
├─ !  hover 焦点怎么处理                条目变灰 + "已归档 · [撤销]"
├─ -  review 流程设计                     (与上面一模一样，不区分类型)
├─ .  为什么 hover                       (与上面一模一样)
```

用户通过 badge 区分类型 — 而不是通过 "不同的完成 button"。

#### 与主窗口的交互

主窗口打开 `~/documents/inbox/inbox-2026-07-14.md` 时:
- 看到 frontmatter `type: todo` 的条目 → 渲染成 todo badge
- 双击该条目 → archive 掉 → 写回文件 → overlay 里也同步

**无需额外 "标记完成" 入口** — 主窗口编辑文件时，删掉一条 = "完成了"。主窗口比 overlay 更适合做精确的编辑类操作。

### 物理意义总结

```
overlay 的功能边界 = 录入 + 粗处理 (archive)
主窗口的功能边界 = 精处理 (编辑/删除/转正/搜索)
```

这条线清楚，overlay 就不需要长成 "mini 项目管理器"。

---

## 五、Cmd+Enter 提交动画

确认向下飞出 (物理重力隐喻):

```
1. textarea 内容: translateY 0 → 20px, opacity 1 → 0 (200ms)
2. history 列表顶: translateY -10px → 0, opacity 0 → 1 (250ms)
3. textarea: clear + border flash 品牌蓝 (150ms)
```

---

## 六、历史面板 + 每日查看

```
│ 今天 · 7 条          [查看]  [折叠 ▴]  │
│────────────────────────────────────────│
│ .  hover 焦点怎么处理        [✓]  [⋯]  │
│ -  review 流程设计           [✓]  [⋯]  │
│ ?  为什么 hover 不用 200ms   [✓]  [⋯]  │
│────────────────────────────────────────│
│ 昨天 · 14 条          [查看]  [折叠 ▴]  │
│────────────────────────────────────────│
│ .  怎么让 J...               [✓]  [⋯]  │
│ !  万花筒第三种变体          [✓]  [⋯]  │
│────────────────────────────────────────│
│ [显示更早的 20 条]                       │
```

**点击 `[查看]`** → `invoke('open_file', { path: '~/documents/inbox/inbox-2026-07-14.md' })` → 主窗口打开该日文件。

**点击 `[折叠 ▴]`** → 该日所有条目隐藏 → 行变为 `[展开 ▾]`。

**点击 `[✓]`** → archive → 该条目变绿 + "已归档 · [撤销]" 5 秒 → slide-out 消失 → 写入 archive/ 文件。

**点击 `[⋯]`** → popover 菜单:
  - 编辑 (打开 inline detail + textarea)
  - 删除 (确认 → 从文件永久删除)
  - 转正 (P2 → 转为正式文档)

**click 条目本身** → inline detail 展开 (查看完整内容)。

---

## 七、胶囊交互

```
┌────┐
│[_] │   ← 44×44 胶囊，Jianxi logo
└────┘

单击 (delay 200ms) → popover preview (buffer + 最近 3 条)
双击 → restore overlay
```

> **v5.4 变更**: hover tooltip 已移除。胶囊只响应单击（popover）和双击（恢复），hover 无任何视觉反馈。

---

## 八、Pin 模式

Pin = 系统级 always-on-top

```rust
window.set_always_on_top(true)?;
```

层级:
1. 系统键盘 / Spotline
2. **Jianxi Overlay (pin)**  ← 覆盖全屏应用
3. 用户窗口
4. 桌面

视觉: 顶栏 📌 icon = filled `#0071e3`。

---

## 九、字号与主题

| 维度 | overlay 值 | 说明 |
|------|-----------|------|
| font-family | Literata (若不可用则系统 fallback) | 与主窗口一致 |
| font-size 默认 | **15px** | 比主窗口 16px 小，克制 |
| line-height | 1.7 | 与主窗口一致 |
| 字号范围 | 12px – 22px | Cmd+=/- 调节 |
| 主题 (dark/light) | **跟随主窗口** | overlay 不独立配置 |
| 主题过渡动画 | 300ms | 与主窗口同步 |

字号 Cmd+=/- 持久化到 `~/.clairis/config.toml` 的 `[capture]` 段。

---

## 十、Archive 归档详解

### 写入

```
点击 [✓]:
  1. Rust: read active file (inbox-2026-07-14.md)
  2. Rust: parse entry by ID
  3. Rust: append to archive/inbox-2026-07-14.md
  4. Rust: delete from active file (or mark as archived)
  5. Rust: write back both files
  6. UI: entry 变绿 + "已归档 · [撤销]" 5s
  7. 5s 后: slide-out 动画消失
```

### 读出

overlay 的 history list = 读取 `~/documents/inbox/inbox-${today}.md` 的文件头 frontmatter + 内容。

不显示 archive 中的条目（除非用户在某天头部点了 `[查看 归档]`，这个 P2 再加）。

### "已完成" 语义统一

四种类型的 "完成" 都是 archive:
- **todo `-`**: "review 流程设计" = done → archive
- **problem `.`**: "hover 焦点" = 解决 → archive  
- **idea `!`**: "CM6 万花筒" = 已记录/已转正 → archive
- **wonder `?`**: "为什么 200ms" = 已想通 → archive

archive 不是 "删除"，是 **"已处理进入历史"**。

---

## 十一、v5.4 增补：可调布局 + 关闭行为

### 窗口宽高可调

overlay 不再固定 420px 宽度。用户可拖拽四边/四角调整窗口大小：

| 维度 | 最小 | 最大 | 默认 |
|------|------|------|------|
| 宽度 | 320px | 600px | 420px |
| 高度 | 280px | 800px | 500px |

实现：容器 div 外围 8 个 resize handle（四边 + 四角），`cursor: nwse-resize` 等，拖拽时更新 `overlayWidth`/`overlayHeight`，同步持久化到 config.toml。

### 双面板拖拽分隔

textarea 区域和 history 区域之间新增 4px 拖拽分隔条（`cursor: row-resize`）。

```
┌──────────────────────────┐
│ TOP BAR (hover)          │  44px
├──────────────────────────┤
│ TEXTAREA                 │  panelRatio × 可用高度
├── drag handle ──────────┤  4px
│ HISTORY                  │  剩余高度, overflow-y: auto
├──────────────────────────┤
│ FOOTER (hover)           │  40px
└──────────────────────────┘
```

`panelRatio` 范围 0.2~0.8，默认 0.4。拖拽分隔条时实时更新，持久化到 config.toml。

### X 按钮行为

| 场景 | 行为 |
|------|------|
| X + 有内容 | 先 `handleCmdEnter()` 保存 → 再 `close()` 关闭 |
| X + 无内容 | 直接 `close()` 关闭（不保存） |

> **不再** minimize 到胶囊。只有双击顶栏才 minimize。

### Escape 行为

| 场景 | v5.3 | v5.4 |
|------|------|------|
| Escape + 编辑模式 | 取消编辑 | 不变 |
| Escape + 有内容 | 清空内容 | 不变 |
| Escape + 有 prefix | 清空 prefix | 不变 |
| Escape + undo 中 | 撤销归档 | 不变 |
| Escape + pinned | 取消 pin | 不变 |
| Escape + 无内容 | minimize → 胶囊 | **直接关闭** |

### Capsule tooltip 移除

v5.4 移除胶囊 hover tooltip。胶囊只响应：
- 单击（200ms defer）→ popover preview
- 双击 → restore overlay
- 拖拽 → 停靠四角/四边

hover 无任何视觉反馈。

---

## 十二、更新 P0 Checklist

念头到录入:
- [ ] Cmd+Shift+. 弹入 < 200ms
- [ ] textarea focus + 首字 < 100ms
- [ ] 顶栏 hover 淡入 200ms / 移开淡出（Quiet Chrome 独立触发）
- [ ] 底栏 hover 淡入 200ms / 移开淡出（Quiet Chrome 独立触发）
- [ ] textarea 区域 hover 不触发 Quiet Chrome

录入:
- [ ] Enter 始终换行
- [ ] Cmd+Enter 始终提交
- [ ] Ctrl+Enter 始终提交 (macOS Cmd+Enter)
- [ ] prefix IME 兼容: `.`/`, `-`/`—`/`!`/`！`/`?`/`？` 八种映射
- [ ] Double-Enter 重置 prefix
- [ ] 字号 Cmd+=/- 范围 12-22 + 持久化

历史:
- [ ] `[查看]` 按钮打开主窗口
- [ ] `/折叠` 折叠日条目
- [ ] `[✓]` archive 通用 (四种 type 同一语义)
- [ ] `[⋯]` menu → 编辑/删除/转正
- [ ] click item → inline detail 展开
- [ ] hover item → `[✓][⋯]` Quiet Chrome 显现

胶囊:
- [x] ~~hover tooltip 标题 + 最近 3 条 + 提示~~ (v5.4 已移除)
- [ ] 单击 popover (buffer + 最近 3 条只读)
- [ ] 双击 restore overlay

窗口:
- [ ] 默认主窗口所在屏
- [ ] 拖动可至副屏
- [ ] pin = always-on-top (覆盖全屏应用)
- [ ] 主窗口关闭 overlay 独立存活
- [ ] 窗口宽高可调 (320~600 / 280~800) — v5.4 新增
- [ ] 面板拖拽分隔条 textarea↔history — v5.4 新增
- [ ] X 按钮 = 保存+关闭 / 无内容直接关闭 — v5.4 新增
- [ ] Escape 无内容 = 直接关闭 — v5.4 新增

---

## 十三、最终确认项

**C1 (字号)**: overlay 默认 15px (主窗口 16px) 

**C2 (prefix)**: 单字符回到 `. - ! ?` + IME 兼容映射 

**C3 (archive)**: 统一 archive 操作 (不论 type，"完成"都是归档)

**C4 (pin)**: always-on-top (确认覆盖全屏应用)

**C5 (主屏锚点)**: overlay 默认在主窗口所在屏，可拖至副屏

**C6 (持久化)**: ~/.clairis/config.toml 的 [capture] 段

**C7 (可调布局)**: v5.4 — 窗口宽高可调 + 双面板分隔条 + X 按钮保存关闭 + capsule tooltip 移除

---

// ponytail: v5.4 = v5.3 增补可调布局/X关闭/capsule tooltip移除。窗口320~600宽/280~800高，面板分隔条0.2~0.8比例，Escape无内容直接关闭。
