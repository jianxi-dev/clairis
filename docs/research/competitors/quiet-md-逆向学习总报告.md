---
title: "quiet-md-逆向学习总报告"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 逆向学习总报告 —— 15 项需求逐项诊断与行动路线

> 2026-11-22。对照对象：Quiet.md（s1dashu/quiet-md，MIT 开源，Rust + GPUI，~90k 行）。
> 侦察底稿（6 份域报告 + 总览）在本目录 `quiet-md/` 下，每条结论都带 quiet-md 与 clairis 的 `文件:行号` 双向证据：
>
> | 底稿 | 覆盖需求项 |
> |---|---|
> | `quiet-md/00-overview.md` | 架构 / 存储 / undo / 可靠性总览 |
> | `quiet-md/editor-core.md` | ① 手柄 ② 输入稳定 ③ 恢复 |
> | `quiet-md/layout-lists.md` | ④ 分栏 ⑩ 列表嵌套 |
> | `quiet-md/tables.md` | ⑥ 表格 |
> | `quiet-md/media-board.md` | ⑤ 高亮 ⑦ 嵌入文件 ⑨ 图片裁剪 ⑪ 画板 |
> | `quiet-md/widgets-refs-math.md` | ⑧ 引用/反链 ⑫ 倒计时/提醒 ⑬ 公式 |
> | `quiet-md/home-theme-menu.md` | ⑭ 首页宫格 ⑮ 主题/菜单 |

## 0. 先说三个定性结论

1. **「反编译」实为源码级学习**：Quiet.md 是 MIT 开源的 Rust + GPUI 原生应用，无混淆无打包，全部机制可直接读到源码（含作者自写的 `docs/ARCHITECTURE.md` / `docs/FORMAT.md`）。
2. **丝滑的根因是架构，不是调参**：Quiet 的文档真相是**内存块树**（DocxXML 落盘，Markdown 只是导入/导出），渲染是树的单向投影，undo 是整树快照，结构编辑全部过单一 Core 并有随机 fuzzer 验证 9 条不变量。Clairis 的真相是 Markdown 明文，"块"是 Lezer 树现算视图，结构操作全是文本手术 + 28 个装饰模块双轨渲染。**15 项问题里有 9 项的共同根源是"双真相源/双渲染轨道"**——短期可堵漏，根治需把分栏/嵌套/表格升级为块结构模型（`crates/core` 是一个无 GUI、可单测可 fuzz 的现成参考实现）。
3. **交互参数层几乎全部可移植**：手柄 hit 带 60px、拖拽启动 2px、undo 合并 700ms、保存防抖 500ms+2s 截止、版本快照 5 分钟/份等——这些与 UI 框架无关，抄了就有效。

## 1. 15 项需求逐项裁定（结论 → 详见底稿）

| # | 需求 | 一句话结论 | 关键 quiet-md 证据 |
|---|---|---|---|
| 1 | 手柄 | **可修，不必重构**：我们的手柄是 docChanged 全量重建 DOM + coordsAtPos 三层 fallback，位置不精/闪跳都源于此；Quiet 的手柄与块同帧布局（永不漂移）、20 种块型图标表、空段即"+"、末尾常驻空段 | `editor-core.md` §4/§8.1 |
| 2 | 输入稳定 | **两大病灶**：① 每键 `doc.toString()` 全文进 Zustand → 全组件重渲染（卡顿）；② store→CM 全文重放带 `addToHistory.of(false)` + 旧闭包竞态（内容丢失/格式错乱/崩溃） | `editor-core.md` §8.2，`ContentArea.tsx:600-608,736-757` |
| 3 | 恢复 | **undo 被三类旁路破坏**：切页签 reconfigure 清历史、程序性回灌不进历史、程序 dispatch 缺 userEvent 分组；另有 `Mod-[` 误绑 undo | `editor-core.md` §8.3，`setup.ts:93-94` |
| 4 | 分栏 | **架构级**：现状是"围栏 div + replace widget + 独立 textarea"——重复显示=双活双真相源，格式错乱=逐行 DOM 孪生只认 3 种块；根治=块树 + 真实 CM6 区间 | `layout-lists.md` §3 |
| 5 | 高亮 | **功能缺失而非效果不同**：全仓无文字高亮；Quiet = Marks.bg_color + 7 色×2 行 16 档面板 + A 键记忆 + 行高矩形渲染；Clairis 可用 `==text==` 语法落地，比 Quiet 的"MD 导出丢高亮"更完整 | `media-board.md` §1/§5.1 |
| 6 | 表格 | **最大功能缺口=合并单元格**；建议路线：纯 TS `TableGrid`（covered-slot + repair，抄 `table_ops.rs`）→ pipe/HTML 双格式（合并格走 HTML `<table>` 序列化）→ 列宽拖拽/行列移动/cell 富文本/吸顶横滚/结构化复制 | `tables.md` §7 |
| 7 | 嵌入文件 | 补"附件卡"形态（类型图标 11 类 + 大小 + 系统打开）+ `<audio controls>` 内嵌播放（WebView 里比 Quiet 还便宜）；是否"复制入库"另议 | `media-board.md` §2/§5.2 |
| 8 | 引用/反链 | **完全缺失**： Quiet 关键设计=引用键是稳定 id（渲染查活标题，重命名零传播）+ 保存时提取进库级索引（反链查询不开文件）+ 尾部双 tab 卡片；Clairis 第一版可用 `[[id\|title]]` 文本+装饰实现 | `widgets-refs-math.md` §1/§5.1-5.2 |
| 9 | 图片裁剪 | **找到根因**：① `object-fit:none` 与 scale 偏移坐标系错位（显示随机的直接来源）；② mount 时 img 未 load（scale≤0 静默失败）；③ 保存依赖 frame 上的 pointerup，装饰重建销毁 frame 后丢失（裁不成功）；④ crop 存原图像素、显示存另一套坐标，双重错位 | `media-board.md` §3/§5.3，`imageCrop.ts:137-149,226-247` |
| 10 | 列表嵌套 | 病灶：`indentLen/2` 封顶 3 层、Tab 宽度与分层规则不一致、编号是源码字面量不重算、空项退出不分"退层/退列表"、编辑态 2 空格约定 vs 预览 CommonMark 不一致 | `layout-lists.md` §3 问题 10 |
| 11 | 画板 | **域缺失**（2.6 万行不可直接抄）；现实路线：短期嵌入 `.excalidraw` 文件静态渲染（`@excalidraw/utils` exportToSvg），中期按 Quiet 分层（纯函数模型 + canvas 自绘 + Gesture 指针派发） | `media-board.md` §4/§5.4 |
| 12 | 倒计时/提醒 | **完全缺失**；三个模式可整体移植：创建即配置、值域锚定（绝对时刻）、节能 tick（只刷可见块）；提醒用 `tauri-plugin-notification` + 15s 轮询即可复刻 | `widgets-refs-math.md` §2-3/§5.3 |
| 13 | 公式 | **渲染内核本仓更强**（官方 KaTeX 全量 CSS vs Quiet 自研 900 行子集）；Quiet 强在四件编辑体验：点击式源码浮层（实时预览）、键入 `$…$` 自动转换、display 判定启发式（含 `\begin{align}`）、无效/空公式占位——四件都能低成本移植 | `widgets-refs-math.md` §4/§5.4 |
| 14 | 首页宫格 | 现状 4 列写死；Quiet=按宽度动态列数（目标 240px）+ 卡片 5:6 定比 + **文件夹实体卡（三层真纸 + hover 弹簧浮出）** + 结构感知缩略图（真块树裁剪重渲染）；本仓最小版 FolderTile 用 CSS transform 即可 | `home-theme-menu.md` §1/§6.1-6.3 |
| 15 | 主题/菜单 | 菜单规格对齐成本低收益明确（行高 32/r6/阴影 token/快捷键列/键盘 hover 同步）；主题借 OKLab 亮度镜像（一份亮色生成暗色）+ 5 档具名阴影 token；菜单出现**不加动画**是 Quiet 的实证选择 | `home-theme-menu.md` §2-4/§6.5-6.7 |

## 2. 全局病灶 TOP 5（跨 15 项的公共根因）

1. **每键全文同步链**（`ContentArea.tsx:600-608` updateListener → `updateTabContent` 全量替换 → 所有订阅组件重渲染）：卡顿主源，也放大了 4/9/10 的所有偏移失效问题。
2. **store→CM 全文重放**（`ContentArea.tsx:736-757`，`addToHistory.of(false)`）：内容丢失且撤不回的最可疑机制；两面板同开同 tab 时互相回灌。
3. **结构操作 = 正则文本手术 + 28 个装饰模块双轨**：格式错乱的根源；Quiet 对应物是 Core 单点写入 + normalize + fix_selection + fuzzer。
4. **程序性 dispatch 无 undo 语义约定**：切页签清历史、全文替换不进历史、缺 userEvent 分组——恢复失效的三类旁路。
5. **无不变量机检**：Quiet 敢说稳定靠 fuzzer 天天打（undo 全还原、存读回环、选区合法等 9 条）。Clairis 的 `src/__tests__/` 只有 store 测试，编辑器层零不变量测试——**这是最高性价比的一条补强**。

## 3. 行动路线（按性价比排序）

### 3.1 实施批次建议（推荐的先后顺序）

按「先稳地基 → 再补功能 → 最后动结构」分 6 批；每批内顺序即依赖关系。除批次 1 的止血外，涉及需求/功能的均先 `/opsx-propose` 建 change；触及配置面/色板/菜单的（高亮色板、FolderTile、菜单规格）另需数据面六栏表。按 2026-11-01 裁定，G4 收口后自动接力下一张票。

**批次 1：地基加固**（最优先，小 diff、不动模型，可合为一个 change 快速闭环）
1. 切断每键全文同步链（store 节流 + dirty 标记）——卡顿根因，也是后续手柄/分栏/裁剪所有「偏移失效」类 bug 的放大器，必须最先做。
2. store→编辑器同步改为显式命令 + 最小 diff——内容丢失、撤不回的直接根因。
3. undo 链自检测试——紧跟 1、2 建：守护本批改动，也守护之后每一批（Quiet 敢说稳定靠 fuzzer 天天打）。
4. 历史边界三原则 + 移除 `Mod-[`/`Mod-]` 误绑（`setup.ts:93-94`）——code review 规则 + 一行改动，顺手收掉。

**批次 2：交互止血**（用户每天都摸到的地方）
5. 手柄改造（增量对账 + 行盒定位 + 图标表 + 末尾虚拟空行）——①；批次 1 已消除其重建竞态。
6. 图片裁剪三修——⑨，根因已定位到行号，最明确的「修一个少一个」。
7. 列表 Tab/回车/编号三修——⑩，纯 keymap/decoration 层。
8. 分栏止血两件（stale 防护 + 编辑期间冻结重建）——④的止血，不是根治；根治在批次 5。

**批次 3：低成本新功能**（独立、低风险，可并行拆票）
9. 文字高亮（⑤）——完全缺失，`==text==` + 16 档面板，成本中收益高。
10. 公式编辑体验四件套（⑬）——渲染内核本仓已更强，只补浮层/自动转换/占位。
11. 附件卡 + 音频播放（⑦）——约 200 行。
12. 菜单/宫格/主题顺手票（⑭⑮低成本部分：行高 32、hover 环、响应式列数、阴影 token 收敛）。

**批次 4：引用体系与小组件**
13. mention + backlink（⑧）——缺口最大但依赖面广（`[[id\|title]]`、补全面板、保存时索引、尾部卡片），独占一个 change。
14. 日期提醒 → 倒计时（⑫）——提醒先行（四字段模型 + 系统通知），倒计时其次。

**批次 5：结构升级**（立项级，Quiet 证明过的路线）
15. TableGrid 纯函数模块先行（⑥前半）——covered-slot + repair + vitest 表驱动，不碰 UI 可测试；然后合并单元格（HTML 序列化分支）、列宽拖拽。
16. 分栏块树化（④根治）+ 嵌套列表结构化——真正的架构手术，放在批次 1 的 dispatch 收口、undo 自检全部稳固之后。

**批次 6：远期**
17. 嵌入 `.excalidraw` 静态渲染 → 评估画板自研（⑪）；用户 CSS 主题、表格富文本单元格、目录布局参与者。

> **若只批一件事**：先批批次 1——不解决任何「新功能」，但它是②（输入崩溃）和③（恢复失效）两个最伤信任问题的直接解药，且批次 5 的结构手术没有它必翻车。

### 3.2 分级清单（原 P0/P1/P2，与 3.1 批次的对应：P0≈批次 1+2，P1≈批次 3+4，P2≈批次 5+6）

### P0 止血（现有架构内，不动模型，多为小 diff）
1. 切断每键全文同步：store 只存节流快照（300ms 防抖 + 2s 截止，抄 Quiet `SAVE_DELAY/SAVE_MAX_DELAY` 语义）+ dirty 标记（#2 卡顿）。
2. store→CM 同步改"仅初始化 + 显式命令"：最小 diff、允许 undo（isolateHistory 分组）、校验 view 归属（#2 丢失 / #3 恢复）。
3. 历史边界三原则落地：用户可感知变更必带 userEvent；程序回灌不进历史但打断分组；结构命令每意图一个 isolateHistory 组。移除 `Mod-[`/`Mod-]` 的 undo 误绑（`setup.ts:93-94`）。
4. 手柄改造：docChanged 全量重建 → 增量对账；定位改为行盒内元素（消灭 coordsAtPos fallback 三层）；图标表接 `block-model.ts` 已有的 `level`/Lezer 节点名；末尾虚拟空行手柄协议；hit 带 = 左缘外 60px ∪ 整块（#1）。
5. 图片裁剪三修：统一"外盒 overflow:hidden + 内图整图缩放平移"结构；mount 前等 `img.complete`；保存按钮 + pointerup 挂 window（#9）。
6. 列表：Tab/Shift-Tab 列表感知缩进；`smartEnter` 空项三态退出；depth 上限 3→6；编号改计算型 widget（#10）。
7. 分栏止血：commit 加 stale 内容匹配防护；编辑器打开期间冻结 widget 重建（#4 止血部分）。
8. undo 链自检测试：随机"输入/删除/拖拽/转换/切页签/回灌"序列后断言 undo 全还原（对齐 Quiet fuzzer 思想，#3 的长期防线）。

### P1 功能补齐（独立 change，走 OpenSpec）
9. 文字高亮：`==text==` marked extension + CM6 decoration + 16 档面板（抄 palette.rs 色值）+ floating-toolbar A▾ 按钮（#5）。
10. mention/backlink：`[[id|title]]` + CM6 autocomplete @ 面板 + 保存时索引 + 尾部双 tab 卡片（#8）。
11. 提醒小组件（先行）：`InlineReminder` 四字段模型 + chip 装饰 + `tauri-plugin-notification` 轮询（#12）。
12. 公式编辑体验四件套：源码浮层、键入自动转换、display 启发式、占位态（#13）。
13. 嵌入文件附件卡 + `<audio controls>`（#7）。
14. TableGrid 纯函数模块 + 合并单元格（HTML 表序列化分支）+ 列宽拖拽（#6 前半）。
15. 菜单/宫格/主题打磨批：菜单规格、hover 环、响应式列数、阴影 token 收敛、OKLab 暗色镜像脚本（#14/#15 的低成本部分）。

### P2 结构升级（立项级，Quiet 证明过的路线）
16. 分栏 → 块树 + 真实 CM6 区间（#4 根治；空栏溶解/比例归一 normalize 照抄，<30 行）。
17. 表格 cell 富文本（嵌入式编辑器）+ 行列移动 + 吸顶横滚 + 结构化复制三格式（#6 后半）。
18. 倒计时块 + 目录布局参与者 + 用户 CSS 主题 + live reload（#12 后半/#15 远期）。
19. 画板：先嵌入 `.excalidraw` 静态渲染，再评估分层自研（#11）。

## 4. 关键交互参数速查（实现时直接引用，出处见底稿）

| 参数 | Quiet 值 | 用途 |
|---|---|---|
| 手柄 hit 带 | 块左缘外 60px × 整块高，最内层块胜出 | #1 |
| 手柄尺寸/退让 | 42×26（add 28×26）r6；基准 -48px，可折叠 -14，Quote 子块再 -14 | #1 |
| 打字隐手柄 | 编辑瞬间藏、指针一动即显（零延迟） | #1 |
| 块间点击插入 | REACH 16px / SLOP 10px | #1 |
| 拖拽启动/松手 | 2px / >10px；成功后闪烁 2s；FirstChild 需过块左缘 36px | #1 |
| undo 合并 | 700ms 滑动窗口同块同 kind；Other 永不合并；500 步/256MB/保底 20 | #2/#3 |
| 保存 | 500ms 防抖 + 2s 截止 | #2 |
| 版本快照 | 5 分钟/份、1-30 份/文档、库 200MiB、恢复前强制快照 | #3 |
| 嵌套深度上限 | 16（缩进与拖拽同限） | #10 |
| 裁剪 | 分数存储 0..1；MIN 选区 32px；Shift 锁比 | #9 |
| 列宽拖拽 | 10px 热区（border−7..+3）、MIN 50px、释放才 checkpoint | #6 |
| 表格吸顶 | 26px 偏移、首行禁跨行合并 | #6 |
| 菜单 | 面板 r12/行 r6/行高 32/内距 6/行 inset 5；hover=黑 4.5%；出现无动画 | #15 |
| 首页宫格 | 目标列宽 240px（窄屏 160）、卡片 5:6、gap 混合 24/纯 16 | #14 |
| 弹簧 | 上浮 (320,21)、跟随 (230,18)/(170,15.5)、按下 dip 回弹 200ms | #14/#15 |
| 提醒 | 全天=当日 23:59:59；15s 轮询；启动不补发 | #12 |

## 5. 方法说明与局限

- 6 个并行研究员直接读源码产出，每条结论带双向 `文件:行号`；汇总前我复核了架构文档与全部 6 份报告的 Clairis 诊断章。
- 未做运行时验证（未启动 Quiet.md 实测手感）——交互参数引自源码常量，实际手感以对照验收为准（AGENTS.md：UI 修复必须真实跑）。
- Quiet 的块树架构不可整体移植到 CM6；本报告刻意区分了「可直接抄」（参数/协议/纯函数模块）与「需改造落地」（交互模式）。
