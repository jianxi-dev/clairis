# Proposal: 编辑表面第十七批修复（editor-surface-batch17）

## Why

用户 2026-11-13 提交 12 条编辑表面反馈（spec issue #752）。逐条实读代码后确认：多数不是新功能缺失，而是**已声称完成的行为在真实链路上不成立**——batch16 把「分栏 hover」「图片注释清理」「菜单完整显示」标成完成，但用户打开仍是旧行为。根因集中在三类：

- **关闭协议不全**：页签右键菜单只监听 `window` 的 `click`，没有 `pointerdown`/Esc/blur/scroll；点进 iframe 收不到。
- **配置与实现脱节**：悬停提示延迟硬编码 60 秒，与设置里的「提示时长」无关联；PDF 按钮栏快捷键只在理想焦点下生效；左边栏 `⌘\` 在折叠态被让给沉浸阅读。
- **手势与渲染链路缺证据**：HTML 区块缩放无 pointer capture/pointercancel 清理、guide 的 left/top 不随西侧拖拽；拖拽幽灵是白色块，划选文字时误触发；图片宽度注释只匹配同行；双击预览不应用裁剪；视频块没有布局属性；分栏插入仍是带文字的可点单元。

## What Changes

1. **页签右键菜单**：改用共享关闭协议（pointerdown capture + Esc + blur + scroll/resize），内部判定改 `closest("[data-tab-menu]")`，iframe 场景以失焦兜底关闭。
2. **PDF 按钮栏快捷键**：`⌘⇧D` 在 PDF 视图内部（shadow DOM 焦点）也生效；在快捷键总览与设置页可见。
3. **悬停提示**：`TooltipLayer` 读取配置里的「提示时长」（0.1–10 秒，默认回退 0.4 秒），不再硬编码 60 秒；设置文案说明它同时作用于悬停提示。
4. **左边栏**：`⌘\` 始终切换展开/隐藏（折叠 ↔ 钉住），不再被沉浸阅读抢占；新增 `⌘⌥\` 切换 pin；pin 按钮保留。
5. **预览分栏**：`renderMarkdown` 增加 `::: {.col-N}`（兼容 `cols:`）预处理为 `.layout-col-N`，`reader.css` 补多栏样式；两态同貌。
6. **插入 CSS 图标**：用真实 DOM 探针确认 `+` 手柄与「在下方添加」菜单的 `insert-css` 行有可绘制 `svg[data-icon="CssOutlined"]`；缺失即补齐，e2e 锁定。
7. **HTML 编辑态**：缩放改 pointer capture + pointercancel/blur 清理，guide 随边更新，新增「恢复尺寸」；工具条补背景色/字体族、字号字体显示当前值、标签图标化、移除截图；区块「边框」改为边框色选择（改该区块自身 `border-color`）；划选文字不启动白色拖拽幽灵；对齐改下拉并新增两端对齐。
8. **图片**：宽度注释检测跨行；对齐按下态可见；双击预览应用裁剪；验证图标与图片 src 渲染链路；剪切图标换通用样式；描述按钮图标文字贴合，描述框默认隐藏、点「添加描述」切换。
9. **转换菜单**：默认完整显示全部项；窗口不足时按可用高度缩放行高（保留最小可读行高），不靠滚动裁切。
10. **分栏插入**：改为 5 根竖向柱子，指针从左滑过即选 N 栏（复用表格 hover 网格），无文字标签，单击插入。
11. **视频块**：容器支持 `data-align`、默认 2/3 宽、可拖拽调宽，video 可播放；块手柄按扩展名显示视频图标。
12. **斜杠菜单**：输入 `,`（半角/全角）归一为 `/` 并打开菜单；删字母回空查询恢复完整列表并加回归锁定。

13. **页签空白双击**：双击页签栏空白切换窗口全屏/还原；「更多」菜单第一项为「新建文件」。
14. **页签右键菜单文件动作**：新增导出、打开文件位置、刷新，按用户指定顺序排列。
15. **嵌入视频**：MD 与 HTML 的嵌入视频正常显示播放；修复内嵌控件音量/进度滑块被白块覆盖。
16. **图片工具条贴边**：图片滚出视口时工具条不越窗（贴边或隐藏）。
17. **图片内联裁剪**：裁剪改为图片上直接拖框，无弹窗与按钮，拖回原位恢复；修正裁剪区域不符与下方空白。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `editing`：E-6/E-11/E-19/E-22/E-24/E-26/E-27/E-28/E-29/E-30 修订；新增 E-32..E-37（HTML 缩放稳定、HTML 工具条当前值与图标化、视频块布局、图片描述默认隐藏、斜杠菜单回显与逗号触发、菜单完整显示与窗口适配）。
- `navigation`：页签右键菜单关闭协议；左边栏快捷键展开/固定。
- `reading`：PDF 按钮栏快捷键在视图内生效；预览态分栏渲染。
- `configuration`：提示时长同时约束悬停提示的显示时机。

## Impact

- 代码：`src/components/TabBar.tsx`、`src/components/ContextMenu.tsx`、`src/components/TooltipLayer.tsx`、`src/components/Content/PdfViewer.tsx`、`src/App.tsx`、`src/lib/shortcuts.ts`、`src/lib/railView.ts`、`src/stores/index.ts`、`src/renderers/markdown.ts`、`src/styles/reader.css`、`src/styles/editor.css`、`src/editors/slash.ts`、`src/editors/smart-input.ts`、`src/editors/orchestration/{block-handle,block-menu}.ts`、`src/editors/decorations/{image,imageToolbar}.ts`、`src/editors/block-model.ts`、`src/components/Content/{HtmlVisualEditor,HtmlEditToolbar,HtmlRangeToolbar}.tsx`、`src/editors/html/{runtime,edit}.ts`。
- 测试：扩展 `e2e/{tab-context-menu,pdf-toolbar,tooltip-rules,reading-rail,block-menu,html-visual-resize,html-edit-toolbar,image-crop,image-align-anchor,image-lightbox,media-render,slash-menu}.spec.ts`；新增 `e2e/markdown-preview-columns.spec.ts`。
- 数据面：不新增配置字段；复用 `notice_duration`，并让快捷键注册表在设置/总览可见（见 design「## 数据面」）。
- 依赖：无新增运行时依赖。
