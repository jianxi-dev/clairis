# editor-batch3-lowcost 需求四要素与输入包

- spec issue：#1360（https://github.com/jianxi-dev/clairis/issues/1360）；正文见同目录 `spec-issue.md`。
- 输入源：`docs/research/competitors/quiet-md-逆向学习总报告.md` 批次 3「低成本新功能」+ 域报告 `docs/research/competitors/quiet-md/media-board.md` §1/§2/§5.1/§5.2、`widgets-refs-math.md` §4/§5.4、`home-theme-menu.md` §1.1/§2.5/§6.1/§6.4/§6.5/§6.6。
- 对账表：`input-alignment.md`（已确认，含 `确认：` 行）。
- 一手证据（本仓 HEAD `45b1661` 实读，非报告转述）：

| 证据 | 位置 | 观察 |
|---|---|---|
| 阴影字面量散落 | `src/styles/editor.css:14,942,1486,2478,2877,2964,2985,3418,3445,3497` | 菜单/浮窗/右键菜单各写一套 rgba，无具名 token |
| 菜单几何常量 | `src/editors/orchestration/menu-metrics.ts:9-24` | `MENU_SHADOW` 写死 `0 8px 24px rgba(31,26,20,0.12)` |
| 高亮块解析 | `src/editors/decorations/callout.ts:816` | `CALLOUT_OPEN_RE` 只认 `[!TYPE][+-]`，无颜色属性 |
| 高亮块类型表 | `src/editors/callout-types.ts:38-52` | 13 类型，无「纯高亮」预设，颜色由 tone 决定 |
| 色板数据源 | `src/editors/orchestration/color-palette.ts:24-69` | `FONT_COLORS` 9 格、`BACKGROUND_COLORS` 16 格、`BORDER_COLORS` 派生 16 格；`createColorRow` 可复用 |
| 结构事务助手 | `src/editors/structure-history.ts:23-33` | `structureTransaction` 提供 `userEvent` + `isolateHistory.of("full")` |
| 公式装饰 | `src/editors/decorations/math.ts:158-206` | 非活跃态 KaTeX widget 替换，活跃态显源码；无点击浮层、无 display 启发式 |
| 公式渲染 | `src/renderers/math.ts:39-75` | 官方 KaTeX + `katex.min.css`，块级/行内双 extension |
| 媒体 widget | `src/editors/decorations/image.ts:963-1035` | 视频 `<video controls>`；非图片文件是纯 `<a>` 链接卡，无图标/大小/系统打开 |
| 内嵌分类 | `src/editors/decorations/fileEmbed.ts:89-116` | pdf/md/html/web 内嵌；本地音频 `classifyFileEmbed` 返回 null，落进 `MediaWidget` 的 file 裸链接卡 |
| 系统打开能力 | `src-tauri/src/commands/file.rs:196-247` | 只有 `reveal_in_finder`（`open -R`），无系统打开命令 |
| 宫格布局 | `src/components/GridView.tsx:594-600` | 写死 `repeat(4, …)` + `gridAutoRows:168px` + `gap:12px` |
| 宫格 tile | `src/components/Grid/GridTile.tsx:249-254` | 1×1/2×1/2×2 跨度；hover `−translate-y-0.5 + shadow-md` |
| 三主题 token | `src/styles/tokens.css:10-130` | `:root`/`.dark`/`.warm` 三份手写；`--app-shadow` 单档 |
| 设计系统阴影规则 | `docs/design/system/spec.md:122-133` | §5 自认 20 处 box-shadow、10 处字面量待收敛；新代码用 `--app-shadow` |

## What（做什么）

1. **主题阴影 token 化**：新增 `--shadow-menu` / `--shadow-panel` / `--shadow-dialog` / `--shadow-card` / `--shadow-button` 5 档具名阴影；亮值取 Quiet 阶梯，暗色 α×3 上限 0.6；新增 `scripts/theme-mirror.mjs`（OKLab 镜像）生成 `.dark` 草稿与三主题 token 集合一致的 vitest。
2. **高亮块三色**：callout 首行支持 `{bg=<名> border=<名> text=<名>}`（Pandoc 风格、顺序无关、未知色名忽略、未设回落类型 tone）；13 类型共用颜色编辑；新增第 14 预设「纯高亮」；块族名统一为「高亮」；颜色面板三行 + 恢复默认，一次改色一步撤销。
3. **公式编辑四件套**：点击公式开源码浮层（实时 KaTeX 预览、Esc/外点提交）；键入闭合 `$…$` 立即渲染；display 启发式（多行 / `\tag` / `\begin{equation|align|gather|split|alignat|CD}` 为块，`\begin{align*}` 不是块）；空/无效公式占位。
4. **附件卡 + 音频**：非图片媒体文件分支改为附件卡（类型图标 11 类 + 文件名 + 大小 + 系统打开）；音频改 `<audio controls>`；pdf/md/html/web 保持 `fileEmbed`；不复制入库。
5. **菜单/浮窗统一**：两级阶梯（菜单级 r12 / 行 r6 / 行高 32 / 内距 6 / inset 5 / `--shadow-menu` / 中性黑 4.5% hover / 快捷键列 / 键盘与 hover 同步 / 右键菜单无动画；浮层级 r12 + `--shadow-panel` / `--shadow-card` / `--shadow-button`），覆盖全部右键菜单与浮窗。
6. **宫格响应式**：列数按网格容器内容宽（avail）与 `gap = 16` 动态计算（`wide = floor((avail + gap) / (200 + gap))`；`wide >= 4` 时 `n = min(8, max(4, floor((avail + gap) / (240 + gap))))`，否则 `n = min(3, max(1, floor((avail + gap) / (160 + gap))))`；1440/1024/800 → 5/4/3）；保留 1×1/2×1/2×2 与 168px 行高；hover 改 3px 7% 外环。

## Why（为什么）

- 阴影与菜单几何散落 10 处字面量，是「同一应用里菜单和浮窗看起来不是一套」的直接来源；spec §5 已登记该缺口，Quiet 的 5 档阶梯是现成解。
- 高亮块是用户标注密度最高的块，当前只能改 emoji 不能改颜色；Quiet 的 `bg/border/text` 三字段模型与 16 格面板可低成本移植。
- 公式渲染内核（官方 KaTeX）不弱，弱的是编辑体验：点击无浮层、闭合不自动渲染、display 只按 `$$` 判定、错误无占位。四件都是小改。
- 非图片附件退化成一个裸链接，看不到类型、大小，也不能直接打开；音频落进 `MediaWidget` 的 file 裸链接卡，未渲染 `<audio>`。
- 首页宫格写死 4 列，窄窗挤压、宽窗稀疏，是本仓最显眼的「不响应式」面。

## Scope（范围）

- `src/styles/tokens.css`、`src/styles/editor.css`、`src/editors/orchestration/{menu-metrics.ts,color-palette.ts,floating-toolbar.ts,block-menu.ts,horizontal-toolbar.ts,roulette-view.ts}`。
- `src/editors/decorations/{callout.ts,callout-types.ts,callout-insert.ts,math.ts,image.ts,fileEmbed.ts}`、`src/renderers/markdown.ts`。
- `src/components/GridView.tsx`、`src/components/Grid/GridTile.tsx`、`src/components/ContextMenu.tsx`、`src/editors/slash.ts`。
- `src-tauri/src/commands/file.rs`、新增 `scripts/theme-mirror.mjs`。
- 设计系统：`docs/design/system/spec.md` §5 supersede 与 `decisions.md` 追加行（由票 1.1/2.3 落地，本规划任务不改）。
- 测试：`src/__tests__/**`（主题 token 集合）与 `e2e/*.spec.ts`（6 张票各一份）。
- 并行约束：批次 2 的 #1350/#1351（列表）仍在开发，当前 `src/styles/editor.css`、`src/editors/smart-input.ts` 有未提交改动；T1/T4 与其文件重叠，须后置并从最新 `origin/main` 开工。

## Non-goals（范围外）

- 5:6 宫格宽高比（另议，本批只做列数响应式）。
- 字符级 `==text==` 文字高亮（本批只做块级三色）。
- 附件「复制入库」托管（保持文档同目录相对路径，可移植性优先）。
- 用户 CSS 主题与 live reload。
- 文件夹实体卡。

## 输入契约（L-1 五条）

| 契约 | 落实 |
|---|---|
| 来源可追溯 | 每条需求可回指总报告批次 3 条目号与三份域报告的 §；上表列本仓 HEAD `45b1661` 行号 |
| 空白显式化 | 无未决空白：颜色属性语法、display 判定集合、菜单两级参数、宫格公式均在 design D1–D8 固化；不引用任何 `open-question` |
| 一手证据 | 上表 15 条为本仓源码/设计文件实读；Quiet 数值另注 quiet-md 路径:行号 |
| 冲突显式 | ① 报告建议「5:6 宽高比」与本批「低成本、不改卡片形状」冲突 → 明确 Non-goal；② 报告建议「复制入库」与本仓可移植性设计冲突 → 明确 Non-goal；③ 设计系统 §5 现写「新代码用 `--app-shadow`」，本批 supersede 为 5 token（D3）；④ Quiet 颜色面板为 8/8/16 格，本仓色板为 9/16/16 格，按本仓既有色板落地（D2） |
| 验收锚点 | `openspec/changes/editor-batch3-lowcost/anchors.md`（R-1…R-6，exact/state-machine），由 `cw-conformance.sh generate/lock` 锁定 |

## 设计取舍（详见 change design.md）

- **不做**字符级高亮：`==text==` 会牵动 marked 管线、编辑态 decoration、存储与导出，且与「高亮块」用户语义分叉；本批只做块级三色。
- **不做**复制入库：Clairis 以文档同目录相对路径为可移植性优势，强制托管会引入「文件缺失」类缺陷；附件卡只读元数据与系统打开，不动存储。
- **不做** `$$` 定界符改动：渲染内核已正确，公式四件套只补编辑体验与 display 判定，避免动 marked/KaTeX 主链。
- **采用**本仓色板而非 Quiet 色板：`FONT_COLORS`/`BACKGROUND_COLORS`/`BORDER_COLORS` 已是块菜单/文字工具条的共同数据源，复用 `createColorRow` 比抄 Quiet 的 8/8/16 更省且一致。
