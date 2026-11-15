# 设计 — editor-surface-batch20

来源：spec issue #897；需求四要素 `docs/requirements/editor-surface-batch20/requirements.md`（含 L-1 需求输入包）。

## Context

本批 28 项以「既有 requirement 未真正生效」为主。程序化定位（`openspec/specs/**/spec.md` 条款 + 代码）确认：缺陷 4/8/9/11/13/14 与优化 9/12 的 requirement 均已登记，但实测未达成或仅覆盖预览态。故设计的第一原则是**收敛到既有 contract、只补差异**，而非另立机制；确需改契约的两处显式 supersede。

## Goals / Non-Goals

**Goals:** 把已登记的 contract 落到用户可见行为；消除 batch19 的回归与半覆盖；对冲突条款做出显式裁决。

**Non-Goals:** 导出 PDF 分页矢量化；mermaid 渲染引擎；图标库重画；移动端；重排既有菜单其余项。

## Decisions

### D1 打印→PDF 内容完整（缺陷 1）

- 打印走 `printPreview.ts`（`renderMarkdown` 造 `#biaoyue-print-root` → `window.print()`）经 macOS 打印栈存 PDF。缺陷 1 一手证据：源文档 mermaid 之后的 h2「代码高亮」、typescript 代码块、引用、DANGER callout 全部缺失，且两行行内公式重复。
- 方向：在 `print.css` 放开一切会裁剪/断页的容器（`.code-block { overflow:hidden }`、`contain`、`break-inside`、父链高度），并复核 `renderMarkdown` 是否在 mermaid/内嵌节点处截断输出流。应用内单页导出 PDF（`pdf.ts`）同域保证单页内完整 + 超限显式拒绝（量高时机等图片 `decode()`；高度守卫按 `PNG_SCALE` 折算 device px）。不做分页矢量。

### D2 媒体与视频（缺陷 2/3/5/6/12；优化 3/4/5）

- 缩略图：网格卡片（`GridTile`）与悬浮窗（`FloatingPreview`）复用 `ReadingRail.RailThumb` 的取首帧做法（注册 `media://` → `preload` → `onLoadedMetadata` seek 取帧），消除「只有图标/黑屏」。
- 文本卡标题：给卡片右侧进度/时间预留空间（标题流内 + 进度绝对定位右上），不重叠。
- 字幕同名：字幕候选按「当前视频 file_stem」过滤（`directory.rs` 已按「命中任一媒体」过滤，前端再按当前视频收敛），初始打开即加载同名字幕；快捷键/面板同一口径。
- 不自动播放与单声道：移除 `VideoPlayer` ready 阶段的手动 `art.play()`（1094/1100），保持 `autoplay:false`；消除双音频从「两次 play」与「Web Audio `MediaElementAudioSourceNode` 图」两条线核查（重跑 effect 时还原元素默认输出）。supersede `reading`「视频打开即自动播放」为「打开为暂停态、不自动播放（续播仅恢复时间点不播放）」。
- 编辑态媒体：编辑态 `ImageWidget`/`MediaWidget` 的 src 解析链（`resolveDocMediaHref` → `convertFileSrc`/`register_media_path` → `media://`）必须与预览态同源；图片解析失败不得退化为裂图「问号框」，给显式占位并可重试；视频块在编辑态可播放（原生控件点击透传，`ignoreEvent` 已对 `video` 返回 true）。
- 进度缩略图与适配：缩略图浮层锚定 `.art-progress` 实际 Y（上侧），移除写死 `bottom:64`；`MediaPlayerHost.readPaneRect`/`fitObserver` 保证格尺寸变化（含分栏比例 90%）后 `art.autoSize()` 生效。
- 图标：卡片/浮层播放角标改用语义更贴切的图标（`play` 或新自绘），编辑器侧对应 `VideoOutlined` 复核。
- 圆角：`.cm-image-widget` 圆角取视频块同一 token（`--radius-8`），预览态 `.preview-content img` 同步。
- 嵌入视频：编辑态与预览态默认宽度 2/3 页面宽；右键菜单「全屏」脱离文档页面（Tauri `setFullscreen` 或独立全屏窗）、速率左侧图标改为两档宽度菜单（满页面宽度 / 全屏）。

### D3 提示与菜单（缺陷 4/7；优化 1/2/8/10）

- 提示外壳与方位：`TooltipLayer.tipSideFor` 改为优先探测上/下空间，放不下再侧弹；`SKIP_TIP_SELECTOR`（`aria-haspopup`/`aria-expanded`/`data-no-tip`）不再绕过自绘——改为对这些元素也接管 `title`（或改用 `data-tip`），使一切自绘提示为胶囊/圆角方形，原生矩形消尽；延迟口径统一（未配置回退单一值，`noticeDuration` 为唯一来源，TooltipLayer 与底部提示同口径）。状态栏按钮提示经同一算法出现在图标上方。
- 页签提示窗：较高窗口用圆角方形（`--radius-8`，非胶囊），固定宽度、长文件名/路径换行。
- 悬浮窗：降低高度、收紧图标上下留白。
- 页签导出子菜单：收起条件改为「指针移出（导出行 ∪ 子菜单）并集」；菜单内提示走自绘（消除原生黑矩形：overlay 打开时不再放行原生 `title`）。
- 「移动到」图标：新增 folder+右箭头 IconName，并立「不同概念不复用同一 path/形状」规则（补单测 + 文档）。
- 菜单统一：以 `menu-metrics.ts`（176/36）+ `editor.css` 的菜单样式为单一 grammar，复用到斜杠菜单、其他功能块菜单与新增手柄菜单（字号/圆角/行高/图标尺寸/阴影统一）。

### D4 编辑器表面（缺陷 8/9/14；优化 6/7/11/13/14）

- 标题配色：`ContentArea` 在 `.cm-editor-container` 注入 `--tone-*` / `--heading-hN-*`（当前仅 `.preview-content` 生效），编辑态标题使用自定义色；不得越入正文。
- 预览折叠触发区：`PreviewView` 折叠按钮的触发区/命中盒对齐编辑态 `FoldToggleWidget`（20×20 + 召唤区语义），注意 `.preview-content` 的 `contain: paint` 与内边距差异。
- 逗号→/ 与撤销：按 `smart-input.ts` 三条守卫（composing/inProtectedRegion/菜单已开）复现逗号失效；撤销核查 `historyCompartment` 装配与焦点路径，修真实根因。
- 横向工具条回滚：回滚对象是 md 编辑态选区**胶囊**（`floating-toolbar.capsuleItems`），取更少按钮集（pre-#623 胶囊 12 键两层），CSS 横条不受影响。
- 嵌套录入：可录入处（标准/引用/单元格/分栏/有序无序列表下层）统一支持插入、新增与转换手柄；单元格/分栏内按富文本渲染（复用同一装饰管线），不显示源码。
- Tab 缩进与边框对齐：Tab（含多级缩进）后功能块装饰仍在位、可编辑、手柄可召唤（引用块）；引用块左右边框以右侧对齐为准、左侧按层级空格。
- 编号位置：斜杠网格选择器的说明与读数改为「读数在说明右侧」；表格读数与末列边框右对齐；分栏读数居中第 5 栏；分栏子菜单相对触发行垂直居中（`positionFlyout`）。
- 文本显示格式统一：行号槽贴合正文（收敛 gutter `min-width`/`padding` 与 `.cm-content` 左内边距叠加）；代码盒子与配色编辑态/预览态统一（复用 `reader.css` `.tok-*` 为唯一配色源）；检索更美观的代码配色/字体并复用。
- 文本工具条：text/csv 编辑态与预览态都只显示复制按钮。

### D5 窗口与布局（缺陷 10/11/13；优化 9）

- 页签空白拖动：`.tab-strip` 空白 pointerdown 只触发窗口拖动（阻止冒泡到 `PaneHeader` 的 pane 拖动），补 `cursor`，单浮层；补 `core:window:allow-start-dragging`。
- 双击全屏：`double click` 改调 `setFullscreen(!isFullscreen())`（非 `toggleMaximize`），补 `core:window:allow-set-fullscreen`；与「双击新建文档」条款做裁决（以全屏为准，supersede）。
- 左边栏快捷键：`⌘⇧X` 处理移到场景门之前（或让场景门放行 `x`），使网格预览打开时仍可切换固定隐藏；登记 `⌘⇧X` 到 shortcuts 并补 `decision`，补去重测试。
- 大纲：按钮 `top` 下移实测条目高 ×2；条目去前导竖线、加等级字样（如 `H2`，小于标题文字）；新增拖拽重排（持久化顺序）。

### D6 配置（优化 12）

- `headingFontInputValue` 默认返回当前栈（或显式「默认」文案）而非空；`fonts.rs` 预设改「本机字体 + 一组开源中英预设」，移除各国专有字体硬编码；mock 同步。

## 数据面

> 本批命中信号：配置字段（`heading_fonts`）、图标（play / folder-arrow）、快捷键（左边栏 `⌘⇧X`）、菜单（统一 grammar）、开关。按 `docs/agents/data-surface.md` 六栏表登记（落点|位置|载体/符号|判据|负责票|不变量）。

| 落点 | 位置 | 载体 / 符号 | 判据 | 负责票 | 不变量 |
|---|---|---|---|---|---|
| 配置·标题字体 | `src-tauri/src/config.rs` / `src/hooks/useConfig.ts` / `SettingsView.tsx` | `heading_fonts`（既有，6 级） | 显示当前值（含默认）；预设=本地+开源中英；非法值拒绝回落 | 6.1 | 字段名/序列化格式不变（camelCase `headingFonts`） |
| 配置·提示时长 | `src/types/index.ts` / `useConfig.ts` / `TooltipLayer.tsx` | `noticeDuration`（既有） | tooltip 与底部提示读同一口径；未配置回退单一值 | 3.1 | 设置项语义不变（秒，0.1–10） |
| 图标·播放角标 | `src/ui/icons.ts` | `play` / 新 IconName | 卡片/浮层播放角标语义贴切；`IconName` 联合同步 | 2.7 | `fill=currentColor` 契约不变 |
| 图标·移动到 | `src/ui/icons.ts` | 新 folder-arrow IconName | 带右指箭头；与 locate/folder 不复用 path | 3.4 | 一个概念一个图标；去重单测通过 |
| 快捷键·左边栏 | `src/lib/shortcuts.ts` / `src/App.tsx` | `global-rail-pin-hidden`（既有） | 网格预览下仍生效；登记 `decision`；键位唯一 | 5.3 | 不新增未登记键位 |
| 菜单·统一 grammar | `src/editors/orchestration/menu-metrics.ts` / `editor.css` | `MENU_WIDTH=176` / `MENU_ROW_HEIGHT=36` | 斜杠/新增/功能块菜单同字号/圆角/行高/图标尺寸/阴影 | 3.5 | 宽度/行高常量值不变（既有 E-11 口径） |

## Risks / Trade-offs

- [编辑态媒体「问号框」定性未定] → 实现票先真机复现（`npm run tauri dev`）区分「resolve 返回 null」与「register 未生效」两条线，再改。
- [双音频需要真机] → e2e play 桩测不出音频链路，G1 出口以 `tauri dev` 手点 + 播放/暂停调用计数双证据。
- [「选中 90」语义] → 按分栏比例 90% 理解，复现后若为独立预设转新票。
- [提示方向改动影响既有 e2e] → 同步修订 `tooltip-pointer-content.spec.ts` / `tooltip-pill.spec.ts`。
- [导出 hover supersede 影响既有 e2e/规格] → 同步修订 `tab-menu-move-icon-844.spec.ts` 与 navigation 规格条目。

## Open Questions

- 缺陷 12「选中 90」精确语义（DESIGN DEFAULT：分栏比例 90%，见 requirements L-1 Q-缺陷12）。
- 优化 13「最美观的代码配色」是否引入新 token（DESIGN DEFAULT：复用现有 `.tok-*`，不新增色板）。
