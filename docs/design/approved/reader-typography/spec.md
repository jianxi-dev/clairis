---
title: "Markdown 预览排版与阅读体验设计（reader typography）"
type: design
status: accepted
last_updated: 2026-09-15
source_of_truth: supporting
---

# Markdown 预览排版方案（reader typography）

> 状态：**已定案并实施**（2026-08-29）。探索过程保留在 `docs/design/explorations/reader-typography/`。
> 目标：让预览区从"能看"变成"耐看、易看、信息好取"——易读性 + 美感是核心诉求。
> 范围：预览渲染管线（`src/renderers/`）+ 预览样式 + `PreviewView` 容器 + 阅读设置项。不动编辑器、不动分栏。
>
> 落地位置：`src/styles/tokens.css`（全局语义色）、`src/styles/reader.css`（阅读排版）、
> `src/renderers/{markdown,highlight,math}.ts`、`src/components/Content/{PreviewView,ReaderSettingsPopover}.tsx。

## 1. 结论摘要

1. 预览的"丑"主要是**排版系统缺失**，不是配色问题：无尺度、无垂直节奏、行宽失控、代码无高亮。
2. 改造重心依次是：**行宽与行高 → 标题层级与段落节奏 → 代码块（含语法高亮）→ 纸墨配色与容器层次 → 元素细节**。装饰是最后 10%，排版是前 90%。
3. 语法高亮**零新依赖**：复用已安装的 `@lezer/highlight@1.2.3` + `@codemirror/lang-*`（已实测跑通，见 §6）。
4. 风格定案为**折中方案**：**A 的纸墨配色 + B 的卡片块边界**，并做成**可插拔的多皮肤架构**（新增一种风格 ≈ 15 行变量）。
5. 本轮新增能力：**公式（KaTeX）**、**Callout（`> [!NOTE]`）**、**内嵌 HTML/CSS 支持**、**阅读设置（字号 / 行宽 / 风格）**。
6. **主题色与全局合并**：新建 `--app-*` 全局语义色层，强调色沿用 D7 定案的 indigo（`#6366f1` / `#818cf8`），预览侧默认继承——换主题色只改一处；老 UI 渐进迁移，本期不做大替换（详见 §5.2）。
7. 行宽沿用 `approved/shell-ui/spec.md` 已定案的**三档 pill + 滑块**控件，默认档按你的要求设为 **1080px**（三档 720 / 1080 / 1200，滑块 400–1200）；表格与代码块走 1200px 宽通道，宽内容不被正文宽度卡住。

## 2. 现状诊断

| # | 问题 | 位置 | 对阅读的影响 |
|---|---|---|---|
| 1 | 预览样式是 2020 年前的 GitHub 风格，hex 硬编码，light/dark **两套几乎全量重复** | `src/styles/theme-light.css:18-190`、`src/styles/theme-dark.css:16-90` | 改一处要改两遍，变量不统一，主题一多必然失控 |
| 2 | 标题无尺度：`h1..h6` 是 `1.85/1.6/1.4/1.25/1.15/1.1` 随手倍数，**h3~h6 字号差 <15%**，只能靠颜色区分 | `theme-light.css:26-68` | 层级不可辨 → 扫读失效，找不到结构 |
| 3 | 垂直节奏缺失：段落 `margin: 0.5em 0`、列表项 `0.2em` | `theme-light.css:74-81` | 中文密排时段间只隔半行，段落边界糊成一片 |
| 4 | **行宽写死 1180px、无档位**：中文一行 60+ 字，且表格/代码块与正文抢同一宽度 | `src/components/Content/PreviewView.tsx:257` | 想宽想窄都由不得用户；宽表格与长代码行被正文宽度卡住 |
| 5 | **代码块无语法高亮**，纯灰底同色文字 | `theme-light.css:141-151` | "丑"的最大单点来源；代码是高密度信息，全同色极难读 |
| 6 | 背景纯白 `#ffffff` + 正文 `#24292e`；暗色 `#0d1117`（代码托管站配色） | `theme-light.css:4-5`、`theme-dark.css:4-5` | 对比过强刺眼；暗色与阅读场景不匹配 |
| 7 | 字体栈未为中文优化，无 `text-wrap`/`line-break`/标点处理，中英混排无间距 | `src/styles/editor.css:22-27` | 混排粘连、行尾孤字、标点占位生硬 |
| 8 | 引用被灰化、表格全边框 + 实心灰表头、`hr` 一根实线、图片无圆角/说明 | `theme-light.css:154-190` | 引用内容也是要读的，灰化等于自我降级；表格噪音大 |
| 9 | 任务列表用原生 checkbox；完成项整行 `line-through` | `theme-light.css:84-97` | 删除线直接降低可读性；原生控件各系统观感不一 |
| 10 | 底部**常驻**灰色提示条；预览区白底到边无容器感 | `PreviewView.tsx:262-264` | 视觉噪音；缺少"内容是一张纸"的层次 |
| 11 | **内嵌 HTML 被剥光**：白名单只有 25 个标签，无 `div`/`span`/`details`/`kbd` 等 | `src/renderers/markdown.ts:4-17` | md 里写的 HTML 结构/样式全部失效 |
| 12 | **无公式支持**，数学内容只能看到裸 `$...$` | — | 理工类文档直接不可用 |
| 13 | **无 Callout**：`> [!NOTE]` 被当成普通引用 | — | 缺少最重要的信息分层手段 |

附带问题：预览与编辑器共用 `--editor-font-size`（`src/hooks/useConfig.ts:181`），阅读舒适字号通常大于编辑字号，两者耦合。

## 3. 参考基准

- **行宽**：长文正文 60–75 字符（西文）／30–50 汉字；Markant、cwMarkdown、Medium、Notion 均用居中阅读栏 + 可调宽度。
- **字号**：正文 ≥16px（USWDS）；阅读类应用实际落在 17–19px。
- **行高**：中文正文 1.7–1.8（高于西文 1.5–1.6，汉字密度大且无升降部）。
- **reader 类应用标配**：多主题、居中阅读栏、可调宽度、语法高亮、导航大纲。

## 4. 设计原则

1. **排版优先于装饰**——先解决尺度、节奏、行宽、对比，再谈圆角和阴影。
2. **内容即界面**——去掉常驻提示条等 chrome，让位给文本。
3. **排版与外观分层**——尺度层全局唯一，外观层可插拔；新增风格不改结构规则。
4. **一套 token，两套主题（N 套皮肤）**——light/dark 只换变量，规则只写一遍。
5. **语义化墨色阶**——正文/次级/弱化/强调各司其职，不用纯黑纯白。
6. **零新依赖优先**——已装的 lezer/CodeMirror 语言包足够做高亮，不引 highlight.js/shiki；只有公式能力（KaTeX）值得破例。
7. **可降级**——任何增强失败或超限都退回朴素渲染，不影响正文；安全底线（script / iframe / `on*` / `javascript:`）永不放开。

## 5. 视觉方案（定案：A 配色 + B 卡片块）

### 5.1 视觉载体：纸—墨—朱

窗口底（暖灰）→ 纸（内容区）→ 墨（文字）三层，预览区像一张纸浮在窗口上，这是质感提升的关键一招。

- **纸**：内容区不是纯白，是微暖纸白；窗口底色比纸略深一档，形成层次。
- **墨**：正文是墨色而非纯黑；标题更浓，弱化信息是淡墨。
- **朱/靛**：强调色**不另造**——直接吃全局 `--app-accent`（见 §5.2，D7 定案的 indigo）；行内代码用低饱和朱色做辨识。

### 5.2 全局主题层 + 多皮肤架构（回答：能否与软件主题色合并）

**建议：合并，而且应该合并——但走渐进迁移，不做一次性大替换。**

现状是主题色散落两处：UI 侧是 tailwind 硬编码 + `theme-*.css` 的 hex，预览侧是另一套 `--reader-*`。各写各的后果是——换一次主题色要改 N 个文件，且预览与 chrome 容易割裂（侧栏冷灰、预览暖纸白）。

**三级 token 体系**（自下而上，上层可覆盖下层）：

| 层 | 前缀 | 内容 | 覆盖者 |
|---|---|---|---|
| ① 全局语义色 | `--app-*` | bg / surface / sunken / text / text-2 / text-3 / border / border-strong / **accent** / accent-soft / radius / shadow | `.dark` |
| ② 阅读外观 | `--reader-*` | paper / ink / sunken / line / accent / radius / shadow | `[data-skin=…]`（默认全部指向 `--app-*`） |
| ③ 排版尺度 | `--type-*` | 字号、行高、行宽、间距尺度、字重 | ❌ 全局唯一 |

映射关系（默认皮肤 `paper` 直接吃全局语义色，不另起炉灶）：

```css
:root {
  /* ① 全局：与 D7 品牌色定案对齐 */
  --app-accent: #6366f1;                    /* indigo-500，light */
  --app-bg: #f7f7f6;  --app-surface: #fbfaf8;  --app-sunken: #f4f2ec;
  --app-text: #24262b;  --app-text-2: #55595f;  --app-text-3: #8b8f96;
  --app-border: #e7e3db;  --app-border-strong: #d8d3c8;

  /* ② 阅读：默认继承全局，皮肤可整体覆盖一层 */
  --reader-paper: var(--app-surface);
  --reader-ink: var(--app-text);
  --reader-accent: var(--app-accent);
  /* …其余同理… */
}
.dark { --app-accent: #818cf8; /* indigo-400 */ --app-surface: #1a1b1e; /* … */ }

/* 换风格 = 只盖一层外观变量，结构规则零改动 */
[data-skin="modern"] { --reader-paper: #fafafa; --reader-radius: 12px; /* … */ }
```

**对已有设计决策的取舍（不理想就调整，不照搬）**：

- **UI 强调色沿用 D7**：`--app-accent` = `#6366f1` / `#818cf8`（indigo），服务 focus ring、选中态、活跃指示器、目录高亮——这些是交互信号，需要醒目且与软件整体一致，D7 的定案没问题。
- **阅读强调色不沿用 D7，独立取值**。`#6366f1` 饱和度高，放在暖白纸底（`#fbfaf8`）上偏“数码感”，与纸墨阅读气质冲突，且对纸白对比度仅约 4.6:1（刚过 AA 线）。长文阅读里链接色是**每分钟要看几十次**的元素，标准是沉稳、高对比、久看不刺眼，而不是抢眼。因此 `--reader-accent` 取**低饱和靛青** `#3d5a8a`（light，对纸白 ≈ 6.3:1）/ `#8ab4e8`（dark ≈ 7.1:1）。
- **两者仍是一套体系**：`--reader-accent` 默认独立取值，但改一行即可挂回全局（`--reader-accent: var(--app-accent)`）——想完全统一随时可切。这不是二选一的架构问题，是一个变量的默认值问题。
- 同理，`approved/shell-ui/spec.md` 的默认阅读宽度 720px 也**没有照搬**：它适合分栏阅读，但你的实际偏好是更宽，因此机制沿用、默认档上移到 1080px。
- D7 自身也注明「`#4f5bd5` 是起点，实际效果需在亮/暗模式下验证后微调」——本期定案后应在真实文档上再校一轮色值。
- **代码语法配色独立于品牌色**（自成低饱和矿物色族，见 §6.2）：语法高亮是高密度语义色，与 UI accent 混用会互相干扰（这也是 VS Code 等编辑器的惯例），不随主题色改变，只随明暗切一套。

**迁移策略（关键）**：D7 注意事项 3 已指出「`theme-light.css` + `theme-dark.css` 合并为 `tokens.css`」是破坏性修改。因此分两步：

1. **本期**：新建 `src/styles/tokens.css` 承载 ① 全局语义色（accent = D7 indigo）；预览侧全部走新 token；`theme-*.css` 中的 `.preview-view*` 段落按 §10 步骤 2 删除，其余原样保留。
2. **后续（对齐 design-codex 路线图 Phase 0.8 / 0.95）**：按 Toolbar → TabBar → Sidebar 逐模块把硬编码换成 `var(--app-*)`，**每模块一个 PR、独立验证**，不做一次性全量替换。

**成本对比**：一次性合并 = 巨大 diff + 全量回归风险；渐进 = 本期零回归，且主题色统一入口从第 1 步就建立，后续模块迁移退化为纯机械替换。

**皮肤清单（初版只出一套）**：

| 皮肤 | 气质 | 状态 |
|---|---|---|
| `paper` | 纸墨·克制：微暖纸白、低饱和靛青强调、小圆角、极淡阴影 | **初版只做这一套**（light + dark 两份变量） |
| `modern` / `ink` / `sepia` / `mint` | 现代精致 / 深墨 / 羊皮 / 青瓷 | 架构已留好，后续按需要加，不改结构 |

### 5.3 外观 token（`paper` / dark）

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--reader-paper` | `#fbfaf8` | `#1a1b1e` | 纸（内容区底） |
| `--reader-sunken` | `#f4f2ec` | `#22242a` | 代码块/表头/引用底 |
| `--reader-ink` | `#24262b` | `#d8dade` | 正文墨色 |
| `--reader-ink-strong` | `#16181c` | `#eceef1` | 标题 |
| `--reader-ink-2` | `#55595f` | `#a7abb3` | 次级（引用、表头） |
| `--reader-ink-3` | `#8b8f96` | `#75797f` | 弱化（说明、语言标签、已完成项） |
| `--reader-line` | `#e7e3db` | `#2e3138` | 分隔线 |
| `--reader-line-2` | `#d8d3c8` | `#3d4149` | 强调分隔 |
| `--reader-accent` | `#3d5a8a`（默认独立；改一行即可挂回 `var(--app-accent)` = `#6366f1`） | `#8ab4e8` | 链接 / 引用条 / Callout 主色（低饱和靛青，对纸白 ≈ 6.3:1） |
| `--reader-accent-soft` | `rgba(61,90,138,.10)` | `rgba(138,180,232,.14)` | hover / 引用条 / Callout 底 |
| `--reader-radius` | `6px`（`modern` 12px） | 同 | 圆角 |
| `--reader-shadow` | `0 1px 2px rgba(31,26,20,.05), 0 8px 24px rgba(31,26,20,.05)` | 同（加深） | 纸的投影 / 卡片 |

字体栈（西文在前、中文在后，让西文用字形更优的字体，中文 fallback 到苹方）：

```
--type-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
  "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC",
  "Microsoft YaHei", sans-serif;
--type-font-mono: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, "PingFang SC", monospace;
```

### 5.4 排版尺度（排版层，皮肤不覆盖）

| 项 | 值 | 说明 |
|---|---|---|
| `--type-font-size` | **17px 默认**，独立于 `--editor-font-size` | 设置项：15 / 16 / 17 / 18 / 19 / 21 |
| `--type-line` | 1.78（标题 1.3，代码 1.65） | 中文正文行高 |
| `--type-measure` | **1080px 默认**，档位 860 / 1080 / 1280px / 铺满 | 正文行宽；1080 保留现有宽阔观感，另给紧凑与宽松两档随时切换 |
| `--type-measure-wide` | **1200px** | 表格、代码块、图片的宽通道（比正文宽 120px），宽内容不被正文宽度卡住 |
| 标题 | h1 1.75em/700 · h2 1.4em/700 · h3 1.2em/650 · h4 1.05em/650 · h5 0.95em/650 · h6 0.875em/650 + 字距 +0.04em + 弱化色 | 拉开差距；h4 以下靠**字重 + 字距 + 色阶**区分，不再只靠颜色 |
| 段落/块间距 | 1.15em | 段落、列表、表格、代码块、引用、Callout 统一 |
| 标题间距 | h1 上 0（首个元素）/下 0.9em · h2 上 1.9em/下 0.75em · h3 上 1.6em/下 0.6em · h4–h6 上 1.4em/下 0.5em | 上间距 > 下间距，形成"归属下一节"的节奏 |
| 列表项 | 0.4em，嵌套缩进 1.5em | 呼吸感 |
| 页面留白 | 上 2.5rem · 下 6rem · 左右 2rem | 顶部不贴边，底部留滚动余量 |

**宽通道实现**（正文窄、宽元素宽，一行 CSS 搞定）：

```css
.preview-content { max-width: var(--type-measure-wide); margin-inline: auto; }
.preview-content > *:not(.wide) { max-width: var(--type-measure); margin-inline: auto; }
```

### 5.5 元素细则

- **标题**：`text-wrap: balance`（多行标题两端更齐）；h1/h2 不用装饰线，靠留白与字重分级。
- **段落**：`text-wrap: pretty`（避免行尾孤字）；段间距而非首行缩进；**禁用 `text-align: justify`**（中文 justify 会产生难看的字距拉伸）。
- **列表**：`::marker` 用弱化色，保留定位但降低存在感。
- **任务列表**：原生 input 改 `appearance: none` 自绘——16px 圆角方框，勾选时墨蓝填充 + 白色对勾；**完成项只变灰（`--reader-ink-3`），不加删除线**（删除线会显著伤害可读性；内容仍然清晰可见，只是退到背景层）。
- **引用**：左侧 2px 墨蓝淡条 + 极淡底 + **次级墨色（不灰化）**；嵌套引用不再叠加底色。
- **表格**：`width: 100%` 占满内容区可用宽度（走 wide 通道），列宽按内容自动分配（不强制均分）；单元格 `overflow-wrap: anywhere`，长句 / 长 URL / 长英文单词 / 长标识符可断行，不再按内容自然宽度横向延展；极端不可断内容（如内嵌固定宽度元素）仅在 `.table-wrap` 容器（保留圆角）内横向滚动兜底，不溢出纸面；`border-collapse: separate`、**只留横向分隔线**（去掉纵向线噪音）；表头浅底 + 600 字重；`tbody tr:hover` 极淡 accent 底，横向扫读不串行。
- **行内代码**：沉底 + 1px 边框 + 4px 圆角 + 0.88em + 低饱和朱色（light `#a03a63` / dark `#e59ac0`），比中性灰更易在段落中被扫到。
- **链接**：accent 色 + 1px 下划线 + `text-underline-offset: .18em`；hover 加粗下划线 + 极淡 accent 底；保留现有 `target="_blank"` 逻辑。
- **链接悬浮卡片**（新增）：hover 停留约 350ms 后，在链接下方浮出卡片——外链显示完整 URL 与域名，本地文件显示路径与标题；卡片上提供**复制**与**打开**两个动作。卡片用原生 `resize: both` 支持**拖拽调整大小**（零 JS），位置与尺寸在会话内记忆。卡片贴着链接出现，不做全局浮动窗口，避免遮挡正文。
- **图片**：6px 圆角 + 极淡阴影 + 居中；`title`/`alt` 渲染为 `figcaption`（弱化小字居中）；点击放大逻辑不动。
- **hr**：弃用实线，改居中三小点（`radial-gradient` 平铺），分隔但不割裂。
- **中西文间距**：渲染后在 CJK 与 Latin/数字之间插入 `<span class="cjk-pad">`（CSS 给 `width: .12em`，**不含真实空格字符**，复制文本不会带入多余空格）；跳过 `pre`/`code`/公式节点。

### 5.6 Callout（`> [!NOTE]`）

- **语法**：`> [!NOTE] 可选标题` 起头，后续行同属一个引用块；`> [!NOTE]-` 表示折叠（`-` 后缀）。
- **支持类型**（语义色克制，不做荧光块）：

| 类型 | 用途 | 主色（light / dark） |
|---|---|---|
| `note` / `abstract` / `summary` / `info` | 补充信息 | `#3d5a8a` / `#8ab4e8`（同 `--reader-accent`） |
| `tip` / `hint` / `success` / `check` | 建议与结论 | `#2f7a4f` / `#7fbf92` |
| `important` | 关键 | `#7a4f9d` / `#b79ae0` |
| `warning` / `caution` / `attention` | 注意 | `#b1551e` / `#dfa76a` |
| `danger` / `error` / `failure` / `bug` | 危险 | `#a8402f` / `#e08b7a` |
| `question` / `help` / `faq` | 疑问 | `#3a6b6b` / `#7fc4c4` |
| `example` | 示例 | `#55595f` / `#a7abb3` |
| `quote` / `cite` | 引述 | `#8b8f96` / `#75797f` |

- **呈现**：左侧 3px 主色条 + 极淡主色底（8% 透明）+ 圆角 + 标题行（图标 + 类型名/自定义标题，主色）；正文用正常墨色（**不灰化**）。
- **图标**：纯 CSS `::before` + `mask-image` 内联 SVG，`background-color: currentColor` 上色——无依赖、随主题变色。
- **折叠**：`[!TYPE]-` 渲染为 `<details>` + `<summary>`（原生，零 JS）。
- **兜底**：未知类型按 `note` 处理；`> [!` 后面不是类型时不转换（仍是普通引用）。

### 5.7 中文排版增强（渐进增强，不支持的浏览器自动忽略）

```css
text-wrap: pretty;              /* 段落避免孤字 */
line-break: strict;             /* 严格禁则，破折号/省略号不拆行 */
overflow-wrap: break-word;
hanging-punctuation: allow-end; /* Safari：行尾标点悬挂 */
text-spacing-trim: space-first; /* Safari：标点挤压 */
```

## 6. 代码高亮：零新依赖 + 配色体系

### 6.1 技术选型（已实测跑通）

- `@lezer/highlight@1.2.3` 的 `highlightCode()` + `classHighlighter` 直接产出 `<span class="tok-xxx">` 字符串。
- `@codemirror/lang-javascript|python|css|html|json|yaml|markdown` 已在 `node_modules`，用 `xxLanguage.parser.parse(code)` 取树。
- 实测 class 仅 11 类（JS/Python 样本）：`tok-keyword`、`tok-string`、`tok-string2`、`tok-number`、`tok-comment`、`tok-operator`、`tok-punctuation`、`tok-variableName`、`tok-propertyName`、`tok-className`、`tok-definition`；补齐 CSS/HTML 后另有 `tok-tagName`、`tok-attributeName`、`tok-typeName`、`tok-bool`、`tok-null`、`tok-meta`、`tok-heading` 等。CSS 侧约 22 条规则全覆盖。
- **语言覆盖**：js/ts/jsx、python、css、html、json、yaml、markdown 原生支持；其余语言（bash/sql/rust/go/java）无对应 parser → 兜底朴素代码块（不为未支持语言引新包）。

### 6.2 美观度要求（不是有高亮就行）

配色必须成体系，否则比不高亮更廉价。四条硬约束：

1. **同一色相族、统一饱和度**：全部取自低饱和"矿物色"族（紫红/苔绿/赭石/靛蓝/青瓷），避免流行主题里那种荧光青紫。
2. **对比度达标**：每个 token 色对代码块底色满足 WCAG AA 4.5:1（正文级），弱化类（注释/标点）不低于 3:1。
3. **与纸同色系**：代码底色取自 `--reader-sunken`（纸的沉色），不是外接的"IDE 灰"，保证代码块像纸上的一块墨，而不是贴上去的卡片。
4. **背景越深，颜色越亮但饱和度不增**：dark 只调整明度与轻微色相，保持与 light 的"同一种颜料"关系。

| Token 类 | Light | Dark | 语义 |
|---|---|---|---|
| keyword / controlKeyword / moduleKeyword | `#9d3a7d` | `#c9a0e0` | 紫红 |
| string / string2 / docString / regexp | `#2f7a4f` | `#93cf9f` | 苔绿 |
| number / bool / null / unit | `#b1551e` | `#dfae72` | 赭石 |
| comment / meta（斜体） | `#8b8f96` | `#6f7784` | 淡墨 |
| function / variableName.definition | `#2b5f8f` | `#8ab4e8` | 靛蓝 |
| typeName / className / namespace | `#a8631a` | `#e0b779` | 土黄 |
| propertyName / attributeName | `#3a6b6b` | `#7fc4c4` | 青瓷 |
| operator / punctuation / separator | `#7a7f86` | `#8b9099` | 灰墨 |
| tagName | `#9d3a7d` | `#c9a0e0` | 同关键字 |
| invalid / 错误 | `#a8402f` | `#e08b7a` | 朱红 |

### 6.3 容器细节

- 容器：`1px` 边框 + `--reader-radius` + `--reader-sunken` 底；暗色下边框换成 `--reader-line`。
- 右上角语言标签（小写、字距 0.08em、`--reader-ink-3`），信息性而非装饰。
- `pre`：内边距 1.1em、`line-height: 1.65`、`tab-size: 2`、`font-size: .88em`；**代码文字用正文墨色，不灰化**。
- 横向滚动条美化（`scrollbar-width: thin` + WebKit 细条），避免宽滚动条破坏块面。
- 长行不换行（`overflow-x: auto`），保持代码结构真实。
- hover 显示复制按钮（右上角，与语言标签互斥占位）——确认做。链接同样支持 hover 后的悬浮卡片（见 §5.5）。

### 6.4 边界与降级

- 无语言标注 / 语言不支持 / 解析异常 → 原样输出朴素代码块（不报错、不空白）。
- 单代码块 > 20k 字符跳过高亮（明确的天花板，代码内注释 `ponytail:` 标注；未来若需大文件可换增量解析）。
- 结果按 `lang + code` 做 Map 缓存，上限 50 条，LRU 淘汰。
- DOMPurify 白名单补 `span`、`div`；`class` 已在白名单内。
- `package.json` 显式声明 `@lezer/highlight`（已在 node_modules，**不增加安装体积**，只是把传递依赖变直接依赖）。

## 7. 公式支持（KaTeX）

唯一值得破例的新依赖。桌面应用体积不是瓶颈，公式是理工文档的硬需求。

- **依赖**：`katex@^0.16`（`dependencies`），`import "katex/dist/katex.min.css"`。体积：JS ≈ 280KB min / 90KB gzip，CSS 20KB，字体 ≈ 1MB（Vite 会自动处理 `katex.min.css` 里的字体 URL）。
- **语法**：行内 `$E=mc^2$`（单个 `$`，不跨行），块级 `$$…$$`（独占一行，可跨行）。
- **集成**：自写 marked extension（block + inline 各一个，约 40 行），在 tokenizer 阶段吃掉公式原文，**避免 markdown 把 `_`、`^`、`\\` 当转义处理**。
- **安全与实现顺序**（关键，避免给 DOMPurify 开洞）：
  1. tokenizer 阶段把公式替换为**占位节点** `<span data-math="1"></span>`（纯属性，对 DOMPurify 无害）；
  2. 正文照常 `DOMPurify.sanitize`；
  3. sanitize 后的 DOM pass（与中西文间距、Callout 同一趟）里，把占位节点替换为 `katex.renderToString(tex, { displayMode, throwOnError: false, output: "html" })` 的结果。
  
  > 这样**不需要**给 DOMPurify 放开 `style` 属性（KaTeX 依赖内联 style 定位），攻击面最小；KaTeX 自身已做输入转义。
- **兜底**：`throwOnError: false` → 公式写错时渲染为红色错误文本而不是抛异常；未安装/加载失败时回退为原样 `$...$` 文本。
- **样式**：公式字号 1.05em，块级公式独立成行 + 上下 1.2em 间距 + 可横向滚动（超宽公式不撑破排版）。

## 8. 内嵌 HTML / CSS 支持

现状白名单（25 个标签）把 md 内嵌 HTML 几乎剥光。按"富文本安全子集"扩展：

- **新增标签**：`div`、`span`、`section`、`article`、`details`、`summary`、`figure`（已有 `figcaption` 需补）、`dl`/`dt`/`dd`、`kbd`、`sup`、`sub`、`mark`、`abbr`、`small`、`u`、`s`、`var`、`samp`、`cite`、`q`、`time`、`picture`、`source`、`video`、`audio`、`progress`。
- **新增属性**：`style`、`id`、`colspan`、`rowspan`、`start`、`value`、`width`、`height`、`open`、`controls`、`poster`、`lang`、`dir`、`align`。
- **`style` 属性为什么放开**：这是"md 内嵌 CSS"唯一能生效的路径。风险是 CSS 可做视觉欺骗（如 `position: fixed` 全屏遮罩），用**平台原生能力**兜住而不是写过滤器：预览容器加
  ```css
  .preview-content { contain: layout paint style; }
  ```
  `contain: paint` 让内部的 `position: fixed` 相对容器定位、无法逃逸到全屏，同时顺带提升长文档渲染性能。
- **不放开**：`<style>` 标签、`<script>`、`<iframe>`、`<form>`、事件属性、`javascript:` URL（DOMPurify 默认行为）。`<style>` 会引入真正的样式注入且无法作用域隔离，收益远小于风险——需要内嵌样式请用 `style` 属性。
- **代价说明**：放开 `style` 后，用户自己的 md 可以做出与阅读体验冲突的排版，这是用户对自己文档的主权，可接受。

## 9. 阅读设置项（本次一起做）

| 设置项 | 取值 | 落地 |
|---|---|---|
| 阅读字号 `--type-font-size` | 15 / 16 / **17** / 18 / 19 / 21 | 与编辑器字号解耦，默认 17 |
| 行宽 `--type-measure` | 控件形态沿用 `approved/shell-ui/spec.md`：**三档 pill**（紧凑 720 / **标准 1080（默认）** / 宽松 1200）+ **滑块 400–1200 精调**，实时预览、写入 config；关闭方式点击外部 / Esc。实现是 `<input type="range">` + 3 个 `<button>`，零依赖 | 表格与代码块始终走 1200px 宽通道 |
| 皮肤 `--skin` | `paper` / `modern`（后续扩展） | `<html data-skin>` |

- **存储**：扩展 `AppConfig`（Rust `struct AppConfig` + 前端 `RustAppConfig`）三个可选字段：`readerFontSize`、`readerWidth`、`readerSkin`；走现有 `load_config` / `save_config` 通道，缺省回落到默认值，老配置无感升级。
- **UI**：预览区右上角新增齿轮入口 → 轻量浮层（新增 `ReaderSettingsPopover` 组件，约 80 行），三个控件分别是分段按钮 / 分段按钮 / 皮肤列表。不侵入现有工具栏。
- 现有缩放手势（Ctrl+滚轮、双击复位）保持不变。

## 10. 实施清单

| 步骤 | 文件 | 内容 | 依赖 |
|---|---|---|---|
| 0 | 临时 HTML 比稿 | 同一份示例内容 + 皮肤切换（现状 / paper / modern），肉眼确认后进入 1 | — |
| 1a | 新增 `src/styles/tokens.css` | ① 全局语义色 `--app-*`（accent = D7 indigo）+ light/dark 两份，在 `main.tsx` 引入 | — |
| 1b | 新增 `src/styles/reader.css` | ② 阅读外观 `--reader-*`（默认映射到 `--app-*`，皮肤可整体覆盖）+ ③ 排版尺度 `--type-*` + 全部预览规则 + `.tok-*` + Callout + 公式样式 | 1a |
| 2 | 删 `theme-light.css` / `theme-dark.css` 中的 `.preview-view*` 段落 | 保留 `.reading-ink*`，其余交给 reader.css | 1 |
| 3 | 新增 `src/renderers/highlight.ts` | lezer 高亮封装 + 语言映射 + 缓存 + 兜底 | — |
| 4 | 新增 `src/renderers/math.ts` | KaTeX marked extension + 占位符 + sanitize 后回填 | `katex` |
| 5 | 改 `src/renderers/markdown.ts` | 扩展白名单（内嵌 HTML/CSS）；renderer：代码块（语言标签 + 高亮）、图片 figure/figcaption、表格滚动容器、宽通道 class；后处理 pass：公式回填 + Callout 转换 + 中西文间距 + 链接处理（合并为**一趟 DOM 遍历**） | 3、4 |
| 6 | 改 `src/components/Content/PreviewView.tsx` | 阅读栏与宽通道、预览背景与 `contain`、去常驻提示条、新增设置入口 | 1、5 |
| 6b | 新增 `src/components/Content/LinkHoverCard.tsx` | 链接悬浮卡片：URL/路径展示 + 复制 + 打开 + `resize: both` | 1 |
| 7 | 新增 `src/components/Content/ReaderSettingsPopover.tsx` | 字号 / 行宽 / 皮肤三个控件 | 9 |
| 8 | 改 `src/stores/editorStore.ts` + `src/hooks/useConfig.ts` + `src-tauri/**/config` | 三个配置字段的读写与持久化 | — |
| 9 | `package.json` | 加 `katex`；显式化 `@lezer/highlight` | — |
| 10 | 测试 `src/__tests__/` | 高亮不绕过 XSS 过滤、无 lang 兜底、超限兜底；公式占位回填与错误兜底；Callout 各类型与未知类型兜底；内嵌 `style` + `fixed` 不逃逸；图片 caption；更新 `PreviewView.test.tsx` | 3–8 |
| 11 | 验证 | `npx tsc --noEmit` + `npm test` + `bash scripts/verify.sh`；视觉在 app 内人工确认 | 全部 |

建议的合并顺序（每步可独立验收）：**排版与皮肤（1、2、6）→ 代码高亮（3、5a）→ 公式（4、5b）→ Callout（5c）→ 内嵌 HTML（5d）→ 设置项（7、8）**。

## 11. 定案结论与后续

**本轮已确认**：行宽默认 1080px 且档位可调 ✅ · 引入 `katex` ✅ · 放开内嵌 `style` ✅ · 代码块复制按钮 + 链接悬浮卡片（可 resize）✅ · 暂不引入额外语言包 ✅ · 皮肤初版只出 `paper` 一套（light + dark）✅ · Callout 折叠做 ✅ · 主题色分层（UI 用 D7 indigo、阅读用低饱和靛青）✅

**本轮已实施**（2026-08-29）：

| 项 | 状态 |
|---|---|
| 全局语义色层 `tokens.css`（`--app-*`，D7 indigo） | ✅ 已建 |
| 阅读排版系统 `reader.css`（`--reader-*` + `--type-*`） | ✅ 已建，替代原 `theme-light/dark.css` 的预览部分 |
| 代码语法高亮（lezer + 已有语言包，零新依赖） | ✅ 已实现 |
| 公式（KaTeX，行内 + 块级） | ✅ 已实现 |
| Callout（`> [!NOTE]`，20 种类型 + 折叠） | ✅ 已实现 |
| 内嵌 HTML/CSS 支持（`contain` 兜住 fixed） | ✅ 已实现 |
| 中西文间距 / 图片 figcaption / 表格宽通道 / 任务列表去删除线 | ✅ 已实现 |
| 阅读设置（字号 / 行宽三档 + 滑块 / 皮肤） | ✅ 已实现 |
| 验证 | ✅ tsc / eslint(0 error) / vitest 274 passed / cargo check / build / Playwright 4 项冒烟全绿 |

**后续（未做，按优先级）**：

1. **链接悬浮卡片**：一期只显示 URL/路径 + 复制 + 打开（零网络请求）；二期做网页缩略图预览（需评估网络请求、缓存与隐私成本）。
2. **UI 主题渐进迁移**：按 Toolbar → TabBar → Sidebar 逐模块把硬编码色换成 `var(--app-*)`（对齐 design-codex 路线图 Phase 0.95）。
3. **色值实测微调**：在真实长文档上再校一轮 `--reader-accent` 与纸张色（D7 自己也注明色值需实测微调）。
4. **更多皮肤 / 更多语言包**：架构与映射表已就位，按需加。
