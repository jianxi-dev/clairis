# 任务 — editor-surface-batch22

> 切片原则：1 task = 1 个可独立演示能力，贯穿「入口 → 行为 → e2e」；每条必须能回答「做完用户在界面上看到什么」。
> 票标题前缀 `[change=editor-surface-batch22/<任务号>]`；1 任务 = 1 票。
> 依赖：2.1 → 2.2 → 2.3（裁剪坐标系 → 工具条重置 → 放大层对齐）；3.1 → 3.2（色板常量 → 面板布局）；3.3 依赖 3.1（空态高度复用色板态）。
> 集成 checkpoint（QG-6，票数 ≥6）：每完成 ≤4 票合并到集成分支跑一次四件套并浏览器打开一次，记录「用户现在能看到什么」；首个 checkpoint 在 1.1–2.1 完成后。

## 1. 高亮块（对账 #4 #5 #6）

- [x] 1.1 A1 高亮 24 格色板常量抽取（prefactor）
  - 在 `color-palette.ts` 抽出 `HIGHLIGHT_FONT_COLORS`(8) / `HIGHLIGHT_BORDER_COLORS`(8) / `HIGHLIGHT_FILL_DEEP`(8) / `HIGHLIGHT_FILL_MID`(8)，色值等于 design.md 色板表；`HIGHLIGHT_COLORS` 家族表去「青」重建；旧色名在 `callout-attrs.ts` 保留兼容映射
  - 验收：单测断言四组常量格数 8/8/8/8 且色值等于色板表；`> [!highlight]{bg=darkred}` 旧文档仍渲染
  - **risk**: low ｜ **ui-surface**: 是（色板常量，面板消费）
  - **Blocked by**: 无
  - **数据面**: 规格,存储,校验,桥接（`color-palette.ts` 常量 + `callout-attrs.ts` 兼容映射）
  - **视觉锚点**: design-system:§6

- [x] 1.2 A2 高亮面板布局与触发方式
  - `callout-color-panel.ts:buildHighlightColorPanel` 改为四行 8/8/8/8、`flex-wrap: nowrap`；当前值带 `data-active`；`floating-toolbar.ts:987` 改 pointerenter 展开；关闭条件收窄为点外部 / Esc；随机 / 选色 / 恢复默认不关闭
  - 验收（浏览器可观测）：打开一个 `> [!highlight]` 块，指针滑入块上方居中图标后面板展开（不点击）；面板四行各 8 格且不换行；点「随机」后边框与填充同色相变化、文字色不变、面板仍开；点色块后颜色更新、面板仍开；按 Esc 或点外部才关闭
  - **risk**: medium（hover 与选区轮盘抢触发）｜ **ui-surface**: 是
  - **Blocked by**: 1.1
  - **数据面**: 消费（`callout-color-panel.ts` / `floating-toolbar.ts`）
  - **视觉锚点**: design-system:§7.1;design-system:§6

- [x] 1.3 A3 高亮块空态高度
  - `.cm-callout.cm-callout-mark` 空态 `min-height ≥ 44px`、单行内容约 3.2em；空态点击落入 `cm-callout-editor` textarea；保留左侧 emoji、无类型名标题栏、1px 全边框 + 圆角 + 填充
  - 验收（浏览器可观测）：插入空 `> [!highlight]` 后，块高度 ≥ 44px（不是一条细横线）；点击块内空区可直接输入；左侧显示 emoji、无「NOTE」类标题栏
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 无（与 1.1 同域但可并行）
  - **数据面**: 无
  - **视觉锚点**: design-system:§3;design-system:§4

- [x] 1.4 A4 转换菜单「高亮」直落 highlight + 颜色行图标
  - `block-convert.ts:489 CALLOUT_MARK_ITEM` 补 `calloutKind: "highlight"`；`block-menu.ts:701` 颜色行图标由 `FontcolorOutlined` 改 `FormatColorTextOutlined`
  - 验收（浏览器可观测）：转换手柄菜单点「高亮」后块首行变为 `> [!highlight]`（不是 `[!NOTE]`）；块菜单「颜色」行图标为 A 字形
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§2.3

## 2. 图片裁剪（对账 #1 #2 #3）

- [x] 2.1 B1 裁剪态整图 + 蒙层交互
  - `imageCrop.ts` 改为整图 + 框外四块 `rgba(0,0,0,0.3)` 蒙层 + 1px 白色虚线框 + 8 控制点 + 2 移动热区；拖框 / 蒙层改选区；点「确定」才写回；二次进入显示整图 + 上次矩形（框内亮）
  - 验收（浏览器可观测）：进入裁剪态后看到整图且框外压暗；拖动控制点时蒙层实时变化但源码未写回；点「确定」后源码出现 `crop`；再次进入裁剪看到整图 + 上次矩形
  - **risk**: high（坐标系改造影响预览态）｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§5;design-system:§6

- [x] 2.2 B2 工具条「重置图片」
  - `imageToolbar.ts:32 BUTTON_SPECS` 在已有 crop 时追加「重置图片」；点击清 crop 并按原分数还原显示尺寸回整图
  - 验收（浏览器可观测）：选中已裁剪图片后工具条出现「重置图片」；点击后 `crop` 消失、图片回整图尺寸；未裁剪图片的工具条无此按钮
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 2.1
  - **数据面**: 无
  - **视觉锚点**: design-system:§2.3;design-system:§7.1

- [x] 2.3 B3 放大层工具条对齐
  - `imageToolbar.ts:958 openImageMaximize` 在旋转 / 下载 / 恢复原始尺寸 / 关闭基础上补「重置图片」，语义与工具条一致
  - 验收（浏览器可观测）：双击已裁剪图片进入放大层，工具条含「重置图片」；点击后 crop 移除、显示回整图
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 2.2
  - **数据面**: 无
  - **视觉锚点**: design-system:§2.3;design-system:§7.1

## 3. 嵌入文件与链接（对账 #8 #15）

- [x] 3.1 C1 嵌入文件三视图交互
  - `fileEmbed.ts` 三态 `embed|card|preview` 点击语义按 spec 分发；头部 `.cm-embed-name` click 不再无条件 `openInNewTab` + stopPropagation；工具条三图标（列表 / 卡片 / 图片）切换
  - 验收（浏览器可观测）：选中文件块后工具条出现三图标；卡片态单击只显示工具条不打开、再点文件名才打开；预览态单击先选中、再点打开；文本视图滑入显示工具条、点击打开
  - **risk**: medium（点击语义改动影响既有打开路径）｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§2.3;design-system:§5;design-system:§7.1

- [x] 3.2 C2 链接文件点击打开 + 修饰键悬停浮窗
  - `markdown.ts:682` 本地文档链接：普通点击打开；⌘/Ctrl + 悬停调 `stores/index.ts:1455 openPreview` 唤出 `FloatingPreview`
  - 验收（浏览器可观测）：点击正文本地文档链接后文档打开；按住 ⌘/Ctrl 悬停该链接出现文件卡片式浮窗；不按修饰键悬停不出现
  - **risk**: medium（修饰键门控与既有 hover 行为冲突）｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§5;design-system:§7.1

## 4. 对齐与模式（对账 #10 #12 #13）

- [x] 4.1 D1 格式对齐整体校准
  - `.cm-table-wrap` 补 `max-width`；`.cm-list-marker` 补负外边距与无序一致；`.cm-line.cm-quote` 的 `max-width` 改 `calc(var(--type-measure) + 2em + 2px)`；代码块纵向内边距与预览统一
  - 验收（浏览器可观测）：编辑态宽表格不超正文纸宽；有序列表 marker 与无序左缘差 ≤2px；引用块编辑态与预览态左右缘差 ≤2px；代码块上下内边距与预览差 ≤2px
  - **risk**: medium（四处 CSS 改动影响既有排版）｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§3

- [x] 4.2 D2 模式切换保留滚动位置
  - `ContentArea.tsx:623-638` 改为行锚点映射（视口中心行文档偏移），不依赖 `scrollTop` 像素值；`PreviewView.tsx:552` 重建后按锚点恢复
  - 验收（浏览器可观测）：编辑态滚到中部切预览、再切回编辑，位置不回顶（视口中心行差 ≤2 行）；源码模式往返同样不回顶
  - **risk**: medium（映射口径跨 edit/preview/source）｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: ledger:无（无新增视觉）

- [x] 4.3 D3 源码模式对勾选中态
  - `PaneTreeView.tsx:623` 格头 ⋯ 菜单「源码模式」项加 `aria-pressed={editorMode === "source"}` 与对勾图标；再点取消回编辑
  - 验收（浏览器可观测）：点格头 ⋯「源码模式」后该项显示 ✓ 且 `aria-pressed=true`；再点后 ✓ 消失、回到编辑模式
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§2.4

## 5. 配置与其他（对账 #7 #9 #11 #14）

- [x] 5.1 E1 字体选择器显示值与搜索词分离
  - `HeadingFontField.tsx:93-102` 拆 `display` / `query` 两 state；`filtered` 按 `query` 过滤；聚焦时 `query` 为空显示全量；输入才过滤、删空恢复全量
  - 验收（浏览器可观测）：聚焦字体输入框后候选为全量（不是只剩当前字体）；输入「苹」后候选只剩含「苹」项；删空后恢复全量
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§4;design-system:§7.1

- [x] 5.2 E2 视频首帧 poster
  - 编辑态 / 预览态视频块未播放时取首帧（复用阅读空间取帧做法），取帧失败回落类型色占位
  - 验收（浏览器可观测）：打开含视频块的文档，未播放时视频显示首帧画面，不是黑屏
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: ledger:无（内容渲染，无新增视觉）

- [x] 5.3 E3 导出子菜单方向
  - 页签右键「导出」子菜单默认右开，触右边界翻左（复用既有浮层裁剪逻辑）
  - 验收（浏览器可观测）：点「导出」后子菜单在右侧；收窄窗口使右侧空间不足后子菜单翻到左侧且完整可见
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 无
  - **视觉锚点**: design-system:§7.1

- [x] 5.4 E4 悬浮窗图标与页签文件卡一致
  - `FloatingPreview.tsx:751` 的 `editing ? "eye" : "pencil"` 改为 `editing ? "pencil" : "eye"`
  - 验收（浏览器可观测）：悬浮小窗编辑态显示铅笔、预览态显示眼睛，与页签文件卡一致
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 无
  - **数据面**: 消费（`FloatingPreview.tsx` 图标契约）
  - **视觉锚点**: design-system:§2.3

## 6. 收口

- [x] 6.1 F1 全量验证与 e2e 补齐
  - 跑 `bash scripts/verify.sh` 全绿；补齐本批 e2e（高亮面板 hover / 24 格、裁剪蒙层、嵌入三态、链接浮窗、对齐四处、字体选择器、源码对勾、模式切换不回顶、视频首帧、导出翻左、悬浮窗图标）
  - 验收：`npx tsc --noEmit` / `npx eslint src/` / `npm test` / CSS manifest / `cargo check` / 两套 Playwright 全绿
  - **risk**: low ｜ **ui-surface**: 是
  - **Blocked by**: 1.1–5.4
  - **数据面**: 无
  - **视觉锚点**: ledger:无（收口票，无新增视觉）
