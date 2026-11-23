# 设计 — editor-refine-batch2

来源：spec issue #1406（4 全组 + 6a/6d 两组设计变更）；一手证据截图 `豆包的高亮效果.png` / `纯高亮的颜色图标及效果.png` / `嵌入文件的三种方式工具条.png`。

## Context

#1406 的 4 全组与 6a/6d 是**设计变更**而非缺陷：现行 14 类 callout 共用一个卡片样式，「纯高亮」只是第 14 个 tone；嵌入文件卡的工具条与 quiet 的「三种显示方式」不一致。两者都需要在既有结构上做**渲染分叉 / 状态模型重做**，而不是补一个开关。本设计的第一原则是：**复用既有容器与管线，只分叉渲染与状态**，不新造第二套语法或第二套卡片。

## Goals / Non-Goals

**Goals:** 纯高亮与标注在界面上彻底分家；颜色面板图标形象化；嵌入文件卡按 quiet 三态组织；嵌入 md 排版与独立预览一致；预览态嵌入文件可渲染。

**Non-Goals:** 新增第二套文档语法（高亮仍以 `> [!TYPE]` callout 承载）；改动 callout 的 markdown 序列化格式；重画图标库；quiet 以外的卡片形态（瀑布流 / 画廊）；本轮缺陷线的 13 项（抖动、转换跳顶、裁剪、缩放、附件对齐）。

## Decisions

### D1 纯高亮独立成块（R-1）

- **渲染分叉，不新增语法**：`highlight` 仍解析为 callout（`resolveCalloutType` 已返回 `tone=yellow`、`label=纯高亮`），`CalloutWidget.toDOM`（`callout.ts:622-767`）按 `type === "highlight"` 走专用分支：容器加 `cm-callout-mark` 类，**不**渲染 `.cm-callout-header`（无标题栏、无 emoji 按钮），内容直接落 `.cm-callout-content`。
- **CSS 覆盖**：`.cm-content .cm-callout` 的通用规则（`editor.css:2582-2595`）给所有类型 3px 左边框 + 软底色 + 圆角。新增 `.cm-content .cm-callout.cm-callout-mark` 覆盖：`border-inline-start: 0`、`background-color` 走荧光笔高透明叠底、圆角取卡片 token `--radius-8`（设计系统 §5）。**CSS manifest 门**：每个新 `cm-*` 类必须在 `src/styles/` 有规则，否则 `scripts/css-manifest-check.sh` 失败；本批新增 `cm-callout-mark` 与 D3 的嵌入工具条类。
- **六色色板**：红 / 橙 / 黄 / 绿 / 蓝 / 紫，色相取豆包截图。既有的 `BACKGROUND_COLORS` / `FONT_COLORS`（`color-palette.ts:24-69`）已含这六色相（`#f0000e` / `#f2962c` / `#f0b622` / `#419e34` / `#4c88ff` / `#8a5cf6`），**不新增色值**，只把纯高亮的默认 `bg` 指向 yellow、并允许六色。
- **菜单收敛为两项**：斜杠菜单（`slash.ts:283-293` 的 `callout` 行 + `:412` 的默认命令）与块菜单「转为」网格（`block-convert.ts:455`）统一改为两项——**高亮**（`target: "highlight"`，插入 `> [!highlight]`）与 **标注**（`target: "callout"`，展开 13 语义类型，不含 `highlight`）。`CALLOUT_EDIT_TYPES`（`callout-types.ts:38-54`）拆成 `CALLOUT_MARK_TYPES`（仅 `highlight`）与 `CALLOUT_ANNOTATION_TYPES`（13 类），`CALLOUT_EDIT_TYPES` 保留为两者并集供既有渲染别名用。
- **四入口接线**：① 斜杠 `calloutType()`（`slash.ts:138-151`）与 `CALLOUT_CODES`；② 块菜单「转为」网格（`block-convert.ts:455` 的 `CONVERT_TARGETS`）；③ 转换手柄菜单（`floating-toolbar.ts:600-621` 的 `convert-callout-group` 与 `:290-300` 的 `typeButton`）；④ 选区轮盘（`roulette-view.ts:457-463` 的三层高亮项）。四处都改为「高亮」直落 `highlight`、「标注」展开 13 类。
- **markdown 兼容**：`> [!highlight]` 是既有可解析键（`CALLOUT_RENDER_ALIASES` 已含 `highlight: "纯高亮"`），序列化格式不变；旧文档的 13 类语义 callout 全部归入「标注」，行为不变。

### D2 颜色面板图标形象化（R-2）

- **图标替换**：`createColorRow`（`color-palette.ts:88-130`）中 `kind === "font"` 分支不再生成 `textContent="A"` 的 `.cm-color-swatch-glyph`，改为**色块 + 荧光笔笔尖**的形象图标（复用 `src/ui/icons.ts` / `src/editors/icons.ts` 的荧光笔 IconName；两套图标表必须同时覆盖）。`swatch` 按钮 `display:flex; align-items:center; justify-content:center`，图标水平居中。轮盘色条的 `.sr-color-A`（`roulette-view.ts:457-463`）同样删除字母 A，改形象图标。
- **删除类型切换图标**：`floating-toolbar.ts:290-300` 的 `typeButton`（`data-testid="callout-type-entry"`）移除；类型只在「标注」子菜单（D1 的 13 类）里选。`block-menu.ts:479-575` 的「类型」行保留，但只对「标注」块出现。
- **色相映射**：切换标注类型时，把当前色的**色相**映射到目标类型可用色板（例：红 → 目标类型红色档；目标类型无同色相时取最近色相或回落默认），不残留不适用颜色。映射函数为纯函数，放 `color-palette.ts`，单测覆盖六色。
- **CSS**：`.cm-color-swatch-glyph`（`editor.css:379-385`）随字母 A 一起删除；新增图标容器规则。

### D3 嵌入文件卡 quiet 化（R-3）

- **三态模型**：现行 `data-embed-state="name" | "content"` 两态（`fileEmbed.ts:728-731`、`:825-847`、`editor.css:1239-1245`）改为三态 `card | preview | embed`：
  - `card`：只显示头部（类型图标 + 文件名主标题 + 描述副标题），body 隐藏。
  - `preview`：头部 + 内容预览（既有内容渲染，高度上限）。
  - `embed`：既有「内容态」等价（全尺寸内嵌）。
  三态由工具条的三个按钮切换，状态持久化复用 `embedNameStates`（`fileEmbed.ts:129-136`）的 key 机制（值域扩为三态）。
- **工具条**：`ensureEmbedPanel`（`fileEmbed.ts:234-278`）重做为 quiet 工具条——**展开全屏** + **对齐**（左/中/右，既有）+ **三态切换**（卡片/预览/嵌入）；**删除**宽窄 +/- 按钮（`:320-333` 的 `resizeSelectedEmbed` / `EMBED_WIDTH_STEP`）与下载。
- **头部**：`.cm-embed-name`（`fileEmbed.ts:721-727`、`editor.css:1247-1267`）改为 quiet 式「大标题 + 副标题」：文件名主标题（`cm-embed-name-text`）+ 描述副标题（新增 `cm-embed-name-desc`，取 `_alt` / `_title` / 文件类型描述）；左侧加文件类型图标（复用 `image.ts:985` 的 `appendFileTypeIcon` 机制）。
- **尺寸拖边框**：保留既有 8 把手拖拽（`fileEmbed.ts:992-1044`），删除面板 +/- 后，尺寸唯一入口为拖边框；`applyImageSize` 的 `{width=… height=…}` 属性语法不变。
- **全屏**：保留既有全屏（`openInNewTab` / 既有全屏路径），工具条「展开全屏」接既有能力。

### D4 嵌入 md 保真与预览可渲染（R-4）

- **排版保真**：`renderMarkdownBody`（`fileEmbed.ts:579-616`）已复用 `renderMarkdown` + `.preview-content`，但 `.cm-embed-body .cm-embed-md` 覆盖（`editor.css:1217-1224`）改了 `font-size: 0.95em` 与 `padding`，`.cm-embed-body`（`:1202-1207`）又改了背景。改为：嵌入宿主**不覆盖** `.preview-content` 的字号 / 行高 / 段距 / 标题间距，只覆盖外壳（`min-height` / `max-width` / `margin-inline` / `box-shadow`）；`font-size` 取 `--type-font-size`（17px）、`line-height` 取 `--type-line`（1.78），与独立预览逐项一致。
- **预览态可渲染**：`renderers/markdown.ts:155-171` 的 image renderer 现在只处理 image/video/audio，其余落 `<img>`。改为按 `classifyFileEmbed`（`fileEmbed.ts:94`）或 `mediaKindOf`（`mediaUrl.ts:61`）分支：`md` → 渲染嵌入 md 卡（复用 `renderMarkdown` 的轻量内联或附件卡形态）；`pdf` / `html` / `web` → 内嵌 iframe 卡；其余本地文件 → 附件卡（复用 `image.ts:1053-1196` 的 `renderAttachmentCard` 形态）。**消灭** `naturalWidth === 0` 的裂图占位。
- **标签口径**：`markdown.ts:579-603` 的 `CALLOUT_LABELS` 已含 `highlight: "纯高亮"`，预览态渲染别名无需改。

## 数据面

> 本批命中信号：图标（`src/ui/icons.ts` / `src/editors/icons.ts`）、菜单（`block-menu.ts` / `floating-toolbar.ts` / `slash.ts` / `roulette-view.ts`）、色板（`color-palette.ts`）。按 `docs/agents/data-surface.md` 六栏表登记（落点|位置|载体/符号|判据）。

| 落点 | 位置 | 载体 / 符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§6 | — | 新增/删除色必须先有 spec 条款；六色相取既有色板，不新增色值 |
| 存储 | src/editors/callout-types.ts | CALLOUT_MARK_TYPES / CALLOUT_ANNOTATION_TYPES | 高亮与标注二分；13 语义类型不丢；键名枚举白名单 |
| 校验 | src/editors/callout-attrs.ts | parseCalloutAttrs | 未知色名忽略并回落类型 tone；`highlight` 只接受六色板 |
| 桥接 | src/editors/orchestration/color-palette.ts | FONT_COLORS / BACKGROUND_COLORS | 六色相与豆包截图一致；切换类型按色相映射不残留 |
| 消费 | src/editors/orchestration/{block-menu,floating-toolbar,roulette-view,slash}.ts | CONVERT_TARGETS / convert-callout-group / 高亮三层 / calloutType | 四入口均出现「高亮」「标注」两项；无第三项；类型切换图标已删 |
| 回滚 | src/editors/decorations/fileEmbed.ts | embedNameStates | 三态切换写前快照，一步恢复；旧「名称/内容」态迁移到 card/preview |

## Risks / Trade-offs

- [三态取代两态影响既有 e2e] → `embed-name-hover-newtab-852.spec.ts` / `file-embed-multiformat.spec.ts` 同步修订；`data-embed-state` 值域变更需在票面显式声明。
- [纯高亮分叉后 `highlight` 块的标题栏消失] → 既有 `callout-color.spec.ts` 的「纯高亮预设」用例需改为断言无标题栏 + 无左边框。
- [色相映射的「最近色相」无精确判据] → 实现票先按「同色相优先、否则回落目标类型默认」落地，单测覆盖六色；模糊情形不阻断。
- [预览态渲染嵌入 md 需读文件] → 复用既有 `open_file_direct`；非 Tauri 环境走既有 fallback，不伪造 src。

## 开放问题

- 纯高亮的六色是否需要在设计系统 §6 新增独立 token（DESIGN DEFAULT：复用既有 `mdb-bg-*` / `mdb-color-*` 六色，不新增）。
- 「描述副标题」的取值优先级（DESIGN DEFAULT：`_alt` → `_title` → 文件类型描述；三者皆空则不渲染副标题）。
