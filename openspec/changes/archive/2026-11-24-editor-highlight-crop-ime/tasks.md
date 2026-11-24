# 任务 — editor-highlight-crop-ime

> 切片原则：每张票贯穿「入口 → 行为 → e2e」，做完用户能在界面上看到变化（QG-1）。
> 票标题前缀 `[change=editor-highlight-crop-ime/<任务号>]`；1 任务 = 1 票。
> 依赖：2.1 依赖 1.1（标注类型 emoji 与高亮图标复用同一份 `callout-types`）；其余无依赖。
> 集成 checkpoint（QG-6，票数 4 < 6）：不强制 checkpoint，G1 出口跑四件套 + 浏览器打开一次。

## 1. 纯高亮视觉与颜色面板

- [x] 1.1 纯高亮独立视觉 + 居中工具条 + 独立色板（随机 / 恢复默认）
  - `callout.ts` / `callout-attrs.ts`：`highlight` 渲染走强荧光底（38% mix）+ 1px 全边框 + 4px 圆角 + 紧内距；标注保持左边框卡片。
  - `color-palette.ts`：新增 `HIGHLIGHT_COLORS`（8 色相，浅/深两档 + 同色系边框）；`createColorRow` 的字体色改回字母 A（`FormatColorTextOutlined`）。
  - `callout-color-panel.ts`：新增 `buildHighlightColorPanel`（字体 / 边框 / 浅填充 / 深填充 / 随机 / 恢复默认），`applyHighlightColorPair` 一次事务写 bg+border。
  - `floating-toolbar.ts`：高亮块工具条居中，图标 `HighlighterOutlined`；标注块维持贴左。
  - 接线归属（QG-3）：本票导出 `HIGHLIGHT_COLORS` / `buildHighlightColorPanel` / `applyHighlightColorPair`，由本票在 `block-menu.ts` 与 `floating-toolbar.ts` 的 callout 颜色入口接线。
  - AC（浏览器可观测）：打开页面插入纯高亮，① 计算 `border-inline-start-width` = `0px`、`border-top-width` = `1px`、`border-radius` = `4px`；② 点击块后工具条水平中心与块中心差 ≤ 2px，图标为荧光笔；③ 面板「随机」点击一次后 `bg` 与 `border` 同时变化且色相同族、`text` 不变；④「恢复默认」后首行无属性块；⑤ 字体色块内文本/图标为字母 A。
  - e2e：新增 `e2e/editors/highlight-panel.spec.ts`；修订 `e2e/editors/color-panel-icon.spec.ts`、`e2e/callout-color.spec.ts`。
  - **视觉锚点**: design-system:§5; design-system:§6
  - **数据面**: 消费,桥接

## 2. 菜单图标与命名

- [x] 2.1 转换/新增菜单图标分家、标注类型复用 emoji、新增菜单改名
  - `block-convert.ts`：`CALLOUT_MARK_ITEM.icon` → `HighlighterOutlined`；`BlockMenuItem` 增 `emoji`，`calloutAnnotationItems()` 填充 emoji。
  - `block-menu.ts`：转换浮层优先渲染 emoji。
  - `floating-toolbar.ts`：`convert-callout-mark` 图标 → `highlighter`。
  - `slash.ts`：`addHandleCommands` 的标注项 `label` → 「标注」。
  - 接线归属（QG-3）：本票不导出新 API；emoji 经既有 `CALLOUT_ANNOTATION_TYPES` 消费。
  - AC（浏览器可观测）：块菜单「转为」网格中高亮格 `data-icon` 与标注格不同；标注浮层 13 项的图标文本与新增菜单对应项一致；新增手柄菜单出现「标注」、不出现「高亮」。
  - e2e：修订 `e2e/block-menu-batch14.spec.ts`、`e2e/add-handle-menu-842.spec.ts`；新增断言到 1.1 的 spec。
  - **视觉锚点**: design-system:§6
  - **数据面**: 消费

## 3. 图片裁剪显示同构

- [x] 3.1 crop 显示统一为外盒 + 整图缩放平移，保存同步写回可见宽高
  - `image.ts`：`crop` 分支统一窗口结构；`width` 属性按「可见裁剪宽」求 `scale = width / w`，否则沿用测量；删除 `object-fit:none` + 旧 width 分支的错位路径。
  - `imageCrop.ts`：`onConfirm(rect, displayRect)`。
  - `ContentArea.tsx`：写回 `crop` 时同步 `width/height = round(displayRect)`。
  - 接线归属（QG-3）：`onConfirm` 第二参数由本票在 `ContentArea` 接线；无跨票。
  - AC（浏览器可观测）：带 `width` 的图片裁剪到子区域后确认，确认前后可见宽高比 = 1 ±0.02，显示区域与拖拽预览一致；拖回整图后 `crop` 移除且显示复原。
  - e2e：新增 `e2e/image-crop-confirm-region.spec.ts`；修订 `e2e/image-crop.spec.ts`。
  - **视觉锚点**: design-system:§5
  - **数据面**: 消费,回滚

## 4. IME 稳定与大文档键入

- [x] 4.1 组合期装饰映射 + 大文档键入快路径 + callout 扫描线性化
  - `decorations/index.ts`：`composing && docChanged` 返回 `decos.map(tr.changes)`；≥50k 字符的 `input.type` 走映射 + 180ms 延迟重建。
  - `callout.ts`：`findCalloutBlocks` 单次遍历累计偏移。
  - 接线归属（QG-3）：本票不导出新 API。
  - AC（浏览器可观测）：用 IME 在给定文档正文连续输入 20 字，无 `pageerror`、`scrollHeight` 前后差 ≤ 5%、媒体节点数不减；大文档键入 10 字期间每字不触发全量重建（以延迟重建次数为证）。
  - e2e：新增 `e2e/editor-ime-large-file.spec.ts`。
  - **视觉锚点**: design-system:§5
  - **数据面**: 无
