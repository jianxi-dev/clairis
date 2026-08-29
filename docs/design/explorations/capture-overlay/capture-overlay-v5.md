---
title: "Capture Overlay v5 — 产品体验设计"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay v5 — 产品体验设计

> **状态**: v5 — 产品驱动重写，等印哥确认
> **替代**: v4.1
> **评价**: 每一个功能决策都需要过 "5 个产品问题"（见第八节）
> **Ponytail**: experience-first · 独立弹窗 · Apple 对标 · 竞品拆解 · 可衡量

---

## 零、v3.1 翻车的深层原因（重新分析）

之前的 "反思" 确实太肤浅了。列几个问题当教材：

### 问题 1：把示意图当成最终需求

Spec ASCII 图里画的是单行 `input ._` 不代表最后必须是单行。**ASCII 图是沟通工具，不是设计约束**。我应该问自己："印哥用这个窗口干什么？" 如果核心用途是记录灵感/问题/思考（任何一条都可能 2-3 行以上），那单行 input 反而不合理。

### 问题 2：没问 "高频使用"

印哥说 "每天高频使用"。高频 → 每次操作的摩擦都会被放大 100 倍。我之前的设计：

- 想把所有功能都塞进去 (4 个按钮) → 视觉噪声
- 用 drag dot 限定拖拽起点 → 手指要找点
- ⊟ / ✕ 分离 → 操作分散

**真正高频**：Apple Notes 的 Quick Note — 只有一个输入点，没有顶栏，没有按钮。因为 "新建" 这个动作就是用户已经想清楚要写了，软件不需要再问他。

### 问题 3：缺少 "完成一次任务的成本" 视角

印哥说 "这个窗口一定要超赞"。什么叫超赞？

> **用户目标链**: 产生念头 → 调出窗口 → 录入 → 念头安全保存 → 回到原本的事

> **每一个步骤都是 "成本"**：念头出现到开始记录越越好；录入本身不打断思路；保存必须 100% 可靠且无感；回到之前的工作无摩擦。

我之前设计的 Enter=提交 / Enter=清空 / Double-Enter=重置 → 用户在录入时还在**计算 "要不要清空 prefix"** → 把念头打断了。

### 问题 4：忘了 "误操作成本"

高频窗口 + 小巧目标 (胶囊 44x44) → 每一次误操作都是灾难。

- 误点 ⊟ → 窗口没了 (v3.1)
- 双击 top bar 想移动却触发了 minimize (v4.1 设计的缺陷!)
- 误点 outside 窗口关闭 → buffer 丢失

**正确的设计**: 高频操作可以慢一拍（比如先缩小再需要确认关闭），但**恢复必须一键可达**。

### 问题 5：没有 "产品调性" 思维

Jianxi 是 "精神伙伴" — 调性是克制、安静、在场但不打扰。v3.1 里：

- 顶栏塞了 5 个元素 (drag dot / label / count / ⊟ / ✕ / pin) → 喧闹
- 4s undo toast → 多余动画
- 历史计数重复显示 → 信息噪声

**humble design 的检验标准**: 用户忙的时候根本不知道这个窗口存在；想用的时候它在那里；打开后只看内容，不读按钮。

以上 5 条 + 第八节评价体系 → 检查清单 (见节末)。

---

## 一、场景故事（5 个典型用户）

### 场景 A: 地铁通勤，念头迸发

> 印哥在地铁上看到一篇好文章的结构。掏出手机 → 长按备忘录 → 看到 "添加备忘录" 直接打字 → 保存。全程 3 秒。

**Jianxi 应做到**：Cmd+Shift+. 启动 → 光标已在 textarea → 打字 → Cmd+Enter → 搞定。总耗时 < 5 秒。

### 场景 B: 深度工作中突然的 task

> 印哥正在写文档/代码，心里突然想起 "要给 inbox 设计 review 流程"。这个念头如果不马上记下来就会忘。

**关键**: 窗口打开 → 录入 → 关闭，整个过程 < 3 秒，且不打断编辑器。Cmd+Shift+. → 输入 → Cmd+Enter → Cmd+Shift+. again 回到之前。主窗口不切换、不刷新、不抢焦点。

### 场景 C: 大量垃圾清理日

> 周一打开 window → 历史还剩 30 条上周未处理的条目。需要批量处理。

**关键**: 箭头键 ↑↓ 逐条查看 → Enter 确认归档 → 再下条。不能让用户反复看 top bar 数字、点击 hover 区域、找 icon。**手不离开键盘**。

### 场景 D: 回到之前的一条记录

> 印哥突然想起上周记过一条 "!大纲可以用 collapsible tree"，想把它转正。

**关键**: Cmd+Shift+. → ↓ 导航到那天 → Enter 展开 → [⋯] 转正。

### 场景 E: 只看一眼，继续之前的事

> 印哥想看看 "上周我记录了什么来着"，但并不想回到录入模式。

**关键**: 胶囊 hover tooltip "已记录 12 条，最新 3 条是..." → 看到了 → 离开。不需要打开 overlay。

---

## 二、产品形态：独立弹窗（关键纠正）

> ⚠️ 印哥纠正：整个窗口是**独立子窗口**，不是嵌在主程序的 overlay

### 窗口物理性质

| 维度 | Jianxi 主窗口 | Capture Overlay 窗口 |
|------|---------------|---------------------|
| 进程 | main | 可以是独立 Tauri webview 或同进程浮窗 |
| 主窗口关闭后 | app 退出 | overlay 可独立存活 (也可以不独立) |
| 任务栏/dock | 显示 | 可隐藏 (single-instance utility panel) |
| 窗口 style | 标准窗口 | borderless 或 minimal chrome |
| 层级 | 层级 | Always-on-top (pin 模式) / 模式层级 |

### 与主窗口的耦合

- **打开**: 主窗口的 Cmd+Shift+. 触发同进程子窗口创建
- **关闭**: 子窗口独立关闭不影响主窗口
- **数据**: 二者共享 store (Rust 层 invoke 回写同一份 inbox-*.md)

设计原则: **Capture Overlay 是独立的模态** — 使用时它存在，不用时消失。不对主窗口产生任何干扰（不震动、不强制切换 Tab、不改变任何状态）。

**实现**: Tauri 多窗口方案 — 创建第二个 webview (`capture-overlay`)，只加载 CaptureOverlay.tsx。这样 main window 完全不动。

---

## 三、多行输入 + 保存决策

### textarea 交互详述（~1000 次/天级别）

物理性质：

```
textarea:
  min-height: 40px (1行)                            ← 默认不占空间
  max-height: 144px (6行)                          ← 超过则内部滚动
  transition: height 0.2s spring
  padding: 10px 12px                                ← 宽松
  line-height: 1.6                                  ← 可读的呼吸感
  font: 14px, literata(备用) 衬线                    ← 阅读感
```

Cmd+Enter 的 **理由**:

- Enter = 换行 → 用户输入长篇想法时不被打断
- Cmd+Enter = 提交 → 显式操作，误触率极低（用户很少 "意外按住 Cmd 并按 Enter"）
- 对比 Enter = 提交 → 用户想换行时却发现内容被提交，会怀疑人生
- 对比 按钮 → 高频场景要抬一次手，白费 0.3 秒 × 1000 = 白费 5 分钟/天

### 保存决策对比：关闭时写入 vs 2s 自动保存 vs Ctrl+S

| 方案 | 优点 | 缺陷 | 适用场景 |
|------|------|------|---------|
| 关闭时一次写入 | 零 timer 开销 · 启动时无 IO · 简单 | "我写了 10 条但没 Cmd+Enter" 会丢 | 显式提交模型 |
| 2s 自动保存 | buffer 丢失风险低 | 闭窗口时还在写有竞态 · 每 2s IO · 跨端同步复杂 | 长文档编辑 |
| Ctrl+S 手动保存 | 用户完全控制 | 高频场景不可接受 | 文件编辑器 |

> **碰撞结论 v4.1**: draft 纯内存 + 关闭时一次写入 = 最优解
> **但印哥你的担心值得补充**:

如果用户在 textarea 里写了 500 字，然后 **意外关窗口** 呢？

- 关闭时静默写入 → 500 字永远救回  
- 但静默写入 ≠ 明确的 commit。万一写入失败呢？

**答案**: 关闭时尝试同步写入，失败则本地缓存 localStorage["clairis_capture_draft_fallback"]。

### 新建 (Cmd+N) 行为细节

```
Cmd+N:
  if status == 'closed' or 'capsule':
    open overlay, clear buffer, focus textarea

  else if buffer non-empty AND not committed:
    commit current buffer (Cmd+Enter 等效)
    clear textarea, keep prefix, keep overlay open

  else if buffer empty AND prefix mode:
    exit prefix mode (same as Cmd+Enter empty)

  else:
    no-op
```

**关键**: Cmd+N 不是 "清空" 而是 "先提交，再新建"。语义 = "我记完了，下一条"。这是 Apple Notes 的 `Cmd+N` 语义。

Cmd+N 不显示 "新建" 按钮 → 输入框内留一个 [⊕] icon button 作为 fallback (鼠标党)。**该按钮不是主入口，是为了可发现性 (discoverability)**。

---

## 四、历史记录显示设计

### 4.1 ASCII 全屏场景

今天 7 条，昨天 14 条，07-05 7 条，07-04 21 条：

```
┌──────────────────────────────────────────┐
│ ≡  Capture                  📌  ✕        │
├─────────────────────────────────────────┤
│ .  _                                     │
│                                          │
├─────────────────────────────────────────┤
│ 今天 · 7 条                               │
│─────────────────────────────────────────│
│ !  hover 焦点怎么处理           [✓]  [⋯]│
│ -  review 流程设计              [✓]  [⋯]│
│ ?  为什么 hover 不用 200ms      [✓]  [⋯]│
├─────────────────────────────────────────┤
│ 昨天 · 14 条                             │
│─────────────────────────────────────────│
│ .  怎么让 J...                  [✓]  [⋯]│
│ !  万花筒第三种变体             [✓]  [⋯]│
├─────────────────────────────────────────┤
│ 显示更多 ▾ (剩余 7 条)                    │
├─────────────────────────────────────────┤
│ 07-05 (7 条)       [折叠 ▴]              │
│─────────────────────────────────────────│
│ -  第一周计划           [✓]  [⋯]        │
│ ?  hover 为什么不...    [✓]  [⋯]        │
└──────────────────────────────────────────┘
```

### 4.2 显示交互

| 元素 | 内容 |
|------|------|
| 日期分隔线 | `今天 · N 条` / `昨天 · N 条` / `07-05 · N 条` — 非交互，文字灰度 0.4 |
| 内容 | 单行显示 → 超出省略。hover → 完整 2 行 |
| 右 badge | prefix 字符 + 彩色 |
| [✓] | archive 按钮，hover 出现 (非 hover 时隐藏，减少视觉噪声) |
| [⋯] | 更多菜单 (编辑 / 删除 / 转正) |
| "显示更多 ▾" | 点击 +20 条 / 到达 14 天内无更多 → 灰字 "已全部显示" |
| 折叠某日期 | 点击日期一行右侧 `[折叠 ▴]`，再次点击展开 |

### 4.3 键盘导航

↑↓ 键 — 跨条目跳跃：

```
初始 state: input focused (selectedIndex = -1)
按 ↓: selectedIndex = 0 → 第一条 history item
按 ↓: selectedIndex = 1 → 第二条
...
按 ↑: selectedIndex = 0 → 回到第一条
再 ↑: selectedIndex = -1 → 回到 input
```

Enter (focus on history item opener [✓]) → 进入 archive 模式。用户看到 item 文字变绿+`[撤销]`。

**不设 Cmd+Z 撤回 archive**: 文件层处理。overlay 内的撤销只处理 buffer 未提交部分。

---

## 五、胶囊设计（最小化后）

### 视图

44×44px，**整个胶囊无死角可拖拽** (不仅是某个点)：

```
┌────┐
│ ⊕  │   ← ⊕ logo 居中，淡灰
└────┘
```

停靠四角 + 四边中点。停哪边由松开时的位置决定。

hover tooltip:

```
Jianxi Quick Capture · 今天 7 条
最新: "怎么让 CM6 hover 不抢焦点"
Cmd+Shift+. 唤起
```

### 交互状态机

```
          双击 ──────────────┐
          ┌──────────────────┤
          │                  │
    ┌─────▼─────┐      恢复录入窗口 (420x?)
    │ 胶囊态     │
    │ (最小化)    │──── 单击 ───► Popover Preview 浮窗
    └─────┬─────┘                  │
          │                        │ 点击外部 / Esc
          │ 按住拖动                │
          └──► 移动胶囊位置 ◄─────┘
```

Popover Preview (280×360):

- 触发: 胶囊单击 (defer 200ms, 防双击误触)
- 内容: 当前 buffer 只读预览 + 最近 3 条 history
- 关闭: Esc / 点击外部任意位置 / 再次单击胶囊
- 不响应: Cmd+Enter (↑↓) — 此时 capsule 是 "查看模式"，不是 "编辑模式"

---

## 六、顶栏与窗口拖拽

顶栏 44px (如 Apple Notes 标题栏)：

```
┌──────────────────────────────────────────┐          ← top bar region (drag + dblclick min)
│ ≡ ⊕ Capture                     📌  ✕    │
└──────────────────────────────────────────┘
  ↑              ↑                 ↑     ↑
  drag region    label(no-drag)    pin   close
  (~80px 宽)                       (40px) (36px)
```

双击最小化: 200ms 守卫。拖拽 > 5px 则取消。

移动: 整个 top bar 拖拽 (cursor: grab → grabbing)。

Top bar 右侧数字 "7 条" 只在 pin 模式下显示 (非 pin 状态不显示，因为此时 overlay 通常刚打开不需要 count)。

---

## 七、竞品分析 (Apple Notes vs Drafts vs v5)

### 竞品 1: Apple Notes Quick Note (iOS 18 / macOS Sonoma)

**做法**:
- 从屏幕右下角上滑 → 弹出一个极简 Note
- 输入 (单行或两行自动扩展)
- 键盘底部 "新 Note" 按钮 = 保存当前 + 新建
- 关闭走左上角 "完成"

**好的设计**:
- 手势唤起 - 非键盘快捷键 - 意外触发率低
- 展开高度随内容增长
- 无历史面板 - 专注输入

**不好的**:
- 关闭需要左手点 "完成" (单手场景不友好)
- 没看到前缀/分类
- 没有 "钉住"

**Jianxi 可借鉴**: 输入区极简主义、新 Note 即保存即新建

### 竞品 2: Apple Reminders (系统级快速添加)

**做法**:
- Cmd+Space → Spotlight → 输入 "提醒 xxx" → 回车 → 自动创建事项
- 或 Widget 点 + → 快速添加

**好的设计**:
- Spotlight 输入 = 自然语言 → 自动解析时间/分类
- 不打断当前 App

**Jianxi 可借鉴**: Spotlight 风格的极简 + 自然语言增强 (未来 P2)

### 竞品 3: Drafts (Mac/iOS 专业文本处理)

**做法**:
- 打开即写，每秒自动保存
- 无限的 Action → 提交到任何 App
- 多个 Workspace 管理

**好的设计**:
- Drafts 是 "inbox"，不是 "folder"。打开即写 → 不思考 "放哪里"
- Barrel roll: 做任何操作都在一个窗口内完成
- 提示音 + 触觉反馈 = 仪式感

**Jianxi 可借鉴**:
- Inbox-first mentality
- Drafts 的 "新 = Cmd+N (保存当前 + 新建)" → 我们已在用
- 触觉反馈 — 可以考虑添加 (MacBook 有 Taptic Engine)

**Drafts 比我们好的**: 跨平台同步 (iCloud)、Action 生态

### 竞品 4: Google Keep

**做法**:
- 4 色分类 + tags
- 卡片 UI，无限滚动

**不好的**:
- 打开太快 → 没 "仪式感" (Jianxi 的 **护城河**)
- 广告 + 生态陷阱

**Jianxi 的反面教材**: 我们要做的是 "quiet tool"，不是 "engagement machine"

### 竞品 5: Simplenote / Bear

Simplenote - 纯文本极简。Bear - Markdown 美感。

**Bear 的 "Quick Capture"**:
- Cmd+Option+S → 弹出小窗，直接打字
- 自动保存 → 与 Bear 笔记列表实时同步
- 关闭 → 无缝回到 Bear

**我们比 Bear 好的**:
- Jianxi 的 prefix 语义 (. / - / ! / ?) 比 Bear 的 tags 更轻量
- Jianxi 可以 pin 到桌面边缘，Bear 的不行

### Jianxi v5 的差异化优势

| 功能 | Apple Notes | Drafts | Jianxi v5 |
|------|------------|--------|-----------|
| 多行 textarea 初始高度 | 低 (2行) | 高 | 自适应 (1→6 行) |
| 保存触发 | Cmd+S / 自动 | 实时 | Cmd+Enter (显式) |
| 快速捕获 | ✓ (上滑) | ✓ | ✓ (Cmd+Shift+.) |
| prefix 语义系统 | ✗ | ✗ | ✓ (.-!?) |
| 胶囊 popover | ✗ | ✗ | ✓ (看 buffer) |
| pin + 边缘停靠 | ✗ | ✗ | ✓ |
| Double-Enter 重置 | ✗ | ✗ | ✓ |
| 历史键盘导航 | ✗ | ✗ | ✓ (↑↓ + Enter) |
| 关闭零数据丢失 | ✓ | ✓ | ✓ (关闭静默写入) |
| 单 App 集成 | ✓ | ✓ | ✓ (嵌入 Jianxi) |

**Jianji v5 的劣势** (需要改进):
- 无自然语言解析 (Drafts 有)
- 无 Action 链 (Drafts/EagleFiler 有)
- 无 Android/Windows (目前)

---

## 八、评价体系（核心新增）

> 印哥要的是 "客观衡量标准"，不是 "我觉得不错"。

### 8.1 五个评价维度 + 测量方法

**维度 1: 念头到录入的延迟 (Capture Latency)**

- **定义**: 从念头产生到可以开始输入的时间
- **测量**: 按键→第一字上屏 的毫秒数（高速摄影或 JS 计时）
- **标准**: P50 < 500ms / P90 < 1500ms（包括窗口出现 + textarea focus）
- **恶化因素**: 冷启动慢 / 弹入动画过长 / autofocus 失败回退

**维度 2: 单次录入操作数 (Actions per Capture)**

- **定义**: 完成一次想法记录需要的手部操作数
- **测量**: 数鼠标点击次数 + 键盘按键次数
- **标准**: 3 次以内 (Cmd+Shift+. + 打字 + Cmd+Enter)。达标 = 无额外点击
- **恶化因素**: 需要点击 hover 按钮 / 需要保存按钮 / 需要历史先清空

**维度 3: 误操作率 (False Activation Rate)**

- **定义**: 想保留但丢失 / 想关闭但意外提交 的频率
- **测量**: self-report 1周使用中的误操作次数
- **标准**: < 1次/天 为良好 / < 1次/周 为优秀
- **恶化因素**: Esc 关闭但 buffer 丢失 / 单击按钮误关闭 / 双击误 min

**维度 4: 窗口发现力 (Window Discoverability)**

- **定义**: 用户一次想找这个窗口时，能不能 5 秒内找到
- **测量**: 用户测试 "打开 Quick Capture 窗口并输入 foo"，眼睛不看 Help 文档
- **标准**: > 90% 用户 5 秒内成功
- **恶化因素**: 按钮太小 / hover 才出现 / 位置被其他窗口遮挡

**维度 5: 恢复摩擦 (Return Friction)**

- **定义**: 回到之前任务的成本
- **测量**: 关闭 overlay 后，重新到达 "之前工作状态" 的时间（秒）
- **标准**: < 1.5s（窗口关闭 + 键盘焦点回到之前的输入框）
- **恶化因素**: 关闭 overlay 触发主窗口 scroll / 关闭后历史记录弹窗 / 关闭后窗口最小化到 docker

### 8.2 完整评判清单

印哥在 v5 设计确认前，需要每一项打 ✅ 或 ❌：

念头到录入链:

- [x] Cmd+Shift+. 窗口弹入动画 < 300ms ✅ 2026-07-14
- [x] P90 环境（多屏+热键冲突 时 fallback 可用） ✅ 2026-07-14
- [x] textarea autofocus 成功 (否则 > 2s 恢复成本) ✅ 2026-07-14
- [x] 窗口层级始终覆盖其他 App（pin 模式） ✅ 2026-07-14

录入流程:

- [x] Enter 在任何情况都能换行（Tab != 提交） ✅ 2026-07-14
- [ ] Cmd+Enter 在任何情况都能提交
- [x] 误触 Cmd+Enter 时（未输入实质内容）走 Double-Enter 路径 ✅ 2026-07-14
- [x] prefix 识别准确 (空 . . 和 中 . . 都不误识别) ✅ 2026-07-14
- [x] Cmd+N = save current + new，不是 discard ✅ 2026-07-14

历史处理:

- [x] ↑↓ 导航至 history items 顺畅 ✅ 2026-07-14
- [ ] Enter archive 后立即有 "已归档 · [撤销]" prompt
- [ ] 撤销可达 (5s 内 + 视觉明显)
- [x] 历史分组 (今天/昨天/日期) 不滚外溢 ✅ 2026-07-14
- [x] "显示更早的 20 条" 按钮位置可达 ✅ 2026-07-14

胶囊状态:

- [x] 胶囊可见且 44x44 足够触屏 ✅ 2026-07-14
- [x] 单击 preview popover 280x360 可读 ✅ 2026-07-14
- [x] 双击恢复窗口 < 300ms ✅ 2026-07-14
- [x] 拖拽胶囊不误关窗口 ✅ 2026-07-14
- [x] 停靠四角后不超出屏幕边界 ✅ 2026-07-14

顶栏与拖拽:

- [x] top bar 44px 至少有 30px 拖拽区域 (可达性) ✅ 2026-07-14
- [x] 双击 min 时无拖拽冲突评测 ✅ 2026-07-14
- [x] pin 模式下 Cmd+Shift+/. 仍可达 ✅ 2026-07-14
- [x] 鼠标移过顶栏区域时 grab cursor 正确显示 ✅ 2026-07-14

数据完整性:

- [ ] Cmd+Enter commit 即时 (success 时间 < 200ms on 本地 NVMe)
- [x] 关闭 overlay 时未提交 buffer 写 localStorage 兜底 ✅ 2026-07-14
- [x] 主窗口关后 overlay 关时 buffer 也写兜底 ✅ 2026-07-14
- [x] 多 overlay 不碰撞 (single-instance 检查) ✅ 2026-07-14

性能:

- [x] 窗口冷启动 < 200ms (overlay 主进程已存在) ✅ 2026-07-14
- [x] 历史 100 条时渲染 < 50ms ✅ 2026-07-14
- [x] 切换 overlay 状态 (min/pin/restore) 无掉帧 (< 16ms) ✅ 2026-07-14
- [x] 内存占用: overlay 关闭时内存释放 (无 leak) ✅ 2026-07-14

---

## 九、与旧版本对比表

| 维度 | v3.1 (翻车) | v4.1 (碰撞后) | v5 (本期) |
|------|------------|---------------|----------|
| 输入框 | 单行 input | textarea (多行) | textarea (多行) ✓ |
| 回车 | Enter = 提交 | Cmd+Enter = 提交 | Cmd+Enter = 提交 ✓ |
| prefix hints | 有 (8项乱占) | 删除 → 隐蔽 | 删除 → 隐蔽 ✓ |
| 自动保存 | 无 | 无 | 关闭时 buffer 兜底写 ✓ |
| 新建 | 按钮 | Cmd+N | Cmd+N + ⊕ fallback ✓ |
| 拖拽区域 | drag dot (4px) | 全栏 44px | 全栏 44px ✓ |
| 最小化 | ⊟ 按钮 | dblclick bar | dblclick bar + 守卫 ✓ |
| 胶囊 popover | 单击恢复 | 单击 popover | 单击 popover + tooltip ✓ |
| 顶栏数字 | 重复计数 | 顶栏一处 | 仅 pin 模式一处 ✓ |
| 窗口结构 | 主窗口 overlay | 主窗口 overlay | **独立子窗口** ✓ |
| 键盘覆盖 | 缺 Esc/↑↓ | 完整 | 完整 + IME 防护 ✓ |
| 误操作保护 | 4s undo | 显式关闭确认 | 关闭 buffer 兜底 + 200ms 守卫 ✓ |
| 历史导航 | hover click | Enter/↑↓ | Enter/↑↓ + 实时高亮 ✓ |
| 评价体系 | 无 | 无 | **5 维度 + 完整清单** ✓ |

---

## 十、待印哥确认 (C1–C4 + C5)

- **C1**: 新建 = Cmd+N + 输入框 ⊕ fallback *(推荐)*
- **C2**: 顶部数字 → 仅 pin 模式显示 *(减少噪声)*
- **C3**: Cmd+N 仅 overlay 内 *(主窗口 Cmd+N 不变)*
- **C4**: capsule popover 显示 buffer + 最新 3 条 history *(只读)*
- **C5**: 主窗口关闭时 overlay 窗口是否也关闭? *(推荐: 独立行为 — overlay 可以不随主窗口关)*

注: C1–C3 与 v4.1 相同，新增 C5 是因为本 version 改成了独立子窗口。

---

## 十一、实施拆分

Phase A1 (前端主逻辑):
- textarea + Cmd+Enter + Cmd+N + Double-Enter reset
- 全栏拖拽 + dblclick minimize
- capsule popover preview + state machine
- keyboard: Esc / ↑↓ / Enter / Tab (IME 防护)
- focus trap + 关闭时 buffer 兜底

Phase A2 (显示细节):
- prefix placeholder 切换
- history 分组 + "显示更多" + 折叠
- archive inline [撤销] prompt
- tooltip hover on capsule

Phase B (独立窗口):
- Tauri 多窗口 setup (capture-overlay.html)
- 主↔子窗口 IPC 通信

Phase C (Rust I/O):
- append_inbox (写 inbox-YYYY-MM-DD.md + frontmatter)
- load_history_date_range (读取历史)
- (保留) localStorage 崩溃恢复无需 Rust

Phase D (performance polish):
- textarea transition
- capsule scale transition
- popover fade-in < 200ms
- reduced-motion 检查

---

// ponytail: v5 = v4.1 + 独立子窗口 + 完整评价体系 + 误操作保护 + 竞品对标 + 深入分析。设计文档已可过 Checklist 8.2。
