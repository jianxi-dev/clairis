# Design — editor-surface-batch16

## Context

本批 21 条反馈落在 MD 编辑表面与图片块。三路只读探针（block-handle / slash / 渲染管线 / 图片装饰）给出文件行级根因，另有两条视频测试缺陷已实测复现：

- `video-transform` 首击 `rotate(270deg)`：`#523` 按 `#518` 验收改为逆时针（`rotation - 90`），e2e 仍断言 `rotate(90deg)` — 陈旧断言，不是重复绑定。
- `video-playlist-memory` 5 跑 1 挂：测试固定 `waitForTimeout(1500)` 等异步 `art.switchUrl()`，产品侧无固定延时。

图片类多条并非「新功能缺失」，而是 `image-block-editing` 归档后的残留：描述行已实现但按钮没接上、裁剪写回不清理旧注释、左/上把手符号写反、已裁剪图拖锚点走裁剪分支。

## Goals / Non-Goals

**Goals:**

- 每条反馈对应一条用户可见交付物与一条能失败的 e2e/单测断言。
- 修根因，不在调用点打补丁：符号错误改数学、计时器错误改归属、渲染缺口补扩展点。
- 图片类测试补三层：往返（写回→重开→回显）、真实手势（`w/n/nw`、矩形本体、已裁剪图锚点）、变体输入（`-->` 与 `—>`）。

**Non-Goals:**

- 不新增配置字段；不改 pane 树持久化 / 场景路由 / editor remount。
- 不换图表引擎、不加运行时依赖（katex / pele / `@codemirror/lang-*` 均已在 package.json）。
- 不改既有 HTML/Word/PDF/mdpkg 导出契约。
- 不做跨文档拖块。

## Decisions

### D1 手柄菜单关闭计时统一（对应 Q1）

插入菜单用 slash 自己的 `scheduleAnchorClose`（`src/editors/slash.ts:467-492`，触发点 `:830-833`）；父块菜单面板 `pointerenter` 只调 `cancelPendingClose`（`src/editors/orchestration/block-menu.ts:288`），不清该计时器，150ms 后子面板被拆。

**决定**：`slash.ts` 导出 `cancelAnchorClose()`，`block-menu.ts` 的面板 `pointerenter` / `pointermove` 同时调用它与 `cancelPendingClose`；关闭宽限保留 150ms。备选（把计时器并入 `hover-gate.ts`）改动面更大，放弃。

### D2 图片/表格菜单跟随指针（对应 Q2）

`anchorRectAt` 纵向用 `coordsAtPos`（`block-menu.ts:227`），对 `ImageWidget`/`TableWidget` 返回整块矩形而非指针行；横向用 handle rect。

**决定**：块型为 image/table 时，纵向锚点改用 handle rect 的 `top/bottom`（指针进入手柄即贴身），横向继续用 handle rect（与标题/段落一致）。不改 `placeMenu` 的通用算法。

### D3 拖块落点指示（对应 Q3）

拖拽已存在（`block-handle.ts:589-668` + `block-model.ts:89-115` `moveBlock`），缺的是落点反馈与菜单计时清理。

**决定**：拖拽期间在目标块上/下沿渲染 2px 插入指示线（复用菜单 z-index 层），松手调用既有 `moveBlock`；拖拽开始即清菜单关闭计时器。不新建 `block-drag.ts`（proposal 里列的文件名作废，改为在 `block-handle.ts` 内完成）。

### D4 全屏按钮栏自动浮现（对应 Q4）

`fitObserver` 无条件 `art.autoSize()`（`VideoPlayer.tsx:1156-1164`）绕过 ArtPlayer `resizeInit` 的 `state === "standard"` 守卫；原生全屏 resize 后覆盖 `art-fullscreen-web` 的 100% 尺寸，`$player` letterbox，屏幕底部按钮区落在 `$player` 外，`$player` 的 `mousemove` 不触发 → 控制条不 show、浮层无 `mouseenter`。

**决定**：改为 `if (!art.fullscreenWeb) art.autoSize()`。真机验证（`npm run tauri dev`）必做，e2e mock 不触发窗口 resize。

### D5 块宽度统一（对应 Q7）

全局 `box-sizing: border-box`（`src/styles/editor.css:9-13`）。预览 `.preview-content > *` 的 `max-width: var(--type-measure)`=1080（`reader.css:84-91`），引用块再加 `padding: .7em 1em` + 2px 左边框（`:458-464`）→ 文字列窄约 36px。编辑态 `.cm-line` 同为 1080（`editor.css:81-82`），`.cm-line.cm-quote` 加 `padding-inline: 1em`、`.cm-line.cm-fenced-code` 加 `border-inline: 1px`。

**决定**：按「文字列等宽、卡片允许外溢」补偿，不做内缩：
- 预览引用块：`max-width: calc(var(--type-measure) + 2em + 2px)`（文字列回到 1080，卡片左右各外溢约 18px）。
- 编辑引用块：`max-width: calc(var(--type-measure, 1080px) + 2em)`。
- 编辑代码块：`max-width: calc(var(--type-measure, 1080px) + 2px)`。
- 预览代码块保持 `.wide`（1200），不改（用户只要求引用块与文本块等宽）。

不改 `.cm-line` 基础宽度，避免打挂 `e2e/editor-display-parity.spec.ts:114` 的 1080 断言。

### D6 字体（对应 Q8）

实测两侧字体栈已几乎一致：预览 `--type-font-sans`（`reader.css:39-45`）与编辑 `.cm-editor .cm-scroller`（`editor.css:59-62`）逐字相同；md-bundle `packages/renderer/src/readerCss.ts` 是 clairis reader 的移植，同栈。

差异只在等宽：编辑态行内代码用 `"SF Mono","Fira Code","Fira Mono","Menlo",Consolas,monospace`（`editor.css:575-576`），围栏代码用 `var(--type-font-mono)`（`:608-616`）。

**决定**：编辑态行内代码、引用标记、代码标记统一到 `var(--type-font-mono)`；标题保持 sans（md-bundle 预览标题继承 sans，`--font-display` 衬线只用于站点外壳，不引入）。新增断言：编辑/预览 `font-family` 计算值相等、行内与围栏 mono 相等。不改字号/行高（本轮无证据支持）。

### D7 编辑态公式（对应 Q9）

编辑态无任何公式处理（`src/editors` 内只有 `Math.min/max`）。预览用 `src/renderers/math.ts`（KaTeX）。

**决定**：仿 `decorations/mermaid.ts` 新建 `decorations/math.ts`：解析 `$$…$$`（块）与 `$…$`（行内），非活跃块 `Decoration.replace` 为 KaTeX widget（`katex.renderToString(..., { throwOnError: false })`），活跃块显示源码；接入 `decorations/index.ts` 的 `buildDecorationSet` 与 `EditorDecorationsOptions`，受 `isCapabilityEnabled("math")` 门控。不做编辑内光标级预览。

### D8 编辑态代码高亮（对应 Q10）

`setup.ts:122` 为 `markdown({ base: markdownLanguage })`，无 `codeLanguages`；`.tok-*` 颜色在 `reader.css:562+` 是全局规则。

**决定**：传入函数式 `codeLanguages`，用已安装的 `@codemirror/lang-{javascript,python,css,html,json,yaml}` 构造 `LanguageDescription`，别名表对齐 `src/renderers/highlight.ts` 的 `LANGUAGES`。不新增依赖、不改 CSS。

### D9 Pele 两态（对应 Q11）

现状已是 Pele 双态：预览 `renderAll`（`mount`，`PreviewView.tsx:461-467`），编辑 `renderAllStatic`（`render`，`ContentArea.tsx:73-81`），主题走 `--pele-*` 变量。

**决定**：不改引擎路径（`renderAll` 进编辑会引入 D4 明确回避的 ResizeObserver 残留）。本票只做「两态一致性核查」：真机打开含 mermaid 的文档，确认非活跃块在两态都出图；若发现某类语法（如 `graph TD` 别名、主题变量）在一态缺失，就地修。新增断言：两态各恰好 1 个 `<svg>`、`--pele-*` 变量值相等。

### D10 表格选择网格（对应 Q5）

`paint(r,c)` 已实现「(1,1)→(r,c)」矩形（`slash.ts:779-784`），行为正确；问题在性能：每次 `mouseenter` 全量写 100 格，且 `enterGrid` 每次进入表格行重建 100 格并重置 hover（`:736-755,:758-807`）。

**决定**：`paint` 改增量（记录上一次矩形，只翻转对称差格的 `data-on`）；`enterGrid` 在 `state.grid` 已存在且 `submenuParent` 未变时不重建；补 `mousemove` + rAF 合并兜底。

### D11 分栏横向 5 栏（对应 Q6）

当前「分栏」是 `children` 纵向 5 行（`slash.ts:153-166,271-277,1281-1336`），插入逻辑现成。

**决定**：给 `SlashCommand` 加 `layout?: "columns"` 标志，`renderFlyout` 对该标志渲染 5 个等宽横格（`grid-template-columns: repeat(5,1fr)`），`mouseenter` 设 `flyoutSelected` 并重画高亮，单击 `activateRow`。插入文本不变。

### D12 Markdown 打印（对应 Q12）

现状零打印支持（无 `@media print`、无 `window.print` 调用、无菜单项）。Tauri 2.11.3 在 macOS 注入 `window.print` → `plugin:webview|print`（`tauri-2.11.3/src/webview/scripts/print.js`），需 ACL `core:webview:allow-print`。

**决定**：新增 `src/styles/print.css`（A4 纵向、10mm 页边距、隐藏外壳/页签/工具条/浮层、`pre/blockquote/table/img` `break-inside: avoid`、`h1` `break-before: page`）；`paneHeaderMenu` 增「打印」项，handler 调 `window.print()`；`src-tauri/capabilities/default.json` 加 `core:webview:allow-print`。不升级 PDF 为分页矢量（超出本批）。

### D13 图片描述（对应 Q13）

工具条「评论」按钮 → `onImageComment` 插 `> 评论：`（`ContentArea.tsx:236-245`）；真正的描述行已存在：`imageToolbar.ts` `enterCaptionEdit` → `onImageSetTitle` → `writeImageTitle` 写 `![alt](path "title")`。有 title 时点击收起（`display:none`），无法再编辑。

**决定**：按钮改调 `enterCaptionEdit`；blur 视为保存（非丢弃）；已有 title 时点击进入编辑并回填；图标换成「文本+笔」（`icons.ts` 新增 `TextEditOutlined` 路径）。不再插入引用块。

### D14 图片裁剪正确性（对应 Q14-Q17）

四个独立根因：
1. 旧宽度注释只认 `-->`（`image.ts` 的 `WIDTH_COMMENT_RE` / `LEGACY_WIDTH_COMMENT_RE`），`—>` 既不隐藏也不在写回时清除 → 字面泄漏；它与 inline-block 大图同行，行盒被图高撑开 → 长空白。
2. 左/上边界符号写反：`imageCrop.ts:219/222` 与 `image.ts:846/853` 用 `left - dx` / `top - dy`。
3. 浮层控制点（8 个 span）无裁剪标识、无方向光标（`imageCrop.ts`；`imageToolbar.ts` 有光标无标识）。
4. 浮层矩形本体有 `cursor:move` 却无拖拽实现 → 「再次裁剪保存不按新区域」。

**决定**：正则同时接受 `-->` 与 `—>`；写回时无条件剥离尾部旧注释再写属性块；左/上用 `+ dx` / `+ dy`；控制点保留 8 个（4 角 + 4 边），角点 `nwse/nesw-resize`、边点 `ew/ns-resize`，并加裁剪角标；实现矩形本体拖动（移动整个 rect，clamp 到图内）。

### D15 图片对齐与锚点（对应 Q18、Q22）

编辑态 `ImageWidget.toDOM` 从不读 `attrs.align`；工具条无 active 态（无 `aria-pressed`/激活类）。已裁剪图拖锚点走 `beginCropResize`（`image.ts:712-715`）而非 `beginResize`。

**决定**：编辑态按 `align` 给容器加 `data-align` 并通过 `.cm-line` 的 `text-align` 生效（left/center/right），新建图片默认 `center`；工具条按 `align` 标注 active；锚点始终走 `beginResize`（裁剪只从浮层入口进入）。

### D16 图片双击预览浮层（对应 Q19）

现状仅 `max-width:90vw/max-height:90vh` 的静态图，无缩放/拖动/捏合/旋转/下载/原尺寸。

**决定**：滚轮 1.1 步进（1..8 倍）、放大后拖动平移（clamp 到边界）、双指捏合（Pointer Events 两指距离）、旋转 90° 步进、下载（复用 `download` 现有能力）、双击/按钮恢复原始尺寸。不引入库。

### D17 图片圆角（对应 Q20）

编辑态 `clipPath: inset(0 round 8px)`（`image.ts:658`）；预览 `--reader-radius: 6px`。用户要求下两角也是弧形且更大。

**决定**：两态统一 `12px` 四角（`--reader-image-radius: 12px` 新变量，编辑态 clipPath 同步），下两角不再缺省。

### D18 图片手柄图标与菜单（对应 Q21）

`blockHandleIcon` 图片映射已是 `ImageOutlined`（`block-handle.ts:48`）——需真机确认是否被通用图标覆盖。菜单动作组为 复制块/剪切块/上移/下移/删除块 + 「对齐与缩进」二级。

**决定**：图片块菜单顺序固定为 对齐与缩进 → 剪切 → 复制 → 删除（去掉图片块的上移/下移，因为拖拽已承担移动）；图标保持 `ImageOutlined` 并加断言钉住；若真机显示为通用图标，修映射。

### D19 任务图标（对应 Q23）

`TodoOutlined` 是空方框（`icons.ts:303-309`）；编辑态 `.cm-task-checkbox` 是 `border-radius:50%` 圆形（`editor.css:515-541`）。

**决定**：`TodoOutlined` path 换成方框内打勾（复用 `src/ui/icons.ts:523-526` 的 `s`）；`.cm-task-checkbox` `border-radius` 改 `3px`，保留选中 `::after "✓"`。同步 `block-handle.test.ts:26` 的图标名断言（名称不变，无需改）。

## Risks / Trade-offs

- [宽度补偿让引用卡片外溢 18px] → 与正文文字列严格对齐，视觉上更像「引文外挂」；真机截图确认后再定。
- [全屏 autoSize 守卫可能影响非全屏自适应] → 只在 `fullscreenWeb` 为真时跳过；非全屏路径不变，回归 `video-fit` / `video-compact`。
- [编辑态公式 widget 影响光标移动/IME] → 沿用 mermaid 的两态模型（活跃块显示源码），并补 IME 组合期守卫（`decorations/index.ts` 已有 composing 守卫）。
- [打印依赖 `core:webview:allow-print`] → ACL 收窄在 `default.json`，只加这一条；e2e 断言 `@media print` 规则存在与菜单项可点。
- [图片锚点统一为缩放会改变已裁剪图的既有交互] → 用户明确要求；旧路径（裁剪把手）保留在浮层内。

## Open Questions

无。（三处原空白已定：字体栈按实测记录；分栏=5 等分；打印 A4/10mm/无页眉页脚。）
