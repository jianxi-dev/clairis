---
title: "Capture Overlay v5.1 — Quiet Chrome + 完整产品体验"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay v5.1 — Quiet Chrome + 完整产品体验

> **状态**: v5.1 — 融合印哥 16 条反馈
> **替代**: v5
> **最核心改动**: Quiet Chrome 模式 — 输入时只显输入框，hover 边框才显现功能
> **Ponytail**: quiet-chrome · archive 透明 · inline detail · real-time sync · text-only first

---

## 零、印哥的 16 条回应（逐条对应）

| # | 印哥反馈 | v5.1 处置 |
|---|---------|----------|
| 1 | archive 往哪归档，归档后怎样 | 见第四节详细说明 |
| 2 | "转正" 效果 | P2 功能，见第四节 [⋯] 菜单，本期只留入口 |
| 3 | 胶囊 tooltip 显示内容 | 见第六节具体设计 |
| 4 | Cmd+N 动画：历史收入动画 | 见第三节动画描述 |
| 5 | 对钩 [✓] 含义与价值 | archive = 已处理/已解决，见第四节 |
| 6 | 查看某一条/某一天/集中查看 | 见第五节 inline detail + 日分组 |
| 7 | hover tooltip 具体展示 | 见第六节 |
| 8 | 减少干扰的历史面板 | Quiet Chrome — hover 才显现 [✓][⋯] |
| 9 | Spotlight + 自然语言 | P2 保留 |
| 10 | Action 链 + 跨平台 | Action 链解释见第七节，跨平台 P2 |
| 11 | Google Keep 风格 + Quiet Chrome | **核心采纳** — 输入时只显输入框，hover 边框才显现 |
| 12 | 纯文本 vs 表格/图片 | 本节末：纯文本起步，P2 支持 Markdown 富文本 |
| 13 | 自动保存 vs 实时同步 | Cmd+Enter 提交 + 主窗口 store 实时刷新 + 关闭兜底写 |
| 14 | 未打勾 = 待商榷 | 留空，不在本期确认 |
| 15 | 后续自然语言 | P2 |
| 16 | Action 链是什么 | 第七节解释 |

---

## 一、Quiet Chrome 模式（核心改动）

> 印哥: "输入时只是个输入框，需要其他操作时，鼠标移至边框才显现可操作的其他功能，不需仪式，不同于主产品"

### 1.1 视觉状态机

**状态 A — 纯输入态（默认，窗口打开）**:

```
┌                                        ┐
│  .  _                                   │
│                                          │
│                                          │
│                                          │
└                                        ┘
```

整个窗口：
- 无顶栏标题
- 无关闭/钉住按钮
- 边框 opacity 0.3（极淡，几乎看不见）
- 只有 textarea 闪烁光标

**状态 B — hover 显现态（鼠标移入窗口任意位置）**:

```
┌────────────────────────────────────────┐
│ ≡ ⊕ Capture                   📌  ✕   │  ← 顶栏淡入 (opacity 0─1, 200ms)
├────────────────────────────────────────┤
│ .  _                                   │
│                                        │
│                                        │
└────────────────────────────────────────┘
```

顶栏 + 按钮全部淡入动画出现：
- 左侧 80px: 拖拽区 (cursor: grab)
- 右侧: pin + 关闭按钮
- 输入框边框 opacity 0.3 → 0.8

**状态 C — hover 历史区域（鼠标在历史列表上）**:

每条 history item 的 [✓] 和 [⋯] 淡入：

```
│ 今天                                    │
│ !  hover 焦点怎么处理        [✓]  [⋯]  │  ← hover 项才显现
│ -  review 流程设计                      │  ← 非 hover 不显现
```

**状态 D — 失去 hover 300ms 后回到状态 A**

无操作 3 秒后，顶栏和所有按钮淡出 → 回到纯输入态。

### 1.2 为什么 Quiet Chrome 是正确的

**Jianxi 主产品 ≠ Capture Overlay**

主产品需要仪式感（Literata 字体、暗色、展卷动画）— 因为它是**长期工作伴侣**。

Capture Overlay 是**念头中转站** — 用户在 3 秒内输入想法并离开。仪式越多，念头丢失率越高。

**Google Keep 的 "轻"**: Keep 打开就是一张白纸 + 颜色点。没有工具栏、没有标题、没有侧栏。用户从第一毫秒就能开始输入。

**我们的改进**: 比 Keep 更安静 — Keep 至少有 [+][⋮][✕] 三个按钮常驻。我们默认一个都没有。

### 1.3 顶栏淡入动画

```css
.top-bar {
  opacity: 0;
  transition: opacity 0.2s ease;
}
.overlay-root:hover .top-bar {
  opacity: 1;
}
.overlay-root:not(:hover) .top-bar.fade-after-idle {
  opacity: 0;  /* 3s 无操作后淡出 */
}
```

按钮同理：
```css
.history-item .inline-actions {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.history-item:hover .inline-actions {
  opacity: 1;
}
```

---

## 二、输入与提交

### 2.1 输入框 (textarea)

```ts
<textarea
  placeholder="记录…"  // . - ! ? 模式下切换
  value={store.draftContent}
  onChange={e => store.setDraftContent(e.target.value)}
  onKeyDown={handleKeyDown}
  ref={textareaRef}
/>
```

关键行为：

| 操作 | 行为 |
|------|------|
| Enter | 换行 |
| Cmd+Enter | 提交 (commit) |
| Cmd+N | 新建 (= Cmd+Enter + 清空) |
| Tab | 插入 2 空格 |
| Esc (buffer 非空) | 清空 buffer |
| Esc (buffer 空 + prefix) | 退出 prefix mode |
| Esc (buffer 空) | minimize → capsule |

### 2.2 Cmd+Enter 提交反馈（动画）

**印哥反馈**: 需要一个动画，让当前内容 "收入历史记录中"。

动画描述：

```
1. Cmd+Enter 按下
2. textarea 内容向上飞出 (translateY: -40px, scale: 0.95, opacity: 0)
   duration: 250ms
3. 同一瞬间，history 列表顶部出现新条目
   新条目 fade-in + slide-down: translateY: -10px → 0
   duration: 250ms
4. textarea 清空，光标回到顶部
   边框闪品牌蓝 (border-color: #0071e3 → transparent)
   duration: 150ms
```

即 macOS 下载完成动画 (Safari) 或 Things 3 完成任务动画的精简版。

**实现**: CSS keyframes + React transition。Web Animations API 或 framer-motion 不用，纯 CSS class toggling。

### 2.3 Double-Enter 重置

在 prefix mode (如 `. 模式`) 下：

```
Cmd+Enter (buffer 非空) → 提交，保持 . mode
Cmd+Enter (buffer 空)   → 清空 prefix，回到空 mode
```

不需要 Delete 键。手指始终在 Enter 上。

### 2.4 新建 (Cmd+N)

**印哥反馈**: "新建后之前的内容才会进历史" + 动画。

Cmd+N = Cmd+Enter + 清空：
- 提交当前 buffer（触发 2.2 动画）
- 清空 textarea
- 保持 prefix (便于连续输入同类想法)

新建按钮位置：
- 无（Quiet Chrome 模式下不显示常驻按钮）
- 仅 hover textarea 左上时，出现一个极淡的 ⊕ 在 placeholder 左

---

## 三、prefix 系统

| prefix | 含义 | placeholder | badge 颜色 |
|--------|------|-------------|-----------|
| . | 问题 | 输入问题… | #1f2937 黑 |
| - | 待办 | 输入待办… | #f59e0b 橙 |
| ! | 灵感 | 记录灵感… | #a855f7 紫 |
| ? | 思考 | 开放思考… | #0071e3 蓝 |
| 无 | 笔记 | 记录… | (无 badge) |

prefix 行为：
- 空 mode 输入 `.` / `-` / `!` / `?` → 切换到对应 mode，placeholder 变化
- prefix 模式下 Cmd+Enter 提交 → 保留 prefix 模式（方便连续输入）
- prefix 模式下 Cmd+Enter 空内容 → 退出 prefix 模式
- 前缀字符保留在 frontmatter `type:` 字段，内容中也显示 "." 字符（可读性）

---

## 四、Archive 归档（回应印哥 Q1 + Q5）

### 4.1 Archive 是什么

Archive = "已处理/已解决/暂时不需关注"。

**不删除内容**。只是从当前活跃列表中移到归档文件。

### 4.2 物理存储

```
~/documents/inbox/
  ├── inbox-2026-07-14.md      ← 活跃条目（今天的未处理）
  └── archive/
      └── inbox-2026-07-14.md  ← 归档条目
```

### 4.3 [✓] 操作后的行为

1. 条目从当前 inbox 文件读取 → append 到 archive 文件
2. 从 inbox 文件删除 (防 data loss 用 append-then-delete 顺序)
3. UI 上：条目变绿 + "已归档 · [撤销]" 5 秒
4. 5 秒后：条目 slide-out 消失
5. 5 秒内点击 [撤销] → 移回 inbox，恢复原状

### 4.4 Archive 的用途价值

印哥问 "有什么用处价值"：
- **清理活跃列表**: 今天的 30 条 → 处理 20 条 → 活跃列表只剩 10 条
- **保留所有内容**: 在 archive/ 里可以查看历史已处理的记录
- **精力管理**: 不在活跃列表里的事项 ≠ 不存在。你的精力聚焦于 "尚未处理的"
- **审阅**: 每周看一次 archive/ 回顾本周做了什么

### 4.5 [⋯] 菜单功能

点击 history 项目右侧 [⋯] 显示菜单：

- **编辑**: 打开 inline detail view 修改
- **删除**: 从 inbox 中永久删除（需确认，因为进 archive 只是删除活跃，这是真的删）
- **转正** *(P2)*: 把这条灵感/待办转正为 Jianxi 中的正式文档 → 弹出目录选择器 → 写入文件 → archive 原条目

转正 (P2):
- 选择转正 → 弹出迷你文件面板（Cmd+P 同款 flattened view）
- 用户在某个文件上回车 → 条目内容追加到该文件末尾
- 原 inbox 条目 archive

---

## 五、查看交互（回应印哥 Q6）

### 5.1 查看某一条: Inline Detail

点击 history item → 该行展开：

```
│ !  hover 焦点怎么处理              │
│ ─────────────────────────────────── │
│ ! hover 焦点怎么处理                 │
│                                     │
│ 现在的 CM6 hover 在用户先 hover     │
│ 到文档区域时才设置 focus，这导致    │
│ 多终端体验不一致。需要改为 click    │
│ 后立即 focus，而不是 hover。       │
│                                     │
│ [✓ 归档]  [⋯ 更多]  [Esc 收起]      │
```

展开行为：
- 当前行下方 **原地** 展开（不跳转页面）
- 显示完整内容 (不截断)
- 底部三个操作按钮：归档/更多/收起
- 再次点击该行 / Esc → 收起

### 5.2 查看某一天: 日分组折叠

点击日期分隔行 `今天 · 7 条` 右侧的 `[折叠 ▴]`：

- 该日期下所有条目隐藏
- 该行变为 `今天 · 7 条 [展开 ▾]`
- 再次点击恢复

### 5.3 集中查看: 将来 P2

印哥说的 "集中查看" 可以理解为：

当前 overlay 里的历史是按日期分组的 flat list。如果某天需要：
- "看看我上周所有灵感"
- "导出最近 7 天的待办"

这就不是 overlay 能承载的了 → P2 **Review Panel** (Cmd+Shift+, 见 outline-quick-capture-final 第 3.5 节)。

Review Panel 是一个专门的 flat list + filter + 搜索界面，区别于 overlay 的 "快速捕获" 定位。

v5.1 overlay 只做：
- 按日查看 (日分组折叠)
- 查看某一条 (inline detail)
- 集中查看 → P2 Review Panel

---

## 六、胶囊交互（回应印哥 Q3 + Q7 + 8 hover 风格）

### 6.1 胶囊外观

44×44px，停靠 bottom-right 24px:

```
┌────┐
│ ⊕  │   ← Jianxi logo, 灰色 #9ca3af
└────┘
```

整个胶囊可拖拽：按住任意位置移动，停靠四角/四边中点。

### 6.2 hover tooltip

印哥问 "具体展示哪些内容"。设计:

```
┌────────────────────────────────┐
│ ⊕ Jianxi · 今天 7 条           │  ← 标题行
│ ────────────────────────────── │
│ !  怎么让 CM6 hover 不抢焦点    │  ← 最新 3 条 (单行截断)
│ -  给 inbox 设计 review 流程  │
│ .  为什么不用 200ms            │
│ ────────────────────────────── │
│ Cmd+Shift+. 唤起  ·  双击恢复   │  ← 提示
└────────────────────────────────┘
```

位置关系:

```
         tooltip (280x180)
              │
    ┌─────────▼──────────┐
    │                    │
    │  [⊕] 胶囊          │
    └────────────────────┘
```

靠近屏幕边缘时 tooltip 自动翻转方向（top/bottom + left/right 组合）。

### 6.3 单击 vs 双击

与 v4.1 一致，新增 defer 机制：

```
单击 (delay 200ms) → 弹出 popover preview (半明 280x360)
双击 → 恢复录入窗口 (取消 pending 单击)
```

Popover Preview (不同于 tooltip，popover 是更大的面板):

```
┌──────────────────────────┐
│ 📌 当前记录               │
│ ──────────────────────── │
│ . 我正在写的多行想法...    │
│                          │
│ 最近 5 条:               │
│ !  hover 焦点处理        │
│ -  review 流程设计       │
│ ?  为什么 200ms          │
│ ──────────────────────── │
│ 展开查看 ▸               │
└──────────────────────────┘
```

- 点击 "展开查看 ▸" → 关闭 popover + 恢复 overlay
- 点击外部 / Esc → 仅关闭 popover
- 再次单击胶囊 → 也关闭 popover (toggle)

---

## 七、Action 链解释（回应印哥 Q16）

Action 链 = Drafts 的核心功能。例子：

```
用户在 Drafts 输入: "每周三下午3点团队周会"

Action: "解析自然语言 → 提取日期时间 → 创建 Calendar 事件"

Action: "提取标题 '团队周会' + 提取时间 '每周三 15:00' → append 到 Things 3"

Action: "发送此文本到 Slack #general 频道"

Action: "生成一句话摘要 + 发送邮件给 x@y.com"
```

本质: **输入 → 一系列自动变换 → 发送到目标**

Jianxi P2 可以做：
- "! 大纲可以用 collapsible tree" → Action: "转正为 Jianxi 文档 + 写入 ~/灵感/folio.md"
- "- 明天提交 App Store Review" → Action: "创建 Reminder + 添加到 OmniFocus"

但 v5.1 **不做** Action 链 — 这是大件，需要完整的 Action Editor UI（Drafts 做了 5 年才稳定）。

---

## 八、自动保存策略（回应印哥 Q13）

### 印哥倾向

> "bear 的自动保存 → 与 Bear 笔记列表实时同步"

Bear 模型：输入的每一字都自动保存到 Bear 的 note index。用户在 overlay 输入的内容，在主窗口可见。

### 我的建议: Cmd+Enter + 实时刷新主窗口

```ts
// Cmd+Enter commit 后
function commit() {
  const entry = formatEntry(store.draftContent, store.draftPrefix);
  await invoke('append_inbox', { entry });          // IPC 写磁盘
  await invoke('refresh_main_window_files', {});    // 触发主窗口文件面板刷新
  store.setDraftContent('');                        // 清空 buffer
  store.setHistory(prev => [entry, ...prev]);       // 本地 history 立即更新
}
```

关键三层保障:

1. **Cmd+Enter**: 显式提交到磁盘 + 主窗口立刻可见
2. **关闭时兜底**: 若 buffer 非空且未 Cmd+Enter → 静默写磁盘
3. **崩溃恢复**: localStorage["clairis_capture_draft_fallback"] 保存最后一次 input，overlay 恢复时检查

**不做**: 每 2s 定时写入。原因：
- 竞态 (用户还在写，定时触发擦掉了未完成的思路)
- IO 频率干扰思路 (SSD 虽然没有声音，但进程调度有微小的 CPU 占用)
- Rust 后端: 每 2s 一次文件 open-write-close 对 inbox 文件不公平 (如果 overlay 打开 8 小时 = 14400 次写，每次 fsync)

---

## 九、纯文本 vs 富文本（回应印哥 Q12）

### 印哥问: "录入窗口支持纯文本，还是可以支持表格、图片"

| 维度 | 纯文本起步 | P2 Markdown 富文本 |
|------|-----------|------------------|
| 念头到录入延迟 | 最优 (textarea 即开即写) | 差 (富文本工具栏 + 渲染占用) |
| 想法完整度 | ⭐⭐⭐⭐⭐ 每个想法独立 | ⭐⭐⭐ 一旦需表格就跳出窗口 |
| 跨端同步 | 纯文本最小体积 | 表格/图片 base64 大 |
| 仪式感 | 低 — 符合 Quiet Chrome | 高 — 接近 Jianxi 主产品 |
| 实现成本 | 200 行 TSX | 2000+ 行 (CM6 inline widgets) |

### 我的建议

**v5.x: 纯文本 + frontmatter prefix**

只支持:
- 纯文本输入
- 自动 frontmatter (type/time 写入 inbox-*.md)
- 无表格/无图片/无内联格式

**P2 (+ 6 个月): Markdown 富文本**

如果用户反馈需要:
- 在 overlay 内贴截图 → base64 内联或本地文件引用
- 在 overlay 内写简短表格 (Markdown table 语法)
- 对选中文本加粗/斜体/标题层级

实现: 用 CodeMirror 6 替换 textarea，复用 Jianxi 主产品的编辑器装饰器。

---

## 十、历史记录细节优化

### 10.1 历史面板默认态

Quiet Chrome 风格:

```
┌────────────────────────────────────────┐
│ .  _                                   │
│                                        │
├────────────────────────────────────────┤
│ [展开历史 ▾ 7条]                        │
└────────────────────────────────────────┘
```

默认 **不显示历史**。只有 hover 窗口 → 顶栏淡入 → 历史区域才加载。

### 10.2 展开后

```
┌────────────────────────────────────────┐
│ .  _                                   │
├────────────────────────────────────────┤
│ 今天 · 7 条                    [折叠 ▴]│
│────────────────────────────────────────│
│ !  怎么让 CM6 hover...        [✓]  [⋯]│
│ -  review 流程设计            [✓]  [⋯]│
│ ?  为什么 hover 不用 200ms    [✓]  [⋯]│
├────────────────────────────────────────│
│ 昨天 · 14 条                  [折叠 ▴]│
│────────────────────────────────────────│
│ .  怎么让 J...                [✓]  [⋯]│
│ !  万花筒第三种变体            [✓]  [⋯]│
├────────────────────────────────────────│
│ [显示更早的 20 条]                      │
└────────────────────────────────────────┘
```

规则:
- [✓] 和 [⋯] **仅 hover 该行时** 显现 (Quiet Chrome)
- 非 hover 不显示任何操作按钮
- 日期分隔行有 [折叠 ▴] 按钮常驻 (让日分组折叠可达)

### 10.3 内容截断

- 单行显示: 超出 50 字符 `...`
- hover 该行: 完整显示前 200 字符 (tooltip 式 inline 展开)
- click 该行: 展开 inline detail (第五节)

---

## 十一、Cmd+N 补充

印哥: "新建后之前的内容才会进历史" — v5.1 已完成。 Cmd+N = Cmd+Enter + 清空。

动画流程 2.2 已描述。

---

## 十二、上线标准和 Checklist (回应印哥 Q14)

印哥: "未打勾是对功能还不确定，还需商榷" — 留空为 v5.1 内 TBD 项。

### 12.1 v5.1 必须过 Checklist (P0)

念头到录入:
- [ ] Cmd+Shift+. 窗口弹入 < 200ms *(P90 环境: < 500ms)*
- [ ] textarea focus 成功 → 第一字输入 < 100ms
- [ ] 窗口层级覆盖其他 App *(pin 模式)*

录入流程:
- [ ] Enter = 换行 (任何情况)
- [ ] Cmd+Enter = 提交 (任何情况)
- [ ] Cmd+N = save + new *(触发历史飞入动画)*
- [ ] prefix 检测和切换无闪烁
- [ ] 3 秒无操作 → 顶栏淡出 *(Quiet Chrome)*

历史处理:
- [ ] 日分组折叠/展开
- [ ] ↑↓ 跨 item 导航
- [ ] click item → inline detail 展开
- [ ] hover item → [✓][⋯] 显现
- [ ] [✓] archive → 条目变绿 + [撤销]
- [ ] [撤销] 可达 *(5s 内有效)*

胶囊:
- [ ] 44×44 触屏可达
- [ ] 拖动不误出 popover
- [ ] hover tooltip 显示标题 / 最近 3 条 / 提示
- [ ] 单击 popover preview (280×360) 显示 buffer
- [ ] 双击恢复 overlay

数据完整性:
- [ ] Cmd+Enter 同步写入 disk (< 200ms NVMe)
- [ ] 关闭时 buffer 兜底写 localStorage

### 12.2 TBD 待商榷 (P1, 不进 P0)

- [ ] 窗口层级 ≤ main window during main window 焦点 *vs.* always-on-top pin 模式冲突解决
- [ ] multi-screen: overlay 跟随 main screen vs. 当前鼠标所在 screen
- [ ] GlobalShortcut 冲突检测 fallback UI
- [ ] 主窗口关闭时 overlay 是否同时关

---

## 十三、竞品差异 (回应印哥整体对比)

### Jianxi v5.1 独特价值

| 维度 | Apple Notes | Drafts | Google Keep | Jianxi v5.1 |
|------|------------|--------|-------------|------------|
| 输入氛围 | 极简+仪式感 | 极简+Action | 极简+快捷 | **极简到几乎不存在** (Quiet Chrome) |
| 默认视觉 | 标题栏+3按钮 | 完整侧栏 | 4色卡片 | **无边框、无按钮** |
| 保存触发 | Cmd+S | 实时 | 实时 | **Cmd+Enter (显式)** |
| prefix 系统 | ✗ | ✗ | ✗ | **5 语义前缀 (.-!?+无)** |
| 胶囊 popover | ✗ | ✗ | ✗ | **hover tooltip + click preview** |
| inline detail | ✗ | ✓ (draft detail) | ✗ | **click 行展开** |
| 日分组 | 文件夹 | 标签 + 搜索 | 颜色 | **日期 sep + inline collapse** |

**一句话总结**: Jianxi v5.1 = "比 Quick Note 安静、比 Drafts 轻、比 Keep 有组织"。

---

## 十四、实施拆分

Phase A1 *(Quiet Chrome 核心)*:
- textarea + Cmd+Enter
- 顶栏 hover 淡入/淡出
- history item hover [✓][⋯] 淡入
- dblclick minimize (200ms 守卫)
- inline detail 展开

Phase A2 *(胶囊)*:
- 胶囊状态机
- 拖动停靠四角
- hover tooltip
- popover preview

Phase A3 *(独立窗口)*:
- Tauri 多窗口创建 (capture-overlay.html)
- 主↔子 IPC 通信

Phase B *(Rust I/O)*:
- append_inbox (写 inbox-*.md + frontmatter)
- load_history_date_range (按日期读取)
- 列表插入时刷新主窗口 refresh_main_window_files

Phase C *(全局快捷键)*:
- Tauri GlobalShortcut::register("Cmd+Shift+.")

---

// ponytail: v5.1 = v5 + Quiet Chrome + archive 解释 + 完整查看交互 + 竞品差异表 + Action 链解释 + 纯文本 vs 富文本建议。P0 Checklist 等待印哥 tick。
