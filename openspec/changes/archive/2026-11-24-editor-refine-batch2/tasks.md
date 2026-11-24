# 任务 — editor-refine-batch2

> 切片原则：每张票贯穿「入口 → 行为 → e2e」，做完用户能在界面上看到变化（QG-1）。
> 票标题前缀 `[change=editor-refine-batch2/<任务号>]`；1 任务 = 1 票。
> 依赖：1.2 依赖 1.1（颜色面板图标复用 1.1 的高亮类型集）；2.2 依赖 2.1（预览态渲染复用三态卡片）。
> 集成 checkpoint（QG-6，票数 4 < 6）：本批不强制 checkpoint，G1 出口跑一次四件套 + 浏览器打开一次。

## 1. 高亮与标注分家

- [x] 1.1 纯高亮块：新类型 + 无边框渲染分支 + 六色色板 + 四入口接线 + 菜单收敛
  - `callout-types.ts` 拆 `CALLOUT_MARK_TYPES`（仅 `highlight`）与 `CALLOUT_ANNOTATION_TYPES`（13 类），`CALLOUT_EDIT_TYPES` 保留并集；`CalloutWidget.toDOM`（`callout.ts:622-767`）对 `highlight` 走 `cm-callout-mark` 分支：无 `.cm-callout-header`、无左边框、圆角 `--radius-8`、荧光笔底色；新增 `.cm-content .cm-callout.cm-callout-mark` CSS（覆盖 `editor.css:2582-2595` 的 3px 左边框）并同步 CSS manifest。
  - 四入口接线：斜杠 `calloutType()`（`slash.ts:138-151`）与 `CALLOUT_CODES`；块菜单「转为」`CONVERT_TARGETS`（`block-convert.ts:455`）；转换手柄 `convert-callout-group`（`floating-toolbar.ts:600-621`）与 `typeButton`（`:290-300`）；选区轮盘高亮三层（`roulette-view.ts:457-463`）。四处统一为「高亮」直落 `> [!highlight]`、「标注」展开 13 类。
  - 菜单收敛：斜杠菜单（`slash.ts:283-293`、`:412`）与块菜单「转为」网格只出现「高亮」「标注」两项，无第三项。
  - 接线归属（QG-3）：本票导出 `CALLOUT_MARK_TYPES` / `CALLOUT_ANNOTATION_TYPES`（`callout-types.ts`），由本票在 `slash.ts` / `block-convert.ts` / `floating-toolbar.ts` / `roulette-view.ts` 四处接线；无跨票接线。
  - AC（浏览器可观测）：在 `npm run tauri dev` 打开页面，① 斜杠输入 `/` 后菜单「常用」段只有「高亮」「标注」两项；② 选「高亮」插入后，块计算 `border-inline-start-width` = `0px`、无 `.cm-callout-header` 节点、`border-radius` = `8px`；③ 块菜单「转为」网格点「标注」展开 13 项、点「高亮」直落 `> [!highlight]`；④ 选区轮盘「转换 → 高亮」三层第一项为「高亮」、其余 13 项在「标注」子层。
  - e2e：新增 `e2e/editors/callout-mark-split.spec.ts`；修订 `e2e/callout-color.spec.ts`（「纯高亮预设」改为断言无标题栏 + 无左边框）。
  - **视觉锚点**: design-system:§5; design-system:§6
  - **数据面**: 规格,消费

- [x] 1.2 颜色面板图标形象化：色块+荧光笔图标、居中、删字母 A、删类型切换图标、类型切换色相映射
  - `createColorRow`（`color-palette.ts:88-130`）删除 `kind === "font"` 分支的 `textContent="A"` 字形，改渲染「色块 + 荧光笔笔尖」形象图标（复用 `src/ui/icons.ts` / `src/editors/icons.ts` 的荧光笔 IconName，两套同步）；`swatch` 容器 `display:flex; align-items:center; justify-content:center`。轮盘色条 `.sr-color-A`（`roulette-view.ts:457-463`）同步删除字母 A。
  - 删除 `floating-toolbar.ts:290-300` 的 `typeButton`（`data-testid="callout-type-entry"`）；`block-menu.ts:479-575` 的「类型」行只对「标注」块出现。
  - 新增纯函数 `mapHueToType(currentColor, targetTone)`（`color-palette.ts`）：切换标注类型时按色相映射到目标类型可用色板；单测覆盖六色。
  - 接线归属（QG-3）：本票导出 `mapHueToType`，由本票在 `floating-toolbar.ts` 的 `convertItem` 与 `block-menu.ts` 的类型面板接线；图标条目由本票补入两套图标表。
  - AC（浏览器可观测）：在 `npm run tauri dev` 打开页面，① 打开颜色面板后，字体色行每个色块内**无**文本 `A`，图标为色块 + 荧光笔；② 色块容器计算 `justify-content` = `center`；③ 高亮块工具条**无** `data-testid="callout-type-entry"` 按钮；④ 把 NOTE 块的填充改为红色后切换到 TIP，填充色相仍为红（`mapHueToType` 映射生效）。
  - e2e：新增 `e2e/editors/color-panel-icon.spec.ts`；单测 `src/__tests__/color-hue-map.test.ts`。
  - **视觉锚点**: design-system:§2; design-system:§6
  - **数据面**: 消费,桥接

## 2. 嵌入文件卡

- [x] 2.1 嵌入文件卡 quiet 化：三态 + 工具条（展开/对齐/三态，无下载）+ 头部（图标+文件名+描述）+ 拖边框尺寸
  - `fileEmbed.ts` 的 `data-embed-state` 值域由 `name | content` 改为 `card | preview | embed`（`:728-731`、`:825-847`）；`applyNameState` 改为 `applyCardState`，`card` 态隐藏 body、`preview` 态限高、`embed` 态全尺寸；状态持久化复用 `embedNameStates`（`:129-136`）。
  - `ensureEmbedPanel`（`:234-278`）重做为 quiet 工具条：展开全屏 + 对齐（左/中/右）+ 三态切换（卡片/预览/嵌入）；删除宽窄 +/- 按钮（`:320-333`）与下载。
  - `.cm-embed-name`（`:721-727`、`editor.css:1247-1267`）改为「文件类型图标 + 文件名主标题 + 描述副标题」；新增 `cm-embed-name-desc` 节点（取 `_alt` / `_title` / 文件类型描述）。
  - 尺寸唯一入口为拖边框（保留 `:992-1044` 的 8 把手），写回 `{width=… height=…}` 属性语法不变。
  - 接线归属（QG-3）：本票不导出新 API；三态经既有 `embedNameStates` 接线，工具条经既有 `selectEmbed` 接线。
  - AC（浏览器可观测）：在 `npm run tauri dev` 打开页面，① 选中嵌入文件卡后工具条只有「展开全屏 / 左 / 中 / 右 / 卡片 / 预览 / 嵌入」按钮，**无**下载、**无** +/-；② 点「卡片」后 body 隐藏、头部显示文件名与描述副标题；③ 点「预览」后 body 显示且高度受限；④ 点「嵌入」后全尺寸；⑤ 拖边框后宽度变化并写回文档属性。
  - e2e：新增 `e2e/editors/embed-card-modes.spec.ts`；修订 `e2e/embed-name-hover-newtab-852.spec.ts` / `e2e/editors/file-embed-multiformat.spec.ts`。
  - **视觉锚点**: design-system:§7
  - **数据面**: 消费,回滚

- [x] 2.2 嵌入 md 保真与预览可渲染：排版与独立预览一致；预览态渲染 md/pdf/html/附件，消灭裂图占位
  - `renderMarkdownBody`（`fileEmbed.ts:579-616`）的宿主 CSS 改为不覆盖 `.preview-content` 的字号 / 行高 / 段距 / 标题间距：`.cm-embed-body .cm-embed-md`（`editor.css:1217-1224`）删除 `font-size: 0.95em`，`font-size` 取 `--type-font-size`（17px）、`line-height` 取 `--type-line`（1.78）；`.cm-embed-body`（`:1202-1207`）只改外壳。
  - `renderers/markdown.ts:155-171` 的 image renderer 按 `classifyFileEmbed`（`fileEmbed.ts:94`）分支：`md` → 内联渲染 md 卡；`pdf` / `html` / `web` → 内嵌 iframe 卡；其余本地文件 → 附件卡（复用 `image.ts:1053-1196` 形态）。非 Tauri 环境走既有 fallback，不伪造 src。
  - 接线归属（QG-3）：本票不导出新 API；预览态渲染分支在 `markdown.ts` 内接线，复用既有 `renderMarkdown` / `open_file_direct`。
  - AC（浏览器可观测）：在 `npm run tauri dev` 打开页面，① 同一段落在嵌入 md 与独立预览态的计算 `font-size` 相等（17px）、`line-height` 相等（1.78）、段距相等；② 预览态打开含 md / pdf / html / 附件引用的文档，**无** `naturalWidth === 0` 的 `<img>` 裂图节点，嵌入内容或卡片可见。
  - e2e：新增 `e2e/editors/embed-md-fidelity.spec.ts`；修订 `e2e/embed-file-render-850.spec.ts`。
  - **视觉锚点**: design-system:§7
  - **数据面**: 无
