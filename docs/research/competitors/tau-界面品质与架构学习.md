---
title: "Tau（editor-master）界面品质与架构学习报告"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-24
---

# Tau 界面品质与架构学习报告 —— 品质是生产线的产物，不是审美

> 2026-11-24。对照对象：Tau（`/Users/mason/ToHighs/AI-doc/竞品分析学习/editor-master`，pnpm monorepo，~153 MB，桌面 Electron + 移动 Tauri）。
> 每一条结论都带 tau 侧与 clairis 侧的 `文件:行号` 或章节号双向证据。本文是调研结论，不构成设计决定；被采纳的结论须迁入 `docs/design/` 并走 OpenSpec 闭环。

## 0. 三个定性结论

1. **Tau 的"有品质"是工业化生产线，不是配色好。** 它有五层机制：token 契约（型别强制）→ 组件层（52 个原语、15643 行）→ 交互规范（12 KB 级逐条定案）→ 样板间（31 份组件档案，LIVE 标本 + 状态矩阵）→ 门禁与台账（对比度 AA 机检、退役 token 防回流、裁决台账）。**每一层都让"随手写一个样式"变得比"用现成的"更贵。**
2. **C 本仓缺的不是设计感，是约束机制。** 实测：`src/styles/*.css` 8526 行里有 **1325 个 px 字面量（86 种不同取值）**、**469 处 hex 颜色（288 种不同色值）**、204 处 `rgba()`；按钮样式分裂成 5 套互不相干的类（`.dpb-tpl-btn` / `.dpb-ops-btn` / `.search-float-replace-btn` / `.cm-toolbar-btn` / `.capsule-btn`）；`src/ui/` 只有一个 `icons.ts`，**没有 Button / Input / Menu / Tooltip 任何基础件**。视觉一致性靠人肉 review，必然漂移。
3. **可移植的是机制与参数，不可移植的是工程量。** Tau 的桌面是 Electron + React 19.2（Activity 保活）+ Tailwind v4 单轨制，本仓是 Tauri + React 18 + 8526 行手写 CSS —— 迁移成本不对称。但**它的移动端就是 Tauri**（`@tauri-apps/api ^2.11.1`）且消费同一套 `@tau/ui` + `@tau/themes`，说明这套颜色/组件机制在 Tauri 里已验证可行。抄机制、抄数值、抄纪律；不抄框架迁移、不抄 15K 行规模。

---

## 1. Tau 速写

### 1.1 技术栈


| 层 | Tau 桌面 | Tau 移动 | 本仓（Biaoyue） |
| --- | --- | --- | --- |
| 壳 | Electron + electron-builder | Tauri 2 | Tauri 2 |
| UI | React 19.2.0 + Tailwind v4（`@tailwindcss/oxide 4.1.17`） | 同左 + `motion 12` | React 18.3 + 手写 CSS（8526 行）+ `@tailwindcss/typography` 仅用于阅读区 |
| 状态 | zustand 4 + `@tanstack/react-query` | zustand 4 + react-query | zustand 5 |
| 编辑器 | Slate 0.126 + slate-react + Yjs 13.6 + hocuspocus | 同左 | CodeMirror 6 |
| 文档 | SQLite（better-sqlite3）+ sqlite-vec + 自研 db-schema 包 | 同左 | Rust 后端 + 明文 Markdown |
| 图标 | **lucide-react 0.399**（674 处 import），多色用 react-icons | lucide 0.468 + `@phosphor-icons/react` | 自绘 123 键 path 表（`src/ui/icons.ts` 786 行） |
| 校验 | oxlint + oxfmt + knip + 自制 check 脚本（whitespace/边界/文档死链） | 同左 | tsc + eslint + vitest + css-manifest-check |

### 1.2 声明式四协议（比组件本身更值得学）

> [!SUCCESS]{bg=orange border=yellow}
> Tau 把"新增一个东西"变成"加一个文件"，登记表不存在：

| 协议 | 落点 | 机制 |
| --- | --- | --- |
| `definePage` | `features/**/pages/*.page.tsx` | Vite glob 自动注册，33 个页面零登记表；`match: "single"` / `"params"` 决定单例还是多实例（详情页按 `getId` 去重） |
| `defineTheme` | `packages/themes/src/themes/*.theme.ts` | 一个文件 = 一个主题族 × 明暗两套；`tokens(p)` 返回全键 `SemanticTokens`，**漏一个键编译不过** |
| `defineAssistView` | `features/<域>/assist/*.assist.tsx` | 右侧辅助栏视图，`src/assist-views.ts` glob 收集；带 `keepAlive` / `hiddenOn` |
| `defineDatabaseExtension` | `@tau/database` 扩展点 | 字段插件 / 视图 / 聚合算子 / 命令统一装配，id 重复即报错 |

关键共性：**注册是副作用，清单是 derive 出来的**。重复注册策略统一为 "dev 覆盖 + warn（HMR 兼容）/ prod 抛错（真冲突）"（`packages/themes/src/defineTheme.ts:69-77`）。

### 1.3 功能盘点（对本仓有意义的）

| 域 | 规模（文件数） | 对本仓的价值 |
| --- | --- | --- |
| 卡片 / 文章 / 项目文档 | 40 / 15 / 53 | 三种正文载体的分层，但本仓以"文件"为中心，**不建议抄** |
| 闪卡复习 | 74 | 间隔重复（遗忘曲线）是纯功能，可作后续需求 |
| 白板 | 26 | 有独立设计系统从属（手绘字体栈 `--tau-font-hand`），域太重 |
| 数据库（四视图） | — | 表格/看板/画廊/日历四视图 + 字段插件，远超本仓 |
| 知识地图 / 漫步 | 17 / 17 | 双链 + 随机重温，本仓有 frontmatter 基础 |
| PDF / 视频笔记 | 45 | 本仓已有 PDF/视频，可参考"页面作用域对话" |
| 插件体系（34 个官方插件） | 67 | 完整 SDK + 清单 + 权限闸门，工程量大 |
| AI（管家 / 洞见 / 创作） | 38 | pi 会话为真相源，sqlite 只存目录 |

**结论：功能层面不建议对标**，本仓定位是 Markdown 阅读/编辑器，抄功能会失焦。真正值得学的是 §2 的界面生产线。

---

## 2. 品质的五个机制层

### L1 token 契约：词汇表是唯一事实源，且被类型系统强制

**Tau 做法**（`packages/themes/src/tokenContract.ts`，51 行）：

- 45 个语义词汇分 9 组：surface / control / interaction / ink / line / accent / status / tag / float / backdrop。
- 同一个常量产出三样：TS 类型 `SemanticTokens`（全键 Required）、CSS 变量名 `--tau-*`、Tailwind `@theme inline` 映射依据。
- 主题作者写 `tokens: p => ({...})`，**漏一个键编译不过**（"狂野补丁"从机制上绝迹）。
- 派生关系显式化：`accent-hover` 写成 `hsl(hue, sat, light-7%)` 的函数，而不是藏在 CSS `calc()` 里。
- **表面阶梯铁律**（`docs/architecture/design-system.md` §2.6）：`surface > page > sunken`，相邻档 WCAG 对比度 **≥ 1.10**，用比值而不是亮度差——深浅主题同一把尺。
- **对比度门禁**（§2.5）：`ink-1` 对 page/surface ≥ **7:1**，`ink-2` / 占位 / meta ≥ **4.5:1**，accent 作文字 ≥ 4.5:1；`theme-parity.test.ts` 逐主题族 × 明暗断言，不过 AA 构建失败。
- **退役防回流**：`retired-tokens.test.ts` 扫源码，防止被删的 `bg-group` 之类的 token 复活。

**本仓现状**：`src/styles/tokens.css` 254 行有三套主题（`:root` / `.dark` / `.warm`），语义层大约 30 个变量（`--app-accent` `tokens.css:21`、`--app-bg:24`、`--app-surface:25`、`--app-text-3:32`、`--radius-4:45`…），但**没有全键约束、没有对比度断言、没有退役扫描**；`var(--app-*)` 使用 110/106/79/64/60 次，同时 288 种 hex 直接写在 CSS 与组件里。

**裁定**：这是本仓**最高性价比**的一层。不需要 Tailwind、不需要 codegen —— 一个 `src/styles/tokens.ts` 词汇常量 + 一个 40 行的 `scripts/check-tokens.mjs`（禁止组件层新增 hex/rgba、清单对账、AA 对比度计算）就能拿到 80% 的收益。

### L2 组件层：52 个原语，单个组件投入 500-750 行

**Tau 做法**：

- 分层明确且不可越界：`ui/primitives/`（不知业务）→ `ui/patterns/`（不知具体域）→ `features/<域>/components/`（域内）。
- 单件投入极大：`Menu.tsx` 757 行、`Select.tsx` 513 行、`DatePicker.tsx` 459 行、`Dialog.tsx` 388 行。这些行数全花在**键盘 / 焦点 / 定位 / 嵌套仲裁 / 保活兜底**上，不是样式。
- **浮层底盘是共享的**：`useAnchoredPosition`（定位生命周期）+ `FloatingArrow` + `mergeRefs` + `useLayerDismiss`（外点 / 嵌套 / 互斥）+ `PortalScope`（Dialog 内局部挂载点）。Menu / Tooltip / Popover / Select / CommandPalette 全部复用同一套。
- **样式覆盖必须走 `cn()`**：`cn = twMerge(clsx(...))`，且把自定义尺度词（`text-tau-*` / `rounded-tau-*` / `shadow-card`）登记进 tailwind-merge 的 classGroup，并有 `cn.test.ts` 守护登记与 tokens.css 一致。理由写在 `packages/ui/src/cn.ts:1-12`：**Tailwind 同属性工具类的胜负由生成顺序决定，clsx 的先后顺序无效，覆盖会静默失效**。
- **每个组件都有行为契约注释**：`Button.tsx` 头部写明六变体的语义（primary 每屏至多一枚 → "层级是评审纪律，不进 API"）、loading = aria-busy + spinner + 文案切换 + 一并 disabled。

**本仓现状**：`src/components/` 69 个 tsx 平铺，业务件与"像基础件的东西"混在一起（`ContextMenu.tsx` / `TooltipLayer.tsx` / `PortalView.tsx` / `Icon.tsx` 各写各的定位与仲裁）。`TooltipLayer.tsx:26-50` 用 **DOM 探针测尺寸**（创建一个隐藏 `div.app-tip` 挂到 body、测量、移除）来算方位 —— 与 tau 的 `useAnchoredPosition` 属同代方案但更原始；`ContextMenu.tsx:23-24` 硬编码 `MENU_W = 180` / `ITEM_H`，没有 flip/shift。

**裁定**：不要一次建 52 个组件。按"重复次数"抽样排名，先做 **4 个**：Button（含 IconButton）、Menu（含 ContextMenu）、Tooltip、Input。其余等第三次重复出现再抽。

### L3 交互规范：逐条定案，而不是原则口号

**Tau 做法**（`docs/architecture/desktop/ui-interaction.md`，12 KB）：

九条 UI 铁律里每一条都是可判定的：

1. **融合骨架**：侧栏透明融于 `bg-page`；标题栏/状态栏只属右列；根底下垫极光背景层（4 团径向渐变取 `glow-1..3`，只从留白透出）。
2. **零横线**：分组靠底色容器 + 留白，**禁止用 border 分隔区块**（border 只允许 ≤2px 控件级细节）。
3. **宽度利用**：内容区 `max-w-1680`；正文阅读列 ~72ch；详情页双栏。
4. **反馈语言**：hover = `bg-hover` 淡墨；激活 = `bg-selected` + 左缘 3px accent 竖标；浮起 = `shadow-card`，hover = `shadow-lift`（40px 大模糊只给真浮层）；**按钮无描边**。
5. **圆角**：面板 16 / 控件 12 / 小元素 8。
6. **数字** `tabular-nums`。
7. **滚动条不出现系统样式**：4px 细墨条，仅"活跃"时显形（hover 滚动容器或滚动中；停止 700ms 且鼠标不在即隐藏）。且明确记下两个坑：不能用 `:hover` 伪类驱动（Chromium 滚动条伪元素不重算，显形后冻结）、细条要 `-mr/pr` 借位落进留白。
8. **className 覆盖走 `cn()`**（见 L2）。
9. **主题注册与归属**：主题只在 `@tau/themes`，业务代码禁止操作 `data-theme`。

交互定案同样细：`Esc` 只承担浮层退场（LIFO 注册表，优先于编辑上下文）而非"后退"（2026-09-20 用户裁决，理由：详情页误触即整页回退丢编辑上下文）；**后退/前进按钮"禁用而非隐藏"**（用户对"能否返回"要有稳定预期）；侧栏拖宽**跨阈值即切换展开/收起**（130 展开 / 110 收起，20px 迟滞）；`<Activity>` 保活时包装层必须 `flow-root h-full`（否则视图根 `mt-*` 会折叠出包装并撑出滚动条，有 `pageHostLayout.test.tsx` 守护）。

**本仓现状**：`docs/design/system/spec.md` 质量不低（有来源统计、有 `--dpb-*` 密度 token、有"审美判据 L3"七问），但**明确写了"不做动效规范、不做组件模式库"**（`spec.md` §8）——这恰好是被 tau 证明有效的那两层。交互层则有 `lib/overlayGate.ts`（LIFO 退场的雏形）但无文字条款。

**裁定**：不追求写 12 KB。**只把 tau 的 9 条铁律里本仓已经接近的 4 条写成条款**（零横线 / 反馈语言 / 禁用而非隐藏 / Esc 只退场），其余等对应组件出现再补。条款必须带"可判定"的表述（例如"禁 border 分隔区块，border 只允许 ≤2px 控件细节"），否则只是散文。

### L4 样板间：让规范有对照场

**Tau 做法**：`apps/desktop/src/showcase/`，31 份组件档案，`pnpm showcase` 启动。每份档案三段：

1. `DocHead`：标题（中文主 + 英文 mono 副）+ 职责一句话 + 源文件路径徽标。
2. `CanvasCard cap="LIVE"`：**真组件本体**，不是截图 —— hover / 按压 / loading 全可验（`ButtonSection.tsx:53-63` 的 loading 标本会真的走 1.4s 载入）。
3. `MatrixRow` 状态矩阵：default / hover / press / disabled / loading 逐格铺开。
4. `ApiCard`：API 表。

版心 `PAGE_COL = max-w-[740px]` 是全页唯一宽度（`kit.tsx`），演进史也写在注释里：74ch≈629 太窄、860 偏宽、"卡片满宽 + 文本列 740"两种宽度让页面像被切两截。

规则：**进 `ui/` 的组件必须带 `__tests__` + 样板间档案**（`design-system.md` §8）。这让"新增组件"有固定验收面。

**本仓现状**：无样板间。图标有 e2e 抽屉（`Icon.tsx:12` 提到"供 e2e 与图标抽屉定位"），但组件没有对照场。

**裁定**：这是**性价比第二高**的一层。本仓 Vite + React 现成，一个 `/showcase` 路由 + 4 个基件的状态矩阵，半天可完成。没有对照场，规范永远只是文字。

### L5 门禁与台账：把决定变成不遵守就红

| 机制 | tau 落点 | 拦住什么 |
| --- | --- | --- |
| 对比度 AA 断言 | `packages/themes/src/__tests__/theme-parity.test.ts` | 主题变浅导致文字不可读 |
| 数据块与声明漂移 | 同上（CSS 数据块 vs `tokens()` 产物逐值比对） | 首帧与运行时各说各话 |
| 退役 token 防回流 | `packages/themes/src/__tests__/retired-tokens.test.ts` | 删掉的 token 被复制回来 |
| 尺度词登记一致性 | `packages/ui/src/__tests__/cn.test.ts` | `cn()` 覆盖静默失效 |
| 横线/圆角/无 antd | oxlint 规则 + `check:*` 脚本 | 防腐化 |
| 裁决台账 | `docs/decisions.md`（91 行，按主题分节，一两句话/条，"规则变化原地改写，被推翻即删"） | 同一个决定被反复讨论 |

注意 tau 的测试哲学（`AGENTS.md`"测试投入规则"）：**只锁契约，不锁实现**；断言常量值 / 注册表内容 / UI 文案与类名**被明确禁止**；守护型测试必须带"扫描非空"自检；并有五种"测试退出机制"（被测对象退役、守护目标消失、已有更强版本、同一断言第三次漂移、skip 超期）。

**本仓现状**：`scripts/` 有 CSS manifest 检查（与 tau 的防腐化思路同源），但无 token / 对比度 / 图标一致性机检。

---

## 3. 图标专章

### 3.1 Tau 怎么做得"看着有品质"

- **一个库**：lucide-react，674 处 import，`navigation.ts` 里直接引用 `LucideIcon` 组件类型（侧栏 19 个入口的图标在单点清单里）。
- **两个容器**：`Button` 的 `icon` 只允许左位 16px（`strokeWidth={1.75}`）；纯图标一律 `IconButton`（`size-[30px]` 方形无底幽灵按钮，hover 淡墨，`rounded-tau-sm`）。
- **三档尺寸**：16（inline/meta）/ 20（工具栏/按钮）/ 24（空状态），stroke 统一 1.5-1.75。
- **四条纪律**：同一动作全局同图标；纯装饰禁用图标；每个图标操作必须有文字 tooltip；图标选用变化记入 `PREFERENCES.md`。
- **纪律的载体是容器，不是规范文档** —— 想加第二种图标风格，没有容器可挂。

### 3.2 本仓的问题（可判定，不靠感觉）

| 维度 | 现状 | 判断 |
| --- | --- | --- |
| 尺寸档 | `IconSize = 12 \| 14 \| 18 \| 24`（`src/ui/icons.ts:786`），而自定规范 §2.1 写"**14 / 18 / 24 三档…不新增第四档**" | **规范与实现已经不一致**（12 档在用，注释还写"避免第 N 种大小"） |
| 风格 | 128 个纯描边（`s:` 段，stroke 1.7）+ 6 个纯面（`d:` 段）混合 | 面/线混排是"廉价感"的常见来源（同一行里两种视觉重量） |
| 概念膨胀 | 123 个键，其中 `export` / `exportWord` / `exportZip` / `exportMdpkg` 四个导出图标、`playlist` / `loopNone` / `loopSingle` / `loopPlaylist` 四个播放模式 | 概念按功能而非按"用户心智"分组，图标被迫承载 1px 级别的语义差异 |
| 光学质量 | 手绘 path，规范有价值（viewBox 24 / 安全区 2px / 1.7 / round cap / 光学对齐 / ≤6 笔画）但无视觉验收场 | 单条 icon 的曲线质量无法机检，只能靠"排成一排看" |
| 用法约束 | `lucide-react ^1.23.0` 在 `package.json` 里但**只用一个 `type LucideIcon`**（`src/components/BiaoyueIcon.tsx:1`） | 依赖空转；同时自绘库承担全部工作量 |

### 3.3 裁定（两条路，分别适用）

**A. 不改库，先把纪律补齐（P0，一周内）**

1. 尺寸档收敛到 14 / 18 / 24，把 12 档的 6 处使用逐个改成 14（或落 `--icon-micro` 特例条款）。
2. 6 个纯面图标改成描边版，或收敛为一个明确例外组（文件类型图标是"识别标志"，可保留面感，但要成组而不是散落）。
3. **"同一动作同一图标"机检**：从 `src/lib/action-tips.ts` 派生动作清单，扫 `Icon name="…"` 断言动作 → 图标映射唯一。
4. 排一排看：把 123 个图标按 18px 横排渲一页（复用已有图标抽屉），**人工裁决一遍**哪些在 18px 下糊、哪些重心偏。这是唯一有效的视觉验收，成本半天。

**B. 换 lucide（P1，需要视觉验收门）**

成本：123 键 → lucide 名映射表 + `Icon.tsx` 内层换组件（`name` API 不变，调用点零改动）+ 文件类型色图标保留自绘。收益：线条质量、光学对齐、后续新增零成本。风险：现有 fill 风格 → 全站线条更"轻"，需一次整体截图对照。**建议先在一个域试点（如工具栏），用户验收后再全量。**

> 更准确地说：**让图标"有品质"的是容器 + 尺寸 + 纪律 + 验收场，不是库本身。** tau 的 674 处 import 之所以不乱，正因为它们只能落在 `Button.icon` 和 `IconButton` 两个容器里。

---

## 4. 界面效果：可直接抄的手法清单

| # | 手法 | Tau 取值 | 本仓现状 | 成本 |
| --- | --- | --- | --- | --- |
| 1 | 表面阶梯（亮度分层，禁彩色装饰） | surface/page/sunken 三档，相邻对比 ≥1.10 | `--app-bg/surface/sunken` 已有三档，但无"档间可辨"判据 | 低（写条款 + 脚本算） |
| 2 | 零横线：分组靠底色容器 + 留白 | border 只允许 ≤2px 控件细节 | 大量 `border-bottom` 分隔（`--app-border` 使用 106 次） | 中（逐页改） |
| 3 | 反馈语言三档 | hover 淡墨 / 激活 accent 叠层 + 左缘 3px 竖标 / 浮起 shadow-card → hover shadow-lift | 有 hover，无"浮起"和"轻抬"层级 | 低 |
| 4 | 阴影只给物理浮起物 | 4 档语义（card/lift/float/paper） | 5 档语义（menu/panel/dialog/card/button），**已更好** | 无需改 |
| 5 | 4px 细滚动条按活跃显形 | 停止 700ms 且鼠标不在即隐藏；`-mr/pr` 借位 | 系统滚动条 | 低（一个 CSS 类 + 委托） |
| 6 | 边缘渐隐（长列表） | `.edge-fade-scroll` + `useEdgeFade` 通用 hook | 无 | 低 |
| 7 | 共享元素形变（卡片 → 详情纸） | View Transitions API，`data-morph-key`，380ms，源缺失自动退化 | 无 | 高（本仓是文件为中心，收益低） |
| 8 | 极光背景 | 4 团径向渐变取 `glow-1..3`，只从留白透出，只动 transform，`prefers-reduced-motion` 静止 | 无 | 低-中（可作主题可选开关） |
| 9 | 密度维度与主题正交 | `[data-density="compact\|comfortable"]` | 无 | 中 |
| 10 | 字号阶梯 | 25 / 20 / 14.5 / 13.5 / 13 / 12.5 / 12 / 11.5 / 11，**字重只用 400/500/600** | 11 / 12 / 13 / 14（`spec.md` §4），UI 层缺 12.5 与 13.5 的过渡档 | 低（补两档） |
| 11 | 数字对齐 | `font-variant-numeric: tabular-nums` 全局 | 局部有 | 低 |
| 12 | 主按钮音量纪律 | 六变体 = 一个动作的全部音量，primary 每屏至多一枚 | 5 套按钮类，无变体体系 | 中 |

---

## 5. 本仓全局病灶 TOP 5

1. **色值无家可归**：288 种 hex / 204 处 rgba 散在 CSS 与组件里。不是审美问题，是**没有"唯一合法写法"**——tau 的答案是"palette 原始输入不进组件"，本仓的答案只能是"组件层禁用 hex"，但这条规则目前不存在，也没有机检。
2. **基础件缺失导致重复发明**：`TooltipLayer` 自己测 DOM 探针算方位，`ContextMenu` 自己算位置，`TabInfoPopover` 再算一遍。三次重复 = 三个 bug 面（翻转、视口夹取、嵌套关闭）。
3. **按钮样式按域分裂**：`.dpb-tpl-btn` / `.dpb-ops-btn` / `.search-float-replace-btn` / `.cm-toolbar-btn` / `.capsule-btn` 各自的 hover / active / disabled 各写一次。改一次视觉要改五处。
4. **规范里主动放弃了两个最有效的机制**：`spec.md` §8 明确"不做动效规范、不做组件模式库"。前者导致 160ms 与 240ms 混用，后者导致组件无对照场。
5. **没有对照场**：任何"这里是不是不太对"的判断都只能靠打开应用点一遍。tau 的答案是 31 份档案 + 状态矩阵，把"对不对"变成一眼可判。

---

## 6. 行动路线（按性价比排序）

### P0 止血（现有架构内，小 diff，不动依赖）

1. **色值收口**：`src/styles/tokens.css` 补齐语义层（对齐 tau 的 45 词表骨架：surface / interaction / ink / line / accent / status / tag / float），新增 `scripts/check-tokens.mjs`：① 组件层（`src/components/**/*.{tsx,css}`）禁止新增 hex/rgba（白名单存量逐条登记）；② 语义层变量清单对账；③ 计算并断言 `ink-1` 对 `bg-page`/`surface` ≥ 7:1、`ink-2` ≥ 4.5:1。挂进 `verify.sh`。
2. **按钮收口**：5 套类合并为 `.btn` + 六变体（primary / secondary / soft / ghost / danger / danger-soft，**音量纪律：primary 每屏至多一枚**）。本仓无 Tailwind，用 CSS 变量 + `[data-variant]` 即可。
3. **图标纪检**：尺寸档收敛 14/18/24（清理 12 档 6 处）；面/线混用收敛；"动作 → 图标"映射机检；一排 18px 人工裁决一遍。
4. **四条铁律落条款**：零横线 / 反馈语言三档 / 禁用而非隐藏 / Esc 只退场。写进 `spec.md` 或新建 `docs/design/system/interaction.md`（只写可判定条款，2 页以内）。

### P1 提档（各 1 个小 change，走 OpenSpec）

1. **四个基础件**：`src/ui/primitives/` 建 `Button.tsx` / `IconButton.tsx` / `Menu.tsx` / `Tooltip.tsx`，共享浮层定位底盘（anchoredPosition 的 12 向 flip/shift + `useLayerDismiss` 嵌套仲裁 + `PortalScope`）。先替换重复最多的调用点，存量逐域迁移。
2. **样板间**：`/showcase` 路由 + 4 个基件的 LIVE 标本与状态矩阵（复用现有 `Icon` 抽屉的 e2e 桥）。这是让规范"可验收"的开关。
3. **图标换库试点**：一个域用 lucide 替换自绘，整体截图对照，用户视觉验收后决定是否全量。
4. **动效规范**：四档时长（80/160/240/400ms）+ 两根缓动（标准 `cubic-bezier(0.2,0,0,1)`、进场 bounce），`prefers-reduced-motion` 全局降级为 instant。页面切换默认无动画。

### P2 立项（结构性）

1. **token 型别化**：`src/styles/tokens.ts` 常量表 + 全键 `Record<TokenWord, string>`，CSS 数据块由脚本对账（tau 在 codegen 落地前就是用测试守手工同步，同样可行）。
2. **主题族 × 明暗正交**：本仓现在是 `:root` / `.dark` / `.warm` 三个平行块，tau 是"族 × 模式"二维。收益是新增主题不再写第三份全量色值，代价是重构 `tokens.css` 与 `theme-mirror.mjs`。**属于产品决策，不是纯技术债**，建议先只做 #9。
3. **密度维度 / 字号全局缩放**：`--tau-text-*` 的运行时覆盖（本仓已有阅读区字号设置，可扩展到 UI 层）。

### 明确不抄

- **Tailwind v4 单轨制**：8526 行手写 CSS 迁移的收益/成本比在本仓不成立。只借 `@theme` 的**语义映射思路**（变量 → 语义名），不借工具类写法。
- **React 19 `<Activity>` 保活**：本仓 React 18，且模式切换已用 CSS display 保留 CM6 状态，目的相同。
- **Electron 专属**：`app-region-drag`、自绘信号灯（`trafficLightPosition` 移屏外）、`webContents.capturePage()`。
- **antd → 自研映射表**：本仓无 antd，整节无意义。
- **15K 行 UI 包 + 12K 交互文档的规模**：单人维护不可持续。抄"机制与判据"，不抄"体量"。

---

## 7. 关键参数速查

| 项 | Tau 取值 | 出处 |
| --- | --- | --- |
| 圆角 | sm 8 / md 12 / lg 16 | `packages/themes/src/scale.css:13-16` |
| 字号 | hero 25 / title-lg 20 / title 14.5 / body-lg 13.5 / body 13 / meta 12.5 / sm 12 / micro 11.5 / tiny 11 | `scale.css:30-38` |
| 字重 | 只用 400 / 500 / 600（700+ 禁止） | `design-system.md` §3 |
| 说明文字下限 | 12.5px（micro/tiny 只给角标图注） | 同上 |
| 动效 | fast 160ms / normal 240ms / slow 400ms / instant 80ms；`cubic-bezier(0.22,1,0.36,1)` | `scale.css:19-20` |
| 间距 | 4 基数：4/8/12/16/20/24/32/48 | `design-system.md` §4 |
| 控件高 | Button 34 / sm 28；IconButton 30×30；命中区 ≥24×24（工具栏 padding 撑到 28×28） | `Button.tsx:39-46`、`IconButton.tsx:23` |
| 图标 | 16 / 20 / 24，stroke 1.5-1.75；Button 内只左位 16 | `design-system.md` §6、`Button.tsx:104` |
| 对比度 | ink-1 ≥7:1；ink-2 / accent 文字 ≥4.5:1；表面相邻档 ≥1.10 | `design-system.md` §2.5/§2.6 |
| 表面阶梯 | surface > page > sunken（深色同构镜像） | 同上 §2.6 |
| 滚动条 | 4px，活跃显形，停 700ms + 鼠标移出即隐 | `ui-interaction.md` 铁律 7 |
| 标题栏 | 44px（compact 42px） | `design-system.md` §5.5 |
| 内容区 | `max-w-1680`；正文列 ~72ch；样板间版心 740px | `ui-interaction.md` 铁律 3、`showcase/kit.tsx` |
| 菜单 | 最小宽 160 / 上限 320 且不超视口-16；外壳四周 6px 留白；默认高上限 300 | `ui-interaction.md` Menu 节 |
| Dialog | sm 380 / md 440 / lg 560；正文滚动上限 78vh；遮罩 blur 4px | 同上 Dialog 节 |
| 页签 | 本仓已有 `--tab-min-width 96` / `--tab-info-width 256` | `src/styles/tokens.css:47-55` |

---

## 8. 方法与局限

- **方法**：Tau 侧为源码级阅读（全部可读，无混淆）；重点读了 `docs/architecture/design-system.md`、`docs/architecture/desktop/{overview,page-protocol,ui-interaction,home-features}.md`、`docs/decisions.md`、`packages/themes/src/*`、`packages/ui/src/primitives/{Button,IconButton,Loading}.tsx`、`packages/ui/src/cn.ts`、`apps/desktop/src/showcase/*`、`apps/desktop/src/app/navigation.ts`。本仓侧用统计脚本量化（px 字面量 / hex / rgba / var 使用频次）与源码抽查。
- **局限 1**：**未做视觉对照**。本报告没有运行 tau（`pnpm dev` 需 Electron 全量依赖），也没有截取本仓界面。所有"看着有品质"的判断都来自机制与代码，不是像素对照。若要做真正的视觉验收，需要在本仓 `npm run tauri dev` 与 tau 截图并排看一遍。
- **局限 2**：tau 是活跃演进中的大仓（v0.66.2，33 页 + 34 插件 + 6 主题），本报告只抽样了 UI / 主题 / 图标三条线，数据库、白板、协作三条线未深入。
- **局限 3**：`spec.md` §7.3 的"审美判据七问"（能删吗 / 能合并吗 / 默认出现吗 / 能直觉发现吗 / 能一键完成吗 / 提醒打扰吗 / 心智模型一致吗）与本报告建议不冲突，且可作为 P0 四项改造的验收问题清单。
- **两代结论的先后**：本仓此前的 Quiet.md 逆向报告（`quiet-md-逆向学习总报告.md`）解决的是**编辑器引擎**（输入稳定性 / undo / 分栏 / 表格）；本报告解决的是**界面生产线**。两者无重叠，可并行推进。
