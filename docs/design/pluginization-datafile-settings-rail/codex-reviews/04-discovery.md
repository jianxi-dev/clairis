Reading additional input from stdin...
2026-11-16T22:49:02.843746Z ERROR codex_skills_extension::loader::host: skills scan reached its traversal limit (root: file:///Users/mason/.agents/skills)
OpenAI Codex v0.167.2
--------
workdir: /Users/mason/ToHighs/clairis-wt-design-plan
model: deepseek-flash
provider: custom
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 01a1e68c-b091-7460-8a11-a442ba1a21f5
--------
user
你是严格的独立对抗式评审专家。只做只读评审，绝对不要修改任何文件。
请对设计方案文档做对抗式评审，路径：docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md
先阅读该文档，再对照本仓库实际代码核查事实准确性。重点：
1. 事实核查：文档引用的文件路径、函数名、字段名、行号是否与仓库代码一致；发现任何虚构或错误必须指出，附实际证据（文件路径:行号或实际字段名）。
2. 逻辑漏洞：论证是否成立、前后矛盾、边界条件、遗漏。
3. 修订建议：具体可执行，按优先级排列。
输出格式：
## 总体判定：通过 / 需修订
## 事实核查（逐项，附证据）
## 逻辑与遗漏问题（编号）
## 修订建议（按优先级）
直接输出评审报告，不要客套。
hook: SessionStart
hook: SessionStart
hook: SessionStart
hook: SessionStart
hook: SessionStart Completed
hook: SessionStart Completed
hook: SessionStart Completed
hook: SessionStart Completed
codex
我会先读取目标文档与仓库内的相关实现，逐条核对引用、字段和调用链；全程只读，不修改文件。
exec
/bin/zsh -c "sed -n '1,260p' docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
# 文档发现与插件展示方案

> 状态：设计方案（已通过独立对抗评审，按意见修订）
> 对应目标：第 4 项——重做文档发现操作方案（便捷直观、有设计感）+ 插件展示策略
> 事实基线（已校正）：`src-tauri/src/config.rs`、`src-tauri/src/commands/recent.rs`、`src-tauri/src/commands/search.rs`、`src/lib/railView.ts`、`src/components/Rail/ReadingRail.tsx`、`src/components/Grid/GridToolbar.tsx`、`src/lib/gridView.ts`、`src/components/Grid/GridTile.tsx`、`src/stores/index.ts`、`src/components/PortalView.tsx`、`src/components/QuickOpen.tsx`、`src/lib/quickOpen.ts`、`src/App.tsx`、`docs/research/technical/plugin-management-benchmark.md`

## 1. 背景与目标

当前文档发现靠阅读空间左边栏和网格概览，用户反馈「找不到想看的文档」。目标是重做文档发现操作方案，做到**便捷直观、有设计感**，并确定插件如何展示在窗口（或不单独展示、怎么操作。

## 2. 诊断（已按事实重写）

### 2.1 现状盘点：能力已存在，问题在入口分工

**左边栏已具备四段结构 + 全文搜索**（方案原诊断「左边栏以文件名/时间为主轴、记得内容时没有路径」与事实不符）：

- `RAIL_SECTIONS = [now, pinned, recent, category]`（`railView.ts:55-71`）——「现在（正在阅读）/收藏/最近/分类」四段已存在。
- **内置本机全文搜索**（`ReadingRail.tsx:972-998`）：去抖 300ms 后 `invoke("search_documents")`，已落地搜索框、命中数、时间过滤、清空全套 UI。

**网格概览已有搜索/排序/分组/过滤**（方案原称「有设计感但定位弱」无证据，且低估了网格能力）：

- 搜索框（`GridToolbar.tsx:194-209`）、排序（最近/名称/类型，`gridView.ts:14-25`）、分组（时间/类型/主题/不分组，`:27-32`）、类型过滤、仅看收藏（`stores/index.ts:447-451`）。
- 卡片含缩略图 + 真摘要（`GridTile.tsx:162-165,309-314`）。
- **注**：网格的「主题」分组是**按父目录**（`gridView.ts:121` 注释「theme = 父目录」），不是标签。

**门户是默认落地场景**（方案原遗漏）：

- 初始 `scene: "portal"`（`stores/index.ts:445`），`App.tsx:977` 渲染 `PortalView`（继续阅读 hero + 最近富卡 + 8 类磁贴 + 快速动作），门户底部自带「⌘P 搜索全部」提示（`PortalView.tsx:348`）。**门户才是用户打开应用的第一发现面**。

**⌘P 已存在但能力有限**（方案原称「已有需强化」被低估）：

- `QuickOpen.tsx` + `quickOpen.ts` 已存在，但过滤**仅 title+path 大小写不敏感子串匹配**（`quickOpen.ts:8-9,36,47-65`），条目仅三类：页签 / 最近文件 / 两个命令（网格、设置）（`QuickOpen.tsx:32-38`）。**无内容搜索、无标签搜索、无收藏分组**。
- `search_documents` 扫描的是**整个 home 目录**（`search.rs:240,261-272`，跳过 heavy dir）。

### 2.2 真实问题

诊断修正为：

1. **⌘P 仅做标题子串过滤，不能按内容直达**——真正的差距在这里，而非左边栏路径缺失。
2. **发现入口层级与分工未定义**——门户 / 左边栏搜索 / 网格搜索 / ⌘P / 编辑器内搜索（⌘F，`App.tsx:614`）**五处并存**，各入口范围与结果是否一致、谁主谁辅，零讨论。这是「发现路径单一」诊断自己制造的新混乱。

**用户反馈引用**：仓库内可查的近期反馈是 issue #897（视觉缺陷：网格缩略图取帧、卡片重叠、表格边距），**非「找不到文档」**。本方案将「找不到文档」降级为**待验证假设**，与 #897 这类视觉反馈区分开。

## 3. 发现入口分工（新增，必补）

定义五处入口的边界，避免变体 A 制造入口冗余：

| 入口 | 作用域 | 定位 | 键位 |
|---|---|---|---|
| **门户** | 全局发现 | 默认落地场景，继续阅读 + 快速动作 + ⌘P 提示 | 无（默认场景） |
| **⌘P（快速打开）** | **全局发现主入口** | 跨页签/最近/命令 +（升级后）内容搜索 | ⌘P（`shortcuts.ts:66-76`） |
| **左边栏搜索** | 阅读空间场景内 | 阅读空间文档内的过滤 | ⌘\（`shortcuts.ts:82-88`） |
| **网格搜索** | 网格场景内 | 网格文档内的过滤 | ⌘⇧\（`shortcuts.ts:106-112`） |
| **⌘F** | 文档内定位 | 当前文档内的文本定位 | ⌘F（`App.tsx:614`） |

**分工原则**：⌘P = 全局发现主入口；⌘F = 文档内定位；左边栏/网格搜索 = 对应场景内的过滤。各入口结果范围需一致或明确标注，不重叠混淆。

## 4. 文档发现操作方案（变体）

### 变体 A：搜索提升为发现主入口（推荐，但增量需重新定义）

**增量澄清（已校正）**：方案原称的「双轨侧栏（收藏+最近）」**已是现状**（`RAIL_SECTIONS` 已含 pinned/recent），**不是新增**。变体 A 的真正变更只有：

1. **⌘P 接入内容搜索**：从同步子串过滤（title+path）改为**异步全文检索**（复用 `search_documents`）+ 多分组面板（页签/最近/收藏/命中文档）。
2. **收藏分组**：⌘P 面板内增加收藏分组入口。
3. **键位/入口层级调整**：按 §3 分工明确 ⌘P 为主入口。

**搜索范围决策（必补，原方案缺失）**：

- `search_documents` 默认扫整个 home，若 ⌘P 直接接，**每键触发全盘扫描**，且可能命中阅读空间之外的文件（语义不符）。
- **建议**：⌘P 内容搜索**限定范围**——限定为「最近库 + 阅读空间内的文档」，而非全盘 home。理由：① 发现目标是阅读空间文档，全盘命中语义不符；② 避免每键全扫的性能问题。
- **异步加载态**：⌘P 从同步变异步，需设计加载态（去抖沿用 300ms 先例 + `spawn_blocking`，左边栏搜索已有先例）。

**成本修正**：⌘P 内容搜索是**功能重构而非强化**（同步子串 → 异步全文 + 多分组面板），实现成本高于原方案判断。

### 变体 B：空间地图 + 标签分簇（备选，成本高）

**数据基础修正（原方案误判）**：变体 B 的「frontmatter 标签」数据基础**当前不存在**——`RecentFile` 只有 path/title/openedAt/excerpt（`src/types/index.ts:178-184`），**无标签模型、无标签索引**，frontmatter 解析是通用 YAML、无 tags 字段约定。网格现有「主题」分组是按父目录，不是标签。

**变体 B 需补齐的成本清单**：

1. **标签数据模型**：在 `RecentFile` 或扫描层新增标签字段（无现存字段）。
2. **标签抽取管线**：从 frontmatter 抽取 tags 并建索引。
3. **可缩放空间地图 + 时间轴叠加**：全新交互组件；且网格当前是整屏场景覆盖层（`App.tsx:997-999`），改造是**新建场景**而非升级网格。
4. **与网格 theme 分组的重合度**：评估「按目录分簇」与网格现有 theme 分组是否重复建设。

**决策**：变体 B 成本被系统性低估，保留为备选。**上马判据**：当标签数据模型与抽取管线落地后，再评估地图组件的投入产出；否则不上马。

### 变体 C：智能推荐 / 语义检索（备选，保留）

**现状修正**：变体 C 的前提是「文件无结构化元数据、纯文本检索」，但**左边栏已有全文搜索、网格已有分组**，语义检索的增量价值需重新论证——除非引入向量检索或阅读行为学习，否则与已有全文搜索重叠。

**定位**：保留为备选，自评冷启动与算法投入成本高。

### 变体对比（修订后）

| 维度 | 变体 A（搜索主入口） | 变体 B（空间地图+标签） | 变体 C（语义推荐） |
|---|---|---|---|
| 新颖度 | ⌘P 内容搜索是真增量（其余是已有） | 高（地图是全新组件） | 中（依赖算法） |
| 成本 | 中高（⌘P 重构+范围限定+异步态） | 高（标签模型+管线+地图组件） | 高（冷启动+算法） |
| 数据基础 | 已有（`search_documents`） | **缺失**（需建标签模型） | 部分（全文搜索已有，语义需补） |
| 便捷直观 | 高（键盘直达） | 中（空间交互需学习） | 中 |
| 设计感 | 中高 | 高 | 中 |

**推荐**：**变体 A 为主**，但需先落地 §3 入口分工与搜索范围限定；变体 B 在标签数据基础补齐后再评估。

## 5. 插件展示策略（已按术语校正）

### 5.1 前提校正

**「第 1 项会提取出较多插件」不成立**：01 号文档 A 档用户可见插件仅 4 项（片段/模板/theme.toml/SKILL.md 包），B 档目前还是代码常量、需另立批次文件化。展示策略不建立在「插件很多」的夸大前提上。

### 5.2 展示方向（保留，对齐 benchmark 与产品信条）

**不常驻主窗口 + 能力就近 + 设置集中管理**——与 `plugin-management-benchmark.md`（第三、四节「插件管理入口放设置深处，无常驻 UI，零弹窗」「大而全的插件管理 UI 与信条冲突」）及产品信条一致，方向保留。

### 5.3 操作入口（已按生命周期定义校正）

**「启停/卸载」是数据包型插件（A4，`.disabled` 标记）专属的生命周期**；数据文件型插件（A1–A3）是「删文件即卸载」，无启停概念（01 号文档 §5.1 已写明）。操作入口按插件类型分：

| 插件类型 | 操作入口 | 操作 |
|---|---|---|
| 数据包型（A4） | 设置内插件分类 | 启停 / 卸载（`.disabled` 标记） |
| 数据文件型（A1–A3） | 设置内插件分类（清单查看） | **删文件即卸载**；设置内提供清单查看入口 |

### 5.4 可发现性（补充，原方案未回答）

原方案只解决「操作」不解决「发现」。**可发现性处理**：设置内插件分类的清单即发现入口（用户可在设置中浏览有哪些插件能力）；或对齐数据文件目录约定，用户通过目录结构感知能力。不新增常驻 UI，避免与「零弹窗、无常驻」信条冲突。

## 6. 原型设计方向

原型需覆盖：

1. **变体 A 的 ⌘P 升级面板**：内容搜索 + 多分组（页签/最近/收藏/命中）+ 加载态。
2. **§3 入口分工的视觉呈现**：门户 / 左边栏 / 网格 / ⌘P / ⌘F 的边界示意。
3. **门户纳入对比**：原型对比建议改为「变体 A 与门户改造」或说明门户去留（原方案只并排 A/B，漏了最高曝光面门户）。
4. **插件展示**：设置内插件分类清单（数据包型启停 + 数据文件型清单查看）。

## 7. 边界（保留）

- **不动编辑器核心**：CM6 编辑器 undo/选区/编辑状态不变（AGENTS.md 硬约束）。
- **不新建窗口机制**：文档发现在现有窗口内完成，不新建独立窗口。
- **搜索范围限定**：⌘P 内容搜索限定阅读空间/最近库，不扫全盘 home（见变体 A）。

## 8. 对抗评审记录

**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。

**总体判定**：需修订（已按意见全部修订）。

**主要意见与处置**：

1. **事实基线错误（state.rs 不存在）**：`recentFiles/scrollPositions` 实际在 `config.rs`（字段 `:37-41`、序列化 `:434-453`、落盘 `:998`）+ `commands/recent.rs` → 已采纳，§顶部事实基线校正。
2. **诊断失实**：左边栏已有四段+全文搜索、网格已有搜索/排序/分组、门户被遗漏 → 已采纳，§2 诊断重写，§3 补门户与五入口分工。
3. **⌘P 被低估**：内容搜索是重构非强化，搜索范围与异步方案缺失 → 已采纳，变体 A 重新定义增量 + 搜索范围限定 + 异步加载态。
4. **变体 B 数据基础不存在**：无标签模型/索引 → 已采纳，变体 B 补成本清单 + 上马判据。
5. **插件章术语矛盾**：「较多插件」不成立；「启停/卸载」应限定数据包型 → 已采纳，§5 前提校正 + 操作入口按类型分。
6. **用户反馈无出处**：#897 是视觉缺陷 → 已采纳，§2 降级为待验证假设。
7. **搜索入口重叠未处理**：五处并存 → 已采纳，§3 新增入口分工。

**可保留**：「搜索提升为发现主入口」方向；变体 C 备选定位；§4.1 插件「不常驻主窗口、能力就近、设置集中管理」方向；§6 边界。

**需重新论证**：「变体 A 为主方案」的结论——需在诊断与成本修正后重新评估，已据实重新定义增量。

exec
/bin/zsh -c 'find docs -name AGENTS.md -print' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
exec
/bin/zsh -c 'git status --short --branch' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 18ms:
## HEAD (no branch)
?? codex-reviews/
?? docs/design/pluginization-datafile-settings-rail/
?? prototypes/

codex
文档主体已读完。接下来我会核对它列出的每个“事实基线”与关键行号，并检查入口快捷键、最近文件模型、搜索作用域和插件生命周期是否与实现一致。
exec
/bin/zsh -c "nl -ba src/lib/railView.ts | sed -n '1,155p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 阅读空间竖排栏（layout-portal 6.1）——纯逻辑层。
     3	 *
     4	 * 三态状态机、段定义、分类 chips 与搜索过滤全部放在这里，无 DOM / 无 store，
     5	 * 渲染侧（components/Rail/ReadingRail.tsx）只订阅结果、不自己推状态。
     6	 */
     7	
     8	import { fileTypeOf, type FileTypeKind } from "./fileType";
     9	import { stripMarkdownOf } from "./railCards";
    10	import type { RecentFile, SearchHit } from "../types";
    11	
    12	/** 折叠态边缘条宽度（严格 12px，e2e 会量）。 */
    13	export const RAIL_EDGE_PX = 12;
    14	/** 悬停浮层 / 钉住常驻的默认栏宽。 */
    15	export const RAIL_WIDTH_PX = 240;
    16	/** 钉住栏右缘拖拽手柄的视觉宽度（命中区再向外扩）。 */
    17	export const RAIL_RESIZE_HANDLE_PX = 4;
    18	/** 同时渲染的 HTML iframe 缩略图上限，超出后回退到 glyph 占位。 */
    19	/** 布局 / 密度 / 快照菜单的最大高度，超出滚动。 */
    20	export const RAIL_MENU_MAX_HEIGHT = "calc(100vh - 48px)";
    21	/** 指针移开后收回折叠的延迟。 */
    22	export const HOVER_CLOSE_MS = 300;
    23	/** 悬停边缘条的驻留时间，超过才展开浮层。 */
    24	export const HOVER_OPEN_MS = 250;
    25	
    26	export type RailState = "collapsed" | "hover" | "pinned";
    27	
    28	export interface RailEvent {
    29	  type:
    30	    "hover-enter" | "hover-leave" | "toggle-pin" | "collapse" | "toggle-key";
    31	}
    32	
    33	/**
    34	 * 三态状态机。hover 是瞬态：指针离开即回折叠；pinned 常驻，不受 hover 影响。
    35	 * `toggle-key` 即 ⌘\ 的语义——在「钉住」与「折叠」之间来回。
    36	 */
    37	export function nextRailState(current: RailState, event: RailEvent): RailState {
    38	  switch (event.type) {
    39	    case "hover-enter":
    40	      return current === "pinned" ? "pinned" : "hover";
    41	    case "hover-leave":
    42	      return current === "hover" ? "collapsed" : current;
    43	    case "toggle-pin":
    44	      return current === "pinned" ? "collapsed" : "pinned";
    45	    case "collapse":
    46	      return "collapsed";
    47	    case "toggle-key":
    48	      return current === "pinned" ? "collapsed" : "pinned";
    49	  }
    50	}
    51	
    52	export type RailSection = "now" | "pinned" | "recent" | "category";
    53	
    54	/** 段的固定顺序与中文名；竖排栏按此顺序渲染，标签页也按此顺序出签。 */
    55	export const RAIL_SECTIONS: ReadonlyArray<{
    56	  key: RailSection;
    57	  label: string;
    58	}> = [
    59	  { key: "now", label: "现在" },
    60	  { key: "pinned", label: "收藏" },
    61	  { key: "recent", label: "最近" },
    62	  { key: "category", label: "分类" },
    63	];
    64	
    65	export type RailLayout = "stacked" | "tabs";
    66	export type RailDensity = "compact" | "comfortable" | "card";
    67	
    68	/** 「设为默认」保存的视图规格（持久化到 Rust `rail_view_spec`）。 */
    69	export interface RailViewSpec {
    70	  layout: RailLayout;
    71	  density: RailDensity;
    72	  /** 卡片档高度；88–160。旧配置缺省时由 normalize 补 112。 */
    73	  cardHeight?: number;
    74	}
    75	
    76	export const DEFAULT_RAIL_VIEW_SPEC: RailViewSpec = {
    77	  layout: "stacked",
    78	  // 7.1 起默认卡片档（112px）；布局仍是堆叠
    79	  density: "card",
    80	  cardHeight: 112,
    81	};
    82	
    83	/** 8 类固定顺序（与门户磁贴、fileType 词表一致）。 */
    84	export const RAIL_KIND_ORDER: readonly FileTypeKind[] = [
    85	  "markdown",
    86	  "html",
    87	  "text",
    88	  "pdf",
    89	  "video",
    90	  "image",
    91	  "code",
    92	  "audio",
    93	];
    94	
    95	export const RAIL_KIND_LABELS: Record<FileTypeKind, string> = {
    96	  markdown: "Markdown",
    97	  html: "HTML",
    98	  text: "文本",
    99	  pdf: "PDF",
   100	  video: "视频",
   101	  image: "图片",
   102	  code: "代码",
   103	  audio: "音频",
   104	};
   105	
   106	export type RailChipKind = "all" | FileTypeKind;
   107	
   108	export interface RailChip {
   109	  kind: RailChipKind;
   110	  label: string;
   111	  count: number;
   112	}
   113	
   114	/**
   115	 * 分类过滤 chips：恒为 9 个（全部 + 8 类），带计数。纯过滤行，不做瀑布式分类行。
   116	 */
   117	export function fileTypeChips(
   118	  items: ReadonlyArray<{ path: string }>,
   119	): RailChip[] {
   120	  const counts = new Map<FileTypeKind, number>();
   121	  for (const item of items) {
   122	    const kind = fileTypeOf(item.path);
   123	    counts.set(kind, (counts.get(kind) ?? 0) + 1);
   124	  }
   125	  return [
   126	    { kind: "all", label: "全部", count: items.length },
   127	    ...RAIL_KIND_ORDER.map((kind) => ({
   128	      kind,
   129	      label: RAIL_KIND_LABELS[kind],
   130	      count: counts.get(kind) ?? 0,
   131	    })),
   132	  ];
   133	}
   134	
   135	export type RailSearchTime = "all" | "today" | "week" | "older";
   136	
   137	export const RAIL_SEARCH_TIMES: ReadonlyArray<{
   138	  key: RailSearchTime;
   139	  label: string;
   140	}> = [
   141	  { key: "all", label: "全部" },
   142	  { key: "today", label: "今天" },
   143	  { key: "week", label: "本周" },
   144	  { key: "older", label: "更早" },
   145	];
   146	
   147	const DAY_MS = 86_400_000;
   148	
   149	function startOfLocalDay(ms: number): number {
   150	  const d = new Date(ms);
   151	  d.setHours(0, 0, 0, 0);
   152	  return d.getTime();
   153	}
   154	
   155	export function timeBucketOf(

exec
/bin/zsh -c "nl -ba src/components/Rail/ReadingRail.tsx | sed -n '900,1035p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   900	        window.removeEventListener("pointercancel", onUp);
   901	      };
   902	      const onMove = (ev: PointerEvent) => {
   903	        last = Math.min(
   904	          RAIL_PINNED_WIDTH_MAX,
   905	          Math.max(
   906	            RAIL_PINNED_WIDTH_MIN,
   907	            Math.round(startWidth + ev.clientX - startX),
   908	          ),
   909	        );
   910	        setRailWidthState(last);
   911	      };
   912	      const onUp = () => {
   913	        detach();
   914	        if (handle.hasPointerCapture?.(e.pointerId)) {
   915	          handle.releasePointerCapture(e.pointerId);
   916	        }
   917	        useStore.getState().applyViewSpec({ railPinnedWidth: last });
   918	        void saveAppConfig();
   919	      };
   920	      window.addEventListener("pointermove", onMove);
   921	      window.addEventListener("pointerup", onUp);
   922	      window.addEventListener("pointercancel", onUp);
   923	    },
   924	    [clearTimer, railWidth],
   925	  );
   926	
   927	  // 状态变化时清掉悬停计时器：避免过期回调把栏/预览拉回旧态
   928	  useEffect(() => {
   929	    clearTimer(openTimer);
   930	    clearTimer(closeTimer);
   931	    clearTimer(previewTimer);
   932	  }, [railState, clearTimer]);
   933	
   934	  // 预览总开关关闭时取消待触发的悬停计时器，避免关闭后仍弹出
   935	  useEffect(() => {
   936	    if (!previewEnabled) clearTimer(previewTimer);
   937	  }, [previewEnabled, clearTimer]);
   938	
   939	  // 折叠即清空搜索：不留残余过滤
   940	  useEffect(() => {
   941	    if (railState === "collapsed") closeRailSearch();
   942	  }, [railState, closeRailSearch]);
   943	
   944	  useEffect(() => {
   945	    if (railSearchOpen) inputRef.current?.focus();
   946	  }, [railSearchOpen, railQuery]);
   947	
   948	  useEffect(() => {
   949	    const onLocate = (e: Event) => {
   950	      const path = (e as CustomEvent<string>).detail;
   951	      if (typeof path === "string") setLocatedPath(path);
   952	    };
   953	    window.addEventListener("rail-locate", onLocate);
   954	    return () => window.removeEventListener("rail-locate", onLocate);
   955	  }, []);
   956	
   957	  useEffect(() => {
   958	    if (recentScanStarted || !configLoaded || !isTauriEnv()) return;
   959	    recentScanStarted = true;
   960	    let cancelled = false;
   961	    invoke<RecentFile[]>("list_recent_documents")
   962	      .then((files) => {
   963	        if (cancelled || !Array.isArray(files)) return;
   964	        useStore.getState().mergeRecentFiles(files);
   965	      })
   966	      .catch((e) => log.warn("Rail", "读取本机最近文件失败", e));
   967	    return () => {
   968	      cancelled = true;
   969	    };
   970	  }, [configLoaded]);
   971	
   972	  // 本机检索：query 去抖 300ms 后调用 search_documents；序号丢弃过期响应。
   973	  // searching 由 searchedQuery 派生，不在 effect 里同步 setState。
   974	  useEffect(() => {
   975	    const query = railQuery.trim();
   976	    if (!query || !isTauriEnv() || query === searchedQuery) {
   977	      searchSeq.current += 1;
   978	      return;
   979	    }
   980	    const seq = ++searchSeq.current;
   981	    clearTimer(searchTimer);
   982	    searchTimer.current = setTimeout(() => {
   983	      searchTimer.current = null;
   984	      invoke<SearchHit[]>("search_documents", { query, limit: SEARCH_LIMIT })
   985	        .then((hits) => {
   986	          if (searchSeq.current !== seq) return;
   987	          setSearchHits(Array.isArray(hits) ? hits : []);
   988	          setSearchedQuery(query);
   989	        })
   990	        .catch(() => {
   991	          if (searchSeq.current !== seq) return;
   992	          setSearchHits([]);
   993	          setSearchedQuery(query);
   994	        });
   995	    }, SEARCH_DEBOUNCE_MS);
   996	    return () => clearTimer(searchTimer);
   997	  }, [railQuery, searchedQuery, clearTimer]);
   998	
   999	  const searching =
  1000	    railQuery.trim() !== "" && railQuery.trim() !== searchedQuery;
  1001	
  1002	  useEffect(() => {
  1003	    if (!locatedPath) return;
  1004	    const panel = railPanelRef.current;
  1005	    if (!panel) return;
  1006	    const matches = Array.from(
  1007	      panel.querySelectorAll<HTMLElement>(
  1008	        `[data-rail-path="${CSS.escape(locatedPath)}"]`,
  1009	      ),
  1010	    );
  1011	    if (matches.length === 0) return;
  1012	    matches[0].scrollIntoView({ block: "nearest" });
  1013	    for (const el of matches) {
  1014	      el.setAttribute("data-located", "true");
  1015	      el.classList.add("rail-located");
  1016	    }
  1017	    clearTimer(locateTimer);
  1018	    locateTimer.current = setTimeout(() => {
  1019	      locateTimer.current = null;
  1020	      for (const el of matches) {
  1021	        el.removeAttribute("data-located");
  1022	        el.classList.remove("rail-located");
  1023	      }
  1024	    }, 1600);
  1025	    return () => {
  1026	      clearTimer(locateTimer);
  1027	      for (const el of matches) {
  1028	        el.removeAttribute("data-located");
  1029	        el.classList.remove("rail-located");
  1030	      }
  1031	    };
  1032	  }, [locatedPath, railState, clearTimer]);
  1033	
  1034	  useEffect(
  1035	    () => () => {

exec
/bin/zsh -c "nl -ba src/lib/gridView.ts | sed -n '1,180p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 网格概览（layout-portal 10.1）——纯逻辑层。
     3	 *
     4	 * 排序 / 时间分桶 / 分组 / tile 尺寸判定 / 筛选全部放在这里，无 DOM / 无 store。
     5	 * 渲染侧（components/GridView.tsx、Grid/GridTile.tsx）只消费结果，不自己推规则；
     6	 * 单测与 e2e 断言的是同一份确定性契约。
     7	 */
     8	
     9	import { fileTypeOf, type FileTypeKind } from "./fileType";
    10	import { parentPathOf, thumbKindOf } from "./railCards";
    11	import { RAIL_KIND_LABELS, RAIL_KIND_ORDER } from "./railView";
    12	import type { RecentFile } from "../types";
    13	
    14	export type GridSort = "recent" | "name" | "type";
    15	export type GridGroupMode = "time" | "type" | "theme" | "none";
    16	export type GridTileSize = "large" | "medium" | "small";
    17	
    18	/** 时间粘性分组桶；固定顺序 today → earlier。 */
    19	export type GridTimeBucket = "today" | "yesterday" | "this-week" | "earlier";
    20	
    21	export const GRID_SORT_LABELS: Record<GridSort, string> = {
    22	  recent: "最近",
    23	  name: "名称",
    24	  type: "类型",
    25	};
    26	
    27	export const GRID_GROUP_LABELS: Record<GridGroupMode, string> = {
    28	  time: "时间",
    29	  type: "类型",
    30	  theme: "主题",
    31	  none: "不分组",
    32	};
    33	
    34	/** 时间桶固定顺序（分组与渲染都按此顺序，不受数据影响）。 */
    35	export const GRID_TIME_BUCKET_ORDER: readonly GridTimeBucket[] = [
    36	  "today",
    37	  "yesterday",
    38	  "this-week",
    39	  "earlier",
    40	];
    41	
    42	/** 时间桶中文标签（今天/昨天/本周/更早），顺序即 GRID_TIME_BUCKET_ORDER。 */
    43	export const GRID_TIME_BUCKET_LABELS: Record<GridTimeBucket, string> = {
    44	  today: "今天",
    45	  yesterday: "昨天",
    46	  "this-week": "本周",
    47	  earlier: "更早",
    48	};
    49	
    50	const DAY_MS = 86_400_000;
    51	const WEEK_MS = 7 * DAY_MS;
    52	
    53	/**
    54	 * 时间桶判定（本地时区，按自然日切分）：
    55	 * - `today`：不早于今日 0 点
    56	 * - `yesterday`：不早于昨日 0 点（周一时「昨天」是周日，仍标昨天）
    57	 * - `this-week`：不早于今日 0 点往前 7 天（滚动一周，保证任意星期都能出该桶）
    58	 * - `earlier`：更早，或 `iso` 不可解析（绝不落进今天）
    59	 */
    60	export function timeBucketOf(
    61	  iso: string,
    62	  now: number = Date.now(),
    63	): GridTimeBucket {
    64	  const t = Date.parse(iso);
    65	  if (!Number.isFinite(t)) return "earlier";
    66	  const ref = new Date(now);
    67	  const startOfToday = new Date(
    68	    ref.getFullYear(),
    69	    ref.getMonth(),
    70	    ref.getDate(),
    71	  ).getTime();
    72	  if (t >= startOfToday) return "today";
    73	  if (t >= startOfToday - DAY_MS) return "yesterday";
    74	  if (t >= startOfToday - WEEK_MS) return "this-week";
    75	  return "earlier";
    76	}
    77	
    78	function openedAtValue(item: RecentFile): number {
    79	  const t = Date.parse(item.openedAt);
    80	  return Number.isFinite(t) ? t : 0;
    81	}
    82	
    83	/**
    84	 * 排序：绝不修改入参。
    85	 * - `recent`：openedAt 降序（无法解析的时间视为 0，排最后）
    86	 * - `name`：标题升序（中文按拼音）
    87	 * - `type`：先按 8 类固定顺序，同类型内再按 openedAt 降序
    88	 */
    89	export function sortGridItems(
    90	  items: RecentFile[],
    91	  sort: GridSort,
    92	): RecentFile[] {
    93	  const copy = [...items];
    94	  if (sort === "name") {
    95	    copy.sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));
    96	    return copy;
    97	  }
    98	  if (sort === "type") {
    99	    copy.sort((a, b) => {
   100	      const ai = RAIL_KIND_ORDER.indexOf(fileTypeOf(a.path));
   101	      const bi = RAIL_KIND_ORDER.indexOf(fileTypeOf(b.path));
   102	      if (ai !== bi) return ai - bi;
   103	      return openedAtValue(b) - openedAtValue(a);
   104	    });
   105	    return copy;
   106	  }
   107	  copy.sort((a, b) => openedAtValue(b) - openedAtValue(a));
   108	  return copy;
   109	}
   110	
   111	export interface GridGroup {
   112	  key: string;
   113	  label: string;
   114	  items: RecentFile[];
   115	}
   116	
   117	/**
   118	 * 分组。空输入返回空数组（不产出空组）：
   119	 * - `time`：按 GRID_TIME_BUCKET_ORDER 固定顺序，只出有内容的时间桶
   120	 * - `type`：按 RAIL_KIND_ORDER 固定顺序 + RAIL_KIND_LABELS
   121	 * - `theme`：按父目录（同一目录 = 同一主题），首次出现顺序
   122	 * - `none`：单组，label 为空串
   123	 */
   124	export function groupGridItems(
   125	  items: RecentFile[],
   126	  mode: GridGroupMode,
   127	  now: number = Date.now(),
   128	): GridGroup[] {
   129	  if (items.length === 0) return [];
   130	
   131	  if (mode === "none") {
   132	    return [{ key: "all", label: "", items: [...items] }];
   133	  }
   134	
   135	  if (mode === "time") {
   136	    const buckets = new Map<GridTimeBucket, RecentFile[]>();
   137	    for (const item of items) {
   138	      const bucket = timeBucketOf(item.openedAt, now);
   139	      const list = buckets.get(bucket);
   140	      if (list) list.push(item);
   141	      else buckets.set(bucket, [item]);
   142	    }
   143	    return GRID_TIME_BUCKET_ORDER.filter((b) => buckets.has(b)).map((b) => ({
   144	      key: b,
   145	      label: GRID_TIME_BUCKET_LABELS[b],
   146	      items: buckets.get(b)!,
   147	    }));
   148	  }
   149	
   150	  if (mode === "type") {
   151	    const buckets = new Map<FileTypeKind, RecentFile[]>();
   152	    for (const item of items) {
   153	      const kind = fileTypeOf(item.path);
   154	      const list = buckets.get(kind);
   155	      if (list) list.push(item);
   156	      else buckets.set(kind, [item]);
   157	    }
   158	    return RAIL_KIND_ORDER.filter((k) => buckets.has(k)).map((k) => ({
   159	      key: k,
   160	      label: RAIL_KIND_LABELS[k],
   161	      items: buckets.get(k)!,
   162	    }));
   163	  }
   164	
   165	  // theme = 父目录；根目录归 "/"，空父路径也归 "/"
   166	  const buckets = new Map<string, RecentFile[]>();
   167	  for (const item of items) {
   168	    const key = parentPathOf(item.path) || "/";
   169	    const list = buckets.get(key);
   170	    if (list) list.push(item);
   171	    else buckets.set(key, [item]);
   172	  }
   173	  return [...buckets.entries()].map(([key, list]) => ({
   174	    key,
   175	    label: key,
   176	    items: list,
   177	  }));
   178	}
   179	
   180	export interface TileSizeContext {

exec
/bin/zsh -c "nl -ba src/components/Grid/GridToolbar.tsx | sed -n '165,230p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   165	
   166	  useEffect(() => {
   167	    if (!typeMenuOpen) return;
   168	    const close = () => {
   169	      cancelTypeClose();
   170	      setTypeMenuOpen(false);
   171	      setTypeMenuIndex(-1);
   172	    };
   173	    window.addEventListener("scroll", close, true);
   174	    window.addEventListener("resize", close);
   175	    return () => {
   176	      window.removeEventListener("scroll", close, true);
   177	      window.removeEventListener("resize", close);
   178	    };
   179	  }, [typeMenuOpen]);
   180	
   181	  useEffect(
   182	    () => () => {
   183	      if (typeCloseTimer.current) clearTimeout(typeCloseTimer.current);
   184	    },
   185	    [],
   186	  );
   187	
   188	  return (
   189	    <div
   190	      data-testid="grid-toolbar"
   191	      className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-gray-200 px-4 py-2 dark:border-gray-700"
   192	    >
   193	      <div className="flex shrink-0 items-center gap-1 rounded border border-gray-200 px-2 py-0.5 dark:border-gray-700">
   194	        <Icon name="search" size={18} color="var(--app-text-3)" />
   195	        <input
   196	          ref={inputRef}
   197	          data-grid-search
   198	          data-testid="grid-search"
   199	          value={query}
   200	          placeholder="搜索文件（/）"
   201	          aria-label="搜索文件"
   202	          onChange={(e) => setQuery(e.target.value)}
   203	          className="w-40 min-w-0 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
   204	        />
   205	        {query !== "" && (
   206	          <button
   207	            type="button"
   208	            data-grid-search-clear
   209	            data-testid="grid-search-clear"
   210	            aria-label="清除搜索"
   211	            title="清除搜索"
   212	            onClick={() => {
   213	              setQuery("");
   214	              inputRef.current?.focus();
   215	            }}
   216	            className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
   217	          >
   218	            <Icon name="close" size={18} />
   219	          </button>
   220	        )}
   221	      </div>
   222	
   223	      <div
   224	        className="relative shrink-0"
   225	        onPointerEnter={openTypeMenu}
   226	        onPointerLeave={scheduleTypeClose}
   227	      >
   228	        <button
   229	          ref={typeTriggerRef}
   230	          type="button"

exec
/bin/zsh -c "nl -ba src/components/Grid/GridTile.tsx | sed -n '130,185p;285,330p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   130	          {[8, 16, 24, 14, 20, 10, 18].map((h, i) => (
   131	            <span
   132	              key={i}
   133	              style={{ height: h, background: "var(--type-audio)", width: 2 }}
   134	            />
   135	          ))}
   136	        </div>
   137	      );
   138	    }
   139	    const token = descriptor.kind === "html-page" ? "html" : "pdf";
   140	    return (
   141	      <div
   142	        className="flex h-full w-full flex-col justify-center gap-1 px-2"
   143	        style={{
   144	          background: `color-mix(in srgb, var(--type-${token}) 16%, var(--app-surface))`,
   145	        }}
   146	      >
   147	        <span
   148	          className="block h-0.5 w-2/3 rounded"
   149	          style={{ background: `var(--type-${token})` }}
   150	        />
   151	        <span
   152	          className="block h-0.5 w-1/2 rounded"
   153	          style={{ background: `var(--type-${token})` }}
   154	        />
   155	        <span
   156	          className="block h-0.5 w-3/4 rounded"
   157	          style={{ background: `var(--type-${token})` }}
   158	        />
   159	      </div>
   160	    );
   161	  }
   162	  if ((item.excerpt ?? "").trim() !== "") {
   163	    return (
   164	      <div className="h-full w-full overflow-hidden p-1.5 text-[8px] leading-[1.35] text-[var(--app-text-3)]">
   165	        {item.excerpt}
   166	      </div>
   167	    );
   168	  }
   169	  return (
   170	    <div className="flex h-full w-full items-center justify-center">
   171	      <Icon
   172	        name={iconOfType(kind)}
   173	        size={24}
   174	        color={blockColors ? colorOfType(kind) : undefined}
   175	      />
   176	    </div>
   177	  );
   178	}
   179	
   180	interface GridTileProps {
   181	  item: RecentFile;
   182	  size: GridTileSize;
   183	  selected: boolean;
   184	  pinned: boolean;
   185	  blockColors?: boolean;
   285	            <Icon name={iconOfType(kind)} size={18} color={iconColor} />
   286	            <span className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--app-text)]">
   287	              {item.title}
   288	            </span>
   289	          </div>
   290	          <div
   291	            data-tile-meta
   292	            className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-[var(--app-text-3)]"
   293	          >
   294	            <span className="shrink-0">{relativeDate(item.openedAt)}</span>
   295	            <span>·</span>
   296	            <button
   297	              type="button"
   298	              data-tile-folder
   299	              title={item.path}
   300	              onClick={(e) => {
   301	                e.stopPropagation();
   302	                onReveal(item.path);
   303	              }}
   304	              className="min-w-0 truncate text-left hover:text-[var(--app-text)]"
   305	            >
   306	              {parentPathOf(item.path)}
   307	            </button>
   308	          </div>
   309	          {excerptLines !== "" && (
   310	            <p
   311	              data-tile-excerpt
   312	              className={`mt-1 ${excerptLines} text-[11px] leading-snug text-[var(--app-text-3)]`}
   313	            >
   314	              {item.excerpt || "（暂无正文）"}
   315	            </p>
   316	          )}
   317	          {size === "large" && progressPct !== null && (
   318	            <div
   319	              data-tile-progress
   320	              className="mt-auto flex items-center gap-1 pt-1 text-[10px] text-[var(--app-text-3)]"
   321	            >
   322	              <span className="inline-block h-0.5 w-16 overflow-hidden rounded bg-[var(--app-border)]">
   323	                <span
   324	                  className="block h-full bg-[var(--app-accent)]"
   325	                  style={{ width: `${progressPct}%` }}
   326	                />
   327	              </span>
   328	              <span>
   329	                {tasks
   330	                  ? `${tasks.done}/${tasks.total}`

exec
/bin/zsh -c "nl -ba src/stores/index.ts | sed -n '420,470p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   420	let previewSeq = 0;
   421	function nextPreviewId(): string {
   422	  previewSeq += 1;
   423	  return `preview-${Date.now().toString(36)}-${previewSeq}`;
   424	}
   425	
   426	const initialState = {
   427	  activeTabId: null as string | null,
   428	  tabs: {} as Record<string, Tab>,
   429	  sidebarLeftVisible: true,
   430	  sidebarRightVisible: false,
   431	  readingMode: false,
   432	  immersiveChromeVisible: false,
   433	  immersivePeekPaneId: null,
   434	  tabDragActive: false,
   435	  scrollPositions: {} as Record<string, ScrollPosition>,
   436	  embedScrollPositions: {} as Record<string, ScrollPosition>,
   437	  recentFiles: [] as RecentFile[],
   438	  scene: "portal" as Scene,
   439	  gridTypeFilter: null as FileTypeKind | null,
   440	  gridQuery: "",
   441	  gridSort: "recent" as GridSort,
   442	  gridGroup: "time" as GridGroupMode,
   443	  gridPinnedOnly: false,
   444	  gridSelectedPath: null as string | null,
   445	  pinnedPaths: [] as string[],
   446	  splitDirection: null as SplitDirection | null,
   447	  splitTabIds: [] as string[],
   448	  splitActiveTabId: null as string | null,
   449	  splitEditorMode: "preview" as EditorMode,
   450	  horizontalSplitRatio: 0.5,
   451	  verticalSplitRatio: 0.5,
   452	  paneRoot: createRootLeaf() as PaneLayout,
   453	  focusedPaneId: "main",
   454	  lastTabsPaneId: "main",
   455	  fullscreenPaneId: null as string | null,
   456	  dragPaneSourceId: null as string | null,
   457	  draggingFilePath: null as string | null,
   458	  railState: "collapsed" as RailState,
   459	  railPinned: false,
   460	  railLayout: DEFAULT_RAIL_VIEW_SPEC.layout,
   461	  railDensity: DEFAULT_RAIL_VIEW_SPEC.density,
   462	  railCardHeight: DEFAULT_RAIL_VIEW_SPEC.cardHeight ?? DENSITY_HEIGHT.card,
   463	  railSearchOpen: false,
   464	  railQuery: "",
   465	  railSection: "recent" as RailSection,
   466	  railChip: "all" as RailChipKind,
   467	  railViewSpec: { ...DEFAULT_RAIL_VIEW_SPEC },
   468	  preview: null as PreviewState | null,
   469	  pinnedPreviews: [] as PreviewState[],
   470	  previewSettings: { ...DEFAULT_PREVIEW_SETTINGS },

exec
/bin/zsh -c "nl -ba src/components/PortalView.tsx | sed -n '300,380p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   300	          </section>
   301	        </>
   302	      )}
   303	
   304	      <section className="mb-8">
   305	        <h2 className="mb-3 text-xs font-medium text-[var(--app-text-2)]">
   306	          快速动作
   307	        </h2>
   308	        <div className="flex flex-wrap gap-2">
   309	          <button
   310	            onClick={onNewFile}
   311	            data-testid="quick-new"
   312	            className="flex items-center gap-1.5 rounded border border-[var(--app-border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--app-sunken)]"
   313	          >
   314	            <Icon name="file" size={18} />
   315	            新建文档
   316	          </button>
   317	          <button
   318	            onClick={onOpenFile}
   319	            data-testid="quick-open-file"
   320	            className="flex items-center gap-1.5 rounded border border-[var(--app-border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--app-sunken)]"
   321	          >
   322	            <Icon name="folder" size={18} />
   323	            打开文件
   324	          </button>
   325	          <button
   326	            onClick={onStudyPage}
   327	            data-testid="quick-study"
   328	            className="flex items-center gap-1.5 rounded border border-[var(--app-border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--app-sunken)]"
   329	          >
   330	            <Icon name="text" size={18} />
   331	            生成学习页
   332	          </button>
   333	          <button
   334	            onClick={onAiCommand}
   335	            data-testid="quick-ai"
   336	            className="flex items-center gap-1.5 rounded border border-[var(--app-border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--app-sunken)]"
   337	          >
   338	            <Icon name="settings" size={18} />
   339	            AI 指令
   340	          </button>
   341	        </div>
   342	      </section>
   343	
   344	      <footer
   345	        data-testid="portal-hint"
   346	        className="text-xs text-[var(--app-text-3)]"
   347	      >
   348	        ⌘P 搜索全部
   349	      </footer>
   350	    </div>
   351	  );
   352	}

exec
/bin/zsh -c "nl -ba src/components/QuickOpen.tsx | sed -n '1,230p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	import { useCallback, useEffect, useMemo, useRef, useState } from "react";
     2	import { useStore } from "../stores/index";
     3	import { fileTypeOf, iconOfType, colorOfType } from "../lib/fileType";
     4	import { buildQuickItems, type QuickItem } from "../lib/quickOpen";
     5	import type { IconName } from "../ui/icons";
     6	import Icon from "./Icon";
     7	
     8	/**
     9	 * 快速打开（reading-surface-refine 6.1）。
    10	 *
    11	 * ⌘P / Ctrl+P 唤起，跨三类联合过滤：当前页签、最近文件、命令（网格概览 / 设置）。
    12	 * Esc 关闭、↑↓ 选择、Enter 执行、点击执行、点遮罩（mousedown）关闭。
    13	 *
    14	 * 键盘在 window capture 阶段拦截并 stopPropagation，避免与 App 全局层、
    15	 * 设置/AI 的 Esc 分层逻辑抢键（与 ShortcutOverlay 同一范式）。
    16	 */
    17	
    18	export interface QuickOpenProps {
    19	  open: boolean;
    20	  query: string;
    21	  onQueryChange: (query: string) => void;
    22	  onClose: () => void;
    23	  onOpenTab: (tabId: string) => void;
    24	  onOpenPath: (path: string) => void;
    25	  onOpenGrid: () => void;
    26	  onOpenSettings: () => void;
    27	}
    28	
    29	const GROUPS: Array<{ kind: QuickItem["kind"]; label: string }> = [
    30	  { kind: "tab", label: "页签" },
    31	  { kind: "recent", label: "最近文件" },
    32	  { kind: "command", label: "命令" },
    33	];
    34	
    35	/** 命中片段高亮：查询为空时原样返回，避免无意义切分。 */
    36	function Highlight({ text, query }: { text: string; query: string }) {
    37	  const needle = query.trim().toLowerCase();
    38	  if (!needle) return <>{text}</>;
    39	  const lower = text.toLowerCase();
    40	  const parts: Array<{ text: string; hit: boolean }> = [];
    41	  let i = 0;
    42	  while (i < text.length) {
    43	    const idx = lower.indexOf(needle, i);
    44	    if (idx === -1) {
    45	      parts.push({ text: text.slice(i), hit: false });
    46	      break;
    47	    }
    48	    if (idx > i) parts.push({ text: text.slice(i, idx), hit: false });
    49	    parts.push({ text: text.slice(idx, idx + needle.length), hit: true });
    50	    i = idx + needle.length;
    51	  }
    52	  return (
    53	    <>
    54	      {parts.map((p, n) =>
    55	        p.hit ? (
    56	          <mark
    57	            key={n}
    58	            className="bg-transparent font-medium text-[var(--app-accent)]"
    59	          >
    60	            {p.text}
    61	          </mark>
    62	        ) : (
    63	          <span key={n}>{p.text}</span>
    64	        ),
    65	      )}
    66	    </>
    67	  );
    68	}
    69	
    70	export default function QuickOpen({
    71	  open,
    72	  query,
    73	  onQueryChange,
    74	  onClose,
    75	  onOpenTab,
    76	  onOpenPath,
    77	  onOpenGrid,
    78	  onOpenSettings,
    79	}: QuickOpenProps) {
    80	  const tabs = useStore((s) => s.tabs);
    81	  const recentFiles = useStore((s) => s.recentFiles);
    82	  const inputRef = useRef<HTMLInputElement>(null);
    83	  // 选中项与查询绑定：查询一变即回到首项，避免依赖 effect 重置。
    84	  const [selection, setSelection] = useState({ query: "", index: 0 });
    85	
    86	  const commands = useMemo(
    87	    () => [
    88	      {
    89	        key: "cmd:grid",
    90	        label: "网格概览",
    91	        hint: "⌘⇧\\",
    92	        icon: "grid" as IconName,
    93	        run: onOpenGrid,
    94	      },
    95	      {
    96	        key: "cmd:settings",
    97	        label: "设置",
    98	        hint: "⌘,",
    99	        icon: "settings" as IconName,
   100	        run: onOpenSettings,
   101	      },
   102	    ],
   103	    [onOpenGrid, onOpenSettings],
   104	  );
   105	
   106	  const items = useMemo(
   107	    () => buildQuickItems(tabs, recentFiles, commands, query),
   108	    [tabs, recentFiles, commands, query],
   109	  );
   110	
   111	  const { groups, indexByKey } = useMemo(() => {
   112	    const groups = GROUPS.map((g) => ({
   113	      ...g,
   114	      items: items.filter((it) => it.kind === g.kind),
   115	    })).filter((g) => g.items.length > 0);
   116	    const indexByKey = new Map<string, number>();
   117	    let i = 0;
   118	    for (const g of groups) {
   119	      for (const item of g.items) indexByKey.set(item.key, i++);
   120	    }
   121	    return { groups, indexByKey };
   122	  }, [items]);
   123	
   124	  const active =
   125	    selection.query === query
   126	      ? Math.min(selection.index, Math.max(0, items.length - 1))
   127	      : 0;
   128	
   129	  const prevOpenRef = useRef(open);
   130	  useEffect(() => {
   131	    if (open && !prevOpenRef.current) {
   132	      setSelection({ query, index: 0 });
   133	    }
   134	    prevOpenRef.current = open;
   135	  }, [open, query]);
   136	
   137	  useEffect(() => {
   138	    if (!open) return;
   139	    const id = requestAnimationFrame(() => inputRef.current?.focus());
   140	    return () => cancelAnimationFrame(id);
   141	  }, [open]);
   142	
   143	  const runItem = useCallback(
   144	    (item: QuickItem | undefined) => {
   145	      if (!item) return;
   146	      if (item.kind === "tab") onOpenTab(item.tabId);
   147	      else if (item.kind === "recent") onOpenPath(item.path);
   148	      else item.run();
   149	      onClose();
   150	    },
   151	    [onOpenTab, onOpenPath, onClose],
   152	  );
   153	
   154	  useEffect(() => {
   155	    if (!open) return;
   156	    const onKey = (e: KeyboardEvent) => {
   157	      if (e.isComposing) return;
   158	      if (e.key === "Escape") {
   159	        e.preventDefault();
   160	        e.stopPropagation();
   161	        onClose();
   162	      } else if (e.key === "ArrowDown") {
   163	        e.preventDefault();
   164	        e.stopPropagation();
   165	        setSelection((s) => ({
   166	          query,
   167	          index: Math.min(s.index + 1, items.length - 1),
   168	        }));
   169	      } else if (e.key === "ArrowUp") {
   170	        e.preventDefault();
   171	        e.stopPropagation();
   172	        setSelection((s) => ({ query, index: Math.max(s.index - 1, 0) }));
   173	      } else if (e.key === "Enter") {
   174	        e.preventDefault();
   175	        e.stopPropagation();
   176	        runItem(items[active]);
   177	      }
   178	    };
   179	    window.addEventListener("keydown", onKey, { capture: true });
   180	    return () =>
   181	      window.removeEventListener("keydown", onKey, { capture: true });
   182	  }, [open, items, active, query, onClose, onOpenTab, onOpenPath, runItem]);
   183	
   184	  if (!open) return null;
   185	
   186	  return (
   187	    <div
   188	      data-testid="quick-open"
   189	      role="dialog"
   190	      aria-label="快速打开"
   191	      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 p-4 pt-[12vh]"
   192	      onMouseDown={(e) => {
   193	        if (e.target === e.currentTarget) onClose();
   194	      }}
   195	    >
   196	      <div
   197	        className="w-[560px] max-w-full overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl"
   198	        onMouseDown={(e) => e.stopPropagation()}
   199	      >
   200	        <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-3 py-2.5">
   201	          <Icon name="search" size={18} className="text-[var(--app-text-3)]" />
   202	          <input
   203	            ref={inputRef}
   204	            data-testid="quick-open-input"
   205	            value={query}
   206	            onChange={(e) => onQueryChange(e.target.value)}
   207	            placeholder="搜索页签、最近文件与命令…"
   208	            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-3)]"
   209	          />
   210	          <kbd className="shrink-0 rounded border border-[var(--app-border-strong)] bg-[var(--app-sunken)] px-1.5 py-0.5 text-[11px] text-[var(--app-text-2)]">
   211	            Esc
   212	          </kbd>
   213	        </div>
   214	
   215	        <div
   216	          className="max-h-[52vh] overflow-y-auto py-1"
   217	          aria-label="快速打开结果"
   218	        >
   219	          {items.length === 0 && (
   220	            <div
   221	              data-testid="quick-open-empty"
   222	              className="px-3 py-6 text-center text-sm text-[var(--app-text-3)]"
   223	            >
   224	              没有匹配的结果
   225	            </div>
   226	          )}
   227	
   228	          {groups.map((group) => (
   229	            <section
   230	              key={group.kind}

exec
/bin/zsh -c "nl -ba src/lib/quickOpen.ts | sed -n '1,150p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	import type { RecentFile, Tab } from "../types";
     2	import type { IconName } from "../ui/icons";
     3	
     4	/**
     5	 * 快速打开的条目模型与纯过滤逻辑（reading-surface-refine 6.1）。
     6	 *
     7	 * 三类条目联合排序：当前页签 → 最近文件（已在页签里的去重）→ 命令。
     8	 * 过滤为 title + path 的大小写不敏感子串匹配；命令项的 title 即命令名。
     9	 * 逻辑放在这里是为了能脱离组件单测（与 railCards.ts 同一约定）。
    10	 */
    11	
    12	export type QuickItem =
    13	  | {
    14	      kind: "tab";
    15	      key: string;
    16	      title: string;
    17	      path: string | null;
    18	      tabId: string;
    19	    }
    20	  | {
    21	      kind: "recent";
    22	      key: string;
    23	      title: string;
    24	      path: string;
    25	    }
    26	  | {
    27	      kind: "command";
    28	      key: string;
    29	      label: string;
    30	      hint: string;
    31	      icon: IconName;
    32	      run: () => void;
    33	    };
    34	
    35	export interface QuickCommandSpec {
    36	  key: string;
    37	  label: string;
    38	  hint: string;
    39	  icon: IconName;
    40	  run: () => void;
    41	}
    42	
    43	/**
    44	 * 构建快速打开条目：页签 + 最近文件（去掉已打开的）+ 命令，按 query 过滤。
    45	 * query 为空时返回全部；recent 与 tab 同路径时只保留 tab。
    46	 */
    47	export function buildQuickItems(
    48	  tabs: Record<string, Tab>,
    49	  recentFiles: RecentFile[],
    50	  commands: QuickCommandSpec[],
    51	  query: string,
    52	): QuickItem[] {
    53	  const needle = query.trim().toLowerCase();
    54	  const match = (text: string) => text.toLowerCase().includes(needle);
    55	  const out: QuickItem[] = [];
    56	
    57	  for (const tab of Object.values(tabs)) {
    58	    if (needle && !match(tab.title) && !(tab.path && match(tab.path))) continue;
    59	    out.push({
    60	      kind: "tab",
    61	      key: `tab:${tab.id}`,
    62	      title: tab.title,
    63	      path: tab.path,
    64	      tabId: tab.id,
    65	    });
    66	  }
    67	
    68	  const openPaths = new Set(
    69	    Object.values(tabs)
    70	      .map((t) => t.path)
    71	      .filter((p): p is string => !!p),
    72	  );
    73	  for (const file of recentFiles) {
    74	    if (openPaths.has(file.path)) continue;
    75	    if (needle && !match(file.title) && !match(file.path)) continue;
    76	    out.push({
    77	      kind: "recent",
    78	      key: `recent:${file.path}`,
    79	      title: file.title,
    80	      path: file.path,
    81	    });
    82	  }
    83	
    84	  for (const command of commands) {
    85	    if (needle && !match(command.label)) continue;
    86	    out.push({ kind: "command", ...command });
    87	  }
    88	
    89	  return out;
    90	}

exec
/bin/zsh -c "nl -ba src/App.tsx | sed -n '580,640p;940,1020p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   580	        e.preventDefault();
   581	        store.setScene("workspace");
   582	        const ai = useAiEntryStore.getState();
   583	        ai.setInput("把这篇文档整理成一份学习页：要点、例子、自测题。");
   584	        ai.openOverlay();
   585	      }
   586	
   587	      // Cmd+Shift+S: collapse panes back to a single root leaf
   588	      if (meta && e.shiftKey && e.key.toLowerCase() === "s") {
   589	        e.preventDefault();
   590	        store.collapsePanes();
   591	      }
   592	
   593	      // Cmd+Shift+H: split the focused pane right
   594	      if (meta && e.shiftKey && e.key.toLowerCase() === "h") {
   595	        e.preventDefault();
   596	        store.splitPane("row");
   597	      }
   598	
   599	      // Cmd+Shift+V: 悬浮预览总开关（layout-portal 8.1）。
   600	      // 旧「向下分屏」的 ⌘⇧V 已移除——它与 ⌘⌥↓ 语义重复，让位给预览开关。
   601	      if (meta && e.shiftKey && e.key.toLowerCase() === "v") {
   602	        e.preventDefault();
   603	        store.togglePreviewEnabled();
   604	      }
   605	
   606	      // Cmd+Shift+Y: 属性面板显隐（doc-property-panel / P-2）。
   607	      // 只切显示状态，不改文档内容；隐藏时面板位置显示恢复提示。
   608	      if (meta && e.shiftKey && e.key.toLowerCase() === "y") {
   609	        e.preventDefault();
   610	        useDocPropertyPanelStore.getState().toggleHidden();
   611	      }
   612	
   613	      // Cmd+Shift+F: 沉浸阅读开关（layout-portal 15.1）
   614	      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
   615	        e.preventDefault();
   616	        store.setReadingMode(!store.readingMode);
   617	      }
   618	
   619	      // Cmd+Shift+P: 收藏当前文件（layout-portal 15.1）
   620	      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
   621	        e.preventDefault();
   622	        const tab = store.activeTabId ? store.tabs[store.activeTabId] : null;
   623	        if (tab?.path) store.togglePinnedPath(tab.path);
   624	      }
   625	
   626	      // Cmd+Shift+D 的 ⌘⇧D 分支已移到下方 document capture 阶段（见 captureHandler）：
   627	      // PDF 视图是 shadow DOM，内部控件可能消费按键，window 冒泡阶段收不到。
   628	
   629	      // Cmd+Alt+Right / Cmd+Alt+Down: split the focused pane (layout-portal 3.1)
   630	      if (meta && e.altKey && e.key === "ArrowRight") {
   631	        e.preventDefault();
   632	        store.splitPane("row");
   633	      }
   634	      if (meta && e.altKey && e.key === "ArrowDown") {
   635	        e.preventDefault();
   636	        store.splitPane("col");
   637	      }
   638	
   639	      // Cmd+Shift+Enter: fullscreen the focused pane
   640	      if (meta && e.shiftKey && e.key === "Enter") {
   940	          onPopupOpenChange={handleStatusBarPopupOpen}
   941	          onSetReaderWidth={(w) => {
   942	            useEditorStore.getState().setConfig({ readerWidth: w });
   943	            scheduleSave();
   944	          }}
   945	          onToggleVisibility={() => {
   946	            if (statusPeekTimer.current !== null) {
   947	              window.clearTimeout(statusPeekTimer.current);
   948	              statusPeekTimer.current = null;
   949	            }
   950	            setStatusBarPeek(false);
   951	            setStatusBarHidden((v) => !v);
   952	          }}
   953	        />
   954	      )}
   955	      <CaptureOverlay />
   956	      <SelectionPill />
   957	      <CommandOverlay />
   958	      <UndoBar />
   959	      <SnapshotPanel />
   960	      <AiBubble />
   961	      <FloatingPreviewList onOpenPath={handleOpenPath} />
   962	      {scene === "portal" && (
   963	        <div className="fixed inset-0 z-40 bg-[var(--app-surface)]">
   964	          <PortalView
   965	            onOpenFile={handleOpenFile}
   966	            onNewFile={handleNewFile}
   967	            onOpenPath={handleOpenPath}
   968	            onAiCommand={() => {
   969	              useStore.getState().setScene("workspace");
   970	              useAiEntryStore.getState().openOverlay();
   971	            }}
   972	            onStudyPage={() => {
   973	              useStore.getState().setScene("workspace");
   974	              useAiEntryStore
   975	                .getState()
   976	                .setInput("把这篇文档整理成一份学习页：要点、例子、自测题。");
   977	              useAiEntryStore.getState().openOverlay();
   978	            }}
   979	          />
   980	        </div>
   981	      )}
   982	      {scene === "grid" && (
   983	        <div className="fixed inset-0 z-40 bg-[var(--app-surface)]">
   984	          <GridView onOpenPath={handleOpenPath} />
   985	        </div>
   986	      )}
   987	      {scene === "settings" && (
   988	        <div className="fixed inset-0 z-50">
   989	          <SettingsView onClose={closeSettings} />
   990	        </div>
   991	      )}
   992	      {pickerOpen && templates.length > 0 && (
   993	        <TemplatePicker
   994	          templates={templates}
   995	          onSelect={handleTemplateSelect}
   996	          onBlank={handleBlankSelect}
   997	          onClose={() => setPickerOpen(false)}
   998	        />
   999	      )}
  1000	      <ShortcutOverlay
  1001	        open={shortcutsOpen}
  1002	        onClose={() => setShortcutsOpen(false)}
  1003	      />
  1004	      <QuickOpen
  1005	        open={quickOpenOpen}
  1006	        query={quickOpenQuery}
  1007	        onQueryChange={setQuickOpenQuery}
  1008	        onClose={handleQuickOpenClose}
  1009	        onOpenTab={handleQuickOpenTab}
  1010	        onOpenPath={handleQuickOpenPath}
  1011	        onOpenGrid={handleQuickOpenGrid}
  1012	        onOpenSettings={handleQuickOpenSettings}
  1013	      />
  1014	    </div>
  1015	  );
  1016	}
  1017	
  1018	export default App;

exec
/bin/zsh -c "nl -ba src/lib/shortcuts.ts | sed -n '1,150p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 快捷键注册表（layout-portal 15.1 / R-10）。
     3	 *
     4	 * 唯一真相源：实际 keymap 绑定、tooltip 键位显示、`?` 总览浮层、设置快捷键区
     5	 * 都从这里渲染。新增/调整快捷键只改本文件，四处消费点自动同源。
     6	 *
     7	 * 设计规则（批准设计 §11）：单 ⌘ 高频 / ⌘⇧ 二级 / ⌘⌥ 分栏 / ⌥ 过滤 / 不用三修饰键。
     8	 */
     9	
    10	export type ShortcutFamily =
    11	  | "global"
    12	  | "typeFilter"
    13	  | "mode"
    14	  | "file"
    15	  | "workspace"
    16	  | "navigation"
    17	  | "card"
    18	  | "ai"
    19	  | "media"
    20	  | "local";
    21	
    22	export type ShortcutScope = "global" | "local";
    23	
    24	export interface ShortcutDef {
    25	  id: string;
    26	  /** 展示形式，如 "⌘P"、"⌥4"、"⌘⌥→"。 */
    27	  keys: string;
    28	  label: string;
    29	  family: ShortcutFamily;
    30	  /** 作用域：global（默认，任意处生效）/ local（仅在其 context 激活时生效并优先于全局）。 */
    31	  scope?: ShortcutScope;
    32	  /** 局部键的生效上下文描述；scope 为 local 时必填。 */
    33	  context?: string;
    34	  /** 设置页「核心快捷键」展示的 7 条。 */
    35	  core?: boolean;
    36	  /** 冲突裁定说明：仅在有旧绑定竞争时填写，总览浮层会显示。 */
    37	  decision?: string;
    38	  implemented: boolean;
    39	}
    40	
    41	export const SHORTCUT_FAMILY_LABELS: Record<ShortcutFamily, string> = {
    42	  global: "全局",
    43	  typeFilter: "类型过滤",
    44	  mode: "模式",
    45	  file: "文件",
    46	  workspace: "工作区",
    47	  navigation: "导航",
    48	  card: "卡片直开",
    49	  ai: "AI / 其他",
    50	  media: "媒体",
    51	  local: "局部（上下文）",
    52	};
    53	
    54	/** 家族展示顺序（总览浮层与设置完整列表按此顺序分组）。 */
    55	export const SHORTCUT_FAMILY_ORDER: readonly ShortcutFamily[] = [
    56	  "global",
    57	  "typeFilter",
    58	  "mode",
    59	  "file",
    60	  "workspace",
    61	  "navigation",
    62	  "card",
    63	  "ai",
    64	  "media",
    65	  "local",
    66	];
    67	
    68	export const SHORTCUTS: readonly ShortcutDef[] = [
    69	  // ── 全局（10）─────────────────────────────────────────────
    70	  {
    71	    id: "global-quick-open",
    72	    keys: "⌘P",
    73	    label: "快速打开",
    74	    family: "global",
    75	    core: true,
    76	    decision: "页签 / 最近文件 / 命令；统一文件面板见 B-3",
    77	    implemented: true,
    78	  },
    79	  {
    80	    id: "global-reading-rail",
    81	    keys: "⌘\\",
    82	    label: "阅读空间",
    83	    family: "global",
    84	    core: true,
    85	    decision: "折叠态不切沉浸阅读（⌘⇧F 专责）",
    86	    implemented: true,
    87	  },
    88	  {
    89	    id: "global-rail-pin",
    90	    keys: "⌘⌥\\",
    91	    label: "固定 / 取消固定左边栏",
    92	    family: "global",
    93	    implemented: true,
    94	  },
    95	  {
    96	    id: "global-rail-pin-hidden",
    97	    keys: "⌘⇧X",
    98	    label: "左边栏固定隐藏 / 取消",
    99	    family: "global",
   100	    decision: "网格概览/门户下同样生效，不被场景门拦截（#924）",
   101	    implemented: true,
   102	  },
   103	  {
   104	    id: "global-grid",
   105	    keys: "⌘⇧\\",
   106	    label: "网格概览",
   107	    family: "global",
   108	    core: true,
   109	    decision: "旧右侧栏切换已移除，归网格概览",
   110	    implemented: true,
   111	  },
   112	  {
   113	    id: "global-ai-overlay",
   114	    keys: "⌘K",
   115	    label: "AI 快捷浮层",
   116	    family: "global",
   117	    core: true,
   118	    implemented: true,
   119	  },
   120	  {
   121	    id: "global-ai-bubble",
   122	    keys: "⌘⇧A",
   123	    label: "AI 小窗·停靠",
   124	    family: "global",
   125	    core: true,
   126	    implemented: true,
   127	  },
   128	  {
   129	    id: "global-settings",
   130	    keys: "⌘,",
   131	    label: "设置",
   132	    family: "global",
   133	    core: true,
   134	    implemented: true,
   135	  },
   136	  {
   137	    id: "global-preview-toggle",
   138	    keys: "⌘⇧V",
   139	    label: "悬浮预览开关",
   140	    family: "global",
   141	    decision: "旧向下分屏让位 ⌘⌥↓",
   142	    implemented: true,
   143	  },
   144	  {
   145	    id: "global-doc-property-toggle",
   146	    keys: "⌘⇧Y",
   147	    label: "属性面板显隐",
   148	    family: "global",
   149	    implemented: true,
   150	  },

exec
/bin/zsh -c "rg -n \"quickOpen|setQuickOpen|quick-open|search_documents|grid-toolbar|setGridQuery|gridPinnedOnly|setScene\\(|scene ===|PortalView\" src/App.tsx src/components src/stores/index.ts src/lib -g '*.ts' -g '*.tsx'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/stores/index.ts:234:  gridPinnedOnly: boolean;
src/stores/index.ts:322:  setGridQuery: (query: string) => void;
src/stores/index.ts:443:  gridPinnedOnly: false,
src/stores/index.ts:858:  setGridQuery: (query: string) => set({ gridQuery: query }),
src/stores/index.ts:876:  setGridPinnedOnly: (only: boolean) => set({ gridPinnedOnly: only }),
src/App.tsx:17:import PortalView from "./components/PortalView";
src/App.tsx:88:  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
src/App.tsx:89:  const [quickOpenQuery, setQuickOpenQuery] = useState("");
src/App.tsx:132:    st.setScene("settings");
src/App.tsx:138:    useStore.getState().setScene(target);
src/App.tsx:380:    store.setScene("grid");
src/App.tsx:384:  const handleQuickOpenClose = useCallback(() => setQuickOpenOpen(false), []);
src/App.tsx:387:    useStore.getState().setScene("workspace");
src/App.tsx:388:    setQuickOpenOpen(false);
src/App.tsx:392:      setQuickOpenOpen(false);
src/App.tsx:398:    setQuickOpenOpen(false);
src/App.tsx:402:    setQuickOpenOpen(false);
src/App.tsx:434:        setQuickOpenQuery("");
src/App.tsx:435:        setQuickOpenOpen((v) => !v);
src/App.tsx:440:      if (quickOpenOpen) return;
src/App.tsx:454:          if (store.scene === "grid") {
src/App.tsx:456:          } else if (store.scene === "workspace") {
src/App.tsx:475:        if (store.scene === "settings") return;
src/App.tsx:572:        store.setScene("workspace");
src/App.tsx:581:        store.setScene("workspace");
src/App.tsx:782:    quickOpenOpen,
src/App.tsx:796:          if (useStore.getState().scene === "settings") return;
src/App.tsx:962:      {scene === "portal" && (
src/App.tsx:964:          <PortalView
src/App.tsx:969:              useStore.getState().setScene("workspace");
src/App.tsx:973:              useStore.getState().setScene("workspace");
src/App.tsx:982:      {scene === "grid" && (
src/App.tsx:987:      {scene === "settings" && (
src/App.tsx:1005:        open={quickOpenOpen}
src/App.tsx:1006:        query={quickOpenQuery}
src/App.tsx:1007:        onQueryChange={setQuickOpenQuery}
src/components/Grid/GridToolbar.tsx:45:  const pinnedOnly = useStore((s) => s.gridPinnedOnly);
src/components/Grid/GridToolbar.tsx:53:  const setQuery = useStore((s) => s.setGridQuery);
src/components/Grid/GridToolbar.tsx:190:      data-testid="grid-toolbar"
src/lib/shortcuts.ts:71:    id: "global-quick-open",
src/components/GridView.tsx:61:  const pinnedOnly = useStore((s) => s.gridPinnedOnly);
src/components/GridView.tsx:187:    st.setScene("workspace");
src/components/GridView.tsx:229:        useStore.getState().setScene("workspace");
src/components/GridView.tsx:267:        st.setGridQuery("");
src/components/GridView.tsx:272:      st.setScene("portal");
src/components/Rail/ReadingRail.tsx:972:  // 本机检索：query 去抖 300ms 后调用 search_documents；序号丢弃过期响应。
src/components/Rail/ReadingRail.tsx:984:      invoke<SearchHit[]>("search_documents", { query, limit: SEARCH_LIMIT })
src/components/PortalView.tsx:58:export default function PortalView({
src/components/PortalView.tsx:77:  const setGridQuery = useStore((s) => s.setGridQuery);
src/components/PortalView.tsx:106:      setScene("workspace");
src/components/PortalView.tsx:119:      setScene("workspace");
src/components/PortalView.tsx:281:                    setGridQuery("");
src/components/PortalView.tsx:284:                    setScene("grid");
src/components/PortalView.tsx:319:            data-testid="quick-open-file"
src/components/StatusBar.tsx:364:          onClick={() => useStore.getState().setScene("portal")}
src/components/QuickOpen.tsx:4:import { buildQuickItems, type QuickItem } from "../lib/quickOpen";
src/components/QuickOpen.tsx:188:      data-testid="quick-open"
src/components/QuickOpen.tsx:204:            data-testid="quick-open-input"
src/components/QuickOpen.tsx:221:              data-testid="quick-open-empty"
src/components/QuickOpen.tsx:252:                    data-testid="quick-open-row"

exec
/bin/zsh -c "rg -n \"e\\.key\\.toLowerCase\\(\\) === \\\"f\\\"|e\\.key === \\\"f\\\"|Cmd\\+F|⌘F|find\" src/App.tsx src -g '*.ts' -g '*.tsx'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/App.tsx:614:      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
src/lib/finder.ts:8:  invoke("reveal_in_finder", { path }).catch((e) =>
src/hooks/useConfig.ts:244:    const tab = Object.values(useStore.getState().tabs).find(
src/components/Grid/GridToolbar.tsx:69:    TYPE_OPTIONS.findIndex((o) => o.kind === (filter ?? "all")),
src/renderers/markdown.ts:19:  findFencedRanges,
src/renderers/markdown.ts:406:  const codeRanges = findFencedRanges(content);
src/lib/frontmatter.ts:725:  const idx = parsed.fields.findIndex((f) => f.key === fromKey);
src/components/TabBar.tsx:24:import { revealInFinder } from "../lib/finder";
src/components/GridView.tsx:7:import { revealInFinder } from "../lib/finder";
src/components/GridView.tsx:122:      const existing = Object.values(store.tabs).find((t) => t.path === path);
src/components/GridView.tsx:226:      const tab = Object.values(tabs).find((t) => t.path === path);
src/lib/gridKeyboard.ts:78:  const idx = boxes.findIndex((b) => b.path === currentPath);
src/lib/gridKeyboard.ts:122:  const idx = boxes.findIndex((b) => b.path === currentPath);
src/App.tsx:614:      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
src/components/Preview/FloatingPreview.tsx:23:import { revealInFinder } from "../../lib/finder";
src/lib/paneTree.ts:126:export function findLeaf(root: PaneLayout, leafId: string): PaneLeaf | null {
src/lib/paneTree.ts:129:    findLeaf(root.children[0], leafId) ?? findLeaf(root.children[1], leafId)
src/lib/paneTree.ts:134:  return findLeaf(node, leafId) !== null;
src/lib/paneTree.ts:172:  return listLeaves(root).find((leaf) => leaf.tabs.includes(tabId)) ?? null;
src/lib/paneTree.ts:297:  const leaf = findLeaf(root, leafId);
src/lib/paneTree.ts:309:  const leaf = findLeaf(root, leafId);
src/lib/paneTree.ts:338:  const leaf = findLeaf(root, leafId);
src/lib/paneTree.ts:389:  const a = findLeaf(root, aId);
src/lib/paneTree.ts:390:  const b = findLeaf(root, bId);
src/lib/paneTree.ts:411:  const source = findLeaf(root, sourceId);
src/lib/paneTree.ts:413:  if (!findLeaf(root, targetId)) return root;
src/lib/paneTree.ts:429:  const source = findLeaf(root, sourceId);
src/lib/paneTree.ts:633:  if (!findLeaf(root, focusedId)) {
src/components/Rail/ReadingRail.tsx:70:import { revealInFinder } from "../../lib/finder";
src/stores/captureOverlay.ts:267:      // Per-line prefix detection: find the line containing the cursor
src/stores/captureOverlay.ts:398:      const entry = history.find((e) => e.id === undo.entryId);
src/stores/captureOverlay.ts:492:      const entry = history.find((e) => e.id === editingId);
src/stores/captureOverlay.ts:526:      const entry = get().history.find((e) => e.id === id);
src/lib/aiViewSpec.ts:235:  return SPEC_PRESETS.find((p) => p.id === id);
src/editors/callout-types.ts:106:  const edit = CALLOUT_EDIT_TYPES.find((entry) => entry.key === type);
src/editors/decorations/columns.ts:198:    const block = parseColumns(docText).find((b) => b.from === blockFrom);
src/editors/slash.ts:393:  const cmd = defaultCommands.find((entry) => entry.id === id);
src/editors/slash.ts:442:function findCodeMatch(
src/editors/slash.ts:1625:  const cmd = defaultCommands.find((entry) => entry.id === commandId);
src/editors/slash.ts:2027:    const codeMatch = findCodeMatch(state.commands, state.query);
src/components/StatusBar.tsx:42:  return THEME_OPTIONS.find((o) => o.value === theme)?.label ?? "亮色";
src/components/StatusBar.tsx:48:  return THEME_OPTIONS.find((o) => o.value === theme)?.icon ?? "sunBright";
src/components/StatusBar.tsx:199:    const current = items.findIndex((el) => el === document.activeElement);
src/components/StatusBar.tsx:201:      const checked = items.findIndex(
src/editors/decorations/table.ts:156:function findTables(
src/editors/decorations/table.ts:221:  const table = findTables(docText)[tableIndex];
src/editors/decorations/table.ts:223:  const cell = table.cells.find((c) => c.row === row && c.col === col);
src/editors/decorations/table.ts:730:        path.find(
src/editors/decorations/table.ts:797:    return findTables(view.state.doc.toString())[this.tableIndex] ?? null;
src/editors/decorations/table.ts:926:    const cell = block?.cells.find((c) => c.row === row && c.col === col);
src/editors/decorations/table.ts:1715:  for (const table of findTables(docText, activity)) {
src/components/SettingsView.tsx:348:      await invoke("reveal_in_finder", { path: dir });
src/components/SettingsView.tsx:1060:    const preset = PROVIDERS.find((p) => p.id === id);
src/components/SettingsView.tsx:1501:                      ROULETTE_SECTOR_META.find((m) => m.id === id)?.label ??
src/components/SettingsView.tsx:1573:                      HTML_TOOLBAR_ITEMS.find((item) => item.id === id)
src/editors/decorations/index.ts:136:function findActiveBlock(
src/editors/decorations/index.ts:143:    blocks.find((b) => cursorPos >= b.from && cursorPos <= b.to) ??
src/editors/decorations/index.ts:163:  const activeBlock = findActiveBlock(state, cursorPos);
src/components/ContextMenu.tsx:74:    const i = list.findIndex((el) => el === document.activeElement);
src/components/PortalView.tsx:103:    const tab = Object.values(tabs).find((t) => t.path === path);
src/editors/decorations/callout.ts:115:  const blocks = findCalloutBlocks(docText);
src/editors/decorations/callout.ts:272:  const block = findCalloutBlocks(view.state.doc.toString())[index];
src/editors/decorations/callout.ts:534:  const block = findCalloutBlocks(view.state.doc.toString())[index];
src/editors/decorations/callout.ts:830:function findCalloutBlocks(docText: string): CalloutBlock[] {
src/editors/decorations/callout.ts:911:  findCalloutBlocks(docText).forEach((block, index) => {
src/editors/orchestration/menu-stack.ts:95:    const existing = this.items.find(
src/editors/decorations/mermaid.ts:137:   * （长文档里每个 mermaid 块都闪一次）。CM6 的 `findWidget` 二论走
src/editors/decorations/alignFence.ts:12: * - 围栏代码块与缩进代码块内的 `:::` 是代码内容，跳过（复用 findFencedRanges）。
src/editors/decorations/alignFence.ts:20:import { findFencedRanges, isInsideRange } from "./image";
src/editors/decorations/alignFence.ts:42:function findAlignFences(docText: string): AlignFence[] {
src/editors/decorations/alignFence.ts:45:  const fencedRanges = findFencedRanges(docText);
src/editors/decorations/alignFence.ts:85:  for (const fence of findAlignFences(docText)) {
src/editors/orchestration/toolbar-shared.ts:132:    blocks.find((b) => pos >= b.from && pos <= b.to) ??
src/editors/decorations/image.ts:751:    const spec = IMAGE_RESIZE_HANDLES.find(
src/editors/decorations/image.ts:827:      const view = EditorView.findFromDOM(container);
src/editors/decorations/image.ts:995:    const spec = IMAGE_RESIZE_HANDLES.find(
src/editors/decorations/image.ts:1026:      const view = EditorView.findFromDOM(container);
src/editors/decorations/image.ts:1051:export function findFencedRanges(text: string): Array<[number, number]> {
src/editors/decorations/image.ts:1125:  const fencedRanges = findFencedRanges(docText);
src/editors/decorations/code.ts:140:function findUnclosedFenceStart(text: string): number | null {
src/editors/decorations/code.ts:191:  const unclosedFenceStart = findUnclosedFenceStart(text);
src/editors/decorations/code.ts:312:  const unclosed = findUnclosedFenceStart(text);
src/components/Content/PaneTreeView.tsx:493:          void invoke("reveal_in_finder", { path: tab.path }).catch((e) =>
src/editors/decorations/boldItalic.ts:93:export function findIncompleteBold(
src/editors/decorations/boldItalic.ts:113:export function findIncompleteItalic(
src/editors/decorations/boldItalic.ts:228:  const incompleteBold = findIncompleteBold(text);
src/editors/decorations/boldItalic.ts:244:  const incompleteItalic = findIncompleteItalic(text);
src/editors/decorations/link.ts:25:function findFencedRanges(text: string): Array<[number, number]> {
src/editors/decorations/link.ts:85:function findCalloutRanges(text: string): Array<[number, number]> {
src/editors/decorations/link.ts:129:function findTableRanges(text: string): Array<[number, number]> {
src/editors/decorations/link.ts:166:function findColumnRanges(text: string): Array<[number, number]> {
src/editors/decorations/link.ts:216:function findMermaidRanges(text: string): Array<[number, number]> {
src/editors/decorations/link.ts:290:    ...findFencedRanges(text),
src/editors/decorations/link.ts:291:    ...findCalloutRanges(text),
src/editors/decorations/link.ts:292:    ...findTableRanges(text),
src/editors/decorations/link.ts:293:    ...findColumnRanges(text),
src/editors/decorations/link.ts:294:    ...findMermaidRanges(text),
src/editors/orchestration/block-handle.ts:851:    const entry = this.handles.find((handle) => handle.dragging);
src/components/Content/VideoPlayer.tsx:438:        const idx = media.findIndex((i) => i.path === filePath);
src/components/Content/VideoPlayer.tsx:447:          const savedIdx = media.findIndex((i) => i.path === saved.path);
src/components/Content/VideoPlayer.tsx:490:        const owner = Object.values(store.tabs).find(
src/components/Content/VideoPlayer.tsx:1120:      const idx = subs.findIndex((s) => s.name === activeSubtitleRef.current);
src/editors/orchestration/horizontal-toolbar.ts:213:        const item = HTML_TOOLBAR_ITEMS.find((entry) => entry.id === id);
src/components/Content/PdfViewer.tsx:173:        const zoomIdx = centerItems.findIndex((i) => i.id === "zoom-toolbar");
src/editors/orchestration/block-menu.ts:450:          const index = blocks.findIndex((b) => b.from === block.from);
src/editors/orchestration/floating-toolbar.ts:659:      const format = (id: string) => actions.format.find((i) => i.id === id)!;
src/editors/orchestration/roulette-view.ts:252:  const sectorOf = (id: SectorId) => ROOT_SECTORS.find((s) => s.id === id)!;
src/editors/orchestration/roulette-view.ts:739:    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
src/components/Content/DocPropertyBar.tsx:872:      const tagsField = parsed.fields.find(
src/components/Content/DocPropertyBar.tsx:1246:  const titleField = fields.find((f) => f.key === "title") ?? null;
src/components/Content/DocPropertyBar.tsx:1248:    fields.find((f) => f.key === "tags" && Array.isArray(f.value)) ?? null;
src/components/Content/DocPropertyBar.tsx:1305:        const ti = next.findIndex((f) => f.key === "tags");
src/components/Content/DocPropertyBar.tsx:1337:      const ti = next.findIndex((f) => f.key === "tags");
src/components/Content/DocPropertyBar.tsx:1394:        : rows.find((e) => e.getAttribute("data-row-id") === String(index));
src/editors/slash-filter.ts:132: * `/bt` still finds 标题.
src/stores/index.ts:48:  findLeaf,
src/stores/index.ts:85:  const focused = findLeaf(root, focusedId);
src/stores/index.ts:87:  const last = findLeaf(root, lastTabsId);
src/stores/index.ts:89:  return listLeaves(root).find(isTabs) ?? null;
src/stores/index.ts:109: * 持久化布局里的 `pane-N` 撞车，造成 `findLeaf` / `data-pane-id` / React key
src/stores/index.ts:482:    const existing = Object.values(state.tabs).find((t) => t.path === path);
src/stores/index.ts:644:    const activeTabId = findLeaf(paneRoot, focusedPaneId)?.activeTabId ?? null;
src/stores/index.ts:716:    const leaf = findLeaf(state.paneRoot, state.focusedPaneId);
src/stores/index.ts:887:      const prev = s.recentFiles.find((f) => f.path === path);
src/stores/index.ts:928:            ? Object.keys(s.tabs).find(
src/stores/index.ts:950:            ? Object.keys(s.tabs).find(
src/stores/index.ts:962:          ? s.splitTabIds.find((id) => id !== tabId) || null
src/stores/index.ts:1000:    if (!findLeaf(state.paneRoot, state.focusedPaneId)) return;
src/stores/index.ts:1035:    const target = findLeaf(state.paneRoot, leafId);
src/stores/index.ts:1058:    const activeTabId = findLeaf(root, focusedPaneId)?.activeTabId ?? null;
src/stores/index.ts:1072:    const target = findLeaf(state.paneRoot, targetLeafId);
src/stores/index.ts:1095:    const leaf = findLeaf(state.paneRoot, id);
src/stores/index.ts:1118:    const leaf = findLeaf(state.paneRoot, leafId);
src/stores/index.ts:1138:    const leaf = findLeaf(root, focusedId);
src/stores/index.ts:1203:    const found = findLeaf(state.paneRoot, targetLeafId);
src/stores/index.ts:1215:    const existing = Object.values(state.tabs).find((t) => t.path === path);
src/stores/index.ts:1287:      const emptied = findLeaf(root, source.id);
src/stores/index.ts:1418:          : s.pinnedPreviews.find((p) => p.id === id)
src/stores/index.ts:1510:    if (findLeaf(state.paneRoot, AI_PANE_ID)) return AI_PANE_ID;
src/stores/index.ts:1528:      focusedPaneId: findLeaf(root, state.focusedPaneId)
src/stores/index.ts:1538:    if (!findLeaf(state.paneRoot, AI_PANE_ID)) return;
src/stores/index.ts:1549:      activeTabId: findLeaf(root, focusedPaneId)?.activeTabId ?? null,
src/components/Content/mediaPlayerState.ts:49:    const index = sources.findIndex((s) => mediaKey(s) === key);
src/components/Content/mediaPlayerState.ts:95:      ? (sources.find((s) => mediaKey(s) === lastKey) ?? null)
src/components/Content/PreviewView.tsx:18:import { revealInFinder } from "../../lib/finder";
src/components/Content/PreviewView.tsx:201:    const tab = Object.values(s.tabs).find((t) => t.path === filePath);
src/components/TabInfoPopover.tsx:5:import { revealInFinder } from "../lib/finder";
src/components/TabInfoPopover.tsx:106:      ? s.recentFiles.find((f) => f.path === tab.path)?.openedAt
src/editors/decorations/fileEmbed.ts:775:    const spec = IMAGE_RESIZE_HANDLES.find(
src/editors/decorations/fileEmbed.ts:814:      const view = EditorView.findFromDOM(container);
src/__tests__/paneTreeStore.test.ts:3:import { findLeaf, leafCount, listLeaves } from "../lib/paneTree";
src/__tests__/paneTreeStore.test.ts:6:  const tab = Object.values(useStore.getState().tabs).find(
src/__tests__/paneTreeStore.test.ts:21:    const leaf = findLeaf(s.paneRoot, "main");
src/__tests__/paneTreeStore.test.ts:50:    expect(findLeaf(s.paneRoot, "main")?.tabs).not.toContain(aId);
src/__tests__/paneTreeStore.test.ts:51:    expect(findLeaf(s.paneRoot, "main")?.tabs).toContain(tabIdByPath("/b.md"));
src/__tests__/paneTreeStore.test.ts:52:    expect(findLeaf(s.paneRoot, targetId)?.tabs).toContain(aId);
src/__tests__/paneTreeStore.test.ts:65:    expect(findLeaf(s.paneRoot, focused)?.tabs).toEqual([tabIdByPath("/b.md")]);
src/__tests__/paneTreeStore.test.ts:66:    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([tabIdByPath("/a.md")]);
src/__tests__/paneTreeStore.test.ts:81:    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([tabIdByPath("/a.md")]);
src/__tests__/paneTreeStore.test.ts:217:    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([bId]);
src/__tests__/paneTreeStore.test.ts:218:    const newLeaf = findLeaf(s.paneRoot, s.focusedPaneId);
src/__tests__/paneTreeStore.test.ts:232:    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([aId]);
src/__tests__/paneTreeStore.test.ts:250:    expect(findLeaf(s.paneRoot, "main")).toBeNull();
src/__tests__/paneTreeStore.test.ts:252:    const holder = leaves.find((leaf) => leaf.tabs.includes(bId));
src/editors/decorations/cell-selection.ts:21:  /** 表格在文档中的序号（来自 `findTables`）。 */
src/components/CaptureOverlay.tsx:719:                    const globalIdx = store.history.findIndex(
src/components/Content/HtmlRangeToolbar.tsx:195:          const command = ALIGNS.find(
src/editors/setup.ts:91:    // searchKeymap 保留 Cmd+F 查找：basicSetup 撤掉后这是唯一还需要的面板键位。
src/__tests__/useAiEntry.test.ts:151:    const saveCall = invokeMock.mock.calls.find((c) => c[0] === "save_config");
src/__tests__/mediaPlayerHost.test.tsx:23:    const miniBarClose = Array.from(container.querySelectorAll("button")).find(
src/__tests__/mediaPlayerHost.test.tsx:45:    const miniBarClose = Array.from(container.querySelectorAll("button")).find(
src/components/Content/OutlineMenu.tsx:153:      return shownHeadings.findIndex((heading) => {
src/__tests__/docsGovernanceGate.test.ts:134:    const hit = res.violations.find((v) => v.rule === RULE.relativeLinks);
src/__tests__/docsGovernanceGate.test.ts:229:      const valid = res.results.find(
src/__tests__/docsGovernanceGate.test.ts:232:      const invalid = res.results.find(
src/__tests__/aiForms.test.ts:20:import { findLeaf, leafCount, listLeaves } from "../lib/paneTree";
src/__tests__/aiForms.test.ts:67:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)?.kind).toBe("ai");
src/__tests__/aiForms.test.ts:73:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).toBeNull();
src/__tests__/aiForms.test.ts:88:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).not.toBeNull();
src/__tests__/aiForms.test.ts:90:    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).toBeNull();
src/__tests__/paneTree.test.ts:8:  findLeaf,
src/__tests__/paneTree.test.ts:54:      expect(findLeaf(t, "leaf-3")).not.toBeNull();
src/__tests__/paneTree.test.ts:164:      expect(findLeaf(t, "main")).toMatchObject({
src/__tests__/paneTree.test.ts:169:      expect(findLeaf(t, "main")).toMatchObject({
src/__tests__/paneTree.test.ts:216:      expect(findLeaf(root, "main")).toMatchObject({
src/__tests__/paneTree.test.ts:220:      expect(findLeaf(root, "leaf-2")).toMatchObject({
src/__tests__/paneTree.test.ts:260:      expect(findLeaf(root, "main")).toMatchObject({ tabs: ["t1"] });
src/__tests__/editor/blockModel.test.ts:235:  it("finds the block containing a position", () => {
src/__tests__/editor/blockModel.test.ts:257:  it("finds the correct block at a boundary position", () => {
src/__tests__/lib/export/zip.test.ts:155:  const entry = zipEntryInfos(bytes).find((e) => e.name === name);
src/__tests__/editor/callout-insert.test.ts:102:    const link = commands.find((cmd) => cmd.id === "callout-snippet-link");
src/__tests__/editor/slash.test.ts:156:    ).findIndex((row) => row.textContent?.includes("标注"));
src/__tests__/editor/slash.test.ts:168:    const callout = defaultCommands.find((c) => c.id === "callout");
src/__tests__/editor/slash.test.ts:179:    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:205:    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:222:    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:245:    ).find((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:265:    ).find((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:285:    ).find((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:306:    const colIdx = rows.findIndex((row) => row.textContent?.includes("分栏"));
src/__tests__/editor/slash.test.ts:328:    const colIdx = rows.findIndex((row) => row.textContent?.includes("分栏"));
src/__tests__/editor/slash.test.ts:350:    const colIdx = rows.findIndex((row) => row.textContent?.includes("分栏"));
src/__tests__/editor/slash.test.ts:369:    const colIdx = rows.findIndex((row) => row.textContent?.includes("分栏"));
src/__tests__/editor/slash.test.ts:386:    const colIdx = rows.findIndex((row) => row.textContent?.includes("分栏"));
src/__tests__/editor/slash.test.ts:424:    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:440:    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:456:    const tableIdx = rows.findIndex((row) => row.textContent?.includes("表格"));
src/__tests__/editor/slash.test.ts:652:    ).find((cell) => cell.textContent?.includes("标题"));
src/__tests__/editor/slash.test.ts:950:    const imageRef = defaultCommands.find((c) => c.id === "image-ref");
src/__tests__/editor/slash.test.ts:951:    const mediaRef = defaultCommands.find((c) => c.id === "media-ref");
src/__tests__/quickOpen.test.tsx:124:      items.find((el) => el.getAttribute("data-quick-kind") === "recent"),
src/__tests__/editor/slashFilter.test.ts:65:  const found = defaultCommands.find((cmd) => cmd.id === commandId);
src/__tests__/editor/slashFilter.test.ts:136:          CALLOUT_EDIT_TYPES.find((t) => `callout-${t.key}` === c.id)?.emoji,
src/__tests__/editor/slashFilter.test.ts:193:  it("finds the task by its code", () => {
src/__tests__/editor/slashFilter.test.ts:197:  it("finds the heading by pinyin initials", () => {
src/__tests__/editor/slashFilter.test.ts:203:  it("finds the divider by its label pinyin", () => {
src/__tests__/useConfig.hotApply.test.ts:95:    const before = Object.values(useStore.getState().tabs).find(
src/__tests__/useConfig.hotApply.test.ts:109:    const after = Object.values(useStore.getState().tabs).find(
src/__tests__/editor/colorPalette.test.ts:36:    const red = BACKGROUND_COLORS.find((c) => c.className === "mdb-bg-red");
src/__tests__/editor/colorPalette.test.ts:38:    const blue = BACKGROUND_COLORS.find((c) => c.className === "mdb-bg-blue");
src/__tests__/paneAutoLayout.test.ts:107:      const src = before.find((b) => b.id === l.id)!;
src/__tests__/editors/editorIcons.test.ts:6:    defaultCommands.find((c) => c.label === label)?.icon ?? "";
src/__tests__/editors/editorIcons.test.ts:32:    const columns = defaultCommands.find((c) => c.label === "分栏");
src/__tests__/providers.test.ts:39:      const preset = PROVIDERS.find((p) => p.id === id);
src/__tests__/providers.test.ts:46:    const custom = PROVIDERS.find((p) => p.id === "custom");
src/__tests__/selectionPill.test.tsx:101:  const btn = Array.from(pill.querySelectorAll("button")).find(
src/__tests__/editor/spanPair.test.ts:14:    const outer = pairs.find((p) => p.family === "mdb-color")!;
src/__tests__/editor/spanPair.test.ts:15:    const inner = pairs.find((p) => p.family === "mdb-bg")!;
src/__tests__/frontmatter.test.ts:300:    const f = parseFrontmatter(r.text).fields.find((x) => x.key === "count");
src/__tests__/editors/decorations/list.test.ts:150:      const line = result.find((d) => d.value.spec.class?.includes(LIST_CLASS));
src/__tests__/editors/decorations/list.test.ts:156:      const line = result.find((d) => d.value.spec.class?.includes(LIST_CLASS));
src/__tests__/editors/decorations/list.test.ts:162:      const replace = result.find(
src/__tests__/editors/decorations/list.test.ts:172:      const marker = result.find((d) =>
src/__tests__/editors/decorations/list.test.ts:183:      const marker = result.find((d) =>
src/__tests__/editors/decorations/list.test.ts:204:      const widget = result.find((d) => d.value.spec.widget);
src/__tests__/editors/decorations/heading.test.ts:107:      const marker = result.find((d) =>
src/__tests__/editors/decorations/heading.test.ts:118:      const marker = result.find((d) =>
src/__tests__/editors/decorations/heading.test.ts:126:      const text = result.find((d) => d.value.spec.class?.includes("cm-h3"));
src/__tests__/editors/decorations/heading.test.ts:133:      const text = result.find((d) => d.value.spec.class?.includes("cm-h3"));
src/__tests__/editors/decorations/quote.test.ts:67:      const replaceDeco = result.find((d) => !d.value.spec.class);
src/__tests__/editors/decorations/quote.test.ts:75:      const lineDeco = result.find((d) => d.value.spec.class);
src/__tests__/editors/decorations/quote.test.ts:88:      const replace = result.find((d) => !d.value.spec.class);
src/__tests__/editors/decorations/quote.test.ts:96:      const lineTwo = two.find((d) =>
src/__tests__/editors/decorations/quote.test.ts:102:      const lineNone = none.find((d) =>
src/__tests__/editors/decorations/quote.test.ts:116:      const replace = result.find((d) => !d.value.spec.class);
src/__tests__/editors/decorations/quote.test.ts:124:      expect(result.find((d) => !d.value.spec.class)).toBeUndefined();
src/__tests__/editors/decorations/quote.test.ts:125:      const marker = result.find(
src/__tests__/editors/decorations/quote.test.ts:135:      const line = inactive.find((d) =>
src/__tests__/editors/decorations/quote.test.ts:141:      const activeLine = active.find((d) =>
src/__tests__/editors/decorations/fold.test.ts:80:    const replace = decorations.find((d) => d.value.spec.widget === undefined);
src/__tests__/editor/callout-emoji-picker.test.ts:86:      ).find((btn) => btn.getAttribute("data-emoji") === emoji) ?? null
src/__tests__/lib/shortcuts.test.ts:71:    const local = SHORTCUTS.find((s) => s.scope === "local")!;
src/__tests__/editors/decorations/boldItalic.test.ts:10:  findIncompleteBold,
src/__tests__/editors/decorations/boldItalic.test.ts:108:      const strong = result.find((d) => d.value.spec.class === BOLD_CLASS);
src/__tests__/editors/decorations/boldItalic.test.ts:123:      const strike = result.find((d) => d.value.spec.class === STRIKE_CLASS);
src/__tests__/editors/decorations/boldItalic.test.ts:131:      const underline = result.find(
src/__tests__/editors/decorations/boldItalic.test.ts:143:      const tinted = result.find((d) => d.value.spec.class === "cm-bg-blue");
src/__tests__/editors/decorations/boldItalic.test.ts:154:        color.find((d) => d.value.spec.class === "cm-color-green"),
src/__tests__/editors/decorations/boldItalic.test.ts:160:        font.find((d) => d.value.spec.class === "cm-font-serif"),
src/__tests__/editors/decorations/boldItalic.test.ts:169:        result.find((d) => d.value.spec.class === "cm-color-green"),
src/__tests__/editors/decorations/boldItalic.test.ts:172:        result.find((d) => d.value.spec.class === "cm-bg-purple"),
src/__tests__/editors/decorations/boldItalic.test.ts:183:        result.find((d) => d.value.spec.class === "cm-color-red"),
src/__tests__/editors/decorations/boldItalic.test.ts:185:      const underlined = result.find(
src/__tests__/editors/decorations/boldItalic.test.ts:215:      expect(findIncompleteBold("**bold**")).toBeNull();
src/__tests__/editors/decorations/code.test.ts:122:      const widget = result.find((d) => d.value.spec.widget);
src/__tests__/editors/decorations/code.test.ts:131:      const widget = result.find((d) => d.value.spec.widget);
src/__tests__/editors/decorations/code.test.ts:146:      expect(result.find((d) => d.value.spec.widget)).toBeUndefined();

exec
/bin/zsh -c "nl -ba src/App.tsx | sed -n '350,490p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   350	        (tab.fileKind === "image" || tab.fileKind === "html");
   351	      if (viewportPreview) {
   352	        window.dispatchEvent(
   353	          new CustomEvent("preview-scale", { detail: delta }),
   354	        );
   355	        return;
   356	      }
   357	      const editorStore = useEditorStore.getState();
   358	      // 编辑态与阅读态共用一个字号：readerFontSize 驱动 --type-font-size，
   359	      // 编辑器的纸面排版也读它，Cmd+/- 因此不会在编辑态失效。
   360	      const applied =
   361	        delta === 0
   362	          ? 17
   363	          : Math.max(12, Math.min(32, editorStore.fontSize + delta));
   364	      editorStore.setFontSize(applied);
   365	      editorStore.setConfig({ readerFontSize: applied });
   366	      document.documentElement.style.setProperty(
   367	        "--editor-font-size",
   368	        `${applied}px`,
   369	      );
   370	      scheduleSave();
   371	    },
   372	    [scheduleSave],
   373	  );
   374	
   375	  // 打开网格概览：清空筛选与选中后切场景。键盘 ⌘⇧\ 与顶栏入口共用同一动作。
   376	  const openGridOverview = useCallback(() => {
   377	    const store = useStore.getState();
   378	    store.setGridTypeFilter(null);
   379	    store.setGridSelectedPath(null);
   380	    store.setScene("grid");
   381	  }, []);
   382	
   383	  // 快速打开回调保持引用稳定，避免 QuickOpen 的键盘 effect 每帧重订阅。
   384	  const handleQuickOpenClose = useCallback(() => setQuickOpenOpen(false), []);
   385	  const handleQuickOpenTab = useCallback((tabId: string) => {
   386	    useStore.getState().switchTab(tabId);
   387	    useStore.getState().setScene("workspace");
   388	    setQuickOpenOpen(false);
   389	  }, []);
   390	  const handleQuickOpenPath = useCallback(
   391	    (path: string) => {
   392	      setQuickOpenOpen(false);
   393	      void handleOpenPath(path);
   394	    },
   395	    [handleOpenPath],
   396	  );
   397	  const handleQuickOpenGrid = useCallback(() => {
   398	    setQuickOpenOpen(false);
   399	    openGridOverview();
   400	  }, [openGridOverview]);
   401	  const handleQuickOpenSettings = useCallback(() => {
   402	    setQuickOpenOpen(false);
   403	    openSettings();
   404	  }, [openSettings]);
   405	
   406	  // macOS 原生菜单（Cmd+=/-/0）拦截键盘，由 Rust 侧菜单项转发为 preview-scale 事件
   407	  useEffect(() => {
   408	    if (!isTauri) return;
   409	    let unlisten: (() => void) | undefined;
   410	    listen<number>("preview-scale", (e) => handleScaleDelta(e.payload))
   411	      .then((un) => {
   412	        unlisten = un;
   413	      })
   414	      .catch(() => {});
   415	    return () => {
   416	      unlisten?.();
   417	    };
   418	  }, [handleScaleDelta]);
   419	
   420	  useEffect(() => {
   421	    const handler = (e: KeyboardEvent) => {
   422	      const meta = e.metaKey || e.ctrlKey;
   423	      const store = useStore.getState();
   424	
   425	      // Cmd/Ctrl+P：阻止浏览器原生打印，改为打开快速打开（页签/最近文件/命令）。
   426	      // 已打开时再按一次关闭；输入法组合态（e.isComposing）不拦截，避免打断上屏。
   427	      if (
   428	        meta &&
   429	        !e.shiftKey &&
   430	        e.key.toLowerCase() === "p" &&
   431	        !e.isComposing
   432	      ) {
   433	        e.preventDefault();
   434	        setQuickOpenQuery("");
   435	        setQuickOpenOpen((v) => !v);
   436	        return;
   437	      }
   438	
   439	      // 快速打开打开时，其余全局快捷键让位（Esc/↑↓/Enter 由 QuickOpen 自行拦截）。
   440	      if (quickOpenOpen) return;
   441	
   442	      const questionKey = e.key === "?" || (e.key === "/" && e.shiftKey);
   443	      if (questionKey && !meta && !e.altKey && !isEditableTarget(e.target)) {
   444	        e.preventDefault();
   445	        setShortcutsOpen((v) => !v);
   446	        return;
   447	      }
   448	
   449	      if (e.altKey && !meta && !e.shiftKey) {
   450	        if (isEditableTarget(e.target)) return;
   451	        const kind = kindFromDigitCode(e.code);
   452	        if (kind !== undefined) {
   453	          e.preventDefault();
   454	          if (store.scene === "grid") {
   455	            store.setGridTypeFilter(kind);
   456	          } else if (store.scene === "workspace") {
   457	            store.setRailChip(kind ?? "all");
   458	            store.setRailSection("category");
   459	            if (store.railState === "collapsed") store.setRailState("hover");
   460	          }
   461	          return;
   462	        }
   463	      }
   464	
   465	      // Cmd+Shift+\ : 打开网格概览（任意场景可用，门户里也能直接进）
   466	      if (meta && e.shiftKey && (e.key === "\\" || e.key === "|")) {
   467	        e.preventDefault();
   468	        openGridOverview();
   469	        return;
   470	      }
   471	
   472	      // Cmd+Shift+X: 左边栏固定隐藏 / 取消（C3 / D14）。隐藏后箭头热区收起，滑入不唤出。
   473	      if (meta && e.shiftKey && e.key.toLowerCase() === "x") {
   474	        // 设置场景是覆盖层：底下 rails 不可见，静默改隐藏态用户无从察觉（对抗复审 #924 越界）。
   475	        if (store.scene === "settings") return;
   476	        e.preventDefault();
   477	        const es = useEditorStore.getState();
   478	        const next = !(es.config.railPinHidden ?? false);
   479	        es.setConfig({ railPinHidden: next });
   480	        if (next) store.setRailState("collapsed");
   481	        void saveAppConfig();
   482	        return;
   483	      }
   484	
   485	      // 门户/网格是覆盖层：底下的编辑器不可见，快捷键作用上去用户看不见后果
   486	      // （⌘W 关掉隐藏页签、⌘B 改隐藏文档……）。这里只放行不触碰隐藏状态的键。
   487	      if (store.scene !== "workspace") {
   488	        if (!meta) return;
   489	        const k = e.key.toLowerCase();
   490	        if (!["o", "n", ",", "p", "k", "a"].includes(k)) return;

exec
/bin/zsh -c "nl -ba src/components/GridView.tsx | sed -n '35,100p;235,290p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
    35	function isEditableTarget(target: EventTarget | null): boolean {
    36	  const el = target as HTMLElement | null;
    37	  if (!el || !el.tagName) return false;
    38	  const tag = el.tagName;
    39	  return (
    40	    tag === "INPUT" ||
    41	    tag === "TEXTAREA" ||
    42	    tag === "SELECT" ||
    43	    el.isContentEditable === true
    44	  );
    45	}
    46	
    47	/**
    48	 * 网格概览（layout-portal 10.1）。⌘⇧\ 打开：不聚焦搜索、默认选中第一张卡；
    49	 * 顶部单行全下拉；tile 三型（大 2×2 仅收藏/继续阅读）；时间粘性分组头；
    50	 * 点击档经 8.1 悬浮预览窗贴卡右缘 +12 弹出真内容。
    51	 */
    52	export default function GridView({
    53	  onOpenPath,
    54	}: {
    55	  onOpenPath: (path: string) => void | Promise<void>;
    56	}) {
    57	  const filter = useStore((s) => s.gridTypeFilter);
    58	  const query = useStore((s) => s.gridQuery);
    59	  const sort = useStore((s) => s.gridSort);
    60	  const group = useStore((s) => s.gridGroup);
    61	  const pinnedOnly = useStore((s) => s.gridPinnedOnly);
    62	  const pinnedPaths = useStore((s) => s.pinnedPaths);
    63	  const selectedPath = useStore((s) => s.gridSelectedPath);
    64	  const recentFiles = useStore((s) => s.recentFiles);
    65	  const scrollPositions = useStore((s) => s.scrollPositions);
    66	  const viewSpec = useStore((s) => s.viewSpec);
    67	
    68	  const setGridSelectedPath = useStore((s) => s.setGridSelectedPath);
    69	
    70	  const scrollRef = useRef<HTMLDivElement>(null);
    71	  const rafRef = useRef<number | null>(null);
    72	  const sequenceRef = useRef<string[]>([]);
    73	  const metaHeldRef = useRef(false);
    74	  const [sequence, setSequence] = useState<string[]>([]);
    75	  const [metaHeld, setMetaHeld] = useState(false);
    76	
    77	  const filtered = useMemo(() => {
    78	    const list = filterGridItems(recentFiles, {
    79	      type: filter,
    80	      query,
    81	      pinnedOnly,
    82	      pinnedPaths,
    83	    });
    84	    return viewSpec.unreadOnly
    85	      ? list.filter((f) => isUnread(f.path, scrollPositions))
    86	      : list;
    87	  }, [
    88	    recentFiles,
    89	    filter,
    90	    query,
    91	    pinnedOnly,
    92	    pinnedPaths,
    93	    viewSpec.unreadOnly,
    94	    scrollPositions,
    95	  ]);
    96	
    97	  const sorted = useMemo(() => sortGridItems(filtered, sort), [filtered, sort]);
    98	  const groups = useMemo(() => groupGridItems(sorted, group), [sorted, group]);
    99	  const visible = useMemo(() => groups.flatMap((g) => g.items), [groups]);
   100	  const continuePath = recentFiles[0]?.path ?? null;
   235	  );
   236	
   237	  const onCardClick = useCallback(
   238	    (item: RecentFile, el: HTMLElement) => {
   239	      useStore.getState().setGridSelectedPath(item.path);
   240	      if (openCardPreview(item, el)) return;
   241	      openItem(item.path);
   242	    },
   243	    [openCardPreview, openItem],
   244	  );
   245	
   246	  const onTileHoverEnter = useCallback(
   247	    (item: RecentFile, el: HTMLElement) => {
   248	      const st = useStore.getState();
   249	      if (!st.previewSettings.enabled) return;
   250	      if (!gridTriggerOf(st.previewSettings.gridMode).onHover) return;
   251	      openCardPreview(item, el);
   252	    },
   253	    [openCardPreview],
   254	  );
   255	
   256	  // Esc：先关预览，再清搜索，最后退回门户
   257	  useEffect(() => {
   258	    const onKey = (e: KeyboardEvent) => {
   259	      if (e.key !== "Escape") return;
   260	      e.preventDefault();
   261	      const st = useStore.getState();
   262	      if (st.preview) {
   263	        st.closePreview();
   264	        return;
   265	      }
   266	      if (st.gridQuery !== "") {
   267	        st.setGridQuery("");
   268	        return;
   269	      }
   270	      st.setGridTypeFilter(null);
   271	      st.setGridSelectedPath(null);
   272	      st.setScene("portal");
   273	    };
   274	    window.addEventListener("keydown", onKey);
   275	    return () => window.removeEventListener("keydown", onKey);
   276	  }, []);
   277	
   278	  // 按住 ⌘/Ctrl 显示视口编号；滚动 / 窗口失焦时重算或清除
   279	  useEffect(() => {
   280	    const el = scrollRef.current;
   281	    if (!el) return;
   282	
   283	    const clearSequence = () => {
   284	      metaHeldRef.current = false;
   285	      setMetaHeld(false);
   286	      sequenceRef.current = [];
   287	      setSequence([]);
   288	    };
   289	    const onScroll = () => {
   290	      if (metaHeldRef.current) scheduleRecompute();

exec
/bin/zsh -c "nl -ba src/types/index.ts | sed -n '145,205p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   145	}
   146	
   147	export interface CapturePosition {
   148	  x: number;
   149	  y: number;
   150	}
   151	
   152	export interface RecentFile {
   153	  path: string;
   154	  title: string;
   155	  openedAt: string;
   156	  /** 打开时截下的前 160 字，门户卡片用它显示真摘要（不是占位文案） */
   157	  excerpt?: string;
   158	}
   159	
   160	/** 本机全文检索命中（search_documents 返回，Rust 侧 serde camelCase）。 */
   161	export interface SearchHit {
   162	  path: string;
   163	  /** frontmatter title 优先，缺省为文件名 */
   164	  title: string;
   165	  openedAt: string;
   166	  /** 命中片段（含命中词上下文），供前端高亮 */
   167	  excerpt: string;
   168	  /** 命中字段：filename / title / h1 / content */
   169	  matchedIn: string;
   170	}
   171	
   172	/** 应用场景（Layout Portal §1） */
   173	export type Scene = "portal" | "workspace" | "grid" | "settings";
   174	
   175	export interface ScrollPosition {
   176	  scrollPos: number;
   177	  contentHeight: number;
   178	}
   179	
   180	export interface Tab {
   181	  id: string;
   182	  title: string;
   183	  path: string | null;
   184	  fileKind: FileKind;
   185	  content: string;
   186	  dirty: boolean;
   187	  editorMode: EditorMode;
   188	  scrollPos: number;
   189	  contentHeight: number;
   190	}
   191	
   192	export type RawMarkdown = string;
   193	
   194	export interface TranslationState {
   195	  active: boolean;
   196	  requestId: string | null;
   197	  text: string;
   198	  loading: boolean;
   199	  error: string | null;
   200	}
   201	
   202	export interface TranslationChunk {
   203	  requestId: string;
   204	  text: string;
   205	  done: boolean;

exec
/bin/zsh -c "nl -ba src-tauri/src/commands/search.rs | sed -n '1,340p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	use std::fs;
     2	use std::path::{Path, PathBuf};
     3	use std::time::{SystemTime, UNIX_EPOCH};
     4	
     5	use serde::Serialize;
     6	use tracing::info;
     7	
     8	use crate::commands::file::is_supported_document;
     9	use crate::commands::recent::{is_heavy_dir, is_html, strip_html_tags, to_iso8601};
    10	use crate::errors::AppError;
    11	
    12	/// 递归深度上限：从 home 起算。用户在 `~/Projects/.../notes` 这类深层目录
    13	/// 里的文件要能搜到，故给到 7 层；heavy dir 与 MAX_SCAN_FILES 兜底。
    14	const MAX_DEPTH: usize = 7;
    15	/// 默认返回条数：防止全盘扫描后一次性回传过多。
    16	const DEFAULT_LIMIT: usize = 30;
    17	/// 单次检索最多回传的条数。
    18	const MAX_LIMIT: usize = 100;
    19	/// 最多扫描的文件数：超过即停止，避免大目录卡住 UI。
    20	const MAX_SCAN_FILES: usize = 20_000;
    21	/// 正文匹配读取上限：只读前 64KB，避免整读大文件。
    22	const MATCH_READ_LIMIT: u64 = 64 * 1024;
    23	/// 命中片段窗口半径（命中词前后各取这么多字符）。
    24	const EXCERPT_RADIUS: usize = 60;
    25	
    26	/// 本机检索命中：路径、标题、修改时间与命中片段。
    27	#[derive(Debug, Serialize, Clone)]
    28	#[serde(rename_all = "camelCase")]
    29	pub struct SearchHit {
    30	    pub path: String,
    31	    /// frontmatter title 优先，缺省用文件名。
    32	    pub title: String,
    33	    pub opened_at: String,
    34	    /// 命中片段（含命中词上下文），供前端高亮。
    35	    pub excerpt: String,
    36	    /// 命中字段：filename / title / h1 / content。
    37	    pub matched_in: String,
    38	}
    39	
    40	struct ScanDoc {
    41	    path: PathBuf,
    42	    modified: SystemTime,
    43	}
    44	
    45	fn scan_documents(dir: &Path, depth: usize, out: &mut Vec<ScanDoc>) {
    46	    if depth > MAX_DEPTH || out.len() >= MAX_SCAN_FILES {
    47	        return;
    48	    }
    49	    let entries = match fs::read_dir(dir) {
    50	        Ok(entries) => entries,
    51	        Err(_) => return,
    52	    };
    53	    for entry in entries.flatten() {
    54	        let path = entry.path();
    55	        let name = match path.file_name().and_then(|n| n.to_str()) {
    56	            Some(name) => name,
    57	            None => continue,
    58	        };
    59	        if name.starts_with('.') {
    60	            continue;
    61	        }
    62	        let metadata = match entry.metadata() {
    63	            Ok(metadata) => metadata,
    64	            Err(_) => continue,
    65	        };
    66	        if metadata.is_dir() {
    67	            if is_heavy_dir(name) {
    68	                continue;
    69	            }
    70	            scan_documents(&path, depth + 1, out);
    71	        } else if metadata.is_file() && is_supported_document(&path) {
    72	            out.push(ScanDoc {
    73	                path,
    74	                modified: metadata.modified().unwrap_or(UNIX_EPOCH),
    75	            });
    76	        }
    77	    }
    78	}
    79	
    80	/// 取 YAML frontmatter 里的 `title:`（不含引号）。无 frontmatter 或无 title 时返回 None。
    81	fn frontmatter_title(text: &str) -> Option<String> {
    82	    let mut lines = text.lines();
    83	    if lines.next()?.trim() != "---" {
    84	        return None;
    85	    }
    86	    for line in lines {
    87	        let t = line.trim();
    88	        if t == "---" {
    89	            break;
    90	        }
    91	        if let Some(rest) = t.strip_prefix("title:") {
    92	            let value = rest.trim().trim_matches('"').trim_matches('\'').trim();
    93	            if !value.is_empty() {
    94	                return Some(value.to_string());
    95	            }
    96	        }
    97	    }
    98	    None
    99	}
   100	
   101	/// 取第一个 H1：Markdown 的首个 `# ` 行；HTML 的首个 `<h1>` 内容（去标签）。
   102	fn first_h1(raw: &str, html: bool) -> Option<String> {
   103	    if html {
   104	        let lower = raw.to_ascii_lowercase();
   105	        let start = lower.find("<h1")?;
   106	        let rest = &raw[start..];
   107	        let open_end = start + rest.find('>')? + 1;
   108	        let close_rel = lower[open_end..].find("</h1>")?;
   109	        let inner = &raw[open_end..open_end + close_rel];
   110	        let text = strip_html_tags(inner).trim().to_string();
   111	        if text.is_empty() {
   112	            None
   113	        } else {
   114	            Some(text)
   115	        }
   116	    } else {
   117	        for line in raw.lines() {
   118	            if let Some(rest) = line.trim_start().strip_prefix("# ") {
   119	                let h = rest.trim();
   120	                if !h.is_empty() {
   121	                    return Some(h.to_string());
   122	                }
   123	            }
   124	        }
   125	        None
   126	    }
   127	}
   128	
   129	/// 大小写不敏感地找 needle 在 text 中的首个字符下标（needle 已小写）。
   130	fn find_char_pos(text: &str, needle: &str) -> Option<usize> {
   131	    let needle: Vec<char> = needle.chars().collect();
   132	    if needle.is_empty() {
   133	        return Some(0);
   134	    }
   135	    let hay: Vec<char> = text.chars().collect();
   136	    if needle.len() > hay.len() {
   137	        return None;
   138	    }
   139	    for i in 0..=hay.len() - needle.len() {
   140	        let mut ok = true;
   141	        for j in 0..needle.len() {
   142	            if !char_eq_ci(hay[i + j], needle[j]) {
   143	                ok = false;
   144	                break;
   145	            }
   146	        }
   147	        if ok {
   148	            return Some(i);
   149	        }
   150	    }
   151	    None
   152	}
   153	
   154	/// `b` 已是小写；仅在小写化后相等时认为命中。
   155	fn char_eq_ci(a: char, b: char) -> bool {
   156	    if a == b {
   157	        return true;
   158	    }
   159	    let mut it = a.to_lowercase();
   160	    it.next() == Some(b) && it.next().is_none()
   161	}
   162	
   163	/// 截取命中词前后各 `EXCERPT_RADIUS` 个字符的片段，首尾用 `…` 标注截断。
   164	fn snippet_around(text: &str, query: &str) -> String {
   165	    let Some(pos) = find_char_pos(text, &query.to_lowercase()) else {
   166	        return String::new();
   167	    };
   168	    let needle_len = query.chars().count();
   169	    let chars: Vec<char> = text.chars().collect();
   170	    let start = pos.saturating_sub(EXCERPT_RADIUS);
   171	    let end = (pos + needle_len + EXCERPT_RADIUS).min(chars.len());
   172	    let mut out = String::new();
   173	    if start > 0 {
   174	        out.push('…');
   175	    }
   176	    out.extend(chars[start..end].iter().copied());
   177	    if end < chars.len() {
   178	        out.push('…');
   179	    }
   180	    out
   181	}
   182	
   183	/// 匹配单个文档：文件名 → title → H1 → 正文，返回首个命中字段与片段。
   184	fn match_document(doc: &ScanDoc, query: &str, lower_query: &str) -> Option<SearchHit> {
   185	    use std::io::Read;
   186	    let file = fs::File::open(&doc.path).ok()?;
   187	    let mut buf = Vec::new();
   188	    file.take(MATCH_READ_LIMIT).read_to_end(&mut buf).ok()?;
   189	    let raw = String::from_utf8_lossy(&buf);
   190	    let html = is_html(&doc.path);
   191	    let body = if html {
   192	        strip_html_tags(&raw)
   193	    } else {
   194	        raw.to_string()
   195	    };
   196	    let filename = doc
   197	        .path
   198	        .file_name()
   199	        .and_then(|n| n.to_str())
   200	        .unwrap_or("")
   201	        .to_string();
   202	    if filename.is_empty() {
   203	        return None;
   204	    }
   205	    let title = frontmatter_title(&raw).unwrap_or_else(|| filename.clone());
   206	    let h1 = first_h1(&raw, html);
   207	
   208	    let matched_in = if filename.to_lowercase().contains(lower_query) {
   209	        "filename"
   210	    } else if title.to_lowercase().contains(lower_query) {
   211	        "title"
   212	    } else if h1
   213	        .as_deref()
   214	        .map(|h| h.to_lowercase().contains(lower_query))
   215	        .unwrap_or(false)
   216	    {
   217	        "h1"
   218	    } else if body.to_lowercase().contains(lower_query) {
   219	        "content"
   220	    } else {
   221	        return None;
   222	    };
   223	
   224	    let excerpt = match matched_in {
   225	        "content" => snippet_around(&body, query),
   226	        "h1" => h1.clone().unwrap_or_default(),
   227	        "title" => title.clone(),
   228	        _ => filename.clone(),
   229	    };
   230	
   231	    Some(SearchHit {
   232	        path: doc.path.to_string_lossy().into_owned(),
   233	        title,
   234	        opened_at: to_iso8601(doc.modified),
   235	        excerpt,
   236	        matched_in: matched_in.to_string(),
   237	    })
   238	}
   239	
   240	/// 扫描 home（跳过 heavy dir），按 mtime 倒序返回前 `limit` 条命中。
   241	pub fn collect_search_hits(home: &Path, query: &str, limit: usize) -> Vec<SearchHit> {
   242	    let query = query.trim();
   243	    if query.is_empty() {
   244	        return Vec::new();
   245	    }
   246	    let lower_query = query.to_lowercase();
   247	    let mut docs: Vec<ScanDoc> = Vec::new();
   248	    scan_documents(home, 0, &mut docs);
   249	    let mut hits: Vec<SearchHit> = docs
   250	        .iter()
   251	        .filter_map(|doc| match_document(doc, query, &lower_query))
   252	        .collect();
   253	    // RFC3339（固定格式、毫秒、Z）字典序即时间序
   254	    hits.sort_by(|a, b| b.opened_at.cmp(&a.opened_at));
   255	    hits.truncate(limit);
   256	    hits
   257	}
   258	
   259	/// 本机全文检索：文件名 / frontmatter title / H1 / 正文，大小写不敏感，限量返回。
   260	#[tauri::command]
   261	pub async fn search_documents(
   262	    query: String,
   263	    limit: Option<usize>,
   264	) -> Result<Vec<SearchHit>, AppError> {
   265	    let home = dirs::home_dir().ok_or(AppError::Io {
   266	        context: "Cannot determine home dir".into(),
   267	        source: std::io::Error::other("no home"),
   268	    })?;
   269	    let limit = limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
   270	    let hits = tokio::task::spawn_blocking(move || collect_search_hits(&home, &query, limit))
   271	        .await
   272	        .map_err(|e| AppError::Io {
   273	            context: "search_documents join".into(),
   274	            source: std::io::Error::other(e.to_string()),
   275	        })?;
   276	    info!(count = hits.len(), "本机检索完成");
   277	    Ok(hits)
   278	}
   279	
   280	#[cfg(test)]
   281	mod tests {
   282	    use super::*;
   283	    use std::fs;
   284	
   285	    fn temp_home(tag: &str) -> PathBuf {
   286	        tempfile::Builder::new()
   287	            .prefix(&format!("biaoyue_search_{tag}_"))
   288	            .tempdir()
   289	            .unwrap()
   290	            .keep()
   291	    }
   292	
   293	    fn write_with_mtime(path: &Path, modified: SystemTime, content: &[u8]) {
   294	        if let Some(parent) = path.parent() {
   295	            fs::create_dir_all(parent).unwrap();
   296	        }
   297	        fs::write(path, content).unwrap();
   298	        fs::File::open(path)
   299	            .unwrap()
   300	            .set_modified(modified)
   301	            .unwrap();
   302	    }
   303	
   304	    fn at(secs: u64) -> SystemTime {
   305	        UNIX_EPOCH + std::time::Duration::from_secs(secs)
   306	    }
   307	
   308	    #[test]
   309	    fn body_match_is_case_insensitive_and_excerpt_keeps_hit() {
   310	        let home = temp_home("body");
   311	        let root = home.join("Documents");
   312	        write_with_mtime(
   313	            &root.join("note.md"),
   314	            at(1000),
   315	            "# 标题\n\n这是正文，其中包含 Alpha 关键词。\n".as_bytes(),
   316	        );
   317	
   318	        let hits = collect_search_hits(&home, "alpha", 30);
   319	        assert_eq!(hits.len(), 1);
   320	        assert_eq!(hits[0].matched_in, "content");
   321	        assert!(hits[0].excerpt.contains("Alpha"), "片段应含命中词");
   322	        assert!(hits[0].title.contains("note"));
   323	
   324	        let _ = fs::remove_dir_all(&home);
   325	    }
   326	
   327	    #[test]
   328	    fn filename_title_and_h1_all_match_in_order() {
   329	        let home = temp_home("fields");
   330	        let root = home.join("Documents");
   331	        let content = "---\ntitle: 年度报告\n---\n\n# 总结\n\n正文。\n";
   332	        write_with_mtime(&root.join("报告.md"), at(1000), content.as_bytes());
   333	
   334	        let by_query = |q: &str| {
   335	            collect_search_hits(&home, q, 30)
   336	                .into_iter()
   337	                .next()
   338	                .map(|h| (h.matched_in, h.title))
   339	        };
   340	

exec
/bin/zsh -c "nl -ba src-tauri/src/commands/recent.rs | sed -n '1,280p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	use std::fs;
     2	use std::path::{Path, PathBuf};
     3	use std::time::{SystemTime, UNIX_EPOCH};
     4	
     5	use tracing::info;
     6	
     7	use crate::commands::file::{is_binary_extension, is_supported_document};
     8	use crate::config::RecentFile;
     9	use crate::errors::AppError;
    10	
    11	const MAX_DEPTH: usize = 2;
    12	const MAX_RESULTS: usize = 50;
    13	const EXCERPT_LIMIT: usize = 400;
    14	/// 摘要读取窗口：足够覆盖常见 `<script>` / `<style>` 块，避免闭标签落在窗口外导致正文泄露。
    15	const EXCERPT_READ_LIMIT: u64 = 8192;
    16	pub(crate) const SCAN_DIRS: &[&str] = &["Documents", "Desktop", "Downloads"];
    17	
    18	/// 应用能打开的类型：文档 + 图片/视频/PDF/音频（最近文件卡片要显示这些类型）。
    19	fn is_supported(path: &Path) -> bool {
    20	    is_supported_document(path) || is_binary_extension(path)
    21	}
    22	
    23	pub(crate) fn is_html(path: &Path) -> bool {
    24	    matches!(
    25	        path.extension()
    26	            .and_then(|e| e.to_str())
    27	            .map(|e| e.to_ascii_lowercase())
    28	            .as_deref(),
    29	        Some("html") | Some("htm")
    30	    )
    31	}
    32	
    33	struct ScanItem {
    34	    path: PathBuf,
    35	    modified: SystemTime,
    36	}
    37	
    38	pub(crate) fn is_heavy_dir(name: &str) -> bool {
    39	    matches!(
    40	        name,
    41	        "node_modules"
    42	            | ".git"
    43	            | "target"
    44	            | "dist"
    45	            | ".next"
    46	            | "__pycache__"
    47	            | "vendor"
    48	            | ".cache"
    49	            | "Library"
    50	            | "Applications"
    51	    )
    52	}
    53	
    54	fn scan_dir(dir: &Path, depth: usize, out: &mut Vec<ScanItem>) {
    55	    if depth > MAX_DEPTH {
    56	        return;
    57	    }
    58	    let entries = match fs::read_dir(dir) {
    59	        Ok(entries) => entries,
    60	        Err(_) => return,
    61	    };
    62	    for entry in entries.flatten() {
    63	        let path = entry.path();
    64	        let name = match path.file_name().and_then(|n| n.to_str()) {
    65	            Some(name) => name,
    66	            None => continue,
    67	        };
    68	        if name.starts_with('.') {
    69	            continue;
    70	        }
    71	        let metadata = match entry.metadata() {
    72	            Ok(metadata) => metadata,
    73	            Err(_) => continue,
    74	        };
    75	        if metadata.is_dir() {
    76	            if is_heavy_dir(name) {
    77	                continue;
    78	            }
    79	            scan_dir(&path, depth + 1, out);
    80	        } else if metadata.is_file() && is_supported(&path) {
    81	            let modified = metadata.modified().unwrap_or(UNIX_EPOCH);
    82	            out.push(ScanItem { path, modified });
    83	        }
    84	    }
    85	}
    86	
    87	pub(crate) fn to_iso8601(time: SystemTime) -> String {
    88	    chrono::DateTime::<chrono::Utc>::from(time).to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
    89	}
    90	
    91	fn decode_entities(text: &str) -> String {
    92	    text.replace("&lt;", "<")
    93	        .replace("&gt;", ">")
    94	        .replace("&quot;", "\"")
    95	        .replace("&#39;", "'")
    96	        .replace("&apos;", "'")
    97	        .replace("&nbsp;", " ")
    98	        .replace("&amp;", "&")
    99	}
   100	
   101	pub(crate) fn strip_html_tags(html: &str) -> String {
   102	    let lower = html.to_ascii_lowercase();
   103	    let mut out = String::with_capacity(html.len());
   104	    let mut index = 0;
   105	    while index < html.len() {
   106	        let Some(offset) = lower[index..].find('<') else {
   107	            out.push_str(&html[index..]);
   108	            break;
   109	        };
   110	        let start = index + offset;
   111	        out.push_str(&html[index..start]);
   112	        let after = &lower[start..];
   113	        let (close, tag_len) = if after.starts_with("<script") {
   114	            ("</script", 7)
   115	        } else if after.starts_with("<style") {
   116	            ("</style", 6)
   117	        } else {
   118	            ("", 0)
   119	        };
   120	        if tag_len > 0 {
   121	            if let Some(pos) = lower[start..].find(close) {
   122	                let mut end = start + pos + close.len();
   123	                if let Some(gt) = lower[end..].find('>') {
   124	                    end += gt + 1;
   125	                }
   126	                out.push(' ');
   127	                index = end;
   128	                continue;
   129	            }
   130	        }
   131	        match lower[start..].find('>') {
   132	            Some(pos) => {
   133	                let end = start + pos + 1;
   134	                out.push(' ');
   135	                index = end;
   136	            }
   137	            None => break,
   138	        }
   139	    }
   140	    decode_entities(&out)
   141	}
   142	
   143	/// 读取正文开头（≤400 字节）：HTML 先剥掉 script/style 与标签。
   144	fn read_excerpt(path: &Path, strip_tags: bool) -> Option<String> {
   145	    use std::io::Read;
   146	    let file = fs::File::open(path).ok()?;
   147	    let mut buf = Vec::new();
   148	    file.take(EXCERPT_READ_LIMIT).read_to_end(&mut buf).ok()?;
   149	    let raw = String::from_utf8_lossy(&buf);
   150	    let mut text = if strip_tags {
   151	        strip_html_tags(&raw)
   152	    } else {
   153	        raw.into_owned()
   154	    };
   155	    text = text.trim().to_string();
   156	    if text.is_empty() {
   157	        return None;
   158	    }
   159	    if text.len() <= EXCERPT_LIMIT {
   160	        return Some(text);
   161	    }
   162	    let mut end = EXCERPT_LIMIT;
   163	    while end > 0 && !text.is_char_boundary(end) {
   164	        end -= 1;
   165	    }
   166	    Some(text[..end].to_string())
   167	}
   168	
   169	/// 扫描 home 下 Documents / Desktop / Downloads 的最近文档：深度 ≤2、mtime 倒序、限量 50。
   170	pub fn collect_recent_documents(home: &Path) -> Vec<RecentFile> {
   171	    let mut items: Vec<ScanItem> = Vec::new();
   172	    for name in SCAN_DIRS {
   173	        let dir = home.join(name);
   174	        if dir.is_dir() {
   175	            scan_dir(&dir, 0, &mut items);
   176	        }
   177	    }
   178	
   179	    items.sort_by(|a, b| b.modified.cmp(&a.modified));
   180	
   181	    items
   182	        .into_iter()
   183	        .take(MAX_RESULTS)
   184	        .map(|item| {
   185	            let excerpt = if is_binary_extension(&item.path) {
   186	                None
   187	            } else {
   188	                read_excerpt(&item.path, is_html(&item.path))
   189	            };
   190	            RecentFile {
   191	                path: item.path.to_string_lossy().into_owned(),
   192	                title: item
   193	                    .path
   194	                    .file_name()
   195	                    .and_then(|n| n.to_str())
   196	                    .unwrap_or("")
   197	                    .to_string(),
   198	                opened_at: to_iso8601(item.modified),
   199	                excerpt,
   200	            }
   201	        })
   202	        .collect()
   203	}
   204	
   205	/// 列出本机最近文档（mtime 倒序，最多 50 条）。
   206	#[tauri::command]
   207	pub async fn list_recent_documents() -> Result<Vec<RecentFile>, AppError> {
   208	    let home = dirs::home_dir().ok_or(AppError::Io {
   209	        context: "Cannot determine home dir".into(),
   210	        source: std::io::Error::other("no home"),
   211	    })?;
   212	    let docs = tokio::task::spawn_blocking(move || collect_recent_documents(&home))
   213	        .await
   214	        .map_err(|e| AppError::Io {
   215	            context: "list_recent_documents join".into(),
   216	            source: std::io::Error::other(e.to_string()),
   217	        })?;
   218	    info!(count = docs.len(), "本机最近文档扫描完成");
   219	    Ok(docs)
   220	}
   221	
   222	#[cfg(test)]
   223	mod tests {
   224	    use super::*;
   225	    use std::fs;
   226	
   227	    fn temp_home(tag: &str) -> PathBuf {
   228	        let dir = tempfile::Builder::new()
   229	            .prefix(&format!("biaoyue_recent_{tag}_"))
   230	            .tempdir()
   231	            .unwrap()
   232	            .keep();
   233	        dir
   234	    }
   235	
   236	    fn write_with_mtime(path: &Path, modified: SystemTime) {
   237	        if let Some(parent) = path.parent() {
   238	            fs::create_dir_all(parent).unwrap();
   239	        }
   240	        fs::write(path, b"doc").unwrap();
   241	        fs::File::open(path)
   242	            .unwrap()
   243	            .set_modified(modified)
   244	            .unwrap();
   245	    }
   246	
   247	    fn at(secs: u64) -> SystemTime {
   248	        UNIX_EPOCH + std::time::Duration::from_secs(secs)
   249	    }
   250	
   251	    #[test]
   252	    fn scans_three_roots_and_sorts_by_mtime_desc() {
   253	        let home = temp_home("roots");
   254	        let documents = home.join("Documents");
   255	        let desktop = home.join("Desktop");
   256	        let downloads = home.join("Downloads");
   257	
   258	        write_with_mtime(&documents.join("old.md"), at(1000));
   259	        write_with_mtime(&desktop.join("newer.md"), at(2000));
   260	        write_with_mtime(&downloads.join("newest.md"), at(3000));
   261	
   262	        let docs = collect_recent_documents(&home);
   263	        let names: Vec<&str> = docs
   264	            .iter()
   265	            .map(|d| d.path.rsplit('/').next().unwrap())
   266	            .collect();
   267	        assert_eq!(names, vec!["newest.md", "newer.md", "old.md"]);
   268	        assert!(docs[0].opened_at.starts_with("1970-01-01T00:50:00"));
   269	
   270	        let _ = fs::remove_dir_all(&home);
   271	    }
   272	
   273	    #[test]
   274	    fn depth_two_is_included_and_depth_three_is_excluded() {
   275	        let home = temp_home("depth");
   276	        let root = home.join("Documents");
   277	        write_with_mtime(&root.join("d0.md"), at(10));
   278	        write_with_mtime(&root.join("a").join("d1.md"), at(20));
   279	        write_with_mtime(&root.join("a").join("b").join("d2.md"), at(30));
   280	        write_with_mtime(&root.join("a").join("b").join("c").join("d3.md"), at(40));

codex
已确认至少一处明确错引：文档把 `App.tsx:614` 当作 ⌘F，实际该行是 ⌘⇧F 沉浸阅读开关；“文档内查找”由 CodeMirror 的 `searchKeymap` 提供。下面继续核查“阅读空间范围”、最近库语义与插件章节。
exec
/bin/zsh -c 'rg --files docs/design/pluginization-datafile-settings-rail docs/research/technical prototypes | sort' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md
docs/research/technical/README.md
docs/research/technical/data-fileization-omarchy-inventory.md
docs/research/technical/plugin-management-benchmark.md
docs/research/technical/workbuddy-html-visual-editing-逆向报告.md
prototypes/MANIFEST.md
prototypes/_base.css

exec
/bin/zsh -c "nl -ba src/editors/setup.ts | sed -n '60,115p'; nl -ba src/editors/orchestration/roulette-view.ts | sed -n '720,755p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
    60	export function fullDecorations(
    61	  options?: EditorDecorationsOptions,
    62	): Extension[] {
    63	  return [editorDecorations(options), floatingToolbar()];
    64	}
    65	
    66	/**
    67	 * 编辑态基础扩展集。
    68	 *
    69	 * 刻意**不用** `basicSetup`：它带进来的行号槽、折叠箭头、活动行高亮、自动
    70	 * 补全把文档编辑器渲染成代码面板，与「在预览态里编辑」的产品目标相反（上游
    71	 * md-bundle 的编辑器同样只装显式扩展集）。这里只保留正文编辑真正需要的：
    72	 * 折行、选区绘制、撤销历史、缩进、括号匹配与基础键位映射。
    73	 *
    74	 * Markdown 编辑态不要加回 `lineNumbers()` / `foldGutter()` / `highlightActiveLine()`：
    75	 * 它的「当前块」由装饰层的 `cm-block-active` 表达，不是行号（E-8）。非 Markdown
    76	 * 的纯文本 / 脚本文件例外——ContentArea 的 `lineNumbersForMode` 会按文件类型
    77	 * 条件装回行号（#858 / design D15），Markdown 永不装。
    78	 */
    79	export function baseEditorExtensions(): Extension[] {
    80	  return [
    81	    EditorView.lineWrapping,
    82	    drawSelection(),
    83	    EditorState.allowMultipleSelections.of(true),
    84	    // 撤销历史不在这里：它由 `historyCompartment` 提供，ContentArea 才能在
    85	    // 切页签时清空（#321）。`createExtensions` 与 ContentArea 都要显式装回。
    86	    indentOnInput(),
    87	    bracketMatching(),
    88	    // classHighlighter 只输出 `.tok-*`，与预览共用一套 token 配色；换成
    89	    // defaultHighlightStyle 会给 `tags.heading` 加下划线与字重，压住装饰层排版。
    90	    syntaxHighlighting(classHighlighter),
    91	    // searchKeymap 保留 Cmd+F 查找：basicSetup 撤掉后这是唯一还需要的面板键位。
    92	    keymap.of([
    93	      { key: "Mod-[", run: undo },
    94	      { key: "Mod-]", run: redo },
    95	      ...defaultKeymap,
    96	      ...historyKeymap,
    97	      ...ctrlHistoryBindings,
    98	      ...searchKeymap,
    99	      indentWithTab,
   100	    ]),
   101	  ];
   102	}
   103	
   104	/** Common base extensions shared by all file kinds */
   105	function commonExtensions(): Extension[] {
   106	  return [
   107	    EditorView.updateListener.of((update) => {
   108	      if (update.docChanged) {
   109	        // Content sync is handled by ContentArea's listener
   110	      }
   111	    }),
   112	  ];
   113	}
   114	
   115	/**
   720	
   721	  const moveHot = (delta: number) => {
   722	    const items = currentItems();
   723	    if (items.length === 0) return;
   724	    hot = (hot + delta + items.length) % items.length;
   725	    markHot();
   726	  };
   727	
   728	  const onKey = (e: KeyboardEvent) => {
   729	    if (e.key === "Escape") {
   730	      e.preventDefault();
   731	      e.stopPropagation();
   732	      if (filter !== null || group || openSector) {
   733	        backOneLevel();
   734	        return;
   735	      }
   736	      close();
   737	      return;
   738	    }
   739	    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
   740	      e.preventDefault();
   741	      e.stopPropagation();
   742	      openFilter();
   743	      return;
   744	    }
   745	    if (filter !== null) {
   746	      // 搜索面板打开时：⌘/Ctrl+2~9 直接执行对应行（首行回车在输入框内处理）。
   747	      if ((e.metaKey || e.ctrlKey) && /^[2-9]$/.test(e.key)) {
   748	        const hit = matches[Number(e.key) - 1];
   749	        if (hit) {
   750	          e.preventDefault();
   751	          e.stopPropagation();
   752	          runLeaf(hit.item);
   753	        }
   754	      }
   755	      return;

exec
/bin/zsh -c 'rg -n "searchHits|railQuery|filtered|search_documents|RailSection|pinnedPaths|recentFiles" src/components/Rail/ReadingRail.tsx src/lib/railView.ts | head -n 160' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/railView.ts:52:export type RailSection = "now" | "pinned" | "recent" | "category";
src/lib/railView.ts:56:  key: RailSection;
src/components/Rail/ReadingRail.tsx:44:  type RailSection,
src/components/Rail/ReadingRail.tsx:99:const EMPTY_TEXT: Record<RailSection, string> = {
src/components/Rail/ReadingRail.tsx:768:function RailSectionHead({
src/components/Rail/ReadingRail.tsx:801:  const railQuery = useStore((s) => s.railQuery);
src/components/Rail/ReadingRail.tsx:805:  const recentFiles = useStore((s) => s.recentFiles);
src/components/Rail/ReadingRail.tsx:811:  const pinnedPaths = useStore((s) => s.pinnedPaths);
src/components/Rail/ReadingRail.tsx:824:  const setRailSection = useStore((s) => s.setRailSection);
src/components/Rail/ReadingRail.tsx:832:  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
src/components/Rail/ReadingRail.tsx:946:  }, [railSearchOpen, railQuery]);
src/components/Rail/ReadingRail.tsx:972:  // 本机检索：query 去抖 300ms 后调用 search_documents；序号丢弃过期响应。
src/components/Rail/ReadingRail.tsx:975:    const query = railQuery.trim();
src/components/Rail/ReadingRail.tsx:984:      invoke<SearchHit[]>("search_documents", { query, limit: SEARCH_LIMIT })
src/components/Rail/ReadingRail.tsx:997:  }, [railQuery, searchedQuery, clearTimer]);
src/components/Rail/ReadingRail.tsx:1000:    railQuery.trim() !== "" && railQuery.trim() !== searchedQuery;
src/components/Rail/ReadingRail.tsx:1227:  const chips = useMemo(() => fileTypeChips(recentFiles), [recentFiles]);
src/components/Rail/ReadingRail.tsx:1231:      railQuery.trim() === searchedQuery
src/components/Rail/ReadingRail.tsx:1232:        ? filterSearchHits(searchHits, {
src/components/Rail/ReadingRail.tsx:1235:            query: railQuery,
src/components/Rail/ReadingRail.tsx:1238:    [searchHits, searchedQuery, searchChip, searchTime, railQuery],
src/components/Rail/ReadingRail.tsx:1241:    () => fileTypeChips(railQuery.trim() === searchedQuery ? searchHits : []),
src/components/Rail/ReadingRail.tsx:1242:    [searchHits, searchedQuery, railQuery],
src/components/Rail/ReadingRail.tsx:1254:    (section: RailSection): RecentFile[] => {
src/components/Rail/ReadingRail.tsx:1257:        return tab?.path ? recentFiles.filter((f) => f.path === tab.path) : [];
src/components/Rail/ReadingRail.tsx:1260:        return recentFiles.filter((f) => pinnedPaths.includes(f.path));
src/components/Rail/ReadingRail.tsx:1262:      return recentFiles;
src/components/Rail/ReadingRail.tsx:1264:    [activeTabId, tabs, recentFiles, pinnedPaths],
src/components/Rail/ReadingRail.tsx:1267:  const renderList = (section: RailSection): ReactNode => {
src/components/Rail/ReadingRail.tsx:1271:      query: railQuery,
src/components/Rail/ReadingRail.tsx:1296:              pinned={pinnedPaths.includes(m.item.path)}
src/components/Rail/ReadingRail.tsx:1317:    if (railQuery !== "") {
src/components/Rail/ReadingRail.tsx:1519:        value={railQuery}
src/components/Rail/ReadingRail.tsx:1526:      {railQuery !== "" && (
src/components/Rail/ReadingRail.tsx:1545:    railSearchOpen && railQuery.trim() !== "" ? (
src/components/Rail/ReadingRail.tsx:1606:                pinned={pinnedPaths.includes(m.hit.path)}
src/components/Rail/ReadingRail.tsx:1631:            <RailSectionHead label={section.label} sticky />
src/components/Rail/ReadingRail.tsx:1646:              onClick={() => setRailSection(section.key)}

exec
/bin/zsh -c "nl -ba src/components/Rail/ReadingRail.tsx | sed -n '150,360p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   150	  const kind = descriptor.kind;
   151	  const src = descriptor.src ?? "";
   152	
   153	  const [mediaReady, setMediaReady] = useState(false);
   154	  const [htmlReady, setHtmlReady] = useState(false);
   155	  const [pdfThumb, setPdfThumb] = useState<string | null | undefined>(() =>
   156	    descriptor.kind === "pdf-page" && descriptor.src
   157	      ? pdfThumbCacheGet(descriptor.src)
   158	      : null,
   159	  );
   160	  useEffect(() => {
   161	    if (kind !== "video-poster" || !isTauriEnv() || !src) return;
   162	    let cancelled = false;
   163	    setMediaReady(false);
   164	    void invoke("register_media_path", { path: src })
   165	      .catch(() => {})
   166	      .finally(() => {
   167	        if (!cancelled) setMediaReady(true);
   168	      });
   169	    return () => {
   170	      cancelled = true;
   171	    };
   172	  }, [kind, src]);
   173	
   174	  useEffect(() => {
   175	    if (kind !== "pdf-page" || !src) return;
   176	    let cancelled = false;
   177	    void pdfThumbOf(src).then((url) => {
   178	      if (!cancelled) setPdfThumb(url);
   179	    });
   180	    return () => {
   181	      cancelled = true;
   182	    };
   183	  }, [kind, src]);
   184	
   185	  if (kind === "image" || kind === "md-cover") {
   186	    return (
   187	      <div
   188	        data-testid="rail-thumb"
   189	        data-thumb-kind={kind}
   190	        style={size}
   191	        className="rail-thumb shrink-0"
   192	      >
   193	        <img
   194	          src={assetSrc(descriptor.src ?? "")}
   195	          alt=""
   196	          width={box.w}
   197	          height={box.h}
   198	          className="h-full w-full object-cover"
   199	        />
   200	      </div>
   201	    );
   202	  }
   203	
   204	  if (kind === "video-poster") {
   205	    const showVideo = isTauriEnv() && !!src;
   206	    return (
   207	      <div
   208	        data-testid="rail-thumb"
   209	        data-thumb-kind={kind}
   210	        style={{
   211	          ...size,
   212	          background:
   213	            "color-mix(in srgb, var(--type-video) 26%, var(--app-surface))",
   214	        }}
   215	        className="rail-thumb shrink-0"
   216	      >
   217	        <span className="rail-thumb-play">
   218	          <Icon name="play" size={24} color="var(--app-surface)" />
   219	        </span>
   220	        {showVideo && mediaReady && (
   221	          <video
   222	            src={mediaUrlForPath(src)}
   223	            preload="auto"
   224	            muted
   225	            playsInline
   226	            onLoadedMetadata={(e) => {
   227	              const video = e.currentTarget;
   228	              try {
   229	                video.currentTime = Math.min(0.1, video.duration || 0.1);
   230	              } catch {
   231	                /* 元数据未就绪时忽略 */
   232	              }
   233	            }}
   234	            className="relative h-full w-full object-cover"
   235	          />
   236	        )}
   237	      </div>
   238	    );
   239	  }
   240	
   241	  if (kind === "audio-wave") {
   242	    return (
   243	      <div
   244	        data-testid="rail-thumb"
   245	        data-thumb-kind={kind}
   246	        style={{
   247	          ...size,
   248	          background:
   249	            "color-mix(in srgb, var(--type-audio) 20%, var(--app-surface))",
   250	          color: "var(--type-audio)",
   251	        }}
   252	        className="rail-thumb rail-thumb-wave shrink-0"
   253	      >
   254	        {[6, 12, 18, 10, 16, 8, 14].map((h, i) => (
   255	          <span key={i} className="rail-thumb-bar" style={{ height: h }} />
   256	        ))}
   257	      </div>
   258	    );
   259	  }
   260	
   261	  if (kind === "html-page") {
   262	    // 真实首屏缩略图（#569）：受控 iframe 10% 缩放；类型色占位在底层，
   263	    // 加载完成才淡入。加载失败时 iframe 保持透明，占位仍可见，不出现白块。
   264	    return (
   265	      <div
   266	        data-testid="rail-thumb"
   267	        data-thumb-kind={kind}
   268	        style={{
   269	          ...size,
   270	          background:
   271	            "color-mix(in srgb, var(--type-html) 10%, var(--app-surface))",
   272	          borderColor: "var(--type-html)",
   273	          color: "var(--type-html)",
   274	        }}
   275	        className="rail-thumb relative flex shrink-0 items-center justify-center overflow-hidden border"
   276	      >
   277	        <Icon name="html" size={24} color="var(--type-html)" />
   278	        {src && (
   279	          <iframe
   280	            data-testid="rail-thumb-html-frame"
   281	            sandbox="allow-scripts"
   282	            src={assetSrc(src)}
   283	            title=""
   284	            tabIndex={-1}
   285	            loading="lazy"
   286	            onLoad={() => setHtmlReady(true)}
   287	            style={{
   288	              position: "absolute",
   289	              top: 0,
   290	              left: 0,
   291	              width: 720,
   292	              height: 540,
   293	              border: "none",
   294	              transform: "scale(0.1)",
   295	              transformOrigin: "top left",
   296	              pointerEvents: "none",
   297	              opacity: htmlReady ? 1 : 0,
   298	              transition: "opacity 120ms ease",
   299	            }}
   300	          />
   301	        )}
   302	      </div>
   303	    );
   304	  }
   305	
   306	  if (kind === "pdf-page") {
   307	    if (pdfThumb) {
   308	      return (
   309	        <div
   310	          data-testid="rail-thumb"
   311	          data-thumb-kind={kind}
   312	          style={size}
   313	          className="rail-thumb shrink-0 overflow-hidden"
   314	        >
   315	          <img
   316	            data-testid="rail-thumb-pdf-img"
   317	            src={pdfThumb}
   318	            alt=""
   319	            width={box.w}
   320	            height={box.h}
   321	            className="h-full w-full object-cover object-top"
   322	          />
   323	        </div>
   324	      );
   325	    }
   326	    // 卡片缩略图**不嵌入** PDF 查看器（#286）：macOS WKWebView 用 PDFKit
   327	    // 渲染 iframe，忽略 `#toolbar=0`；它的悬浮控制条是原生视图层，
   328	    // CSS `pointer-events:none` 也拦不住。唯一可靠的做法是不给卡片加载
   329	    // 查看器——保留类型色占位。悬浮预览窗是用户主动阅读面，继续用 iframe。
   330	    return (
   331	      <div
   332	        data-testid="rail-thumb"
   333	        data-thumb-kind={kind}
   334	        style={{
   335	          ...size,
   336	          background: `color-mix(in srgb, var(--type-pdf) 16%, var(--app-surface))`,
   337	          color: "var(--type-pdf)",
   338	        }}
   339	        className="rail-thumb rail-thumb-page relative shrink-0 overflow-hidden"
   340	      >
   341	        <span className="rail-thumb-line" />
   342	        <span className="rail-thumb-line" />
   343	        <span className="rail-thumb-line" />
   344	      </div>
   345	    );
   346	  }
   347	
   348	  return (
   349	    <div
   350	      data-testid="rail-thumb"
   351	      data-thumb-kind={kind}
   352	      style={{
   353	        ...size,
   354	        background: `color-mix(in srgb, var(--type-pdf) 16%, var(--app-surface))`,
   355	        color: "var(--type-pdf)",
   356	      }}
   357	      className="rail-thumb rail-thumb-page shrink-0"
   358	    >
   359	      <span className="rail-thumb-line" />
   360	      <span className="rail-thumb-line" />

exec
/bin/zsh -c "nl -ba src-tauri/src/config.rs | sed -n '1,70p;410,470p;970,1015p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	use serde::{Deserialize, Serialize};
     2	use serde_json::Value;
     3	use std::collections::HashMap;
     4	use std::io::Write;
     5	use std::path::{Path, PathBuf};
     6	use std::time::{SystemTime, UNIX_EPOCH};
     7	use tauri::{AppHandle, Manager};
     8	use tracing::{info, warn};
     9	
    10	use crate::errors::AppError;
    11	
    12	#[derive(Debug, Serialize, Deserialize, Clone)]
    13	#[serde(rename_all = "camelCase")]
    14	pub struct AppConfig {
    15	    pub font_size: Option<f64>,
    16	    pub heading_colors: Option<HeadingColors>,
    17	    // 阅读区设置（预览专用，与编辑器字号解耦）
    18	    pub reader_font_size: Option<f64>,
    19	    pub reader_width: Option<f64>,
    20	    pub reader_skin: Option<String>,
    21	    pub ollama_endpoint: Option<String>,
    22	    pub openai_endpoint: Option<String>,
    23	    pub openai_model: Option<String>,
    24	    #[serde(skip)]
    25	    pub openai_api_key: Option<String>,
    26	    pub translation_provider: Option<String>,
    27	    pub source_lang: Option<String>,
    28	    pub target_lang: Option<String>,
    29	    pub theme: Option<String>,
    30	    pub ai_confirm_density: Option<String>,
    31	    pub sidebar_left_visible: Option<bool>,
    32	    pub sidebar_right_visible: Option<bool>,
    33	    pub sidebar_left_width: Option<f64>,
    34	    pub sidebar_right_width: Option<f64>,
    35	    pub horizontal_split_ratio: Option<f64>,
    36	    pub vertical_split_ratio: Option<f64>,
    37	    pub recent_files: Option<Vec<RecentFile>>,
    38	    pub scroll_positions: Option<HashMap<String, ScrollPosition>>,
    39	    /// 内嵌文件滚动定格（D10 / B5b）：文档级 view-state，键 = `文档路径\u0000内嵌路径`。
    40	    #[serde(default, skip_serializing_if = "Option::is_none")]
    41	    pub embed_scroll_positions: Option<HashMap<String, ScrollPosition>>,
    42	    /// 核心能力开关：只记录被关闭的能力，缺省即全开（spec X-3）。
    43	    pub capabilities: Option<HashMap<String, bool>>,
    44	    /// 图标标签级别（Layout Portal §10）：auto / text / icon。
    45	    pub icon_label: Option<String>,
    46	    /// 工作区 pane 递归树（layout-portal 3.1）：序列化后的 JSON 字符串。
    47	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    48	    #[serde(default, skip_serializing_if = "Option::is_none")]
    49	    pub pane_layout: Option<String>,
    50	    /// 阅读空间栏「设为默认」的视图规格（layout-portal 6.1）。
    51	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    52	    #[serde(default, skip_serializing_if = "Option::is_none")]
    53	    pub rail_view_spec: Option<RailViewSpec>,
    54	    /// 悬浮预览窗双轨开关（layout-portal 8.1）。
    55	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    56	    #[serde(default, skip_serializing_if = "Option::is_none")]
    57	    pub preview_settings: Option<PreviewSettings>,
    58	    /// AI 视图改写规格（layout-portal 9.1）。
    59	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    60	    #[serde(default, skip_serializing_if = "Option::is_none")]
    61	    pub ai_view_spec: Option<AiViewSpec>,
    62	    /// 轮盘根扇区集合与顺序（ui-command-registry 2.1）。缺省 = 内置默认。
    63	    #[serde(default, skip_serializing_if = "Option::is_none")]
    64	    pub roulette_sectors: Option<Vec<String>>,
    65	    /// 横向工具条动作集合与顺序（ui-toolbar-slots 1.1）。缺省 = 内置默认。
    66	    #[serde(default, skip_serializing_if = "Option::is_none")]
    67	    pub html_toolbar_items: Option<Vec<String>>,
    68	    /// 新建文档首次保存的默认目录（ui-polish-batch12 6.1）。
    69	    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    70	    #[serde(default, skip_serializing_if = "Option::is_none")]
   410	    let scroll_positions =
   411	        serde_json::to_value(config.scroll_positions.clone().unwrap_or_default())
   412	            .map_err(|e| json_err("scrollPositions", e))?;
   413	    let embed_scroll_positions =
   414	        serde_json::to_value(config.embed_scroll_positions.clone().unwrap_or_default())
   415	            .map_err(|e| json_err("embedScrollPositions", e))?;
   416	    Ok(serde_json::json!({
   417	        "recentFiles": recent_files,
   418	        "scrollPositions": scroll_positions,
   419	        "embedScrollPositions": embed_scroll_positions,
   420	    }))
   421	}
   422	
   423	fn effective_config(
   424	    defaults: Value,
   425	    user: Option<Value>,
   426	    state: Option<Value>,
   427	) -> Result<AppConfig, AppError> {
   428	    let mut merged = merge_json(&defaults, user.as_ref().unwrap_or(&Value::Null));
   429	    if let (Value::Object(map), Some(Value::Object(state))) = (&mut merged, state) {
   430	        for key in ["recentFiles", "scrollPositions", "embedScrollPositions"] {
   431	            if let Some(value) = state.get(key) {
   432	                map.insert(key.to_string(), value.clone());
   433	            }
   434	        }
   435	    }
   436	    serde_json::from_value(merged).map_err(|e| json_err("effective config", e))
   437	}
   438	
   439	/// 旧 `app_config.json` 拆成 user + state。旧文件保留不动，靠 user 层是否
   440	/// 存在判断是否需要迁移，因此重复调用天然幂等。
   441	fn migrate_legacy(base: &Path) -> Result<bool, AppError> {
   442	    let legacy = legacy_path(base);
   443	    if user_path(base).exists() || !legacy.exists() {
   444	        return Ok(false);
   445	    }
   446	    let Some(raw) = read_json_or_quarantine(&legacy) else {
   447	        return Ok(false);
   448	    };
   449	    let config: AppConfig =
   450	        serde_json::from_value(raw).map_err(|e| json_err("legacy config", e))?;
   451	    let user = serde_json::to_vec_pretty(&settings_value(&config)?)
   452	        .map_err(|e| json_err("legacy settings", e))?;
   453	    let state = serde_json::to_vec_pretty(&state_value(&config)?)
   454	        .map_err(|e| json_err("legacy state", e))?;
   455	    atomic_write(&user_path(base), &user)?;
   456	    atomic_write(&state_path(base), &state)?;
   457	    info!(from = %legacy.display(), "旧配置已拆分为 user/state 两层");
   458	    Ok(true)
   459	}
   460	
   461	// ── 校验（design §D5）────────────────────────────────────────
   462	
   463	fn check_range(field: &str, value: Option<f64>, min: f64, max: f64) -> Result<(), AppError> {
   464	    match value {
   465	        Some(v) if !(min..=max).contains(&v) => Err(AppError::Validation {
   466	            context: field.into(),
   467	            message: format!("{v} 超出范围 {min}–{max}"),
   468	        }),
   469	        _ => Ok(()),
   470	    }
   970	        info!(from = %legacy.display(), "旧 bundle 配置已复制到当前目录");
   971	    }
   972	}
   973	
   974	/// Load config from disk, return default on missing/corrupt.
   975	pub async fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
   976	    let base = config_base(app);
   977	    migrate_legacy_bundle(app, &base).await;
   978	    load_config_at(&base)
   979	}
   980	
   981	/// Save config to disk.
   982	pub async fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
   983	    save_config_at(&config_base(app), config)
   984	}
   985	
   986	pub async fn list_config_snapshots(app: &AppHandle) -> Result<Vec<String>, AppError> {
   987	    list_snapshots(&config_base(app))
   988	}
   989	
   990	pub async fn restore_config_snapshot(app: &AppHandle, name: &str) -> Result<AppConfig, AppError> {
   991	    restore_snapshot(&config_base(app), name)
   992	}
   993	
   994	/// 轮询 `user/settings.json` 的 (mtime, len)，变化时发 `config-changed`。
   995	/// 按路径取状态，文件被 rename 替换也能发现；首轮只记录基线。
   996	pub fn spawn_config_watcher(app: AppHandle) {
   997	    let path = user_path(&config_base(&app));
   998	    tauri::async_runtime::spawn(async move {
   999	        use tauri::Emitter;
  1000	        let fingerprint = |path: &Path| -> Option<(SystemTime, u64)> {
  1001	            let meta = std::fs::metadata(path).ok()?;
  1002	            Some((meta.modified().ok()?, meta.len()))
  1003	        };
  1004	        let mut last = fingerprint(&path);
  1005	        loop {
  1006	            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
  1007	            let current = fingerprint(&path);
  1008	            if current != last {
  1009	                last = current;
  1010	                info!(path = %path.display(), "配置文件被外部修改，通知前端热应用");
  1011	                #[cfg(debug_assertions)]
  1012	                eprintln!("[config] 外部修改已检测，发送 config-changed");
  1013	                let _ = app.emit("config-changed", ());
  1014	            }
  1015	        }

exec
/bin/zsh -c 'rg -n "SearchHit|search_documents|list_recent_documents|RecentFile" src-tauri/src src/types/index.ts | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/types/index.ts:92:  recentFiles: RecentFile[];
src/types/index.ts:152:export interface RecentFile {
src/types/index.ts:160:/** 本机全文检索命中（search_documents 返回，Rust 侧 serde camelCase）。 */
src/types/index.ts:161:export interface SearchHit {
src-tauri/src/commands/recent.rs:8:use crate::config::RecentFile;
src-tauri/src/commands/recent.rs:170:pub fn collect_recent_documents(home: &Path) -> Vec<RecentFile> {
src-tauri/src/commands/recent.rs:190:            RecentFile {
src-tauri/src/commands/recent.rs:207:pub async fn list_recent_documents() -> Result<Vec<RecentFile>, AppError> {
src-tauri/src/commands/recent.rs:215:            context: "list_recent_documents join".into(),
src-tauri/src/commands/search.rs:29:pub struct SearchHit {
src-tauri/src/commands/search.rs:184:fn match_document(doc: &ScanDoc, query: &str, lower_query: &str) -> Option<SearchHit> {
src-tauri/src/commands/search.rs:231:    Some(SearchHit {
src-tauri/src/commands/search.rs:241:pub fn collect_search_hits(home: &Path, query: &str, limit: usize) -> Vec<SearchHit> {
src-tauri/src/commands/search.rs:249:    let mut hits: Vec<SearchHit> = docs
src-tauri/src/commands/search.rs:261:pub async fn search_documents(
src-tauri/src/commands/search.rs:264:) -> Result<Vec<SearchHit>, AppError> {
src-tauri/src/commands/search.rs:273:            context: "search_documents join".into(),
src-tauri/src/lib.rs:22:use commands::recent::list_recent_documents;
src-tauri/src/lib.rs:23:use commands::search::search_documents;
src-tauri/src/lib.rs:210:            list_recent_documents,
src-tauri/src/lib.rs:211:            search_documents,
src-tauri/src/config.rs:37:    pub recent_files: Option<Vec<RecentFile>>,
src-tauri/src/config.rs:180:pub struct RecentFile {
src-tauri/src/config.rs:1101:        config.recent_files = Some(vec![RecentFile {

exec
/bin/zsh -c "nl -ba src/components/Rail/ReadingRail.tsx | sed -n '1180,1665p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
  1180	    const st = useStore.getState();
  1181	    const p = st.preview;
  1182	    if (!p || p.source !== "rail" || p.pinned) return;
  1183	    st.closePreview();
  1184	  }, [clearTimer]);
  1185	
  1186	  const handleRowMove = useCallback(
  1187	    (item: RecentFile, el: HTMLElement, e: ReactMouseEvent<HTMLElement>) => {
  1188	      const st = useStore.getState();
  1189	      if (!st.previewSettings.enabled || !st.previewSettings.railHover) return;
  1190	      const zone = isThumbZoneOfBox({ x: e.clientX, y: e.clientY }, boxOf(el))
  1191	        ? ("right" as const)
  1192	        : ("left" as const);
  1193	      const prev = hoverZoneRef.current;
  1194	      if (prev && prev.path === item.path && prev.zone === zone) return;
  1195	      hoverZoneRef.current = { path: item.path, zone };
  1196	      if (zone === "right") onRowEnter(item, el);
  1197	      else onRowLeftHalf();
  1198	    },
  1199	    [onRowEnter, onRowLeftHalf],
  1200	  );
  1201	
  1202	  const onRowLeave = useCallback(() => {
  1203	    hoverZoneRef.current = null;
  1204	    clearTimer(previewTimer);
  1205	  }, [clearTimer]);
  1206	
  1207	  const loadSnapshots = useCallback(() => {
  1208	    if (!isTauriEnv()) return;
  1209	    invoke<string[]>("list_config_snapshots")
  1210	      .then(setSnapshots)
  1211	      .catch((e) => log.warn("Rail", "读取快照失败", e));
  1212	  }, []);
  1213	
  1214	  const restoreSnapshot = useCallback(
  1215	    (name: string) => {
  1216	      if (!isTauriEnv()) return;
  1217	      invoke("restore_config_snapshot", { name })
  1218	        .then(() => {
  1219	          reloadAppConfig();
  1220	          showNotice("已恢复快照");
  1221	        })
  1222	        .catch((e) => log.error("Rail", "恢复快照失败", e));
  1223	    },
  1224	    [showNotice],
  1225	  );
  1226	
  1227	  const chips = useMemo(() => fileTypeChips(recentFiles), [recentFiles]);
  1228	
  1229	  const searchMatches = useMemo(
  1230	    () =>
  1231	      railQuery.trim() === searchedQuery
  1232	        ? filterSearchHits(searchHits, {
  1233	            chip: searchChip,
  1234	            time: searchTime,
  1235	            query: railQuery,
  1236	          })
  1237	        : [],
  1238	    [searchHits, searchedQuery, searchChip, searchTime, railQuery],
  1239	  );
  1240	  const searchChips = useMemo(
  1241	    () => fileTypeChips(railQuery.trim() === searchedQuery ? searchHits : []),
  1242	    [searchHits, searchedQuery, railQuery],
  1243	  );
  1244	
  1245	  const panelWidth = railWidth;
  1246	  const railSections = viewSpec.pinnedAndRecentOnly
  1247	    ? RAIL_SECTIONS.filter((s) => s.key === "pinned" || s.key === "recent")
  1248	    : RAIL_SECTIONS;
  1249	  const activeSection = railSections.some((s) => s.key === railSection)
  1250	    ? railSection
  1251	    : (railSections[0]?.key ?? "recent");
  1252	
  1253	  const itemsForSection = useCallback(
  1254	    (section: RailSection): RecentFile[] => {
  1255	      if (section === "now") {
  1256	        const tab = activeTabId ? tabs[activeTabId] : null;
  1257	        return tab?.path ? recentFiles.filter((f) => f.path === tab.path) : [];
  1258	      }
  1259	      if (section === "pinned") {
  1260	        return recentFiles.filter((f) => pinnedPaths.includes(f.path));
  1261	      }
  1262	      return recentFiles;
  1263	    },
  1264	    [activeTabId, tabs, recentFiles, pinnedPaths],
  1265	  );
  1266	
  1267	  const renderList = (section: RailSection): ReactNode => {
  1268	    const chip: RailChipKind = section === "category" ? railChip : "all";
  1269	    const matches = filterRailItems(itemsForSection(section), {
  1270	      chip,
  1271	      query: railQuery,
  1272	    }).filter(
  1273	      (m) => !viewSpec.unreadOnly || isUnread(m.item.path, scrollPositions),
  1274	    );
  1275	    return (
  1276	      <>
  1277	        {section === "category" && (
  1278	          <RailChips chips={chips} active={railChip} onPick={setRailChip} />
  1279	        )}
  1280	        {matches.length === 0 ? (
  1281	          <div
  1282	            data-testid="rail-empty"
  1283	            data-section={section}
  1284	            className="px-3 py-3 text-[11px] text-gray-400 dark:text-gray-500"
  1285	          >
  1286	            {EMPTY_TEXT[section]}
  1287	          </div>
  1288	        ) : (
  1289	          matches.map((m) => (
  1290	            <RailRow
  1291	              key={m.item.path}
  1292	              item={m.item}
  1293	              ranges={m.ranges}
  1294	              density={railDensity}
  1295	              cardHeight={railCardHeight}
  1296	              pinned={pinnedPaths.includes(m.item.path)}
  1297	              readPercent={readPercentFor(m.item.path)}
  1298	              scale={section === "pinned" ? viewSpec.pinnedSegmentScale : 1}
  1299	              blockColors={viewSpec.blockColors}
  1300	              onOpen={onOpenPath}
  1301	              onSplit={openInSplit}
  1302	              onReveal={revealInFinder}
  1303	              onTogglePin={togglePinnedPath}
  1304	              onRowMove={(e) => handleRowMove(m.item, e.currentTarget, e)}
  1305	              onRowLeave={onRowLeave}
  1306	            />
  1307	          ))
  1308	        )}
  1309	      </>
  1310	    );
  1311	  };
  1312	
  1313	  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
  1314	    if (e.key !== "Escape") return;
  1315	    e.preventDefault();
  1316	    e.stopPropagation();
  1317	    if (railQuery !== "") {
  1318	      setRailQuery("");
  1319	      inputRef.current?.focus();
  1320	    } else {
  1321	      closeRailSearch();
  1322	      setRailState(nextRailState(railState, { type: "collapse" }));
  1323	    }
  1324	  };
  1325	
  1326	  const header = (
  1327	    <div className="flex items-center gap-1 border-b border-[var(--app-border)] px-2 py-1.5">
  1328	      {(["stacked", "tabs"] as RailLayout[]).map((layout, index) => (
  1329	        <button
  1330	          key={layout}
  1331	          type="button"
  1332	          data-testid={`rail-mode-${layout}`}
  1333	          data-active={railLayout === layout ? "true" : "false"}
  1334	          aria-pressed={railLayout === layout}
  1335	          onClick={() => setRailLayout(layout)}
  1336	          className={`rounded px-1.5 py-0.5 text-[11px] ${
  1337	            index === 0 ? "ml-auto" : ""
  1338	          } ${
  1339	            railLayout === layout
  1340	              ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1341	              : "text-[var(--app-text-3)] hover:bg-[var(--app-sunken)]"
  1342	          }`}
  1343	        >
  1344	          {LAYOUT_LABELS[layout]}
  1345	        </button>
  1346	      ))}
  1347	      <div
  1348	        className="relative"
  1349	        ref={menuRef}
  1350	        onPointerEnter={hoverOpenMenu}
  1351	        onPointerLeave={hoverCloseMenu}
  1352	      >
  1353	        <button
  1354	          type="button"
  1355	          data-testid="rail-settings"
  1356	          title="布局 / 密度 / 快照"
  1357	          aria-label="布局 / 密度 / 快照"
  1358	          aria-haspopup="menu"
  1359	          aria-expanded={menuOpen}
  1360	          onClick={() => {
  1361	            const next = !menuOpen;
  1362	            setMenuOpen(next);
  1363	            if (next) loadSnapshots();
  1364	          }}
  1365	          className="rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
  1366	        >
  1367	          <Icon name="settings" size={18} />
  1368	        </button>
  1369	        {menuOpen && (
  1370	          <div
  1371	            data-testid="rail-menu"
  1372	            role="menu"
  1373	            style={{
  1374	              ...(menuFlip
  1375	                ? { left: 0, right: "auto" }
  1376	                : { right: 0, left: "auto" }),
  1377	              maxHeight: RAIL_MENU_MAX_HEIGHT,
  1378	              overflowY: "auto",
  1379	            }}
  1380	            className="absolute top-full z-50 mt-1 w-56 rounded border border-[var(--app-border)] bg-[var(--app-surface)] py-1 text-xs shadow-lg"
  1381	          >
  1382	            <div className="px-3 py-1 text-[10px] uppercase text-[var(--app-text-3)]">
  1383	              布局
  1384	            </div>
  1385	            {(["stacked", "tabs"] as RailLayout[]).map((layout) => (
  1386	              <button
  1387	                key={layout}
  1388	                type="button"
  1389	                role="menuitemradio"
  1390	                aria-checked={railLayout === layout}
  1391	                data-testid={`rail-layout-${layout}`}
  1392	                onClick={() => setRailLayout(layout)}
  1393	                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
  1394	              >
  1395	                {railLayout === layout ? (
  1396	                  <Icon name="check" size={18} />
  1397	                ) : (
  1398	                  <span className="w-[18px]" />
  1399	                )}
  1400	                {LAYOUT_LABELS[layout]}
  1401	              </button>
  1402	            ))}
  1403	            <div className="mt-1 px-3 py-1 text-[10px] uppercase text-[var(--app-text-3)]">
  1404	              密度
  1405	            </div>
  1406	            {(["compact", "comfortable", "card"] as RailDensity[]).map((d) => (
  1407	              <button
  1408	                key={d}
  1409	                type="button"
  1410	                role="menuitemradio"
  1411	                aria-checked={railDensity === d}
  1412	                data-testid={`rail-density-${d}`}
  1413	                onClick={() => setRailDensity(d)}
  1414	                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
  1415	              >
  1416	                {railDensity === d ? (
  1417	                  <Icon name="check" size={18} />
  1418	                ) : (
  1419	                  <span className="w-[18px]" />
  1420	                )}
  1421	                {DENSITY_LABELS[d]}
  1422	              </button>
  1423	            ))}
  1424	            <div className="px-3 py-1.5">
  1425	              <div className="flex items-center justify-between text-[11px] text-[var(--app-text-2)]">
  1426	                <span>卡片高度</span>
  1427	                <span data-testid="rail-card-height-value">
  1428	                  {railCardHeight}px
  1429	                </span>
  1430	              </div>
  1431	              <input
  1432	                type="range"
  1433	                min={CARD_MIN}
  1434	                max={CARD_MAX}
  1435	                step={1}
  1436	                value={railCardHeight}
  1437	                data-testid="rail-card-height"
  1438	                aria-label="卡片高度"
  1439	                onChange={(e) => setRailCardHeight(Number(e.target.value))}
  1440	                className="mt-1 w-full accent-[var(--app-accent)]"
  1441	              />
  1442	            </div>
  1443	            <div className="mt-1 border-t border-[var(--app-border)] px-3 py-1 text-[10px] uppercase text-[var(--app-text-3)]">
  1444	              快照
  1445	            </div>
  1446	            {snapshots.length === 0 ? (
  1447	              <div className="px-3 py-1.5 text-[11px] text-[var(--app-text-3)]">
  1448	                暂无快照
  1449	              </div>
  1450	            ) : (
  1451	              snapshots.slice(-5).map((name) => (
  1452	                <button
  1453	                  key={name}
  1454	                  type="button"
  1455	                  data-testid="rail-snapshot"
  1456	                  onClick={() => restoreSnapshot(name)}
  1457	                  className="block w-full truncate px-3 py-1.5 text-left text-[11px] hover:bg-[var(--app-sunken)]"
  1458	                  title={name}
  1459	                >
  1460	                  {name}
  1461	                </button>
  1462	              ))
  1463	            )}
  1464	            <div className="mt-1 border-t border-[var(--app-border)]">
  1465	              <button
  1466	                type="button"
  1467	                data-testid="rail-save-default"
  1468	                onClick={() => {
  1469	                  saveRailViewSpec();
  1470	                  showNotice("已设为默认");
  1471	                }}
  1472	                className="w-full px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
  1473	              >
  1474	                设为默认
  1475	              </button>
  1476	            </div>
  1477	          </div>
  1478	        )}
  1479	      </div>
  1480	      <button
  1481	        type="button"
  1482	        data-testid="rail-pin"
  1483	        data-pinned={railState === "pinned" ? "true" : "false"}
  1484	        aria-pressed={railState === "pinned"}
  1485	        title={railState === "pinned" ? "取消钉住" : "钉住"}
  1486	        aria-label={railState === "pinned" ? "取消钉住" : "钉住"}
  1487	        onClick={toggleRailPin}
  1488	        className="rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
  1489	      >
  1490	        <Icon
  1491	          name={railState === "pinned" ? "pinOff" : "pin"}
  1492	          size={18}
  1493	          color={railState === "pinned" ? "var(--app-accent)" : undefined}
  1494	        />
  1495	      </button>
  1496	      <button
  1497	        type="button"
  1498	        data-testid="rail-collapse"
  1499	        title="收起"
  1500	        aria-label="收起"
  1501	        onClick={() => setRailState("collapsed")}
  1502	        className="rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
  1503	      >
  1504	        <Icon name="chevronLeft" size={18} />
  1505	      </button>
  1506	    </div>
  1507	  );
  1508	
  1509	  const search = (
  1510	    <div
  1511	      data-testid="rail-search"
  1512	      data-search-open={railSearchOpen ? "true" : "false"}
  1513	      className="sticky top-0 z-20 flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-900"
  1514	    >
  1515	      <Icon name="search" size={18} color="var(--app-text-3)" />
  1516	      <input
  1517	        ref={inputRef}
  1518	        data-testid="rail-search-input"
  1519	        value={railQuery}
  1520	        placeholder="搜索本机文件"
  1521	        onChange={(e) => setRailQuery(e.target.value)}
  1522	        onFocus={openRailSearch}
  1523	        onKeyDown={onSearchKeyDown}
  1524	        className="min-w-0 flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
  1525	      />
  1526	      {railQuery !== "" && (
  1527	        <button
  1528	          type="button"
  1529	          data-testid="rail-search-clear"
  1530	          aria-label="清除"
  1531	          title="清除"
  1532	          onClick={() => {
  1533	            setRailQuery("");
  1534	            inputRef.current?.focus();
  1535	          }}
  1536	          className="rounded p-0.5 text-[var(--app-chrome-rest)] hover:text-[var(--app-chrome-hover)]"
  1537	        >
  1538	          <Icon name="close" size={18} />
  1539	        </button>
  1540	      )}
  1541	    </div>
  1542	  );
  1543	
  1544	  const searchBlock =
  1545	    railSearchOpen && railQuery.trim() !== "" ? (
  1546	      <div
  1547	        data-testid="rail-search-results"
  1548	        className="border-b border-gray-100 pb-1 dark:border-gray-800"
  1549	      >
  1550	        <div className="flex items-center gap-1 px-3 py-1 text-[11px] text-gray-500 dark:text-gray-400">
  1551	          <span className="mr-auto font-medium">本机检索</span>
  1552	          <span data-testid="rail-search-count">
  1553	            {searching ? "检索中…" : `${searchMatches.length} 条`}
  1554	          </span>
  1555	        </div>
  1556	        <RailChips
  1557	          chips={searchChips}
  1558	          active={searchChip}
  1559	          onPick={setSearchChip}
  1560	        />
  1561	        <div
  1562	          data-testid="rail-search-times"
  1563	          className="flex flex-wrap gap-1 px-2 pb-1"
  1564	        >
  1565	          {RAIL_SEARCH_TIMES.map((t) => (
  1566	            <button
  1567	              key={t.key}
  1568	              type="button"
  1569	              data-testid="rail-search-time"
  1570	              data-time={t.key}
  1571	              data-active={searchTime === t.key ? "true" : "false"}
  1572	              onClick={() => setSearchTime(t.key)}
  1573	              className={`rounded-full border px-2 py-0.5 text-[11px] ${
  1574	                searchTime === t.key
  1575	                  ? "border-transparent bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
  1576	                  : "border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
  1577	              }`}
  1578	            >
  1579	              {t.label}
  1580	            </button>
  1581	          ))}
  1582	        </div>
  1583	        {searchMatches.length === 0 ? (
  1584	          <div
  1585	            data-testid="rail-search-empty"
  1586	            className="px-3 py-3 text-[11px] text-gray-400 dark:text-gray-500"
  1587	          >
  1588	            {searching ? "检索中…" : "无命中"}
  1589	          </div>
  1590	        ) : (
  1591	          searchMatches.map((m) => {
  1592	            const item: RecentFile = {
  1593	              path: m.hit.path,
  1594	              title: m.hit.title,
  1595	              openedAt: m.hit.openedAt,
  1596	              excerpt: m.hit.excerpt,
  1597	            };
  1598	            return (
  1599	              <RailRow
  1600	                key={m.hit.path}
  1601	                item={item}
  1602	                ranges={m.ranges}
  1603	                excerptRanges={m.excerptRanges}
  1604	                density={railDensity}
  1605	                cardHeight={railCardHeight}
  1606	                pinned={pinnedPaths.includes(m.hit.path)}
  1607	                readPercent={readPercentFor(m.hit.path)}
  1608	                blockColors={viewSpec.blockColors}
  1609	                onOpen={onOpenPath}
  1610	                onSplit={openInSplit}
  1611	                onReveal={revealInFinder}
  1612	                onTogglePin={togglePinnedPath}
  1613	                onRowMove={(e) => handleRowMove(item, e.currentTarget, e)}
  1614	                onRowLeave={onRowLeave}
  1615	              />
  1616	            );
  1617	          })
  1618	        )}
  1619	      </div>
  1620	    ) : null;
  1621	
  1622	  const listBody =
  1623	    railLayout === "stacked" ? (
  1624	      <div data-testid="rail-layout-stacked">
  1625	        {railSections.map((section) => (
  1626	          <section
  1627	            key={section.key}
  1628	            data-testid="rail-section"
  1629	            data-section={section.key}
  1630	          >
  1631	            <RailSectionHead label={section.label} sticky />
  1632	            {renderList(section.key)}
  1633	          </section>
  1634	        ))}
  1635	      </div>
  1636	    ) : (
  1637	      <div data-testid="rail-layout-tabs">
  1638	        <div className="flex border-b border-gray-100 dark:border-gray-800">
  1639	          {railSections.map((section) => (
  1640	            <button
  1641	              key={section.key}
  1642	              type="button"
  1643	              data-testid="rail-tab"
  1644	              data-section={section.key}
  1645	              data-active={activeSection === section.key ? "true" : "false"}
  1646	              onClick={() => setRailSection(section.key)}
  1647	              className={`flex-1 px-1 py-1 text-[11px] ${
  1648	                activeSection === section.key
  1649	                  ? "border-b-2 border-[var(--app-accent)] text-[var(--app-accent)]"
  1650	                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
  1651	              }`}
  1652	            >
  1653	              {section.label}
  1654	            </button>
  1655	          ))}
  1656	        </div>
  1657	        <div data-testid="rail-list">{renderList(activeSection)}</div>
  1658	      </div>
  1659	    );
  1660	
  1661	  const panel = (
  1662	    <div
  1663	      ref={railPanelRef}
  1664	      className="rail-panel flex h-full flex-col bg-gray-50 text-sm dark:bg-gray-900"
  1665	    >

exec
/bin/zsh -c "nl -ba src/lib/railView.ts | sed -n '155,300p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   155	export function timeBucketOf(
   156	  openedAt: string,
   157	  now: number = Date.now(),
   158	): Exclude<RailSearchTime, "all"> {
   159	  const t = new Date(openedAt).getTime();
   160	  if (!Number.isFinite(t)) return "older";
   161	  if (t >= startOfLocalDay(now)) return "today";
   162	  if (t >= now - 7 * DAY_MS) return "week";
   163	  return "older";
   164	}
   165	
   166	export interface SearchMatch {
   167	  hit: SearchHit;
   168	  /** 标题里需要高亮的区间。 */
   169	  ranges: MatchRange[];
   170	  /** 命中片段里需要高亮的区间。 */
   171	  excerptRanges: MatchRange[];
   172	}
   173	
   174	/**
   175	 * 本机检索结果过滤：类型 chip + 时间段 + query 命中区间。
   176	 * Rust 侧已按 query 过滤，这里再算一次高亮区间（标题与片段各自独立）。
   177	 */
   178	export function filterSearchHits(
   179	  hits: ReadonlyArray<SearchHit>,
   180	  opts: {
   181	    chip: RailChipKind;
   182	    time: RailSearchTime;
   183	    query: string;
   184	    now?: number;
   185	  },
   186	): SearchMatch[] {
   187	  const { chip, time, query, now } = opts;
   188	  const needle = query.trim();
   189	  const out: SearchMatch[] = [];
   190	  for (const hit of hits) {
   191	    if (chip !== "all" && fileTypeOf(hit.path) !== chip) continue;
   192	    if (time !== "all" && timeBucketOf(hit.openedAt, now) !== time) continue;
   193	    const ranges = matchRanges(hit.title, needle);
   194	    // 高亮区间按「展示文本」算：Markdown 卡片渲染时会剥掉语法，若这里按原文算，
   195	    // 区间会整体错位。是否保留命中仍看原文，避免 query 只命中语法时被误丢。
   196	    const displayExcerpt =
   197	      fileTypeOf(hit.path) === "markdown"
   198	        ? stripMarkdownOf(hit.excerpt)
   199	        : hit.excerpt;
   200	    const rawExcerptRanges = matchRanges(hit.excerpt, needle);
   201	    const excerptRanges = matchRanges(displayExcerpt, needle);
   202	    if (needle && ranges.length === 0 && rawExcerptRanges.length === 0)
   203	      continue;
   204	    out.push({ hit, ranges, excerptRanges });
   205	  }
   206	  return out;
   207	}
   208	
   209	/** 一处命中：`[start, end)` 的半开区间（单位是字符下标）。 */
   210	export type MatchRange = [number, number];
   211	
   212	/** 大小写不敏感地找出 query 在 text 中的全部命中区间（非重叠、顺着扫）。 */
   213	export function matchRanges(text: string, query: string): MatchRange[] {
   214	  if (!query) return [];
   215	  const hay = text.toLowerCase();
   216	  const needle = query.toLowerCase();
   217	  if (!needle) return [];
   218	  const ranges: MatchRange[] = [];
   219	  let from = 0;
   220	  for (;;) {
   221	    const idx = hay.indexOf(needle, from);
   222	    if (idx === -1) break;
   223	    ranges.push([idx, idx + needle.length]);
   224	    from = idx + needle.length;
   225	  }
   226	  return ranges;
   227	}
   228	
   229	export interface RailMatch {
   230	  item: RecentFile;
   231	  /** 标题里需要高亮的区间；query 为空时为空数组。 */
   232	  ranges: MatchRange[];
   233	}
   234	
   235	/**
   236	 * 过滤 + 命中高亮。chip 是严格类型相等（非 all 时只留该类型，类型不符的绝不出现在
   237	 * 结果里）；query 走标题的大小写不敏感子串匹配，空 query 即不过滤、无命中区间。
   238	 */
   239	export function filterRailItems(
   240	  items: RecentFile[],
   241	  opts: { chip: RailChipKind; query: string },
   242	): RailMatch[] {
   243	  const { chip, query } = opts;
   244	  const out: RailMatch[] = [];
   245	  for (const item of items) {
   246	    if (chip !== "all" && fileTypeOf(item.path) !== chip) continue;
   247	    if (!query) {
   248	      out.push({ item, ranges: [] });
   249	      continue;
   250	    }
   251	    const ranges = matchRanges(item.title, query);
   252	    if (ranges.length > 0) out.push({ item, ranges });
   253	  }
   254	  return out;
   255	}
   256	
   257	/**
   258	 * 把标题按命中区间切成片段，供渲染层插入 `<mark>`。
   259	 * 命中区间不重叠且有序（见 matchRanges），这里不再去重。
   260	 */
   261	export function splitByRanges(
   262	  text: string,
   263	  ranges: MatchRange[],
   264	): Array<{ text: string; hit: boolean }> {
   265	  if (ranges.length === 0) return [{ text, hit: false }];
   266	  const parts: Array<{ text: string; hit: boolean }> = [];
   267	  let cursor = 0;
   268	  for (const [start, end] of ranges) {
   269	    if (start > cursor)
   270	      parts.push({ text: text.slice(cursor, start), hit: false });
   271	    parts.push({ text: text.slice(start, end), hit: true });
   272	    cursor = end;
   273	  }
   274	  if (cursor < text.length)
   275	    parts.push({ text: text.slice(cursor), hit: false });
   276	  return parts;
   277	}

exec
/bin/zsh -c "nl -ba src-tauri/src/config.rs | sed -n '160,200p;1070,1125p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   160	pub struct PreviewSettings {
   161	    pub rail_hover: Option<bool>,
   162	    /// hover / click / off；非法值由校验拦下。
   163	    pub grid_mode: Option<String>,
   164	    pub enabled: Option<bool>,
   165	}
   166	
   167	/// 阅读空间栏视图规格：布局（堆叠/标签）、密度（紧凑/舒适/卡片）与卡片高度。
   168	#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
   169	#[serde(rename_all = "camelCase")]
   170	pub struct RailViewSpec {
   171	    pub layout: Option<String>,
   172	    pub density: Option<String>,
   173	    /// 卡片档高度 88–160；旧配置无此字段仍可加载（default + skip）。
   174	    #[serde(default, skip_serializing_if = "Option::is_none")]
   175	    pub card_height: Option<f64>,
   176	}
   177	
   178	#[derive(Debug, Serialize, Deserialize, Clone)]
   179	#[serde(rename_all = "camelCase")]
   180	pub struct RecentFile {
   181	    pub path: String,
   182	    pub title: String,
   183	    pub opened_at: String,
   184	    /// 打开时截下的正文开头；门户卡片用它显示真摘要。
   185	    /// `default` + `skip_serializing_if` 保证老配置文件仍能读、新文件不多出空字段。
   186	    #[serde(default, skip_serializing_if = "Option::is_none")]
   187	    pub excerpt: Option<String>,
   188	}
   189	
   190	#[derive(Debug, Serialize, Deserialize, Clone)]
   191	#[serde(rename_all = "camelCase")]
   192	pub struct ScrollPosition {
   193	    pub scroll_pos: f64,
   194	    pub content_height: f64,
   195	}
   196	
   197	impl Default for AppConfig {
   198	    fn default() -> Self {
   199	        Self {
   200	            font_size: Some(17.0),
  1070	    }
  1071	
  1072	    fn write_user(base: &Path, json: &str) {
  1073	        let path = user_path(base);
  1074	        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
  1075	        std::fs::write(&path, json).unwrap();
  1076	    }
  1077	
  1078	    fn read_user(base: &Path) -> String {
  1079	        std::fs::read_to_string(user_path(base)).unwrap()
  1080	    }
  1081	
  1082	    #[test]
  1083	    fn user_overrides_defaults() {
  1084	        let dir = temp_base("merge");
  1085	        let base = dir.path();
  1086	        write_user(base, r#"{"theme":"dark"}"#);
  1087	
  1088	        let config = load_config_at(base).unwrap();
  1089	
  1090	        assert_eq!(config.theme.as_deref(), Some("dark"));
  1091	        // 未覆盖的键仍来自 defaults
  1092	        assert_eq!(config.font_size, Some(17.0));
  1093	        assert_eq!(config.reader_width, Some(1080.0));
  1094	    }
  1095	
  1096	    #[test]
  1097	    fn save_keeps_derived_state_out_of_user_file() {
  1098	        let dir = temp_base("split");
  1099	        let base = dir.path();
  1100	        let mut config = AppConfig::default();
  1101	        config.recent_files = Some(vec![RecentFile {
  1102	            path: "/tmp/a.md".into(),
  1103	            title: "a.md".into(),
  1104	            opened_at: "2026-01-01T00:00:00Z".into(),
  1105	            excerpt: None,
  1106	        }]);
  1107	
  1108	        save_config_at(base, &config).unwrap();
  1109	
  1110	        let user = read_user(base);
  1111	        assert!(
  1112	            !user.contains("recentFiles"),
  1113	            "user 层不应含 recentFiles: {user}"
  1114	        );
  1115	        assert!(
  1116	            !user.contains("scrollPositions"),
  1117	            "user 层不应含 scrollPositions: {user}"
  1118	        );
  1119	        let state = std::fs::read_to_string(state_path(base)).unwrap();
  1120	        assert!(state.contains("recentFiles"));
  1121	        assert_eq!(load_config_at(base).unwrap().recent_files.unwrap().len(), 1);
  1122	    }
  1123	
  1124	    #[test]
  1125	    fn atomic_write_failure_keeps_original_bytes() {

exec
/bin/zsh -c "rg -n \"frontmatter|tags|theme\\.toml|SKILL\\.md|disabled|数据包|A4|A1|A2|A3|插件\" docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md docs/research/technical/plugin-management-benchmark.md | head -n 240" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/research/technical/plugin-management-benchmark.md:2:title: 插件管理机制对标研究：DeepSeek Harness / Pi / Obsidian / Omarchy → Clairis
docs/research/technical/plugin-management-benchmark.md:9:# 插件管理机制对标研究：DeepSeek Harness / Pi / Obsidian / Omarchy → Clairis
docs/research/technical/plugin-management-benchmark.md:11:> 目的：为 Clairis 设计插件（扩展）管理机制提供对标依据。素材为各产品官方文档一手来源 + 本仓库现状调查（2026-09-27）。
docs/research/technical/plugin-management-benchmark.md:16:## 一、四个产品的插件机制概览
docs/research/technical/plugin-management-benchmark.md:18:### 1. DeepSeek Harness —— "一切皆插件"（Cordis 元框架）
docs/research/technical/plugin-management-benchmark.md:20:**架构底座**：其插件系统建立在 Cordis 框架（`@deepseek-ai/cordis`，论文 arXiv 2608.25512）之上。Cordis 提供"时空可组合性"两个正交维度的形式化保证：
docs/research/technical/plugin-management-benchmark.md:22:- **时间可组合性（revertible effects）**：每个组件通过 context 注册的所有副作用（事件监听、工具、定时器、服务）都自动携带逆操作，**插件卸载时自动完整回滚**——不需要手写 removeListener/clearInterval。
docs/research/technical/plugin-management-benchmark.md:25:**插件形态**：就是一个导出 `apply(ctx)` 的 TypeScript 模块（函数/对象/Service 类三种形式）。**没有传统 manifest 文件**——本地插件通过 `cordis.yml` patch（覆盖层）注册绝对路径，`pnpm dsh web --patch ./cordis.yml` 加载。
docs/research/technical/plugin-management-benchmark.md:27:**管理方式**：极简。当前处于开发者导向阶段，无插件市场、无权限模型、无沙箱（文档未提及）。"一切皆插件"落地为：任何能力（工具/服务/事件/定时器）都经同一个 `ctx` 注册并纳入自动清理体系。
docs/research/technical/plugin-management-benchmark.md:37:### 3. Obsidian —— 核心插件 / 社区插件双轨制
docs/research/technical/plugin-management-benchmark.md:39:- **核心插件**：官方内置、默认部分开启、可逐个关闭，与 app 同版本发布，不需要"安装"。
docs/research/technical/plugin-management-benchmark.md:40:- **社区插件**：每个插件是 vault 内 `.obsidian/plugins/<id>/` 目录（`manifest.json` + `main.js` + 可选 `styles.css` + `data.json` 存设置）。
docs/research/technical/plugin-management-benchmark.md:44:  - 默认 **Restricted Mode**——不执行任何第三方代码；用户显式开启社区插件。
docs/research/technical/plugin-management-benchmark.md:50:Omarchy 没有传统意义上的插件系统，它的可扩展性来自**约定式数据文件**：
docs/research/technical/plugin-management-benchmark.md:54:- 第三方主题被**剥掉可执行文件**只留颜色数据——用数据格式本身限制插件能力，而非沙箱。
docs/research/technical/plugin-management-benchmark.md:63:| 插件形态 | `apply(ctx)` TS 模块 | TS/JS 模块（文件/目录/npm 包） | manifest+main.js 目录包 | 数据文件（jsonc/toml/目录约定） |
docs/research/technical/plugin-management-benchmark.md:74:1. **插件真相源是文件系统目录**，不是注册表/数据库——可 git、可备份、可被 agent 读写。
docs/research/technical/plugin-management-benchmark.md:75:2. **生命周期必须有卸载回滚**：Harness 用 effect 逆操作自动化，Obsidian 用 onload/onunload 约定，Pi 用事件。没有回滚约定的插件系统都会腐烂。
docs/research/technical/plugin-management-benchmark.md:77:4. **数据文件优先于 API**：能力面越收敛为声明式数据，插件越安全、越可被 AI 生成。
docs/research/technical/plugin-management-benchmark.md:83:- **无面向用户的插件系统**。代码中 `plugin/extension` 全部是编辑器内部实现（CM6 extensions、slash 菜单、marked math extension）。
docs/research/technical/plugin-management-benchmark.md:84:- **最接近"插件"的既有机制**是 mdpkg（Markdown 打包格式）：`manifest.extensions.symbols`（`off|core|extended`）与 `extensions_required`（封闭 schema，不支持项报错 E702）——这是**文档级**的能力声明，不是应用级插件。
docs/research/technical/plugin-management-benchmark.md:85:- 产品信条（`docs/product/principles.md`）："用最少干扰达成用户所愿"、键盘优先 ≥80%、无边栏零弹窗。**大而全的插件管理 UI 与信条冲突**。
docs/research/technical/plugin-management-benchmark.md:86:- Omarchy 映射报告（ticket #21）已给出关键判断：**"扩展点 = 数据文件，先做约定式数据，再做插件 API"**（启示 8）+ 所有权三分（启示 3）。
docs/research/technical/plugin-management-benchmark.md:94:- **内置能力 = 核心插件化**：把 Clairis 内置功能（数学渲染、代码高亮、拖拽上传…）按"核心插件"组织——统一可开关、统一生命周期，但**默认全开、藏进设置深处**（不学 Obsidian 的长开关列表，学 Omarchy 的"默认值即产品"）。
docs/research/technical/plugin-management-benchmark.md:95:- **这一步不需要插件 API**，只是内部架构收敛：每个核心能力实现 `enable()/disable()` 幂等接口。它为未来社区插件铺路（同一个生命周期约定），又立刻改善内部代码组织。
docs/research/technical/plugin-management-benchmark.md:107:### 建议 3：若做代码级插件，取 Pi 形态 + Obsidian 安全门
docs/research/technical/plugin-management-benchmark.md:110:- 安全：**默认关闭第三方插件**（Restricted Mode 等价物）+ 目录级信任确认；远期分发再考虑审核，现阶段不做市场。
docs/research/technical/plugin-management-benchmark.md:111:- 与 Clairis 信条的衔接：插件管理入口放设置深处，无常驻 UI，零弹窗。
docs/research/technical/plugin-management-benchmark.md:127:| P0（无 API） | 核心能力插件化（统一 enable/disable）+ 数据文件扩展点（snippets/templates/主题 token）| Omarchy |
docs/research/technical/plugin-management-benchmark.md:131:**一句话结论**：Clairis 不需要"插件市场"式的管理界面，需要的是**Omarchy 式的数据文件扩展点 + Obsidian 式的双轨与安全门 + Cordis 式的卸载回滚纪律**——先让"放一个文件到某个目录"成为唯一的插件形态，等真实需求出现再上代码级 API。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:1:# 插件化能力提取方案
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:4:> 对应目标：第 1 项——盘点本仓可提取为插件的能力清单与提取方案
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:9:本仓能力按 AGENTS.md 两个目标取向可提取为插件：① **独立控制、开发升级**——能力独立打包、独立加载、独立升级；② **能力复用与用户自定义**——用户可按需启用/停用、自定义扩展。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:11:本方案回答：哪些能力可提取为插件、插件的形态与边界、加载/生命周期/权限设计，以及分批提取路线。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:13:## 2. 插件形态定义（三类，互斥）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:17:| **配置型插件** | 声明式数据（JSON/TOML/Markdown） | 加载时读入、映射到配置字段 | 纯数据可配置的能力 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:18:| **注册型插件** | 注册数据（manifest + JSON） | 加载时解析注册表 | 结构可增删、需校验的能力 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:19:| **技能型插件** | SKILL.md 驱动的 AGENT 能力包 | 注入 AGENT 上下文 | AI 能力 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:21:**术语统一**：目录名与文档统一用 **plugin**（不复用既有「extension」术语，避免混淆）。插件目录定为 `data/plugins/`（独立于 `user/`，用户层）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:23:## 3. 可提取为插件的能力清单
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:27:### A 档：已具备插件化形态（保持，统一纳入插件体系管理）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:29:| # | 能力 | 现状（已校正） | 插件形态 | 状态 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:31:| A1 | **扩展包** | 已文件化的扩展目录（含 manifest）。**注意**：manifest 字段名在文档/示例/代码间不一致，加载管线是同步一次性加载、无热重载 | 注册型 | ✅ 已存在，需收尾（见 P1） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:32:| A2 | **技能映射** | `SKILL_MAP`（`config.rs:977-1031` `seed_skill_map`）已把 AGENT 能力声明化（SKILL_MD 注入 AGENT 上下文） | 技能型 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:33:| A3 | **主题覆盖** | `theme.toml` 白名单覆盖，**仅颜色 token，无装饰主题切换**。无 `themeProvider` 结构、无历史逻辑 | 配置型 | ✅ 已落地，扩展面有限（见 A3 边界） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:34:| A4 | **编辑器扩展** | **现状描述修正**：`capabilities` 键已是声明式开关，**消费方不止 AI 上下文**——`SettingsView.tsx` 直接消费（`set`/`toggle` 扩展项，可见性与开关同态），**AI 工具则完全由 SKILL.md 驱动**，无 settings 入口。入口并非「散落在设置深处」，而是按能力类型分两处：编辑器扩展在设置页可见开关，AI 能力在 SKILL 注入面 | 注册型 | ✅ 已落地，**消费方分两类，需在清单中显式区分** |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:37:### B 档：可进一步插件化（当前是代码常量或未充分声明）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:39:| # | 能力 | 现状（已校正） | 插件形态 | AGENT 自定义价值 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:42:| B2 | **轮盘扇区** | `rouletteSectors` **已文件化在 `settings.json`**（`config.rs:65`），设置页有勾选 UI。默认集合 `ROOT_SECTORS` 是常量 | 配置型 | AGENT 自定义扇区（默认集合可插件化） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:43:| B3 | **工具条按钮** | `htmlToolbarItems` **已文件化在 `settings.json`**（`config.rs:68`），设置页可编辑 | 配置型 | AGENT 自定义工具条按钮（已落地，仅需统一纳入插件体系） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:51:**注**：B2/B3 实际已文件化，本档列出是为「统一纳入插件体系管理」的收尾，非新做。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:53:### C 档：不插件化（明确不做）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:55:| # | 能力 | 不插件化理由 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:57:| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005），不进入插件体系 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:58:| C2 | **编辑器运行时状态**（undo/选区、CM6 实例） | 运行时状态归 `editorRef.ts`，不插件化 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:60:| C4 | **执行用户代码的能力** | 插件不执行用户代码（配置型/注册型/技能型均不引入执行） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:61:| C5 | **与数据文件化重复的能力** | **配置载体证据补全**：A3/A4/A5 等已由数据文件化承载，插件化重复时以数据文件为单一落点，避免双写。插件体系管「打包/加载/升级」维度，数据文件管「配置值」维度，两者在 A 档能力上是**正交维度**而非重复（见 §5.3） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:65:### 4.1 插件目录结构
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:68:data/plugins/                     插件根（用户层，独立于 user/）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:70:    manifest.json                 插件声明（字段名统一，见 §4.2）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:71:    <data files>                  配置型/注册型插件的数据
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:72:    SKILL.md                      技能型插件的能力声明
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:80:- `id`（插件唯一标识）、`name`（显示名）、`version`、`type`（config/registry/skill）、`description`
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:81:- 注册型插件增补 `permissions`（声明所需权限，如 `filesystem`）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:90:- **加载**：启动时同步扫描 `data/plugins/`，逐插件读 manifest、校验权限、解析数据 → 映射到配置/注册表/AGENT 上下文。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:91:- **生命周期裁定（修正 P2）**：**以「重启生效」为主**，不承诺热加载。热加载需先建 watcher 基础设施（与第 2 项 §5.3 一致，`settings.json` 已有 watcher，但 `data/plugins/` 无）。**裁定**：插件改动重启生效，热加载列为后续，不在本批实现。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:92:- **容错**：单个插件解析失败 → 跳过 + 告警，不影响其他插件与主应用（加载期巡检保留）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:94:### 4.4 SKILL.md 注入面（补充 P3 遗漏）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:99:- **注入拼装**：AGENT 上下文构建时，聚合所有已启用技能型插件的 SKILL.md 内容（+ 内置 SKILL_MAP），拼装为 AGENT 的能力声明。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:100:- **边界**：注入内容仅声明「AGENT 可做什么」，不引入可执行代码（技能型插件仍走 AGENT 调用，不直接执行用户代码）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:101:- **可见性**：与第 2 项 §5.5 的 SKILL_MAP 载体统一——插件体系管「哪些插件贡献 SKILL.md」，数据文件体系管「字段配置」，两者在技能型插件上协同。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:103:### 4.5 配置载体与插件的维度划分（澄清 C5）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:105:**裁定**：插件体系与数据文件化是**正交维度**，不重复：
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:107:- **插件化**管「打包/加载/升级」——能力如何独立打包、独立加载、独立升级、权限声明。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:109:A 档能力（A3 主题、A4 扩展、A5 片段模板）两者都涉及：数据文件是其**配置值载体**，插件是其**打包加载载体**。**单一落点原则**：某能力若已由数据文件化承载配置值，插件化不再重复建配置落点，只补打包/加载维度。避免双写。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:115:**设计**：slash 命令单独建 `data/plugins/<id>/commands/` 或 `user/commands.json`，与扩展包/技能型插件并列。在清单中显式标注其独立通路，避免与技能型插件混为一谈。实现时定具体落点。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:119:**风险**：AGENT 生成插件无校验——AGENT 可生成任意插件写入 `data/plugins/`，若无校验可能引入无效/恶意插件。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:123:- **只读扩展面**：插件数据只读消费，不执行用户代码（C4 排除），最坏「没生效」不会「搞坏应用」。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:124:- **告警**：加载失败插件跳过 + 聚合告警，用户可见。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:130:1. **第一批（收尾既有插件形态）**：A1 扩展包 manifest 字段统一 + 权限声明补全；A2/A4 消费方分两类显式区分；B2/B3 统一纳入插件体系登记。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:131:2. **第二批（配置型插件）**：B1 胶囊工具条、B4 菜单、B5 图标、B7 导出配置、B8 阅读预设、B9 新文档默认（与第 2 项数据文件化协同，配置值落点由数据文件承载）。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:132:3. **第三批（技能型与 slash 命令）**：A2 SKILL 注入面拼装细化；B6 键位绑定插件化（依赖第 3 项按键分发层重接线）；slash 命令独立通路落点。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:133:4. **第四批（生命周期与热加载评估）**：插件热加载评估（watcher 基础设施），若成本可接受则补，否则维持重启生效。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:143:1. **P0 A4 现状断言错误（硬伤）**：方案称扩展包「消费端仅到 AI 上下文、入口散落在设置深处」，实际 SettingsView 直接消费 capabilities，AI 工具由 SKILL.md 驱动 → 已采纳，§3 A4 现状描述按「消费方分两类（设置页开关 + SKILL 注入面）」校正。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:144:2. **P1 引用参数不准**：manifest 字段名不一致；扩展包 JSON 缺 filesystem 权限声明；THEME_EXTRA 清单与实际白名单不符；三段式 split 与 extensions.rs 实际不符 → 已采纳，§4.2 统一字段、§4.2 补权限声明、§4.3 加载管线按同步加载校正、A3 边界补「无主题切换结构」。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:145:3. **P2 生命周期不自洽**：扩展包同步加载无热重载；「重启生效」与「热加载」并存未裁定；插件模板 skill 无注册表登记；目录名/落点未定 → 已采纳，§4.3 裁定重启生效为主、热加载列后续；§2 术语统一 plugin；§4.1 目录落 `data/plugins/`。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:146:4. **P3 遗漏**：capabilities 消费方清单不全；slash 命令独立通路未单列；无风险评估；C5 排除理由缺配置载体证据；A3 用户能力边界未明确 → 已采纳，§4.4 SKILL 注入面、§4.6 slash 命令通路、§4.7 风险评估、§3 C5 配置载体证据、§3 A3 边界。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:148:**可保留**：三类插件形态定义、A 档定性（除 A4 描述）、C1/C5 排除结论、分批路线结构。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:150:**未检查**：patch_config 是否在他处存在；SKILL.md 注入拼装细节（已在 §4.4 设计，实现时需对齐真实拼装点）。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:20:- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:33:| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:54:| 主题覆盖 | `theme.toml`（白名单 13 个 `--app-*` token，是 `tokens.css` 17 个的子集） | 主题注入 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:71:| B10 | **新建文档默认** | `defaultNewDocFormat` 不存在；相近字段是 `defaultSavePath` | `user/newdoc.json`：默认保存路径、默认模板、默认 frontmatter | AGENT 自定义新文档模板与默认路径 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:81:| C4 | **执行代码的能力** | 数据文件不执行用户代码（与插件方案 C 档一致） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:102:app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:130:- 每个 B 档文件规定**加载端契约**：加载失败/非法时的语义——**回退默认 + 聚合告警**（对齐 `theme.toml` 的白名单过滤纪律）。

exec
/bin/zsh -c "nl -ba docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md | sed -n '1,320p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# 插件化能力提取方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 1 项——盘点本仓可提取为插件的能力清单与提取方案
     5	> 事实基线：`src-tauri/src/extensions.rs`、`src/lib/capabilities.ts`、`src/ui/settings/SettingsView.tsx`、`src-tauri/src/commands/ai_agent.rs`、`docs/research/technical/data-fileization-omarchy-inventory.md`、`docs/agents/data-surface.md`
     6	
     7	## 1. 背景与目标
     8	
     9	本仓能力按 AGENTS.md 两个目标取向可提取为插件：① **独立控制、开发升级**——能力独立打包、独立加载、独立升级；② **能力复用与用户自定义**——用户可按需启用/停用、自定义扩展。
    10	
    11	本方案回答：哪些能力可提取为插件、插件的形态与边界、加载/生命周期/权限设计，以及分批提取路线。
    12	
    13	## 2. 插件形态定义（三类，互斥）
    14	
    15	| 形态 | 结构 | 加载方式 | 适用 |
    16	|---|---|---|---|
    17	| **配置型插件** | 声明式数据（JSON/TOML/Markdown） | 加载时读入、映射到配置字段 | 纯数据可配置的能力 |
    18	| **注册型插件** | 注册数据（manifest + JSON） | 加载时解析注册表 | 结构可增删、需校验的能力 |
    19	| **技能型插件** | SKILL.md 驱动的 AGENT 能力包 | 注入 AGENT 上下文 | AI 能力 |
    20	
    21	**术语统一**：目录名与文档统一用 **plugin**（不复用既有「extension」术语，避免混淆）。插件目录定为 `data/plugins/`（独立于 `user/`，用户层）。
    22	
    23	## 3. 可提取为插件的能力清单
    24	
    25	按提取条件分三档。**A 档现状描述已校正**。
    26	
    27	### A 档：已具备插件化形态（保持，统一纳入插件体系管理）
    28	
    29	| # | 能力 | 现状（已校正） | 插件形态 | 状态 |
    30	|---|---|---|---|---|
    31	| A1 | **扩展包** | 已文件化的扩展目录（含 manifest）。**注意**：manifest 字段名在文档/示例/代码间不一致，加载管线是同步一次性加载、无热重载 | 注册型 | ✅ 已存在，需收尾（见 P1） |
    32	| A2 | **技能映射** | `SKILL_MAP`（`config.rs:977-1031` `seed_skill_map`）已把 AGENT 能力声明化（SKILL_MD 注入 AGENT 上下文） | 技能型 | ✅ 已落地 |
    33	| A3 | **主题覆盖** | `theme.toml` 白名单覆盖，**仅颜色 token，无装饰主题切换**。无 `themeProvider` 结构、无历史逻辑 | 配置型 | ✅ 已落地，扩展面有限（见 A3 边界） |
    34	| A4 | **编辑器扩展** | **现状描述修正**：`capabilities` 键已是声明式开关，**消费方不止 AI 上下文**——`SettingsView.tsx` 直接消费（`set`/`toggle` 扩展项，可见性与开关同态），**AI 工具则完全由 SKILL.md 驱动**，无 settings 入口。入口并非「散落在设置深处」，而是按能力类型分两处：编辑器扩展在设置页可见开关，AI 能力在 SKILL 注入面 | 注册型 | ✅ 已落地，**消费方分两类，需在清单中显式区分** |
    35	| A5 | **片段 / 模板** | `snippets/*.md`、`templates/*.md` 已文件化，斜杠菜单/模板选择器消费 | 配置型 | ✅ 已落地 |
    36	
    37	### B 档：可进一步插件化（当前是代码常量或未充分声明）
    38	
    39	| # | 能力 | 现状（已校正） | 插件形态 | AGENT 自定义价值 |
    40	|---|---|---|---|---|
    41	| B1 | **胶囊工具条** | 胶囊按钮集是代码常量；`selectionToolbar: "roulette"|"capsule"` 切换已存在 | 配置型 | AGENT 配置胶囊按钮集 |
    42	| B2 | **轮盘扇区** | `rouletteSectors` **已文件化在 `settings.json`**（`config.rs:65`），设置页有勾选 UI。默认集合 `ROOT_SECTORS` 是常量 | 配置型 | AGENT 自定义扇区（默认集合可插件化） |
    43	| B3 | **工具条按钮** | `htmlToolbarItems` **已文件化在 `settings.json`**（`config.rs:68`），设置页可编辑 | 配置型 | AGENT 自定义工具条按钮（已落地，仅需统一纳入插件体系） |
    44	| B4 | **菜单结构** | 菜单项常量在 `src/lib/paneHeaderMenu.ts`（PANE/EXPORT/AI_PANE 三表） | 配置型 | AGENT 增删/排序菜单项 |
    45	| B5 | **图标注册表** | `src/ui/icons.ts` + `src/editors/icons.ts`，代码常量 | 配置型 | AGENT 替换/新增图标 |
    46	| B6 | **键位绑定** | `keybindings.ts` + `shortcuts.ts`（`SHORTCUTS` 常量表），`ShortcutDef` 已带 `scope` 结构 | 配置型 | AGENT 重映射键位（**依赖按键分发层重接线，见第 3 项 §4.4**） |
    47	| B7 | **导出配置** | 导出菜单代码常量，无持久化导出设置 | 配置型 | AGENT 自定义导出格式 |
    48	| B8 | **阅读预设** | `readerFontSize` 数值型，无预设集合 | 配置型 | AGENT 增加阅读预设 |
    49	| B9 | **新建文档默认** | `defaultNewDocFormat` 不存在，相近 `defaultSavePath` | 配置型 | AGENT 自定义新文档模板 |
    50	
    51	**注**：B2/B3 实际已文件化，本档列出是为「统一纳入插件体系管理」的收尾，非新做。
    52	
    53	### C 档：不插件化（明确不做）
    54	
    55	| # | 能力 | 不插件化理由 |
    56	|---|---|---|
    57	| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005），不进入插件体系 |
    58	| C2 | **编辑器运行时状态**（undo/选区、CM6 实例） | 运行时状态归 `editorRef.ts`，不插件化 |
    59	| C3 | **模式切换/渲染管线运行时开关** | 由 `capabilities` 统一管理，运行时行为 |
    60	| C4 | **执行用户代码的能力** | 插件不执行用户代码（配置型/注册型/技能型均不引入执行） |
    61	| C5 | **与数据文件化重复的能力** | **配置载体证据补全**：A3/A4/A5 等已由数据文件化承载，插件化重复时以数据文件为单一落点，避免双写。插件体系管「打包/加载/升级」维度，数据文件管「配置值」维度，两者在 A 档能力上是**正交维度**而非重复（见 §5.3） |
    62	
    63	## 4. 设计实现方案
    64	
    65	### 4.1 插件目录结构
    66	
    67	```
    68	data/plugins/                     插件根（用户层，独立于 user/）
    69	  <plugin-id>/
    70	    manifest.json                 插件声明（字段名统一，见 §4.2）
    71	    <data files>                  配置型/注册型插件的数据
    72	    SKILL.md                      技能型插件的能力声明
    73	```
    74	
    75	### 4.2 manifest 字段统一（修正 P1）
    76	
    77	**现状**：manifest 字段名在文档/示例/代码间不一致（`id`/`name`/`version` 等字段各文档写法不同）。
    78	
    79	**设计**：统一 manifest 字段为：
    80	- `id`（插件唯一标识）、`name`（显示名）、`version`、`type`（config/registry/skill）、`description`
    81	- 注册型插件增补 `permissions`（声明所需权限，如 `filesystem`）
    82	
    83	**权限声明（修正 P1 遗漏）**：扩展包内 JSON 当前**缺 `filesystem` 权限声明**（需在 `env.toml` 声明）。manifest 的 `permissions` 字段补上，加载时校验声明的权限是否在白名单内。
    84	
    85	### 4.3 加载管线（修正 P1/P2）
    86	
    87	**现状（校正）**：`extensions.rs` 是**同步一次性加载**，无热重载。方案原称的「加载期巡检、容错、热加载」与实际不符。
    88	
    89	**设计**：
    90	- **加载**：启动时同步扫描 `data/plugins/`，逐插件读 manifest、校验权限、解析数据 → 映射到配置/注册表/AGENT 上下文。
    91	- **生命周期裁定（修正 P2）**：**以「重启生效」为主**，不承诺热加载。热加载需先建 watcher 基础设施（与第 2 项 §5.3 一致，`settings.json` 已有 watcher，但 `data/plugins/` 无）。**裁定**：插件改动重启生效，热加载列为后续，不在本批实现。
    92	- **容错**：单个插件解析失败 → 跳过 + 告警，不影响其他插件与主应用（加载期巡检保留）。
    93	
    94	### 4.4 SKILL.md 注入面（补充 P3 遗漏）
    95	
    96	**现状（校正）**：`seed_skill_map` 已把 SKILL_MD 注入 AGENT 上下文，但方案此前未设计**注入面的拼装与边界**。
    97	
    98	**设计**：
    99	- **注入拼装**：AGENT 上下文构建时，聚合所有已启用技能型插件的 SKILL.md 内容（+ 内置 SKILL_MAP），拼装为 AGENT 的能力声明。
   100	- **边界**：注入内容仅声明「AGENT 可做什么」，不引入可执行代码（技能型插件仍走 AGENT 调用，不直接执行用户代码）。
   101	- **可见性**：与第 2 项 §5.5 的 SKILL_MAP 载体统一——插件体系管「哪些插件贡献 SKILL.md」，数据文件体系管「字段配置」，两者在技能型插件上协同。
   102	
   103	### 4.5 配置载体与插件的维度划分（澄清 C5）
   104	
   105	**裁定**：插件体系与数据文件化是**正交维度**，不重复：
   106	- **数据文件化**管「配置值」——字段值存哪、怎么合并、怎么热应用。
   107	- **插件化**管「打包/加载/升级」——能力如何独立打包、独立加载、独立升级、权限声明。
   108	
   109	A 档能力（A3 主题、A4 扩展、A5 片段模板）两者都涉及：数据文件是其**配置值载体**，插件是其**打包加载载体**。**单一落点原则**：某能力若已由数据文件化承载配置值，插件化不再重复建配置落点，只补打包/加载维度。避免双写。
   110	
   111	### 4.6 slash 命令通路（补充 P3 遗漏）
   112	
   113	**现状**：slash 命令是**独立于扩展包的另一条数据文件化通路**，方案此前未单列。
   114	
   115	**设计**：slash 命令单独建 `data/plugins/<id>/commands/` 或 `user/commands.json`，与扩展包/技能型插件并列。在清单中显式标注其独立通路，避免与技能型插件混为一谈。实现时定具体落点。
   116	
   117	### 4.7 风险评估（补充 P3 遗漏）
   118	
   119	**风险**：AGENT 生成插件无校验——AGENT 可生成任意插件写入 `data/plugins/`，若无校验可能引入无效/恶意插件。
   120	
   121	**设计**：
   122	- **加载期校验**：manifest 字段校验 + 权限白名单校验（§4.2/§4.3）。
   123	- **只读扩展面**：插件数据只读消费，不执行用户代码（C4 排除），最坏「没生效」不会「搞坏应用」。
   124	- **告警**：加载失败插件跳过 + 聚合告警，用户可见。
   125	
   126	## 5. 分批实施路线
   127	
   128	每批一个 OpenSpec change（G0–G4），每批注明按 data-surface 六栏契约落表：
   129	
   130	1. **第一批（收尾既有插件形态）**：A1 扩展包 manifest 字段统一 + 权限声明补全；A2/A4 消费方分两类显式区分；B2/B3 统一纳入插件体系登记。
   131	2. **第二批（配置型插件）**：B1 胶囊工具条、B4 菜单、B5 图标、B7 导出配置、B8 阅读预设、B9 新文档默认（与第 2 项数据文件化协同，配置值落点由数据文件承载）。
   132	3. **第三批（技能型与 slash 命令）**：A2 SKILL 注入面拼装细化；B6 键位绑定插件化（依赖第 3 项按键分发层重接线）；slash 命令独立通路落点。
   133	4. **第四批（生命周期与热加载评估）**：插件热加载评估（watcher 基础设施），若成本可接受则补，否则维持重启生效。
   134	
   135	## 6. 对抗评审记录
   136	
   137	**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。
   138	
   139	**总体判定**：需修订（已按意见全部修订）。
   140	
   141	**主要意见与处置**：
   142	
   143	1. **P0 A4 现状断言错误（硬伤）**：方案称扩展包「消费端仅到 AI 上下文、入口散落在设置深处」，实际 SettingsView 直接消费 capabilities，AI 工具由 SKILL.md 驱动 → 已采纳，§3 A4 现状描述按「消费方分两类（设置页开关 + SKILL 注入面）」校正。
   144	2. **P1 引用参数不准**：manifest 字段名不一致；扩展包 JSON 缺 filesystem 权限声明；THEME_EXTRA 清单与实际白名单不符；三段式 split 与 extensions.rs 实际不符 → 已采纳，§4.2 统一字段、§4.2 补权限声明、§4.3 加载管线按同步加载校正、A3 边界补「无主题切换结构」。
   145	3. **P2 生命周期不自洽**：扩展包同步加载无热重载；「重启生效」与「热加载」并存未裁定；插件模板 skill 无注册表登记；目录名/落点未定 → 已采纳，§4.3 裁定重启生效为主、热加载列后续；§2 术语统一 plugin；§4.1 目录落 `data/plugins/`。
   146	4. **P3 遗漏**：capabilities 消费方清单不全；slash 命令独立通路未单列；无风险评估；C5 排除理由缺配置载体证据；A3 用户能力边界未明确 → 已采纳，§4.4 SKILL 注入面、§4.6 slash 命令通路、§4.7 风险评估、§3 C5 配置载体证据、§3 A3 边界。
   147	
   148	**可保留**：三类插件形态定义、A 档定性（除 A4 描述）、C1/C5 排除结论、分批路线结构。
   149	
   150	**未检查**：patch_config 是否在他处存在；SKILL.md 注入拼装细节（已在 §4.4 设计，实现时需对齐真实拼装点）。

exec
/bin/zsh -c "nl -ba docs/research/technical/plugin-management-benchmark.md | sed -n '1,300p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	---
     2	title: 插件管理机制对标研究：DeepSeek Harness / Pi / Obsidian / Omarchy → Clairis
     3	type: research
     4	source_of_truth: supporting
     5	status: draft
     6	last_updated: 2026-11-02
     7	---
     8	
     9	# 插件管理机制对标研究：DeepSeek Harness / Pi / Obsidian / Omarchy → Clairis
    10	
    11	> 目的：为 Clairis 设计插件（扩展）管理机制提供对标依据。素材为各产品官方文档一手来源 + 本仓库现状调查（2026-09-27）。
    12	> 关联：Omarchy→Clairis 设计映射见 `omarchy-zh/.scratch/.../21-design-to-clairis.md`（ticket #21）。
    13	
    14	---
    15	
    16	## 一、四个产品的插件机制概览
    17	
    18	### 1. DeepSeek Harness —— "一切皆插件"（Cordis 元框架）
    19	
    20	**架构底座**：其插件系统建立在 Cordis 框架（`@deepseek-ai/cordis`，论文 arXiv 2608.25512）之上。Cordis 提供"时空可组合性"两个正交维度的形式化保证：
    21	
    22	- **时间可组合性（revertible effects）**：每个组件通过 context 注册的所有副作用（事件监听、工具、定时器、服务）都自动携带逆操作，**插件卸载时自动完整回滚**——不需要手写 removeListener/clearInterval。
    23	- **空间可组合性（reactive coeffects）**：组件用 `inject = ['tools', 'llm']` 声明依赖，框架保证依赖就绪后才激活组件；context 变更自动驱动激活/停用。
    24	
    25	**插件形态**：就是一个导出 `apply(ctx)` 的 TypeScript 模块（函数/对象/Service 类三种形式）。**没有传统 manifest 文件**——本地插件通过 `cordis.yml` patch（覆盖层）注册绝对路径，`pnpm dsh web --patch ./cordis.yml` 加载。
    26	
    27	**管理方式**：极简。当前处于开发者导向阶段，无插件市场、无权限模型、无沙箱（文档未提及）。"一切皆插件"落地为：任何能力（工具/服务/事件/定时器）都经同一个 `ctx` 注册并纳入自动清理体系。
    28	
    29	### 2. Pi Agent —— TypeScript 进程内扩展 + 包分发
    30	
    31	- **形态**：TS/JS 模块（`jiti` 免编译加载），单文件 / 目录（`index.ts`）/ npm 包（`package.json` 里 `pi.extensions` 字段）三种。
    32	- **两级位置**：全局 `~/.pi/agent/extensions/`，项目级 `.pi/extensions/`（**需项目信任后才加载**）。另有 `settings.json` 的 `packages` 数组支持 `npm:` / `git:` / `builtin:` 协议分发。
    33	- **能力面极宽**：注册工具、命令、快捷键、provider、MCP server、UI 组件、会话生命周期钩子（40+ 事件）、消息管线钩子（tool_call 可拦截/改写）。
    34	- **安全立场**：**明确声明无沙箱**——扩展与宿主同权限运行，"只加载可信来源"；安全靠 `project_trust` 事件做项目级信任门。
    35	- **热重载**：`/reload`。
    36	
    37	### 3. Obsidian —— 核心插件 / 社区插件双轨制
    38	
    39	- **核心插件**：官方内置、默认部分开启、可逐个关闭，与 app 同版本发布，不需要"安装"。
    40	- **社区插件**：每个插件是 vault 内 `.obsidian/plugins/<id>/` 目录（`manifest.json` + `main.js` + 可选 `styles.css` + `data.json` 存设置）。
    41	  - manifest：`id/name/author/version/minAppVersion/description`（封闭 schema）。
    42	  - 生命周期：`onload()` / `onunload()`，设置经 `loadData()/saveData()` 读写 `data.json`。
    43	- **安全模型**：
    44	  - 默认 **Restricted Mode**——不执行任何第三方代码；用户显式开启社区插件。
    45	  - 社区目录**每个版本都过自动安全扫描**（2025 起从"仅首次人工审"升级为全版本自动审）+ 开发者政策约束。
    46	- **分发**：官方社区目录（集中审核上架），不做 npm/git 直装。
    47	
    48	### 4. Omarchy —— "扩展点 = 数据文件"（约定优于 API）
    49	
    50	Omarchy 没有传统意义上的插件系统，它的可扩展性来自**约定式数据文件**：
    51	
    52	- 菜单 = `omarchy-menu.jsonc`；钩子 = `~/.config/omarchy/hooks/<event>.d/` 目录；主题 = 语义 token TOML + `*.tpl` 模板渲染 + 原子切换；shell = `shell.json`。
    53	- **所有权三分**：`/usr/share/omarchy`（系统，升级可覆盖）/ `~/.config`（用户，升级永不碰）/ 运行时生成态。
    54	- 第三方主题被**剥掉可执行文件**只留颜色数据——用数据格式本身限制插件能力，而非沙箱。
    55	- 更新走唯一入口（锁 + 快照 + 幂等 migrations），扩展即数据所以天然可回滚。
    56	
    57	---
    58	
    59	## 二、横向对比
    60	
    61	| 维度 | DeepSeek Harness | Pi | Obsidian | Omarchy |
    62	|---|---|---|---|---|
    63	| 插件形态 | `apply(ctx)` TS 模块 | TS/JS 模块（文件/目录/npm 包） | manifest+main.js 目录包 | 数据文件（jsonc/toml/目录约定） |
    64	| 真相源 | cordis.yml patch 覆盖层 | 目录发现 + settings.json | `.obsidian/plugins/` + 官方目录 | 约定路径数据文件 |
    65	| 分发 | 无（开发者直载） | npm / git / builtin 协议 | 官方集中目录（审核上架） | git 仓库（整机 omakase） |
    66	| 能力边界 | ctx 注册一切，自动清理 | 全宿主能力 + 40+ 生命周期钩子 | Plugin API（UI/命令/设置/事件） | 仅数据（无可执行面） |
    67	| 安全 | 无沙箱/权限模型（未提及） | 同权限运行 + 项目信任门 | Restricted Mode + 全版本自动扫描 + 政策 | 剥离可执行内容 |
    68	| 生命周期 | 注册即 tracked，卸载自动回滚 | 事件驱动（session_start/shutdown 等） | onload/onunload | 无运行时（数据渲染） |
    69	| 隔离 | 无 | 无 | 无（但默认关闭第三方代码） | 格式性隔离 |
    70	| 热重载 | dev patch | /reload | 重启 vault | 即改即生效（数据） |
    71	
    72	**共同规律**（四家无一例外）：
    73	
    74	1. **插件真相源是文件系统目录**，不是注册表/数据库——可 git、可备份、可被 agent 读写。
    75	2. **生命周期必须有卸载回滚**：Harness 用 effect 逆操作自动化，Obsidian 用 onload/onunload 约定，Pi 用事件。没有回滚约定的插件系统都会腐烂。
    76	3. **安全 = 默认关 + 显式开 + 来源可信**，四家都不做真沙箱（Obsidian 的 Restricted Mode、Pi 的 project trust、Omarchy 的数据化）。
    77	4. **数据文件优先于 API**：能力面越收敛为声明式数据，插件越安全、越可被 AI 生成。
    78	
    79	---
    80	
    81	## 三、Clairis 现状与定位
    82	
    83	- **无面向用户的插件系统**。代码中 `plugin/extension` 全部是编辑器内部实现（CM6 extensions、slash 菜单、marked math extension）。
    84	- **最接近"插件"的既有机制**是 mdpkg（Markdown 打包格式）：`manifest.extensions.symbols`（`off|core|extended`）与 `extensions_required`（封闭 schema，不支持项报错 E702）——这是**文档级**的能力声明，不是应用级插件。
    85	- 产品信条（`docs/product/principles.md`）："用最少干扰达成用户所愿"、键盘优先 ≥80%、无边栏零弹窗。**大而全的插件管理 UI 与信条冲突**。
    86	- Omarchy 映射报告（ticket #21）已给出关键判断：**"扩展点 = 数据文件，先做约定式数据，再做插件 API"**（启示 8）+ 所有权三分（启示 3）。
    87	
    88	## 四、对 Clairis 的设计建议
    89	
    90	按 Omarchy 支柱模型组织：**omakase 默认 + 约定式扩展 + agent 可重塑**，三个来源各取所长：
    91	
    92	### 建议 1：双轨制取 Obsidian，默认体验取 Omarchy（omakase）
    93	
    94	- **内置能力 = 核心插件化**：把 Clairis 内置功能（数学渲染、代码高亮、拖拽上传…）按"核心插件"组织——统一可开关、统一生命周期，但**默认全开、藏进设置深处**（不学 Obsidian 的长开关列表，学 Omarchy 的"默认值即产品"）。
    95	- **这一步不需要插件 API**，只是内部架构收敛：每个核心能力实现 `enable()/disable()` 幂等接口。它为未来社区插件铺路（同一个生命周期约定），又立刻改善内部代码组织。
    96	
    97	### 建议 2：扩展点先做数据文件，不做代码 API（Omarchy 原则 8）
    98	
    99	第一优先级扩展点全部声明式：
   100	
   101	- **主题/排版** = 语义 token 文件（对齐 mdpkg 的 symbols 分级思路与 Omarchy 的 token 管线）
   102	- **slash 命令片段 / 快速捕获模板** = `~/.clairis/snippets/`、`~/.clairis/templates/` 目录约定
   103	- **AI 技能/提示词** = markdown 文件目录（对齐 pi 的 skills 模型）
   104	
   105	数据文件天然满足：无执行风险、可 git、可被 agent 直接读写生成、卸载即删文件（时间可组合性退化版）。
   106	
   107	### 建议 3：若做代码级插件，取 Pi 形态 + Obsidian 安全门
   108	
   109	- 形态：TS 模块 + `manifest.json`（封闭 schema：`id/name/version/minAppVersion`），目录 `~/.clairis/plugins/<id>/`；生命周期 `onload()/onunload()`，注册项统一 tracked、卸载自动清理（学 Cordis 的 effect 追踪思想，不必引框架）。
   110	- 安全：**默认关闭第三方插件**（Restricted Mode 等价物）+ 目录级信任确认；远期分发再考虑审核，现阶段不做市场。
   111	- 与 Clairis 信条的衔接：插件管理入口放设置深处，无常驻 UI，零弹窗。
   112	
   113	### 建议 4：升级永不毁用户数据 = 结构性目录三分
   114	
   115	采纳 Omarchy 启示 3：
   116	
   117	```
   118	<app resources>/        内置默认（升级可整体覆盖）
   119	~/.config/clairis/      用户覆盖层（升级永不碰；snippets/templates/plugins 皆在此）
   120	~/Library/Application Support/clairis/  运行时生成态（缓存/索引）
   121	```
   122	
   123	### 分阶段路线
   124	
   125	| 阶段 | 内容 | 对标 |
   126	|---|---|---|
   127	| P0（无 API） | 核心能力插件化（统一 enable/disable）+ 数据文件扩展点（snippets/templates/主题 token）| Omarchy |
   128	| P1 | manifest + onload/onunload + 信任门，支持本地目录安装 | Pi 形态 + Obsidian 安全 |
   129	| P2 | 分发（git/npm 协议）、社区目录、自动扫描 | Obsidian / Pi packages |
   130	
   131	**一句话结论**：Clairis 不需要"插件市场"式的管理界面，需要的是**Omarchy 式的数据文件扩展点 + Obsidian 式的双轨与安全门 + Cordis 式的卸载回滚纪律**——先让"放一个文件到某个目录"成为唯一的插件形态，等真实需求出现再上代码级 API。

exec
/bin/zsh -c "rg -n \"disabled|数据包型|A4|A1[–-]A3|A1～A3|A1-A3|启停|卸载|4 项|四项|theme\\.toml|SKILL\\.md\" docs/design/pluginization-datafile-settings-rail docs/research/technical prototypes src src-tauri -g '*.md' -g '*.ts' -g '*.tsx' -g '*.rs' -g '*.json' | head -n 300" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:19:| **技能型插件** | SKILL.md 驱动的 AGENT 能力包 | 注入 AGENT 上下文 | AI 能力 |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:33:| A3 | **主题覆盖** | `theme.toml` 白名单覆盖，**仅颜色 token，无装饰主题切换**。无 `themeProvider` 结构、无历史逻辑 | 配置型 | ✅ 已落地，扩展面有限（见 A3 边界） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:34:| A4 | **编辑器扩展** | **现状描述修正**：`capabilities` 键已是声明式开关，**消费方不止 AI 上下文**——`SettingsView.tsx` 直接消费（`set`/`toggle` 扩展项，可见性与开关同态），**AI 工具则完全由 SKILL.md 驱动**，无 settings 入口。入口并非「散落在设置深处」，而是按能力类型分两处：编辑器扩展在设置页可见开关，AI 能力在 SKILL 注入面 | 注册型 | ✅ 已落地，**消费方分两类，需在清单中显式区分** |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:61:| C5 | **与数据文件化重复的能力** | **配置载体证据补全**：A3/A4/A5 等已由数据文件化承载，插件化重复时以数据文件为单一落点，避免双写。插件体系管「打包/加载/升级」维度，数据文件管「配置值」维度，两者在 A 档能力上是**正交维度**而非重复（见 §5.3） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:72:    SKILL.md                      技能型插件的能力声明
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:94:### 4.4 SKILL.md 注入面（补充 P3 遗漏）
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:99:- **注入拼装**：AGENT 上下文构建时，聚合所有已启用技能型插件的 SKILL.md 内容（+ 内置 SKILL_MAP），拼装为 AGENT 的能力声明。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:101:- **可见性**：与第 2 项 §5.5 的 SKILL_MAP 载体统一——插件体系管「哪些插件贡献 SKILL.md」，数据文件体系管「字段配置」，两者在技能型插件上协同。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:109:A 档能力（A3 主题、A4 扩展、A5 片段模板）两者都涉及：数据文件是其**配置值载体**，插件是其**打包加载载体**。**单一落点原则**：某能力若已由数据文件化承载配置值，插件化不再重复建配置落点，只补打包/加载维度。避免双写。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:130:1. **第一批（收尾既有插件形态）**：A1 扩展包 manifest 字段统一 + 权限声明补全；A2/A4 消费方分两类显式区分；B2/B3 统一纳入插件体系登记。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:143:1. **P0 A4 现状断言错误（硬伤）**：方案称扩展包「消费端仅到 AI 上下文、入口散落在设置深处」，实际 SettingsView 直接消费 capabilities，AI 工具由 SKILL.md 驱动 → 已采纳，§3 A4 现状描述按「消费方分两类（设置页开关 + SKILL 注入面）」校正。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:148:**可保留**：三类插件形态定义、A 档定性（除 A4 描述）、C1/C5 排除结论、分批路线结构。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:150:**未检查**：patch_config 是否在他处存在；SKILL.md 注入拼装细节（已在 §4.4 设计，实现时需对齐真实拼装点）。
docs/research/technical/data-fileization-omarchy-inventory.md:49:| theme tokens（主题覆盖） | `app_config_dir()/theme.toml` | `[tokens]` + 仅颜色值 | 白名单：只接受已声明 `--app-*` 键；未知键忽略并聚合告警；删文件即恢复默认 |
docs/research/technical/data-fileization-omarchy-inventory.md:62:| 扩展点 P0 | `2026-11-03-extension-points`（[#76](https://github.com/jianxi-dev/clairis/issues/76)/[#78](https://github.com/jianxi-dev/clairis/issues/78)） | snippets / templates / theme.toml / 能力开关 | ✅ 已归档（4/4 票，票未关需收尾） |
docs/research/technical/data-fileization-omarchy-inventory.md:64:| 扩展管理面 | `layout-portal` [#184](https://github.com/jianxi-dev/clairis/issues/184)（已关闭） | 文件夹式扩展（manifest.json + SKILL.md）、拖入即启用、AI 生成、导出 | ✅ 已落地（`src-tauri/src/extension_packages.rs`） |
docs/research/technical/data-fileization-omarchy-inventory.md:107:| 5 | 主题 token 覆盖 | `app_config_dir()/theme.toml` | ✅ 已落地 | 直接写文件（白名单容错） |
docs/research/technical/data-fileization-omarchy-inventory.md:112:| 10 | 扩展包（manifest.json + SKILL.md） | `app_config_dir()/extensions/<id>/` | ✅ 已落地 | AI 一句话生成新扩展（默认启用）+ 直接编辑 SKILL.md |
docs/research/technical/data-fileization-omarchy-inventory.md:122:- **实现骨架已经就位**：三层目录（defaults / user / 运行时）+ 原子写 + 快照回滚 + 热应用轮询，是 Omarchy「扩展点 = 数据文件」在本仓库的落地底座；snippets/templates/theme.toml 三个扩展点已可用（「放一个文件就生效」）。
src-tauri/src/extensions.rs:86:/// 把 `theme.toml` 里的键规范化成 `--app-<name>`。
src-tauri/src/extensions.rs:314:/// 读取 `<dir>/theme.toml` 的 `[tokens]` 表，白名单校验键与值。
src-tauri/src/extensions.rs:316:    let path = dir.join("theme.toml");
src-tauri/src/extensions.rs:325:                warnings: vec![format!("theme.toml: 读取失败（{e}）")],
src-tauri/src/extensions.rs:354:        Ok(_) => warnings.push("theme.toml: 顶层不是表".into()),
src-tauri/src/extensions.rs:355:        Err(e) => warnings.push(format!("theme.toml: 解析失败（{e}）")),
src-tauri/src/extensions.rs:359:        warnings.push(format!("theme.toml: 忽略 {invalid} 个非法 token"));
src-tauri/src/extensions.rs:506:            "theme.toml",
src-tauri/src/extensions.rs:541:            "theme.toml",
src-tauri/src/extensions.rs:577:            "theme.toml",
src-tauri/src/extensions.rs:600:            "theme.toml",
docs/research/technical/plugin-management-benchmark.md:22:- **时间可组合性（revertible effects）**：每个组件通过 context 注册的所有副作用（事件监听、工具、定时器、服务）都自动携带逆操作，**插件卸载时自动完整回滚**——不需要手写 removeListener/clearInterval。
docs/research/technical/plugin-management-benchmark.md:68:| 生命周期 | 注册即 tracked，卸载自动回滚 | 事件驱动（session_start/shutdown 等） | onload/onunload | 无运行时（数据渲染） |
docs/research/technical/plugin-management-benchmark.md:75:2. **生命周期必须有卸载回滚**：Harness 用 effect 逆操作自动化，Obsidian 用 onload/onunload 约定，Pi 用事件。没有回滚约定的插件系统都会腐烂。
docs/research/technical/plugin-management-benchmark.md:105:数据文件天然满足：无执行风险、可 git、可被 agent 直接读写生成、卸载即删文件（时间可组合性退化版）。
docs/research/technical/plugin-management-benchmark.md:109:- 形态：TS 模块 + `manifest.json`（封闭 schema：`id/name/version/minAppVersion`），目录 `~/.clairis/plugins/<id>/`；生命周期 `onload()/onunload()`，注册项统一 tracked、卸载自动清理（学 Cordis 的 effect 追踪思想，不必引框架）。
docs/research/technical/plugin-management-benchmark.md:131:**一句话结论**：Clairis 不需要"插件市场"式的管理界面，需要的是**Omarchy 式的数据文件扩展点 + Obsidian 式的双轨与安全门 + Cordis 式的卸载回滚纪律**——先让"放一个文件到某个目录"成为唯一的插件形态，等真实需求出现再上代码级 API。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:52:| **插件** | 插件清单、启停、卸载、查看数据文件 | 第 1 项 A/B 档插件（原「扩展」升级） |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:20:- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:33:| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:54:| 主题覆盖 | `theme.toml`（白名单 13 个 `--app-*` token，是 `tokens.css` 17 个的子集） | 主题注入 | ✅ 已落地 |
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:102:app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:130:- 每个 B 档文件规定**加载端契约**：加载失败/非法时的语义——**回退默认 + 聚合告警**（对齐 `theme.toml` 的白名单过滤纪律）。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:4:> 对应目标：第 4 项——重做文档发现操作方案（便捷直观、有设计感）+ 插件展示策略
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:111:**「第 1 项会提取出较多插件」不成立**：01 号文档 A 档用户可见插件仅 4 项（片段/模板/theme.toml/SKILL.md 包），B 档目前还是代码常量、需另立批次文件化。展示策略不建立在「插件很多」的夸大前提上。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:119:**「启停/卸载」是数据包型插件（A4，`.disabled` 标记）专属的生命周期**；数据文件型插件（A1–A3）是「删文件即卸载」，无启停概念（01 号文档 §5.1 已写明）。操作入口按插件类型分：
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:123:| 数据包型（A4） | 设置内插件分类 | 启停 / 卸载（`.disabled` 标记） |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:124:| 数据文件型（A1–A3） | 设置内插件分类（清单查看） | **删文件即卸载**；设置内提供清单查看入口 |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:137:4. **插件展示**：设置内插件分类清单（数据包型启停 + 数据文件型清单查看）。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:157:5. **插件章术语矛盾**：「较多插件」不成立；「启停/卸载」应限定数据包型 → 已采纳，§5 前提校正 + 操作入口按类型分。
src-tauri/src/extension_packages.rs:2://! `manifest.json` + `SKILL.md` 包。
src-tauri/src/extension_packages.rs:5://! 卸载 / 导出。用户包用目录名作为 id，`.disabled` 标记文件表示停用（不改用户
src-tauri/src/extension_packages.rs:10://! - `<config_base>/extensions/<id>/SKILL.md`
src-tauri/src/extension_packages.rs:11://! - `<config_base>/extensions/<id>/.disabled`（可选，停用标记）
src-tauri/src/extension_packages.rs:25:const SKILL_FILE: &str = "SKILL.md";
src-tauri/src/extension_packages.rs:26:const DISABLED_MARKER: &str = ".disabled";
src-tauri/src/extension_packages.rs:36:/// 内置包 id：静态、常驻启用、不可卸载 / 导出。
src-tauri/src/extension_packages.rs:42:本扩展由应用自带，始终启用，不可卸载或导出。\n";
src-tauri/src/extension_packages.rs:46:本扩展由应用自带，始终启用，不可卸载或导出。\n";
src-tauri/src/extension_packages.rs:70:    /// full SKILL.md text
src-tauri/src/extension_packages.rs:142:/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
src-tauri/src/extension_packages.rs:365:/// 导入文件夹或 zip；id 已存在则整体替换。默认启用（源里若带 `.disabled`
src-tauri/src/extension_packages.rs:560:        return Err(validation("extensionPackage", "内置扩展不可卸载"));
src-tauri/src/extension_packages.rs:896:    fn list_returns_builtins_and_user_packages_with_disabled_flag() {
src-tauri/src/extension_packages.rs:922:        assert!(!ai.enabled, ".disabled 标记应反映为停用");
src-tauri/src/extension_packages.rs:1091:        // 缺 SKILL.md
src-tauri/src/extension_packages.rs:1121:    fn toggle_writes_and_removes_disabled_marker() {
src-tauri/src/extension_packages.rs:1199:    fn export_preserves_disabled_state_through_round_trip() {
src-tauri/src/extension_packages.rs:1200:        let dir = temp_base("rt-disabled");
src-tauri/src/extension_packages.rs:1224:            "SKILL.md 应包含提示词：{}",
src-tauri/src/extension_packages.rs:1276:        zip.start_file("SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1333:        zip.start_file("nested/SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1340:        assert!(base.join("extensions/nested-ext/SKILL.md").exists());
src/lib/export/pdf.ts:24:const A4_WIDTH = 595.28;
src/lib/export/pdf.ts:25:const A4_HEIGHT = 841.89;
src/lib/export/pdf.ts:38: * 单页 PDF：把一张 JPEG 作为 DCTDecode 图像 XObject 嵌入 A4 页面。
src/lib/export/pdf.ts:63:    (A4_WIDTH - PAGE_MARGIN * 2) / pxWidth,
src/lib/export/pdf.ts:64:    (A4_HEIGHT - PAGE_MARGIN * 2) / pxHeight,
src/lib/export/pdf.ts:68:  const x = (A4_WIDTH - drawW) / 2;
src/lib/export/pdf.ts:69:  const y = (A4_HEIGHT - drawH) / 2;
src/lib/export/pdf.ts:83:    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] ` +
src-tauri/src/config.rs:896:        .join("SKILL.md");
src-tauri/src/config.rs:901:        warn!(error = %e, path = %path.display(), "SKILL.md 写入失败");
src-tauri/src/commands/config_cmd.rs:56:/// Scan user extension directories (snippets / templates / theme.toml).
src/hooks/usePaneDragController.ts:136: * 两种拖拽都在 window 上挂 pointermove/pointerup 与 Escape 取消，随组件卸载清理。
src/renderers/diagram/pele.ts:49: * 编辑态静态渲染（design D4）：CM6 widget 生命周期没有可靠的卸载钩子，
src/lib/paneHeaderMenu.ts:40:  disabled?: boolean;
src/stores/index.ts:216:  /** 页签拖拽进行中：抑制沉浸热区 2s 收起，避免拖拽被浮层卸载打断。 */
src/components/TabBar.tsx:656:            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
src/components/TabBar.tsx:657:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:733:              className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
src/components/TabBar.tsx:734:              disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:770:                    disabled={sub.disabled}
src/components/TabBar.tsx:786:                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
src/components/TabBar.tsx:812:            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
src/components/TabBar.tsx:813:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:834:            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
src/components/TabBar.tsx:835:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:852:            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
src/components/TabBar.tsx:853:            disabled={!tabs[menu.tabId]?.path}
src/components/TabBar.tsx:882:            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
src/components/TabBar.tsx:883:            disabled={!tabs[menu.tabId]?.path}
src/renderers/diagram/engine.ts:106: * 编辑态静态渲染（design D4）：不走 `mount()`——CM6 widget 没有可靠的卸载钩子，
src/components/Content/PdfViewer.tsx:44: * 禁用后命令被标记为 disabled（经实证：类别只置灰、不移除按钮，因为这两个
src/components/Content/PdfViewer.tsx:67: * 最小补充（disabledCategories / schema 无法覆盖）：
src/components/Content/PdfViewer.tsx:91:    ":host{--ep-background-app:var(--app-bg) !important;--ep-background-surface:var(--app-surface) !important;--ep-background-surface-alt:var(--app-sunken) !important;--ep-background-elevated:var(--app-surface) !important;--ep-background-input:var(--app-surface) !important;--ep-foreground-primary:var(--app-text) !important;--ep-foreground-secondary:var(--app-text-2) !important;--ep-foreground-muted:var(--app-text-2) !important;--ep-foreground-disabled:var(--app-text-2) !important;--ep-foreground-on-accent:var(--app-surface) !important;--ep-border-default:var(--app-border) !important;--ep-border-subtle:var(--app-border) !important;--ep-border-strong:var(--app-border-strong) !important;--ep-accent-primary:var(--app-accent) !important;--ep-accent-primary-hover:var(--app-accent) !important;--ep-accent-primary-active:var(--app-accent) !important;--ep-accent-primary-light:var(--app-accent-soft) !important;--ep-accent-primary-foreground:var(--app-surface) !important;--ep-interactive-hover:var(--app-accent-soft) !important;--ep-interactive-active:var(--app-accent-soft) !important;--ep-interactive-selected:var(--app-accent-soft) !important;--ep-interactive-focus:var(--app-accent) !important;--ep-interactive-focus-ring:var(--app-accent) !important;--ep-scrollbar-track:var(--app-sunken) !important;--ep-scrollbar-thumb:var(--app-border) !important;--ep-scrollbar-thumb-hover:var(--app-border-strong) !important}",
src/components/Content/PdfViewer.tsx:309:  // 视图级：切页签卸载即复位，不写配置、不写文档。
src/components/Content/PdfViewer.tsx:350:      // 卸载或 filePath 变化时释放已持有的 ArrayBuffer 引用，避免大文件内存滞留
src/components/Content/PdfViewer.tsx:464:          disabledCategories: DISABLED_CATEGORIES,
src/components/Content/pdfToolbarPin.ts:3: * 视图级状态：切页签即卸载失效，不写配置、不写文档。
src/components/Content/pdfToolbarPin.ts:12:/** PdfViewer 挂载时登记本视图的固定开关，返回卸载时的注销函数。 */
src/components/Content/DocPropertyBar.tsx:92:    disabled = false,
src/components/Content/DocPropertyBar.tsx:102:      disabled={disabled}
src/components/Preview/FloatingPreview.tsx:37: * 不卸载任何 pane 或 EditorView。渲染真文档内容（读 `open_file_direct`），
src/editors/icons.ts:44:      "M6 4h6.2a4 4 0 0 1 2.9 6.7A4.2 4.2 0 0 1 13 18H6zm3 2.6v3.6h3.2a1.8 1.8 0 0 0 0-3.6zm0 6.2v3.6h4a1.8 1.8 0 0 0 0-3.6z",
src/renderers/markdown.ts:66:    "disabled",
src/renderers/markdown.ts:181:  // GFM 任务列表通过 input[type=checkbox][disabled] 渲染；其余 input 一律剥离属性
src/renderers/markdown.ts:185:    if (input.type !== "checkbox" || !input.disabled) {
src/renderers/markdown.ts:188:      input.removeAttribute("disabled");
src/components/Content/PreviewView.tsx:92:/** 视频/音频预览：注册到常驻播放器，由 MediaPlayerHost 限制在所属格内；卸载时保持播放移出视口（无迷你条） */
src/components/Content/MediaPlayerHost.tsx:37: * 媒体播放器宿主（挂在 PaneTreeView/ContentSplitView 层，不随 tab 卸载）
src/components/ContextMenu.tsx:10:  disabled?: boolean;
src/components/ContextMenu.tsx:63:      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
src/components/ContextMenu.tsx:70:        '[role="menuitem"]:not(:disabled)',
src/components/ContextMenu.tsx:105:          disabled={item.disabled}
src/components/StatusBar.tsx:68:  /** 主题 / 宽度面板的展开状态；父级据此避免在面板打开时卸载状态栏。 */
src/components/SettingsView.tsx:330:      setNotice("已卸载扩展。");
src/components/SettingsView.tsx:332:      setNotice("卸载失败，请重试。");
src/components/SettingsView.tsx:394:          拖入含 manifest.json 与 SKILL.md 的文件夹或 .zip，导入后立即启用。
src/components/SettingsView.tsx:399:            data-testid="extensions-disabled-note"
src/components/SettingsView.tsx:491:                        disabled={isBuiltin}
src/components/SettingsView.tsx:503:                      disabled={isBuiltin || !pkg.dir}
src/components/SettingsView.tsx:505:                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
src/components/SettingsView.tsx:512:                      disabled={isBuiltin}
src/components/SettingsView.tsx:514:                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
src/components/SettingsView.tsx:531:                      disabled={isBuiltin}
src/components/SettingsView.tsx:533:                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
src/components/SettingsView.tsx:535:                      卸载
src/components/SettingsView.tsx:577:            disabled={aiBusy || aiPrompt.trim() === ""}
src/components/SettingsView.tsx:579:            className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
src/components/SettingsView.tsx:1514:                          disabled={included && activeSectors.length <= 1}
src/components/SettingsView.tsx:1526:                              disabled={idx <= 0}
src/components/SettingsView.tsx:1529:                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
src/components/SettingsView.tsx:1535:                              disabled={idx >= activeSectors.length - 1}
src/components/SettingsView.tsx:1538:                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
src/components/SettingsView.tsx:1586:                          disabled={included && activeToolbarItems.length <= 1}
src/components/SettingsView.tsx:1598:                              disabled={idx <= 0}
src/components/SettingsView.tsx:1601:                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
src/components/SettingsView.tsx:1607:                              disabled={idx >= activeToolbarItems.length - 1}
src/components/SettingsView.tsx:1610:                              className="rounded border border-[var(--app-border)] px-1.5 text-xs disabled:opacity-40"
src/components/SettingsView.tsx:1983:                    disabled={railDensity !== "card"}
src/components/SettingsView.tsx:2203:                        disabled={keyBusy || keyInput.trim() === ""}
src/components/SettingsView.tsx:2205:                        className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
src/components/SettingsView.tsx:2212:                        disabled={keyBusy || keyStatus !== "configured"}
src/components/SettingsView.tsx:2214:                        className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
src/components/SettingsView.tsx:2270:                    className="rounded border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
src/components/SettingsView.tsx:2271:                    disabled={!defaultSavePath}
src/components/ai/AiConversation.tsx:124:          disabled={submitting || input.trim() === ""}
src/components/ai/AiConversation.tsx:125:          className="shrink-0 rounded-md px-2 py-1 text-xs text-[#0071e3] disabled:opacity-40"
src/__tests__/fileKind.test.tsx:160:    // 卸载（切走 tab）→ minimize：播放器保留，移出视口（无迷你条）
src/__tests__/docsGovernanceGate.test.ts:223:  it("真实夹具套件 14 项全过", () => {
src/__tests__/editor/decorations-blocks.test.ts:344:      expect(crop?.disabled).toBe(true);
src/__tests__/editor/decorations-blocks.test.ts:349:      expect(copy?.disabled).toBe(true);
src/__tests__/assetUrl.test.ts:20:      "asset://localhost/%2FUsers/mason/Downloads/AI-doc/Opencode-study/%E4%BA%94%E5%A4%A7%E5%B7%A5%E5%85%B7%E7%B3%BB%E7%BB%9F%E5%8C%96%E8%9E%8D%E5%90%88%E6%8C%87%E5%8D%97.html",
src/editors/orchestration/roulette-view.ts:371:      if (!isExecutable(item)) path.setAttribute("aria-disabled", "true");
src/__tests__/renderers/structural-tags.test.ts:5: * 复刻真实文件 /Users/mason/Desktop/AI学习/overview-design-liyy/SKILL.md 的结构：
src/__tests__/renderers.markdown.test.ts:10:    expect(html).toContain("disabled");
src/__tests__/renderers.markdown.test.ts:19:    expect(html).toContain("disabled");
src/__tests__/renderers.markdown.test.ts:22:  it("恶意 input 属性被剥离（仅 checkbox+disabled 放行）", () => {
src/__tests__/tabswitch.test.tsx:9:  it("video 预览 → 卸载（切走 tab）→ minimize：播放器保留，移出视口", () => {
src/__tests__/mediaPlayerHost.test.tsx:61:  it("stop（关闭媒体 tab）→ 播放器卸载", () => {
src/__tests__/editor/structural-tags-decorations.test.ts:4: * 真实 SKILL.md 形态：frontmatter + 中文正文 + 围栏代码 + 多个 <tag> 包裹分节。
src/lib/extensions/theme-tokens.ts:3: * `theme.toml` 的 `[tokens]` 经 IPC 传到前端后**再校验一遍**（不信任 IPC 输入）：
src/lib/extensions/theme-tokens.ts:38: * 把 `theme.toml` 里的键规范化成 `--app-<name>`。
src/__tests__/components/SettingsView.test.tsx:88:  it("阅读空间区：行宽四档与配色四项就位，点击写入配置并应用皮肤", () => {
src/__tests__/components/SettingsView.test.tsx:161:      expect(screen.getByTestId("extensions-disabled-note")).toBeTruthy();
src/__tests__/components/SettingsView.test.tsx:163:        screen.getByTestId("extensions-disabled-note").textContent,
src/editors/decorations/structuralTagPattern.ts:3: * SKILL.md 这类文件用 `<objective>` / `<essential_principles>` / `<routing>` 等
src/editors/decorations/imageToolbar.ts:28:  readonly disabledTitle?: string;
src/editors/decorations/imageToolbar.ts:589:    btn.disabled = !available;
src/editors/decorations/imageToolbar.ts:590:    if (!available && spec.disabledTitle) btn.title = spec.disabledTitle;

exec
/bin/zsh -c "rg -n \"settings|插件|扩展|extensions|snippets|templates|theme\\.toml|skill\" src/components/SettingsView.tsx | head -n 240" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
71:  skill: string;
93:  { id: "extensions", label: "扩展" },
259:        setNotice(`已导入扩展：${target}`);
330:      setNotice("已卸载扩展。");
374:      setNotice("已生成扩展。");
391:          扩展
399:            data-testid="extensions-disabled-note"
401:            扩展管理仅在桌面版可用，浏览器预览不可用。
406:              data-testid="extensions-dropzone"
410:                把扩展文件夹或 .zip 拖到这里
415:                  data-testid="extensions-import-folder"
423:                  data-testid="extensions-import-zip"
433:                data-testid="extensions-drop-overlay"
436:                松开以导入扩展，Esc 取消
452:            data-testid="extensions-empty"
454:            暂无扩展
540:                      data-testid="extension-skill"
543:                      {pkg.skill}
1137:      data-testid="settings-scene"
1144:        data-testid="settings-nav"
1153:              data-testid="settings-nav-item"
1154:              data-settings-nav={section.id}
1264:              <section data-testid="settings-heading-fonts">
1317:              <section data-testid="settings-icons">
1407:              <section data-testid="settings-notice-duration-section">
1430:                  data-testid="settings-notice-duration"
1435:              <section data-testid="settings-roulette-switch">
1457:                    data-testid="settings-roulette-hotkey"
1471:                      data-testid={`settings-roulette-form-${option.value}`}
1486:              <section data-testid="settings-roulette-sectors">
1558:              <section data-testid="settings-toolbar-items">
1664:              <section data-testid="settings-doc-property">
2379:          {active === "extensions" && (

exec
/bin/zsh -c "rg --files src-tauri/src | rg 'extension|skill|theme|capabil|template|snippet'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/extensions.rs
src-tauri/src/extension_packages.rs

exec
/bin/zsh -c "nl -ba docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md | sed -n '1,190p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# 数据文件化提取方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 2 项——深化数据文件化研究，输出「可提取为数据文件的功能清单」与设计实现方案
     5	> 事实基线（已校正）：`src-tauri/src/config.rs`、`src-tauri/src/commands/config_cmd.rs`、`src-tauri/src/commands/capture.rs`、`src-tauri/src/extensions.rs`、`src/hooks/useConfig.ts`、`src/stores/index.ts`、`src/stores/editorStore.ts`、`src/lib/capabilities.ts`、`docs/research/technical/data-fileization-omarchy-inventory.md`
     6	
     7	## 1. 背景与目标
     8	
     9	数据文件化是本产品既定的产品设计方向，已有底座与部分实现。存在两个明确问题：
    10	
    11	1. **提取不够**：许多可配置能力仍是代码常量，只有被明确要求时才会文件化，「不明确说明的能力不会进行数据文件的设计」。
    12	2. **目标**：让用户**通过 AGENT 直接自定义产品功能**——AGENT 改数据文件即改产品行为，无需改源码。
    13	
    14	本方案回答：哪些功能可提取为数据文件、数据文件的目录与合并设计、AGENT 自定义的落点与边界，以及一个必须修复的根因缺陷。
    15	
    16	## 2. 立场与硬边界
    17	
    18	- **扩展点 = 数据文件，不执行用户代码**。AGENT 只改声明式数据文件，最坏「没生效」，不会「搞坏应用」。
    19	- **密钥永不文件化**（apiKey 仅内存，走 keyring 命令）。
    20	- **用户层目录是 AGENT 写入口**：`user/` 是核心写入口，扩展点目录（snippets/templates/theme.toml）也在用户层，但不在 `user/` 子目录下——边界表述按此校正。
    21	- **无消费者不提前建目录**：不为「未来可能用到」提前建数据文件。
    22	
    23	## 3. 数据文件底座（现状，已校正）
    24	
    25	`config_base()` = Tauri `app.config_dir()`，macOS `~/Library/Application Support/dev.biaoyue.app/`（`config.rs:1033-1038`）。
    26	
    27	| 目录 | 内容 | 写入方 |
    28	|---|---|---|
    29	| `defaults/settings.json` | 内置默认（随包发布，用户不可改） | 构建产物 |
    30	| `user/settings.json` | 用户层覆盖（深合并后唯一生效值） | Tauri 命令 / AGENT |
    31	| `state/state.json` | 运行时派生（`recentFiles` / `scrollPositions` / `embedScrollPositions` 三字段） | 派生存储 |
    32	| `snapshots/settings-*.json` | 快照（保留 10 份，有单测） | Tauri 命令 |
    33	| `snippets/*.md`、`templates/*.md`、`theme.toml` | 扩展点数据文件 | 位于 `app_config_dir()` 根，用户层 |
    34	
    35	**读取管线（已校正）**：`applyRustConfig`（`useConfig.ts:407-477`）→ `useEditorStore.setConfig`。方案原称的 `loadSettings()` 函数不存在，已修正。
    36	
    37	**合并语义（关键，已校正）**：
    38	- `save_config` 是全量覆盖；`patch_config` 本身对 user 层深合并（`config.rs:949-976`）。
    39	- **`merge_json` 对数组是整体替换**（`config.rs:392-396` `(_, over) => over.clone()`）——这是本仓既有语义，B 档文件设计需沿用，不可另造。
    40	
    41	## 4. 可提取为数据文件的功能清单
    42	
    43	按提取条件分三档。**A 档字段名已按代码实际校正**。
    44	
    45	### A 档：已文件化（保持，纳入统一清单管理）
    46	
    47	| 功能域 | 真实字段 / 文件 | 消费者 | 状态 |
    48	|---|---|---|---|
    49	| 阅读设置 | `readerFontSize`（数值，校验 8–96）、`readerWidth`、`readerSkin` | 阅读区 | ✅ 已落地（注：无 `reader.font` 字体族、`lineHeight`、`mode` 字段） |
    50	| 视图规格 | `settings.json` 顶层四字段：`railViewSpec`/`previewSettings`/`aiViewSpec`/`paneLayout` | `useStore` 的 `setRailViewSpec` 等 | ✅ 已落地（顶层字段，非 `viewSpec.` 嵌套） |
    51	| AI 连接 | `openaiEndpoint`/`openaiModel`/`ollamaEndpoint`/`translationProvider`/`langPair`；apiKey 仅内存 | AI 客户端 | ✅ 已落地（无 `style`/`sessionId` 字段） |
    52	| 编辑器扩展 | `capabilities` 键，id 为 `math`/`code-highlight`/`mermaid`/`preview-zoom` | `CapabilityRegistry` | ✅ 已落地 |
    53	| 派生状态 | `state.json`：`recentFiles`/`scrollPositions`/`embedScrollPositions` | `useStore` / `useScrollRestore` | ✅ 已落地 |
    54	| 主题覆盖 | `theme.toml`（白名单 13 个 `--app-*` token，是 `tokens.css` 17 个的子集） | 主题注入 | ✅ 已落地 |
    55	| 片段 / 模板 | `snippets/*.md`、`templates/*.md` | 斜杠菜单 / 模板选择器 | ✅ 已落地 |
    56	| **轮盘扇区** | `rouletteSectors`（`config.rs:65`，设置页有勾选 UI，`floating-toolbar.ts:715` + `useConfig.ts:440` 消费；默认集合 `ROOT_SECTORS` 是常量） | 轮盘 | ✅ **已文件化**（原误判为 B 档） |
    57	| **工具条按钮** | `htmlToolbarItems`（`config.rs:68`，设置页可编辑，`slots.ts:resolveToolbarOrder` 消费） | 水平工具条 | ✅ **已文件化**（原误判为 B 档） |
    58	| **捕获配置** | `~/.biaoyue/config.toml`（TOML，**在应用配置目录之外**，`CaptureConfig`，无 hotkey 字段） | 捕获浮层 | ✅ 已落地，但**与三层目录是两个世界**，是否纳入统一管理需明确立场（见 §5.7） |
    59	
    60	### B 档：可进一步文件化（当前是代码常量或未持久化）
    61	
    62	| # | 功能 | 现状（已校正） | 数据文件设计 | AGENT 自定义价值 |
    63	|---|---|---|---|---|
    64	| B1 | **键位绑定** | `keybindings.ts`（86 行）+ `shortcuts.ts`（573 行，`SHORTCUTS` 常量表，`ShortcutDef` 已带 `scope: global/local` 结构） | `user/keybindings.json`：按键 → 命令映射，支持全局/局部作用域、禁用、重映射 | 改键位文件即重映射；**依赖按键分发层重接线（见第 3 项 §4.4）** |
    65	| B2 | **菜单结构** | 菜单项常量在 `src/lib/paneHeaderMenu.ts`（PANE/EXPORT/AI_PANE 三表） | `user/menus.json`：菜单分组与项的增删排序、启用/停用 | AGENT 增删/排序菜单项 |
    66	| B5 | **胶囊工具条** | 胶囊按钮集是代码常量（`capsule-toolbar.ts`）；`selectionToolbar: "roulette"|"capsule"` 切换已存在 | `user/capsules.json` | AGENT 配置胶囊按钮（注：`slots` 即 B4 已文件化的 HTML 工具条，两者不可混为一谈） |
    67	| B6 | **图标注册表** | `src/ui/icons.ts`（711 行）+ `src/editors/icons.ts`（803 行），代码常量 | `user/icons.json`：概念 → 图标路径映射 | AGENT 替换/新增图标 |
    68	| B7 | **视图规格独立文件** | 已并入 `settings.json` 顶层四字段。**勘误**：omarchy-inventory 明确「独立视图文件从未实现、四字段是实现选择而非欠账」 | 抽出独立 `user/view-specs.json` | AGENT 直接改视图布局。**需先裁决为何现在要改**（见 §5.6） |
    69	| B8 | **导出配置** | 导出菜单是代码常量（6 项，`paneHeaderMenu.ts`），**无任何持久化导出设置**（`exportFormat` 零命中） | `user/export.json`：格式清单、默认格式、选项开关 | AGENT 自定义导出格式选项与默认 |
    70	| B9 | **阅读预设** | `readerFontSize` 是数值型（非字体族字符串），无预设集合 | `user/reader-presets.json`：字号/宽度/皮肤预设集合 | AGENT 增加阅读预设，一键切换 |
    71	| B10 | **新建文档默认** | `defaultNewDocFormat` 不存在；相近字段是 `defaultSavePath` | `user/newdoc.json`：默认保存路径、默认模板、默认 frontmatter | AGENT 自定义新文档模板与默认路径 |
    72	| B11 | **捕获配置归一** | 当前落点 `~/.biaoyue/config.toml`（TOML，三层目录之外） | 是否迁入 `user/capture.json` 纳入统一体系 | AGENT 统一管理捕获配置（需先裁决迁移立场） |
    73	
    74	### C 档：不文件化（明确不做）
    75	
    76	| # | 功能 | 不文件化理由 |
    77	|---|---|---|
    78	| C1 | **API 密钥 / 密钥类** | 密钥永不文件化（ADR 0005）；apiKey 仅内存走 keyring |
    79	| C2 | **编辑器运行时状态**（undo/选区、CM6 实例） | 运行时状态归 `editorRef.ts` 模块级 Map，不进数据文件 |
    80	| C3 | **模式切换/渲染管线运行时开关** | 由 `capabilities` 统一管理，是运行时行为 |
    81	| C4 | **执行代码的能力** | 数据文件不执行用户代码（与插件方案 C 档一致） |
    82	
    83	## 5. 设计实现方案
    84	
    85	### 5.1 目录约定（终态布局，标注为「终态」避免与「无消费者不建目录」纪律打架）
    86	
    87	```
    88	defaults/settings.json        内置默认（随包）
    89	user/
    90	  settings.json               用户覆盖（核心设置，热应用）
    91	  keybindings.json            键位映射（B1，map 型）
    92	  menus.json                  菜单结构（B2，list 型）
    93	  capsules.json               胶囊工具条（B5，list 型）
    94	  icons.json                  图标映射（B6，map 型）
    95	  view-specs.json             视图规格（B7，待裁决）
    96	  export.json                 导出配置（B8）
    97	  reader-presets.json         阅读预设（B9）
    98	  newdoc.json                 新文档默认（B10）
    99	  capture.json                捕获配置（B11，待裁决迁移）
   100	state/state.json              运行时派生（recentFiles/scrollPositions/embedScrollPositions）
   101	snapshots/settings-*.json     快照
   102	app_config_dir 根：snippets/ templates/ theme.toml   扩展点（用户层，不在 user/ 子目录）
   103	```
   104	
   105	**纪律**：上表为终态布局，每个文件在它的第一个消费者落地时才创建，不为「未来可能用到」提前建。
   106	
   107	### 5.2 合并语义（分型，已校正）
   108	
   109	按文件结构分两类，**不可一刀切**：
   110	
   111	| 类型 | 适用文件 | 合并语义 | 依据 |
   112	|---|---|---|---|
   113	| **map 型** | `keybindings.json`、`icons.json` | **逐键深合并**（键是命令 id / 概念名，天然支持逐键覆盖） | `merge_json` 现状语义；`ShortcutDef` 已是 id 键控结构 |
   114	| **list 型** | `menus.json`、`capsules.json` | **整体覆盖 + 未知 id 过滤**（顺序即语义，整体替换合理；过滤未知 id 容错） | 照抄 `slots.ts:resolveToolbarOrder` 既有容错范式（本仓现成正确范式）；`merge_json` 对数组本就是整体替换 |
   115	
   116	**注**：方案原称「声明式覆盖避免部分覆盖导致结构不完整」的论证与现状 `merge_json` 对数组整体替换的语义重复，已去除。
   117	
   118	### 5.3 热重载（写实，已校正）
   119	
   120	**现状**：唯一热重载是 `spawn_config_watcher`，只盯 `user/settings.json` 的 (mtime,len)（`config.rs:1083-1106`）。B 档任何新文件改动都不触发 `config-changed`。
   121	
   122	**设计**：
   123	- **`settings.json` 热应用**（既有 watcher）。
   124	- **B 档文件重启生效**（成本最低，优先选此）。不补每个 B 档文件的 watcher——除非评审后明确需要，否则不为每个文件新增 watcher 设计。
   125	
   126	### 5.4 验证门（加载端契约，已校正）
   127	
   128	AGENT 直改文件不走写侧校验，**验证门只能落在加载端**：
   129	
   130	- 每个 B 档文件规定**加载端契约**：加载失败/非法时的语义——**回退默认 + 聚合告警**（对齐 `theme.toml` 的白名单过滤纪律）。
   131	- **未知键防线（根因）**：`AppConfig` 当前无 `deny_unknown_fields`，`patch_config` 会**静默吞掉未知键**（`config.rs` grep 零命中）。这是 R2 的根——AGENT 照着错清单写无效字段却不可见。**必须给 `AppConfig` 加 `deny_unknown_fields` 或在 patch 入口拒绝未知键**，方案的校验门承诺依赖此防线。
   132	- **快照覆盖范围**：现 `snapshot_user` 只覆盖 `settings.json`。明确 B 档文件是否进快照——建议 B 档文件不进快照（重启生效、结构简单），或扩展 `snapshot_user`，实现时定。
   133	
   134	### 5.5 AGENT 自定义路径（核心价值，已校正）
   135	
   136	**现状**：AGENT 只有 `read_config` / `patch_config` / `list_snapshots` 三工具（`ai_agent.rs:708`），`patch_config` 只写 `settings.json`。B 档「AGENT 直写 `user/*.json`」意味着每批需新增 loader、加载端校验、（可选）watcher、快照覆盖。
   137	
   138	**完整链路**：
   139	
   140	```
   141	用户说「帮我把导出默认改成 PDF，把 X 快捷键改成 Ctrl+Shift+D」
   142	  → AGENT 识别目标功能域（export / keybindings）
   143	  → AGENT 读取对应 user/ 数据文件（或 defaults 兜底）
   144	  → AGENT 校验字段合法性（依赖 deny_unknown_fields 防线）
   145	  → AGENT 写入 user/ 对应文件
   146	  → 重启生效（B 档）/ 热应用（settings.json）
   147	```
   148	
   149	**AGENT 可见性载体**：`SKILL_MAP`（`config.rs:977-1031`，`seed_skill_map`）是既有 AGENT 可见性载体。清单登记 + AGENT 可见性落在 SKILL_MAP，让 AGENT 知道有哪些文件可改、字段含义。
   150	
   151	### 5.6 B7 视图规格独立文件（裁决）
   152	
   153	omarchy-inventory 勘误明确：「独立视图文件从未实现、四字段是实现选择而非欠账」。本方案重提独立文件，**必须先给独立理由**：
   154	
   155	- 若理由是「让 AGENT 直接改视图布局、与 settings.json 解耦便于备份迁移」——成立，但需写明旧字段迁移策略、并存优先级、UI 写路径改造点（`paneLayout` 是序列化 JSON 字符串，改存储位即改格式）。
   156	- 若无独立理由——**B7 保留现状，不抽独立文件**。
   157	
   158	评审裁定：**保留现状优先**，除非实现时给出充分独立理由。
   159	
   160	### 5.7 捕获配置归一（裁决）
   161	
   162	捕获配置当前落点 `~/.biaoyue/config.toml`（TOML），**在三层目录体系之外，是两个世界**。
   163	
   164	- 若纳入统一管理——迁入 `user/capture.json`，需迁移与兼容。
   165	- 若保持独立——明确声明捕获配置是独立体系，不纳入三层目录，AGENT 通过专用工具管理。
   166	
   167	评审裁定：**保持独立体系优先**，避免为归一引入迁移成本；在清单中显式标注其独立落点。
   168	
   169	### 5.8 根因缺陷修复（必须处理，方案已收敛）
   170	
   171	**现状缺陷（确认属实）**：`apply_patch_at`（`config.rs:949-976`）只读 user 层、**从不读 `state.json`**；`config` 从 user+patch 反序列化，`recent_files=None` → `state_value` 输出空默认值并 `atomic_write` 覆盖磁盘 `state.json`，**清空 `recentFiles`/`scrollPositions`/`embedScrollPositions`**。每次调用都清空，无单测覆盖。
   172	
   173	**收敛后的修复方案（选定）**：**删除 `apply_patch_at` 的 state 写入**——`apply_patch_at` 本身无状态语义，直接删掉其 state 写入即可。`save_config` 的状态由前端实时值维护（`useConfig.ts:185-192` 已显式读实时 store 防陈旧）。
   174	
   175	**附带修正**：`apply_patch_at` 返回值是修复前 `load_config_at`（含磁盘旧 state），AGENT 验证时看到的是已被清空前的假数据、磁盘却是空的——修复时一并修正返回值语义。
   176	
   177	**测试要求（明确）**：构造含 `state.json` 的目录 → 调用 `apply_patch_at` → 断言 `state.json` **字节不变**。当前零覆盖，必须补。
   178	
   179	## 6. 分批实施路线（已按校正事实调整）
   180	
   181	每批一个 OpenSpec change（G0–G4），每批注明按 data-surface 六栏契约落表：
   182	
   183	1. **第一批（根因修复）**：删 `apply_patch_at` 的 state 写入 + 修正返回值语义 + 补单测（断言 state.json 字节不变）。**这是后续数据文件化的前提**。
   184	2. **第二批（核心文件化）**：B1 键位、B6 图标、B8 导出配置（B7 视图规格按 §5.6 裁决，若无独立理由则不抽）。
   185	3. **第三批（配置面文件化）**：B2 菜单、B5 胶囊工具条（B3 轮盘扇区、B4 工具条按钮已文件化，仅需 A 档登记收尾，不重做）。
   186	4. **第四批（体验类文件化）**：B9 阅读预设、B10 新文档默认。B11 捕获配置按 §5.7 裁决（保持独立则不迁）。
   187	
   188	## 7. 对抗评审记录
   189	
   190	**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。

exec
/bin/zsh -c "rg -n \"A4|数据包型|disabled|启停|设置内插件|插件分类\" docs -g '*.md' | head -n 300" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/delivery/requirements-status.md:59:  - 视频测试基线（逆时针断言、播放列表事件驱动）、手柄菜单回移不拆且图片/表格菜单贴手柄、拖块插入指示线与 Esc 取消、全屏按钮栏自动浮现、两态块宽度对齐、编辑态等宽统一、编辑态 KaTeX 公式与围栏代码高亮、Pele 两态字体同源、表格网格增量高亮保留选中、分栏 5 横向栏目、A4 打印、图片描述/裁剪/对齐/缩放锚点/预览浮层/圆角/块菜单/任务图标
docs/architecture/overview.md:91:- **形态**：`<config_base>/extensions/<id>/{manifest.json, SKILL.md}`；可选 `.disabled` 标记文件表示停用（不改用户目录结构，只加标记）。
docs/requirements/editor-surface-batch20/requirements.md:6:  - `标月 Biaoyue2.pdf`（缺陷 1 的输出 PDF；2 页 A4，`Creator: Biaoyue` / `Producer: macOS … Quartz PDFContext`）
docs/requirements/editor-surface-batch20/requirements.md:13:- 缺陷 1 打印→输出 PDF：打印预览显示完整，但输出的 PDF 中段与尾部内容不全（复现文档 mermaid 之后的内容缺失）。修正定性：产物为 2 页 A4、Quartz 生成 → 走的是「打印 → 存为 PDF」路径（`window.print()`），非应用内单页导出。
docs/requirements/editor-surface-batch20/requirements.md:98:  - 元数据：`pdfinfo` → `Pages: 2`、Page size A4、`Creator: Biaoyue`、`Producer: macOS … Quartz PDFContext` → 走 `window.print()`（`printPreview.ts:146`）经 macOS 打印栈存 PDF；排除应用内 `pdf.ts` 单页导出路径。
docs/architecture/decisions/0011-scenario-shell-and-pane-tree.md:30:- 周边：扩展包（`extensions/<id>/{manifest.json, SKILL.md}`，`.disabled` 停用标记，AI 系统提示消费）与快捷键注册表（`src/lib/shortcuts.ts` 单一真相源）构成外壳的其余部分。
docs/requirements/editor-surface-batch19/requirements.md:15:- A4 分栏：栏目内已有文字时点击进入不得重复显示同一段文字；栏目左上角无意义的小方框要么给出明确作用要么移除；栏目前的 `+` 鼠标滑入须保持可见并显示选择菜单；分栏之间的间隔线须可见。
docs/requirements/editor-surface-batch19/requirements.md:42:- A1/A2/A4/A9 是交互层「点了没反应 / 该消失的没消失 / 该出现的没出现」，直接阻断编辑动作；A7/A8 是工具条状态与手柄可见性错误，用户无法确知当前操作状态。
docs/requirements/editor-surface-batch19/requirements.md:93:| Q-A4 | 栏目左上角小方框「给出作用或移除」 | A4 | 移除 | 否 |
docs/requirements/editor-surface-batch16/requirements.md:63:| 空白显式化 | 通过 | 三处未指定：① md-bundle 的确切字体栈 → design D2 记录两侧实测字体族；② 「分栏 5 栏」= 5 等分栏 → design D6 定为 5 等分；③ 「打印」纸张/页边距 → design D9 定为 A4 纵向、10mm 页边距、不加页眉页脚。三处均为决策项，不阻断拆票 |
docs/design/approved/shell-ui/spec.md:161:- 扩展名部分（`.md`）以 disabled span 缀在 input 后面
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:34:| A4 | **编辑器扩展** | **现状描述修正**：`capabilities` 键已是声明式开关，**消费方不止 AI 上下文**——`SettingsView.tsx` 直接消费（`set`/`toggle` 扩展项，可见性与开关同态），**AI 工具则完全由 SKILL.md 驱动**，无 settings 入口。入口并非「散落在设置深处」，而是按能力类型分两处：编辑器扩展在设置页可见开关，AI 能力在 SKILL 注入面 | 注册型 | ✅ 已落地，**消费方分两类，需在清单中显式区分** |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:61:| C5 | **与数据文件化重复的能力** | **配置载体证据补全**：A3/A4/A5 等已由数据文件化承载，插件化重复时以数据文件为单一落点，避免双写。插件体系管「打包/加载/升级」维度，数据文件管「配置值」维度，两者在 A 档能力上是**正交维度**而非重复（见 §5.3） |
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:109:A 档能力（A3 主题、A4 扩展、A5 片段模板）两者都涉及：数据文件是其**配置值载体**，插件是其**打包加载载体**。**单一落点原则**：某能力若已由数据文件化承载配置值，插件化不再重复建配置落点，只补打包/加载维度。避免双写。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:130:1. **第一批（收尾既有插件形态）**：A1 扩展包 manifest 字段统一 + 权限声明补全；A2/A4 消费方分两类显式区分；B2/B3 统一纳入插件体系登记。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:143:1. **P0 A4 现状断言错误（硬伤）**：方案称扩展包「消费端仅到 AI 上下文、入口散落在设置深处」，实际 SettingsView 直接消费 capabilities，AI 工具由 SKILL.md 驱动 → 已采纳，§3 A4 现状描述按「消费方分两类（设置页开关 + SKILL 注入面）」校正。
docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:148:**可保留**：三类插件形态定义、A 档定性（除 A4 描述）、C1/C5 排除结论、分批路线结构。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:119:**「启停/卸载」是数据包型插件（A4，`.disabled` 标记）专属的生命周期**；数据文件型插件（A1–A3）是「删文件即卸载」，无启停概念（01 号文档 §5.1 已写明）。操作入口按插件类型分：
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:123:| 数据包型（A4） | 设置内插件分类 | 启停 / 卸载（`.disabled` 标记） |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:124:| 数据文件型（A1–A3） | 设置内插件分类（清单查看） | **删文件即卸载**；设置内提供清单查看入口 |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:128:原方案只解决「操作」不解决「发现」。**可发现性处理**：设置内插件分类的清单即发现入口（用户可在设置中浏览有哪些插件能力）；或对齐数据文件目录约定，用户通过目录结构感知能力。不新增常驻 UI，避免与「零弹窗、无常驻」信条冲突。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:137:4. **插件展示**：设置内插件分类清单（数据包型启停 + 数据文件型清单查看）。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:157:5. **插件章术语矛盾**：「较多插件」不成立；「启停/卸载」应限定数据包型 → 已采纳，§5 前提校正 + 操作入口按类型分。
docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md:52:| **插件** | 插件清单、启停、卸载、查看数据文件 | 第 1 项 A/B 档插件（原「扩展」升级） |

exec
/bin/zsh -c "nl -ba src/components/SettingsView.tsx | sed -n '75,110p;235,345p;380,550p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
    75	  families: string[];
    76	  enumerated: boolean;
    77	}
    78	
    79	const SOURCE_LABELS: Record<ExtensionPackage["source"], string> = {
    80	  builtin: "内置",
    81	  ai: "AI 生成",
    82	  user: "用户导入",
    83	};
    84	
    85	const SECTIONS = [
    86	  { id: "appearance", label: "外观" },
    87	  { id: "editor", label: "编辑器" },
    88	  { id: "files", label: "文件" },
    89	  { id: "reading", label: "阅读空间" },
    90	  { id: "grid", label: "网格概览" },
    91	  { id: "preview", label: "悬浮预览" },
    92	  { id: "ai", label: "AI 服务" },
    93	  { id: "extensions", label: "扩展" },
    94	  { id: "shortcuts", label: "快捷键" },
    95	  { id: "data", label: "数据与备份" },
    96	  { id: "about", label: "关于" },
    97	] as const;
    98	
    99	type SectionId = (typeof SECTIONS)[number]["id"];
   100	
   101	const RAIL_LAYOUT_OPTIONS = [
   102	  { value: "stacked", label: "堆叠" },
   103	  { value: "tabs", label: "标签页" },
   104	] as const;
   105	
   106	const RAIL_DENSITY_OPTIONS = [
   107	  { value: "compact", label: "紧凑" },
   108	  { value: "comfortable", label: "舒适" },
   109	  { value: "card", label: "卡片" },
   110	] as const;
   235	    let cancelled = false;
   236	    invoke<ExtensionPackage[]>("list_extension_packages")
   237	      .then((list) => {
   238	        if (!cancelled) setPackages(Array.isArray(list) ? list : []);
   239	      })
   240	      .catch(() => {
   241	        if (!cancelled) setPackages([]);
   242	      })
   243	      .finally(() => {
   244	        if (!cancelled) setLoading(false);
   245	      });
   246	    return () => {
   247	      cancelled = true;
   248	    };
   249	  }, [tauriEnv]);
   250	
   251	  const importPath = useCallback(
   252	    async (target: string) => {
   253	      if (!tauriEnv) return;
   254	      try {
   255	        await invoke<ExtensionPackage>("import_extension_package", {
   256	          path: target,
   257	        });
   258	        await refresh();
   259	        setNotice(`已导入扩展：${target}`);
   260	      } catch {
   261	        setNotice("导入失败，请重试。");
   262	      }
   263	    },
   264	    [tauriEnv, refresh],
   265	  );
   266	
   267	  const importFrom = async (kind: "folder" | "zip") => {
   268	    if (!tauriEnv) return;
   269	    try {
   270	      const picked = await invoke<string | null>("pick_extension_source", {
   271	        kind,
   272	      });
   273	      if (!picked) return;
   274	      await importPath(picked);
   275	    } catch {
   276	      setNotice("导入失败，请重试。");
   277	    }
   278	  };
   279	
   280	  // Tauri webview 拖放：进入/悬停显示浮层，松开导入首个路径，离开或 Esc 收起。
   281	  useEffect(() => {
   282	    if (!tauriEnv) return;
   283	    let unlisten: (() => void) | null = null;
   284	    let disposed = false;
   285	    (async () => {
   286	      try {
   287	        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
   288	        if (disposed) return;
   289	        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
   290	          const type = event.payload.type;
   291	          if (type === "enter" || type === "over") {
   292	            setDropActive(true);
   293	            return;
   294	          }
   295	          if (type === "leave") {
   296	            setDropActive(false);
   297	            return;
   298	          }
   299	          if (type !== "drop") return;
   300	          setDropActive(false);
   301	          const path = event.payload.paths[0];
   302	          if (path) void importPath(path);
   303	        });
   304	      } catch {
   305	        /* 浏览器预览无 webview 拖放事件 */
   306	      }
   307	    })();
   308	    return () => {
   309	      disposed = true;
   310	      unlisten?.();
   311	    };
   312	  }, [tauriEnv, importPath, setDropActive]);
   313	
   314	  const togglePackage = async (pkg: ExtensionPackage, enabled: boolean) => {
   315	    try {
   316	      await invoke("set_extension_package_enabled", {
   317	        id: pkg.id,
   318	        enabled,
   319	      });
   320	      await refresh();
   321	    } catch {
   322	      /* 开关失败时保留原状态 */
   323	    }
   324	  };
   325	
   326	  const removePackage = async (id: string) => {
   327	    try {
   328	      await invoke("remove_extension_package", { id });
   329	      await refresh();
   330	      setNotice("已卸载扩展。");
   331	    } catch {
   332	      setNotice("卸载失败，请重试。");
   333	    }
   334	  };
   335	
   336	  const exportPackage = async (id: string) => {
   337	    try {
   338	      const out = await invoke<string>("package_extension_package", { id });
   339	      setNotice(`已导出：${out}`);
   340	    } catch {
   341	      setNotice("导出失败，请重试。");
   342	    }
   343	  };
   344	
   345	  const openDir = async (dir: string | null) => {
   380	  };
   381	
   382	  const cancelAi = () => {
   383	    aiRunRef.current += 1;
   384	    setAiBusy(false);
   385	  };
   386	
   387	  return (
   388	    <div className="space-y-6">
   389	      <section>
   390	        <h2 className="mb-1 text-sm font-medium text-[var(--app-text-strong)]">
   391	          扩展
   392	        </h2>
   393	        <p className="mb-3 text-xs text-[var(--app-text-3)]">
   394	          拖入含 manifest.json 与 SKILL.md 的文件夹或 .zip，导入后立即启用。
   395	        </p>
   396	        {!tauriEnv ? (
   397	          <p
   398	            className="text-sm text-[var(--app-text-3)]"
   399	            data-testid="extensions-disabled-note"
   400	          >
   401	            扩展管理仅在桌面版可用，浏览器预览不可用。
   402	          </p>
   403	        ) : (
   404	          <>
   405	            <div
   406	              data-testid="extensions-dropzone"
   407	              className="rounded border border-dashed border-[var(--app-border)] px-4 py-6 text-center"
   408	            >
   409	              <p className="text-sm text-[var(--app-text-2)]">
   410	                把扩展文件夹或 .zip 拖到这里
   411	              </p>
   412	              <div className="mt-3 flex justify-center gap-2">
   413	                <button
   414	                  type="button"
   415	                  data-testid="extensions-import-folder"
   416	                  onClick={() => void importFrom("folder")}
   417	                  className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
   418	                >
   419	                  选择文件夹
   420	                </button>
   421	                <button
   422	                  type="button"
   423	                  data-testid="extensions-import-zip"
   424	                  onClick={() => void importFrom("zip")}
   425	                  className="rounded border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
   426	                >
   427	                  选择 .zip
   428	                </button>
   429	              </div>
   430	            </div>
   431	            {dropActive && (
   432	              <div
   433	                data-testid="extensions-drop-overlay"
   434	                className="mt-3 rounded border border-[var(--app-accent)] bg-[var(--app-accent-soft)] px-4 py-6 text-center text-sm text-[var(--app-accent)]"
   435	              >
   436	                松开以导入扩展，Esc 取消
   437	              </div>
   438	            )}
   439	          </>
   440	        )}
   441	      </section>
   442	
   443	      <section>
   444	        <h2 className="mb-2 text-sm font-medium text-[var(--app-text-strong)]">
   445	          已安装
   446	        </h2>
   447	        {loading ? (
   448	          <p className="text-sm text-[var(--app-text-3)]">读取中…</p>
   449	        ) : packages.length === 0 ? (
   450	          <p
   451	            className="text-sm text-[var(--app-text-3)]"
   452	            data-testid="extensions-empty"
   453	          >
   454	            暂无扩展
   455	          </p>
   456	        ) : (
   457	          <ul className="space-y-2">
   458	            {packages.map((pkg) => {
   459	              const isBuiltin = pkg.source === "builtin";
   460	              return (
   461	                <li
   462	                  key={pkg.id}
   463	                  data-testid="extension-row"
   464	                  data-extension-id={pkg.id}
   465	                  className="rounded border border-[var(--app-border)] px-3 py-2"
   466	                >
   467	                  <div className="flex items-center gap-3">
   468	                    <div className="min-w-0 flex-1">
   469	                      <div className="flex items-center gap-2">
   470	                        <span className="truncate text-sm text-[var(--app-text)]">
   471	                          {pkg.name}
   472	                        </span>
   473	                        <span
   474	                          data-testid="extension-source"
   475	                          className="shrink-0 rounded bg-[var(--app-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--app-text-3)]"
   476	                        >
   477	                          {SOURCE_LABELS[pkg.source]}
   478	                        </span>
   479	                      </div>
   480	                      {pkg.description && (
   481	                        <p className="mt-0.5 truncate text-xs text-[var(--app-text-3)]">
   482	                          {pkg.description}
   483	                        </p>
   484	                      )}
   485	                    </div>
   486	                    <label className="flex shrink-0 items-center gap-1.5">
   487	                      <input
   488	                        type="checkbox"
   489	                        data-testid="extension-toggle"
   490	                        checked={pkg.enabled}
   491	                        disabled={isBuiltin}
   492	                        onChange={(e) =>
   493	                          void togglePackage(pkg, e.target.checked)
   494	                        }
   495	                      />
   496	                      <span className="text-xs text-[var(--app-text-3)]">
   497	                        {pkg.enabled ? "启用" : "停用"}
   498	                      </span>
   499	                    </label>
   500	                    <button
   501	                      type="button"
   502	                      data-testid="extension-open"
   503	                      disabled={isBuiltin || !pkg.dir}
   504	                      onClick={() => void openDir(pkg.dir)}
   505	                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
   506	                    >
   507	                      打开文件夹
   508	                    </button>
   509	                    <button
   510	                      type="button"
   511	                      data-testid="extension-export"
   512	                      disabled={isBuiltin}
   513	                      onClick={() => void exportPackage(pkg.id)}
   514	                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
   515	                    >
   516	                      导出
   517	                    </button>
   518	                    <button
   519	                      type="button"
   520	                      data-testid="extension-preview"
   521	                      onClick={() =>
   522	                        setPreviewId((cur) => (cur === pkg.id ? null : pkg.id))
   523	                      }
   524	                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)]"
   525	                    >
   526	                      {previewId === pkg.id ? "收起" : "预览"}
   527	                    </button>
   528	                    <button
   529	                      type="button"
   530	                      data-testid="extension-remove"
   531	                      disabled={isBuiltin}
   532	                      onClick={() => void removePackage(pkg.id)}
   533	                      className="shrink-0 rounded border border-[var(--app-border)] px-2 py-1 text-xs text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
   534	                    >
   535	                      卸载
   536	                    </button>
   537	                  </div>
   538	                  {previewId === pkg.id && (
   539	                    <pre
   540	                      data-testid="extension-skill"
   541	                      className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-[var(--app-border)] bg-[var(--app-sunken)] p-2 text-xs text-[var(--app-text-2)]"
   542	                    >
   543	                      {pkg.skill}
   544	                    </pre>
   545	                  )}
   546	                </li>
   547	              );
   548	            })}
   549	          </ul>
   550	        )}

exec
/bin/zsh -c "nl -ba src-tauri/src/extension_packages.rs | sed -n '1,180p;345,390p;515,585p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	//! 扩展包管理（layout-portal §9）：`<config_base>/extensions/<id>/` 下的
     2	//! `manifest.json` + `SKILL.md` 包。
     3	//!
     4	//! 只读写包文件本身，**绝不执行包内任何内容**。内置包是静态的，常驻启用、不可
     5	//! 卸载 / 导出。用户包用目录名作为 id，`.disabled` 标记文件表示停用（不改用户
     6	//! manifest）。
     7	//!
     8	//! 目录布局：
     9	//! - `<config_base>/extensions/<id>/manifest.json`
    10	//! - `<config_base>/extensions/<id>/SKILL.md`
    11	//! - `<config_base>/extensions/<id>/.disabled`（可选，停用标记）
    12	//! - `<config_base>/exports/<id>-<timestamp>.zip`（导出产物）
    13	
    14	use serde::{Deserialize, Serialize};
    15	use std::io::{Read, Write};
    16	use std::path::{Component, Path, PathBuf};
    17	use tauri::AppHandle;
    18	use tauri_plugin_dialog::DialogExt;
    19	use tracing::warn;
    20	
    21	use crate::config::config_base;
    22	use crate::errors::AppError;
    23	
    24	const MANIFEST_FILE: &str = "manifest.json";
    25	const SKILL_FILE: &str = "SKILL.md";
    26	const DISABLED_MARKER: &str = ".disabled";
    27	
    28	// ── zip 解压资源上限（防 zip bomb）─────────────────────────────
    29	/// 单个 zip 最多条目数。
    30	const MAX_ZIP_ENTRIES: usize = 2000;
    31	/// 解压后总字节数上限（所有文件之和）。
    32	const MAX_ZIP_TOTAL_BYTES: u64 = 64 * 1024 * 1024;
    33	/// 单个条目解压后字节数上限。
    34	const MAX_ZIP_FILE_BYTES: u64 = 16 * 1024 * 1024;
    35	
    36	/// 内置包 id：静态、常驻启用、不可卸载 / 导出。
    37	const BUILTIN_READING: &str = "builtin-reading";
    38	const BUILTIN_OUTLINE: &str = "builtin-outline";
    39	
    40	const BUILTIN_READING_SKILL: &str = "# 内置阅读\n\n\
    41	标月内置的阅读辅助能力：阅读进度、目录导航与排版相关的基础支持。\n\n\
    42	本扩展由应用自带，始终启用，不可卸载或导出。\n";
    43	
    44	const BUILTIN_OUTLINE_SKILL: &str = "# 内置大纲\n\n\
    45	标月内置的大纲辅助能力：标题层级解析与大纲生成的基础支持。\n\n\
    46	本扩展由应用自带，始终启用，不可卸载或导出。\n";
    47	
    48	#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    49	#[serde(rename_all = "camelCase")]
    50	pub struct ExtensionManifest {
    51	    pub id: String,
    52	    pub name: String,
    53	    pub version: String,
    54	    pub description: String,
    55	    /// "builtin" | "ai" | "user"
    56	    pub source: String,
    57	}
    58	
    59	#[derive(Debug, Clone, Serialize, PartialEq)]
    60	#[serde(rename_all = "camelCase")]
    61	pub struct ExtensionPackage {
    62	    pub id: String,
    63	    pub name: String,
    64	    pub version: String,
    65	    pub description: String,
    66	    pub source: String,
    67	    pub enabled: bool,
    68	    /// null for built-ins
    69	    pub dir: Option<String>,
    70	    /// full SKILL.md text
    71	    pub skill: String,
    72	}
    73	
    74	// ── 错误辅助 ─────────────────────────────────────────────────
    75	
    76	fn io(context: &str, source: std::io::Error) -> AppError {
    77	    AppError::Io {
    78	        context: context.into(),
    79	        source,
    80	    }
    81	}
    82	
    83	fn validation(context: &str, message: impl Into<String>) -> AppError {
    84	    AppError::Validation {
    85	        context: context.into(),
    86	        message: message.into(),
    87	    }
    88	}
    89	
    90	fn zip_err(context: &str, source: zip::result::ZipError) -> AppError {
    91	    validation(context, format!("zip 处理失败：{source}"))
    92	}
    93	
    94	// ── 目录布局 ─────────────────────────────────────────────────
    95	
    96	fn extensions_dir_base(base: &Path) -> PathBuf {
    97	    base.join("extensions")
    98	}
    99	
   100	fn exports_dir_base(base: &Path) -> PathBuf {
   101	    base.join("exports")
   102	}
   103	
   104	// ── 校验 ─────────────────────────────────────────────────────
   105	
   106	/// `id` 必须匹配 `[a-z0-9-]+`。
   107	fn is_valid_id(value: &str) -> bool {
   108	    !value.is_empty()
   109	        && value
   110	            .chars()
   111	            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
   112	}
   113	
   114	fn is_builtin(id: &str) -> bool {
   115	    matches!(id, BUILTIN_READING | BUILTIN_OUTLINE)
   116	}
   117	
   118	fn validate_manifest(manifest: &ExtensionManifest) -> Result<(), AppError> {
   119	    if !is_valid_id(&manifest.id) {
   120	        return Err(validation(
   121	            "manifest.id",
   122	            format!("id {:?} 格式非法（应为 [a-z0-9-]+）", manifest.id),
   123	        ));
   124	    }
   125	    if manifest.name.trim().is_empty() {
   126	        return Err(validation("manifest.name", "name 不能为空"));
   127	    }
   128	    if manifest.version.trim().is_empty() {
   129	        return Err(validation("manifest.version", "version 不能为空"));
   130	    }
   131	    if !matches!(manifest.source.as_str(), "builtin" | "ai" | "user") {
   132	        return Err(validation(
   133	            "manifest.source",
   134	            format!("source {:?} 不属于 builtin|ai|user", manifest.source),
   135	        ));
   136	    }
   137	    Ok(())
   138	}
   139	
   140	// ── 读取单个包目录 ───────────────────────────────────────────
   141	
   142	/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
   143	fn read_package_dir(dir: &Path) -> Result<(ExtensionManifest, String), AppError> {
   144	    let manifest_path = dir.join(MANIFEST_FILE);
   145	    let raw = std::fs::read_to_string(&manifest_path)
   146	        .map_err(|e| io(&format!("read {}", manifest_path.display()), e))?;
   147	    let manifest: ExtensionManifest =
   148	        serde_json::from_str(&raw).map_err(|e| AppError::Serialization {
   149	            context: format!("parse {}", manifest_path.display()),
   150	            source: e,
   151	        })?;
   152	
   153	    let skill_path = dir.join(SKILL_FILE);
   154	    let skill = std::fs::read_to_string(&skill_path)
   155	        .map_err(|e| io(&format!("read {}", skill_path.display()), e))?;
   156	
   157	    Ok((manifest, skill))
   158	}
   159	
   160	fn package_enabled(dir: &Path) -> bool {
   161	    !dir.join(DISABLED_MARKER).exists()
   162	}
   163	
   164	/// 优先取根目录；根目录不含包时，若恰好只有一个子目录含包则下钻一层。
   165	fn locate_zip_root(dir: &Path) -> Option<PathBuf> {
   166	    let has_package = |p: &Path| p.join(MANIFEST_FILE).is_file() && p.join(SKILL_FILE).is_file();
   167	    if has_package(dir) {
   168	        return Some(dir.to_path_buf());
   169	    }
   170	    let mut candidates = Vec::new();
   171	    for entry in std::fs::read_dir(dir).ok()?.flatten() {
   172	        let path = entry.path();
   173	        if path.is_dir() && has_package(&path) {
   174	            candidates.push(path);
   175	        }
   176	    }
   177	    if candidates.len() == 1 {
   178	        candidates.pop()
   179	    } else {
   180	        None
   345	        let target = dst.join(entry.file_name());
   346	        if file_type.is_dir() {
   347	            copy_dir(&entry.path(), &target)?;
   348	        } else if file_type.is_file() {
   349	            std::fs::copy(entry.path(), &target).map_err(|e| {
   350	                io(
   351	                    &format!("copy {} → {}", entry.path().display(), target.display()),
   352	                    e,
   353	                )
   354	            })?;
   355	        } else {
   356	            return Err(validation(
   357	                "import",
   358	                format!("扩展包内不支持符号链接：{}", entry.path().display()),
   359	            ));
   360	        }
   361	    }
   362	    Ok(())
   363	}
   364	
   365	/// 导入文件夹或 zip；id 已存在则整体替换。默认启用（源里若带 `.disabled`
   366	/// 标记则原样保留，保证导出 → 再导入的严格相等）。
   367	///
   368	/// 先复制到 `<extensions>/.tmp-<id>-<hash>` 暂存目录，成功后才移除旧目标并
   369	/// 原子 rename。复制 / 校验失败时暂存目录被删除，已安装的旧包保持不变；源目录
   370	/// 就是目标目录（自导入）时，暂存副本先读完整旧目录，因此不会丢数据。
   371	pub fn import_extension_package_at(base: &Path, path: &str) -> Result<ExtensionPackage, AppError> {
   372	    let ResolvedSource {
   373	        manifest,
   374	        skill,
   375	        dir,
   376	        _temp,
   377	    } = resolve_import_source(path)?;
   378	
   379	    if is_builtin(&manifest.id) {
   380	        return Err(validation(
   381	            "import",
   382	            format!("内置扩展 id {} 不可导入", manifest.id),
   383	        ));
   384	    }
   385	
   386	    let extensions = extensions_dir_base(base);
   387	    std::fs::create_dir_all(&extensions)
   388	        .map_err(|e| io(&format!("create {}", extensions.display()), e))?;
   389	    let staging = extensions.join(format!(".tmp-{}-{}", manifest.id, short_hash(path)));
   390	    if staging.exists() {
   515	        total_bytes += copied;
   516	    }
   517	    Ok(())
   518	}
   519	
   520	fn package_dir_at(base: &Path, id: &str) -> Result<PathBuf, AppError> {
   521	    if !is_valid_id(id) {
   522	        return Err(validation(
   523	            "extensionPackage",
   524	            format!("非法的扩展 id：{id}"),
   525	        ));
   526	    }
   527	    let dir = extensions_dir_base(base).join(id);
   528	    if !dir.is_dir() {
   529	        return Err(validation("extensionPackage", format!("扩展不存在：{id}")));
   530	    }
   531	    Ok(dir)
   532	}
   533	
   534	pub fn set_extension_package_enabled_at(
   535	    base: &Path,
   536	    id: &str,
   537	    enabled: bool,
   538	) -> Result<(), AppError> {
   539	    if is_builtin(id) {
   540	        return Err(validation(
   541	            "extensionPackage",
   542	            "内置扩展始终启用，不可修改启用状态",
   543	        ));
   544	    }
   545	    let dir = package_dir_at(base, id)?;
   546	    let marker = dir.join(DISABLED_MARKER);
   547	    if enabled {
   548	        if marker.exists() {
   549	            std::fs::remove_file(&marker)
   550	                .map_err(|e| io(&format!("remove {}", marker.display()), e))?;
   551	        }
   552	    } else {
   553	        std::fs::write(&marker, b"").map_err(|e| io(&format!("write {}", marker.display()), e))?;
   554	    }
   555	    Ok(())
   556	}
   557	
   558	pub fn remove_extension_package_at(base: &Path, id: &str) -> Result<(), AppError> {
   559	    if is_builtin(id) {
   560	        return Err(validation("extensionPackage", "内置扩展不可卸载"));
   561	    }
   562	    let dir = package_dir_at(base, id)?;
   563	    std::fs::remove_dir_all(&dir).map_err(|e| io(&format!("remove {}", dir.display()), e))?;
   564	    Ok(())
   565	}
   566	
   567	fn add_dir_entries<W: Write + std::io::Seek>(
   568	    zip: &mut zip::ZipWriter<W>,
   569	    base: &Path,
   570	    dir: &Path,
   571	    options: zip::write::SimpleFileOptions,
   572	) -> Result<(), AppError> {
   573	    let entries = std::fs::read_dir(dir).map_err(|e| io(&format!("read {}", dir.display()), e))?;
   574	    for entry in entries {
   575	        let entry = entry.map_err(|e| io("read dir entry", e))?;
   576	        let path = entry.path();
   577	        let rel = path
   578	            .strip_prefix(base)
   579	            .map_err(|e| validation("zip", e.to_string()))?;
   580	        let name = rel.to_string_lossy().replace('\\', "/");
   581	        if path.is_dir() {
   582	            zip.add_directory(format!("{name}/"), options)
   583	                .map_err(|e| zip_err("zip directory", e))?;
   584	            add_dir_entries(zip, base, &path, options)?;
   585	        } else {

exec
/bin/zsh -c "rg -n \"extensionPackage|list_extensions|toggle_extension|delete_extension|import_extension|generate_extension\" src src-tauri/src -g '*.ts' -g '*.tsx' -g '*.rs' | head -n 240" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/commands/config_cmd.rs:58:pub fn list_extensions(app: AppHandle) -> Result<ExtensionsSnapshot, String> {
src-tauri/src/lib.rs:14:    delete_api_key, get_api_key, list_config_snapshots, list_extensions, list_system_fonts,
src-tauri/src/lib.rs:26:    generate_extension_package, import_extension_package, list_extension_packages,
src-tauri/src/lib.rs:225:            list_extensions,
src-tauri/src/lib.rs:227:            import_extension_package,
src-tauri/src/lib.rs:232:            generate_extension_package,
src-tauri/src/extension_packages.rs:371:pub fn import_extension_package_at(base: &Path, path: &str) -> Result<ExtensionPackage, AppError> {
src-tauri/src/extension_packages.rs:523:            "extensionPackage",
src-tauri/src/extension_packages.rs:529:        return Err(validation("extensionPackage", format!("扩展不存在：{id}")));
src-tauri/src/extension_packages.rs:541:            "extensionPackage",
src-tauri/src/extension_packages.rs:560:        return Err(validation("extensionPackage", "内置扩展不可卸载"));
src-tauri/src/extension_packages.rs:610:        return Err(validation("extensionPackage", "内置扩展不可导出"));
src-tauri/src/extension_packages.rs:682:pub fn generate_extension_package_at(
src-tauri/src/extension_packages.rs:688:        return Err(validation("extensionPackage", "提示词不能为空"));
src-tauri/src/extension_packages.rs:764:pub async fn import_extension_package(
src-tauri/src/extension_packages.rs:769:    tauri::async_runtime::spawn_blocking(move || import_extension_package_at(&base, &path))
src-tauri/src/extension_packages.rs:841:pub async fn generate_extension_package(
src-tauri/src/extension_packages.rs:846:    tauri::async_runtime::spawn_blocking(move || generate_extension_package_at(&base, &prompt))
src-tauri/src/extension_packages.rs:947:        let package = import_extension_package_at(&base, src.to_str().unwrap()).unwrap();
src-tauri/src/extension_packages.rs:986:        assert!(import_extension_package_at(&base, src.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1004:        let package = import_extension_package_at(&base, src.to_str().unwrap()).unwrap();
src-tauri/src/extension_packages.rs:1018:            import_extension_package_at(&base, installed.to_str().unwrap()).expect("自导入应成功");
src-tauri/src/extension_packages.rs:1056:        let err = import_extension_package_at(&base, src.to_str().unwrap())
src-tauri/src/extension_packages.rs:1089:        assert!(import_extension_package_at(&base, bad_id.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1099:        assert!(import_extension_package_at(&base, no_skill.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1106:        assert!(import_extension_package_at(&base, bad_json.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1117:        assert!(import_extension_package_at(&base, bad_source.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1188:        let package = import_extension_package_at(&base, &zip_path).unwrap();
src-tauri/src/extension_packages.rs:1206:        let package = import_extension_package_at(&base, &zip_path).unwrap();
src-tauri/src/extension_packages.rs:1215:        let package = generate_extension_package_at(&base, "帮我每周总结阅读笔记").unwrap();
src-tauri/src/extension_packages.rs:1235:        let again = generate_extension_package_at(&base, "帮我每周总结阅读笔记").unwrap();
src-tauri/src/extension_packages.rs:1243:        assert!(generate_extension_package_at(&base, "   ").is_err());
src-tauri/src/extension_packages.rs:1261:        let err = import_extension_package_at(&base, malicious.to_str().unwrap())
src-tauri/src/extension_packages.rs:1280:        assert!(import_extension_package_at(&base, zip_path.to_str().unwrap()).is_err());
src-tauri/src/extension_packages.rs:1298:        let err = import_extension_package_at(&base, zip_path.to_str().unwrap())
src-tauri/src/extension_packages.rs:1337:        let package = import_extension_package_at(&base, zip_path.to_str().unwrap()).unwrap();
src/lib/extensions/templates.ts:3: * `list_extensions` 返回的 `templates[]` 元素形状；正文里的占位符仅两个：
src/lib/extensions/bundle.ts:1:/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
src/lib/extensions/bundle.ts:6: * （`list_extensions` 在纯浏览器/老版本里不存在）。
src/lib/extensions/bundle.ts:19:/** 一次 `list_extensions` 调用解析出的三类扩展数据（snippets 供斜杠菜单）。 */
src/lib/extensions/bundle.ts:40:/** 从 `list_extensions` 返回值里取模板；形状不对返回空列表。 */
src/lib/extensions/bundle.ts:75:/** 把 `list_extensions` 返回值映射成 bundle；形状不对的字段各自降级。 */
src/lib/extensions/bundle.ts:85: * 调一次 `list_extensions` 并解析成 bundle。
src/lib/extensions/bundle.ts:92:    const result = await invokeFn("list_extensions");
src/lib/extensions/bundle.ts:100: * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
src/lib/extensions/bundle.ts:107:    const result = await invokeFn("list_extensions");
src/__tests__/lib/templates.test.ts:115:        throw new Error("list_extensions unavailable");
src/editors/user-extensions.ts:3: * Rust 侧 `list_extensions` 返回的 `ExtensionsSnapshot` 里，`snippets` 是
src/editors/user-extensions.ts:11: * 不抛错、不打 error 级日志（`list_extensions` 在纯浏览器/老版本里不存在）。
src/editors/user-extensions.ts:16:/** 用户片段的原始形状（`list_extensions` 的 `snippets[]` 元素）。 */
src/editors/user-extensions.ts:87:/** 从 `list_extensions` 返回值里取 snippets；形状不对返回空列表。 */
src/editors/user-extensions.ts:101: * 调 `list_extensions` 并把 `snippets` 映射成斜杠命令。
src/editors/user-extensions.ts:109:    const result = await invokeFn("list_extensions");
src/editors/slash.ts:427:// 用户片段命令（来自 `list_extensions`）。宿主在编辑器创建后加载一次并注册；
src/__tests__/editor/user-extensions.test.ts:92:        throw new Error("list_extensions unavailable");
src/components/SettingsView.tsx:255:        await invoke<ExtensionPackage>("import_extension_package", {
src/components/SettingsView.tsx:362:        "generate_extension_package",
src/components/Content/ContentArea.tsx:609:    // 纯内置命令（`list_extensions` 在纯浏览器/老版本里不存在）。

exec
/bin/zsh -c "nl -ba src/components/PortalView.tsx | sed -n '55,305p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
    55	 * 四块：继续阅读 hero / 最近文件富卡 / 8 类磁贴 / 快速动作；底部 ⌘P 提示。
    56	 * 没有「来源」入口——这个维度已从产品里删除。
    57	 */
    58	export default function PortalView({
    59	  onOpenFile,
    60	  onNewFile,
    61	  onOpenPath,
    62	  onAiCommand,
    63	  onStudyPage,
    64	}: {
    65	  onOpenFile: () => void;
    66	  onNewFile: () => void;
    67	  /** 按路径打开（文件当前没有页签时走这条，别用无人消费的 CustomEvent） */
    68	  onOpenPath: (path: string) => void | Promise<void>;
    69	  onAiCommand: () => void;
    70	  /** 「生成学习页」：把意图填进 AI 输入框再唤起（不是空按钮） */
    71	  onStudyPage: () => void;
    72	}) {
    73	  const recentFiles = useStore((s) => s.recentFiles);
    74	  const scrollPositions = useStore((s) => s.scrollPositions);
    75	  const setScene = useStore((s) => s.setScene);
    76	  const setGridTypeFilter = useStore((s) => s.setGridTypeFilter);
    77	  const setGridQuery = useStore((s) => s.setGridQuery);
    78	  const setGridPinnedOnly = useStore((s) => s.setGridPinnedOnly);
    79	  const setGridSelectedPath = useStore((s) => s.setGridSelectedPath);
    80	  const setActiveTab = useStore((s) => s.switchTab);
    81	  const tabs = useStore((s) => s.tabs);
    82	
    83	  const now = new Date();
    84	  const dateLabel = now.toLocaleDateString("zh-CN", {
    85	    month: "long",
    86	    day: "numeric",
    87	    weekday: "long",
    88	  });
    89	
    90	  const counts = useMemo(() => {
    91	    const acc = new Map<FileTypeKind, number>();
    92	    for (const f of recentFiles) {
    93	      const kind = fileTypeOf(f.path);
    94	      acc.set(kind, (acc.get(kind) ?? 0) + 1);
    95	    }
    96	    return acc;
    97	  }, [recentFiles]);
    98	
    99	  const hero = recentFiles[0] ?? null;
   100	  const cards = recentFiles.slice(0, 6);
   101	
   102	  const openRecent = (path: string) => {
   103	    const tab = Object.values(tabs).find((t) => t.path === path);
   104	    if (tab) {
   105	      setActiveTab(tab.id);
   106	      setScene("workspace");
   107	      return;
   108	    }
   109	    // 最近记录里但当前没有页签：交给上层按路径真正打开
   110	    void onOpenPath(path);
   111	  };
   112	
   113	  // 门户是首屏，但不能把人锁在里面：Esc 回到工作区（有页签时）。
   114	  useEffect(() => {
   115	    const onKey = (e: KeyboardEvent) => {
   116	      if (e.key !== "Escape") return;
   117	      if (Object.keys(useStore.getState().tabs).length === 0) return;
   118	      e.preventDefault();
   119	      setScene("workspace");
   120	    };
   121	    window.addEventListener("keydown", onKey);
   122	    return () => window.removeEventListener("keydown", onKey);
   123	  }, [setScene]);
   124	
   125	  /** 阅读进度：{scrollPos}/{contentHeight}，hero 与最近卡共用同一个公式 */
   126	  const percentOf = (path: string): number => {
   127	    const pos = scrollPositions[path];
   128	    if (!pos || pos.contentHeight <= 0) return 0;
   129	    return Math.min(100, Math.round((pos.scrollPos / pos.contentHeight) * 100));
   130	  };
   131	  const heroPercent = hero ? percentOf(hero.path) : 0;
   132	
   133	  return (
   134	    <div
   135	      data-testid="portal"
   136	      className="h-full overflow-auto bg-[var(--app-surface)] px-10 py-8"
   137	    >
   138	      <header className="mb-8">
   139	        <h1
   140	          data-testid="portal-greeting"
   141	          className="text-2xl font-medium text-[var(--app-text)]"
   142	        >
   143	          {greeting(now)}
   144	        </h1>
   145	        <p
   146	          data-testid="portal-date"
   147	          className="mt-1 text-sm text-[var(--app-text-3)]"
   148	        >
   149	          {dateLabel}
   150	        </p>
   151	      </header>
   152	
   153	      {recentFiles.length === 0 ? (
   154	        <section
   155	          data-testid="portal-empty"
   156	          className="rounded-lg border border-dashed border-[var(--app-border)] p-10 text-center"
   157	        >
   158	          <p className="mb-4 text-sm text-[var(--app-text-3)]">
   159	            还没有打开过文件。开始第一份文档吧。
   160	          </p>
   161	          <div className="flex justify-center gap-3">
   162	            <button
   163	              onClick={onNewFile}
   164	              data-testid="empty-new"
   165	              className="rounded border border-[var(--app-border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--app-sunken)]"
   166	            >
   167	              新建文档
   168	            </button>
   169	            <button
   170	              onClick={onOpenFile}
   171	              data-testid="empty-open"
   172	              className="rounded border border-[var(--app-border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--app-sunken)]"
   173	            >
   174	              打开文件
   175	            </button>
   176	            <button
   177	              onClick={onOpenFile}
   178	              data-testid="empty-import"
   179	              className="rounded border border-[var(--app-border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--app-sunken)]"
   180	            >
   181	              导入
   182	            </button>
   183	          </div>
   184	        </section>
   185	      ) : (
   186	        <>
   187	          {hero && (
   188	            <button
   189	              data-testid="portal-hero"
   190	              data-recent-path={hero.path}
   191	              {...fileDragHandlers(hero.path)}
   192	              onClick={() => openRecent(hero.path)}
   193	              className="mb-8 block w-full rounded-lg border border-[var(--app-border)] p-5 text-left hover:border-[var(--app-border-strong)] hover:bg-[var(--app-sunken)]"
   194	            >
   195	              <div className="mb-2 flex items-center gap-2 text-xs text-[var(--app-text-3)]">
   196	                <Icon
   197	                  name={iconOfType(fileTypeOf(hero.path))}
   198	                  size={18}
   199	                  color={TYPE_COLORS[fileTypeOf(hero.path)]}
   200	                />
   201	                继续阅读
   202	              </div>
   203	              <div className="text-lg font-medium text-[var(--app-text)]">
   204	                {hero.title}
   205	              </div>
   206	              <p className="mt-1 line-clamp-2 text-sm text-[var(--app-text-3)]">
   207	                {hero.excerpt || "（还没有内容）"}
   208	              </p>
   209	              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--app-text-3)]">
   210	                <span>{relativeTime(hero.openedAt)}</span>
   211	                {heroPercent > 0 && (
   212	                  <>
   213	                    <span>·</span>
   214	                    <span data-testid="hero-progress">已读 {heroPercent}%</span>
   215	                  </>
   216	                )}
   217	              </div>
   218	            </button>
   219	          )}
   220	
   221	          <section className="mb-8">
   222	            <h2 className="mb-3 text-xs font-medium text-[var(--app-text-2)]">
   223	              最近文件
   224	            </h2>
   225	            <div
   226	              data-testid="portal-recent"
   227	              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
   228	            >
   229	              {cards.map((f) => (
   230	                <button
   231	                  key={f.path}
   232	                  data-recent-path={f.path}
   233	                  {...fileDragHandlers(f.path)}
   234	                  onClick={() => openRecent(f.path)}
   235	                  className="rounded-lg border border-[var(--app-border)] p-4 text-left hover:border-[var(--app-border-strong)] hover:bg-[var(--app-sunken)]"
   236	                >
   237	                  <div className="mb-1.5 flex items-center gap-2">
   238	                    <Icon
   239	                      name={iconOfType(fileTypeOf(f.path))}
   240	                      size={18}
   241	                      color={TYPE_COLORS[fileTypeOf(f.path)]}
   242	                    />
   243	                    <span className="truncate text-sm font-medium text-[var(--app-text)]">
   244	                      {f.title}
   245	                    </span>
   246	                  </div>
   247	                  <p className="mb-1 line-clamp-2 h-8 text-xs text-[var(--app-text-3)]">
   248	                    {f.excerpt || "（还没有内容）"}
   249	                  </p>
   250	                  <div className="flex items-center justify-between text-[11px] text-[var(--app-text-3)]">
   251	                    <span className="truncate">{parentOf(f.path)}</span>
   252	                    <span className="shrink-0">
   253	                      {relativeTime(f.openedAt)}
   254	                      {percentOf(f.path) > 0 && (
   255	                        <span data-card-progress={f.path}>
   256	                          {" · 已读 "}
   257	                          {percentOf(f.path)}%
   258	                        </span>
   259	                      )}
   260	                    </span>
   261	                  </div>
   262	                </button>
   263	              ))}
   264	            </div>
   265	          </section>
   266	
   267	          <section className="mb-8">
   268	            <h2 className="mb-3 text-xs font-medium text-[var(--app-text-2)]">
   269	              按类型
   270	            </h2>
   271	            <div
   272	              data-testid="portal-tiles"
   273	              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
   274	            >
   275	              {TILES.map((tile) => (
   276	                <button
   277	                  key={tile.kind}
   278	                  data-tile-kind={tile.kind}
   279	                  onClick={() => {
   280	                    setGridTypeFilter(tile.kind);
   281	                    setGridQuery("");
   282	                    setGridPinnedOnly(false);
   283	                    setGridSelectedPath(null);
   284	                    setScene("grid");
   285	                  }}
   286	                  className="flex items-center gap-2 rounded border border-[var(--app-border)] px-3 py-2 text-xs hover:bg-[var(--app-sunken)]"
   287	                >
   288	                  <Icon
   289	                    name={iconOfType(tile.kind)}
   290	                    size={18}
   291	                    color={TYPE_COLORS[tile.kind]}
   292	                  />
   293	                  <span className="text-[var(--app-text)]">{tile.label}</span>
   294	                  <span className="ml-auto text-[var(--app-text-3)]">
   295	                    {counts.get(tile.kind) ?? 0}
   296	                  </span>
   297	                </button>
   298	              ))}
   299	            </div>
   300	          </section>
   301	        </>
   302	      )}
   303	
   304	      <section className="mb-8">
   305	        <h2 className="mb-3 text-xs font-medium text-[var(--app-text-2)]">

exec
/bin/zsh -c "nl -ba src/components/QuickOpen.tsx | sed -n '228,335p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   228	          {groups.map((group) => (
   229	            <section
   230	              key={group.kind}
   231	              data-quick-group={group.kind}
   232	              className="mb-1 last:mb-0"
   233	            >
   234	              <h3 className="px-3 py-1 text-[11px] font-medium text-[var(--app-text-3)]">
   235	                {group.label}
   236	              </h3>
   237	              {group.items.map((item) => {
   238	                const index = indexByKey.get(item.key) ?? 0;
   239	                const isActive = index === active;
   240	                const icon =
   241	                  item.kind === "command"
   242	                    ? item.icon
   243	                    : iconOfType(fileTypeOf(item.path));
   244	                const color =
   245	                  item.kind === "command"
   246	                    ? "var(--app-accent)"
   247	                    : colorOfType(fileTypeOf(item.path));
   248	                return (
   249	                  <button
   250	                    key={item.key}
   251	                    type="button"
   252	                    data-testid="quick-open-row"
   253	                    data-quick-kind={item.kind}
   254	                    data-quick-id={item.key}
   255	                    data-active={isActive ? "true" : "false"}
   256	                    aria-current={isActive ? "true" : undefined}
   257	                    onMouseEnter={() => setSelection({ query, index })}
   258	                    onClick={() => runItem(item)}
   259	                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--app-text)] ${
   260	                      isActive ? "bg-[var(--app-accent-soft)]" : ""
   261	                    }`}
   262	                  >
   263	                    <Icon name={icon} size={18} color={color} />
   264	                    <span className="min-w-0 flex-1 truncate">
   265	                      <Highlight
   266	                        text={item.kind === "command" ? item.label : item.title}
   267	                        query={query}
   268	                      />
   269	                    </span>
   270	                    {item.kind === "command" && (
   271	                      <kbd className="shrink-0 rounded border border-[var(--app-border)] bg-[var(--app-sunken)] px-1.5 py-0.5 text-[11px] text-[var(--app-text-3)]">
   272	                        {item.hint}
   273	                      </kbd>
   274	                    )}
   275	                    {item.kind !== "command" && item.path && (
   276	                      <span className="shrink-0 text-[11px] text-[var(--app-text-3)]">
   277	                        {item.path}
   278	                      </span>
   279	                    )}
   280	                  </button>
   281	                );
   282	              })}
   283	            </section>
   284	          ))}
   285	        </div>
   286	      </div>
   287	    </div>
   288	  );
   289	}

exec
/bin/zsh -c "nl -ba docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md | sed -n '1,220p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# 文档发现与插件展示方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 4 项——重做文档发现操作方案（便捷直观、有设计感）+ 插件展示策略
     5	> 事实基线（已校正）：`src-tauri/src/config.rs`、`src-tauri/src/commands/recent.rs`、`src-tauri/src/commands/search.rs`、`src/lib/railView.ts`、`src/components/Rail/ReadingRail.tsx`、`src/components/Grid/GridToolbar.tsx`、`src/lib/gridView.ts`、`src/components/Grid/GridTile.tsx`、`src/stores/index.ts`、`src/components/PortalView.tsx`、`src/components/QuickOpen.tsx`、`src/lib/quickOpen.ts`、`src/App.tsx`、`docs/research/technical/plugin-management-benchmark.md`
     6	
     7	## 1. 背景与目标
     8	
     9	当前文档发现靠阅读空间左边栏和网格概览，用户反馈「找不到想看的文档」。目标是重做文档发现操作方案，做到**便捷直观、有设计感**，并确定插件如何展示在窗口（或不单独展示、怎么操作。
    10	
    11	## 2. 诊断（已按事实重写）
    12	
    13	### 2.1 现状盘点：能力已存在，问题在入口分工
    14	
    15	**左边栏已具备四段结构 + 全文搜索**（方案原诊断「左边栏以文件名/时间为主轴、记得内容时没有路径」与事实不符）：
    16	
    17	- `RAIL_SECTIONS = [now, pinned, recent, category]`（`railView.ts:55-71`）——「现在（正在阅读）/收藏/最近/分类」四段已存在。
    18	- **内置本机全文搜索**（`ReadingRail.tsx:972-998`）：去抖 300ms 后 `invoke("search_documents")`，已落地搜索框、命中数、时间过滤、清空全套 UI。
    19	
    20	**网格概览已有搜索/排序/分组/过滤**（方案原称「有设计感但定位弱」无证据，且低估了网格能力）：
    21	
    22	- 搜索框（`GridToolbar.tsx:194-209`）、排序（最近/名称/类型，`gridView.ts:14-25`）、分组（时间/类型/主题/不分组，`:27-32`）、类型过滤、仅看收藏（`stores/index.ts:447-451`）。
    23	- 卡片含缩略图 + 真摘要（`GridTile.tsx:162-165,309-314`）。
    24	- **注**：网格的「主题」分组是**按父目录**（`gridView.ts:121` 注释「theme = 父目录」），不是标签。
    25	
    26	**门户是默认落地场景**（方案原遗漏）：
    27	
    28	- 初始 `scene: "portal"`（`stores/index.ts:445`），`App.tsx:977` 渲染 `PortalView`（继续阅读 hero + 最近富卡 + 8 类磁贴 + 快速动作），门户底部自带「⌘P 搜索全部」提示（`PortalView.tsx:348`）。**门户才是用户打开应用的第一发现面**。
    29	
    30	**⌘P 已存在但能力有限**（方案原称「已有需强化」被低估）：
    31	
    32	- `QuickOpen.tsx` + `quickOpen.ts` 已存在，但过滤**仅 title+path 大小写不敏感子串匹配**（`quickOpen.ts:8-9,36,47-65`），条目仅三类：页签 / 最近文件 / 两个命令（网格、设置）（`QuickOpen.tsx:32-38`）。**无内容搜索、无标签搜索、无收藏分组**。
    33	- `search_documents` 扫描的是**整个 home 目录**（`search.rs:240,261-272`，跳过 heavy dir）。
    34	
    35	### 2.2 真实问题
    36	
    37	诊断修正为：
    38	
    39	1. **⌘P 仅做标题子串过滤，不能按内容直达**——真正的差距在这里，而非左边栏路径缺失。
    40	2. **发现入口层级与分工未定义**——门户 / 左边栏搜索 / 网格搜索 / ⌘P / 编辑器内搜索（⌘F，`App.tsx:614`）**五处并存**，各入口范围与结果是否一致、谁主谁辅，零讨论。这是「发现路径单一」诊断自己制造的新混乱。
    41	
    42	**用户反馈引用**：仓库内可查的近期反馈是 issue #897（视觉缺陷：网格缩略图取帧、卡片重叠、表格边距），**非「找不到文档」**。本方案将「找不到文档」降级为**待验证假设**，与 #897 这类视觉反馈区分开。
    43	
    44	## 3. 发现入口分工（新增，必补）
    45	
    46	定义五处入口的边界，避免变体 A 制造入口冗余：
    47	
    48	| 入口 | 作用域 | 定位 | 键位 |
    49	|---|---|---|---|
    50	| **门户** | 全局发现 | 默认落地场景，继续阅读 + 快速动作 + ⌘P 提示 | 无（默认场景） |
    51	| **⌘P（快速打开）** | **全局发现主入口** | 跨页签/最近/命令 +（升级后）内容搜索 | ⌘P（`shortcuts.ts:66-76`） |
    52	| **左边栏搜索** | 阅读空间场景内 | 阅读空间文档内的过滤 | ⌘\（`shortcuts.ts:82-88`） |
    53	| **网格搜索** | 网格场景内 | 网格文档内的过滤 | ⌘⇧\（`shortcuts.ts:106-112`） |
    54	| **⌘F** | 文档内定位 | 当前文档内的文本定位 | ⌘F（`App.tsx:614`） |
    55	
    56	**分工原则**：⌘P = 全局发现主入口；⌘F = 文档内定位；左边栏/网格搜索 = 对应场景内的过滤。各入口结果范围需一致或明确标注，不重叠混淆。
    57	
    58	## 4. 文档发现操作方案（变体）
    59	
    60	### 变体 A：搜索提升为发现主入口（推荐，但增量需重新定义）
    61	
    62	**增量澄清（已校正）**：方案原称的「双轨侧栏（收藏+最近）」**已是现状**（`RAIL_SECTIONS` 已含 pinned/recent），**不是新增**。变体 A 的真正变更只有：
    63	
    64	1. **⌘P 接入内容搜索**：从同步子串过滤（title+path）改为**异步全文检索**（复用 `search_documents`）+ 多分组面板（页签/最近/收藏/命中文档）。
    65	2. **收藏分组**：⌘P 面板内增加收藏分组入口。
    66	3. **键位/入口层级调整**：按 §3 分工明确 ⌘P 为主入口。
    67	
    68	**搜索范围决策（必补，原方案缺失）**：
    69	
    70	- `search_documents` 默认扫整个 home，若 ⌘P 直接接，**每键触发全盘扫描**，且可能命中阅读空间之外的文件（语义不符）。
    71	- **建议**：⌘P 内容搜索**限定范围**——限定为「最近库 + 阅读空间内的文档」，而非全盘 home。理由：① 发现目标是阅读空间文档，全盘命中语义不符；② 避免每键全扫的性能问题。
    72	- **异步加载态**：⌘P 从同步变异步，需设计加载态（去抖沿用 300ms 先例 + `spawn_blocking`，左边栏搜索已有先例）。
    73	
    74	**成本修正**：⌘P 内容搜索是**功能重构而非强化**（同步子串 → 异步全文 + 多分组面板），实现成本高于原方案判断。
    75	
    76	### 变体 B：空间地图 + 标签分簇（备选，成本高）
    77	
    78	**数据基础修正（原方案误判）**：变体 B 的「frontmatter 标签」数据基础**当前不存在**——`RecentFile` 只有 path/title/openedAt/excerpt（`src/types/index.ts:178-184`），**无标签模型、无标签索引**，frontmatter 解析是通用 YAML、无 tags 字段约定。网格现有「主题」分组是按父目录，不是标签。
    79	
    80	**变体 B 需补齐的成本清单**：
    81	
    82	1. **标签数据模型**：在 `RecentFile` 或扫描层新增标签字段（无现存字段）。
    83	2. **标签抽取管线**：从 frontmatter 抽取 tags 并建索引。
    84	3. **可缩放空间地图 + 时间轴叠加**：全新交互组件；且网格当前是整屏场景覆盖层（`App.tsx:997-999`），改造是**新建场景**而非升级网格。
    85	4. **与网格 theme 分组的重合度**：评估「按目录分簇」与网格现有 theme 分组是否重复建设。
    86	
    87	**决策**：变体 B 成本被系统性低估，保留为备选。**上马判据**：当标签数据模型与抽取管线落地后，再评估地图组件的投入产出；否则不上马。
    88	
    89	### 变体 C：智能推荐 / 语义检索（备选，保留）
    90	
    91	**现状修正**：变体 C 的前提是「文件无结构化元数据、纯文本检索」，但**左边栏已有全文搜索、网格已有分组**，语义检索的增量价值需重新论证——除非引入向量检索或阅读行为学习，否则与已有全文搜索重叠。
    92	
    93	**定位**：保留为备选，自评冷启动与算法投入成本高。
    94	
    95	### 变体对比（修订后）
    96	
    97	| 维度 | 变体 A（搜索主入口） | 变体 B（空间地图+标签） | 变体 C（语义推荐） |
    98	|---|---|---|---|
    99	| 新颖度 | ⌘P 内容搜索是真增量（其余是已有） | 高（地图是全新组件） | 中（依赖算法） |
   100	| 成本 | 中高（⌘P 重构+范围限定+异步态） | 高（标签模型+管线+地图组件） | 高（冷启动+算法） |
   101	| 数据基础 | 已有（`search_documents`） | **缺失**（需建标签模型） | 部分（全文搜索已有，语义需补） |
   102	| 便捷直观 | 高（键盘直达） | 中（空间交互需学习） | 中 |
   103	| 设计感 | 中高 | 高 | 中 |
   104	
   105	**推荐**：**变体 A 为主**，但需先落地 §3 入口分工与搜索范围限定；变体 B 在标签数据基础补齐后再评估。
   106	
   107	## 5. 插件展示策略（已按术语校正）
   108	
   109	### 5.1 前提校正
   110	
   111	**「第 1 项会提取出较多插件」不成立**：01 号文档 A 档用户可见插件仅 4 项（片段/模板/theme.toml/SKILL.md 包），B 档目前还是代码常量、需另立批次文件化。展示策略不建立在「插件很多」的夸大前提上。
   112	
   113	### 5.2 展示方向（保留，对齐 benchmark 与产品信条）
   114	
   115	**不常驻主窗口 + 能力就近 + 设置集中管理**——与 `plugin-management-benchmark.md`（第三、四节「插件管理入口放设置深处，无常驻 UI，零弹窗」「大而全的插件管理 UI 与信条冲突」）及产品信条一致，方向保留。
   116	
   117	### 5.3 操作入口（已按生命周期定义校正）
   118	
   119	**「启停/卸载」是数据包型插件（A4，`.disabled` 标记）专属的生命周期**；数据文件型插件（A1–A3）是「删文件即卸载」，无启停概念（01 号文档 §5.1 已写明）。操作入口按插件类型分：
   120	
   121	| 插件类型 | 操作入口 | 操作 |
   122	|---|---|---|
   123	| 数据包型（A4） | 设置内插件分类 | 启停 / 卸载（`.disabled` 标记） |
   124	| 数据文件型（A1–A3） | 设置内插件分类（清单查看） | **删文件即卸载**；设置内提供清单查看入口 |
   125	
   126	### 5.4 可发现性（补充，原方案未回答）
   127	
   128	原方案只解决「操作」不解决「发现」。**可发现性处理**：设置内插件分类的清单即发现入口（用户可在设置中浏览有哪些插件能力）；或对齐数据文件目录约定，用户通过目录结构感知能力。不新增常驻 UI，避免与「零弹窗、无常驻」信条冲突。
   129	
   130	## 6. 原型设计方向
   131	
   132	原型需覆盖：
   133	
   134	1. **变体 A 的 ⌘P 升级面板**：内容搜索 + 多分组（页签/最近/收藏/命中）+ 加载态。
   135	2. **§3 入口分工的视觉呈现**：门户 / 左边栏 / 网格 / ⌘P / ⌘F 的边界示意。
   136	3. **门户纳入对比**：原型对比建议改为「变体 A 与门户改造」或说明门户去留（原方案只并排 A/B，漏了最高曝光面门户）。
   137	4. **插件展示**：设置内插件分类清单（数据包型启停 + 数据文件型清单查看）。
   138	
   139	## 7. 边界（保留）
   140	
   141	- **不动编辑器核心**：CM6 编辑器 undo/选区/编辑状态不变（AGENTS.md 硬约束）。
   142	- **不新建窗口机制**：文档发现在现有窗口内完成，不新建独立窗口。
   143	- **搜索范围限定**：⌘P 内容搜索限定阅读空间/最近库，不扫全盘 home（见变体 A）。
   144	
   145	## 8. 对抗评审记录
   146	
   147	**评审方**：独立只读评审子代理（注：用户指定 codex CLI，实测 codex 未登录且登录进行中；为不阻塞，先以独立评审子代理完成对抗评审，codex 登录完成后补跑）。
   148	
   149	**总体判定**：需修订（已按意见全部修订）。
   150	
   151	**主要意见与处置**：
   152	
   153	1. **事实基线错误（state.rs 不存在）**：`recentFiles/scrollPositions` 实际在 `config.rs`（字段 `:37-41`、序列化 `:434-453`、落盘 `:998`）+ `commands/recent.rs` → 已采纳，§顶部事实基线校正。
   154	2. **诊断失实**：左边栏已有四段+全文搜索、网格已有搜索/排序/分组、门户被遗漏 → 已采纳，§2 诊断重写，§3 补门户与五入口分工。
   155	3. **⌘P 被低估**：内容搜索是重构非强化，搜索范围与异步方案缺失 → 已采纳，变体 A 重新定义增量 + 搜索范围限定 + 异步加载态。
   156	4. **变体 B 数据基础不存在**：无标签模型/索引 → 已采纳，变体 B 补成本清单 + 上马判据。
   157	5. **插件章术语矛盾**：「较多插件」不成立；「启停/卸载」应限定数据包型 → 已采纳，§5 前提校正 + 操作入口按类型分。
   158	6. **用户反馈无出处**：#897 是视觉缺陷 → 已采纳，§2 降级为待验证假设。
   159	7. **搜索入口重叠未处理**：五处并存 → 已采纳，§3 新增入口分工。
   160	
   161	**可保留**：「搜索提升为发现主入口」方向；变体 C 备选定位；§4.1 插件「不常驻主窗口、能力就近、设置集中管理」方向；§6 边界。
   162	
   163	**需重新论证**：「变体 A 为主方案」的结论——需在诊断与成本修正后重新评估，已据实重新定义增量。

exec
/bin/zsh -c "rg -n \"issue #897|#897|897\" docs src .github -g '*.md' -g '*.ts' -g '*.tsx' -g '*.yml' -g '*.yaml' 2>/dev/null | head -n 100" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/requirements/editor-surface-batch20/requirements.md:3:- spec issue: https://github.com/jianxi-dev/clairis/issues/897
docs/requirements/editor-surface-batch20/requirements.md:75:- 用户反馈：2026-11-15 提交的 28 项（14 缺陷 + 14 优化），父规格票 spec issue #897（https://github.com/jianxi-dev/clairis/issues/897）。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:42:**用户反馈引用**：仓库内可查的近期反馈是 issue #897（视觉缺陷：网格缩略图取帧、卡片重叠、表格边距），**非「找不到文档」**。本方案将「找不到文档」降级为**待验证假设**，与 #897 这类视觉反馈区分开。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:158:6. **用户反馈无出处**：#897 是视觉缺陷 → 已采纳，§2 降级为待验证假设。

exec
/bin/zsh -c "git log -1 --format='%H %ad %s' --date=iso-strict -- docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md; git log --oneline --all --grep='897' -20" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 208ms:
0e42d9e docs(learn): batch20 会话经验（打印截断/子代理隔离/e2e 判据/看板编号） (#929)
a80d16f docs(learn): batch20 会话经验（打印截断/子代理隔离/e2e 判据/看板编号）
82ef9a6 docs(change): editor-surface-batch20 规格制品与 29 张子票拆票 (#927)
a35ff85 docs(change): editor-surface-batch20 规格制品与 29 张子票拆票
4e3d62d test(e2e): E1b 全量验收（红线 1/5 + CSS manifest 扫描根扩到 src/editors）(#99) (#101)
b91bdf7 test(e2e): E1b 全量验收（红线 1/5 + CSS manifest 扫描根扩到 src/editors）(#99)
d806798 [change=md-orchestration/1.4] 浮层统一摆放与共享色板 (#98)
16c3527 test(e2e): E1b 全量验收（红线 1/5 + CSS manifest 扫描根扩到 src/editors）(#99)
d2569d7 feat(editor): 浮层统一摆放与共享色板（E1b 1.4）(#97)

exec
/bin/zsh -c "rg -n \"namespace|tag|tags|frontmatter\" src-tauri/src src/lib src/types -g '*.rs' -g '*.ts' -g '*.tsx' | head -n 180" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/types/index.ts:163:  /** frontmatter title 优先，缺省为文件名 */
src-tauri/src/extensions.rs:41:/// frontmatter 值：标量或字符串列表。
src-tauri/src/extensions.rs:127:/// 解析单个 snippet 文件。成功返回 `Some`，失败（缺 id / 非法 frontmatter /
src-tauri/src/extensions.rs:139:        warnings.push(format!("{rel}: 缺少 frontmatter（未以 --- 开头）"));
src-tauri/src/extensions.rs:144:    // 收集 frontmatter 行直到闭合 `---`。
src-tauri/src/extensions.rs:161:        warnings.push(format!("{rel}: frontmatter 未闭合"));
src-tauri/src/extensions.rs:170:            warnings.push(format!("{rel}: 无法解析 frontmatter 行 {line:?}"));
src-tauri/src/extensions.rs:384:    fn temp_dir(tag: &str) -> tempfile::TempDir {
src-tauri/src/extensions.rs:386:            .prefix(&format!("biaoyue_ext_{tag}_"))
src-tauri/src/extensions.rs:460:    fn invalid_frontmatter_is_skipped() {
src-tauri/src/extensions.rs:464:        write_file(base, "snippets/a.md", "id: no-frontmatter\n---\n正文\n");
src-tauri/src/extensions.rs:481:            .any(|w| w.contains("缺少 frontmatter")));
src/lib/outline.ts:61:      level: Number(node.tagName[1]),
src/lib/frontmatter.ts:4: * 文档 frontmatter 解析 / 序列化（doc-property-panel 功能一）。
src/lib/frontmatter.ts:83: * `tagColor` 的返回值直接索引本表——顺序不可调整。
src/lib/frontmatter.ts:148:export function tagColor(name: string): number {
src/lib/frontmatter.ts:168:  tags: ["标签"],
src/lib/frontmatter.ts:180:  tags: "array",
src/lib/frontmatter.ts:476: * - 无 frontmatter 时在文档首部新建 `--- ... ---` 块。
src/lib/frontmatter.ts:538: * 用 `new Pair` 插到指定位置。无 frontmatter 时退化为新建块（同 writeFrontmatter）。
src/lib/frontmatter.ts:612:/** 行标识：字段在 `fields` 中的下标，或伪字段 `"tags"`（标签行）。 */
src/lib/frontmatter.ts:613:export type FrontmatterRowId = number | "tags";
src/lib/frontmatter.ts:723:  if (!parsed.present) return { ok: false, reason: "文档没有 frontmatter" };
src-tauri/src/commands/file.rs:751:    fn temp_dir(tag: &str) -> std::path::PathBuf {
src-tauri/src/commands/file.rs:752:        let dir = std::env::temp_dir().join(format!("biaoyue-media-{tag}-{}", std::process::id()));
src-tauri/src/commands/file.rs:810:    fn temp_dir(tag: &str) -> std::path::PathBuf {
src-tauri/src/commands/file.rs:812:            std::env::temp_dir().join(format!("biaoyue-media-bytes-{tag}-{}", std::process::id()));
src-tauri/src/commands/capture.rs:113:/// 块是否属于给定 time_key 的条目：行级解析 frontmatter 的 time 行并编码比较。
src-tauri/src/commands/capture.rs:250:        let frontmatter = parts.next().unwrap_or("");
src-tauri/src/commands/capture.rs:252:        // split("---\ntime: ") 已吞掉 "time: " 前缀：frontmatter 第一行即为 time 值；
src-tauri/src/commands/capture.rs:254:        let mut lines = frontmatter.lines();
src/lib/export/docx.ts:1:// 导出 Word：剥离 frontmatter → 组装 files Map → vendor toDocx → base64 → 主进程写盘。
src-tauri/src/commands/recent.rs:101:pub(crate) fn strip_html_tags(html: &str) -> String {
src-tauri/src/commands/recent.rs:113:        let (close, tag_len) = if after.starts_with("<script") {
src-tauri/src/commands/recent.rs:120:        if tag_len > 0 {
src-tauri/src/commands/recent.rs:144:fn read_excerpt(path: &Path, strip_tags: bool) -> Option<String> {
src-tauri/src/commands/recent.rs:150:    let mut text = if strip_tags {
src-tauri/src/commands/recent.rs:151:        strip_html_tags(&raw)
src-tauri/src/commands/recent.rs:227:    fn temp_home(tag: &str) -> PathBuf {
src-tauri/src/commands/recent.rs:229:            .prefix(&format!("biaoyue_recent_{tag}_"))
src/lib/railCards.ts:79: * HTML 摘要与本机最近文件摘要共用，保证卡片不露 `<tag>` 源码。
src-tauri/src/commands/search.rs:9:use crate::commands::recent::{is_heavy_dir, is_html, strip_html_tags, to_iso8601};
src-tauri/src/commands/search.rs:31:    /// frontmatter title 优先，缺省用文件名。
src-tauri/src/commands/search.rs:80:/// 取 YAML frontmatter 里的 `title:`（不含引号）。无 frontmatter 或无 title 时返回 None。
src-tauri/src/commands/search.rs:81:fn frontmatter_title(text: &str) -> Option<String> {
src-tauri/src/commands/search.rs:110:        let text = strip_html_tags(inner).trim().to_string();
src-tauri/src/commands/search.rs:192:        strip_html_tags(&raw)
src-tauri/src/commands/search.rs:205:    let title = frontmatter_title(&raw).unwrap_or_else(|| filename.clone());
src-tauri/src/commands/search.rs:259:/// 本机全文检索：文件名 / frontmatter title / H1 / 正文，大小写不敏感，限量返回。
src-tauri/src/commands/search.rs:285:    fn temp_home(tag: &str) -> PathBuf {
src-tauri/src/commands/search.rs:287:            .prefix(&format!("biaoyue_search_{tag}_"))
src-tauri/src/commands/search.rs:359:    fn html_body_is_tag_stripped_before_match() {
src/lib/export/png.ts:99:    .replace(VOID_TAG, (m, tag: string, attrs: string) =>
src/lib/export/png.ts:100:      attrs.trimEnd().endsWith("/") ? m : `<${tag}${attrs}/>`,
src/lib/export/png.ts:104:      (_m, tag: string, attrs: string, slash: string) =>
src/lib/export/png.ts:105:        `<${tag}${fixBareAttrs(attrs)}${slash}>`,
src/lib/shortcuts.ts:524:    id: "local-tag-menu-pick",
src/lib/export/mdpkg.ts:41: * 组装包内文件：入口 Markdown 逐字保留（含 frontmatter），资产按原引用路径写入。
src-tauri/src/config.rs:1065:    fn temp_base(tag: &str) -> tempfile::TempDir {
src-tauri/src/config.rs:1067:            .prefix(&format!("biaoyue_config_{tag}_"))
src-tauri/src/ai_agent.rs:17:#[serde(tag = "kind", rename_all = "camelCase")]
src-tauri/src/ai_agent.rs:524:    fn temp_base(tag: &str) -> tempfile::TempDir {
src-tauri/src/ai_agent.rs:526:            .prefix(&format!("biaoyue_agent_{tag}_"))
src-tauri/src/extension_packages.rs:389:    let staging = extensions.join(format!(".tmp-{}-{}", manifest.id, short_hash(path)));
src-tauri/src/extension_packages.rs:390:    if staging.exists() {
src-tauri/src/extension_packages.rs:391:        let _ = std::fs::remove_dir_all(&staging);
src-tauri/src/extension_packages.rs:394:    let copy_result = copy_dir(&dir, &staging);
src-tauri/src/extension_packages.rs:396:        let _ = std::fs::remove_dir_all(&staging);
src-tauri/src/extension_packages.rs:405:    std::fs::rename(&staging, &target).map_err(|e| {
src-tauri/src/extension_packages.rs:407:            &format!("rename {} → {}", staging.display(), target.display()),
src-tauri/src/extension_packages.rs:869:    fn temp_base(tag: &str) -> tempfile::TempDir {
src-tauri/src/extension_packages.rs:871:            .prefix(&format!("biaoyue_extpkg_{tag}_"))

exec
/bin/zsh -c "nl -ba src/lib/frontmatter.ts | sed -n '135,195p;600,665p;700,755p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   135	    dark: ["#232a35", "#b3bfcf", "#38434f"],
   136	  },
   137	  {
   138	    name: "藤黄",
   139	    light: ["#fbf5df", "#854d0e", "#ecdfa8"],
   140	    dark: ["#383114", "#e0c96a", "#564b20"],
   141	  },
   142	];
   143	
   144	/**
   145	 * 标签名 → 色板索引（0..9）。FNV-1a（与定稿原型 `fnv1a` 同实现），
   146	 * 按名哈希、不按位置：同名同色，增删其他标签不改变既有标签的色值。
   147	 */
   148	export function tagColor(name: string): number {
   149	  let h = 0x811c9dc5;
   150	  for (let i = 0; i < name.length; i++) {
   151	    h ^= name.charCodeAt(i);
   152	    h = Math.imul(h, 0x01000193) >>> 0;
   153	  }
   154	  return h % TAG_PALETTE.length;
   155	}
   156	
   157	/** 自动托管的创建 / 修改日期键：只读、键名锁定（P-6）。 */
   158	export function isManagedDateKey(key: string): boolean {
   159	  return key === "created" || key === "updated";
   160	}
   161	
   162	/**
   163	 * 别称表（P-6，应用级预设）：规范键 → 中文 / 英文别称。
   164	 * 仅用于类型识别，不改写显示名、不重命名 YAML 键。
   165	 */
   166	export const ALIAS: Readonly<Record<string, readonly string[]>> = {
   167	  title: ["标题"],
   168	  tags: ["标签"],
   169	  category: ["分类"],
   170	  author: ["作者"],
   171	  status: ["状态"],
   172	  date: ["日期"],
   173	  createdate: ["创建日期"],
   174	  updatedate: ["更新日期"],
   175	};
   176	
   177	/** 别称规范键 → 类型（与 ALIAS 的键一一对应）。 */
   178	export const CANON_TYPE: Readonly<Record<string, FrontmatterType>> = {
   179	  title: "text",
   180	  tags: "array",
   181	  category: "select",
   182	  author: "text",
   183	  status: "select",
   184	  date: "date",
   185	  createdate: "date",
   186	  updatedate: "date",
   187	};
   188	
   189	/**
   190	 * 命中别称表则返回对应类型，未命中返回 null（P-6：只赋类型，不改名）。
   191	 * 大小写不敏感，键与全部别称都要匹配。
   192	 */
   193	export function resolveAlias(key: string): FrontmatterType | null {
   194	  const k = key.trim().toLowerCase();
   195	  for (const canon of Object.keys(ALIAS)) {
   600	  } catch {
   601	    nextInner = YAML.stringify(
   602	      Object.fromEntries(fields.map((f) => [f.key, f.value])),
   603	    );
   604	  }
   605	
   606	  const block =
   607	    parsed.openLine + "\n" + nextInner + parsed.closeLine + parsed.trailing;
   608	  const text = doc.slice(0, parsed.start) + block + doc.slice(parsed.end);
   609	  return { text, from: parsed.start, to: parsed.end, block };
   610	}
   611	
   612	/** 行标识：字段在 `fields` 中的下标，或伪字段 `"tags"`（标签行）。 */
   613	export type FrontmatterRowId = number | "tags";
   614	
   615	/**
   616	 * 整块移动：把 `indices`（升序去重）指定的字段作为整块移动到 `targetIndex`。
   617	 * `targetIndex` 以**移除前**的间隙下标解释（0..fields.length）；落在被移除
   618	 * 块之后时自动前移块长。返回新数组，块内相对顺序保持不变。
   619	 */
   620	export function moveFieldBlock(
   621	  fields: readonly FrontmatterField[],
   622	  indices: readonly number[],
   623	  targetIndex: number,
   624	): FrontmatterField[] {
   625	  const idx = [
   626	    ...new Set(
   627	      indices.filter((i) => Number.isInteger(i) && i >= 0 && i < fields.length),
   628	    ),
   629	  ].sort((a, b) => a - b);
   630	  if (idx.length === 0) return [...fields];
   631	
   632	  const selected = new Set(idx);
   633	  const block = idx.map((i) => fields[i]);
   634	  const rest = fields.filter((_, i) => !selected.has(i));
   635	  const removedBefore = idx.filter((i) => i < targetIndex).length;
   636	  const to = Math.max(0, Math.min(rest.length, targetIndex - removedBefore));
   637	  return [...rest.slice(0, to), ...block, ...rest.slice(to)];
   638	}
   639	
   640	/**
   641	 * 键名去重：返回 `base`；若与 `existingKeys` 冲突则依次尝试 `base-2`、
   642	 * `base-3`…（P-4 粘贴键名自动追加序号）。
   643	 */
   644	export function uniqueKey(
   645	  base: string,
   646	  existingKeys: Iterable<string>,
   647	): string {
   648	  const taken = new Set(existingKeys);
   649	  if (!taken.has(base)) return base;
   650	  let n = 2;
   651	  while (taken.has(`${base}-${n}`)) n += 1;
   652	  return `${base}-${n}`;
   653	}
   654	
   655	/**
   656	 * 列表内部键名去重：保留首个原键名，后续同名按 `base`、`base-2`… 顺延。
   657	 */
   658	export function dedupeKeys<T extends { key: string }>(
   659	  fields: readonly T[],
   660	): T[] {
   661	  const taken = new Set<string>();
   662	  return fields.map((f) => {
   663	    const key = uniqueKey(f.key, taken);
   664	    taken.add(key);
   665	    return key === f.key ? f : { ...f, key };
   700	}
   701	
   702	export type RenameFrontmatterResult =
   703	  ({ ok: true } & FrontmatterWriteResult) | { ok: false; reason: string };
   704	
   705	const RENAME_ILLEGAL_RE = /[:#\r\n]/;
   706	
   707	/**
   708	 * 字段改名（P-6）：改 YAML 键、保持键序位置与值，自由键 / 注释不丢。
   709	 * 重名或非法键名返回 `ok:false` + 中文原因；同名提交视为无改动。
   710	 */
   711	export function renameFrontmatterField(
   712	  doc: string,
   713	  fromKey: string,
   714	  toKey: string,
   715	): RenameFrontmatterResult {
   716	  const next = toKey.trim();
   717	  if (next === "") return { ok: false, reason: "字段名不能为空" };
   718	  if (RENAME_ILLEGAL_RE.test(next)) {
   719	    return { ok: false, reason: "字段名不能包含 : 或 # 等字符" };
   720	  }
   721	
   722	  const parsed = parseFrontmatter(doc);
   723	  if (!parsed.present) return { ok: false, reason: "文档没有 frontmatter" };
   724	
   725	  const idx = parsed.fields.findIndex((f) => f.key === fromKey);
   726	  if (idx === -1) return { ok: false, reason: "字段不存在" };
   727	  if (next === fromKey) {
   728	    return {
   729	      ok: true,
   730	      text: doc,
   731	      from: parsed.start,
   732	      to: parsed.end,
   733	      block: parsed.block,
   734	    };
   735	  }
   736	  if (parsed.fields.some((f, i) => i !== idx && f.key === next)) {
   737	    return { ok: false, reason: `字段名「${next}」与已有键重名` };
   738	  }
   739	
   740	  let nextInner: string;
   741	  try {
   742	    const ast = YAML.parseDocument(parsed.inner);
   743	    const map = ast.contents as YAML.YAMLMap | null;
   744	    let renamed = false;
   745	    if (map && Array.isArray(map.items)) {
   746	      for (const pair of map.items) {
   747	        const k = pair.key as unknown;
   748	        const kv =
   749	          k && typeof k === "object" && "value" in k
   750	            ? String((k as { value: unknown }).value)
   751	            : String(k);
   752	        if (kv !== fromKey) continue;
   753	        if (k && typeof k === "object" && "value" in k) {
   754	          (k as { value: unknown }).value = next;
   755	        } else {

exec
/bin/zsh -c "rg -n \"tags\" src/components/Content/DocPropertyBar.tsx src/lib/frontmatter.ts src/renderers src -g '*.ts' -g '*.tsx' | head -n 160" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/frontmatter.ts:168:  tags: ["标签"],
src/lib/frontmatter.ts:180:  tags: "array",
src/lib/frontmatter.ts:612:/** 行标识：字段在 `fields` 中的下标，或伪字段 `"tags"`（标签行）。 */
src/lib/frontmatter.ts:613:export type FrontmatterRowId = number | "tags";
src/components/Content/DocPropertyBar.tsx:668:    <span className="dpb-tags-group">
src/components/Content/DocPropertyBar.tsx:857:  const tags = Array.isArray(field.value) ? field.value.map(String) : [];
src/components/Content/DocPropertyBar.tsx:872:      const tagsField = parsed.fields.find(
src/components/Content/DocPropertyBar.tsx:873:        (f) => f.key === "tags" && Array.isArray(f.value),
src/components/Content/DocPropertyBar.tsx:875:      if (!tagsField) continue;
src/components/Content/DocPropertyBar.tsx:876:      for (const value of tagsField.value as unknown[]) {
src/components/Content/DocPropertyBar.tsx:898:      merged.length === tags.length &&
src/components/Content/DocPropertyBar.tsx:899:      merged.every((v, i) => v === tags[i])
src/components/Content/DocPropertyBar.tsx:909:    commit([...tags, value]);
src/components/Content/DocPropertyBar.tsx:915:    commit(tags.filter((t) => t !== name));
src/components/Content/DocPropertyBar.tsx:924:    commit(tags.map((t) => (t === old ? next : t)));
src/components/Content/DocPropertyBar.tsx:969:    commit([...tags, ...parseTagListText(text)]);
src/components/Content/DocPropertyBar.tsx:975:    <span className="dpb-tags-editor" ref={wrapRef}>
src/components/Content/DocPropertyBar.tsx:976:      <span className="dpb-tags-group">
src/components/Content/DocPropertyBar.tsx:977:        {tags.map((tag) =>
src/components/Content/DocPropertyBar.tsx:1247:  const tagsField =
src/components/Content/DocPropertyBar.tsx:1248:    fields.find((f) => f.key === "tags" && Array.isArray(f.value)) ?? null;
src/components/Content/DocPropertyBar.tsx:1249:  const rest = fields.filter((f) => f !== titleField && f !== tagsField);
src/components/Content/DocPropertyBar.tsx:1253:  const tagsIdx = tagsField ? fields.indexOf(tagsField) : -1;
src/components/Content/DocPropertyBar.tsx:1288:      fields.map((_, i) => i).filter((i) => i !== titleIdx && i !== tagsIdx),
src/components/Content/DocPropertyBar.tsx:1290:  }, [fields, titleIdx, tagsIdx, applySelection]);
src/components/Content/DocPropertyBar.tsx:1297:      const wantsTags = selectedRef.current.has("tags") && tagsIdx >= 0;
src/components/Content/DocPropertyBar.tsx:1298:      const idxs = wantsTags ? [...nums, tagsIdx] : nums;
src/components/Content/DocPropertyBar.tsx:1305:        const ti = next.findIndex((f) => f.key === "tags");
src/components/Content/DocPropertyBar.tsx:1310:    [fields, tagsIdx, numericSelected, commitFields],
src/components/Content/DocPropertyBar.tsx:1332:    const wantsTags = selectedRef.current.has("tags") && tagsIdx >= 0;
src/components/Content/DocPropertyBar.tsx:1337:      const ti = next.findIndex((f) => f.key === "tags");
src/components/Content/DocPropertyBar.tsx:1341:  }, [fields, titleIdx, tagsIdx, numericSelected, commitFields]);
src/components/Content/DocPropertyBar.tsx:1363:    return raw === "tags" ? "tags" : Number(raw);
src/components/Content/DocPropertyBar.tsx:1371:    ).filter((el) => el.getAttribute("data-row-id") !== "tags");
src/components/Content/DocPropertyBar.tsx:1568:              const rowId: FrontmatterRowId = field === tagsField ? "tags" : i;
src/components/Content/DocPropertyBar.tsx:1600:                    {field === tagsField ? (
src/components/Content/DocPropertyBar.tsx:1736:            {tagsField && (
src/components/Content/DocPropertyBar.tsx:1738:                className={`dpb-chip${selected.has("tags") ? " dpb-row-selected" : ""}`}
src/components/Content/DocPropertyBar.tsx:1740:                data-key="tags"
src/components/Content/DocPropertyBar.tsx:1741:                data-row-id="tags"
src/components/Content/DocPropertyBar.tsx:1748:                    onPointerDown={(e) => onHandlePointerDown(e, "tags")}
src/components/Content/DocPropertyBar.tsx:1755:                  field={tagsField}
src/components/Content/DocPropertyBar.tsx:1761:                  field={tagsField}
src/renderers/markdown.ts:194:// 剥离后 `---` 不会再被 marked 解析成 hr、`tags:` 解析成标题。
src/lib/frontmatter.ts:168:  tags: ["标签"],
src/lib/frontmatter.ts:180:  tags: "array",
src/lib/frontmatter.ts:612:/** 行标识：字段在 `fields` 中的下标，或伪字段 `"tags"`（标签行）。 */
src/lib/frontmatter.ts:613:export type FrontmatterRowId = number | "tags";
src/renderers/markdown.ts:194:// 剥离后 `---` 不会再被 marked 解析成 hr、`tags:` 解析成标题。
src/components/Content/DocPropertyBar.tsx:668:    <span className="dpb-tags-group">
src/components/Content/DocPropertyBar.tsx:857:  const tags = Array.isArray(field.value) ? field.value.map(String) : [];
src/components/Content/DocPropertyBar.tsx:872:      const tagsField = parsed.fields.find(
src/components/Content/DocPropertyBar.tsx:873:        (f) => f.key === "tags" && Array.isArray(f.value),
src/components/Content/DocPropertyBar.tsx:875:      if (!tagsField) continue;
src/components/Content/DocPropertyBar.tsx:876:      for (const value of tagsField.value as unknown[]) {
src/components/Content/DocPropertyBar.tsx:898:      merged.length === tags.length &&
src/components/Content/DocPropertyBar.tsx:899:      merged.every((v, i) => v === tags[i])
src/components/Content/DocPropertyBar.tsx:909:    commit([...tags, value]);
src/components/Content/DocPropertyBar.tsx:915:    commit(tags.filter((t) => t !== name));
src/components/Content/DocPropertyBar.tsx:924:    commit(tags.map((t) => (t === old ? next : t)));
src/components/Content/DocPropertyBar.tsx:969:    commit([...tags, ...parseTagListText(text)]);
src/components/Content/DocPropertyBar.tsx:975:    <span className="dpb-tags-editor" ref={wrapRef}>
src/components/Content/DocPropertyBar.tsx:976:      <span className="dpb-tags-group">
src/components/Content/DocPropertyBar.tsx:977:        {tags.map((tag) =>
src/components/Content/DocPropertyBar.tsx:1247:  const tagsField =
src/components/Content/DocPropertyBar.tsx:1248:    fields.find((f) => f.key === "tags" && Array.isArray(f.value)) ?? null;
src/components/Content/DocPropertyBar.tsx:1249:  const rest = fields.filter((f) => f !== titleField && f !== tagsField);
src/components/Content/DocPropertyBar.tsx:1253:  const tagsIdx = tagsField ? fields.indexOf(tagsField) : -1;
src/components/Content/DocPropertyBar.tsx:1288:      fields.map((_, i) => i).filter((i) => i !== titleIdx && i !== tagsIdx),
src/components/Content/DocPropertyBar.tsx:1290:  }, [fields, titleIdx, tagsIdx, applySelection]);
src/components/Content/DocPropertyBar.tsx:1297:      const wantsTags = selectedRef.current.has("tags") && tagsIdx >= 0;
src/components/Content/DocPropertyBar.tsx:1298:      const idxs = wantsTags ? [...nums, tagsIdx] : nums;
src/components/Content/DocPropertyBar.tsx:1305:        const ti = next.findIndex((f) => f.key === "tags");
src/components/Content/DocPropertyBar.tsx:1310:    [fields, tagsIdx, numericSelected, commitFields],
src/components/Content/DocPropertyBar.tsx:1332:    const wantsTags = selectedRef.current.has("tags") && tagsIdx >= 0;
src/components/Content/DocPropertyBar.tsx:1337:      const ti = next.findIndex((f) => f.key === "tags");
src/components/Content/DocPropertyBar.tsx:1341:  }, [fields, titleIdx, tagsIdx, numericSelected, commitFields]);
src/components/Content/DocPropertyBar.tsx:1363:    return raw === "tags" ? "tags" : Number(raw);
src/components/Content/DocPropertyBar.tsx:1371:    ).filter((el) => el.getAttribute("data-row-id") !== "tags");
src/components/Content/DocPropertyBar.tsx:1568:              const rowId: FrontmatterRowId = field === tagsField ? "tags" : i;
src/components/Content/DocPropertyBar.tsx:1600:                    {field === tagsField ? (
src/components/Content/DocPropertyBar.tsx:1736:            {tagsField && (
src/components/Content/DocPropertyBar.tsx:1738:                className={`dpb-chip${selected.has("tags") ? " dpb-row-selected" : ""}`}
src/components/Content/DocPropertyBar.tsx:1740:                data-key="tags"
src/components/Content/DocPropertyBar.tsx:1741:                data-row-id="tags"
src/components/Content/DocPropertyBar.tsx:1748:                    onPointerDown={(e) => onHandlePointerDown(e, "tags")}
src/components/Content/DocPropertyBar.tsx:1755:                  field={tagsField}
src/components/Content/DocPropertyBar.tsx:1761:                  field={tagsField}
src/editors/setup.ts:89:    // defaultHighlightStyle 会给 `tags.heading` 加下划线与字重，压住装饰层排版。
src/__tests__/frontmatter.test.ts:26:tags:
src/__tests__/frontmatter.test.ts:49:      "tags",
src/__tests__/frontmatter.test.ts:74:    expect(m.tags.type).toBe("array");
src/__tests__/frontmatter.test.ts:94:    expect(m.tags.display).toBe("甲、乙");
src/__tests__/frontmatter.test.ts:182:    const tags = ["甲", "丁", "戊", "工作", "生活"];
src/__tests__/frontmatter.test.ts:183:    const before = new Map(tags.map((t) => [t, tagColor(t)]));
src/__tests__/frontmatter.test.ts:184:    const after = tags.filter((_, i) => i !== 2);
src/__tests__/frontmatter.test.ts:516:      key: "tags",
src/__tests__/frontmatter.test.ts:532:    expect(out.map((f) => f.key)).toEqual(["tags", "meta"]);
src/__tests__/frontmatter.test.ts:542:    expect(out.map((f) => f.key)).toEqual(["tags", "n"]);
src/__tests__/editor/decorations.test.ts:171:    it("hides mdb-bg-* span tags and applies the cm-bg-* class", () => {
src/__tests__/editor/decorations.test.ts:181:    it("nested <u> inside a color span renders underline instead of raw tags (#467)", () => {
src/__tests__/exportDocx.test.ts:29:    const md = "---\ntitle: 测试\ntags: [a]\n---\n# 正文\n";
src/__tests__/markdownRender.test.ts:287:    const html = renderMarkdown("---\ntags:\n  - 笔记\n---\n# 标题\n\n正文");
src/__tests__/markdownRender.test.ts:288:    expect(html).not.toContain("tags:");
src/__tests__/markdownRender.test.ts:295:    const html = renderMarkdown("\uFEFF---\ntags:\n  - 笔记\n---\n# 标题");
src/__tests__/markdownRender.test.ts:296:    expect(html).not.toContain("tags:");
src/__tests__/editor/spanPair.test.ts:25:  it("ignores unmatched closing tags", () => {
src/__tests__/editors/decorations/quote.test.ts:94:    it("tags the line with the leading-space indent level", () => {
src/__tests__/editors/decorations/quote.test.ts:133:    it("tags the quote line with the block state", () => {
src/__tests__/editors/decorations/boldItalic.test.ts:129:    it("hides <u> tags and applies cm-underline", () => {
src/__tests__/editors/decorations/boldItalic.test.ts:139:    it("hides mdb-bg-* span tags and applies cm-bg-*", () => {
src/__tests__/components/Content/PreviewView.test.tsx:27:  it("blocks script tags via DOMPurify", () => {

exec
/bin/zsh -c "rg -n \"frontmatter|tags\" docs/design docs/product CONTEXT.md -g '*.md' | head -n 200" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/product/README.md:18:- 新增文档须带 frontmatter（`title` / `type: product` / `status` / `last_updated`），规范见 `../GOVERNANCE.md`。
docs/design/approved/outline-quick-capture/spec.md:70:| 前缀 | 含义 | frontmatter type |
docs/design/approved/outline-quick-capture/spec.md:93:- 前置问题:type 在 frontmatter
docs/design/approved/navigation/spec.md:166:**标题优先级：** `frontmatter title` > `H1` > 文件名（隐藏 `.md`，同名冲突时再显示）
docs/design/approved/navigation/spec.md:250:R 阶段搜索只做：文件名 + `frontmatter title` + `H1` + 父目录。不做正文全文索引。
docs/design/approved/font-size-scaling/spec.md:242:6. **不做"字号导出"**——字号是阅读偏好，不该写入文档 frontmatter
docs/design/approved/README.md:17:- 新增文档须带 frontmatter（`title` / `type: design` / `status` / `last_updated`），规范见 `../../GOVERNANCE.md`。
docs/design/system/spec.md:148:**标签色板（tag palette，10 色，doc-property-panel）**：来源 = 定稿原型 v13（`docs/design/explorations/frontmatter-search/prototype.html` 的 `PALETTE`），本表为唯一数值来源。分配规则：`FNV-1a(tag 名) % 10`；**同名同色、按名不按序、不可手工改色**；暖主题沿用亮色三值。
docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md:71:| B10 | **新建文档默认** | `defaultNewDocFormat` 不存在；相近字段是 `defaultSavePath` | `user/newdoc.json`：默认保存路径、默认模板、默认 frontmatter | AGENT 自定义新文档模板与默认路径 |
docs/design/system/README.md:25:- 新增文档须带 frontmatter（`title` / `type: design` / `status` / `last_updated`），规范见 `../../GOVERNANCE.md`。
docs/design/explorations/capture-overlay/capture-overlay-v5.3.md:236:- 看到 frontmatter `type: todo` 的条目 → 渲染成 todo badge
docs/design/explorations/capture-overlay/capture-overlay-v5.3.md:361:overlay 的 history list = 读取 `~/documents/inbox/inbox-${today}.md` 的文件头 frontmatter + 内容。
docs/design/explorations/no-sidebar/no-sidebar-doc-navigation.md:228:| 标题 | 首级标题/frontmatter | 0.8 |
docs/design/explorations/no-sidebar/no-sidebar-doc-navigation.md:607:- 第二层:文件名 + frontmatter 标题 + 时间匹配(剔除 grep 全文扫描和 TF-IDF)
docs/design/explorations/font-size-scaling/spec-A6-font-size-scaling-r1-archived.md:213:5. **不做字号保存到 frontmatter** — 字号是阅读偏好，不是文档元数据
docs/design/explorations/capture-overlay/capture-overlay-v4.1.md:271:- append_inbox (写 inbox-YYYY-MM-DD.md + frontmatter)
docs/design/explorations/no-sidebar/no-sidebar-doc-navigation-v2.md:69:| 文件 | 文件名 + frontmatter 标题 + recency boost | 字面匹配 + 时间加权 |
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:78:**数据基础修正（原方案误判）**：变体 B 的「frontmatter 标签」数据基础**当前不存在**——`RecentFile` 只有 path/title/openedAt/excerpt（`src/types/index.ts:178-184`），**无标签模型、无标签索引**，frontmatter 解析是通用 YAML、无 tags 字段约定。网格现有「主题」分组是按父目录，不是标签。
docs/design/pluginization-datafile-settings-rail/04-document-discovery-and-plugin-display.md:83:2. **标签抽取管线**：从 frontmatter 抽取 tags 并建索引。
docs/design/system/governance.md:353:| frontmatter / canonical 唯一 / 相对链接 / 归档位置 | `npm run docs:check`，已接 `scripts/verify.sh` 3b | **未接 CI** |
docs/design/explorations/capture-overlay/capture-overlay-v5.md:384:- 4 色分类 + tags
docs/design/explorations/capture-overlay/capture-overlay-v5.md:403:- Jianxi 的 prefix 语义 (. / - / ! / ?) 比 Bear 的 tags 更轻量
docs/design/explorations/capture-overlay/capture-overlay-v5.md:580:- append_inbox (写 inbox-YYYY-MM-DD.md + frontmatter)
docs/design/explorations/capture-overlay/capture-overlay-v5.1.md:225:- 前缀字符保留在 frontmatter `type:` 字段，内容中也显示 "." 字符（可读性）
docs/design/explorations/capture-overlay/capture-overlay-v5.1.md:478:**v5.x: 纯文本 + frontmatter prefix**
docs/design/explorations/capture-overlay/capture-overlay-v5.1.md:482:- 自动 frontmatter (type/time 写入 inbox-*.md)
docs/design/explorations/capture-overlay/capture-overlay-v5.1.md:639:- append_inbox (写 inbox-*.md + frontmatter)
docs/design/explorations/outline/outline-and-quick-capture-final.md:131:**不实现：** auto-tagging、frontmatter 自动检测、AI 分析。
docs/design/explorations/capture-overlay/capture-overlay-v4.md:143:  1. 追加到 inbox-YYYY-MM-DD.md (frontmatter type/time)
docs/design/explorations/outline/outline-and-quick-capture-v2.md:68:| 前缀 | 含义 | frontmatter type |
docs/design/explorations/outline/outline-and-quick-capture-v2.md:89:- 前置问题:type 在 frontmatter

exec
/bin/zsh -c "rg -n \"global-reading-rail|toggle-key|rail-search|railQuery|openRailSearch|shortcut.*rail|meta.*\\\\\\\\|e\\.key === \\\"\\\\\\\\\\\"|e\\.key === \\\"\\|\\\"\" src/App.tsx src/components/Rail/ReadingRail.tsx src/lib src/hooks -g '*.ts' -g '*.tsx'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/App.tsx:466:      if (meta && e.shiftKey && (e.key === "\\" || e.key === "|")) {
src/App.tsx:537:      if (meta && e.altKey && e.key === "\\") {
src/App.tsx:546:      if (meta && e.key === "\\") {
src/components/Rail/ReadingRail.tsx:801:  const railQuery = useStore((s) => s.railQuery);
src/components/Rail/ReadingRail.tsx:822:  const openRailSearch = useStore((s) => s.openRailSearch);
src/components/Rail/ReadingRail.tsx:946:  }, [railSearchOpen, railQuery]);
src/components/Rail/ReadingRail.tsx:975:    const query = railQuery.trim();
src/components/Rail/ReadingRail.tsx:997:  }, [railQuery, searchedQuery, clearTimer]);
src/components/Rail/ReadingRail.tsx:1000:    railQuery.trim() !== "" && railQuery.trim() !== searchedQuery;
src/components/Rail/ReadingRail.tsx:1231:      railQuery.trim() === searchedQuery
src/components/Rail/ReadingRail.tsx:1235:            query: railQuery,
src/components/Rail/ReadingRail.tsx:1238:    [searchHits, searchedQuery, searchChip, searchTime, railQuery],
src/components/Rail/ReadingRail.tsx:1241:    () => fileTypeChips(railQuery.trim() === searchedQuery ? searchHits : []),
src/components/Rail/ReadingRail.tsx:1242:    [searchHits, searchedQuery, railQuery],
src/components/Rail/ReadingRail.tsx:1271:      query: railQuery,
src/components/Rail/ReadingRail.tsx:1317:    if (railQuery !== "") {
src/components/Rail/ReadingRail.tsx:1511:      data-testid="rail-search"
src/components/Rail/ReadingRail.tsx:1518:        data-testid="rail-search-input"
src/components/Rail/ReadingRail.tsx:1519:        value={railQuery}
src/components/Rail/ReadingRail.tsx:1522:        onFocus={openRailSearch}
src/components/Rail/ReadingRail.tsx:1526:      {railQuery !== "" && (
src/components/Rail/ReadingRail.tsx:1529:          data-testid="rail-search-clear"
src/components/Rail/ReadingRail.tsx:1545:    railSearchOpen && railQuery.trim() !== "" ? (
src/components/Rail/ReadingRail.tsx:1547:        data-testid="rail-search-results"
src/components/Rail/ReadingRail.tsx:1552:          <span data-testid="rail-search-count">
src/components/Rail/ReadingRail.tsx:1562:          data-testid="rail-search-times"
src/components/Rail/ReadingRail.tsx:1569:              data-testid="rail-search-time"
src/components/Rail/ReadingRail.tsx:1585:            data-testid="rail-search-empty"
src/lib/railView.ts:30:    "hover-enter" | "hover-leave" | "toggle-pin" | "collapse" | "toggle-key";
src/lib/railView.ts:35: * `toggle-key` 即 ⌘\ 的语义——在「钉住」与「折叠」之间来回。
src/lib/railView.ts:47:    case "toggle-key":
src/lib/shortcuts.ts:80:    id: "global-reading-rail",
src/lib/export/png.ts:31:  /<(img|br|hr|meta|input|link|source|wbr|area|base|col|embed|param|track)\b([^>]*)>/gi;

exec
/bin/zsh -c "nl -ba src/App.tsx | sed -n '490,590p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   490	        if (!["o", "n", ",", "p", "k", "a"].includes(k)) return;
   491	      }
   492	
   493	      // Cmd+O: Open file
   494	      if (meta && e.key === "o") {
   495	        e.preventDefault();
   496	        handleOpenFile();
   497	      }
   498	
   499	      // Cmd+S: Save
   500	      if (meta && e.key === "s") {
   501	        e.preventDefault();
   502	        handleSaveFile();
   503	      }
   504	
   505	      // Cmd+N: New file
   506	      if (meta && e.key === "n") {
   507	        e.preventDefault();
   508	        handleNewFile();
   509	      }
   510	
   511	      // Cmd+T: New tab in the focused pane
   512	      if (meta && !e.shiftKey && e.key.toLowerCase() === "t") {
   513	        e.preventDefault();
   514	        store.newTab();
   515	      }
   516	
   517	      // Cmd+W: Close active tab
   518	      if (meta && e.key === "w" && activeTabId) {
   519	        e.preventDefault();
   520	        store.closeTab(activeTabId);
   521	      }
   522	
   523	      // 固定隐藏是 collapsed 的强化态：其它可见性快捷键先取消隐藏，
   524	      // 再按「视 hidden = collapsed」走既有语义。
   525	      const revealIfHidden = (): boolean => {
   526	        const es = useEditorStore.getState();
   527	        if (es.config.railPinHidden ?? false) {
   528	          es.setConfig({ railPinHidden: false });
   529	          void saveAppConfig();
   530	          return true;
   531	        }
   532	        return false;
   533	      };
   534	
   535	      // Cmd+Alt+\ : 固定 / 取消固定左边栏（layout-portal 6.1 / D4）。
   536	      // 钉住 ↔ 悬停；折叠态先展开为钉住。必须排在 ⌘\ 之前（同键，先判 alt）。
   537	      if (meta && e.altKey && e.key === "\\") {
   538	        e.preventDefault();
   539	        const base = revealIfHidden() ? "collapsed" : store.railState;
   540	        store.setRailState(base === "pinned" ? "hover" : "pinned");
   541	        return;
   542	      }
   543	
   544	      // Cmd+\ : 统一切换左边栏可见性——折叠态切到钉住，钉住 / 悬停切到折叠。
   545	      // 不再在折叠态兼作沉浸阅读（沉浸阅读由 ⌘⇧F 专责）。
   546	      if (meta && e.key === "\\") {
   547	        e.preventDefault();
   548	        const base = revealIfHidden() ? "collapsed" : store.railState;
   549	        store.setRailState(base === "collapsed" ? "pinned" : "collapsed");
   550	        return;
   551	      }
   552	
   553	      // Cmd+Shift+T : Toggle chrome visibility inside immersive mode — A-5
   554	      // 沉浸态保留旧语义；非沉浸态让位给 AI 翻译（layout-portal 15.1 裁定）。
   555	      if (
   556	        meta &&
   557	        e.shiftKey &&
   558	        e.key.toLowerCase() === "t" &&
   559	        store.readingMode
   560	      ) {
   561	        e.preventDefault();
   562	        store.setImmersiveChromeVisible(!store.immersiveChromeVisible);
   563	      }
   564	
   565	      if (
   566	        meta &&
   567	        e.shiftKey &&
   568	        e.key.toLowerCase() === "t" &&
   569	        !store.readingMode
   570	      ) {
   571	        e.preventDefault();
   572	        store.setScene("workspace");
   573	        const ai = useAiEntryStore.getState();
   574	        ai.setInput("翻译选中的内容");
   575	        ai.openOverlay();
   576	      }
   577	
   578	      // Cmd+Shift+E: 生成学习页（layout-portal 15.1）
   579	      if (meta && e.shiftKey && e.key.toLowerCase() === "e") {
   580	        e.preventDefault();
   581	        store.setScene("workspace");
   582	        const ai = useAiEntryStore.getState();
   583	        ai.setInput("把这篇文档整理成一份学习页：要点、例子、自测题。");
   584	        ai.openOverlay();
   585	      }
   586	
   587	      // Cmd+Shift+S: collapse panes back to a single root leaf
   588	      if (meta && e.shiftKey && e.key.toLowerCase() === "s") {
   589	        e.preventDefault();
   590	        store.collapsePanes();

exec
/bin/zsh -c "nl -ba src/components/Rail/ReadingRail.tsx | sed -n '780,870p;1660,1755p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   780	    </h3>
   781	  );
   782	}
   783	
   784	/**
   785	 * 阅读空间竖排栏（layout-portal 6.1）。
   786	 *
   787	 * 三态：折叠（12px 绝对边缘条，正文满宽）/ 悬停（240px 绝对浮层，不挤压正文）/
   788	 * 钉住（240px flex 常驻，正文 min-width:0 变窄）。hover 是瞬态，由指针进入/离开
   789	 * 驱动（250ms 展开、300ms 收回），钉住态不受其影响。
   790	 */
   791	export default function ReadingRail({
   792	  onOpenPath,
   793	}: {
   794	  onOpenPath: (path: string) => void | Promise<void>;
   795	}) {
   796	  const railState = useStore((s) => s.railState);
   797	  const readingMode = useStore((s) => s.readingMode);
   798	  const railLayout = useStore((s) => s.railLayout);
   799	  const railDensity = useStore((s) => s.railDensity);
   800	  const railCardHeight = useStore((s) => s.railCardHeight);
   801	  const railQuery = useStore((s) => s.railQuery);
   802	  const railSearchOpen = useStore((s) => s.railSearchOpen);
   803	  const railSection = useStore((s) => s.railSection);
   804	  const railChip = useStore((s) => s.railChip);
   805	  const recentFiles = useStore((s) => s.recentFiles);
   806	  const tabs = useStore((s) => s.tabs);
   807	  const activeTabId = useStore((s) => s.activeTabId);
   808	  const scrollPositions = useStore((s) => s.scrollPositions);
   809	  const previewEnabled = useStore((s) => s.previewSettings.enabled);
   810	  const viewSpec = useStore((s) => s.viewSpec);
   811	  const pinnedPaths = useStore((s) => s.pinnedPaths);
   812	  const togglePinnedPath = useStore((s) => s.togglePinnedPath);
   813	  const configLoaded = useEditorStore((s) => s.configLoaded);
   814	  const railPinHidden = useEditorStore((s) => s.config.railPinHidden ?? false);
   815	
   816	  const setRailState = useStore((s) => s.setRailState);
   817	  const toggleRailPin = useStore((s) => s.toggleRailPin);
   818	  const setRailLayout = useStore((s) => s.setRailLayout);
   819	  const setRailDensity = useStore((s) => s.setRailDensity);
   820	  const setRailCardHeight = useStore((s) => s.setRailCardHeight);
   821	  const setRailQuery = useStore((s) => s.setRailQuery);
   822	  const openRailSearch = useStore((s) => s.openRailSearch);
   823	  const closeRailSearch = useStore((s) => s.closeRailSearch);
   824	  const setRailSection = useStore((s) => s.setRailSection);
   825	  const setRailChip = useStore((s) => s.setRailChip);
   826	  const saveRailViewSpec = useStore((s) => s.saveRailViewSpec);
   827	
   828	  const [menuOpen, setMenuOpen] = useState(false);
   829	  const [snapshots, setSnapshots] = useState<string[]>([]);
   830	  const [notice, setNotice] = useState<string | null>(null);
   831	  const [locatedPath, setLocatedPath] = useState<string | null>(null);
   832	  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
   833	  const [searchedQuery, setSearchedQuery] = useState("");
   834	  const [searchChip, setSearchChip] = useState<RailChipKind>("all");
   835	  const [searchTime, setSearchTime] = useState<RailSearchTime>("all");
   836	  const [railWidth, setRailWidthState] = useState(viewSpec.railPinnedWidth);
   837	  const [menuFlip, setMenuFlip] = useState(false);
   838	
   839	  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   840	  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   841	  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   842	  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   843	  const locateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   844	  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   845	  const searchSeq = useRef(0);
   846	  const inputRef = useRef<HTMLInputElement>(null);
   847	  const menuRef = useRef<HTMLDivElement>(null);
   848	  const menuHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   849	  const hoverOpenMenu = (): void => {
   850	    if (menuHoverTimer.current) clearTimeout(menuHoverTimer.current);
   851	    menuHoverTimer.current = setTimeout(() => {
   852	      setMenuOpen(true);
   853	      loadSnapshots();
   854	    }, 120);
   855	  };
   856	  const hoverCloseMenu = (): void => {
   857	    if (menuHoverTimer.current) clearTimeout(menuHoverTimer.current);
   858	    menuHoverTimer.current = setTimeout(() => setMenuOpen(false), 240);
   859	  };
   860	  /** 拖拽调宽期间抑制「移出即收起」，否则浮层会在拖动途中消失。 */
   861	  const resizingRef = useRef(false);
   862	  const railPanelRef = useRef<HTMLDivElement>(null);
   863	  const listScrollRef = useRef<HTMLDivElement>(null);
   864	  const hoverZoneRef = useRef<{ path: string; zone: "left" | "right" } | null>(
   865	    null,
   866	  );
   867	
   868	  const clearTimer = useCallback(
   869	    (ref: { current: ReturnType<typeof setTimeout> | null }) => {
   870	      if (ref.current) {
  1660	
  1661	  const panel = (
  1662	    <div
  1663	      ref={railPanelRef}
  1664	      className="rail-panel flex h-full flex-col bg-gray-50 text-sm dark:bg-gray-900"
  1665	    >
  1666	      {header}
  1667	      {search}
  1668	      <div
  1669	        ref={listScrollRef}
  1670	        data-testid="rail-scroll"
  1671	        className="flex-1 overflow-y-auto"
  1672	      >
  1673	        {searchBlock}
  1674	        {listBody}
  1675	      </div>
  1676	    </div>
  1677	  );
  1678	
  1679	  if (railPinHidden) return null;
  1680	  if (readingMode && railState !== "pinned") return null;
  1681	
  1682	  const collapsed = (
  1683	    <button
  1684	      type="button"
  1685	      data-testid="rail-edge"
  1686	      data-rail-state="collapsed"
  1687	      onClick={toggleRailPin}
  1688	      title="阅读空间"
  1689	      aria-label="展开阅读空间"
  1690	      className="rail-edge flex h-full w-full items-center justify-center overflow-hidden text-gray-400"
  1691	    >
  1692	      <Icon name="chevronRight" size={18} className="rail-edge-icon" />
  1693	    </button>
  1694	  );
  1695	
  1696	  if (railState === "pinned") {
  1697	    return (
  1698	      <div
  1699	        data-testid="rail-panel"
  1700	        data-rail-state="pinned"
  1701	        data-rail-pinned-width={panelWidth}
  1702	        data-rail-scale={viewSpec.pinnedSegmentScale}
  1703	        data-rail-block-colors={viewSpec.blockColors ? "true" : "false"}
  1704	        style={{ width: panelWidth }}
  1705	        className="rail-root relative shrink-0 border-r border-gray-200 dark:border-gray-700"
  1706	        onMouseEnter={onEnter}
  1707	        onMouseLeave={onLeave}
  1708	      >
  1709	        {panel}
  1710	        <div
  1711	          data-testid="rail-resize-handle"
  1712	          role="separator"
  1713	          aria-orientation="vertical"
  1714	          aria-label="拖动调整阅读空间宽度"
  1715	          title="拖动调整宽度"
  1716	          onPointerDown={onResizeStart}
  1717	          className="absolute right-0 top-0 z-20 h-full cursor-col-resize hover:bg-[var(--app-accent-soft)]"
  1718	          style={{ width: RAIL_RESIZE_HANDLE_PX }}
  1719	        />
  1720	        {notice && <RailNotice text={notice} />}
  1721	      </div>
  1722	    );
  1723	  }
  1724	
  1725	  const overlayWidth = railState === "hover" ? panelWidth : RAIL_EDGE_PX;
  1726	  return (
  1727	    <>
  1728	      <div
  1729	        data-testid={railState === "collapsed" ? undefined : "rail-panel"}
  1730	        data-rail-state={railState}
  1731	        data-rail-overlay="true"
  1732	        data-rail-pinned-width={panelWidth}
  1733	        data-rail-scale={viewSpec.pinnedSegmentScale}
  1734	        data-rail-block-colors={viewSpec.blockColors ? "true" : "false"}
  1735	        style={{
  1736	          position: "absolute",
  1737	          left: 0,
  1738	          top: 0,
  1739	          bottom: 0,
  1740	          width: overlayWidth,
  1741	          zIndex: 60,
  1742	        }}
  1743	        className="rail-root rail-overlay overflow-hidden shadow-lg"
  1744	        onMouseEnter={onEnter}
  1745	        onMouseLeave={onLeave}
  1746	      >
  1747	        {railState === "hover" ? panel : collapsed}
  1748	        {railState === "hover" && (
  1749	          <div
  1750	            data-testid="rail-resize-handle"
  1751	            role="separator"
  1752	            aria-orientation="vertical"
  1753	            aria-label="拖动调整阅读空间宽度"
  1754	            title="拖动调整宽度"
  1755	            onPointerDown={onResizeStart}

exec
/bin/zsh -c "nl -ba docs/design/approved/navigation/spec.md | sed -n '225,270p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   225	| Desk | 面板空查询时的默认视图 |
   226	| Shelf | 文件项上的 `Tab` 固定行为 |
   227	| Portal | 选中文本 + `Cmd=P` |
   228	| Workspace | 先不做独立界面 |
   229	| Trail | 标准 `Cmd+[` 后退 |
   230	| 阅读收尾台 | 关闭文档即结束 |
   231	| 自然语言搜索 | R阶段不做 |
   232	| 稳定哈希槽 | 直接用 relevance 排序 |
   233	| 安心提示 | 系统 toast，不进导航系统 |
   234	| Omni Search 命令模式 | R阶段只搜文件，不搜命令 |
   235	
   236	---
   237	
   238	## 六、实施阶段
   239	
   240	### R 阶段（两周内上线）
   241	
   242	1. `Cmd+P` 统一面板（空查询=上下文视图，输入=搜索）
   243	2. Space Peek
   244	3. 标准后退/前进
   245	4. 统一文件项组件（标题 + 理由片段 + 状态点）
   246	5. 选中文本 + `Cmd+P` 带词搜索
   247	6. 系统 toast（保存/未保存/路径失效）
   248	7. 可选：经典侧栏兼容开关
   249	
   250	R 阶段搜索只做：文件名 + `frontmatter title` + `H1` + 父目录。不做正文全文索引。
   251	
   252	### P1 阶段（用户反馈驱动）
   253	
   254	- 分组扩展到 10 条/组
   255	- "固定到当前任务"的列表管理
   256	- `Cmd+[` 长按显示最近路径
   257	- 更丰富的文件项行为（旁开、Peek、固定）
   258	
   259	### P2 阶段（确认需要后开启）
   260	
   261	- 语义搜索 / 本地 embedding
   262	- 自动任务聚类
   263	
   264	---
   265	
   266	## 七、最终原则
   267	
   268	无侧栏导航的关键不是"显示更多文件"，而是"在正确的时机显示正确的文件"。
   269	
   270	每个文件项必须回答：它是谁？它和我现在有什么关系？我上次对它做了什么？

exec
/bin/zsh -c "nl -ba docs/requirements/editor-surface-batch20/requirements.md | sed -n '1,120p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# editor-surface-batch20 需求四要素
     2	
     3	- spec issue: https://github.com/jianxi-dev/clairis/issues/897
     4	- 输入源：用户 2026-11-15 反馈（28 项：14 缺陷 + 14 优化；原文按「bug修复：bug1115」「功能优化：功能优化-1115」两段提交）
     5	- 复现产物（一手证据，`/Users/mason/Downloads/`）：
     6	  - `标月 Biaoyue2.pdf`（缺陷 1 的输出 PDF；2 页 A4，`Creator: Biaoyue` / `Producer: macOS … Quartz PDFContext`）
     7	  - `formula-mermaid.md`（缺陷 1 的源文档；66 行，含内嵌 PDF、mermaid、typescript 代码块、DANGER callout）
     8	
     9	## What（做什么）
    10	
    11	### A. 缺陷修复（14 项）
    12	
    13	- 缺陷 1 打印→输出 PDF：打印预览显示完整，但输出的 PDF 中段与尾部内容不全（复现文档 mermaid 之后的内容缺失）。修正定性：产物为 2 页 A4、Quartz 生成 → 走的是「打印 → 存为 PDF」路径（`window.print()`），非应用内单页导出。
    14	- 缺陷 2 文件卡片：视频缩略图与悬停浮窗未显示画面；文本文件卡片标题与进度文字重叠。
    15	- 缺陷 3 视频字幕：只显示与视频同文件名的字幕（当前列出同目录全部字幕）。
    16	- 缺陷 4 提示信息：仍时不时弹出矩形提示，且出现矩形时就不显示胶囊——矩形不应出现；底部状态栏「主页」等按钮提示出现在右上方，未跟随图标在正上方；胶囊提示应优先在上或下显示（当前菜单、工具条等多左右显示）。
    17	- 缺陷 5 MD 编辑态：视频不能播放、图片不显示（只显示问号框）；预览态正常。
    18	- 缺陷 6 视频重启：通过页签打开视频播放后重启产品，声音自动播放但视频未播放；点击播放后出现两道声音。
    19	- 缺陷 7 页签文件右键菜单：「导出」菜单弹出后鼠标滑出未消失；菜单提示为黑色矩形。
    20	- 缺陷 8 配色：标题配色在 MD 编辑态也须生效。
    21	- 缺陷 9 MD 标题折叠按钮：预览态下触发显示区域须同编辑态。
    22	- 缺陷 10 拖动窗口：按页签空白处无拖动鼠标指针；拖动时当前格出现 2 个浮层；移动后当前格与其他格互换；无法真正移动窗口。
    23	- 缺陷 11 隐藏/显示固定左边栏快捷键与网格预览冲突。
    24	- 缺陷 12 视频文件：进度条缩略图有时不浮在进度条上侧；窗口不自动适配当前格大小；「选中 90」后窗口大小也不适配。
    25	- 缺陷 13 全屏：双击页签空白区域应将窗口切到全屏、再次双击还原，当前无反应。
    26	- 缺陷 14 MD 编辑态：恢复键失效；输入逗号不能自动转换为「/」并弹菜单；横向工具条回滚上一版未成功（仍是多按钮版本，期望类似文本文件所显示的工具条数量）。
    27	
    28	### B. 功能优化（14 项）
    29	
    30	- 优化 1 页签文件提示信息：鼠标滑入弹出的响应时间须跟随全局设置；窗口不再用胶囊（较高窗口不适合胶囊，此设计经验须记录），改为圆角方形、可用固定宽度、文件名与路径较长时换行。
    31	- 优化 2 悬浮窗：鼠标滑入底部浮窗的高度再低一点（图标上下留白较多）。
    32	- 优化 3 视频播放：当前的画面图标像截图图标，更换更贴切的图标。
    33	- 优化 4 MD 中的图片：圆角大小改成与视频一致。
    34	- 优化 5 MD 中嵌入视频：编辑态显示页面宽度 2/3，预览态默认也应为此宽度；右键画面菜单中「全屏」须能脱离文档页面全屏显示（整个计算机屏幕）；将速率左侧图标功能改为弹出菜单中的两档宽度（满页面宽度 / 全屏），编辑态与预览态都支持。
    35	- 优化 6 嵌套新增/插入功能块：凡可录入文字处（标准、引用、单元格、分栏内、有序/无序列表下层）都须支持各类型插入、新增与转换手柄，不显示源码（富文本）。
    36	- 优化 7 Tab 键：按 Tab 空几格后功能块仍须显示正常；引用块被 Tab 后错几格格式丢失、无法再编辑、鼠标无法定位、转换手柄菜单不可用（引用 #833）。引用块左右边框对齐改为右侧边框对齐、左侧按层级空格对齐。
    37	- 优化 8 页签文件右键菜单：给「移动到」图标加一个向右的箭头；不同概念的图标不应重复；记录该规则并使其自明。
    38	- 优化 9 大纲：按钮再往下移两个大纲图标高度；条目去掉前导竖线，改为显示标题等级字样（如 H2，可比标题文字小一点）；可拖动大纲调整显示顺序。
    39	- 优化 10 菜单统一：所有新增弹出的菜单统一一种样式（新增手柄菜单的内容与样式，复用到斜杠与其他功能块菜单）。
    40	- 优化 11 分栏与表格数字：数字显示在文字说明右侧；表格数字与最右侧方框线右对齐；分栏数字与第 5 列方框居中对齐；分栏弹出子菜单与分栏选项上下居中对齐。
    41	- 优化 12 标题字体：显示当前字体（含默认字体）；不预置各类国家字体；只需本地字体与预置可用中英开源字体。
    42	- 优化 13 文本：行号靠近文字侧（当前最左间距过大）；显示错位与代码颜色/字体不佳，须检索最美观的格式与代码颜色复用优化；编辑态与预览态共用一套显示格式。
    43	- 优化 14 文本文件工具条：只显示复制按钮，其余都不需要；预览态与编辑态一样。
    44	
    45	## Why（为什么）
    46	
    47	- 缺陷 1/5/6/7/10/13 是「该出现不出现 / 该消失不消失 / 点了没反应 / 结果错误」的阻断级缺陷：导出产物丢内容、编辑态媒体不可用、重启双声道、菜单滞留、窗口无法拖动、全屏无反应。
    48	- 缺陷 2/3/4/8/9/11/12/14 破坏一致性预期与可用性：缩略图/字幕/提示/配色/折叠区/快捷键/播放器适配/撤销与工具条。
    49	- 优化 1–14 提升外表面观感与操作一致性：提示窗形态与响应、悬浮窗紧凑、图标语义、圆角统一、嵌入视频宽度与全屏、富文本可插入面、Tab 缩进健壮性、边框对齐、菜单统一、编号对齐、字体收敛、文本显示格式统一、工具条精简。
    50	
    51	## Scope（范围）
    52	
    53	- 打印视图与 PDF 输出完整性（`printPreview.ts` + `print.css`；应用内导出 PDF 的单页完整性作为同域一并收口）。
    54	- 文件卡片（网格 / 阅读空间）与悬停浮层的视频缩略图、标题布局。
    55	- 视频播放器：字幕同名收敛、重启不自动播放与单声道、进度缩略图定位、格内适配、图标、嵌入尺寸档与全屏。
    56	- 提示系统（TooltipLayer 外壳 / 方位 / 延迟口径；页签名信息窗；悬浮窗）+ 页签右键菜单（导出子菜单生命周期、菜单提示非原生矩形）。
    57	- 编辑器表面：MD 编辑态媒体渲染、标题配色、预览折叠触发区、逗号→/、撤销、横向工具条回滚、嵌套富文本插入、Tab 缩进与边框对齐、分栏/表格编号、文本显示格式统一、文本工具条精简。
    58	- 窗口与布局：页签空白拖动窗口与权限、双击全屏、左边栏快捷键与场景门、大纲按钮/条目/拖拽。
    59	- 配置：标题字体显示与预设施补。
    60	- 相关 e2e 与必要单测。
    61	
    62	## Non-goals（不做）
    63	
    64	- 导出 PDF 由「单页栅格」改「分页矢量」（batch16 design.md:105-107 已显式推迟；本次只做单页内完整 + 超限显式拒绝）。
    65	- mermaid 渲染引擎本身；整体图标库重画；移动端/触屏布局；导出管线其他格式（Word/ZIP/mdpkg）。
    66	- 重排既有右键菜单其余项的顺序与行为；系统打印能力本身的替换。
    67	- 若「选中 90」指某个不存在的独立缩放/画质预设，则不在本次范围（按分栏比例 90% 的格内适配理解，复现后按实调整）。
    68	
    69	## 需求输入包（L-1）
    70	
    71	> 本节是 batch20 的需求输入门（L-1）记录，回答「需求从哪来、模糊处怎么定、一手证据是什么、冲突在哪、怎么验收」。它不改变上文四要素，只把下游拆票所需的输入显式化。
    72	
    73	### 1. 来源可追溯
    74	
    75	- 用户反馈：2026-11-15 提交的 28 项（14 缺陷 + 14 优化），父规格票 spec issue #897（https://github.com/jianxi-dev/clairis/issues/897）。
    76	- 一手证据（2 件，位于 `/Users/mason/Downloads/`）：`标月 Biaoyue2.pdf`（缺陷 1 输出产物）、`formula-mermaid.md`（缺陷 1 源文档）。要点见本节第 3 条。
    77	- 关联既有 issue：#833（batch19 父规格票，缺陷 1 的边框对齐小节引用其口径）。
    78	
    79	### 2. 空白显式化（open-question + 已记录 DEFAULT）
    80	
    81	| 编号 | 模糊点 | 归属 | 已记录 DEFAULT | 下游可否被阻塞 |
    82	|---|---|---|---|---|
    83	| Q-缺陷4 | 矩形提示来源不可穷举 | 缺陷 4 | 口径＝一切自绘悬停提示只渲染胶囊/圆角方形；原生 `title` 一律由 TooltipLayer 接管（含 `aria-haspopup`/`aria-expanded`/`data-no-tip` 跳过项） | 否 |
    84	| Q-缺陷4b | 未配置「提示时长」时 tooltip 回退值 | 缺陷 4 | 统一为全局设置口径；未配置回退 400ms（现状 TooltipLayer 400ms / 底部提示 3000ms 口径不一，须钉死） | 否 |
    85	| Q-缺陷12 | 「选中 90」语义 | 缺陷 12 | 按分栏比例 90% 的格内适配理解；复现后若为独立缩放预设则转新票 | 否 |
    86	| Q-缺陷14 | 横向工具条「上一版」究竟多少按钮 | 缺陷 14 | 以「类似文本文件所显示的工具条数量」为准，取赛季内更少的按钮集（pre-#623 胶囊 12 键两层） | 否 |
    87	| Q-优化1 | 页签提示窗固定宽度取值 | 优化 1 | 固定宽度、圆角方形（`--radius-8`，非胶囊）；换行 | 否 |
    88	| Q-优化9 | 「两个大纲图标高度」精确值 | 优化 9 | 按大纲条目实测高度 ×2；按钮 `top` 由 10px 下移 | 否 |
    89	| Q-优化12 | 「预置可用中英开源字体」集合 | 优化 12 | 本机枚举字体 + 一组开源中英字体预设；移除各国专有字体硬编码 | 否 |
    90	| Q-优化13 | 「最美观的格式与代码颜色」 | 优化 13 | 复用现有 token（`reader.css` `.tok-*`）为唯一配色源；编辑态与预览态共用盒子与配色 | 否 |
    91	
    92	### 3. 一手证据
    93	
    94	- **缺陷 1（打印→PDF 内容不全）**：源 `formula-mermaid.md`（66 行）依次含：h1「公式与流程图」→ col-2 文本块 → h2「数学公式」→ 两行行内公式 → 内嵌 PDF（`assets/10.0产品报价宣贯-内部.pdf`）→ 块级公式 → h2「流程图」→ mermaid → h2「代码高亮」→ typescript 代码块 → 引用 → DANGER callout。
    95	  - 输出 PDF（`pdftotext -layout`）文本到 mermaid 节点即止：出现「公式与流程图 / MD-Bundle … / 数学公式 / 行内公式（**出现两次**）/ 块级公式——傅里叶变换 / 内嵌 PDF 内的一处日期 2025年9月17日 / 傅里叶公式 / 流程图 + mermaid 文本节点」。
    96	  - **缺失**：h2「代码高亮」及其 typescript 代码块、引用块、DANGER callout —— 即 mermaid 之后（文档尾段）整体缺失。
    97	  - 已排除项：两行行内公式（源第 13、15 行）在 PDF 中各出现一次、与源一致，**非重复**。
    98	  - 元数据：`pdfinfo` → `Pages: 2`、Page size A4、`Creator: Biaoyue`、`Producer: macOS … Quartz PDFContext` → 走 `window.print()`（`printPreview.ts:146`）经 macOS 打印栈存 PDF；排除应用内 `pdf.ts` 单页导出路径。
    99	- **缺陷 5/6/12**：需 `npm run tauri dev` 真机复现（编辑态媒体渲染、音频链路、播放器适配 e2e 桩测不出）。
   100	
   101	### 4. 冲突显式
   102	
   103	- **缺陷 7 ↔ #876/#844「导出 hover 保持」**：batch19 刻意加入「指针移出父项后保持可见」（`e2e/tab-menu-move-icon-844.spec.ts` 断言与 `batch19 specs/navigation` 的 SHALL）。本次要求「移出后消失」。裁定：以本次为准——收起条件改为「指针移出（导出行 ∪ 子菜单）并集」；须同步修订该 e2e 与 navigation 规格条目（supersede）。
   104	- **缺陷 8 ↔ batch19 C1**：batch19 的标题字体/配色只覆盖预览态（`--heading-hN-font` 注入 `.preview-content`）。本次要求编辑态也生效。裁定：标题配色与字体在 `.cm-editor-container` 同步注入 `--tone-*` / `--heading-hN-*`，不得越入正文；预览态规则不变。
   105	- **缺陷 14 ↔ #849/#880**：#880 只回滚了 CSS 横条（`horizontal-toolbar.ts`），未改 md 胶囊（`floating-toolbar.ts`）。裁定：回滚对象是 md 编辑态选区胶囊的按钮集，CSS 横条不受影响。
   106	- **优化 7 ↔ 缺陷 1 边框对齐**：优化 7 的引用块边框对齐与缺陷 1 的打印完整性同属「引用块渲染」面但不同管线（编辑态 vs 打印态）。裁定：分别处理，共享 `--app-border` token。
   107	
   108	### 5. 验收锚点
   109	
   110	- 每条需求 ≥1 锚点，见 `openspec/changes/editor-surface-batch20/anchors.md`（R-1…R-N 对应缺陷 1–14 / 优化 1–14）。
   111	- 锚点经 `scripts/cw-conformance.sh generate` 投影为 `conformance.json` 并 `lock`。

exec
/bin/zsh -c "sed -n '1,220p' docs/requirements/editor-surface-batch20/requirements.md | rg -n \"网格|缩略|卡片|表格|找不到|文档发现|搜索|边距|28 项|反馈\"" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
4:- 输入源：用户 2026-11-15 反馈（28 项：14 缺陷 + 14 优化；原文按「bug修复：bug1115」「功能优化：功能优化-1115」两段提交）
14:- 缺陷 2 文件卡片：视频缩略图与悬停浮窗未显示画面；文本文件卡片标题与进度文字重叠。
23:- 缺陷 11 隐藏/显示固定左边栏快捷键与网格预览冲突。
24:- 缺陷 12 视频文件：进度条缩略图有时不浮在进度条上侧；窗口不自动适配当前格大小；「选中 90」后窗口大小也不适配。
40:- 优化 11 分栏与表格数字：数字显示在文字说明右侧；表格数字与最右侧方框线右对齐；分栏数字与第 5 列方框居中对齐；分栏弹出子菜单与分栏选项上下居中对齐。
48:- 缺陷 2/3/4/8/9/11/12/14 破坏一致性预期与可用性：缩略图/字幕/提示/配色/折叠区/快捷键/播放器适配/撤销与工具条。
54:- 文件卡片（网格 / 阅读空间）与悬停浮层的视频缩略图、标题布局。
55:- 视频播放器：字幕同名收敛、重启不自动播放与单声道、进度缩略图定位、格内适配、图标、嵌入尺寸档与全屏。
57:- 编辑器表面：MD 编辑态媒体渲染、标题配色、预览折叠触发区、逗号→/、撤销、横向工具条回滚、嵌套富文本插入、Tab 缩进与边框对齐、分栏/表格编号、文本显示格式统一、文本工具条精简。
75:- 用户反馈：2026-11-15 提交的 28 项（14 缺陷 + 14 优化），父规格票 spec issue #897（https://github.com/jianxi-dev/clairis/issues/897）。

exec
/bin/zsh -c "rg -n \"grid.*thumbnail|缩略|thumbnail|card overlap|重叠|表格边距|table.*margin\" docs/requirements/editor-surface-batch20 -g '*.md' | head -n 160" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/requirements/editor-surface-batch20/requirements.md:14:- 缺陷 2 文件卡片：视频缩略图与悬停浮窗未显示画面；文本文件卡片标题与进度文字重叠。
docs/requirements/editor-surface-batch20/requirements.md:24:- 缺陷 12 视频文件：进度条缩略图有时不浮在进度条上侧；窗口不自动适配当前格大小；「选中 90」后窗口大小也不适配。
docs/requirements/editor-surface-batch20/requirements.md:48:- 缺陷 2/3/4/8/9/11/12/14 破坏一致性预期与可用性：缩略图/字幕/提示/配色/折叠区/快捷键/播放器适配/撤销与工具条。
docs/requirements/editor-surface-batch20/requirements.md:54:- 文件卡片（网格 / 阅读空间）与悬停浮层的视频缩略图、标题布局。
docs/requirements/editor-surface-batch20/requirements.md:55:- 视频播放器：字幕同名收敛、重启不自动播放与单声道、进度缩略图定位、格内适配、图标、嵌入尺寸档与全屏。

exec
/bin/zsh -c "rg -n \"mergeRecentFiles|recentFiles\" src/stores/index.ts | head -n 80; nl -ba src/stores/index.ts | sed -n '870,925p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
221:  recentFiles: RecentFile[];
319:  mergeRecentFiles: (incoming: RecentFile[]) => void;
437:  recentFiles: [] as RecentFile[],
510:        recentFiles: [
517:          ...state.recentFiles.filter((f) => f.path !== path),
567:      recentFiles: [
574:        ...state.recentFiles.filter((f) => f.path !== path),
887:      const prev = s.recentFiles.find((f) => f.path === path);
888:      const filtered = s.recentFiles.filter((f) => f.path !== path);
897:      return { recentFiles: [entry, ...filtered].slice(0, 10) };
901:  mergeRecentFiles: (incoming) => {
904:      recentFiles: mergeRecentFileList(s.recentFiles, incoming, 10),
908:  clearRecentFiles: () => set({ recentFiles: [] }),
1237:    const recentFiles = [
1244:      ...state.recentFiles.filter((f) => f.path !== path),
1256:        recentFiles,
1280:      set({ tabs, recentFiles });
1300:      recentFiles,
   870	        ...s.viewSpec,
   871	        themeGroups: group === "theme",
   872	        gridGrouping:
   873	          group === "type" ? "type" : group === "time" ? "time" : "none",
   874	      },
   875	    })),
   876	  setGridPinnedOnly: (only: boolean) => set({ gridPinnedOnly: only }),
   877	  setGridSelectedPath: (path: string | null) => set({ gridSelectedPath: path }),
   878	  togglePinnedPath: (path: string) =>
   879	    set((s) => ({
   880	      pinnedPaths: s.pinnedPaths.includes(path)
   881	        ? s.pinnedPaths.filter((p) => p !== path)
   882	        : [...s.pinnedPaths, path],
   883	    })),
   884	
   885	  addRecentFile: (path: string, title: string, excerpt?: string) => {
   886	    set((s) => {
   887	      const prev = s.recentFiles.find((f) => f.path === path);
   888	      const filtered = s.recentFiles.filter((f) => f.path !== path);
   889	      const entry: RecentFile = {
   890	        path,
   891	        title,
   892	        openedAt: new Date().toISOString(),
   893	        // 没带摘要时沿用已有的：调用点常常只有路径与标题，
   894	        // 直接覆盖会把 openFile 时截下的真摘要抹掉
   895	        excerpt: excerpt?.slice(0, 160) ?? prev?.excerpt,
   896	      };
   897	      return { recentFiles: [entry, ...filtered].slice(0, 10) };
   898	    });
   899	  },
   900	
   901	  mergeRecentFiles: (incoming) => {
   902	    if (!Array.isArray(incoming) || incoming.length === 0) return;
   903	    set((s) => ({
   904	      recentFiles: mergeRecentFileList(s.recentFiles, incoming, 10),
   905	    }));
   906	  },
   907	
   908	  clearRecentFiles: () => set({ recentFiles: [] }),
   909	
   910	  // ── Split panel actions ──
   911	  splitTab: (tabId: string, direction: SplitDirection) =>
   912	    set((s) => {
   913	      // Move the tab to the split panel
   914	      const newSplitIds = [tabId];
   915	      // Keep any existing split tabs that are still valid
   916	      for (const id of s.splitTabIds) {
   917	        if (id !== tabId && s.tabs[id] && !newSplitIds.includes(id)) {
   918	          newSplitIds.push(id);
   919	        }
   920	      }
   921	      return {
   922	        splitDirection: direction,
   923	        splitTabIds: newSplitIds,
   924	        splitActiveTabId: tabId,
   925	        // If the split tab was the main active tab, switch main to another tab

exec
/bin/zsh -c 'rg -n "pinnedPaths|togglePinnedPath|mergeRecentFiles" src/stores/index.ts src/hooks/useConfig.ts src/types/index.ts | head -n 160' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/stores/index.ts:238:  pinnedPaths: string[];
src/stores/index.ts:319:  mergeRecentFiles: (incoming: RecentFile[]) => void;
src/stores/index.ts:327:  togglePinnedPath: (path: string) => void;
src/stores/index.ts:445:  pinnedPaths: [] as string[],
src/stores/index.ts:878:  togglePinnedPath: (path: string) =>
src/stores/index.ts:880:      pinnedPaths: s.pinnedPaths.includes(path)
src/stores/index.ts:881:        ? s.pinnedPaths.filter((p) => p !== path)
src/stores/index.ts:882:        : [...s.pinnedPaths, path],
src/stores/index.ts:901:  mergeRecentFiles: (incoming) => {

exec
/bin/zsh -c "nl -ba src/hooks/useConfig.ts | sed -n '150,225p;390,485p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   150	      : null,
   151	    headingFonts: ensureHeadingFonts(es.config.headingFonts),
   152	    readerFontSize: es.config.readerFontSize ?? null,
   153	    readerWidth: es.config.readerWidth ?? null,
   154	    readerSkin: es.config.readerSkin ?? null,
   155	    defaultSavePath: es.config.defaultSavePath ?? null,
   156	    ollamaEndpoint: es.config.ollamaEndpoint ?? null,
   157	    openaiEndpoint: es.config.openaiEndpoint ?? null,
   158	    openaiModel: es.config.openaiModel ?? null,
   159	    translationProvider: es.config.translationProvider ?? null,
   160	    sourceLang: es.config.langPair?.source ?? null,
   161	    targetLang: es.config.langPair?.target ?? null,
   162	    theme: es.config.theme ?? null,
   163	    aiConfirmDensity: es.config.aiConfirmDensity ?? null,
   164	    iconLabel: es.config.iconLabel ?? null,
   165	    sidebarLeftVisible: es.config.sidebarLeftVisible ?? null,
   166	    sidebarRightVisible: es.config.sidebarRightVisible ?? null,
   167	    sidebarLeftWidth: es.config.sidebarLeftWidth ?? null,
   168	    sidebarRightWidth: es.config.sidebarRightWidth ?? null,
   169	    horizontalSplitRatio: es.config.horizontalSplitRatio ?? null,
   170	    verticalSplitRatio: es.config.verticalSplitRatio ?? null,
   171	    // 读 store 的实时值，不是加载时的陈旧快照——否则本次会话新开的文件
   172	    // 永远不会被持久化，门户下次启动又变成空的
   173	    recentFiles: useStore.getState().recentFiles,
   174	    scrollPositions: useStore.getState().scrollPositions ?? null,
   175	    embedScrollPositions: useStore.getState().embedScrollPositions ?? null,
   176	    capabilities: serializeCapabilities(),
   177	    rouletteSectors: es.config.rouletteSectors ?? null,
   178	    rouletteHotkey: es.config.rouletteHotkey ?? null,
   179	    rouletteForm: es.config.rouletteForm ?? null,
   180	    roulettePosition: es.config.roulettePosition ?? null,
   181	    noticeDuration: es.config.noticeDuration ?? null,
   182	    htmlToolbarItems: es.config.htmlToolbarItems ?? null,
   183	    // 读实时值：本次会话分裂/调整的比例要能持久化
   184	    paneLayout: useStore.getState().paneLayoutJson(),
   185	    railPinHidden: es.config.railPinHidden ?? null,
   186	    propertyBar: es.config.propertyBar ?? null,
   187	    // 阅读空间栏「设为默认」规格（layout-portal 6.1）
   188	    railViewSpec: useStore.getState().railViewSpec,
   189	    // 悬浮预览窗双轨开关（layout-portal 8.1）
   190	    previewSettings: useStore.getState().previewSettings,
   191	    // AI 视图改写规格（layout-portal 9.1）
   192	    aiViewSpec: useStore.getState().captureViewSpec(),
   193	  };
   194	  try {
   195	    await invoke("save_config", { config });
   196	  } catch (e) {
   197	    log.error("Config", "Failed to save config", e);
   198	  }
   199	}
   200	
   201	/** 文档属性面板样式桥接：设置改了显示样式立即换形态（字段内容与顺序不变）。 */
   202	export function applyPropertyBarConfig(config: PropertyBarConfig): void {
   203	  useDocPropertyPanelStore
   204	    .getState()
   205	    .setVariant(config.displayStyle === "dual" ? "B" : "A");
   206	}
   207	
   208	/**
   209	 * 启动时恢复工作区布局树（layout-portal 3.1）。
   210	 *
   211	 * 持久化的是每格页签的文件路径；这里按路径走 open_file_direct 把页签重建
   212	 * 出来，再按原结构还原。解析失败 / 文件已不在都退化处理，绝不抛错。
   213	 * 只在首次配置加载时跑一次（reloadAppConfig 重入由 guard 拦掉）。
   214	 */
   215	let paneRestoreStarted = false;
   216	
   217	async function restorePaneLayout(
   218	  paneLayoutJson: string | null | undefined,
   219	): Promise<void> {
   220	  if (paneRestoreStarted) return;
   221	  paneRestoreStarted = true;
   222	  if (!paneLayoutJson) return;
   223	
   224	  const parsed = parseSerializedLayout(paneLayoutJson);
   225	  if (!parsed) {
   390	    headingColors: raw.headingColors
   391	      ? (raw.headingColors as unknown as AppConfig["headingColors"])
   392	      : undefined,
   393	    headingFonts: normalizeHeadingFonts(raw.headingFonts),
   394	    readerFontSize: raw.readerFontSize ?? 17,
   395	    readerWidth: raw.readerWidth ?? 1080,
   396	    readerSkin: raw.readerSkin ?? "paper",
   397	    defaultSavePath: raw.defaultSavePath ?? null,
   398	    ollamaEndpoint: raw.ollamaEndpoint ?? "http://localhost:11434",
   399	    openaiEndpoint: raw.openaiEndpoint ?? "https://api.openai.com",
   400	    openaiModel: raw.openaiModel ?? "gpt-4o-mini",
   401	    translationProvider:
   402	      (raw.translationProvider as AppConfig["translationProvider"]) ?? "ollama",
   403	    langPair: {
   404	      source: raw.sourceLang ?? "en",
   405	      target: raw.targetLang ?? "zh-CN",
   406	    },
   407	    theme: (raw.theme as Theme) ?? "system",
   408	    aiConfirmDensity:
   409	      (raw.aiConfirmDensity as AppConfig["aiConfirmDensity"]) ??
   410	      "session-silent",
   411	    iconLabel: (raw.iconLabel as AppConfig["iconLabel"]) ?? "text",
   412	    sidebarLeftVisible: raw.sidebarLeftVisible ?? true,
   413	    sidebarRightVisible: raw.sidebarRightVisible ?? false,
   414	    sidebarLeftWidth: raw.sidebarLeftWidth ?? 220,
   415	    sidebarRightWidth: raw.sidebarRightWidth ?? 320,
   416	    horizontalSplitRatio: raw.horizontalSplitRatio ?? 0.5,
   417	    verticalSplitRatio: raw.verticalSplitRatio ?? 0.5,
   418	    recentFiles: raw.recentFiles ?? [],
   419	    capabilities: raw.capabilities ?? {},
   420	    rouletteSectors: normalizeRouletteSectors(raw.rouletteSectors),
   421	    rouletteHotkey: raw.rouletteHotkey ? raw.rouletteHotkey : null,
   422	    rouletteForm:
   423	      raw.rouletteForm === "hub" || raw.rouletteForm === "disk"
   424	        ? raw.rouletteForm
   425	        : null,
   426	    roulettePosition:
   427	      raw.roulettePosition &&
   428	      Number.isFinite(raw.roulettePosition.x) &&
   429	      Number.isFinite(raw.roulettePosition.y)
   430	        ? { x: raw.roulettePosition.x, y: raw.roulettePosition.y }
   431	        : null,
   432	    noticeDuration: normalizeNoticeDuration(raw.noticeDuration),
   433	    htmlToolbarItems: normalizeHtmlToolbarItems(raw.htmlToolbarItems),
   434	    railPinHidden: raw.railPinHidden ?? false,
   435	    propertyBar: propertyBarConfig,
   436	  };
   437	
   438	  const es = useEditorStore.getState();
   439	  es.setConfig(config);
   440	  es.setFontSize(config.fontSize ?? 17);
   441	  es.setConfigLoaded(true);
   442	  useDocPropertyPanelStore
   443	    .getState()
   444	    .setVariant(propertyBarConfig.displayStyle === "dual" ? "B" : "A");
   445	
   446	  // Restore scroll positions (A-9)
   447	  useStore.getState().setScrollPositions(raw.scrollPositions ?? {});
   448	  // Restore embedded scroll freezes (D10 / B5b)
   449	  useStore.getState().setEmbedScrollPositions(raw.embedScrollPositions ?? {});
   450	
   451	  // Restore sidebar state
   452	  if (config.sidebarLeftVisible !== undefined) {
   453	    useStore.getState().setSidebarLeftVisible(config.sidebarLeftVisible);
   454	  }
   455	  if (config.sidebarRightVisible !== undefined) {
   456	    useStore.getState().setSidebarRightVisible(config.sidebarRightVisible);
   457	  }
   458	
   459	  // Restore split ratios
   460	  const splitRatios = {
   461	    horizontal: config.horizontalSplitRatio,
   462	    vertical: config.verticalSplitRatio,
   463	  };
   464	  useStore.getState().setSplitRatios(splitRatios);
   465	
   466	  // Sync recent files
   467	  if (config.recentFiles && config.recentFiles.length > 0) {
   468	    const { recentFiles } = useStore.getState();
   469	    if (recentFiles.length === 0) {
   470	      // 整体赋值而不是逐条 addRecentFile：那个 API 是前置插入，逐条加会把
   471	      // 持久化的「最近优先」顺序翻反——重启后门户 hero 会显示最旧的一份。
   472	      // 直接放回数组也保住了原来的 openedAt（否则相对时间全变成「刚刚」）。
   473	      useStore.setState({
   474	        recentFiles: config.recentFiles
   475	          .map((f) => ({
   476	            path: f.path,
   477	            title: f.title,
   478	            openedAt: f.openedAt,
   479	            excerpt: f.excerpt,
   480	          }))
   481	          .slice(0, 10),
   482	      });
   483	    }
   484	  }
   485	

exec
/bin/zsh -c "rg -n \"pinnedPaths\" src src-tauri -g '*.ts' -g '*.tsx' -g '*.rs'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/gridView.ts:216:  pinnedPaths: readonly string[];
src/lib/gridView.ts:225:  const pinned = new Set(filter.pinnedPaths);
src/stores/index.ts:238:  pinnedPaths: string[];
src/stores/index.ts:445:  pinnedPaths: [] as string[],
src/stores/index.ts:880:      pinnedPaths: s.pinnedPaths.includes(path)
src/stores/index.ts:881:        ? s.pinnedPaths.filter((p) => p !== path)
src/stores/index.ts:882:        : [...s.pinnedPaths, path],
src/components/GridView.tsx:62:  const pinnedPaths = useStore((s) => s.pinnedPaths);
src/components/GridView.tsx:82:      pinnedPaths,
src/components/GridView.tsx:92:    pinnedPaths,
src/components/GridView.tsx:499:    const pinned = pinnedPaths.includes(item.path);
src/components/Rail/ReadingRail.tsx:811:  const pinnedPaths = useStore((s) => s.pinnedPaths);
src/components/Rail/ReadingRail.tsx:1260:        return recentFiles.filter((f) => pinnedPaths.includes(f.path));
src/components/Rail/ReadingRail.tsx:1264:    [activeTabId, tabs, recentFiles, pinnedPaths],
src/components/Rail/ReadingRail.tsx:1296:              pinned={pinnedPaths.includes(m.item.path)}
src/components/Rail/ReadingRail.tsx:1606:                pinned={pinnedPaths.includes(m.hit.path)}
src/__tests__/gridView.test.ts:210:      pinnedPaths: [],
src/__tests__/gridView.test.ts:223:      pinnedPaths: [],
src/__tests__/gridView.test.ts:236:      pinnedPaths: ["/u/report.html"],
src/__tests__/gridView.test.ts:247:        pinnedPaths: [],
src/__tests__/gridView.test.ts:254:      pinnedPaths: ["/u/design-notes.md", "/u/report.html"],

exec
/bin/zsh -c 'rg -n "pinned|favorite|收藏" src-tauri/src/config.rs src/hooks/useConfig.ts src/types/index.ts | head -n 120' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/types/index.ts:127:export type CaptureStatus = "closed" | "normal" | "pinned" | "capsule";
src/hooks/useConfig.ts:113:    pinnedAndRecentOnly?: boolean | null;
src/hooks/useConfig.ts:114:    pinnedSegmentScale?: number | null;
src-tauri/src/config.rs:140:    pub rail_pinned_width: Option<f64>,
src-tauri/src/config.rs:152:    pub pinned_and_recent_only: Option<bool>,
src-tauri/src/config.rs:154:    pub pinned_segment_scale: Option<f64>,
src-tauri/src/config.rs:647:            spec.rail_pinned_width,
src-tauri/src/config.rs:652:            "aiViewSpec.pinnedSegmentScale",
src-tauri/src/config.rs:653:            spec.pinned_segment_scale,
src-tauri/src/config.rs:1507:            rail_pinned_width: Some(300.0),
src-tauri/src/config.rs:1513:            pinned_and_recent_only: Some(true),
src-tauri/src/config.rs:1514:            pinned_segment_scale: Some(1.25),
src-tauri/src/config.rs:1529:        assert_eq!(loaded.rail_pinned_width, Some(300.0));
src-tauri/src/config.rs:1530:        assert_eq!(loaded.pinned_segment_scale, Some(1.25));
src-tauri/src/config.rs:1549:            pinned_segment_scale: Some(2.0),

exec
/bin/zsh -c "rg -n \"function mergeRecentFileList|export function mergeRecentFileList\" src -g '*.ts'; rg -n \"mergeRecentFileList\" src/lib src/stores -g '*.ts'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/lib/railCards.ts:181:export function mergeRecentFileList(
src/stores/index.ts:29:  mergeRecentFileList,
src/stores/index.ts:904:      recentFiles: mergeRecentFileList(s.recentFiles, incoming, 10),
src/lib/railCards.ts:181:export function mergeRecentFileList(

exec
/bin/zsh -c "nl -ba src/lib/railCards.ts | sed -n '1,100p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/**
     2	 * 阅读空间卡片规格（layout-portal 7.1）——纯逻辑层。
     3	 *
     4	 * 密度三档的高度、卡片高度滑杆的夹取、meta 行、缩略图类型判定与指纹缓存
     5	 * 全部放在这里，无 DOM / 无 store。渲染侧只消费结果，渲染占位图本身留在
     6	 * ReadingRail.tsx（这样才能复用 `Icon` 与 `--type-*` 变量）。
     7	 */
     8	
     9	import { fileTypeOf } from "./fileType";
    10	import type { RecentFile, ScrollPosition } from "../types";
    11	import type { RailDensity } from "./railView";
    12	
    13	/** 三档密度高度（严格像素值，e2e 会量）。 */
    14	export const DENSITY_HEIGHT: Record<RailDensity, number> = {
    15	  compact: 32,
    16	  comfortable: 56,
    17	  card: 112,
    18	};
    19	
    20	/** 卡片高度滑杆上下界；默认值即卡片档的 112。 */
    21	export const CARD_MIN = 88;
    22	export const CARD_MAX = 160;
    23	
    24	/** 4:3 缩略图盒（卡片右侧，严格 64×48）。 */
    25	export const CARD_RATIO_W = 64;
    26	export const CARD_RATIO_H = 48;
    27	
    28	/** 夹取卡片高度：非有限值回默认 112，越界贴边，小数取整。 */
    29	export function clampCardHeight(n: number): number {
    30	  if (!Number.isFinite(n)) return DENSITY_HEIGHT.card;
    31	  return Math.min(CARD_MAX, Math.max(CARD_MIN, Math.round(n)));
    32	}
    33	
    34	/** 缩略图盒的唯一尺寸来源——e2e 与组件都从这里取 4:3 契约。 */
    35	export function thumbnailBox(): { w: number; h: number } {
    36	  return { w: CARD_RATIO_W, h: CARD_RATIO_H };
    37	}
    38	
    39	/** 父路径（不含文件名）；根目录返回 "/"，无路径分隔符返回空串。 */
    40	export function parentPathOf(path: string): string {
    41	  if (!path) return "";
    42	  const idx = path.lastIndexOf("/");
    43	  if (idx < 0) return "";
    44	  if (idx === 0) return "/";
    45	  return path.slice(0, idx);
    46	}
    47	
    48	/**
    49	 * 父文件夹名：`/Users/x/Documents/Notes/a.md` → `Notes`。
    50	 * 根目录回 `/`，无分隔符回空串——卡片 meta 只显示文件夹名，不显示完整路径。
    51	 */
    52	export function parentFolderNameOf(path: string): string {
    53	  const parent = parentPathOf(path);
    54	  if (!parent) return "";
    55	  if (parent === "/") return "/";
    56	  const name = parent.split("/").filter(Boolean).pop();
    57	  return name ?? parent;
    58	}
    59	
    60	const HTML_ENTITIES: Record<string, string> = {
    61	  amp: "&",
    62	  lt: "<",
    63	  gt: ">",
    64	  quot: '"',
    65	  apos: "'",
    66	  nbsp: " ",
    67	  ndash: "–",
    68	  mdash: "—",
    69	  hellip: "…",
    70	  copy: "©",
    71	  reg: "®",
    72	  trade: "™",
    73	  laquo: "«",
    74	  raquo: "»",
    75	};
    76	
    77	/**
    78	 * 纯文本化：去掉 `<script>` / `<style>` 整块、所有标签与基本实体，再压平空白。
    79	 * HTML 摘要与本机最近文件摘要共用，保证卡片不露 `<tag>` 源码。
    80	 */
    81	export function plainTextOf(html: string): string {
    82	  return html
    83	    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    84	    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    85	    .replace(/<!--[\s\S]*?-->/g, " ")
    86	    .replace(/<[^>]*>/g, " ")
    87	    .replace(
    88	      /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
    89	      (match, entity: string) => {
    90	        const key = entity.toLowerCase();
    91	        if (!key.startsWith("#")) return HTML_ENTITIES[key] ?? match;
    92	        const code = key.startsWith("#x")
    93	          ? Number.parseInt(key.slice(2), 16)
    94	          : Number.parseInt(key.slice(1), 10);
    95	        // 越界 / 代理区码点会让 String.fromCodePoint 抛错，原样保留实体
    96	        const valid =
    97	          Number.isFinite(code) &&
    98	          code >= 0 &&
    99	          code <= 0x10ffff &&
   100	          !(code >= 0xd800 && code <= 0xdfff);

exec
/bin/zsh -c "nl -ba src/lib/railCards.ts | sed -n '160,235p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   160	        .replace(/^[ \t]*\|/, "")
   161	        .replace(/\|[ \t]*$/, "")
   162	        .replace(/[ \t]*\|[ \t]*/g, " "),
   163	    )
   164	    .join("\n");
   165	
   166	  // 分割线
   167	  out = out.replace(/^[ \t]{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/gm, "");
   168	
   169	  return out.replace(/\s+/g, " ").trim();
   170	}
   171	
   172	function openedAtValue(file: RecentFile): number {
   173	  const ms = Date.parse(file.openedAt ?? "");
   174	  return Number.isFinite(ms) ? ms : 0;
   175	}
   176	
   177	/**
   178	 * 合并最近文件：按 path 去重，按 openedAt 倒序，截到 cap。本机扫描结果与
   179	 * 会话内打开的记录同 path 时保留历史摘要；历史条目没有摘要时采纳扫描摘要。
   180	 */
   181	export function mergeRecentFileList(
   182	  existing: RecentFile[],
   183	  incoming: RecentFile[],
   184	  cap = 10,
   185	): RecentFile[] {
   186	  const byPath = new Map<string, RecentFile>();
   187	  for (const file of existing) {
   188	    if (file?.path) byPath.set(file.path, file);
   189	  }
   190	  for (const file of incoming) {
   191	    if (!file?.path) continue;
   192	    const prev = byPath.get(file.path);
   193	    if (!prev) {
   194	      byPath.set(file.path, file);
   195	      continue;
   196	    }
   197	    const newer = openedAtValue(file) > openedAtValue(prev);
   198	    // 旧配置里的历史条目可能没有摘要；扫描读到了就用上，别让卡片空着
   199	    const adoptExcerpt = !prev.excerpt && !!file.excerpt;
   200	    if (newer || adoptExcerpt) {
   201	      byPath.set(file.path, {
   202	        ...prev,
   203	        openedAt: newer ? file.openedAt : prev.openedAt,
   204	        excerpt: prev.excerpt ?? file.excerpt,
   205	      });
   206	    }
   207	  }
   208	  return Array.from(byPath.values())
   209	    .sort((a, b) => openedAtValue(b) - openedAtValue(a))
   210	    .slice(0, Math.max(0, cap));
   211	}
   212	
   213	/** 相对时间（10 分钟前 / 昨天 / 6月20日）；`now` 可注入以便单测确定。 */
   214	export function relativeDate(iso: string, now: number = Date.now()): string {
   215	  const time = Date.parse(iso);
   216	  if (!Number.isFinite(time)) return "";
   217	  const diff = Math.max(0, now - time);
   218	  const minutes = Math.floor(diff / 60000);
   219	  if (minutes < 1) return "刚刚";
   220	  if (minutes < 60) return `${minutes} 分钟前`;
   221	  const hours = Math.floor(minutes / 60);
   222	  if (hours < 24) return `${hours} 小时前`;
   223	  const days = Math.floor(hours / 24);
   224	  if (days === 1) return "昨天";
   225	  if (days < 30) return `${days} 天前`;
   226	  return new Date(time).toLocaleDateString("zh-CN", {
   227	    month: "long",
   228	    day: "numeric",
   229	  });
   230	}
   231	
   232	export interface TaskProgress {
   233	  done: number;
   234	  total: number;
   235	}

exec
/bin/zsh -c "nl -ba src/lib/gridView.ts | sed -n '180,245p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   180	export interface TileSizeContext {
   181	  /** 该条目是否被收藏。 */
   182	  pinned: boolean;
   183	  /** 「继续阅读」条目路径；null = 无。 */
   184	  continuePath: string | null;
   185	}
   186	
   187	/**
   188	 * tile 尺寸（确定性规则）：
   189	 * 1. 收藏、或等于「继续阅读」条目 → `large`（2×2）
   190	 * 2. 有缩略图类型、或摘要非空 → `medium`（2×1）
   191	 * 3. 其余（无图且无摘要）→ `small`（1×1）
   192	 */
   193	export function tileSizeOf(
   194	  item: RecentFile,
   195	  ctx: TileSizeContext,
   196	): GridTileSize {
   197	  if (
   198	    ctx.pinned ||
   199	    (ctx.continuePath !== null && item.path === ctx.continuePath)
   200	  ) {
   201	    return "large";
   202	  }
   203	  if (thumbKindOf(item) !== null || (item.excerpt ?? "").trim() !== "") {
   204	    return "medium";
   205	  }
   206	  return "small";
   207	}
   208	
   209	export interface GridFilter {
   210	  /** 严格类型过滤；null = 全部。 */
   211	  type: FileTypeKind | null;
   212	  /** 标题大小写不敏感子串；空串 = 不过滤。 */
   213	  query: string;
   214	  /** 只留收藏条目。 */
   215	  pinnedOnly: boolean;
   216	  pinnedPaths: readonly string[];
   217	}
   218	
   219	/** 筛选：类型严格相等、query 走标题子串、pinnedOnly 只留集合内。 */
   220	export function filterGridItems(
   221	  items: RecentFile[],
   222	  filter: GridFilter,
   223	): RecentFile[] {
   224	  const q = filter.query.trim().toLowerCase();
   225	  const pinned = new Set(filter.pinnedPaths);
   226	  return items.filter((item) => {
   227	    if (filter.type !== null && fileTypeOf(item.path) !== filter.type) {
   228	      return false;
   229	    }
   230	    if (filter.pinnedOnly && !pinned.has(item.path)) return false;
   231	    if (q !== "" && !item.title.toLowerCase().includes(q)) return false;
   232	    return true;
   233	  });
   234	}

exec
/bin/zsh -c "nl -ba src-tauri/src/config.rs | sed -n '365,440p;920,990p;1015,1050p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   365	    match std::fs::read_to_string(path) {
   366	        Ok(data) => serde_json::from_str(&data)
   367	            .map(Some)
   368	            .map_err(|e| json_err(&format!("parse {}", path.display()), e)),
   369	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
   370	        Err(e) => Err(io_err(&format!("read {}", path.display()), e)),
   371	    }
   372	}
   373	
   374	/// 损坏的文件改名留档后按缺失处理，避免一次手滑就让应用起不来。
   375	fn read_json_or_quarantine(path: &Path) -> Option<Value> {
   376	    match read_json(path) {
   377	        Ok(value) => value,
   378	        Err(e) => {
   379	            warn!(error = %e, path = %path.display(), "配置文件无法解析，已改名留档");
   380	            let _ = std::fs::rename(path, path.with_extension("json.bak"));
   381	            None
   382	        }
   383	    }
   384	}
   385	
   386	fn ensure_defaults(base: &Path) -> Result<(), AppError> {
   387	    let path = defaults_path(base);
   388	    if path.exists() {
   389	        return Ok(());
   390	    }
   391	    let data = serde_json::to_vec_pretty(&settings_value(&AppConfig::default())?)
   392	        .map_err(|e| json_err("defaults", e))?;
   393	    atomic_write(&path, &data)
   394	}
   395	
   396	/// 设置字段（不含派生状态），用于写入 user 层与快照。
   397	fn settings_value(config: &AppConfig) -> Result<Value, AppError> {
   398	    let mut value = serde_json::to_value(config).map_err(|e| json_err("config", e))?;
   399	    if let Value::Object(map) = &mut value {
   400	        map.remove("recentFiles");
   401	        map.remove("scrollPositions");
   402	        map.remove("embedScrollPositions");
   403	    }
   404	    Ok(value)
   405	}
   406	
   407	fn state_value(config: &AppConfig) -> Result<Value, AppError> {
   408	    let recent_files = serde_json::to_value(config.recent_files.clone().unwrap_or_default())
   409	        .map_err(|e| json_err("recentFiles", e))?;
   410	    let scroll_positions =
   411	        serde_json::to_value(config.scroll_positions.clone().unwrap_or_default())
   412	            .map_err(|e| json_err("scrollPositions", e))?;
   413	    let embed_scroll_positions =
   414	        serde_json::to_value(config.embed_scroll_positions.clone().unwrap_or_default())
   415	            .map_err(|e| json_err("embedScrollPositions", e))?;
   416	    Ok(serde_json::json!({
   417	        "recentFiles": recent_files,
   418	        "scrollPositions": scroll_positions,
   419	        "embedScrollPositions": embed_scroll_positions,
   420	    }))
   421	}
   422	
   423	fn effective_config(
   424	    defaults: Value,
   425	    user: Option<Value>,
   426	    state: Option<Value>,
   427	) -> Result<AppConfig, AppError> {
   428	    let mut merged = merge_json(&defaults, user.as_ref().unwrap_or(&Value::Null));
   429	    if let (Value::Object(map), Some(Value::Object(state))) = (&mut merged, state) {
   430	        for key in ["recentFiles", "scrollPositions", "embedScrollPositions"] {
   431	            if let Some(value) = state.get(key) {
   432	                map.insert(key.to_string(), value.clone());
   433	            }
   434	        }
   435	    }
   436	    serde_json::from_value(merged).map_err(|e| json_err("effective config", e))
   437	}
   438	
   439	/// 旧 `app_config.json` 拆成 user + state。旧文件保留不动，靠 user 层是否
   440	/// 存在判断是否需要迁移，因此重复调用天然幂等。
   920	- `list_snapshots`：返回快照文件名，最旧在前。
   921	
   922	## 可改键与取值范围（camelCase）
   923	
   924	| 键 | 范围 / 取值 |
   925	| --- | --- |
   926	| `fontSize` | 8–96 |
   927	| `readerFontSize` | 8–96 |
   928	| `readerWidth` | 480–2400 |
   929	| `sidebarLeftWidth` / `sidebarRightWidth` | 0–800 |
   930	| `horizontalSplitRatio` / `verticalSplitRatio` | 0–1 |
   931	| `theme` | `light` / `dark` / `warm` / `system` |
   932	| `aiConfirmDensity` | `always` / `session-silent` / `never` |
   933	| `readerSkin` | `paper` / `plain` |
   934	| `propertyBar.displayStyle` | `list` / `dual` |
   935	| `propertyBar.displayDefault.preview` / `.edit` | `show` / `collapse` / `hide` |
   936	| `propertyBar.newDocVisible` | `true` / `false` |
   937	| `openaiEndpoint` / `openaiModel` | 任意字符串 |
   938	
   939	## 禁止项
   940	
   941	- API key 只存操作系统 keyring，绝不写进配置文件、日志或本文件。
   942	- 不要手改 `state/state.json`；它由应用维护。
   943	"#;
   944	
   945	/// 应用配置目录（用户层根目录）。扩展点扫描复用同一目录解析。
   946	pub fn config_base(app: &AppHandle) -> PathBuf {
   947	    app.path()
   948	        .app_config_dir()
   949	        .unwrap_or_else(|_| PathBuf::from("."))
   950	}
   951	
   952	const LEGACY_BUNDLE_IDENTIFIER: &str = "com.clairis.app";
   953	
   954	/// 更早版本把配置放在旧 bundle id 目录下；只读复制，旧文件保留。
   955	async fn migrate_legacy_bundle(app: &AppHandle, base: &Path) {
   956	    if user_path(base).exists() || legacy_path(base).exists() {
   957	        return;
   958	    }
   959	    let Ok(config_dir) = app.path().config_dir() else {
   960	        return;
   961	    };
   962	    let legacy = config_dir.join(LEGACY_BUNDLE_IDENTIFIER).join(LEGACY_FILE);
   963	    if legacy == legacy_path(base) || !legacy.exists() {
   964	        return;
   965	    }
   966	    let Ok(data) = tokio::fs::read(&legacy).await else {
   967	        return;
   968	    };
   969	    if atomic_write(&legacy_path(base), &data).is_ok() {
   970	        info!(from = %legacy.display(), "旧 bundle 配置已复制到当前目录");
   971	    }
   972	}
   973	
   974	/// Load config from disk, return default on missing/corrupt.
   975	pub async fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
   976	    let base = config_base(app);
   977	    migrate_legacy_bundle(app, &base).await;
   978	    load_config_at(&base)
   979	}
   980	
   981	/// Save config to disk.
   982	pub async fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
   983	    save_config_at(&config_base(app), config)
   984	}
   985	
   986	pub async fn list_config_snapshots(app: &AppHandle) -> Result<Vec<String>, AppError> {
   987	    list_snapshots(&config_base(app))
   988	}
   989	
   990	pub async fn restore_config_snapshot(app: &AppHandle, name: &str) -> Result<AppConfig, AppError> {
  1015	        }
  1016	    });
  1017	}
  1018	
  1019	/// Get API key from system keyring.
  1020	pub async fn get_api_key(service: &str, account: &str) -> Result<Option<String>, AppError> {
  1021	    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
  1022	        context: "create entry".into(),
  1023	        source: e.to_string(),
  1024	    })?;
  1025	    match entry.get_password() {
  1026	        Ok(key) => Ok(Some(key)),
  1027	        Err(keyring::Error::NoEntry) => Ok(None),
  1028	        Err(e) => Err(AppError::Keyring {
  1029	            context: "get password".into(),
  1030	            source: e.to_string(),
  1031	        }),
  1032	    }
  1033	}
  1034	
  1035	/// Set API key in system keyring.
  1036	pub async fn set_api_key(service: &str, account: &str, key: &str) -> Result<(), AppError> {
  1037	    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
  1038	        context: "create entry".into(),
  1039	        source: e.to_string(),
  1040	    })?;
  1041	    entry.set_password(key).map_err(|e| AppError::Keyring {
  1042	        context: "set password".into(),
  1043	        source: e.to_string(),
  1044	    })?;
  1045	    Ok(())
  1046	}
  1047	
  1048	/// Delete API key from system keyring.
  1049	pub async fn delete_api_key(service: &str, account: &str) -> Result<(), AppError> {
  1050	    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {

exec
/bin/zsh -c "rg -n \"fn save_config_at|state_value\\(|state_path\\(\" src-tauri/src/config.rs | head -n 80; nl -ba src-tauri/src/config.rs | sed -n '760,860p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
282:fn state_path(base: &Path) -> PathBuf {
407:fn state_value(config: &AppConfig) -> Result<Value, AppError> {
453:    let state = serde_json::to_vec_pretty(&state_value(&config)?)
456:    atomic_write(&state_path(base), &state)?;
842:    let state = read_json_or_quarantine(&state_path(base));
846:pub fn save_config_at(base: &Path, config: &AppConfig) -> Result<(), AppError> {
853:        serde_json::to_vec_pretty(&state_value(config)?).map_err(|e| json_err("state", e))?;
855:    atomic_write(&state_path(base), &state)?;
883:        serde_json::to_vec_pretty(&state_value(&config)?).map_err(|e| json_err("state", e))?;
885:    atomic_write(&state_path(base), &state)?;
1119:        let state = std::fs::read_to_string(state_path(base)).unwrap();
1293:        assert!(state_path(base).exists());
1328:        std::fs::create_dir_all(state_path(base).parent().unwrap()).unwrap();
1330:            state_path(base),
1370:        let state = std::fs::read_to_string(state_path(base)).unwrap();
   760	
   761	/// 快照文件名只接受 `settings-` 前缀与安全字符，拒绝路径穿越。
   762	fn is_safe_snapshot_name(name: &str) -> bool {
   763	    name.starts_with(SNAPSHOT_PREFIX)
   764	        && name.ends_with(".json")
   765	        && name
   766	            .chars()
   767	            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
   768	}
   769	
   770	/// 把当前 user 层复制进 snapshots/。user 层不存在时跳过。
   771	fn snapshot_user(base: &Path) -> Result<(), AppError> {
   772	    let source = user_path(base);
   773	    if !source.exists() {
   774	        return Ok(());
   775	    }
   776	    let data = std::fs::read(&source).map_err(|e| io_err("read user config", e))?;
   777	    atomic_write(&snapshots_dir(base).join(snapshot_name()), &data)
   778	}
   779	
   780	/// 只保留最新 10 份；文件名按时间升序，因此保留字典序最大的 10 个。
   781	fn prune_snapshots(base: &Path) -> Result<(), AppError> {
   782	    let mut names = list_snapshots(base)?;
   783	    if names.len() <= SNAPSHOT_LIMIT {
   784	        return Ok(());
   785	    }
   786	    names.sort();
   787	    let dir = snapshots_dir(base);
   788	    for name in &names[..names.len() - SNAPSHOT_LIMIT] {
   789	        std::fs::remove_file(dir.join(name)).map_err(|e| io_err("prune snapshot", e))?;
   790	    }
   791	    Ok(())
   792	}
   793	
   794	/// 快照名列表，按时间升序（最旧在前）。
   795	pub fn list_snapshots(base: &Path) -> Result<Vec<String>, AppError> {
   796	    let dir = snapshots_dir(base);
   797	    let entries = match std::fs::read_dir(&dir) {
   798	        Ok(entries) => entries,
   799	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
   800	        Err(e) => return Err(io_err("list snapshots", e)),
   801	    };
   802	    let mut names = Vec::new();
   803	    for entry in entries {
   804	        let entry = entry.map_err(|e| io_err("list snapshots", e))?;
   805	        let name = entry.file_name().to_string_lossy().into_owned();
   806	        if is_safe_snapshot_name(&name) && entry.path().is_file() {
   807	            names.push(name);
   808	        }
   809	    }
   810	    names.sort();
   811	    Ok(names)
   812	}
   813	
   814	/// 恢复前先给当前状态拍一份快照，因此「恢复」本身也可再回滚。
   815	pub fn restore_snapshot(base: &Path, name: &str) -> Result<AppConfig, AppError> {
   816	    if !is_safe_snapshot_name(name) {
   817	        return Err(AppError::Validation {
   818	            context: "snapshot".into(),
   819	            message: format!("非法的快照名 {name}"),
   820	        });
   821	    }
   822	    let source = snapshots_dir(base).join(name);
   823	    let data = std::fs::read(&source).map_err(|e| io_err("read snapshot", e))?;
   824	    // 先确认快照可解析，避免把坏内容写进 user 层。
   825	    serde_json::from_slice::<Value>(&data).map_err(|e| json_err("snapshot", e))?;
   826	    snapshot_user(base)?;
   827	    atomic_write(&user_path(base), &data)?;
   828	    prune_snapshots(base)?;
   829	    load_config_at(base)
   830	}
   831	
   832	// ── 加载 / 保存 ──────────────────────────────────────────────
   833	
   834	pub fn load_config_at(base: &Path) -> Result<AppConfig, AppError> {
   835	    ensure_defaults(base)?;
   836	    migrate_legacy(base)?;
   837	    let code_defaults =
   838	        serde_json::to_value(AppConfig::default()).map_err(|e| json_err("code defaults", e))?;
   839	    let file_defaults = read_json_or_quarantine(&defaults_path(base)).unwrap_or(Value::Null);
   840	    let defaults = merge_json(&code_defaults, &file_defaults);
   841	    let user = read_json_or_quarantine(&user_path(base));
   842	    let state = read_json_or_quarantine(&state_path(base));
   843	    effective_config(defaults, user, state)
   844	}
   845	
   846	pub fn save_config_at(base: &Path, config: &AppConfig) -> Result<(), AppError> {
   847	    validate_config(config)?;
   848	    ensure_defaults(base)?;
   849	    snapshot_user(base)?;
   850	    let user = serde_json::to_vec_pretty(&settings_value(config)?)
   851	        .map_err(|e| json_err("user config", e))?;
   852	    let state =
   853	        serde_json::to_vec_pretty(&state_value(config)?).map_err(|e| json_err("state", e))?;
   854	    atomic_write(&user_path(base), &user)?;
   855	    atomic_write(&state_path(base), &state)?;
   856	    prune_snapshots(base)?;
   857	    Ok(())
   858	}
   859	
   860	/// 把 JSON 合并补丁打进 user 层，复用 C2 的校验 / 快照 / 原子写语义。

codex
第二轮核查发现，“全文检索”这一称谓也不准确：现有命令只读取每个文件前 64 KiB，且有深度和文件数上限；它返回的 `openedAt` 实际来自文件修改时间。这会影响 ⌘P 复用该命令时的范围与排序承诺。
exec
/bin/zsh -c "rg -n \"pub fn is_supported_document|fn is_supported_document|is_binary_extension|SUPPORTED\" src-tauri/src/commands/file.rs | head -n 80; nl -ba src-tauri/src/commands/file.rs | sed -n '1,110p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
53:pub fn is_binary_extension(path: &Path) -> bool {
61:pub(crate) fn is_supported_document(path: &Path) -> bool {
143:        let content = if is_binary_extension(&path_buf) {
184:        let content = if is_binary_extension(&read_path) {
475:                is_binary_extension(Path::new(name)),
512:            assert!(!is_binary_extension(p), "doc ext {ext} must not be binary");
     1	use std::fs;
     2	use std::path::{Path, PathBuf};
     3	
     4	use serde::Serialize;
     5	use tauri::AppHandle;
     6	use tauri_plugin_dialog::DialogExt;
     7	use tempfile::NamedTempFile;
     8	use tracing::info;
     9	
    10	use crate::errors::AppError;
    11	
    12	#[derive(Serialize)]
    13	pub struct FileResult {
    14	    pub content: String,
    15	    pub path: String,
    16	    pub file_size: u64,
    17	}
    18	
    19	#[derive(Serialize)]
    20	pub struct SaveResult {
    21	    pub path: String,
    22	}
    23	
    24	const SOURCE_READ_ONLY_LIMIT: u64 = 2 * 1024 * 1024; // 2MB
    25	const SOURCE_MODE_LIMIT: u64 = 500 * 1024; // 500KB
    26	
    27	const DOC_EXTENSIONS: &[&str] = &[
    28	    "md", "markdown", "mdown", "mdwn", "html", "htm", "txt", "log", "css", "py", "pyw", "json",
    29	    "jsonc", "js", "mjs", "cjs", "jsx", "ts", "tsx", "yaml", "yml", "csv", "sh", "bash", "zsh",
    30	    "fish", "ps1",
    31	];
    32	
    33	const IMAGE_EXTENSIONS: &[&str] = &[
    34	    "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif", "heif", "heic",
    35	];
    36	
    37	const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "wav", "flac", "ogg", "aac"];
    38	
    39	const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "webm", "m4v", "mkv", "avi"];
    40	
    41	const BINARY_EXTENSIONS: &[&str] = &[
    42	    "pdf", "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif", "heif", "heic", "mp4",
    43	    "mov", "webm", "m4v", "mkv", "avi", "mp3", "m4a", "wav", "flac", "ogg", "aac",
    44	];
    45	
    46	fn extension_of(path: &Path) -> Option<String> {
    47	    path.extension()
    48	        .and_then(|e| e.to_str())
    49	        .map(|e| e.to_ascii_lowercase())
    50	}
    51	
    52	/// Media/binary files are opened without reading content (rendered via asset protocol).
    53	pub fn is_binary_extension(path: &Path) -> bool {
    54	    matches!(
    55	        extension_of(path),
    56	        Some(ref ext) if BINARY_EXTENSIONS.contains(&ext.as_str())
    57	    )
    58	}
    59	
    60	/// 应用支持的文档扩展名（与打开对话框的「文档」过滤一致）。本机最近文件扫描复用。
    61	pub(crate) fn is_supported_document(path: &Path) -> bool {
    62	    matches!(
    63	        extension_of(path),
    64	        Some(ref ext) if DOC_EXTENSIONS.contains(&ext.as_str())
    65	    )
    66	}
    67	
    68	/// 在系统文件管理器中显示给定路径（定位）。只定位，不读取文件内容。
    69	#[tauri::command]
    70	pub async fn reveal_in_finder(path: String) -> Result<(), AppError> {
    71	    let target = PathBuf::from(&path);
    72	    reveal_path(&target).await.map_err(|e| AppError::Io {
    73	        context: format!("reveal_in_finder: {path}"),
    74	        source: e,
    75	    })
    76	}
    77	
    78	#[cfg(target_os = "macos")]
    79	async fn reveal_path(target: &Path) -> std::io::Result<()> {
    80	    let status = tokio::process::Command::new("open")
    81	        .arg("-R")
    82	        .arg(target)
    83	        .status()
    84	        .await?;
    85	    if status.success() {
    86	        Ok(())
    87	    } else {
    88	        Err(std::io::Error::other(format!("open -R 退出码 {status}")))
    89	    }
    90	}
    91	
    92	#[cfg(target_os = "windows")]
    93	async fn reveal_path(target: &Path) -> std::io::Result<()> {
    94	    let status = tokio::process::Command::new("explorer")
    95	        .arg("/select,")
    96	        .arg(target)
    97	        .status()
    98	        .await?;
    99	    if status.success() {
   100	        Ok(())
   101	    } else {
   102	        Err(std::io::Error::other(format!(
   103	            "explorer /select 退出码 {status}"
   104	        )))
   105	    }
   106	}
   107	
   108	#[cfg(all(unix, not(target_os = "macos")))]
   109	async fn reveal_path(target: &Path) -> std::io::Result<()> {
   110	    let dir = target.parent().unwrap_or(target);

exec
/bin/zsh -c "rg -n \"SEARCH_LIMIT|SEARCH_DEBOUNCE_MS\" src/components/Rail/ReadingRail.tsx src -g '*.ts' -g '*.tsx'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/components/Rail/ReadingRail.tsx:85:const SEARCH_DEBOUNCE_MS = 300;
src/components/Rail/ReadingRail.tsx:86:const SEARCH_LIMIT = 30;
src/components/Rail/ReadingRail.tsx:984:      invoke<SearchHit[]>("search_documents", { query, limit: SEARCH_LIMIT })
src/components/Rail/ReadingRail.tsx:995:    }, SEARCH_DEBOUNCE_MS);
src/components/Rail/ReadingRail.tsx:85:const SEARCH_DEBOUNCE_MS = 300;
src/components/Rail/ReadingRail.tsx:86:const SEARCH_LIMIT = 30;
src/components/Rail/ReadingRail.tsx:984:      invoke<SearchHit[]>("search_documents", { query, limit: SEARCH_LIMIT })
src/components/Rail/ReadingRail.tsx:995:    }, SEARCH_DEBOUNCE_MS);

exec
/bin/zsh -c "rg -n \"search_documents\" src/__tests__ e2e -g '*.ts' -g '*.tsx' | head -n 160" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src/__tests__/components/Rail/ReadingRail.test.tsx:205:    cmd === "search_documents" ? Promise.resolve(hits) : Promise.resolve(null),
src/__tests__/components/Rail/ReadingRail.test.tsx:243:      "search_documents",
src/__tests__/components/Rail/ReadingRail.test.tsx:250:      "search_documents",
src/__tests__/components/Rail/ReadingRail.test.tsx:256:    expect(invokeMock).toHaveBeenCalledWith("search_documents", {
e2e/reading-rail.spec.ts:296:        __biaoyue_search_documents__: unknown[];
e2e/reading-rail.spec.ts:298:      w.__biaoyue_search_documents__ = [

exec
/bin/zsh -c "nl -ba docs/design/pluginization-datafile-settings-rail/03-settings-page-optimization.md | sed -n '1,115p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# 设置页面优化方案
     2	
     3	> 状态：设计方案（已通过独立对抗评审，按意见修订）
     4	> 对应目标：第 3 项——设置页重新规划设计，含快捷键体系，改为独立浮窗，出逼真原型
     5	> 事实基线：`src/components/SettingsView.tsx`、`src/components/ShortcutOverlay.tsx`、`src/lib/shortcuts.ts`、`src/editors/keybindings.ts`、`src/App.tsx`、`src/main.tsx`、`src-tauri/src/lib.rs`、`docs/design/system/spec.md`
     6	
     7	## 1. 背景与现状
     8	
     9	当前设置页 `SettingsView.tsx` 为**左侧导航 + 右侧内容**布局，实际已有 **11 个分类**：外观、编辑器、文件、阅读空间、网格概览、悬浮预览、AI 服务、扩展、快捷键、数据与备份、关于。
    10	
    11	**现状澄清（修正此前的误判）**：
    12	
    13	1. **快捷键已有基础展示，不是空白**。设置页已渲染 `coreShortcuts()` 为「核心快捷键」列表（`SettingsView.tsx:2621-2636`），并提供「查看完整列表」按 `SHORTCUT_FAMILY_ORDER` 十族分组展开（`SettingsView.tsx:2638-2687`）；另有 `ShortcutOverlay.tsx` 用 `?` 键展示全表。**核心区 + 完整列表两层已实现**。
    14	2. **「临时架子」的判断成立，但指的是分类编排与形态**：分类虽多，但与第 1 项（插件）、第 2 项（数据文件）无呼应，快捷键缺规则卡与全局/局部二分，整体形态仍是页面内嵌而非独立浮窗。
    15	3. **快捷键注册表素材齐全**：`shortcuts.ts` 已有 10 个 family、global/local 作用域、core 标记、冲突裁定说明。
    16	
    17	**本方案的增量（而非从零搭建）**：补规则卡、全局/局部二分、可重映射入口、独立浮窗形态、分类与第 1/2 项呼应。
    18	
    19	## 2. 设计目标
    20	
    21	1. **快速记住和使用快捷键**：在已有核心+完整列表之上，补规则记忆法、全局/局部清晰区分、可改范围明确。
    22	2. **独立浮窗**：设置成为独立浮窗，不阻塞主窗口，可拖动/折叠/置顶，位置记忆。
    23	3. **布局分类覆盖全部能力域**：分类参考第 1 项（插件）与第 2 项（数据文件），与既有 11 分类平滑衔接。
    24	
    25	## 3. 布局分类设计
    26	
    27	### 3.1 现状 11 分类 → 新分类映射
    28	
    29	先交代既有分类的归宿，避免迁移成本被隐藏：
    30	
    31	| 现状分类 | 去向 | 说明 |
    32	|---|---|---|
    33	| 外观 | **视图** | 主题、界面样式归入视图 |
    34	| 编辑器 | **编辑器**（保留） | 字号、选区工具条、轮盘、HTML 工具条、属性栏、模板 |
    35	| 文件 | **通用** | 文件相关偏好 |
    36	| 阅读空间 | **阅读** | 阅读相关设置 |
    37	| 网格概览 | **视图** | 网格概览配置归入视图 |
    38	| 悬浮预览 | **视图** | 悬浮预览归入视图 |
    39	| AI 服务 | **AI**（保留） | 模型、提供方、连接、风格、会话 |
    40	| 扩展 | **插件** | 「扩展」升级为「插件」分类，对接第 1 项 |
    41	| 快捷键 | **快捷键**（保留，重做体系） | 见第 4 节 |
    42	| 数据与备份 | **数据文件** | 升级为「数据文件」分类，对接第 2 项（快照保留） |
    43	| 关于 | **关于**（保留） | 版本、快捷键总览入口 |
    44	
    45	### 3.2 新分类导航
    46	
    47	设置浮窗左侧分类导航，右侧内容。分类按「能力域 + 可配置面」组织，与第 1、2 项清单呼应：
    48	
    49	| 分类 | 内容 | 来源 |
    50	|---|---|---|
    51	| **快捷键** | 核心高频、完整列表、规则技巧、全局/局部、可重映射 | 第 3 项本方案 |
    52	| **插件** | 插件清单、启停、卸载、查看数据文件 | 第 1 项 A/B 档插件（原「扩展」升级） |
    53	| **数据文件** | 可配置数据文件清单、字段说明、AGENT 写入说明、快照 | 第 2 项功能清单（原「数据与备份」升级） |
    54	| **编辑器** | 字号、选区工具条、轮盘、HTML 工具条、属性栏、模板 | 现状「编辑器」保留 |
    55	| **阅读** | 字体、字号、行高、主题、版式、阅读模式 | 现状「阅读空间」+ `reader` |
    56	| **视图** | 视图规格、分栏、工具条、网格概览、悬浮预览、外观 | 现状「外观/网格概览/悬浮预览」合并 + 第 1 项 B2–B5 |
    57	| **AI** | 模型、提供方、连接、风格、会话 | 现状「AI 服务」保留 |
    58	| **通用** | 文件偏好、默认新建格式、自动保存、捕获浮层 | 现状「文件」+ 第 1/2 项规划能力 |
    59	| **关于** | 版本、快捷键总览入口 | 现状「关于」保留 |
    60	
    61	**分类原则**：每个分类对应一个能力域或可配置面，与第 1、2 项清单一一呼应。注意「通用」中的默认新建格式、自动保存、捕获浮层是第 1/2 项的规划能力，**非当前已实现**，原型按规划呈现。
    62	
    63	## 4. 快捷键体系设计（核心增量）
    64	
    65	`shortcuts.ts` 已提供全部素材（family、scope、core、decision、keys）。本方案在其上补三层增量，并修正既有二分的误分类。
    66	
    67	### 4.1 核心高频快捷键（最上层）
    68	
    69	取 `shortcuts.ts` 中 `core: true` 的**全部 7 条**定案（实现时以注册表为准，此处枚举定案）：
    70	
    71	- **⌘P** 快速打开
    72	- **⌘\** 阅读空间
    73	- **⌘⇧\** 网格概览
    74	- **⌘K** AI 快捷浮层
    75	- **⌘⇧A**（core，具体功能见注册表）
    76	- **⌘,** 设置
    77	- **?** 快捷键总览
    78	
    79	**说明**：`?`（总览）与 `⌘,`（设置）列入核心是注册表既有裁定；若从「最该记住的少数几条」角度认为二者偏入口性质，可在原型阶段提出调整建议，但**以注册表现状为准**，不擅自改动。
    80	
    81	**展示要求**：每条显示「键位 + 功能名 + 一句话用途」，键位用等宽键位样式（见 4.6 规范缺口处理），核心区视觉最突出。
    82	
    83	### 4.2 快捷键规则技巧说明（帮助记忆，而非死记）
    84	
    85	把 `shortcuts.ts` 顶部的**设计规则**显性化展示，让用户理解键位编排逻辑，从而推导记忆：
    86	
    87	| 规则 | 说明 | 示例 |
    88	|---|---|---|
    89	| **单 ⌘ 高频** | 最常用的动作用单个 ⌘ | ⌘P、⌘\ |
    90	| **⌘⇧ 二级** | 次级动作用 ⌘⇧ | ⌘⇧\（网格）、⌘⇧X |
    91	| **⌘⌥ 分栏/空间** | 涉及空间布局的用 ⌘⌥ | ⌘⌥\（固定左边栏） |
    92	| **⌥ 过滤** | 过滤类用 ⌥ | ⌥+类型 |
    93	| **不用三修饰键** | 避免三修饰键，降低记忆与冲突 | — |
    94	
    95	**展示位置**：核心区下方，用「规则卡」形式，每条规则一行，附一个示例键位。此层为全案最有增量价值的部分。
    96	
    97	### 4.3 全局与局部快捷键的区分（修正误分类）
    98	
    99	`shortcuts.ts` 区分 `scope: global / local`。**注意：直接按 scope 二分存在误分类**——media 族全部条目未标 `scope`（默认 global），但注册表注释明确「播放器聚焦时生效」；card 族 ⌘1–9/按住 ⌘ 只在网格上下文生效，也未标 `scope: "local"`。照此实现会把上下文受限的键展示为全局，与「避免用户误在全局找不到」冲突。
   100	
   101	**处理方案（二选一，实现时定）**：
   102	
   103	- **方案一（推荐）**：给 `shortcuts.ts` 的 media/card 族补 `scope: "local"` + `context`，使注册表与真实上下文一致，再按 scope 二分。这是根治。
   104	- **方案二（保守）**：注册表暂不改，方案显式声明按 scope 二分的局限，改用「按 family 分组 + context 标注」的替代分组规则，对 media/card 单独说明上下文。
   105	
   106	**全局区枚举（补全）**：全局族应包含全部 10 族中标记为 global 的条目，即全局、**类型过滤（typeFilter）**、**模式（mode）**、文件、工作区、导航、卡片、AI、媒体、局部——按 family 分组展示，不漏 typeFilter 与 mode。
   107	
   108	**局部区展示**：`scope: local` 的条目，每条标注真实 `context`（如属性面板菜单、搜索浮窗），不使用虚构的「编辑器内」「阅读模式下」。
   109	
   110	### 4.4 可重新调整的快捷键（明确可改范围 + 依赖约束）
   111	
   112	**当前状态：可重映射是空谈，需标注依赖**。`SHORTCUTS` 是编译期 TS 常量，**按键行为由 `App.tsx` 硬编码分发**（`App.tsx:423-780` 全是 `e.key` 判断，未消费 SHORTCUTS）。即使第 1 项 B1「键位数据文件化」完成，**不把 `App.tsx` 的按键分发改成读数据文件，重映射永不生效**。
   113	
   114	**设计（标注依赖）**：
   115	

exec
/bin/zsh -c "rg -n \"settings-nav|extensions|扩展|插件\" docs/design/approved docs/design/system CONTEXT.md docs/product -g '*.md' | head -n 220" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
CONTEXT.md:12:| **decoration** | CM6 装饰插件，`src/editors/decorations/`。类名前缀 `cm-*` | 每个类名必须在 `src/styles/` 有对应规则（CSS manifest 校验） |
CONTEXT.md:21:| **可塑层（malleability）** | 一切可变状态皆文本：配置三层 + 视图规格 + 扩展包（SKILL.md 式） | 产品铁律 D6 |
docs/product/vision.md:59:| **malleability（一切可变状态皆文本）** | 配置、键位、视图规格、扩展都是约定目录的文本文件；用户与 AI 都能改 | 配置三层 + 视图规格 + 扩展包（SKILL.md 式） |
docs/product/vision.md:70:3. 不为插件市场/公开扩展 API 做（扩展点 = 数据文件）。
docs/product/principles.md:33:| D6 | **一切可变状态皆文本（malleable）** | 配置、键位、模板、扩展 = 约定目录的文本文件；扩展点先做数据文件（SKILL.md 式），不做 API | 这个调整需要改源码吗？能不能变成一份文本？ |
docs/product/principles.md:45:3. 不为**插件市场/公开扩展 API** 做（扩展点 = 数据文件，见 D6）。
docs/product/users.md:26:当前重点服务角色是阅读者、写作者、寻求激发灵感创意者；根据不同角色需求提供不同的组件功能，后续围绕个人所需再扩展。
docs/design/approved/shell-ui/spec.md:46:- 文件名输入框：只读扩展名部分（`.md`），只让用户改主名
docs/design/approved/shell-ui/spec.md:121:- 页签标题显示文件名，双击编辑，扩展名 `.md` 只读
docs/design/approved/shell-ui/spec.md:161:- 扩展名部分（`.md`）以 disabled span 缀在 input 后面
docs/design/approved/selection-roulette/HANDOFF.md:133:2. 代码：轮盘扩展 + 几何纯函数 + 样式；`floating-toolbar.ts` 旧实现与 `e2e/floating-toolbar.spec.ts` 不留双轨。
docs/design/approved/video-player/spec.md:25:| 播放列表 | **无原生、无官方插件**（作者 Issue #447 明确建议自建）；用 `art.switchUrl(url)` + `video:ended` 实现 |
docs/design/approved/video-player/spec.md:50:- 视频扩展名：mp4 / mov / webm / m4v / mkv / avi
docs/design/approved/video-player/spec.md:51:- 音频扩展名：mp3 / m4a / wav / flac / ogg
docs/design/approved/video-player/spec.md:179:- 主字幕：与视频同目录的**同名 .srt / .ass / .vtt 文件**（`视频名.srt`），由 Rust `list_media_in_dir` 一并发现（扩展名过滤补充字幕三类），或
docs/design/system/governance.md:66:| D6 | **一切可变状态皆文本（malleable）** | 配置/键位/模板/扩展 = 约定目录的文本文件；扩展点先做数据文件，不做 API | 这个调整需要改源码吗？ |
docs/design/system/governance.md:76:3. 不为插件市场/公开扩展 API 做（扩展点 = 数据文件，见 D6）。
docs/design/system/governance.md:280:`ai-agent`、`ai-entry`、`app-identity`、`application-shell`、`brand-narrative`、`capture`、`configuration`、`diagram-rendering`、`docs-governance`、`editing`、`export`、`extensions`、`file-management`、`mdpkg`、`navigation`、`pr-automation`、`reading`。
docs/design/approved/layout-portal/spec.md:28:| P4 | 可塑即可久 | 视图规格/配置/扩展皆文本，用户与 AI 可改；扩展包拷入即用 |
docs/design/approved/layout-portal/spec.md:79:- **关闭**：关最后一页签 → 删除 leaf，兄弟扩展；根 leaf 不显示关闭
docs/design/approved/layout-portal/spec.md:196:左导航 10 区：**外观** · 编辑器 · 阅读空间 · 网格概览 · 悬浮预览 · AI 服务 · 扩展 · 快捷键 · 数据与备份 · 关于
docs/design/approved/layout-portal/spec.md:202:- 扩展：见 §9
docs/design/approved/layout-portal/spec.md:206:## 9. 扩展
docs/design/approved/layout-portal/spec.md:211:- **导出/分享**：把自定义扩展打包
docs/design/approved/layout-portal/spec.md:212:- **AI 生成**：输入「说出你要的功能」→ 生成中 → 新扩展卡（默认启用）+ SKILL.md 预览
docs/design/approved/layout-portal/spec.md:300:8. 扩展：拖入即用、导出、AI 生成
docs/design/approved/selection-roulette/README.md:208:追加意见（已落）：圆心 = 鼠标落点；二三级就近、不绕整圈；颜色含字体色与背景色；转换要能扩展；
docs/design/approved/reader-typography/spec.md:293:现状白名单（25 个标签）把 md 内嵌 HTML 几乎剥光。按"富文本安全子集"扩展：
docs/design/approved/reader-typography/spec.md:311:| 皮肤 `--skin` | `paper` / `modern`（后续扩展） | `<html data-skin>` |
docs/design/approved/reader-typography/spec.md:313:- **存储**：扩展 `AppConfig`（Rust `struct AppConfig` + 前端 `RustAppConfig`）三个可选字段：`readerFontSize`、`readerWidth`、`readerSkin`；走现有 `load_config` / `save_config` 通道，缺省回落到默认值，老配置无感升级。
docs/design/approved/reader-typography/spec.md:327:| 5 | 改 `src/renderers/markdown.ts` | 扩展白名单（内嵌 HTML/CSS）；renderer：代码块（语言标签 + 高亮）、图片 figure/figcaption、表格滚动容器、宽通道 class；后处理 pass：公式回填 + Callout 转换 + 中西文间距 + 链接处理（合并为**一趟 DOM 遍历**） | 3、4 |
docs/design/approved/reading-progress/spec.md:61:// 扩展为：
docs/design/approved/layout-portal/README.md:2:title: "已批准的门户与布局设计（布局规格 v1.0）。门户 + pane 树 + 阅读空间 + 网格 + 预览窗 + AI 两形态 + 设置 + 扩展 + 图标 + 快捷键。"
docs/design/approved/layout-portal/README.md:11:已批准的门户与布局设计（布局规格 v1.0）。门户 + pane 树 + 阅读空间 + 网格 + 预览窗 + AI 两形态 + 设置 + 扩展 + 图标 + 快捷键。
docs/design/approved/layout-portal/README.md:15:门户与布局模型定稿：门户 + 工作区 pane 递归树（N 栏/每格多页签/全屏/拖拽换位）+ 阅读空间竖排栏（三态/双布局/三密度/卡片规格/滑杆下拉）+ 网格概览（bento/缩略图优先/下拉控件/行切换键盘/动态编号）+ 悬浮预览窗（贴栏右缘锚定/四边四角缩放/拖动/关闭/双开关）+ AI 两形态（小窗 285×260 ⇄ 嵌入窗格，唯一入口）+ 设置左导航 10 区 + 便携扩展 + universe-icon 图标体系 + 完整快捷键家族。
docs/design/approved/navigation/spec.md:254:- 分组扩展到 10 条/组

exec
/bin/zsh -c "sed -n '1,80p' docs/design/approved/navigation/spec.md" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
---
title: "标月无侧栏导航 — 最终方案"
type: design
status: accepted
last_updated: 2026-08-01
source_of_truth: supporting
---

# 标月无侧栏导航 — 最终方案

> 状态: 已定稿  
> 来源: Codex / Ponytail / 印哥 三方收敛  
> 替代: `no-sidebar-desk-file-list-proposal.md`（归档）  
> 目标: 无侧栏场景下，用户切换文件、找文件、恢复上下文、确认状态安全

---

## 一、一句话结论

**两个入口，零新概念。**

- `Cmd+P` → 统一面板（空查询=当前上下文；输入=全局搜索；带词=局部相关）
- `Cmd+[` / `Cmd+]` → 标准后退/前进

没有任何叫 Desk / Portal / Shelf / Workspace 的用户可见系统。它们被降级为同一面板里的视图或行为。

数据源只有三个：导航历史、引用关系、用户操作。不新增第四种数据。

---

## 二、原方案问题诊断

原方案 `no-sidebar-desk-file-list-proposal.md` 洞察正确（解释力优先），但产品形态过重：

| 原设计 | 问题 |
|--------|------|
| 10个独立命名系统 | 用户需要学一套新导航语言 |
| Desk/Portal/Shelf/Workspace 边界不清 | 概念膨胀，实际数据源只有3个 |
| 11种来源理由标签 | 用户记不住 |
| Trail = 浏览器后退可视化 | 重新发明已有快捷键 |
| 阅读收尾台 | Cmd+W 已解决 99.9% |
| 稳定哈希槽 | 过早优化 |
| Workspace 自动聚类 | 要么是 Shelf 子集，要么是噪音 |

**结论：收敛成一个统一面板，取消命名系统，保留正文上下文触发。**

---

## 三、最终方案

### 3.1 入口定义

| 入口 | 行为 |
|------|------|
| `Cmd+P` | 打开统一面板。空查询 → 当前上下文视图；输入文字 → 全局搜索；带选中文本 → 局部相关视图 |
| `Cmd+[` | 后退（标准历史栈） |
| `Cmd+]` | 前进（标准历史栈） |
| `Esc` | 关闭面板 / 回到进入前状态 |

只有 `Cmd+P` 是新的。其余复用操作系统标准快捷键。

### 3.2 面板视图（自动切换，用户无需选择）

面板根据打开时的上下文自动选择视图，不需要用户手动切换：

**A. 空查询 — 上下文视图**（用户意图：继续刚才的工作）

```
┌─ ⌘ ──────────────────────────────────┐
│                                       │
│  继续                                  │
│  ● 无侧栏方案.md        读到："Desk是…" │
│  ◦ The Desk 概念        "引用过 · 3min" │
│  ◦ 三栏布局方案          "分屏对照 · 昨天"│
│                                       │
│  待处理                                 │
│  ● CORE-REQUIREMENTS    "未保存 ⚡"      │
│  ◦ 搜索实现.md           "读到一半"      │
│                                       │
│  最近                                   │

exec
/bin/zsh -c "rg -n \"navigation|文档发现|Cmd\\+P|Cmd-P|统一面板|Omni\" docs/delivery/requirements-status.md docs/README.md openspec/specs -g '*.md' | head -n 200" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
docs/README.md:17:| 查某功能怎么算对 | `openspec/specs/<domain>/spec.md`（reading/editing/file-management/navigation/capture/application-shell） |
docs/delivery/requirements-status.md:61:- 编辑/阅读/导航/配置域（`editor-surface-batch17`）：21/21 票合并（PR #772–#797），+15 requirement / ~12 修订（editing 新增 E-32..E-39 并修订 E-11/E-19/E-20/E-22/E-24/E-26/E-27/E-28/E-29/E-30；reading 新增预览分栏与嵌入视频、修订 PDF 按钮栏；navigation 新增页签菜单关闭/左边栏快捷键/页签文件动作；application-shell 新增页签空白全屏与更多菜单；configuration 修订提示信息显示时长），已归档 `openspec/changes/archive/2026-11-14-editor-surface-batch17`
docs/delivery/requirements-status.md:67:- 规格对齐（`rail-thumb-spec-sync`）：阅读空间卡片缩略图 72×54 → 64×48（`navigation` 1 条 requirement 修订，总数不变），已归档 `openspec/changes/archive/2026-11-08-rail-thumb-spec-sync`
docs/delivery/requirements-status.md:143:### navigation（5）
docs/delivery/requirements-status.md:148:| B-3 | 统一文件面板（Cmd+P） | ⬜ | 无实现 |
openspec/specs/capture/spec.md:105:统一文件面板（Cmd+P）的「继续」分组 SHALL 嵌入 Quick Capture 条目（"继续"入口），每条 SHALL 支持单条归档与删除。
openspec/specs/navigation/spec.md:1:# navigation — 导航体系当前规格
openspec/specs/navigation/spec.md:5:navigation 域定义标月桌面端"无侧栏"方向下的导航体系：启动面板/欢迎页、统一文件面板（Cmd+P 上下文浏览器）及其三视图切换、条目直开与历史前进后退。导航职责由 Cmd+P 承担，不再依赖左右侧栏（界面层面的无边栏决策见 application-shell 域）。本规格是 navigation 域可验收功能行为的唯一真相源；条目编号（B-1、B-3、B-6、B-7、B-8）与 `docs/MVP-需求跟踪表.md` 模块 B / B+ 一一对应。
openspec/specs/navigation/spec.md:10:- B-3 / B-6 / B-7 / B-8 批准设计：`docs/design/approved/navigation/spec.md`（经由跟踪表 B-3/B+ 行登记）
openspec/specs/navigation/spec.md:11:- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §四 UI 架构 4.1（空状态与导航入口表）、4.2（统一文件面板规则）、§三 快捷键体系（Cmd+P、Ctrl+1~9、Cmd+[/Cmd+]）；`docs/MVP-需求跟踪表.md` 模块 B 与 B+（均标 ✅）
openspec/specs/navigation/spec.md:33:### Requirement: B-3 统一文件面板（Cmd+P 上下文浏览器）
openspec/specs/navigation/spec.md:35:应用 SHALL 提供 `Cmd+P` 统一文件面板作为唯一的文件导航入口。面板 SHALL 依据打开时的上下文呈现不同视图（空查询 = 当前上下文视图，输入搜索词 = 全局搜索视图，带选中文本 = 局部相关视图，触发规则见 B-6）。空查询时的默认上下文视图 SHALL 分为三组：「继续」（当前任务现场文档：引用/分屏/跳转过的，≤5 条）、「待处理」（状态风险文档：未保存/读到一半/失效的，≤5 条）、「全部」（工作目录所有文件按 mtime 倒序，行为见 file-management 域 C-5）。条目交互 SHALL 支持：Enter 打开、Space Peek、Cmd+Enter 旁开、Tab 固定、hover 显示路径详情。R 阶段搜索范围 SHALL 为文件名 + frontmatter title + H1 + 父目录，不搜索正文全文。
openspec/specs/navigation/spec.md:39:- **WHEN** 用户按 `Cmd+P` 且无查询词、无选中文本
openspec/specs/navigation/spec.md:63:- **WHEN** 用户在正文中选中一段文本后按 `Cmd+P`
openspec/specs/application-shell/spec.md:12:- 启动面板/欢迎页（B-1）与统一文件面板（B-3）归属 navigation 域
openspec/specs/application-shell/spec.md:16:应用外壳 SHALL 移除左侧栏：Toolbar 中的左栏按钮 SHALL 被移除，用于切换左侧栏的旧 `Cmd+\` 快捷键 SHALL 被移除，布局参数 `leftSidebar` SHALL 传 null。导航职责由统一文件面板（Cmd+P，见 navigation 域 B-3）承担。
openspec/specs/application-shell/spec.md:25:应用外壳 SHALL 不渲染右侧边栏（无边栏哲学：收回原右侧边栏设计）；导航由 `Cmd+P` 统一文件面板承担，不另设右侧导航栏。
openspec/specs/application-shell/spec.md:48:存在近期文件记录（RecentFile）后，空状态 SHALL 在欢迎页下方按数据分块叠加两个区域：「上次停在这」（RecentFile[0] + scrollPos + 最近编辑位置 → 最近 heading 与内容片段，提供"继续阅读"；scrollPos=0 时退化为"继续打开"）与「最近保存」（`list_files` 按 mtime 倒序取 5 个 `.md`/`.html` 文件，以横向滚动 chips 呈现）。分块 SHALL 按数据可用性显示（非 if/else 二选一）：首次安装仅显示欢迎页；有 RecentFile 时显示继续区 + 最近保存；仅有文件夹文件时显示欢迎页 + 最近保存；`list_files` 失败时对应 section 静默隐藏、不报错。最近保存 chip SHALL 以三层递减视觉呈现（文件名 → 内容首行 → 时间），chips 末尾的"+N 更多"SHALL 作为按钮跳转 Cmd+P。
openspec/specs/application-shell/spec.md:281:主页入口 SHALL 回到程序启动时的页面。自动布局入口的按钮 SHALL 紧邻主页图标右侧，其行为见 `navigation` 的「一键自动布局栏目」。
openspec/specs/file-management/spec.md:10:- C-5 批准设计（全部文件视图）：`docs/design/approved/navigation/spec.md` §3.2（经由统一文件面板呈现，面板整体规格见 navigation 域 B-3）

codex
仓库规格层还有更严重的冲突：现行 `navigation` 规范把 ⌘P 定义为唯一文件导航入口，并明确 R 阶段不搜正文；目标文档却把门户、左边栏、网格、⌘P、⌘F 并列为五个入口，并把正文搜索设为推荐方向，且全文未提出规格 supersede。
exec
/bin/zsh -c "nl -ba openspec/specs/navigation/spec.md | sed -n '1,95p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# navigation — 导航体系当前规格
     2	
     3	## Purpose
     4	
     5	navigation 域定义标月桌面端"无侧栏"方向下的导航体系：启动面板/欢迎页、统一文件面板（Cmd+P 上下文浏览器）及其三视图切换、条目直开与历史前进后退。导航职责由 Cmd+P 承担，不再依赖左右侧栏（界面层面的无边栏决策见 application-shell 域）。本规格是 navigation 域可验收功能行为的唯一真相源；条目编号（B-1、B-3、B-6、B-7、B-8）与 `docs/MVP-需求跟踪表.md` 模块 B / B+ 一一对应。
     6	
     7	## 设计来源与参考
     8	
     9	- B-1 批准设计：`docs/design/approved/empty-state/spec.md`（启动面板/欢迎页部分）
    10	- B-3 / B-6 / B-7 / B-8 批准设计：`docs/design/approved/navigation/spec.md`（经由跟踪表 B-3/B+ 行登记）
    11	- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §四 UI 架构 4.1（空状态与导航入口表）、4.2（统一文件面板规则）、§三 快捷键体系（Cmd+P、Ctrl+1~9、Cmd+[/Cmd+]）；`docs/MVP-需求跟踪表.md` 模块 B 与 B+（均标 ✅）
    12	- 空状态的"继续上次/最近保存"分块（B-2）、示例文件释放（B-4）与空状态设计规则（B-5）归属 application-shell 域
    13	## Requirements
    14	### Requirement: B-1 启动面板（欢迎页）
    15	
    16	用户启动应用时 SHALL 首先进入门户启动首屏（布局规格 v1.0 §2）：顶部问候语+日期（安静无装饰）、继续阅读 1 张 hero 卡（上次文件+阅读进度+打开）、最近文件 4–6 张富卡片（标题/父路径/时间/1–2 行真摘要/进度）、分类磁贴 8 类（Markdown/HTML/文本/PDF/视频/图片/代码/音频+计数，点击→网格并按类型过滤）、快速动作（新建文档/打开文件/生成学习页/AI 指令，图标+文字，主入口唯一带字处）、底部 ⌘P 搜索全部提示。门户 SHALL 无「来源」概念（组织维度=时间/类型/主题）。首次启动（无任何文件）SHALL 显示引导三动作（新建/打开/导入）替代 hero 与磁贴数据。`0-welcome.md` 欢迎页职责 SHALL 由门户空态引导承接；原「继续上次/最近保存」分块数据（application-shell 域 B-2）SHALL 由门户「继续阅读/最近文件」承接。
    17	
    18	#### Scenario: 首次启动渲染欢迎页
    19	
    20	- **WHEN** 用户首次启动标月且无任何打开文档
    21	- **THEN** 启动面板 SHALL 进入门户空态：门户显示问候语与引导三动作（新建/打开/导入），不渲染空的 hero 卡与磁贴计数（原 `0-welcome.md` 欢迎页职责由门户承接）
    22	
    23	#### Scenario: 首次启动渲染门户空态
    24	
    25	- **WHEN** 用户首次启动且无任何文件
    26	- **THEN** 门户 SHALL 显示问候语与引导三动作（新建/打开/导入），不渲染空的 hero 卡与磁贴计数
    27	
    28	#### Scenario: 门户四块齐全
    29	
    30	- **WHEN** 存在历史文件时用户启动应用
    31	- **THEN** 门户 SHALL 齐备：问候语+日期、继续阅读 hero 卡、最近文件 4–6 卡、分类磁贴 8 类、快速动作与 ⌘P 提示，且无「来源」入口
    32	
    33	### Requirement: B-3 统一文件面板（Cmd+P 上下文浏览器）
    34	
    35	应用 SHALL 提供 `Cmd+P` 统一文件面板作为唯一的文件导航入口。面板 SHALL 依据打开时的上下文呈现不同视图（空查询 = 当前上下文视图，输入搜索词 = 全局搜索视图，带选中文本 = 局部相关视图，触发规则见 B-6）。空查询时的默认上下文视图 SHALL 分为三组：「继续」（当前任务现场文档：引用/分屏/跳转过的，≤5 条）、「待处理」（状态风险文档：未保存/读到一半/失效的，≤5 条）、「全部」（工作目录所有文件按 mtime 倒序，行为见 file-management 域 C-5）。条目交互 SHALL 支持：Enter 打开、Space Peek、Cmd+Enter 旁开、Tab 固定、hover 显示路径详情。R 阶段搜索范围 SHALL 为文件名 + frontmatter title + H1 + 父目录，不搜索正文全文。
    36	
    37	#### Scenario: 空查询呈现默认上下文分组
    38	
    39	- **WHEN** 用户按 `Cmd+P` 且无查询词、无选中文本
    40	- **THEN** 面板 SHALL 显示「继续」（≤5 条）、「待处理」（≤5 条）、「全部」三组默认上下文视图
    41	
    42	#### Scenario: 条目交互
    43	
    44	- **WHEN** 面板内某条目获得焦点
    45	- **THEN** Enter SHALL 打开该条目；Space SHALL 预览（Peek）；Cmd+Enter SHALL 在旁栏打开；Tab SHALL 固定该条目；hover SHALL 显示其路径详情
    46	
    47	#### Scenario: 搜索范围限定
    48	
    49	- **WHEN** 用户在面板中输入搜索词
    50	- **THEN** 匹配范围 SHALL 限于文件名、frontmatter title、H1 与父目录，不搜索文档正文全文
    51	
    52	### Requirement: B-6 三视图切换
    53	
    54	统一文件面板 SHALL 按查询状态动态切换三种视图：无查询词且无选中文本时显示当前上下文视图；输入搜索词时切换为全局搜索视图；打开面板时带有选中文本时显示局部相关视图。
    55	
    56	#### Scenario: 输入搜索词切换全局搜索
    57	
    58	- **WHEN** 面板已打开（当前上下文视图），用户输入搜索词
    59	- **THEN** 面板 SHALL 从当前上下文视图切换为全局搜索视图
    60	
    61	#### Scenario: 带选中文本进入局部相关
    62	
    63	- **WHEN** 用户在正文中选中一段文本后按 `Cmd+P`
    64	- **THEN** 面板 SHALL 以该选中文本为线索显示局部相关视图
    65	
    66	### Requirement: B-7 Ctrl+1~9 直开条目
    67	
    68	面板打开时，数字键 `Ctrl+1` 至 `Ctrl+9`（桌面端同时保留 `Cmd+1~9` 同义映射）SHALL 直接打开面板中对应序号的条目，无需按 Enter 确认。
    69	
    70	#### Scenario: 数字键直开
    71	
    72	- **WHEN** 面板已打开且结果不少于 3 条，用户按 `Ctrl+3`
    73	- **THEN** 面板 SHALL 直接打开第 3 条条目，无需 Enter 确认
    74	
    75	### Requirement: B-8 后退/前进历史导航
    76	
    77	应用 SHALL 提供 `Cmd+[` 与 `Cmd+]` 作为标准历史栈导航：`Cmd+[` 后退到上一个导航位置，`Cmd+]` 前进，行为遵循标准历史栈语义。
    78	
    79	#### Scenario: 后退与前进
    80	
    81	- **WHEN** 用户在文档间完成多次导航后按 `Cmd+[`
    82	- **THEN** 视图 SHALL 回退到上一个导航位置；随后按 `Cmd+]` SHALL 前进到下一个导航位置
    83	
    84	### Requirement: 工作区 pane 递归树
    85	
    86	工作区 SHALL 以 pane 递归树组织分栏：`node = { id, dir: 'row'|'col', ratio, children }`、`leaf = { id, tabs, activeTabId }`。用户 SHALL 可对聚焦 leaf 右分（⌘⌥→）与下分（⌘⌥↓），新 leaf SHALL 获得焦点；关闭最后一页签 SHALL 删除该 leaf 且兄弟扩展，根 leaf SHALL 不显示关闭按钮。栏目 SHALL NOT 设最小宽高——分隔条 SHALL 可把任一栏拖到 0，比例 SHALL 仅钳制在 `[0,1]`；拖到 0 后双击分隔条 SHALL 复位为 0.5。分隔条 SHALL 双向拖拽；⌘⇧↵ 或格头按钮 SHALL 全屏当前格（隐藏其他格与分隔条，再按或 Esc 恢复）；布局树（结构/比例/页签/活动页签/焦点）SHALL 持久化并重启恢复。
    87	
    88	#### Scenario: 栏目可拖到 0
    89	
    90	- **WHEN** 用户把某两栏之间的分隔条拖到容器边缘
    91	- **THEN** 该侧栏目的计算宽或高 SHALL 允许为 0，应用 SHALL NOT 因 240px 下限回弹
    92	
    93	#### Scenario: 分裂与最小尺寸
    94	
    95	- **WHEN** 用户对聚焦格按 ⌘⌥→ 后拖动分隔条至小于 240px

exec
/bin/zsh -c "nl -ba openspec/specs/application-shell/spec.md | sed -n '1,35p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	# application-shell — 界面外壳与空状态当前规格
     2	
     3	## Purpose
     4	
     5	application-shell 域定义标月桌面端的整体界面布局决策与空状态体验：无边栏外壳（移除左侧栏、无右侧边栏、单一顶栏）、可选正文分栏，以及空状态的分块叠加、内置示例文件释放与空状态设计规则。本规格是 application-shell 域可验收功能行为的唯一真相源；条目编号（G-1 至 G-5 界面布局、B-2 / B-4 / B-5 空状态）与 `docs/MVP-需求跟踪表.md` 模块 G / B 一一对应。
     6	
     7	## 设计来源与参考
     8	
     9	- G-1 至 G-5 批准设计：`docs/design/approved/shell-ui/spec.md`（无侧栏外壳与 Chrome Bar 决策）
    10	- B-2 / B-4 / B-5 批准设计：`docs/design/approved/empty-state/spec.md`（空状态分块、示例文件释放与标记机制）；示例文件内容见 `src-tauri/samples/`
    11	- 需求基线：`docs/CORE-REQUIREMENTS-clairis.md` §四 UI 架构 4.1（空状态与导航入口、内置示例文件）、4.5（文档模式分栏规则）；`docs/MVP-需求跟踪表.md` 模块 G / B（均标 ✅）
    12	- 启动面板/欢迎页（B-1）与统一文件面板（B-3）归属 navigation 域
    13	## Requirements
    14	### Requirement: G-1 移除左侧栏逻辑
    15	
    16	应用外壳 SHALL 移除左侧栏：Toolbar 中的左栏按钮 SHALL 被移除，用于切换左侧栏的旧 `Cmd+\` 快捷键 SHALL 被移除，布局参数 `leftSidebar` SHALL 传 null。导航职责由统一文件面板（Cmd+P，见 navigation 域 B-3）承担。
    17	
    18	#### Scenario: 左侧栏入口不存在
    19	
    20	- **WHEN** 用户查看应用外壳界面
    21	- **THEN** Toolbar SHALL 不出现左栏切换按钮，左侧 SHALL 不渲染侧栏区域（leftSidebar = null）
    22	
    23	### Requirement: G-2 无右侧边栏
    24	
    25	应用外壳 SHALL 不渲染右侧边栏（无边栏哲学：收回原右侧边栏设计）；导航由 `Cmd+P` 统一文件面板承担，不另设右侧导航栏。
    26	
    27	#### Scenario: 右侧边栏不存在
    28	
    29	- **WHEN** 用户查看应用外壳界面
    30	- **THEN** 右侧 SHALL 不渲染任何边栏/导航占位区域
    31	
    32	### Requirement: G-5 正文分栏（可选）
    33	
    34	应用 SHALL 支持可选的正文分栏：`Cmd+Option+→` / `Cmd+Option+↓` 触发左右/上下分栏，亦可将页签拖拽到窗格边缘生成分栏；分栏分隔线 SHALL 在 hover 时给出可视暗示；每个窗格 SHALL 拥有独立的 TabBar。
    35	

exec
/bin/zsh -c "nl -ba docs/delivery/requirements-status.md | sed -n '138,154p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   138	| G-9 | 页签与栏目视觉贴合主题 | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #281） |
   139	| G-10 | 沉浸模式 chrome 收纳（状态栏 / 未钉住左栏）与每栏独立页签条 | ✅ | `workspace-ux-batch4`（2026-11-07）；`shell-editor-batch5`（2026-11-08）；`shell-media-batch7`（归档 2026-11-08） |
   140	| G-11 | 文件卡片工具条按类型收敛 | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #282） |
   141	| G-12 | 分栏语义与分隔线独立性 | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #278） |
   142	
   143	### navigation（5）
   144	
   145	| 编号 | 需求 | 状态 | 证据 |
   146	|---|---|---|---|
   147	| B-1 | 启动面板（欢迎页） | 🟡 | 设计已批 `docs/design/approved/empty-state/` + `0-welcome.md` 就位 |
   148	| B-3 | 统一文件面板（Cmd+P） | ⬜ | 无实现 |
   149	| B-6 | 三视图切换 | ⬜ | 无实现 |
   150	| B-7 | Ctrl+1~9 直开条目 | ⬜ | 无实现 |
   151	| B-8 | 后退/前进历史导航 | ⬜ | 无实现 |
   152	| N-1 | 本机最近文件自动发现 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
   153	| N-2 | 阅读空间预览触发区与列表回顶 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
   154	| N-3 | 本机标题与正文检索 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |

exec
/bin/zsh -c "nl -ba src-tauri/src/commands/config_cmd.rs | sed -n '1,95p'; nl -ba src-tauri/src/extensions.rs | sed -n '1,130p;300,380p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	use tauri::AppHandle;
     2	
     3	use crate::config;
     4	use crate::config::AppConfig;
     5	use crate::errors::AppError;
     6	use crate::extensions::ExtensionsSnapshot;
     7	
     8	/// Load configuration from disk.
     9	#[tauri::command]
    10	pub async fn load_config(app: AppHandle) -> Result<AppConfig, AppError> {
    11	    config::load_config(&app).await
    12	}
    13	
    14	/// Save configuration to disk.
    15	#[tauri::command]
    16	pub async fn save_config(app: AppHandle, config: AppConfig) -> Result<(), AppError> {
    17	    config::save_config(&app, &config).await
    18	}
    19	
    20	/// List config snapshots, oldest first.
    21	#[tauri::command]
    22	pub async fn list_config_snapshots(app: AppHandle) -> Result<Vec<String>, AppError> {
    23	    config::list_config_snapshots(&app).await
    24	}
    25	
    26	/// 本机已安装字体族（C1 / #853）；`enumerated=false` 表示退回预设兜底列表。
    27	#[tauri::command]
    28	pub fn list_system_fonts() -> crate::fonts::SystemFonts {
    29	    crate::fonts::system_fonts()
    30	}
    31	
    32	/// Restore a config snapshot; the current state is snapshotted first.
    33	#[tauri::command]
    34	pub async fn restore_config_snapshot(app: AppHandle, name: String) -> Result<AppConfig, AppError> {
    35	    config::restore_config_snapshot(&app, &name).await
    36	}
    37	
    38	/// Get API key from system keyring.
    39	#[tauri::command]
    40	pub async fn get_api_key(service: String, account: String) -> Result<Option<String>, AppError> {
    41	    config::get_api_key(&service, &account).await
    42	}
    43	
    44	/// Set API key in system keyring.
    45	#[tauri::command]
    46	pub async fn set_api_key(service: String, account: String, key: String) -> Result<(), AppError> {
    47	    config::set_api_key(&service, &account, &key).await
    48	}
    49	
    50	/// Delete API key from system keyring.
    51	#[tauri::command]
    52	pub async fn delete_api_key(service: String, account: String) -> Result<(), AppError> {
    53	    config::delete_api_key(&service, &account).await
    54	}
    55	
    56	/// Scan user extension directories (snippets / templates / theme.toml).
    57	#[tauri::command]
    58	pub fn list_extensions(app: AppHandle) -> Result<ExtensionsSnapshot, String> {
    59	    Ok(crate::extensions::scan_extensions(&config::config_base(
    60	        &app,
    61	    )))
    62	}
    63	
    64	#[cfg(test)]
    65	mod tests {
    66	    use super::*;
    67	
    68	    #[test]
    69	    fn test_config_default() {
    70	        let config = AppConfig::default();
    71	        assert_eq!(config.font_size, Some(17.0));
    72	        assert_eq!(
    73	            config.ollama_endpoint,
    74	            Some("http://localhost:11434".into())
    75	        );
    76	        assert_eq!(config.translation_provider, Some("ollama".into()));
    77	    }
    78	}
     1	//! 用户扩展点（design §D1–D4）：snippets / templates / theme tokens。
     2	//!
     3	//! 只读用户配置目录下的数据文件，**不执行任何文件内容、不写任何文件**。
     4	//! 目录缺失或单个文件非法都只记录 warning 并继续，绝不报错中断。
     5	
     6	use serde::Serialize;
     7	use std::collections::BTreeMap;
     8	use std::path::Path;
     9	
    10	#[derive(Debug, Clone, PartialEq, Serialize)]
    11	pub struct Snippet {
    12	    pub id: String,
    13	    pub label: String,
    14	    pub keywords: Vec<String>,
    15	    pub icon: Option<String>,
    16	    pub body: String,
    17	    pub path: String,
    18	}
    19	
    20	#[derive(Debug, Clone, PartialEq, Serialize)]
    21	pub struct Template {
    22	    pub name: String,
    23	    pub body: String,
    24	    pub path: String,
    25	}
    26	
    27	#[derive(Debug, Clone, PartialEq, Serialize, Default)]
    28	pub struct ThemeTokens {
    29	    pub tokens: BTreeMap<String, String>,
    30	    pub warnings: Vec<String>,
    31	}
    32	
    33	#[derive(Debug, Clone, PartialEq, Serialize, Default)]
    34	pub struct ExtensionsSnapshot {
    35	    pub snippets: Vec<Snippet>,
    36	    pub templates: Vec<Template>,
    37	    pub theme: ThemeTokens,
    38	    pub warnings: Vec<String>,
    39	}
    40	
    41	/// frontmatter 值：标量或字符串列表。
    42	enum FrontValue {
    43	    Scalar(String),
    44	    List(Vec<String>),
    45	}
    46	
    47	/// 去掉成对引号（单/双）。
    48	fn unquote(value: &str) -> String {
    49	    let bytes = value.as_bytes();
    50	    if bytes.len() >= 2 {
    51	        let first = bytes[0];
    52	        let last = bytes[bytes.len() - 1];
    53	        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
    54	            return value[1..value.len() - 1].to_string();
    55	        }
    56	    }
    57	    value.to_string()
    58	}
    59	
    60	/// `id` 必须匹配 `[a-z0-9-]+`。
    61	fn is_valid_id(value: &str) -> bool {
    62	    !value.is_empty()
    63	        && value
    64	            .chars()
    65	            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    66	}
    67	
    68	/// `src/styles/tokens.css` 已声明的 token 名（不含 `--app-` 前缀）。
    69	/// 新增内置 token 时同步此处；未声明的键一律忽略。
    70	const DECLARED_TOKENS: &[&str] = &[
    71	    "accent",
    72	    "accent-soft",
    73	    "bg",
    74	    "surface",
    75	    "sunken",
    76	    "text",
    77	    "text-strong",
    78	    "text-2",
    79	    "text-3",
    80	    "border",
    81	    "border-strong",
    82	    "radius",
    83	    "shadow",
    84	];
    85	
    86	/// 把 `theme.toml` 里的键规范化成 `--app-<name>`。
    87	/// `accent` 与 `--app-accent` 两种写法等价；未声明或形状非法返回 `None`。
    88	fn normalize_token_key(key: &str) -> Option<String> {
    89	    let name = key.strip_prefix("--app-").unwrap_or(key);
    90	    if name.is_empty()
    91	        || !name
    92	            .chars()
    93	            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    94	    {
    95	        return None;
    96	    }
    97	    if !DECLARED_TOKENS.contains(&name) {
    98	        return None;
    99	    }
   100	    Some(format!("--app-{name}"))
   101	}
   102	
   103	/// 颜色白名单：`#rgb` / `#rrggbb` / `rgb(` / `rgba(` / `hsl(` / `hsla(` / 具名色。
   104	/// 明确拒绝 `url(` / `expression(` / `var(` 等可注入 CSS 的值。
   105	fn is_valid_color(value: &str) -> bool {
   106	    let value = value.trim();
   107	    if value.is_empty() {
   108	        return false;
   109	    }
   110	    for forbidden in ["url(", "expression(", "var("] {
   111	        if value.starts_with(forbidden) {
   112	            return false;
   113	        }
   114	    }
   115	    if let Some(hex) = value.strip_prefix('#') {
   116	        return (hex.len() == 3 || hex.len() == 6) && hex.chars().all(|c| c.is_ascii_hexdigit());
   117	    }
   118	    for func in ["rgb(", "rgba(", "hsl(", "hsla("] {
   119	        if value.starts_with(func) {
   120	            return value.ends_with(')');
   121	        }
   122	    }
   123	    // 具名色：仅字母（拒绝 `red; background:url(...)` 之类）
   124	    value.chars().all(|c| c.is_ascii_alphabetic())
   125	}
   126	
   127	/// 解析单个 snippet 文件。成功返回 `Some`，失败（缺 id / 非法 frontmatter /
   128	/// 未闭合）记录 warning 并返回 `None`。
   129	fn parse_snippet(raw: &str, rel: &str, path: &Path, warnings: &mut Vec<String>) -> Option<Snippet> {
   130	    // 容忍 UTF-8 BOM。
   300	            continue;
   301	        };
   302	        templates.insert(
   303	            stem.to_string_lossy().into_owned(),
   304	            Template {
   305	                name: stem.to_string_lossy().into_owned(),
   306	                body,
   307	                path: path.to_string_lossy().into_owned(),
   308	            },
   309	        );
   310	    }
   311	    templates.into_values().collect()
   312	}
   313	
   314	/// 读取 `<dir>/theme.toml` 的 `[tokens]` 表，白名单校验键与值。
   315	fn scan_theme(dir: &Path) -> ThemeTokens {
   316	    let path = dir.join("theme.toml");
   317	    let data = match std::fs::read_to_string(&path) {
   318	        Ok(data) => data,
   319	        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
   320	            return ThemeTokens::default();
   321	        }
   322	        Err(e) => {
   323	            return ThemeTokens {
   324	                tokens: BTreeMap::new(),
   325	                warnings: vec![format!("theme.toml: 读取失败（{e}）")],
   326	            };
   327	        }
   328	    };
   329	
   330	    let mut tokens = BTreeMap::new();
   331	    let mut invalid = 0usize;
   332	    let mut warnings = Vec::new();
   333	
   334	    match toml::from_str::<toml::Value>(&data) {
   335	        Ok(toml::Value::Table(table)) => {
   336	            if let Some(toml::Value::Table(token_table)) = table.get("tokens") {
   337	                for (key, value) in token_table {
   338	                    let Some(value) = value.as_str() else {
   339	                        invalid += 1;
   340	                        continue;
   341	                    };
   342	                    let Some(key) = normalize_token_key(key) else {
   343	                        invalid += 1;
   344	                        continue;
   345	                    };
   346	                    if !is_valid_color(value) {
   347	                        invalid += 1;
   348	                        continue;
   349	                    }
   350	                    tokens.insert(key, value.to_string());
   351	                }
   352	            }
   353	        }
   354	        Ok(_) => warnings.push("theme.toml: 顶层不是表".into()),
   355	        Err(e) => warnings.push(format!("theme.toml: 解析失败（{e}）")),
   356	    }
   357	
   358	    if invalid > 0 {
   359	        warnings.push(format!("theme.toml: 忽略 {invalid} 个非法 token"));
   360	    }
   361	
   362	    ThemeTokens { tokens, warnings }
   363	}
   364	
   365	/// 扫描用户扩展目录，返回快照。任何缺失/非法都只记录 warning，不报错。
   366	pub fn scan_extensions(config_dir: &Path) -> ExtensionsSnapshot {
   367	    let mut warnings = Vec::new();
   368	    let snippets = scan_snippets(config_dir, &mut warnings);
   369	    let templates = scan_templates(config_dir, &mut warnings);
   370	    let theme = scan_theme(config_dir);
   371	
   372	    ExtensionsSnapshot {
   373	        snippets,
   374	        templates,
   375	        theme,
   376	        warnings,
   377	    }
   378	}
   379	
   380	#[cfg(test)]

exec
/bin/zsh -c "nl -ba src/lib/extensions/bundle.ts | sed -n '1,125p'; nl -ba src/editors/user-extensions.ts | sed -n '1,130p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
     2	 *
     3	 * 与 `src/editors/user-extensions.ts` 的 `loadUserExtensions` 并存（后者把
     4	 * snippets 映射成斜杠命令）；本模块负责新建页模板与主题 token。
     5	 * 任何调用异常或返回形状不对都静默返回空 bundle，不抛错
     6	 * （`list_extensions` 在纯浏览器/老版本里不存在）。
     7	 */
     8	
     9	import type { Template } from "./templates";
    10	import type { UserSnippet } from "../../editors/user-extensions";
    11	import { extractSnippets } from "../../editors/user-extensions";
    12	
    13	export interface ExtensionBundle {
    14	  templates: Template[];
    15	  themeTokens: Record<string, string>;
    16	  warnings: string[];
    17	}
    18	
    19	/** 一次 `list_extensions` 调用解析出的三类扩展数据（snippets 供斜杠菜单）。 */
    20	export interface ExtensionSnapshot {
    21	  snippets: UserSnippet[];
    22	  templates: Template[];
    23	  themeTokens: Record<string, string>;
    24	}
    25	
    26	function isRecord(value: unknown): value is Record<string, unknown> {
    27	  return typeof value === "object" && value !== null && !Array.isArray(value);
    28	}
    29	
    30	/** 宽松解析单个 template；缺 `name`/`body` 或类型不对返回 null。 */
    31	function toTemplate(raw: unknown): Template | null {
    32	  if (!isRecord(raw)) return null;
    33	  const { name, body, path } = raw;
    34	  if (typeof name !== "string" || name === "") return null;
    35	  if (typeof body !== "string") return null;
    36	  if (typeof path !== "string") return null;
    37	  return { name, body, path };
    38	}
    39	
    40	/** 从 `list_extensions` 返回值里取模板；形状不对返回空列表。 */
    41	function extractTemplates(result: unknown): Template[] {
    42	  if (!isRecord(result)) return [];
    43	  const templates = result.templates;
    44	  if (!Array.isArray(templates)) return [];
    45	  const out: Template[] = [];
    46	  for (const entry of templates) {
    47	    const template = toTemplate(entry);
    48	    if (template !== null) out.push(template);
    49	  }
    50	  return out;
    51	}
    52	
    53	/** 从 `theme.tokens` 取字符串键值对；形状不对返回空对象。 */
    54	function extractTokens(result: unknown): Record<string, string> {
    55	  if (!isRecord(result)) return {};
    56	  const theme = result.theme;
    57	  if (!isRecord(theme)) return {};
    58	  const tokens = theme.tokens;
    59	  if (!isRecord(tokens)) return {};
    60	  const out: Record<string, string> = {};
    61	  for (const [key, value] of Object.entries(tokens)) {
    62	    if (typeof value === "string") out[key] = value;
    63	  }
    64	  return out;
    65	}
    66	
    67	/** 从顶层 `warnings` 取字符串数组；形状不对返回空列表。 */
    68	function extractWarnings(result: unknown): string[] {
    69	  if (!isRecord(result)) return [];
    70	  const warnings = result.warnings;
    71	  if (!Array.isArray(warnings)) return [];
    72	  return warnings.filter((w): w is string => typeof w === "string");
    73	}
    74	
    75	/** 把 `list_extensions` 返回值映射成 bundle；形状不对的字段各自降级。 */
    76	function toBundle(result: unknown): ExtensionBundle {
    77	  return {
    78	    templates: extractTemplates(result),
    79	    themeTokens: extractTokens(result),
    80	    warnings: extractWarnings(result),
    81	  };
    82	}
    83	
    84	/**
    85	 * 调一次 `list_extensions` 并解析成 bundle。
    86	 * 异常（命令不存在/后端报错）与返回形状不对都静默返回空 bundle。
    87	 */
    88	export async function loadExtensionBundle(
    89	  invokeFn: (cmd: string) => Promise<unknown>,
    90	): Promise<ExtensionBundle> {
    91	  try {
    92	    const result = await invokeFn("list_extensions");
    93	    return toBundle(result);
    94	  } catch {
    95	    return { templates: [], themeTokens: {}, warnings: [] };
    96	  }
    97	}
    98	
    99	/**
   100	 * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
   101	 * 异常与形状不对都静默返回全空快照。
   102	 */
   103	export async function loadExtensionSnapshot(
   104	  invokeFn: (cmd: string) => Promise<unknown>,
   105	): Promise<ExtensionSnapshot> {
   106	  try {
   107	    const result = await invokeFn("list_extensions");
   108	    const bundle = toBundle(result);
   109	    return {
   110	      snippets: extractSnippets(result),
   111	      templates: bundle.templates,
   112	      themeTokens: bundle.themeTokens,
   113	    };
   114	  } catch {
   115	    return { snippets: [], templates: [], themeTokens: {} };
   116	  }
   117	}
     1	/* 用户片段（snippets）接入斜杠菜单。
     2	 *
     3	 * Rust 侧 `list_extensions` 返回的 `ExtensionsSnapshot` 里，`snippets` 是
     4	 * `{ id, label, keywords, icon?, body, path }`（serde 默认 snake_case）。
     5	 * 本模块把它映射成 `SlashCommand`，让同一套过滤/渲染/单事务插入逻辑复用。
     6	 *
     7	 * 模板与主题 token 的前端接入见 `src/lib/extensions/`（bundle / templates /
     8	 * theme-tokens），本模块只管 snippets。
     9	 *
    10	 * 任何调用异常或返回形状不对都返回空列表——菜单退回纯内置命令，
    11	 * 不抛错、不打 error 级日志（`list_extensions` 在纯浏览器/老版本里不存在）。
    12	 */
    13	
    14	import type { SlashCommand } from "./slash";
    15	
    16	/** 用户片段的原始形状（`list_extensions` 的 `snippets[]` 元素）。 */
    17	export interface UserSnippet {
    18	  id: string;
    19	  label: string;
    20	  keywords: string[];
    21	  icon?: string;
    22	  body: string;
    23	}
    24	
    25	/** 用户片段在菜单里的分组标题。 */
    26	const SNIPPET_GROUP = "我的片段";
    27	
    28	/**
    29	 * 片段 → 斜杠命令：
    30	 * - `code` 用 `snippet.id`（斜杠过滤按 code/alias 精确匹配）。
    31	 * - `keywords` 作为 `aliases`，与现有拼音过滤叠加。
    32	 * - `insert` 返回正文；`applyCommand` 用单次 `dispatch` 替换 `/query`，
    33	 *   所以插入是单事务、可撤销。
    34	 * - `inline` 按正文单行性自动标注：GFM 单元格只有一行，单行片段可安全落进
    35	 *   单元格菜单（#744）；多行片段只出现在文档级/容器级菜单。
    36	 */
    37	export function snippetToCommand(snippet: UserSnippet): SlashCommand {
    38	  return {
    39	    id: snippet.id,
    40	    code: snippet.id,
    41	    label: snippet.label,
    42	    icon: snippet.icon,
    43	    aliases: snippet.keywords,
    44	    group: SNIPPET_GROUP,
    45	    inline: !snippet.body.includes("\n"),
    46	    insert(state) {
    47	      const head = state.selection.main.head;
    48	      return { from: head - 1, to: head, text: snippet.body };
    49	    },
    50	  };
    51	}
    52	
    53	function isRecord(value: unknown): value is Record<string, unknown> {
    54	  return typeof value === "object" && value !== null && !Array.isArray(value);
    55	}
    56	
    57	/** 字符串数组校验；非数组或含非字符串元素返回 null（形状不对）。 */
    58	function asStringArray(value: unknown): string[] | null {
    59	  if (!Array.isArray(value)) return null;
    60	  const out: string[] = [];
    61	  for (const entry of value) {
    62	    if (typeof entry !== "string") return null;
    63	    out.push(entry);
    64	  }
    65	  return out;
    66	}
    67	
    68	/** 宽松解析单个 snippet；缺 `id`/`body` 或类型不对返回 null。 */
    69	function toSnippet(raw: unknown): UserSnippet | null {
    70	  if (!isRecord(raw)) return null;
    71	  const { id, label, keywords, icon, body } = raw;
    72	  if (typeof id !== "string" || id === "") return null;
    73	  if (typeof body !== "string") return null;
    74	  const kw = keywords === undefined ? [] : asStringArray(keywords);
    75	  if (kw === null) return null;
    76	  const iconValue = icon === undefined || icon === null ? undefined : icon;
    77	  if (iconValue !== undefined && typeof iconValue !== "string") return null;
    78	  return {
    79	    id,
    80	    label: typeof label === "string" && label !== "" ? label : id,
    81	    keywords: kw,
    82	    icon: iconValue,
    83	    body,
    84	  };
    85	}
    86	
    87	/** 从 `list_extensions` 返回值里取 snippets；形状不对返回空列表。 */
    88	export function extractSnippets(result: unknown): UserSnippet[] {
    89	  if (!isRecord(result)) return [];
    90	  const snippets = result.snippets;
    91	  if (!Array.isArray(snippets)) return [];
    92	  const out: UserSnippet[] = [];
    93	  for (const entry of snippets) {
    94	    const snippet = toSnippet(entry);
    95	    if (snippet !== null) out.push(snippet);
    96	  }
    97	  return out;
    98	}
    99	
   100	/**
   101	 * 调 `list_extensions` 并把 `snippets` 映射成斜杠命令。
   102	 *
   103	 * 异常（命令不存在/后端报错）与返回形状不对都静默返回 `[]`。
   104	 */
   105	export async function loadUserExtensions(
   106	  invokeFn: (cmd: string) => Promise<unknown>,
   107	): Promise<SlashCommand[]> {
   108	  try {
   109	    const result = await invokeFn("list_extensions");
   110	    return extractSnippets(result).map(snippetToCommand);
   111	  } catch {
   112	    return [];
   113	  }
   114	}

exec
/bin/zsh -c "nl -ba src/components/Grid/GridToolbar.tsx | sed -n '1,165p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
     1	import {
     2	  useEffect,
     3	  useLayoutEffect,
     4	  useRef,
     5	  useState,
     6	  type KeyboardEvent as ReactKeyboardEvent,
     7	} from "react";
     8	import Icon from "../Icon";
     9	import { useStore } from "../../stores";
    10	import { RAIL_KIND_LABELS, RAIL_KIND_ORDER } from "../../lib/railView";
    11	import {
    12	  GRID_GROUP_LABELS,
    13	  GRID_SORT_LABELS,
    14	  type GridGroupMode,
    15	  type GridSort,
    16	} from "../../lib/gridView";
    17	import type { FileTypeKind } from "../../lib/fileType";
    18	
    19	const SORT_ORDER: readonly GridSort[] = ["recent", "name", "type"];
    20	const GROUP_ORDER: readonly GridGroupMode[] = ["time", "type", "theme", "none"];
    21	
    22	const TYPE_OPTIONS: ReadonlyArray<{
    23	  kind: "all" | FileTypeKind;
    24	  label: string;
    25	}> = [
    26	  { kind: "all", label: "全部类型" },
    27	  ...RAIL_KIND_ORDER.map((kind) => ({
    28	    kind,
    29	    label: RAIL_KIND_LABELS[kind],
    30	  })),
    31	];
    32	
    33	const TYPE_MENU_CLOSE_MS = 240;
    34	
    35	/**
    36	 * 网格顶部单行工具条（layout-portal 10.1）。
    37	 *
    38	 * 类型筛选是 hover 自定义菜单（#262）；排序 / 分组 / 收藏保持原生 `<select>`。
    39	 * 网格 / 列表是两个各自定值的按钮。`/` 聚焦搜索，`×` 清空。
    40	 */
    41	export default function GridToolbar({ count }: { count: number }) {
    42	  const filter = useStore((s) => s.gridTypeFilter);
    43	  const sort = useStore((s) => s.gridSort);
    44	  const group = useStore((s) => s.gridGroup);
    45	  const pinnedOnly = useStore((s) => s.gridPinnedOnly);
    46	  const query = useStore((s) => s.gridQuery);
    47	  const gridMode = useStore((s) => s.viewSpec.gridMode);
    48	
    49	  const setFilter = useStore((s) => s.setGridTypeFilter);
    50	  const setSort = useStore((s) => s.setGridSort);
    51	  const setGroup = useStore((s) => s.setGridGroup);
    52	  const setPinnedOnly = useStore((s) => s.setGridPinnedOnly);
    53	  const setQuery = useStore((s) => s.setGridQuery);
    54	  const applyViewSpec = useStore((s) => s.applyViewSpec);
    55	
    56	  const inputRef = useRef<HTMLInputElement>(null);
    57	  const typeTriggerRef = useRef<HTMLButtonElement>(null);
    58	  const typeCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    59	  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
    60	  const [typeMenuIndex, setTypeMenuIndex] = useState(-1);
    61	  const [typeMenuPos, setTypeMenuPos] = useState<{
    62	    left: number;
    63	    top: number;
    64	    minWidth: number;
    65	  } | null>(null);
    66	
    67	  const selectedTypeIndex = Math.max(
    68	    0,
    69	    TYPE_OPTIONS.findIndex((o) => o.kind === (filter ?? "all")),
    70	  );
    71	
    72	  const cancelTypeClose = () => {
    73	    if (typeCloseTimer.current) {
    74	      clearTimeout(typeCloseTimer.current);
    75	      typeCloseTimer.current = null;
    76	    }
    77	  };
    78	
    79	  const openTypeMenu = () => {
    80	    cancelTypeClose();
    81	    const el = typeTriggerRef.current;
    82	    if (el) {
    83	      const r = el.getBoundingClientRect();
    84	      setTypeMenuPos({
    85	        left: r.left,
    86	        top: r.bottom + 4,
    87	        minWidth: r.width,
    88	      });
    89	    }
    90	    setTypeMenuIndex(selectedTypeIndex);
    91	    setTypeMenuOpen(true);
    92	  };
    93	
    94	  const scheduleTypeClose = () => {
    95	    cancelTypeClose();
    96	    typeCloseTimer.current = setTimeout(() => {
    97	      typeCloseTimer.current = null;
    98	      setTypeMenuOpen(false);
    99	      setTypeMenuIndex(-1);
   100	    }, TYPE_MENU_CLOSE_MS);
   101	  };
   102	
   103	  const selectType = (kind: "all" | FileTypeKind) => {
   104	    cancelTypeClose();
   105	    setFilter(kind === "all" ? null : kind);
   106	    setTypeMenuOpen(false);
   107	    setTypeMenuIndex(-1);
   108	  };
   109	
   110	  const onTypeTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
   111	    const last = TYPE_OPTIONS.length - 1;
   112	    if (e.key === "Escape") {
   113	      e.preventDefault();
   114	      e.stopPropagation();
   115	      cancelTypeClose();
   116	      setTypeMenuOpen(false);
   117	      setTypeMenuIndex(-1);
   118	      return;
   119	    }
   120	    if (e.key === "Enter" || e.key === " ") {
   121	      e.preventDefault();
   122	      e.stopPropagation();
   123	      if (!typeMenuOpen) {
   124	        openTypeMenu();
   125	        return;
   126	      }
   127	      const idx = typeMenuIndex >= 0 ? typeMenuIndex : selectedTypeIndex;
   128	      selectType(TYPE_OPTIONS[idx].kind);
   129	      return;
   130	    }
   131	    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
   132	    e.preventDefault();
   133	    e.stopPropagation();
   134	    if (!typeMenuOpen) {
   135	      openTypeMenu();
   136	      setTypeMenuIndex(e.key === "ArrowDown" ? 0 : last);
   137	      return;
   138	    }
   139	    setTypeMenuIndex((prev) => {
   140	      const cur = prev >= 0 ? prev : selectedTypeIndex;
   141	      return e.key === "ArrowDown"
   142	        ? Math.min(last, cur + 1)
   143	        : Math.max(0, cur - 1);
   144	    });
   145	  };
   146	
   147	  useEffect(() => {
   148	    const onKey = (e: KeyboardEvent) => {
   149	      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
   150	      const el = document.activeElement as HTMLElement | null;
   151	      const tag = el?.tagName;
   152	      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
   153	      e.preventDefault();
   154	      inputRef.current?.focus();
   155	    };
   156	    window.addEventListener("keydown", onKey);
   157	    return () => window.removeEventListener("keydown", onKey);
   158	  }, []);
   159	
   160	  useLayoutEffect(() => {
   161	    const onFocusSearch = () => inputRef.current?.focus();
   162	    window.addEventListener("grid-focus-search", onFocusSearch);
   163	    return () => window.removeEventListener("grid-focus-search", onFocusSearch);
   164	  }, []);
   165	

exec
/bin/zsh -c "nl -ba src-tauri/src/config.rs | sed -n '870,930p'" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
   870	    }
   871	    ensure_defaults(base)?;
   872	    migrate_legacy(base)?;
   873	    let current_user = read_json_or_quarantine(&user_path(base)).unwrap_or(Value::Null);
   874	    let merged = merge_json(&current_user, patch);
   875	    let config: AppConfig =
   876	        serde_json::from_value(merged).map_err(|e| json_err("patched config", e))?;
   877	    validate_config(&config)?;
   878	
   879	    snapshot_user(base)?;
   880	    let user = serde_json::to_vec_pretty(&settings_value(&config)?)
   881	        .map_err(|e| json_err("user config", e))?;
   882	    let state =
   883	        serde_json::to_vec_pretty(&state_value(&config)?).map_err(|e| json_err("state", e))?;
   884	    atomic_write(&user_path(base), &user)?;
   885	    atomic_write(&state_path(base), &state)?;
   886	    prune_snapshots(base)?;
   887	
   888	    load_config_at(base)
   889	}
   890	
   891	/// 首次启动写一份给 AI 读的配置地图；文件已存在则保留用户改动，不覆盖。
   892	pub fn seed_skill_map(app: &AppHandle) {
   893	    let path = config_base(app)
   894	        .join("skills")
   895	        .join("biaoyue")
   896	        .join("SKILL.md");
   897	    if path.exists() {
   898	        return;
   899	    }
   900	    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
   901	        warn!(error = %e, path = %path.display(), "SKILL.md 写入失败");
   902	    }
   903	}
   904	
   905	const SKILL_MAP: &str = r#"# Biaoyue 配置地图
   906	
   907	这是标月的配置心智地图，供 AI agent 读取。配置分三层，都位于应用配置目录下：
   908	
   909	| 层 | 路径 | 作用 |
   910	| --- | --- | --- |
   911	| defaults | `defaults/settings.json` | 代码默认值，首次运行生成 |
   912	| user | `user/settings.json` | 用户设置，`patch_config` 写这里 |
   913	| state | `state/state.json` | 派生状态（recentFiles / scrollPositions / embedScrollPositions），不归 patch 管 |
   914	| snapshots | `snapshots/settings-*.json` | 每次写入前的 user 层副本，保留最新 10 份 |
   915	
   916	## 可用工具
   917	
   918	- `read_config`：返回合并后的有效配置。
   919	- `patch_config`：`{"patch": {...}}`，深合并进 user 层，写入前校验并生成快照；非法值不落盘。
   920	- `list_snapshots`：返回快照文件名，最旧在前。
   921	
   922	## 可改键与取值范围（camelCase）
   923	
   924	| 键 | 范围 / 取值 |
   925	| --- | --- |
   926	| `fontSize` | 8–96 |
   927	| `readerFontSize` | 8–96 |
   928	| `readerWidth` | 480–2400 |
   929	| `sidebarLeftWidth` / `sidebarRightWidth` | 0–800 |
   930	| `horizontalSplitRatio` / `verticalSplitRatio` | 0–1 |

exec
/bin/zsh -c "rg -n \"SKILL_MAP|create_dir_all\\(.*skills|skills/biaoyue|seed_skill_map|SKILL.md\" src-tauri/src | head -n 120" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/extension_packages.rs:2://! `manifest.json` + `SKILL.md` 包。
src-tauri/src/extension_packages.rs:10://! - `<config_base>/extensions/<id>/SKILL.md`
src-tauri/src/extension_packages.rs:25:const SKILL_FILE: &str = "SKILL.md";
src-tauri/src/extension_packages.rs:70:    /// full SKILL.md text
src-tauri/src/extension_packages.rs:142:/// 读取 `dir/manifest.json` 与 `dir/SKILL.md`。任一缺失或非法都报错。
src-tauri/src/extension_packages.rs:1091:        // 缺 SKILL.md
src-tauri/src/extension_packages.rs:1224:            "SKILL.md 应包含提示词：{}",
src-tauri/src/extension_packages.rs:1276:        zip.start_file("SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1333:        zip.start_file("nested/SKILL.md", options).unwrap();
src-tauri/src/extension_packages.rs:1340:        assert!(base.join("extensions/nested-ext/SKILL.md").exists());
src-tauri/src/lib.rs:195:            config::seed_skill_map(app.handle());
src-tauri/src/config.rs:892:pub fn seed_skill_map(app: &AppHandle) {
src-tauri/src/config.rs:896:        .join("SKILL.md");
src-tauri/src/config.rs:900:    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
src-tauri/src/config.rs:901:        warn!(error = %e, path = %path.display(), "SKILL.md 写入失败");
src-tauri/src/config.rs:905:const SKILL_MAP: &str = r#"# Biaoyue 配置地图

exec
/bin/zsh -c 'rg -n "list_extension_packages|enabled.*extension|ExtensionPackage|SKILL.md" src-tauri/src/ai_agent.rs src-tauri/src/commands/ai_agent.rs src-tauri/src/lib.rs | head -n 200' in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
rg: src-tauri/src/commands/ai_agent.rs: No such file or directory (os error 2)
src-tauri/src/lib.rs:26:    generate_extension_package, import_extension_package, list_extension_packages,
src-tauri/src/lib.rs:226:            list_extension_packages,

exec
/bin/zsh -c "rg -n \"list_extension_packages|ExtensionPackage|enabled_extensions|extensions.*skill|skill.*extensions\" src src-tauri/src -g '*.ts' -g '*.tsx' -g '*.rs' | head -n 260" in /Users/mason/ToHighs/clairis-wt-design-plan
 succeeded in 0ms:
src-tauri/src/lib.rs:26:    generate_extension_package, import_extension_package, list_extension_packages,
src-tauri/src/lib.rs:226:            list_extension_packages,
src-tauri/src/extension_packages.rs:61:pub struct ExtensionPackage {
src-tauri/src/extension_packages.rs:184:fn to_package(manifest: ExtensionManifest, dir: &Path, skill: String) -> ExtensionPackage {
src-tauri/src/extension_packages.rs:185:    ExtensionPackage {
src-tauri/src/extension_packages.rs:199:fn builtin_packages() -> Vec<ExtensionPackage> {
src-tauri/src/extension_packages.rs:201:        ExtensionPackage {
src-tauri/src/extension_packages.rs:211:        ExtensionPackage {
src-tauri/src/extension_packages.rs:224:fn builtin_by_id(id: &str) -> Option<ExtensionPackage> {
src-tauri/src/extension_packages.rs:231:pub fn list_extension_packages_at(base: &Path) -> Result<Vec<ExtensionPackage>, AppError> {
src-tauri/src/extension_packages.rs:371:pub fn import_extension_package_at(base: &Path, path: &str) -> Result<ExtensionPackage, AppError> {
src-tauri/src/extension_packages.rs:413:    Ok(ExtensionPackage {
src-tauri/src/extension_packages.rs:685:) -> Result<ExtensionPackage, AppError> {
src-tauri/src/extension_packages.rs:718:    Ok(ExtensionPackage {
src-tauri/src/extension_packages.rs:743:    for package in list_extension_packages_at(base)? {
src-tauri/src/extension_packages.rs:753:pub async fn list_extension_packages(app: AppHandle) -> Result<Vec<ExtensionPackage>, AppError> {
src-tauri/src/extension_packages.rs:755:    tauri::async_runtime::spawn_blocking(move || list_extension_packages_at(&base))
src-tauri/src/extension_packages.rs:767:) -> Result<ExtensionPackage, AppError> {
src-tauri/src/extension_packages.rs:844:) -> Result<ExtensionPackage, AppError> {
src-tauri/src/extension_packages.rs:903:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:929:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:968:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1131:        let packages = list_extension_packages_at(&base).unwrap();
src-tauri/src/extension_packages.rs:1145:        let packages = list_extension_packages_at(&base).unwrap();
src/components/SettingsView.tsx:63:interface ExtensionPackage {
src/components/SettingsView.tsx:79:const SOURCE_LABELS: Record<ExtensionPackage["source"], string> = {
src/components/SettingsView.tsx:213:  const [packages, setPackages] = useState<ExtensionPackage[]>([]);
src/components/SettingsView.tsx:224:      const list = await invoke<ExtensionPackage[]>("list_extension_packages");
src/components/SettingsView.tsx:236:    invoke<ExtensionPackage[]>("list_extension_packages")
src/components/SettingsView.tsx:255:        await invoke<ExtensionPackage>("import_extension_package", {
src/components/SettingsView.tsx:314:  const togglePackage = async (pkg: ExtensionPackage, enabled: boolean) => {
src/components/SettingsView.tsx:361:      const generated = await invoke<ExtensionPackage>(

codex
## 总体判定：需修订

该文档方向可行，但尚不能作为实现基线。存在四类阻断问题：搜索被错误称为“全文”；⌘P、⌘\、⌘⇧\、⌘F 的实际行为标注错误；插件分类与真实 A1–A5 编号冲突；方案与现行 `navigation` / `application-shell` OpenSpec 规格直接冲突，却没有提出 supersede。

## 事实核查（逐项，附证据）

1. **左侧栏四段结构：主张成立，行号错误。**  
   `RAIL_SECTIONS` 实际位于 [railView.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/railView.ts:55) 的 55–63 行，不是文档所写 55–71 行。

2. **左侧栏已有搜索：机制成立，但不是“全文搜索”。**  
   300ms 去抖和 `search_documents` 调用属实，见 [ReadingRail.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Rail/ReadingRail.tsx:972)。但 [search.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/search.rs:21) 每次只读取每个文件前 64 KiB，且限制递归深度 7、最多扫描 20,000 个文件。长文档后半段不会被搜索到，不能称为全文搜索。

3. **网格已有搜索、排序、分组、过滤：成立，但过滤字段行号错误。**  
   文档引用 `stores/index.ts:447-451`，该处实际已是分栏状态。网格过滤状态在 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:440) 的 440–443 行，收藏路径在 445 行。

4. **网格搜索实际只匹配标题，不匹配路径。**  
   [gridView.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/gridView.ts:219) 的 `filterGridItems` 只比较 `item.title`。文档只说“网格已有搜索”，没有指出它与 Quick Open 的 title+path、左侧栏的内容命中语义不同。

5. **卡片含缩略图与摘要：成立。**  
   [GridTile.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Grid/GridTile.tsx:162) 的摘录缩略图和 309–314 行的摘要展示与文档一致。

6. **门户是默认场景：成立，但行号多处错误。**  
   初始场景在 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:438)，不是 445。`PortalView` 从 [App.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:964) 开始渲染；文档写的 977 行实际位于 `onStudyPage` 回调内部。⌘P 提示确实在 [PortalView.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/PortalView.tsx:348)。

7. **门户“全局发现”的数据覆盖被高估。**  
   门户只使用 `recentFiles` 的 hero、前 6 张卡和类型计数；而 `recentFiles` 被截断为最多 10 条，见 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:885) 与 [railCards.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/railCards.ts:208)。它不是可覆盖全库的发现面。

8. **Quick Open 当前能力盘点基本准确，行号略有偏差。**  
   title+path 子串匹配属实，见 [quickOpen.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/quickOpen.ts:47)。三个分组实际在 [QuickOpen.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/QuickOpen.tsx:29) 的 29–33 行，不是 32–38 行。

9. **“⌘P 已存在”是代码事实，但不是规格所称的 B-3 已实现。**  
   当前只是 Quick Open 原型；`requirements-status` 仍明确标记统一文件面板 B-3、三视图、数字直开、历史导航均无实现，见 [requirements-status.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/delivery/requirements-status.md:143)。

10. **快捷键表存在三项明确错误。**  
   - ⌘\ 只切换左侧栏可见性，不打开或聚焦搜索，见 [App.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:544)。  
   - ⌘⇧\ 只打开网格，不聚焦搜索；真正聚焦网格搜索的是 `/`，见 [GridToolbar.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Grid/GridToolbar.tsx:147)。  
   - 文档把 ⌘F 指向 `App.tsx:614`，但该行是 ⌘⇧F 沉浸阅读。CodeMirror 的 ⌘F 来自 [setup.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/setup.ts:91) 的 `searchKeymap`，不是 App 全局处理器。

11. **`RecentFile` 行号错误。**  
   实际接口在 [types/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/types/index.ts:152) 的 152–158 行，不是 178–184 行。

12. **“无 tags 字段约定”不成立。**  
   `RecentFile` 和搜索索引中没有标签模型属实，但仓库已把 `tags` 定义为规范 frontmatter 字段，别名为“标签”、类型为数组，见 [frontmatter.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/frontmatter.ts:166)。属性面板已有标签编辑与颜色逻辑，见 [DocPropertyBar.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Content/DocPropertyBar.tsx:872)。准确说法应是“已有标签约定和编辑 UI，但尚无文档级标签索引与检索”。

13. **搜索结果的时间字段实际是文件修改时间。**  
   `SearchHit.opened_at` 在 [search.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/search.rs:231) 被赋值为 `doc.modified`；最近文件扫描也同样把 mtime 写入 `opened_at`，见 [recent.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/recent.rs:190)。但打开文件时 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:889) 又写当前打开时间。同一字段混用了“最后打开”和“最后修改”两种语义。

14. **网格场景行号错误。**  
   网格覆盖层实际在 [App.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:982) 的 982–986 行；文档写的 997–999 行属于模板选择器。

15. **issue #897 的概括不准确。**  
   仓库资料表明 #897 是 28 项反馈，不只是一组视觉缺陷。相关内容包括视频缩略图与悬停浮窗、卡片标题/进度文字重叠、网格预览快捷键冲突，以及“表格数字与边线对齐”，见 [requirements.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/requirements/editor-surface-batch20/requirements.md:14) 和同文件 40 行。“#897 不是找不到文档的证据”这一结论仍成立，但文档对 #897 的具体描述属于错误压缩。

16. **插件数量前提错误。**  
   01 号文档 A 档实际有 A1–A5 五项，不是四项，见 [01-plugin-capability-extraction.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:29)。同时 B2/B3 已文件化，01 文档自身在 42–43、51 行明确说明；“B 档目前还是代码常量”不成立。

17. **插件编号与生命周期完全错位。**  
   01 文档中 A1 是扩展包，A4 是编辑器 `capabilities`。支持 `.disabled` 的也是扩展包 A1，见 [extension_packages.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:1) 和 534–564 行。04 文档却写成“数据包型 A4”，并把 A1–A3 归为无启停的数据文件。该分类没有事实依据。

18. **“设置内插件分类清单”已经是现状，不是新增发现方案。**  
   设置页已有“扩展”分类、已安装清单、导入、导出、启停、卸载、打开目录和 SKILL.md 预览，见 [SettingsView.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:85) 和 443–536 行。当前内置扩展已有两项，见 [extension_packages.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:36)。

19. **插件展示方向本身有研究依据。**  
   “不常驻主窗口、放设置深处、避免大而全插件市场”与研究结论一致，见 [plugin-management-benchmark.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/research/technical/plugin-management-benchmark.md:83) 与 111 行。但该方向不能弥补插件分类和现状盘点的错误。

20. **§8 的历史核查记录也含错误行号。**  
   `state.json` 序列化实际在 [config.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:407) 的 407–420 行，落盘在 850–855 行；文档写的 `:434-453` 主要落在有效配置合并，`:998` 是配置 watcher。

## 逻辑与遗漏问题

1. **诊断依据自相矛盾。**  
   §1 把“用户找不到文档”当既定事实，§2 又承认没有该反馈，仅将其降级为假设。随后仍断言“真正的差距在 ⌘P 内容搜索”，但没有用户访谈、失败案例或可用性测试支持。当前只能写成待验证假设，不能据此锁定主方案。

2. **与权威导航规格直接冲突。**  
   现行 [navigation/spec.md](/Users/mason/ToHighs/clairis-wt-design-plan/openspec/specs/navigation/spec.md:33) 规定 ⌘P 是唯一文件导航入口，且 R 阶段明确不搜索正文；[application-shell/spec.md](/Users/mason/ToHighs/clairis-wt-design-plan/openspec/specs/application-shell/spec.md:14) 要求移除左侧栏和 ⌘\。目标文档却以“五入口并存”为前提。若要改变这些规则，必须明确提出 supersede 和 OpenSpec change，不能只拿当前代码实现覆盖规格。

3. **“全局发现主入口”与“只看最近库和阅读空间”互相矛盾。**  
   “最近库”实际最多 10 条；“阅读空间”也不是持久化文档库，而是 `recentFiles` 的若干视图。限定到这两个集合后，较旧且不在最近 10 条中的文档仍无法发现，这不满足“全局”。

4. **搜索范围无法通过“复用 search_documents”直接实现。**  
   [search.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/search.rs:259) 的命令参数只有 `query` 和 `limit`，没有目录、候选路径或 scope。先在 Rust 全 home 扫描、再在前端过滤，既不能解决 I/O 性能，也没有真正收窄权限范围。

5. **未区分“打开时间”“修改时间”“发现时间”。**  
   当前时间分桶会把 mtime 当作 openedAt。⌘P 若按“最近、今天、本周”排序或过滤，用户看到的是修改时间，不是打开时间。必须拆字段，否则多分组排序和 UI 文案会持续失真。

6. **收藏能力不足以支撑新的收藏分组。**  
   `pinnedPaths` 只存在 Zustand 内存中，没有进入 `AppConfig` 或 `state.json`；且收藏段通过与最多 10 条的 `recentFiles` 求交集展示。文件掉出最近列表后，收藏可能不可见。新增 ⌘P 收藏组前必须先定义持久化和独立数据源。

7. **“五入口分工”只写了作用域，没有定义真正会造成混乱的匹配规则。**  
   当前至少存在四种语义：Quick Open 搜 title+path，网格只搜 title，左侧栏搜文件名/title/H1/正文片段，编辑器搜当前文本。文档没有规定匹配字段、排序、重复项合并、匹配高亮和命中后定位方式。

8. **未处理同一文档跨多个分组的重复。**  
   一个文件可能同时是页签、收藏、最近文件、正文命中。文档列出了“页签/最近/收藏/命中”四组，却没有规定一文件只出现一次、允许出现多次，或采用优先级分组加徽标。未保存且 `path=null` 的页签也无法与磁盘结果按路径去重。

9. **未保存页签的内容搜索被遗漏。**  
   Rust 命令读磁盘文件；当前 Quick Open 也只读取页签标题和路径。用户修改但未保存的正文不会出现在计划中的“内容搜索”里。需要明确是否搜索内存文本，并定义对应排序和打开行为。

10. **变体 B 的数据模型落点错误。**  
   把 tags 加进 `RecentFile` 会让标签随“最近 10 条”淘汰而消失。标签应属于文档记录或扫描索引，而不是短生命周期视图状态。“可缩放地图必须新建场景”也不能由“当前网格是覆盖层”推出，在现有网格内增加 map mode 同样是可选项。

11. **异步搜索状态设计不完整。**  
   文档只写了加载态。还缺少过期响应取消、错误态、超时、后端 panic/权限失败、空结果与失败区分。现有左侧栏在请求失败时把结果置空，用户会误以为“无命中”；⌘P 不应复制该行为。

12. **插件章节仍把“清单”当成待设计的发现入口。**  
   扩展包清单已经存在。真正的缺口是：用户是否能在同一处看到 snippets、templates、theme、capabilities 等不同生命周期对象，以及“扩展”改名为“插件”后如何处理已有文案、路径和用户认知。

13. **“清单或目录约定”不是决策。**  
   §5.4 同时保留“设置内清单”和“通过目录感知”两条互斥路线，却未选择。前者需要统一注册表和列表 API，后者只适合开发者用户；不选择就无法做原型和验收。

14. **缺少验收指标。**  
   没有定义搜索延迟、最大候选数、结果条数、排序优先级、重复率、错误率、长文档覆盖范围、隐私边界或键盘可达性。尤其无法判断“全文搜索”是否真的优于现有左侧栏。

15. **“已通过独立对抗评审”缺少依据。**  
   文档状态称已通过，但 §8 同时说明 Codex 尚未登录、仅由子代理评审、后续补跑；且结论仍是“需修订”。在当前状态下，应标为“已修订，待复审”，而不是“已通过”。

## 修订建议（按优先级）

### P0：先修事实与规格冲突

1. **重做事实基线表。**  
   删除所有硬编码行号，改为“文件 + 符号名 + 当前行为”。若保留行号，必须重新核对，并明确行号对代码漂移不稳定。

2. **把“全文搜索”改为准确名称。**  
   现实现应称为“受限本机文本检索”：仅文本类文件、每个文件前 64 KiB、深度 7、最多 20,000 文件。是否升级为真正全文检索必须单列成本。

3. **提交 OpenSpec 导航变更提案。**  
   明确是否 supersede B-3 的“唯一入口”、R 阶段“不搜正文”以及 G-1 的“移除左侧栏”。若保留五入口，必须在 spec 中逐项定义其职责；若坚持唯一入口，则删除五入口方案。

4. **定义可执行的发现语料。**  
   建议显式采用以下集合，并让 UI 标注：`打开的页签 ∪ 持久化收藏 ∪ 可配置的最近 N 条 ∪ 用户选择的文档根目录`。不要使用“阅读空间内的文档”这种没有持久化载体的名词。

5. **修改 Rust 搜索契约。**  
   给 `search_documents` 增加明确的 scope、候选路径或根目录参数；不要让前端先接受全 home 扫描结果再过滤。候选根目录必须做规范化、去重和权限/可读性处理。

6. **建立统一文档身份与去重规则。**  
   以规范化路径作为磁盘文档主键，以 tabId 标识未保存页签；同一路径最多显示一行，可通过徽标表示“已打开/收藏/最近/内容命中”。同时规定分组优先级和稳定排序。

7. **拆分时间字段。**  
   至少区分 `modifiedAt`、`lastOpenedAt` 和可选 `discoveredAt`。UI 使用哪个字段排序必须直接写在字段名和文案中。

8. **修正插件分类。**  
   严格沿用 01 文档：A1 扩展包、A2 skill map、A3 theme、A4 capabilities、A5 snippets/templates。`.disabled` 只属于 A1 扩展包；不要构造“A4 数据包”。

9. **把现有“扩展”设置页作为基线。**  
   保留现有导入、导出、启停、卸载、打开目录和预览能力，再讨论与 03 文档“扩展 → 插件”改名及数据文件清单的增量。不要重复设计已经存在的插件清单。

### P1：补齐交互与可靠性设计

10. **增加完整入口语义矩阵。**  
    每个入口至少列出：数据源、匹配字段、时间字段、排序、最大结果数、重复处理、快捷键真实动作、空态和错误态。明确 ⌘\ 是“展开阅读空间”、⌘⇧\ 是“打开网格”、`/` 才是网格搜索聚焦。

11. **先做用户证据。**  
    通过任务测试验证用户究竟失败在“不知道路径”“不知道文件名”“只记得正文”“最近列表太短”还是“入口不可见”。在此之前把变体 A 标为候选，而不是推荐结论。

12. **定义收藏持久化和搜索进入条件。**  
    将收藏移入持久化状态或独立索引；收藏检索不能依赖收藏项仍在最近 10 条中。

13. **补齐未保存页签和长文档策略。**  
    明确页签正文在前端实时匹配；磁盘长文档是否扩大读取上限、建立索引或明确显示“仅搜索前 64 KiB”。

14. **定义异步状态机。**  
    至少包括：空查询、输入中、去抖中、请求中、成功、无结果、超时、失败、过期响应丢弃。保留输入法组合态和键盘导航语义。

15. **补充验收标准。**  
    建议明确：结果去重为路径级；同一检索输入结果稳定；请求可取消；失败不得显示“无命中”；键盘可完成全部操作；不得默认无提示扫描用户整个 home。

### P2：文档一致性

16. **修正 #897 描述。**  
    引用其“28 项反馈”及与文档发现确有关系的具体条目，不把它压缩成三个不准确的视觉标签。

17. **明确插件可发现性的唯一路线。**  
    推荐以设置内统一清单为主入口，目录结构作为高级用户的次入口；不要保留“或”而不决定。

18. **把评审状态改为“已修订，待复审”。**  
    在当前版本再次通过独立评审后，才写“已通过”。
tokens used
209,115
## 总体判定：需修订

该文档方向可行，但尚不能作为实现基线。存在四类阻断问题：搜索被错误称为“全文”；⌘P、⌘\、⌘⇧\、⌘F 的实际行为标注错误；插件分类与真实 A1–A5 编号冲突；方案与现行 `navigation` / `application-shell` OpenSpec 规格直接冲突，却没有提出 supersede。

## 事实核查（逐项，附证据）

1. **左侧栏四段结构：主张成立，行号错误。**  
   `RAIL_SECTIONS` 实际位于 [railView.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/railView.ts:55) 的 55–63 行，不是文档所写 55–71 行。

2. **左侧栏已有搜索：机制成立，但不是“全文搜索”。**  
   300ms 去抖和 `search_documents` 调用属实，见 [ReadingRail.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Rail/ReadingRail.tsx:972)。但 [search.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/search.rs:21) 每次只读取每个文件前 64 KiB，且限制递归深度 7、最多扫描 20,000 个文件。长文档后半段不会被搜索到，不能称为全文搜索。

3. **网格已有搜索、排序、分组、过滤：成立，但过滤字段行号错误。**  
   文档引用 `stores/index.ts:447-451`，该处实际已是分栏状态。网格过滤状态在 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:440) 的 440–443 行，收藏路径在 445 行。

4. **网格搜索实际只匹配标题，不匹配路径。**  
   [gridView.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/gridView.ts:219) 的 `filterGridItems` 只比较 `item.title`。文档只说“网格已有搜索”，没有指出它与 Quick Open 的 title+path、左侧栏的内容命中语义不同。

5. **卡片含缩略图与摘要：成立。**  
   [GridTile.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Grid/GridTile.tsx:162) 的摘录缩略图和 309–314 行的摘要展示与文档一致。

6. **门户是默认场景：成立，但行号多处错误。**  
   初始场景在 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:438)，不是 445。`PortalView` 从 [App.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:964) 开始渲染；文档写的 977 行实际位于 `onStudyPage` 回调内部。⌘P 提示确实在 [PortalView.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/PortalView.tsx:348)。

7. **门户“全局发现”的数据覆盖被高估。**  
   门户只使用 `recentFiles` 的 hero、前 6 张卡和类型计数；而 `recentFiles` 被截断为最多 10 条，见 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:885) 与 [railCards.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/railCards.ts:208)。它不是可覆盖全库的发现面。

8. **Quick Open 当前能力盘点基本准确，行号略有偏差。**  
   title+path 子串匹配属实，见 [quickOpen.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/quickOpen.ts:47)。三个分组实际在 [QuickOpen.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/QuickOpen.tsx:29) 的 29–33 行，不是 32–38 行。

9. **“⌘P 已存在”是代码事实，但不是规格所称的 B-3 已实现。**  
   当前只是 Quick Open 原型；`requirements-status` 仍明确标记统一文件面板 B-3、三视图、数字直开、历史导航均无实现，见 [requirements-status.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/delivery/requirements-status.md:143)。

10. **快捷键表存在三项明确错误。**  
   - ⌘\ 只切换左侧栏可见性，不打开或聚焦搜索，见 [App.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:544)。  
   - ⌘⇧\ 只打开网格，不聚焦搜索；真正聚焦网格搜索的是 `/`，见 [GridToolbar.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Grid/GridToolbar.tsx:147)。  
   - 文档把 ⌘F 指向 `App.tsx:614`，但该行是 ⌘⇧F 沉浸阅读。CodeMirror 的 ⌘F 来自 [setup.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/editors/setup.ts:91) 的 `searchKeymap`，不是 App 全局处理器。

11. **`RecentFile` 行号错误。**  
   实际接口在 [types/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/types/index.ts:152) 的 152–158 行，不是 178–184 行。

12. **“无 tags 字段约定”不成立。**  
   `RecentFile` 和搜索索引中没有标签模型属实，但仓库已把 `tags` 定义为规范 frontmatter 字段，别名为“标签”、类型为数组，见 [frontmatter.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/lib/frontmatter.ts:166)。属性面板已有标签编辑与颜色逻辑，见 [DocPropertyBar.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/Content/DocPropertyBar.tsx:872)。准确说法应是“已有标签约定和编辑 UI，但尚无文档级标签索引与检索”。

13. **搜索结果的时间字段实际是文件修改时间。**  
   `SearchHit.opened_at` 在 [search.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/search.rs:231) 被赋值为 `doc.modified`；最近文件扫描也同样把 mtime 写入 `opened_at`，见 [recent.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/recent.rs:190)。但打开文件时 [stores/index.ts](/Users/mason/ToHighs/clairis-wt-design-plan/src/stores/index.ts:889) 又写当前打开时间。同一字段混用了“最后打开”和“最后修改”两种语义。

14. **网格场景行号错误。**  
   网格覆盖层实际在 [App.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/App.tsx:982) 的 982–986 行；文档写的 997–999 行属于模板选择器。

15. **issue #897 的概括不准确。**  
   仓库资料表明 #897 是 28 项反馈，不只是一组视觉缺陷。相关内容包括视频缩略图与悬停浮窗、卡片标题/进度文字重叠、网格预览快捷键冲突，以及“表格数字与边线对齐”，见 [requirements.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/requirements/editor-surface-batch20/requirements.md:14) 和同文件 40 行。“#897 不是找不到文档的证据”这一结论仍成立，但文档对 #897 的具体描述属于错误压缩。

16. **插件数量前提错误。**  
   01 号文档 A 档实际有 A1–A5 五项，不是四项，见 [01-plugin-capability-extraction.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md:29)。同时 B2/B3 已文件化，01 文档自身在 42–43、51 行明确说明；“B 档目前还是代码常量”不成立。

17. **插件编号与生命周期完全错位。**  
   01 文档中 A1 是扩展包，A4 是编辑器 `capabilities`。支持 `.disabled` 的也是扩展包 A1，见 [extension_packages.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:1) 和 534–564 行。04 文档却写成“数据包型 A4”，并把 A1–A3 归为无启停的数据文件。该分类没有事实依据。

18. **“设置内插件分类清单”已经是现状，不是新增发现方案。**  
   设置页已有“扩展”分类、已安装清单、导入、导出、启停、卸载、打开目录和 SKILL.md 预览，见 [SettingsView.tsx](/Users/mason/ToHighs/clairis-wt-design-plan/src/components/SettingsView.tsx:85) 和 443–536 行。当前内置扩展已有两项，见 [extension_packages.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/extension_packages.rs:36)。

19. **插件展示方向本身有研究依据。**  
   “不常驻主窗口、放设置深处、避免大而全插件市场”与研究结论一致，见 [plugin-management-benchmark.md](/Users/mason/ToHighs/clairis-wt-design-plan/docs/research/technical/plugin-management-benchmark.md:83) 与 111 行。但该方向不能弥补插件分类和现状盘点的错误。

20. **§8 的历史核查记录也含错误行号。**  
   `state.json` 序列化实际在 [config.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/config.rs:407) 的 407–420 行，落盘在 850–855 行；文档写的 `:434-453` 主要落在有效配置合并，`:998` 是配置 watcher。

## 逻辑与遗漏问题

1. **诊断依据自相矛盾。**  
   §1 把“用户找不到文档”当既定事实，§2 又承认没有该反馈，仅将其降级为假设。随后仍断言“真正的差距在 ⌘P 内容搜索”，但没有用户访谈、失败案例或可用性测试支持。当前只能写成待验证假设，不能据此锁定主方案。

2. **与权威导航规格直接冲突。**  
   现行 [navigation/spec.md](/Users/mason/ToHighs/clairis-wt-design-plan/openspec/specs/navigation/spec.md:33) 规定 ⌘P 是唯一文件导航入口，且 R 阶段明确不搜索正文；[application-shell/spec.md](/Users/mason/ToHighs/clairis-wt-design-plan/openspec/specs/application-shell/spec.md:14) 要求移除左侧栏和 ⌘\。目标文档却以“五入口并存”为前提。若要改变这些规则，必须明确提出 supersede 和 OpenSpec change，不能只拿当前代码实现覆盖规格。

3. **“全局发现主入口”与“只看最近库和阅读空间”互相矛盾。**  
   “最近库”实际最多 10 条；“阅读空间”也不是持久化文档库，而是 `recentFiles` 的若干视图。限定到这两个集合后，较旧且不在最近 10 条中的文档仍无法发现，这不满足“全局”。

4. **搜索范围无法通过“复用 search_documents”直接实现。**  
   [search.rs](/Users/mason/ToHighs/clairis-wt-design-plan/src-tauri/src/commands/search.rs:259) 的命令参数只有 `query` 和 `limit`，没有目录、候选路径或 scope。先在 Rust 全 home 扫描、再在前端过滤，既不能解决 I/O 性能，也没有真正收窄权限范围。

5. **未区分“打开时间”“修改时间”“发现时间”。**  
   当前时间分桶会把 mtime 当作 openedAt。⌘P 若按“最近、今天、本周”排序或过滤，用户看到的是修改时间，不是打开时间。必须拆字段，否则多分组排序和 UI 文案会持续失真。

6. **收藏能力不足以支撑新的收藏分组。**  
   `pinnedPaths` 只存在 Zustand 内存中，没有进入 `AppConfig` 或 `state.json`；且收藏段通过与最多 10 条的 `recentFiles` 求交集展示。文件掉出最近列表后，收藏可能不可见。新增 ⌘P 收藏组前必须先定义持久化和独立数据源。

7. **“五入口分工”只写了作用域，没有定义真正会造成混乱的匹配规则。**  
   当前至少存在四种语义：Quick Open 搜 title+path，网格只搜 title，左侧栏搜文件名/title/H1/正文片段，编辑器搜当前文本。文档没有规定匹配字段、排序、重复项合并、匹配高亮和命中后定位方式。

8. **未处理同一文档跨多个分组的重复。**  
   一个文件可能同时是页签、收藏、最近文件、正文命中。文档列出了“页签/最近/收藏/命中”四组，却没有规定一文件只出现一次、允许出现多次，或采用优先级分组加徽标。未保存且 `path=null` 的页签也无法与磁盘结果按路径去重。

9. **未保存页签的内容搜索被遗漏。**  
   Rust 命令读磁盘文件；当前 Quick Open 也只读取页签标题和路径。用户修改但未保存的正文不会出现在计划中的“内容搜索”里。需要明确是否搜索内存文本，并定义对应排序和打开行为。

10. **变体 B 的数据模型落点错误。**  
   把 tags 加进 `RecentFile` 会让标签随“最近 10 条”淘汰而消失。标签应属于文档记录或扫描索引，而不是短生命周期视图状态。“可缩放地图必须新建场景”也不能由“当前网格是覆盖层”推出，在现有网格内增加 map mode 同样是可选项。

11. **异步搜索状态设计不完整。**  
   文档只写了加载态。还缺少过期响应取消、错误态、超时、后端 panic/权限失败、空结果与失败区分。现有左侧栏在请求失败时把结果置空，用户会误以为“无命中”；⌘P 不应复制该行为。

12. **插件章节仍把“清单”当成待设计的发现入口。**  
   扩展包清单已经存在。真正的缺口是：用户是否能在同一处看到 snippets、templates、theme、capabilities 等不同生命周期对象，以及“扩展”改名为“插件”后如何处理已有文案、路径和用户认知。

13. **“清单或目录约定”不是决策。**  
   §5.4 同时保留“设置内清单”和“通过目录感知”两条互斥路线，却未选择。前者需要统一注册表和列表 API，后者只适合开发者用户；不选择就无法做原型和验收。

14. **缺少验收指标。**  
   没有定义搜索延迟、最大候选数、结果条数、排序优先级、重复率、错误率、长文档覆盖范围、隐私边界或键盘可达性。尤其无法判断“全文搜索”是否真的优于现有左侧栏。

15. **“已通过独立对抗评审”缺少依据。**  
   文档状态称已通过，但 §8 同时说明 Codex 尚未登录、仅由子代理评审、后续补跑；且结论仍是“需修订”。在当前状态下，应标为“已修订，待复审”，而不是“已通过”。

## 修订建议（按优先级）

### P0：先修事实与规格冲突

1. **重做事实基线表。**  
   删除所有硬编码行号，改为“文件 + 符号名 + 当前行为”。若保留行号，必须重新核对，并明确行号对代码漂移不稳定。

2. **把“全文搜索”改为准确名称。**  
   现实现应称为“受限本机文本检索”：仅文本类文件、每个文件前 64 KiB、深度 7、最多 20,000 文件。是否升级为真正全文检索必须单列成本。

3. **提交 OpenSpec 导航变更提案。**  
   明确是否 supersede B-3 的“唯一入口”、R 阶段“不搜正文”以及 G-1 的“移除左侧栏”。若保留五入口，必须在 spec 中逐项定义其职责；若坚持唯一入口，则删除五入口方案。

4. **定义可执行的发现语料。**  
   建议显式采用以下集合，并让 UI 标注：`打开的页签 ∪ 持久化收藏 ∪ 可配置的最近 N 条 ∪ 用户选择的文档根目录`。不要使用“阅读空间内的文档”这种没有持久化载体的名词。

5. **修改 Rust 搜索契约。**  
   给 `search_documents` 增加明确的 scope、候选路径或根目录参数；不要让前端先接受全 home 扫描结果再过滤。候选根目录必须做规范化、去重和权限/可读性处理。

6. **建立统一文档身份与去重规则。**  
   以规范化路径作为磁盘文档主键，以 tabId 标识未保存页签；同一路径最多显示一行，可通过徽标表示“已打开/收藏/最近/内容命中”。同时规定分组优先级和稳定排序。

7. **拆分时间字段。**  
   至少区分 `modifiedAt`、`lastOpenedAt` 和可选 `discoveredAt`。UI 使用哪个字段排序必须直接写在字段名和文案中。

8. **修正插件分类。**  
   严格沿用 01 文档：A1 扩展包、A2 skill map、A3 theme、A4 capabilities、A5 snippets/templates。`.disabled` 只属于 A1 扩展包；不要构造“A4 数据包”。

9. **把现有“扩展”设置页作为基线。**  
   保留现有导入、导出、启停、卸载、打开目录和预览能力，再讨论与 03 文档“扩展 → 插件”改名及数据文件清单的增量。不要重复设计已经存在的插件清单。

### P1：补齐交互与可靠性设计

10. **增加完整入口语义矩阵。**  
    每个入口至少列出：数据源、匹配字段、时间字段、排序、最大结果数、重复处理、快捷键真实动作、空态和错误态。明确 ⌘\ 是“展开阅读空间”、⌘⇧\ 是“打开网格”、`/` 才是网格搜索聚焦。

11. **先做用户证据。**  
    通过任务测试验证用户究竟失败在“不知道路径”“不知道文件名”“只记得正文”“最近列表太短”还是“入口不可见”。在此之前把变体 A 标为候选，而不是推荐结论。

12. **定义收藏持久化和搜索进入条件。**  
    将收藏移入持久化状态或独立索引；收藏检索不能依赖收藏项仍在最近 10 条中。

13. **补齐未保存页签和长文档策略。**  
    明确页签正文在前端实时匹配；磁盘长文档是否扩大读取上限、建立索引或明确显示“仅搜索前 64 KiB”。

14. **定义异步状态机。**  
    至少包括：空查询、输入中、去抖中、请求中、成功、无结果、超时、失败、过期响应丢弃。保留输入法组合态和键盘导航语义。

15. **补充验收标准。**  
    建议明确：结果去重为路径级；同一检索输入结果稳定；请求可取消；失败不得显示“无命中”；键盘可完成全部操作；不得默认无提示扫描用户整个 home。

### P2：文档一致性

16. **修正 #897 描述。**  
    引用其“28 项反馈”及与文档发现确有关系的具体条目，不把它压缩成三个不准确的视觉标签。

17. **明确插件可发现性的唯一路线。**  
    推荐以设置内统一清单为主入口，目录结构作为高级用户的次入口；不要保留“或”而不决定。

18. **把评审状态改为“已修订，待复审”。**  
    在当前版本再次通过独立评审后，才写“已通过”。
