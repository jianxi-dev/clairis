# Tasks — 编辑表面第十七批修复（editor-surface-batch17）

> 切片原则：1 task = 1 用户可见交付物。Blocked by 只记「输出即输入」的真实依赖（用于避免同文件并行冲突）；同文件不同区域靠 rebase 消化。
> QG-2：每条都新增/扩展 e2e；QG-5：ui-surface 票产出 `.artifacts/<票号>/state-coverage.json`（≥4 态）。
> QG-6：16 票 ≥ 6，集成 checkpoint 在 8.1 与 12.1 之后各一次（合并到集成分支 → 构建 → 浏览器打开 → 记录用户能看到什么）。

## 1. 页签右键菜单关闭协议

依赖：无

- [ ] 1.1 页签右键菜单外点 / Esc / 失焦 / 滚动关闭
  - 粒度：用户可见交付物
  - 实现：`src/components/TabBar.tsx:213-249` 把关闭监听从单条 `window click` 扩为四条来源：`document pointerdown`（capture）、`keydown Escape`、`window blur`、`window scroll/resize`（capture）；内部判定 `target.closest(".fixed.z-50")` 改为 `target.closest("[data-tab-menu]")`；菜单 DOM 已带 `data-tab-menu`（`:454`），右键 `contextmenu` 同步注册并跳过首个事件；iframe 场景以 `window blur` + 下一次 `pointerdown` 兜底。
  - 验收：打开页面右键页签打开菜单后点击菜单外部，`[data-tab-menu]` 节点数严格等于 0；按 Esc 后为 0；切换应用触发失焦后为 0；滚动正文后为 0；四种来源各往返一次后无残留菜单节点，且点击「关闭其他」仍只关闭其它页签。
  - e2e：`e2e/tab-context-menu.spec.ts`（扩展）
  - 接线归属：`TabBar.tsx` 内完成，不新增导出。
  - 数据面：无

## 2. PDF 按钮栏快捷键在视图内生效

依赖：无

- [ ] 2.1 PDF 按钮栏固定 / 隐藏快捷键在视图内生效且可发现
  - 粒度：用户可见交付物
  - 实现：`src/App.tsx:584-590` 的 `⌘⇧D` 分支从 window 冒泡改为 `document` capture 阶段处理（复用 `:700-708` Cmd+I 既有 capture 写法），命中时 `preventDefault`；`src/components/Content/PdfViewer.tsx:156-202` 保留 `pdf:toggle-toolbar-pin` 注册并在固定按钮 `title` 补 `（⌘⇧D）`；`src/lib/shortcuts.ts:211-212` 条目保留，总览按 `shortcutsByFamily` 自动渲染。
  - 验收：打开页面进入 PDF 视图并把焦点放进 shadow DOM 控件，按 `⌘⇧D` 后宿主 class 含 `pdf-chrome-pinned-hidden`；再按不含；总览中 `mode-pdf-toolbar-pin` 行数严格等于 1；切换文档后宿主 class 不含 `pdf-chrome-pinned-hidden`。
  - e2e：`e2e/pdf-toolbar.spec.ts`（扩展）
  - 接线归属：`App.tsx` capture handler → `togglePdfToolbarPin`（`pdfToolbarPin.ts` 既有导出，本票内完成）。
  - 数据面：无

## 3. 悬停提示按配置时长显示

依赖：2.1（同改 `src/App.tsx`）

- [ ] 3.1 悬停提示按配置「提示时长」显示，移除 60 秒硬编码
  - 粒度：用户可见交付物
  - 实现：`src/components/TooltipLayer.tsx:6` 删除 `TIP_DELAY_MS = 60_000`，`:68-72` 延迟改取 `config.noticeDuration * 1000` 并钳制 100–10000ms，未配置回退 400ms；经 `src/hooks/useConfig.ts` 的 `config.noticeDuration` 透传；设置描述改为「提示信息显示时长（秒）：悬停提示与底部提示」。
  - 验收：打开页面未配置时悬停触发提示，400ms 处 `.app-tip` 节点数严格等于 1；配置 1.0 秒后 1100ms 处 `.app-tip` 节点数严格等于 1；移出指针后为 0；底部提示与悬停提示使用同一配置值。
  - e2e：`e2e/tooltip-rules.spec.ts`（扩展）
  - 接线归属：`TooltipLayer.tsx` 内完成；配置读取复用 `useConfig`。
  - 数据面：消费（`notice_duration`：字段与默认值不变，渲染层读值并钳制 100–10000ms）

## 4. 左边栏展开与固定快捷键

依赖：3.1（同改 `src/App.tsx`）

- [ ] 4.1 左边栏 `⌘\` 展开 / 隐藏 + `⌘⌥\` 固定
  - 粒度：用户可见交付物
  - 实现：`src/App.tsx:509-515` 的 `⌘\` 分支改为统一「切换可见性」：`collapsed → pinned`、`pinned/hover → collapsed`，不再在折叠态切沉浸阅读；新增 `⌘⌥\` 分支调用 store 既有 action 切换 `pinned ↔ hover`（`collapsed` 时先展开为 pinned）；`src/lib/shortcuts.ts` 新增 `global-rail-pin` 条目。
  - 验收：打开页面按 `⌘\` 后 `railState === "pinned"`；再按 `⌘\` 后 `railState === "collapsed"`；按 `⌘⌥\` 后 `railPinned === true`；再按 `⌘⌥\` 后 `railPinned === false`；折叠态按 `⌘\` 不进入沉浸阅读。
  - e2e：`e2e/reading-rail.spec.ts`（扩展）
  - 接线归属：`App.tsx` handler → `useStore` 既有 action（本票内完成）。
  - 数据面：无

## 5. 预览分栏渲染

依赖：无

- [ ] 5.1 MD 预览分栏渲染为多栏
  - 粒度：用户可见交付物
  - 实现：`src/renderers/markdown.ts:205` 同层新增 `preprocessColumnDivs`（识别 `^ {0,3}:::+\s*\{([^}]*)\}\s*$` 且属性含 `.col-N` 或 `cols=N`，N=1..6，配对闭围栏），在 `:391` `renderMarkdown` 中于 `preprocessAlignmentDivs` 后调用；`src/styles/reader.css:98` 后新增 `.preview-content .layout-col-N` 网格规则与窄视口单列折叠。
  - 验收：打开页面含 `::: {.col-2}` 的文档，预览态 `.preview-content .layout-col-2` 节点数严格等于 1；可见文本含 `:::` 次数为 0；两栏子项 x 差大于 0；不含 `col` 的 `:::` 围栏保持原样。
  - e2e：`e2e/markdown-preview-columns.spec.ts`（新增）
  - 接线归属：纯渲染预处理 + CSS，无新导出。
  - 数据面：无

## 6. 插入 CSS 图标

依赖：无

- [ ] 6.1 新增手柄菜单「插入 CSS」图标可见并有 e2e 锁定
  - 粒度：用户可见交付物
  - 实现：先按 design D6 写真实 DOM 探针；`src/editors/slash.ts:316-318` 已有 `id: "insert-css", icon: "CssOutlined"`，`:695` `renderMenu` 的 `cmd.icon` 分支经 `renderIcon` 渲染；若探针失败则修 `renderMenu` / `renderIcon` fallback 与 `src/editors/icons.ts:145` 注册表；e2e 断言永久保留。
  - 验收：打开页面空行「+」打开新增手柄菜单，`[data-cmd="insert-css"] svg[data-icon="CssOutlined"]` 节点数严格等于 1 且 `getBoundingClientRect().width > 0`；关闭菜单后为 0；探针与 e2e 各跑一次全过。
  - e2e：`e2e/block-menu.spec.ts`（扩展）
  - 接线归属：`slash.ts` 内完成。
  - 数据面：无

## 7. HTML 区块尺寸拖拽稳定

依赖：无

- [ ] 7.1 HTML 区块尺寸拖拽稳定 + guide 随边 + pointercancel 清理 + 恢复尺寸
  - 粒度：用户可见交付物
  - 实现：`src/components/Content/HtmlVisualEditor.tsx:368-390` `startResize` 在 handle 上 `setPointerCapture(e.pointerId)`，`pointermove/pointerup/pointercancel/lostpointercapture` 挂到 handle；`:393-410` guide 维护 `left/top/width/height` 四值，西侧拖拽同时更新 left 与 width；`:347-352` `applyStylePatch` 同时写 `width/height` 与 `box-sizing: border-box`；新增「恢复尺寸」按钮传 null 清除 inline 尺寸。
  - 验收：打开页面选中区块拖 e 边 100px 后宽度变化 +100±2；拖 w 边 60px 后 guide `left` 变化 -60±2；`pointercancel` 后 guide 节点数为 0；点「恢复尺寸」后元素 `style.width` 为空字符串；拖拽过程无「越拖越大」。
  - e2e：`e2e/html-visual-resize.spec.ts`（扩展）
  - 接线归属：`HtmlVisualEditor.tsx` 内完成。
  - 数据面：无

## 8. HTML 工具条当前值与图标化

依赖：7.1（同改 HTML 编辑面）

- [ ] 8.1 HTML 工具条：背景色 / 字体 / 字号当前值 / 标签图标化 / 移除截图 / 区块边框色
  - 粒度：用户可见交付物
  - 实现：`src/components/Content/HtmlEditToolbar.tsx:125-133` 补背景色（`background-color`）、字体族（`font-family`）、字号 `select` 的 `value` 取 `info.style[...]`（未知值保留为额外 option）；`:143-160` 文字标签按钮改图标按钮并保留 `aria-label` / `title`；`:337-342` 移除截图按钮（`onCapture` 从工具条删除，E-21 能力保留）；`:324-335` 区块「边框」改 `<input type="color">`，读取 / 写入 `border-color`，无边框时同时写 `border: 1px solid <color>`；`src/components/Content/HtmlRangeToolbar.tsx` 同步。
  - 验收：打开页面选中文字，背景色控件数为 1、字体族控件数为 1、字号 `select` 的 `value` 严格等于当前 `16px`；截图按钮数为 0；文字标签按钮（改写 / 链 / 截图）数为 0；选中区块后区块边框色 `input` 存在，改色后元素 `border-color` 严格等于所选值。
  - e2e：`e2e/html-edit-toolbar.spec.ts`（扩展）
  - 接线归属：`HtmlEditToolbar.tsx` / `HtmlRangeToolbar.tsx` 内完成。
  - 数据面：无

## 9. HTML 划选文字不出现拖拽幽灵

依赖：无

- [ ] 9.1 HTML 划选文字不出现白色拖拽幽灵
  - 粒度：用户可见交付物
  - 实现：`src/editors/html/runtime.ts:168-181` 拖拽启动条件加「选区必须折叠」——mousedown 后若 `getSelection()` 非空或 `selectionchange` 先于阈值发生则取消拖拽意图；`:139-165` 白色幽灵（`rgba(255,255,255,.7)`）仅在确认拖拽（超过阈值且无文字选区）后创建。
  - 验收：打开页面在 HTML 编辑态划选 10 字符，ghost 节点数严格等于 0；划选后文档长度不变；无划选时拖拽仍出现幽灵节点。
  - e2e：`e2e/html-edit-drag-capture.spec.ts`（扩展）
  - 接线归属：`runtime.ts` 内完成。
  - 数据面：无

## 10. HTML 对齐改下拉 + 两端对齐

依赖：8.1（同改 `HtmlEditToolbar` / `HtmlRangeToolbar`）

- [ ] 10.1 HTML 对齐改下拉 + 两端对齐
  - 粒度：用户可见交付物
  - 实现：`src/components/Content/HtmlEditToolbar.tsx:282-295` 的对齐按钮组改为 `select`，选项为 左 / 中 / 右 / 两端（`text-align: justify`）；`src/components/Content/HtmlRangeToolbar.tsx` 同步；文字节点与文字选区一致。
  - 验收：打开页面选中文字，对齐 `select` 数为 1、选项数为 4；选两端后计算 `text-align` 严格等于 `justify`；取消后不残留。
  - e2e：`e2e/html-edit-toolbar.spec.ts`（扩展）
  - 接线归属：`HtmlEditToolbar.tsx` / `HtmlRangeToolbar.tsx` 内完成。
  - 数据面：无

## 11. 图片宽度注释 / 对齐按下态 / 双击预览裁剪

依赖：无

- [ ] 11.1 图片宽度注释跨行不泄漏 + 对齐按下态可见 + 双击预览应用裁剪
  - 粒度：用户可见交付物
  - 实现：`src/editors/decorations/image.ts:98` 注释正则放宽为 `/^[ \t\r\n]*<!--\s*w=(\d+)\s*(?:-->|—>)/`，同步 `:110` `imageWidthCommentEnd`、`:120` `parseImageWidth`、`:423` `writeImageAttributes`（裁剪写入时无条件移除匹配注释）；`src/styles/editor.css:853` 增加 `.cm-image-toolbar button[aria-pressed="true"]` 实色高亮；`src/editors/decorations/imageToolbar.ts` 的 `openImageMaximize` 带入裁剪矩形，对 `<img>` 应用 `object-fit: none` + `object-position` + 容器尺寸。
  - 验收：打开页面裁剪跨行注释图片后，可见文本含 `<!--w=` 次数为 0；对齐按钮 `aria-pressed="true"` 且背景色与未选中态差值不为 0；双击预览后 `img` 的 `object-position` 严格等于裁剪偏移。
  - e2e：`e2e/image-crop.spec.ts`（扩展）、`e2e/image-align-anchor.spec.ts`（扩展）、`e2e/image-lightbox.spec.ts`（扩展）
  - 接线归属：`image.ts` + `imageToolbar.ts` + `editor.css` 内完成。
  - 数据面：无

## 12. 图片工具条图标 / 插入图片 / 剪切图标 / 描述

依赖：11.1（同改 `imageToolbar` / `image.ts` / `editor.css`）

- [ ] 12.1 图片工具条图标可见 + 插入图片可见 + 剪切图标通用化 + 描述按钮贴合 + 描述框默认隐藏 / 切换
  - 粒度：用户可见交付物
  - 实现：`src/editors/decorations/imageToolbar.ts:25-82` 核对 9 个按钮图标渲染，`ScissorsOutlined` 换通用剪切图形；`:397-415` 描述按钮图标文字贴合，描述框默认 `display:none`，点「添加描述」切换为编辑；`src/editors/decorations/image.ts` 核对插入图片 `naturalWidth > 0` 的 src 渲染链路。
  - 验收：打开页面选中图片，工具条 `svg` 数严格等于 9；插入图片后 `naturalWidth > 0`；描述输入框默认 `display` 为 `none`，点「添加描述」后非 `none`；剪切图标 path 与裁剪 path 不同。
  - e2e：`e2e/image-block-edit.spec.ts`（扩展）
  - 接线归属：`imageToolbar.ts` + `image.ts` 内完成。
  - 数据面：无

## 13. 转换菜单完整显示与窗口适配

依赖：无

- [ ] 13.1 转换手柄菜单默认完整显示、窗口不足缩放适配
  - 粒度：用户可见交付物
  - 实现：`src/editors/orchestration/block-menu.ts:274-296` `positionPanel` 先取可用高度 `bounds.height - 16`，菜单自然高度 ≤ 可用高度时不设 `maxHeight`；超出时按比例压缩行高至下限 28px，仍超出才启用纵向滚动；菜单宽度保持 176px。
  - 验收：打开页面默认视口下转换菜单可见行数严格等于总行数；320px 高视口下菜单 `bottom` ≤ 视口高 - 8；压缩后图标与文字尺寸不低于最小可读尺寸。
  - e2e：`e2e/block-menu.spec.ts`（扩展）
  - 接线归属：`block-menu.ts` 内完成。
  - 数据面：无

## 14. 分栏插入改 5 竖条 hover 选区

依赖：16.1（同改 `src/editors/slash.ts`）

- [ ] 14.1 分栏插入改 5 竖条 hover 选区
  - 粒度：用户可见交付物
  - 实现：`src/editors/slash.ts:1455-1520` `renderFlyout` 的 `layout: "columns"` 分支改用表格网格 `GridState` / `renderGrid` 机制（`gridKind: "columns"`，1 行 × 5 列竖向柱子，单元无文字），`mouseenter/mousemove` 按列索引选中第 1..i 根并 `data-on` 高亮，单击第 i 根插入 `::: {.col-i}`；移除旧带文字单元渲染分支。
  - 验收：打开页面展开分栏菜单，柱数严格等于 5；指针滑到第 3 根时选中数为 3；单元 `textContent` 为空；单击第 3 根插入 `::: {.col-3}` 且无残留浮层。
  - e2e：`e2e/slash-menu.spec.ts`（扩展）
  - 接线归属：`slash.ts` 内完成。
  - 数据面：无

## 15. 视频块布局

依赖：12.1（同改 `image.ts` / `editor.css`）

- [ ] 15.1 视频块可播放 / 居中 / 默认 2/3 宽 / 可调宽 + 视频手柄图标
  - 粒度：用户可见交付物
  - 实现：`src/editors/decorations/image.ts:813-871` 的 `MediaWidget` 增加 `align` / `width` 读取（复用 `parseImageAttributes`）；DOM 容器加 `data-align`、`data-media-kind`，默认 `width: 66.67%` + `max-width: 100%`，`video` 宽 100% 且 `controls`；复用 `ImageWidget` 8 个 handle 与 `applyImageSize` 调宽（40–2000px）；`src/editors/orchestration/block-handle.ts:64` `blockHandleIcon` 解析首行图片引用扩展名，video / audio 返回 `VideoOutlined` / `AudioOutlined`。
  - 验收：打开页面含视频块，`video.controls === true`；容器宽 / 行宽在 0.667±0.02；拖 handle 后宽度变化；块手柄 `data-icon` 严格等于 `"VideoOutlined"`。
  - e2e：`e2e/media-render.spec.ts`（扩展）
  - 接线归属：`image.ts` + `block-handle.ts` + `editor.css` 内完成。
  - 数据面：无

## 16. 斜杠菜单回显与逗号触发

依赖：6.1（同改 `src/editors/slash.ts`）

- [ ] 16.1 斜杠菜单删字母回显 + 逗号归一为斜杠并开菜单
  - 粒度：用户可见交付物
  - 实现：`src/editors/smart-input.ts:695` 的 `，` → `,` 归一扩展为词首 `,` / `，` → `/`（仅当前面是行首或空白，代码 / 链接 / 公式 protected ranges 不转换）；`src/editors/slash.ts:1832` `applyQuery("")` 保留返回全量列表并加回归断言；`:1026` 归一后的 `/` 走既有 `insertSlashChar` 路径打开菜单。
  - 验收：打开页面在行首输入 `,h1` 后菜单节点数严格等于 1、源码严格等于 `/h1`；`/h1` 删到 `/` 后列表行数严格等于 17；代码块内输入 `,` 不转换。
  - e2e：`e2e/slash-menu.spec.ts`（扩展）
  - 接线归属：`smart-input.ts` + `slash.ts` 内完成。
  - 数据面：无
