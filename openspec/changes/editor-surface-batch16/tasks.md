# Tasks — 编辑表面第三批修复（editor-surface-batch16）

> 切片原则：1 task = 1 用户可见交付物。Blocked by 只记「输出即输入」的真实依赖；同文件不同区域靠 rebase 消化。
> QG-2：除 1.1（测试基线，标 `no-ui-impact`）外每条都新增/扩展 e2e；QG-5：每条附原始输出与 `state-coverage.json`（ui-surface）。
> QG-6：19 票 ≥ 6，集成 checkpoint 在 5.1 与 12.1 之后各一次（合并到集成分支 → 构建 → 浏览器打开 → 记录用户能看到什么）。

## 1. 视频测试基线

依赖：无

- [ ] 1.1 旋转断言按逆时针验收修正 + 播放列表恢复改事件驱动
  - 粒度：用户可见交付物（no-ui-impact）
  - 实现：`e2e/video-transform.spec.ts:63` 期望改为 `rotate(270deg)` 并注释来源 `#518`/`#523`；`e2e/video-playlist-memory.spec.ts` 删除两处 `waitForTimeout(1500)`，改 `expect.poll` 等 `video[src]`，无记忆用例先用播放列表浮层出现 2 项证明列表已加载再断言仍为首项。
  - 验收：打开页面跑该 spec，连续四次旋转后 transform 含 `rotate(0deg)`；播放列表用例 `--repeat-each=5` 连跑 5 次全过，失败分支不含固定 sleep；取消/关页签后无残留 video 节点。
  - e2e：`e2e/video-transform.spec.ts`、`e2e/video-playlist-memory.spec.ts`（修改）
  - 接线归属：不新增导出，无需接线。
  - 数据面：无

## 2. 转换手柄菜单悬停与跟随

依赖：无

- [ ] 2.1 子菜单回移不消失 + 图片/表格菜单跟随指针
  - 粒度：用户可见交付物
  - 实现：`slash.ts` 导出 `cancelAnchorClose`，`block-menu.ts` 面板 `pointerenter/pointermove` 同时取消该计时器；`anchorRectAt` 对 image/table 用 handle rect 的 top/bottom 作纵向锚点。
  - 验收：打开页面悬停「在下方添加」展开子菜单后上移回父菜单，等 300ms 转换菜单节点数严格等于 1；图片块与表格块菜单的垂直中心与手柄中心相差不超过 2px；取消悬停后菜单关闭且无残留浮层。
  - e2e：`e2e/block-menu.spec.ts`（扩展）
  - 接线归属：`block-menu.ts` 内部调用 `slash.ts` 新导出（本票内完成）。
  - 数据面：无

## 3. 拖动手柄移动块

依赖：2.1（复用 `cancelAnchorClose`）

- [ ] 3.1 拖块落点指示与松手移动
  - 粒度：用户可见交付物
  - 实现：复用 `block-handle.ts:589-668` 拖拽 + `moveBlock`；拖拽期间渲染 2px 插入指示线（目标块上/下沿）；开始拖拽即清菜单关闭计时器。
  - 验收：打开页面把第 3 段手柄拖到第 1 段上方，拖拽过程中指示线节点数严格等于 1，松手后源文本不含原段落且顺序变化；取消拖拽（Esc）后顺序不变且无残留指示线。
  - e2e：`e2e/block-handle.spec.ts`（扩展）
  - 接线归属：`block-handle.ts` 内完成，不新增对外 API。
  - 数据面：无

## 4. 全屏按钮栏自动浮现

依赖：无

- [ ] 4.1 全屏下指针滑入按钮区显示按钮栏与浮层
  - 粒度：用户可见交付物
  - 实现：`VideoPlayer.tsx:1156-1164` 的 `fitObserver` 加 `if (!art.fullscreenWeb)` 守卫，避免覆盖 `art-fullscreen-web` 的 100% 尺寸。
  - 验收：打开页面进入全屏后把指针移到屏幕底部按钮区，`.art-control-show` 出现且倍速浮层节点数严格等于 1；退出全屏后容器尺寸恢复且不含 letterbox；取消悬停 3 秒后按钮栏收起、无残留浮层。
  - e2e：`e2e/video-controls.spec.ts`（扩展；真机另跑 `npm run tauri dev`）
  - 接线归属：`VideoPlayer.tsx` 内完成。
  - 数据面：无

## 5. 块宽度统一

依赖：无

- [ ] 5.1 预览引用块与编辑引用/代码块宽度对齐文本块
  - 粒度：用户可见交付物
  - 实现：`reader.css` 引用块 `max-width: calc(var(--type-measure) + 2em + 2px)`；`editor.css` `.cm-line.cm-quote` 与 `.cm-line.cm-fenced-code` 按 D5 补偿。
  - 验收：打开页面同一文档，预览态引用块文字列宽度与相邻段落相差为 0；编辑态引用块与代码块文字列宽度与普通行相差为 0；取消选中后宽度不残留变化。
  - e2e：`e2e/editor-display-parity.spec.ts`（扩展）
  - 接线归属：纯 CSS，无新导出。
  - 数据面：无

## 6. 字体对齐

依赖：无

- [ ] 6.1 编辑/预览字体与 md-bundle 预览一致，等宽统一
  - 粒度：用户可见交付物
  - 实现：`editor.css` 行内代码/引用标记/代码标记统一 `var(--type-font-mono)`；其余栈保持（实测已同 md-bundle reader）。
  - 验收：打开页面同一文档，编辑态与预览态正文 `font-family` 计算值严格相等；编辑态行内代码与围栏代码 `font-family` 严格相等且等于预览 `code` 的计算值；取消聚焦后不变。
  - e2e：`e2e/editor-display-parity.spec.ts`（扩展）
  - 接线归属：纯 CSS，无新导出。
  - 数据面：无

## 7. 编辑态公式

依赖：无

- [ ] 7.1 编辑态行内与块级公式可见
  - 粒度：用户可见交付物
  - 实现：新建 `src/editors/decorations/math.ts`（仿 `mermaid.ts`），KaTeX widget + 两态；接入 `buildDecorationSet` 与 `EditorDecorationsOptions`，受能力开关门控。
  - 验收：打开页面含 `$E=mc^2$` 与 `$$\\int_0^1 x dx$$` 的文档，非活跃块 `.katex` 节点数严格等于 2；光标进入块后显示源码且 `.katex` 数减少；取消后无残留 widget。
  - e2e：`e2e/math-editor.spec.ts`（新增）
  - 接线归属：`ContentArea.tsx` 注入渲染函数（本票内完成）。
  - 数据面：无

## 8. 编辑态代码高亮

依赖：无

- [ ] 8.1 围栏代码按语言高亮
  - 粒度：用户可见交付物
  - 实现：`setup.ts:122` 传 `codeLanguages`（函数式），别名对齐 `renderers/highlight.ts`。
  - 验收：打开页面含 ```` ```js ```` 的文档，编辑态围栏内 `.tok-keyword` 节点数 ≥ 1；切换语言为 ```` ```python ```` 后 token 仍存在；取消编辑态后不残留 token class。
  - e2e：`e2e/editor-display-parity.spec.ts`（扩展）
  - 接线归属：`setup.ts` 内完成。
  - 数据面：无

## 9. Pele 两态一致性

依赖：无

- [ ] 9.1 预览与编辑态 mermaid 都由 Pele 出图
  - 粒度：用户可见交付物
  - 实现：核查 `renderAll` / `renderAllStatic` 两路径与 `--pele-*` 变量映射；发现缺失就地修，不改引擎路径。
  - 验收：打开页面含 ` ```mermaid ` 的文档，预览态与编辑态各恰好 1 个 `<svg>`；两态 `--pele-*` 变量值严格相等；取消切换后无叠加 svg。
  - e2e：`e2e/mermaid-editor.spec.ts`（扩展）
  - 接线归属：不新增导出。
  - 数据面：无

## 10. 表格选择网格

依赖：无

- [ ] 10.1 滑入任意格选中左上到指针的矩形且流畅
  - 粒度：用户可见交付物
  - 实现：`paint` 改增量对称差；`enterGrid` 复用已开网格；补 `mousemove` + rAF 合并。
  - 验收：打开页面插入菜单打开表格网格，指针滑到第 3 行第 4 列时 `data-on` 格子数严格等于 12；从第 3 行第 4 列直接滑到第 1 行第 1 列，选中格数变为 1；单击插入 3×4 表格，取消后无残留网格。
  - e2e：`src/__tests__/editor/slash.test.ts`（扩展）+ `e2e/slash-menu.spec.ts`（扩展）
  - 接线归属：`slash.ts` 内完成。
  - 数据面：无

## 11. 分栏横向 5 栏

依赖：无

- [ ] 11.1 分栏菜单改为 5 个横向栏目
  - 粒度：用户可见交付物
  - 实现：`SlashCommand.layout = "columns"`；`renderFlyout` 特判渲染 5 等宽横格 + hover/click。
  - 验收：打开页面展开「分栏」，横向单元数严格等于 5；指针从左滑到第 4 格时该格高亮且仅 1 格高亮；单击第 4 格插入 `::: {.col-4}` 且取消后无残留浮层。
  - e2e：`src/__tests__/editor/slash.test.ts`（扩展）+ `e2e/slash-menu.spec.ts`（扩展）
  - 接线归属：`slash.ts` 内完成。
  - 数据面：无

## 12. Markdown 打印

依赖：无

- [ ] 12.1 打印入口与打印版式
  - 粒度：用户可见交付物
  - 实现：新增 `src/styles/print.css`；`paneHeaderMenu` 增「打印」；`PaneTreeView` handler 调 `window.print()`；`capabilities/default.json` 加 `core:webview:allow-print`。
  - 验收：打开页面点「打印」，`window.print` 被调用 1 次且打印样式表已加载；打印态下顶栏/页签/工具条 `display` 为 `none`；表格/图片/代码块 `break-inside` 为 `avoid`；取消打印后页面布局不含残留类。
  - e2e：`e2e/export-menu-order.spec.ts`（扩展）+ `e2e/print.spec.ts`（新增）
  - 接线归属：菜单项 → handler（本票内完成）。
  - 数据面：无

## 13. 图片描述行

依赖：无

- [ ] 13.1 描述按钮打开图片下方输入并持久化回显
  - 粒度：用户可见交付物
  - 实现：`ContentArea.onImageComment` 改调 `enterCaptionEdit`；blur 视作保存；已有 title 点击进入编辑并回填；`icons.ts` 加「文本+笔」图标。
  - 验收：打开页面选中图片点描述，出现 `input` 且不再插入 `> 评论：`；输入「示意图」回车后 markdown 含 `"示意图"`，重开文档回显该文字；再次点击描述可编辑且原值回填；取消（Esc）后不写入且无残留输入框。
  - e2e：`e2e/image-block-edit.spec.ts`（扩展）
  - 接线归属：工具条按钮 → 描述行编辑（本票内完成）。
  - 数据面：无

## 14. 图片裁剪正确性

依赖：无

- [ ] 14.1 裁剪无泄漏/无空白/方向正确/控制点有标识/二次保存生效
  - 粒度：用户可见交付物
  - 实现：宽度注释正则接受 `-->` 与 `—>`；写回前剥离尾部旧注释；左/上符号改 `+ dx`/`+ dy`；8 个控制点加裁剪角标与方向光标；实现矩形本体拖动。
  - 验收：打开页面裁剪后编辑态可见文本不含 `<!--w=`，图片下方空白高度不超过 8px；拖左上角向右下时裁剪宽度变小且方向与指针一致；6 个以上控制点的 `cursor` 为 `nwse-resize`/`nesw-resize`/`ew-resize`/`ns-resize` 之一；再次打开裁剪并拖动矩形本体后保存，markdown 中 crop 值等于新矩形；取消裁剪后无残留浮层。
  - e2e：`e2e/image-block-edit.spec.ts`（扩展）
  - 接线归属：`imageCrop.ts` + `image.ts` 内完成。
  - 数据面：无

## 15. 图片对齐与锚点

依赖：无

- [ ] 15.1 默认居中、工具条显示对齐态、锚点缩放不进裁剪
  - 粒度：用户可见交付物
  - 实现：`ImageWidget` 应用 `data-align`（默认 center）；工具条按 align 标 active；锚点一律走 `beginResize`，裁剪只从浮层进入。
  - 验收：打开页面新插入图片，编辑态容器 `text-align` 为 `center` 且工具条居中按钮 `aria-pressed` 为 `true`；切到左对齐后仅左按钮为 `true`；已裁剪图选中后拖角部锚点，裁剪浮层节点数为 0 且图片宽高变化；取消选中后无残留高亮。
  - e2e：`e2e/image-block-edit.spec.ts`（扩展）
  - 接线归属：`image.ts` + `imageToolbar.ts` 内完成。
  - 数据面：无

## 16. 图片双击预览浮层

依赖：无

- [ ] 16.1 双击预览支持缩放/拖动/捏合/旋转/下载/原尺寸
  - 粒度：用户可见交付物
  - 实现：扩展 `imageToolbar.ts` 的预览浮层：滚轮 1.1 步进（1..8）、放大后拖动、两指捏合、旋转 90°、下载、恢复原始尺寸。
  - 验收：打开页面双击图片，滚轮放大后 `scale` 严格大于 1；放大后在边界外拖动，平移量变化且不超过边界；点旋转一次 `rotate` 为 90°；点原尺寸后 `scale` 为 1；下载与关闭按钮各触发 1 次且 Esc 关闭后无残留浮层。
  - e2e：`e2e/image-block-edit.spec.ts`（扩展）
  - 接线归属：`imageToolbar.ts` 内完成。
  - 数据面：无

## 17. 图片圆角

依赖：无

- [ ] 17.1 两态四角统一 12px 弧形
  - 粒度：用户可见交付物
  - 实现：新增 `--reader-image-radius: 12px`，预览 `img` 与编辑态 `clipPath` 同步。
  - 验收：打开页面同一图片，预览态四个角 `border-radius` 严格等于 12px；编辑态 `clipPath` 含 `12px`；取消选中后四角半径不变。
  - e2e：`e2e/image-block-edit.spec.ts`（扩展）
  - 接线归属：纯 CSS + widget 内联样式。
  - 数据面：无

## 18. 图片手柄图标与菜单

依赖：3.1（菜单顺序与拖拽共存）

- [ ] 18.1 图片手柄图标为图片，菜单顺序为对齐缩进/剪切/复制/删除
  - 粒度：用户可见交付物
  - 实现：确认 `blockHandleIcon("image") === "ImageOutlined"` 并在真机可见；图片块菜单顺序固定为 对齐与缩进 → 剪切 → 复制 → 删除，去掉上移/下移。
  - 验收：打开页面滑入图片块手柄，手柄内 `svg[data-icon]` 严格等于 1 且为图片图标；菜单文本顺序为「对齐与缩进、剪切、复制、删除」；取消悬停后菜单关闭且无残留。
  - e2e：`e2e/block-handle.spec.ts`（扩展）
  - 接线归属：`block-handle.ts` + `block-menu.ts` 内完成。
  - 数据面：无

## 19. 任务图标

依赖：无

- [ ] 19.1 任务方框图标改为方框内打勾
  - 粒度：用户可见交付物
  - 实现：`TodoOutlined` path 换为方框+勾（复用 `ui/icons.ts:523-526`）；`.cm-task-checkbox` `border-radius: 3px`。
  - 验收：打开页面含任务列表的文档，编辑态复选框 `border-radius` 严格等于 3px；手柄与插入菜单的任务图标渲染为方框内带勾；取消选中后不变形、无残留。
  - e2e：`e2e/block-decorations.spec.ts`（扩展）+ `src/__tests__/editor/block-handle.test.ts`（保持图标名）
  - 接线归属：`icons.ts` + `editor.css` 内完成。
  - 数据面：无
