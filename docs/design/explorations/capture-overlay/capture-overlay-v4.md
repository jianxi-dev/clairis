---
title: "Capture Overlay v4 设计 — 多行 + pin + 胶囊 + 预览"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

Capture Overlay v4 设计 — 多行 + pin + 胶囊 + 预览
状态: v4 — 由印哥反馈 6 条驱动
替代: v3.1
全部中文，严禁 markdown

====================================
零、致命误读与反思
====================================

v3.1 为何反人类：

1. 我把 "Double-Enter 重置" 理解为 "Enter 保存 + Enter 清空"
   — 实际是 "在 prefix mode 下连按 2 次 Enter = 退出该 mode"
   — 空 mode 下 Enter 只保存，不清空 prefix（因为空 mode 没有 prefix）

2. 顶部放了 "历史 N 条" 重复计数 — spec 只要求 input 区和折叠按钮显示数量

3. 44px 顶栏 + 独立的 drag dot / ⊟ / ✕ — 操作点分散、拖拽区域受限
   — 不符合 "按住顶部就能移动" 的 Apple Notes 风格

4. 多行输入 — spec 示意图为单行，但印哥确认是多行 textarea + 双 Enter 重置
   — 这条在多行场景下需要重新定义: Enter = 换行，Cmd+Enter = 保存

5. 最小化按钮 + 浮动胶囊 — 冗余按钮多，没有单击预览

争议点: Apple Notes Quick Cmd (iOS 18) 是 "新建按钮 + 输入框" 一体
印哥倾向新建有快捷键。我倾向新建按钮在输入框内左侧 (prefix 左)。
等印哥确认。

====================================
一、印哥确认的 6 条 (P0)
====================================

P1. 多行 textarea，高度随内容增长（max 6 行）
    Enter = 回车换行，不改 mode / 不保存
    Cmd+Enter = 保存当前 buffer
    保存后: Enter 保持原 mode (prefix 不变)，与 spec 一致

P2. 输入自动保存
    每 2s 自动保存至 ~/documents/inbox/draft.md
    关闭窗口时若有未保存 buffer，确认或自动保存

P3. 新建入口 = 快捷键 Cmd+N (在 overlay 内也生效)
    不新建历史重复计数，仅折叠按钮显示数量

P4. 最小化 = 双击顶部标题栏 (44px)
    而非点击 ⊟ 按钮

P5. 移动 = 按住顶部标题栏任意位置 (44px 横条)
    而非只限 drag dot

P6. 胶囊 (最小化后):
    左键按住可移动位置
    单击 = 弹出半透明预览浮窗 (只读)
    双击 = 恢复录入窗口

====================================
二、布局 (多行 textarea)
====================================

┌──────────────────────────────────────────┐
│ ≡  ⊕ Jianxi            7 条      ✕       │  top bar 44px
├──────────────────────────────────────────┤
│ .  怎么让 CM6 hover 不抢焦点             │
│    第二行输入内容...                      │  textarea auto-resize (max 6行)
│                                          │
└──────────────────────────────────────────┘
  [展开历史 ▾]                    [钉住 ▴]

展开后:
┌──────────────────────────────────────────┐
│ ≡  Jianxi                       ✕       │
├──────────────────────────────────────────┤
│ .  _                                     │
│                                          │
├──────────────────────────────────────────┤
│ 今天                                     │
│ !  hover 不抢焦点               ✓  ⋯    │
│ -  review 流程                 ✓  .readLine()✓    │
├──────────────────────────────────────────┤
│ 昨天                                     │
│ ?  为什么 hover 不用 200ms    ✓  ⋯    │
├──────────────────────────────────────────┤
│ [显示更早的 20 条]                        │
└──────────────────────────────────────────┘

注释:
- 顶部无数字重复: "7 条" 仅在 top bar 右侧显示一次
- 输入框 placeholder "记录…"
- 左侧 prefix 彩色 badge (.)
- 粘贴多行文本 → textarea 自动增高

====================================
三、多行输入行为 (多行与 spec 差异处理)
====================================

Spec (单行):
  . + content + Enter → 保存 + 切到 . mode
  . + Enter (空) → Double-Enter → 退出 . mode

v4 (多行，印哥确认):
  . + content + Cmd+Enter → 保存 + 切到 . mode (prefix 保留)
  . + Cmd+Enter (空内容) → Double-Enter → 退出 . mode，回到空 mode

实现:
  监听 textarea keydown:
    if (e.key === 'Enter' && !e.metaKey && !e.shiftKey):
      允许默认行为 (换行)
    if (e.key === 'Enter' && e.metaKey):
      e.preventDefault(); commit()

  prefix 输入 (. / - / ! / ?):
    仅在 buffer 为空时输入单个字符才识别
    输入后 placeholder 切换 (.模式 → "输入问题…")
    Cmd+Enter 保存 → buffer 切换到同一 prefix mode

====================================
四、自动保存 (P2)
====================================

buffer 每 2s debounce 保存到:
  ~/documents/inbox/draft.md

格式:
---
updated: 2026-07-14T01:35:00+08:00
prefix: .
---

. 当前正在写的多行内容...

Cmd+Enter 提交后:
  1. 追加到 inbox-YYYY-MM-DD.md (frontmatter type/time)
  2. 清空 draft.md (保留 prefix)
  3. history 列表刷新

关闭 overlay 时:
  若 buffer 非空且未提交 → 静默写入 draft.md
  下次打开恢复

====================================
五、新建 (P3) — 有争议
====================================

印哥: "新建按钮应该可以增加快捷键"
我: 倾向于新建按钮仅在输入框内部，prefix badge 左/右侧

方案 A (综合):
  输入框左侧: [⊕ 新建] 按钮
  快捷键: Cmd+N (在 overlay 内)
  点击 ⊕ 或 Cmd+N:
    提交当前 buffer (如有)
    切换到空 mode，清空 input
    textarea focus
  top bar 不显示数量，仅折叠按钮显示 [展开历史 ▾ 7条]

等印哥确认。

====================================
六、Top Bar 操作 (P4, P5)
====================================

Top Bar 44px — 整个 bar 都是拖拽区
  - WebkitAppRegion: drag (用于 Tauri native)
  内部从左到右:
    左侧 40px: 拖拽区 (cursor move)
      实际 "drag dot" 取消，改整个左侧为 drag region
    center: label "⊕ Jianxi" (不可拖拽，让点击穿透到 bar)
    右侧: 按钮组 (input 右侧):
      [钉住] 按钮: 切换 pin 状态
      [✕] 关闭

P4: 双击 top bar 中部 label 区域 → minimize
     或: 双击整个 bar → minimize (Apple Music mini player 也这样)
印哥原话: "最小化，是否双击顶部栏目就可以最小化"

实现: top bar 整个是 double-click → minimize
  但若 bar 上有按钮 (✕ / 钉住) 需要 no-drag 保留

P5: 按住 top bar 任意非按钮区域 → 移动
  cursor: col-resize → 改为 grip/move cursor
  整个 bar 除了右侧 2 个 icon button 都是 draggable

====================================
七、胶囊 (P6)
====================================

44x44 胶囊停靠 (默认 bottom-right):
  按住 → 移动 (与 top bar drag pattern 一致)
  左键按住拖拽 → 移动位置
  松开停靠近左/右/上/下四个边

单击:
  弹出半透明 preview popover (280x360)
  只读展示 content buffer
  点击外部 / Esc → 关闭 popover (胶囊保留)
  不恢复录入窗口

双击:
  恢复录入窗口 (position 还原, clamp to workArea)

====================================
八、Animation
====================================

多行 textarea transition:
  height: auto → height: Nrem (过渡 height 0.2s spring)

保存反馈:
  沿用 v3.1 "item in history = feedback" — 无 toast
  或: textarea 边框短暂闪一下品牌蓝 (150ms)

最小化过渡:
  overlay (420xauto) → capsule (44x44): scale 0.5 + opacity 0
  用 system animateWindow (Tauri动画 或 CSS scale transition)

胶囊 → overlay 恢复:
  capsule scale 1.2 (预览放大) → scale 1 + 展开 overlay

====================================
九、Store (精简对比 outline-quick-capture-final)
====================================

drop: displayLimit, collapsed, selectedIndex, undo
  — 这些在 overlay 内暂时不需要 (P2 自动保存后 undo 改由文件操作)

新增: draftContent (string), draftPrefix (CaptureStatus)
新增: capsulePosition {x, y}
新增: previewOpen (bool, popover 状态)

保留: status (closed/normal/pinned/capsule)
修改: position {x, y} — overlay 位置

history: InboxEntry[] — 保留，但从 inbox-*.md 文件读取而非内存

====================================
十、关键差异对比表
====================================

| 维度 | v3.1 (我之前的) | v4 (印哥确认) |
|------|-----------------|------------|
| 输入 | 单行 input | 多行 textarea |
| 保存触发 | Enter 保存 | Cmd+Enter 保存 |
| 换行 | 不支持 | Enter 换行 |
| Double-Enter 重置 | 错误: Enter + Enter 清空 | 正确: Cmd+Enter (空内容) 退出 mode |
| 自动保存 | 无 | 每 2s 到 draft.md |
| 顶部计数 | 重复显示 | 仅折叠按钮 |
| 新建 | 按钮 | 按钮 + Cmd+N |
| 移动 | drag dot | 整个 top bar |
| 最小化 | 按钮 | 双击 top bar |
| 胶囊交互 | 单击恢复 | 单击预览 popover + 双击恢复 |

====================================
十一、待印哥确认
====================================

C1. 新建按钮: 输入框内 [⊕新建] 图标 还是 top bar 按钮?
C2. 顶部数字完全去掉还是仅保留一个位置?
C3. Cmd+N 是否也在主窗口生效 (新建 tab)?
C4. preview popover 只读 buffer 够不够? 是否也显示 history?

====================================
十二、设计核心原则

1. 最少按钮: 去掉 ⊟ 按钮 (双击替代)，去掉 drag dot (whole bar drag)
2. 多行优先: textarea 是情绪输出的载体，不能锁单行
3. 自动保存: 零 "未保存态"，与 Jianxi 整体哲学一致
4. 胶囊是预览 + 恢复: 不是没有功能的缩小版
5. 全 top bar drag: Apple Notes 做过，用户直觉一致

ponytail: v4 = v3.1 − single-line input
                − 3 buttons in bar
                − drag dot
                − v3.1 save/undo store
                + multiline textarea
                + cmd+enter commit
                + 2s autosave
                + dblclick bar minimize
                + whole-bar drag
                + capsule popover preview
