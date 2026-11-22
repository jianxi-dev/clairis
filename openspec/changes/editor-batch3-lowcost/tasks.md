# Tasks — editor-batch3-lowcost

> 切片原则：每张票贯穿「入口 → 行为 → e2e」，做完用户能在界面上看到变化。
> 票标题前缀 `[change=editor-batch3-lowcost/<任务号>]`；1 任务 = 1 票。
> 依赖：2.3 Blocked by 1.1、1.2；3.1 Blocked by 1.1；其余无依赖。

## 1. 视觉地基与高亮

- [ ] 1.1 `[change=editor-batch3-lowcost/1.1]` 主题阴影 token 化（T0）
  - `src/styles/tokens.css` 新增 `--shadow-menu` / `--shadow-panel` / `--shadow-dialog` / `--shadow-card` / `--shadow-button`，三主题（`:root`/`.dark`/`.warm`）齐备；暗色 alpha ×3 上限 0.6
  - 新增 `scripts/theme-mirror.mjs`：OKLab 镜像 `1.137 − 0.907·L`，chroma ≥ 0.14 保持 L 0.62–0.86，从 `tokens.css` 生成 `.dark` 草稿
  - 新增 vitest：断言三主题 `--shadow-*` 键集合一致
  - 设计系统：把 `docs/design/system/spec.md` §5 阴影段替换为 5 档 token 表、把「新代码一律用 `--app-shadow`」改为「新代码一律用 5 档 `--shadow-*`」；`decisions.md` 追加一行（supersede 条款，不在本规划任务改）
  - AC【存在】在应用页面中唤起任一右键菜单之后，建一个探针元素并设 `probe.style.boxShadow = 'var(--shadow-menu)'`，断言 `getComputedStyle(probe).boxShadow === getComputedStyle(menu).boxShadow`。
  - AC【生命周期】切换主题（亮/暗/暖）后阴影仍取对应主题 token，取消切换回到初始主题后无残留旧阴影。
  - AC【保真】三主题 `:root`/`.dark`/`.warm` 暴露的 `--shadow-*` 集合严格等于（5 项），`.dark` 各值 alpha 不含超过 0.6 的通道。
  - e2e：`e2e/theme-shadow.spec.ts`（计算样式 + 三主题往返）
  - **数据面**: 规格,存储,回滚

- [ ] 1.2 `[change=editor-batch3-lowcost/1.2]` 高亮块三色 + 名称统一（T1）
  - `src/editors/callout-types.ts` 新增第 14 预设 `HIGHLIGHT`（标签「纯高亮」、emoji 🖍️、默认 `bg=yellow border=yellow text=none`）；13 类型标签不变；斜杠根「标注」改为「高亮」
  - `src/editors/decorations/callout.ts` 扩展首行解析支持 `{bg=… border=… text=…}`（折叠标记之后、标题之前，顺序无关，未知色名忽略）；属性在类型转换/折叠切换时保留；旧 `> [!NOTE]` 字符不变
  - `src/editors/orchestration/color-palette.ts` 复用 `createColorRow`：字体颜色 9（`FONT_COLORS`）、边框颜色 16（`BORDER_COLORS`）、填充颜色 16（`BACKGROUND_COLORS`）+ 恢复默认；点已选色清除
  - 改色走 `structureTransaction`（`src/editors/structure-history.ts`）；一次改色一步撤销
  - 渲染：装饰与 `src/renderers/markdown.ts` 的 `convertCallouts` 读 `--callout-bg` / `--callout-border` / `--callout-text`，回落 `--callout-soft` / `--callout-color` / 继承文字色；填充软色；`text` 不作用于链接/代码/emoji
  - AC【存在】打开含 `> [!NOTE]{bg=green border=red text=gray} 标题` 的文档之后，卡片的 `--callout-bg` / `--callout-border` / `--callout-text` 分别解析为 green / red / gray 色板项；计算背景等于 green 软色（`color-mix` ~10%），计算边框/文字分别等于 red / gray token 值。
  - AC【生命周期】旧 `> [!NOTE]` 文档渲染字符差异数为 0（严格等于原样）；把类型从 NOTE 改为 TIP 后 `{bg=green border=red text=gray}` 仍保留；一次改色后按一次 ⌘Z 回到改色前（无残留）；重开后颜色仍在。
  - AC【保真】纯高亮预设标签严格等于「纯高亮」；页面不含 `==text==` 字符级高亮渲染。
  - e2e：`e2e/callout-color.spec.ts`（计算样式 + 旧语法 diff + 撤销往返 + 重载）
  - **数据面**: 校验,桥接

## 2. 编辑体验

- [ ] 2.1 `[change=editor-batch3-lowcost/2.1]` 公式编辑四件套（T2）
  - `src/editors/decorations/math.ts`：点击公式打开锚定下方的源码浮层（全选现有源码、实时 KaTeX 预览，复用 orchestration 锚定），Esc/外点提交、光标回落公式后
  - 键入闭合 `$…$` / `$$…$$` 立即渲染（保留货币守卫）；先核实 `smart-input.ts` 现状，只补缺口
  - display 判定：tex 含换行 / `\tag` / `\begin{equation|align|gather|split|alignat|CD}` 为块；`\begin{align*}` 不是块；`renderers/math.ts` 与装饰两处一致
  - 空 tex 显示「添加 LaTeX 公式」；KaTeX 失败显示「无效公式」+ 警告图标，无 `.katex-error` 残渣
  - AC【存在】打开含 `$E=mc^2$` 的文档之后，点击公式出现源码浮层（节点数 1），输入过程中实时预览更新。
  - AC【生命周期】按 Esc 或点击浮层外部后浮层关闭、源码保留、正文不含残留 `$` 定界符（取消后无残留）。
  - AC【保真】多行与 `\begin{align}` 渲染为块级（严格等于块级外框）；空/无效公式占位文本数严格等于 1。
  - e2e：`e2e/math-edit.spec.ts`（浮层往返 + display 判定 + 占位）
  - **数据面**: 无

- [ ] 2.2 `[change=editor-batch3-lowcost/2.2]` 附件卡 + 音频（T3）
  - `src/editors/decorations/image.ts` 的 `MediaWidget` file 分支改附件卡：11 类类型图标（类型色）、文件名、大小（Tauri metadata 格式化）、点击系统打开
  - `src-tauri/src/commands/file.rs` 新增 `open_file_external`（macOS `open`、Windows `explorer`、Linux `xdg-open`），与 `reveal_path` 同构；`lib.rs` 的 `generate_handler` 注册
  - `MediaWidget` 已把非图片归为 `file`，`classifyFileEmbed` 对本地音频返回 null，音频现在落进裸链接卡；在 `MediaWidget` 增加音频分支（或 `classifyMedia` 增加 `"audio"`），渲染 `<audio controls>`；不改 `classifyFileEmbed` 的 http(s) 分支；pdf/md/html/web 保持内嵌
  - 不复制入库（文档同目录不新增副本）
  - AC【存在】打开含 `![报告](assets/report.pdf)` 的文档之后，正文出现附件卡（节点数 1），含类型图标、文件名与非空大小文本。
  - AC【生命周期】点击附件卡调用系统打开 1 次；音频渲染 `<audio controls>`（节点数 1）且不含「文件不存在」占位；pdf/md/html 仍内嵌。
  - AC【保真】附件卡大小文本严格等于 Tauri metadata 的格式化值；文档同目录不含新增附件副本（不含）。
  - e2e：`e2e/media-attachment.spec.ts`（卡片计算样式 + 打开调用计数 + 音频节点）
  - **数据面**: 无

- [ ] 2.3 `[change=editor-batch3-lowcost/2.3]` 菜单与浮窗统一（T4）
  - **Blocked by**: 1.1、1.2
  - 6 组件范围：`src/components/ContextMenu.tsx`、`src/editors/slash.ts`、`src/editors/orchestration/{block-menu.ts,floating-toolbar.ts,horizontal-toolbar.ts,roulette-view.ts}`
  - 菜单级：面板 r12 / 行 r6 / 行高 32 / 内距 6 / 行 inset 5 / `--shadow-menu` / hover 中性黑 4.5% / 快捷键列 12px 灰 / 键盘 ↑↓ 与 hover 同一高亮 / 右键菜单无动画
  - 浮层级：面板 r12 + `--shadow-panel`，卡片 `--shadow-card`，按钮 `--shadow-button`
  - 所有临时 rgba 阴影改走 5 token；`menu-metrics.ts` 的 `MENU_SHADOW` 指向 `var(--shadow-menu)`
  - 新增 `--radius-12` / `--radius-6` token 并替换菜单/浮窗字面量；design-system §5 的 supersede 同时包含圆角表（行 6 / 面板 12）
  - AC【存在】打开页面并唤起右键菜单之后，面板计算样式圆角严格等于 12、行圆角 6、行高 32、`box-shadow` 等于 `--shadow-menu`；浮动预览阴影等于 `--shadow-panel`。
  - AC【生命周期】键盘 ↓ 与 hover 落在同一高亮；右键菜单出现 transition 严格等于 none；点击外部取消后菜单无残留。
  - AC【保真】hover 背景为中性黑 4.5%（不含强调色）；快捷键列 12px 灰色。
  - e2e：`e2e/menu-floating.spec.ts`（计算样式 + hover/键盘同步 + 取消往返）
  - **数据面**: 消费

## 3. 外壳

- [ ] 3.1 `[change=editor-batch3-lowcost/3.1]` 宫格响应式（T5）
  - **Blocked by**: 1.1
  - `src/components/GridView.tsx`：`avail` 取 `[data-grid-grid]` 容器内容宽（非视口宽），`gap = 16`；列数改为 `wide = floor((avail + gap) / (200 + gap))`，`wide >= 4` 时 `n = min(8, max(4, floor((avail + gap) / (240 + gap))))`，否则 `n = min(3, max(1, floor((avail + gap) / (160 + gap))))`；保留 `gridAutoRows: 168px` 与 dense flow
  - `src/components/Grid/GridTile.tsx`：hover 从 `−translate-y-0.5 + shadow-md` 改为 3px 中性 7% 外环（`color-mix`）；保留 1×1 / 2×1 / 2×2 跨度
  - 5:6 宽高比不做
  - AC【存在】打开首页网格之后，网格容器内容宽 1440 / 1024 / 800 下每行卡片数严格等于 5 / 4 / 3。
  - AC【生命周期】拖动窗口宽度变化时列数重算；hover 卡片出现 3px 中性 7% 环，移开后无残留（取消后无残留）；窄于下限时保持 1 列。
  - AC【保真】网格 gap 严格等于 16px；tile 跨度严格等于 1×1 / 2×1 / 2×2。
  - e2e：`e2e/grid-responsive.spec.ts`（三宽度列数 + gap + hover 环）
  - **数据面**: 无

## 并行约束（批次 2 仍在开发）

- 批次 2 的列表票 #1350/#1351 仍在开发，当前工作区 `src/styles/editor.css`、`src/editors/smart-input.ts` 有未提交改动。
- T1（1.2）与 T4（2.3）会改 `editor.css`，必须在 #1350/#1351 合入后从最新 `origin/main` 开工；建议独立 worktree/分支，禁止带入批次 2 未提交改动。
- T0（1.1）、T2（2.1）、T3（2.2）、T5（3.1）与批次 2 无文件重叠，可先开工。
- 批次 2 的分栏 #1352 不触及本批文件，不构成阻塞。

## QG-6 集成 checkpoint

本 change 6 票（≥6），必须插入一次集成 checkpoint：

- **时点**：1.1、1.2、2.1、2.2 合并后（≤4 票）。
- **动作**：跑四门禁（`npx tsc --noEmit`、`npx eslint src/`、`npm test`、两套 Playwright 按当时配置）→ 用 `npm run tauri dev` 打开应用一次 → 记录「现在用户能看到什么」。
- **记录位置**：本 change 的 checkpoint 记录（issue 评论或 `.artifacts/editor-batch3-lowcost/checkpoint-1.md`），含四门禁原始退出码与应用观察。
- 2.3、3.1 完成后再记一条。
