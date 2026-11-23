# Proposal — editor-batch3-lowcost：Quiet.md 学习报告 批次 3：低成本新功能

## Why

批次 1 已加固编辑内核（同步、历史、键位）。批次 2 的手柄/图标/裁剪已并入（#1355–#1359），列表（#1350/#1351）与分栏（#1352）仍在开发中。本批取 Quiet.md 逆向报告中「低成本、高感知」的六项：主题阴影收敛、高亮块三色、公式编辑四件套、附件卡与音频、菜单/浮窗统一、首页宫格响应式。六项不依赖批次 2 的结构手术；但高亮块（T1）与菜单/浮窗（T4）会改 `src/styles/editor.css`，与批次 2 的列表票文件重叠，须待其合入后从最新 `origin/main` 开工。

## What Changes

- **主题阴影 token 化**：新增 `--shadow-menu` / `--shadow-panel` / `--shadow-dialog` / `--shadow-card` / `--shadow-button` 5 档具名阴影，亮值取 Quiet 阶梯，暗色 α×3 上限 0.6；新增 `scripts/theme-mirror.mjs` 生成 `.dark` 草稿与三主题 token 集合一致的 vitest。
- **高亮块三色**：callout 首行支持 `{bg=… border=… text=…}`（Pandoc 风格、顺序无关、未知色名忽略）；13 类型共用颜色编辑；新增第 14 预设「纯高亮」；块族名统一为「高亮」；颜色面板三行 + 恢复默认，一次改色一步撤销。
- **公式编辑四件套**：点击公式开源码浮层（实时 KaTeX 预览、Esc/外点提交）；键入闭合 `$…$` 立即渲染；display 启发式（多行 / `\tag` / `\begin{equation|align|gather|split|alignat|CD}` 为块）；空/无效公式占位。
- **附件卡 + 音频**：非图片媒体文件分支改为附件卡（类型图标、文件名、大小、系统打开）；音频改 `<audio controls>`；pdf/md/html/web 保持 `fileEmbed`；不复制入库。
- **菜单/浮窗统一**：两级阶梯（菜单级 r12 / 行 r6 / 行高 32 / 内距 6 / inset 5 / `--shadow-menu` / 中性黑 4.5% hover / 快捷键列 / 键盘与 hover 同步 / 右键菜单无动画；浮层级 `--shadow-panel` / `--shadow-card` / `--shadow-button`），覆盖全部右键菜单与浮窗。
- **宫格响应式**：列数按网格容器内容宽（avail）动态计算，`gap = 16`：`wide = floor((avail + gap) / (200 + gap))`；`wide >= 4` 时 `n = min(8, max(4, floor((avail + gap) / (240 + gap))))`，否则 `n = min(3, max(1, floor((avail + gap) / (160 + gap))))`（1440/1024/800 → 5/4/3）；hover 改 3px 7% 外环；保留 1×1/2×1/2×2 与 168px 行高。

## Capabilities

### New Capabilities

- 无（本批不新增能力域）。

### Modified Capabilities

- `editing`：新增 E-48 高亮块三色、E-49 公式编辑体验、E-50 附件卡与音频。
- `application-shell`：新增菜单/浮窗圆角阴影语法、首页宫格响应式要求。

## Impact

- **代码**：`tokens.css`、`editor.css`、`orchestration/`（菜单几何与色板）、`decorations/`（callout/math/image/fileEmbed）、`renderers/markdown.ts`、`GridView.tsx` 与 `GridTile.tsx`、`ContextMenu.tsx`、`slash.ts`、Rust `commands/file.rs`，新增 `scripts/theme-mirror.mjs`。
- **设计系统**：本批 supersede `docs/design/system/spec.md` §5（圆角与阴影），并在 `decisions.md` 追加菜单/浮窗两级阶梯条目；具体编辑由票 1.1/2.3 落地，本规划任务不改。
- **用户可感知**：菜单/浮窗阴影与圆角一致；高亮块可改三色；公式点击即编辑；附件可点开；首页宫格随宽度重排。

## Non-goals

- 5:6 宫格宽高比（另议）。
- 字符级 `==text==` 文字高亮（本批只做块级三色）。
- 附件「复制入库」托管（保持文档同目录相对路径）。
- 用户 CSS 主题与 live reload。
- 文件夹实体卡。
