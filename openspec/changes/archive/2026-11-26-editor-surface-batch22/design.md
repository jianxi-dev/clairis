## Context

本批 15 条有效需求来自用户 2026-11-26 反馈（对账表 `.artifacts/triage-input-alignment-2026-11-26.md`）。代码核实（4 个探索代理 + quiet 源码比对 + 豆包像素采样）结论：**高亮块的拆分骨架已在**（`callout-types.ts` 13 类标注 + 纯高亮、`callout-color-panel.ts:189 buildHighlightColorPanel` 四行 + 随机 + 恢复默认），用户不认是因为**色板、图标、转换落点、触发方式**四处做错。因此本批设计以「修正既有实现 + 补规格条款」为主，不是从零新增。

**约束**：模式切换用 CSS display 不 remount；新增 `cm-*` 类须同步 `src/styles/`；交付前 `bash scripts/verify.sh` 全绿。

## Goals / Non-Goals

**Goals:**

- 高亮块四处做错全部修正（色板 / 图标 / 转换落点 / 触发方式），空态不再塌陷。
- 图片裁剪改为 quiet 式整图 + 蒙版，工具条与放大层对齐（含重置）。
- 嵌入文件三态交互按 #15 重定义；链接文件支持点击打开 + 修饰键悬停浮窗。
- 既有 requirement 未生效的 7 条（对齐 / 字体 / 回顶 / 源码对勾 / 导出方向 / 悬浮窗图标 / 视频首帧）落到可见行为。

**Non-Goals:**

- 行内文字背景 mark（`==text==`）——用户已澄清高亮 = 高亮块（callout 变体，样式不同），行内 mark 不在本批。
- 大文件每键全量重建（对账 #20）——用户裁定本轮不做，风险另开票。
- `editor-surface-batch20`（0/29 停滞）——用户裁定不处置，本批不并入。
- 嵌入文件「复制入库」托管——Clairis 保持文档同目录相对路径的可移植性优势。

## 色板（豆包像素核准，唯一真相源）

来源：`豆包高亮颜色截图.png` 1234×622，raw RGB 逐格采样（对账表 §3.2）。**高亮 / 标注专用 24 格色板，独立于 `mdb-bg-*` 文字背景板**（该板仍供行内文字背景使用）。

**字体 8 格**

| # | 名 | 色值 |
|---|---|---|
| 1 | 默认（无） | #ebebeb（白 A，选中时蓝框） |
| 2 | 灰 | #757575 |
| 3 | 红 | #fa7873 |
| 4 | 橙 | #f5a54a |
| 5 | 黄 | #fcd456 |
| 6 | 绿 | #6dd162 |
| 7 | 蓝 | #71a0ff |
| 8 | 紫 | #a472fc |

**边框 8 格**

| # | 名 | 色值 |
|---|---|---|
| 1 | 无（斜线） | #2d2d2d |
| 2 | 灰 | #434343 |
| 3 | 红 | #9e3836 |
| 4 | 橙 | #bd7017 |
| 5 | 黄 | #c7b302 |
| 6 | 绿 | #339428 |
| 7 | 蓝 | #2951a3 |
| 8 | 紫 | #6532bd |

**填充深档 8 格**

| # | 名 | 色值 |
|---|---|---|
| 1 | 无（斜线） | #303031 |
| 2 | 深灰 | #2b2b2b |
| 3 | 暗红 | #4a1d1b |
| 4 | 暗橙 | #57330a |
| 5 | 暗黄 | #5c5514 |
| 6 | 暗绿 | #1f471b |
| 7 | 暗蓝 | #192a4c |
| 8 | 暗紫 | #361d61 |

**填充中档 8 格**

| # | 名 | 色值 |
|---|---|---|
| 1 | 灰 | #363636 |
| 2 | 灰 | #3c3c3c |
| 3 | 红 | #6b2827 |
| 4 | 橙 | #845117 |
| 5 | 黄 | #877b10 |
| 6 | 绿 | #296b22 |
| 7 | 蓝 | #213e78 |
| 8 | 紫 | #4d2691 |

**兼容映射**：旧色名（darkred / brown / olive / darkgreen / navy / indigo / slate / yellow / green / blue…）在 `parseCalloutAttrs` 保留映射，旧文档不失效。

## Decisions

### D1 高亮色板：单开一套 24 格，不动标注色板

**决策**：为高亮新增独立色板常量（`HIGHLIGHT_FONT_COLORS` 8 格 + `HIGHLIGHT_BORDER_COLORS` 8 格 + `HIGHLIGHT_FILL_DEEP` 8 格 + `HIGHLIGHT_FILL_MID` 8 格），色值取上表；`HIGHLIGHT_COLORS` 家族表按色相重建（红 / 橙 / 黄 / 绿 / 蓝 / 紫 / 灰，去「青」）。标注面板继续使用既有 `FONT_COLORS` / `BACKGROUND_COLORS` / `BORDER_COLORS`。

**理由**：`BACKGROUND_COLORS` 同时被标注面板（`buildCalloutColorPanel`）与块级颜色行（`applyBlockColor`）复用，直接改它会连带改标注与块颜色，违反「高亮与标注互不复用」。单开一套是唯一不回归的做法。

**落点**：`src/editors/orchestration/color-palette.ts`（替换 `FONT_COLORS:26` 的 9 格与 `BACKGROUND_COLORS:39` 的 16 格在高亮面板的使用）。色板是代码常量 + CSS token，不走 `config.rs` / `settings.json` 配置通路（用户未要求可配置）。

### D2 面板布局：三组严格 8 / 8 / 2×8，不换行

**决策**：面板自上而下 SHALL 为——字体 8 格（含「随机」）、边框 8 格、填充深档 8 格、填充中档 8 格、恢复默认。每行 `display:flex; flex-wrap:nowrap`，格数恒为 8。

**理由**：#5 明确「颜色体系及数量和排布严格参考豆包」「不要出现换行」。现状 `buildHighlightColorPanel` 是「字体 + 随机 / 边框 / 浅填充 / 深填充」四行，格数 9 / 8 / 8 / 8，且字体行 9 格。

### D3 触发方式：hover 展开 + 关闭条件收窄

**决策**：块上方居中调色板图标改为 `pointerenter` 即展开面板（`floating-toolbar.ts:987` 现为 pointerdown / click）；面板关闭条件限定为 ① 点外部 ② Esc；「随机」「选色」「恢复默认」执行后**不关闭**（现状 `onPick` / `onRandom` / `onReset` 都调 `closePopup()`）。

**理由**：#5 明确「鼠标滑入后要显示窗口」「点随机不关闭」「点外面才消失」。选色不关闭与 quiet 一致（quiet 点当前色是 toggle，面板保持）。

**风险**：hover 展开易与既有浮条（选区轮盘）抢触发。见 Risks。

### D4 空态高度：min-height + 可点入

**决策**：`.cm-callout.cm-callout-mark` 空态设 `min-height ≥ 44px`；单行内容高度约 3.2em（≈52px @16px）；空内容区点击 SHALL 落到 `cm-callout-editor` textarea 而非卡片容器。

**理由**：#4。现状 `.cm-callout-mark` padding `0.2em 0.45em`（`editor.css:2658`），内容行 `min-height:1.7em` 只在 `.cm-callout-content .cm-callout-line`（`:2788`）；空块无 content 节点 → 高度塌陷成一条线。

### D5 转换落点：补 `calloutKind`

**决策**：`block-convert.ts:489 CALLOUT_MARK_ITEM` 增加 `calloutKind: "highlight"`。

**理由**：#6 根因——`block-convert.ts:193` 的转换逻辑是 `options.calloutKind ?? "NOTE"`，缺字段就落 NOTE。一行根因修复，不是在每个调用点打补丁。

### D6 颜色行图标恢复 A 字形

**决策**：`block-menu.ts:701` 的 `renderIcon("FontcolorOutlined")` 改为 `renderIcon("FormatColorTextOutlined")`。

**理由**：`icons.ts:496` 已定义 `FormatColorTextOutlined: { kind: "text", label: "A", weight: 700 }`，正是 A 字形；`color-palette.ts:118` 的字体色行已在用它。无需新增图标，只需统一。

### D7 裁剪：整图 + 蒙层 + 统一坐标系

**决策**：裁剪态改为 quiet `crop_display` 式——外盒 `overflow:hidden`（尺寸 = 可见裁剪显示尺寸）+ 内图按整图缩放平移；裁剪态把外盒临时换成整图盒，框外盖四块 `rgba(0,0,0,0.3)` 暗罩，1px 白色虚线框 + 8 个 24px 热区 + 2 个移动热区；保存走工具条「确定」按钮 + window 级 `pointerup` 双通道；保存时同步写回 `width/height`。二次进入显示整图 + 上次矩形（框内亮）。

**理由**：#1。参照 `media-board.md` §3.3 / §3.4（整图裁剪 + 蒙层、`save_crop` 同步写宽高、`reset_crop`）。

**关键实现约束**：
- `imageCrop.ts:137 mount()` 前必须等目标 `img` 的 `complete` / load。
- `pointerup` / `pointercancel` 挂 `window`，不依赖裁剪框存活。
- 保存写回 `width = 裁剪时整图缩放 × 新可见分数`（quiet `save_crop:1213-1216`），避免跳变。

### D8 重置图片：工具条 + 放大层

**决策**：图片工具条（`imageToolbar.ts:32 BUTTON_SPECS`，现 9 按钮）在已有 crop 时追加「重置图片」，清除 crop 并按原分数还原显示尺寸回整图；放大层（`:958 openImageMaximize`，现 4 按钮：旋转 / 下载 / 恢复原始尺寸 / 关闭）补齐「重置图片」，与工具条按钮语义一致。

**理由**：#2 #3。参照 quiet `reset_crop`。仅已有 crop 时出现（无 crop 时重置无意义）。

### D9 嵌入文件三态交互

**决策**：三态映射为 `embed`（文本视图）/ `card`（卡片视图）/ `preview`（预览视图）。交互：
- `embed`：滑入显示文字工具条 + 点击文件名打开。
- `card` / `preview`：单击显示工具条，再点文件名打开；`preview` 点击选中后再点打开。
- 工具条三态切换由文字按钮改三图标（列表 / 卡片 / 图片，顺序固定）。
- 头部 `.cm-embed-name` 不再无条件劫持 click（`fileEmbed.ts:896-899` 现 `openInNewTab()` + `stopPropagation`）。

**理由**：#15。直接原因：头部 click 被劫持导致「单击就打开，无法切换」。

### D10 链接文件：修饰键门控 + 复用 FloatingPreview

**决策**：预览态 `markdown.ts:682` 的 `<a>` 处理增加本地文档链接判定：普通点击 = 打开（现有 `target="_blank"` 保留）；⌘/Ctrl + 悬停 = 调 `stores/index.ts:1455 openPreview` 唤出文件卡片式悬浮窗。

**理由**：#8。复用既有 `FloatingPreview`，不新建第二套悬浮窗（与 navigation「悬浮预览窗」条款一致）。

### D11 格式对齐：四处收口

**决策**：
- 表格：`.cm-table-wrap`（`editor.css:2223`）加 `max-width: var(--type-measure, 1080px)`（现状无 max-width，所在行 `max-width:100%` = 纸宽 1200 → 超 120px）。
- 有序列表：`.cm-list-marker`（`editor.css:596`）加负 `margin-inline-start`，与无序 marker 缩进对齐。
- 引用块：`.cm-line.cm-quote`（`editor.css:646`）的 `max-width` 由 `1080px` 改为 `calc(var(--type-measure) + 2em + 2px)`，与 `reader.css:535` 的 `blockquote`（1080 + 2em + 2px）一致。
- 代码块：编辑态纵向内边距与预览统一。

**理由**：#10，既有条款 `editing:209/222` 已登记但未生效。四处都是「编辑态与预览态同貌」的具体缺口。

### D12 字体选择器：显示值与搜索词分离

**决策**：`HeadingFontField.tsx` 拆成两个 state：`display`（输入框显示值，聚焦时 = 当前已选字体名）与 `query`（搜索词，仅输入时更新）。`filtered` 按 `query` 过滤；聚焦时若 `query` 为空则显示全量候选。

**理由**：#11 根因（`HeadingFontField.tsx:93-102` 单 state 混用）——`filtered` 按输入框 `text` 过滤，而 `text` 同时是显示值，聚焦即只显示匹配项。既有条款 `configuration:109-155` 已登记。

### D13 模式切换回顶：行锚点映射

**决策**：模式切换（preview↔edit↔source）时，按「当前视口中心行的文档偏移」记录锚点，切回时按同一偏移恢复；不依赖 `scrollTop` 像素值。

**理由**：#12。现状 `ContentArea.tsx:623-638` 的滚动恢复只在 `editorMode === "preview"` 且 `tab.path` 时生效，且用 `scrollPositions` 像素值；`PreviewView.tsx:552` 每次 `dangerouslySetInnerHTML` 重建 → 高度瞬时塌陷 → WebKit 把 `scrollTop` 夹到 0。

### D14 源码模式对勾

**决策**：格头 ⋯ 菜单（`PaneTreeView.tsx:623` 的 `PANE_MENU_ITEMS.map`）的「源码模式」项加 `aria-pressed={editorMode === "source"}` 与对勾图标（复用 `check` 图标，见 `design-system:§2.3` 状态组）；再点取消回编辑。

**理由**：#13。`paneHeaderMenu.ts:50` 的 `PANE_MENU_ITEMS` 是静态定义，`nextPaneMode` 只在 preview↔edit 循环，源码模式是独立态，应对勾标记。

### D15 悬浮窗图标修正

**决策**：`FloatingPreview.tsx:751` 的 `editing ? "eye" : "pencil"` 改为 `editing ? "pencil" : "eye"`。

**理由**：#14。编辑态应显示铅笔（表示「正在编辑」），预览态显示眼睛。现状反了。

### D16 视频首帧 poster

**决策**：嵌入视频（`reading:582` 域）补条款：未播放时显示首帧 poster。实现复用 `file-management` 的取帧做法（`media://` → `preload` → `onLoadedMetadata` seek 取帧）。

**理由**：#7。`reading:582` 只要求「正常显示并可播放」，无首帧条款 → 规格缺口，先补条款再写码。

### D17 导出子菜单方向

**决策**：页签右键「导出」子菜单默认右开；触右边界时翻左（复用既有浮层裁剪逻辑，不新写一套）。

**理由**：#9。参照 `application-shell`「栏目更多操作菜单边界」的翻转判据。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§6 + 本 change `reading` / `editing` 条款 | — | 高亮 24 格色板须先有 spec 条款（本 change 补 `editing` E-48 色板条款） |
| 存储 | `src/styles/{reader,editor}.css` | `mdb-bg-*` / `mdb-border-*` / `mdb-color-*` token | 新色值落在既有 token 体系；旧 token 保留（兼容映射） |
| 校验 | `src/editors/orchestration/color-palette.ts` | `HIGHLIGHT_FONT_COLORS` / `HIGHLIGHT_BORDER_COLORS` / `HIGHLIGHT_FILL_DEEP` / `HIGHLIGHT_FILL_MID` | 四组常量格数分别为 8 / 8 / 8 / 8，色值等于上表 |
| 桥接 | `src/editors/orchestration/callout-color-panel.ts` | `buildHighlightColorPanel` | 面板读新常量，不读 `BACKGROUND_COLORS`；三组 `flex-wrap: nowrap` |
| 消费 | `src/editors/orchestration/{block-menu,floating-toolbar,block-convert}.ts` | 颜色行图标 / hover 触发 / `calloutKind` | 图标为 `FormatColorTextOutlined`；hover 展开；「高亮」直落 `[!highlight]` |
| 回滚 | `src/editors/orchestration/color-palette.ts`; `src/editors/orchestration/callout-color-panel.ts`; `src/styles/editor.css`; `src/styles/reader.css` | `HIGHLIGHT_FONT_COLORS` / `HIGHLIGHT_BORDER_COLORS` / `HIGHLIGHT_FILL_DEEP` / `HIGHLIGHT_FILL_MID` + 对应 `mdb-*` token | `git checkout -- <上述路径>` 即回滚；无配置文件写入，无快照依赖 |

> 说明：本批色板是**代码常量 + CSS token**，不走 `config.rs` / `settings.json` 配置通路（用户未要求可配置）。若后续要求「高亮色板可配置」，另开 change 补配置通路。

## Risks / Trade-offs

- **[hover 展开颜色面板与选区轮盘抢触发]** → 缓解：颜色图标的 hover 触发限定在「指针已进入块手柄浮条」之后，且面板打开期间屏蔽轮盘；e2e 覆盖「hover 块 → 面板出现 → 选色不关闭」。
- **[裁剪坐标系改造影响预览态]** → 缓解：预览态（`markdown.ts:508-516`）已是「自然像素偏移」正确写法，本批只改编辑态裁剪 UI 与保存通道；预览态不动，e2e 双态各自断言。
- **[嵌入三态缺样张（O-2）]** → 缓解：按默认映射规划，卡片宽度取 quiet 400px；样张补充后若与实现不符，走 change 修订而非静默改需求。
- **[24 格色板与既有 `mdb-bg-*` token 体系的关系]** → 缓解：新色值落既有 token 体系（`mdb-bg-*` / `mdb-border-*`），旧 token 保留且 `parseCalloutAttrs` 保留旧色名映射；旧文档不失效。
- **[字体色去「青」影响标注面板]** → 缓解：本批只改高亮面板（8 格），标注面板保留 9 格；若用户要求标注同步，走 change 修订。

## Migration Plan

- 无数据迁移。色板 token 新增是纯增量；旧文档的 `mdb-bg-dark*` 高亮属性仍能渲染（token 保留 + 旧色名映射），新文档用新 token。
- 回滚：`git checkout` 对应文件即可；无配置文件写入，无快照依赖。

## Open Questions

- **O-1**：高亮字体色 8 格（去青）。默认对齐豆包；标注面板是否同步去「青」留待用户确认。
- **O-2**：嵌入文件文本 / 预览视图样张缺失。默认按三态映射，卡片宽度取 quiet 400px。
- **O-3**：引用块右缘差按既有条款收口。默认 `calc(var(--type-measure) + 2em + 2px)`。
- **O-4**：模式切换映射口径。默认行锚点映射。
- **O-5**：导出子菜单翻转判据。默认复用既有浮层裁剪逻辑。
