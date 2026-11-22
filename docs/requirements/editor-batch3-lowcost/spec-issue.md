## Problem

Quiet.md 逆向学习报告批次 3 列出的六项「低成本、高感知」功能，在本仓都缺位或只做了一半，均有本仓 HEAD 一手证据：

1. 阴影散落：菜单、浮窗、右键菜单各写一套 rgba 字面量（`editor.css:14,942,1486,2478,2877,2964,2985,3418,3445,3497`），设计系统 §5 自认 20 处 box-shadow、10 处字面量待收敛。
2. 高亮块不能改颜色：`CALLOUT_OPEN_RE`（`callout.ts:816`）只认 `[!TYPE][+-]`，颜色由类型 tone 决定，用户无法改边框/背景/文字色；也没有「纯高亮」预设。
3. 公式编辑体验缺失：渲染内核（官方 KaTeX）不弱，但点击公式无源码浮层、键入闭合 `$…$` 不自动渲染、display 只按 `$$` 判定、空/无效公式无占位。
4. 非图片附件退化成裸链接：`MediaWidget` 的 file 分支只有一个 `<a>`（`image.ts:997-1024`），无类型图标、无大小、无系统打开；音频落进 `MediaWidget` 的 file 裸链接卡，未渲染 `<audio>`。
5. 菜单/浮窗观感不统一：右键菜单 r10/阴影 `0 8px 24px rgb(0 0 0/0.18)`（`editor.css:3438-3446`），编辑器菜单 r8/阴影 `0 8px 24px rgba(31,26,20,0.12)`，浮层另有数套；hover 用 accent 而非中性黑。
6. 首页宫格写死 4 列：`GridView.tsx:594-600` 任何窗宽都是 4 列，窄窗挤压、宽窗稀疏。

## Solution

按报告批次 3 六项落地，能合并的合并、能复用的复用：

- 主题阴影：新增 5 档具名 token（menu/panel/dialog/card/button），亮值取 Quiet 阶梯，暗色 α×3 上限 0.6；加 OKLab 镜像脚本生成 `.dark` 草稿与三主题 token 集合一致的 vitest。
- 高亮块：首行支持 `{bg=… border=… text=…}` 属性（顺序无关、未知色名忽略、未设回落 tone）；新增「纯高亮」预设，块族名统一为「高亮」；颜色面板三行 + 恢复默认，一次改色一步撤销。
- 公式：点击开源码浮层（实时预览、Esc/外点提交）；闭合 `$…$` 自动渲染；display 启发式（多行 / `\tag` / `\begin{equation|align|gather|split|alignat|CD}`）；空/无效占位。
- 附件：非图片文件改附件卡（11 类图标 + 文件名 + 大小 + 系统打开）；音频 `<audio controls>`；pdf/md/html/web 保持内嵌；不复制入库。
- 菜单/浮窗：两级阶梯（菜单级 r12/行 r6/行高 32/内距 6/inset 5/`--shadow-menu`/中性黑 4.5%/快捷键列/键盘与 hover 同步/右键菜单无动画；浮层级 `--shadow-panel`/`--shadow-card`/`--shadow-button`），覆盖全部右键菜单与浮窗。
- 宫格：列数按网格容器内容宽（avail）动态计算，`gap = 16`：`wide = floor((avail + gap) / (200 + gap))`；`wide >= 4` 时 `n = min(8, max(4, floor((avail + gap) / (240 + gap))))`，否则 `n = min(3, max(1, floor((avail + gap) / (160 + gap))))`（1440/1024/800 → 5/4/3）；hover 改 3px 7% 外环；保留 1×1/2×1/2×2 与 168px 行高。
- **并行约束**：批次 2 的列表票 #1350/#1351 仍在改 `src/styles/editor.css`；高亮块与菜单/浮窗两票须在其合入后从最新 `origin/main` 开工，其余四票可先行。

## User Stories

- 作为标注大量笔记的人，我希望高亮块能改边框、背景、文字颜色，并且有一个无语义的「纯高亮」预设。
- 作为写公式的人，我希望能点击公式打开源码浮层、边改边看预览，闭合一处 `$…$` 就自动渲染，空公式和写错的公式都有明确占位。
- 作为在笔记里放附件的人，我希望看到文件类型、名字和大小，点一下能用系统程序打开；音频能直接在正文里播放。
- 作为同时用菜单和浮层的人，我希望右键菜单、斜杠菜单、浮动工具条的圆角、阴影、行高是同一套， hover 和键盘选中是同一个高亮。
- 作为窄窗用户，我希望首页宫格随窗口宽度重排，而不是永远挤在 4 列里。

## Out of Scope

- 5:6 宫格宽高比。
- 字符级 `==text==` 文字高亮。
- 附件复制入库托管。
- 用户 CSS 主题与 live reload。
- 文件夹实体卡。

## Testing

- 单测：`src/__tests__/` 三主题 shadow token 集合一致；高亮属性解析（已知色名通过、未知色名忽略、顺序无关）；公式 display 判定集合。
- e2e：`e2e/theme-shadow.spec.ts`、`e2e/callout-color.spec.ts`、`e2e/math-edit.spec.ts`、`e2e/media-attachment.spec.ts`、`e2e/menu-floating.spec.ts`、`e2e/grid-responsive.spec.ts`，全部断言计算样式 / 文本相等 / 状态往返。
- 机检：`openspec validate editor-batch3-lowcost --strict --no-interactive`、`./scripts/cw-conformance.sh generate|lock|verify`、`./scripts/cw-data-surface.sh new editor-batch3-lowcost`。
