# 任务 — editor-refine-batch1

> 切片原则：每张票贯穿「schema→逻辑→UI→test」，做完用户能在界面上看到变化（QG-7）。
> 票标题前缀 `[change=editor-refine-batch1/<任务号>]`；1 任务 = 1 票。
> 排序：语义风险倒序——豆包式行手柄（最高）置首。
> 依赖：1.2 Blocked by 1.1；6.1 Blocked by 1.1（同改 `block-handle.ts`，避免冲突）；其余无依赖。
> 集成 checkpoint（QG-6，票数 8）：每完成 ≤4 票合并到集成分支跑一次四件套并浏览器打开一次，记录「用户现在能看到什么」；首个 checkpoint 在 1.1–3.1 完成后。

## 1. 豆包式行手柄（最高语义风险）

- [x] 1.1 行手柄渲染与跟行走
  - `block-handle.ts` `collectHandleSpecs`（:334）对文本行块（段落 / 列表项 / 待办 / 标题 / 引用）按可视文本行枚举 `HandleSpec`（新增 `kind: "line"`），行盒取该行 DOM rect，手柄跟行走；非文本行块（表格 / 代码块 / mermaid / html 块）保留块级手柄。`handleKeysFor`（:127）支持行键；`BlockHandlePlugin` 增量对账保持「纯内容变更只重算几何、不重建 DOM」。
  - 接线归属：本票导出 `collectHandleSpecs` / `handleKeysFor` 新签名，由本票在 `BlockHandlePlugin`（`block-handle.ts`）内接进渲染，无跨票接线。
  - AC：在 `npm run tauri dev` 打开页面，指针移入多行段落时每个可视文本行各出现一个手柄，且手柄垂直位置随所在行滚动；连续输入时手柄根节点 DOM 标识不变；表格 / 代码块不出现行级手柄。
  - e2e：`e2e/editors/line-handle-follow.spec.ts`
  - **视觉锚点**: design-system:§3
  - **数据面**: 无

- [x] 1.2 层级联动转换 + 列表外套高亮（Blocked by 1.1）
  - `block-convert.ts` 新增纯函数：`lineSubtreeRange`（行→含子级的行子树区间）、`convertLineWithChildren`（上级行转换联动子树、末级只转当前行、子级按自身层级编号规则排号）、`wrapListInCallout`（列表转高亮外套 callout、列表行保持原标记）。复用 `expandSiblingList`（:78）与 `LIST_TARGETS` 分组；转换仍经 `dispatchBlockConvert`（:244）的 `structureTransaction`，一次转换一个 undo 步。
  - 接线归属：本票导出上述纯函数，由本票在 `block-menu.ts` 的 `ACTION_ROWS` 转换动作与 `floating-toolbar.ts` 的 `convertItem` 接线（调用点替换为 `convertLineWithChildren` / `wrapListInCallout`）。
  - 单测：`src/__tests__/` 下行子树区间、2 层无序转有序的排号、末级只转当前行、列表转高亮外套结构。
  - AC：在 `npm run tauri dev` 打开页面，对两层无序列表的上级行触发「转为有序」后，1 级与 2 级都显示有序编号且 2 级按 2 级规则排号；对末级行触发转换后其兄弟与上级不变；对有序 / 无序列表触发「转为高亮」后列表外套高亮、列表标记与结构保留。
  - e2e：`e2e/editors/line-handle-convert.spec.ts`
  - **视觉锚点**: design-system:§3
  - **数据面**: 无

## 2. 图片编辑 Quiet 对标——编辑态

- [x] 2.1 编辑选中态 / 不缩小 / 描述区显隐 / 手柄缺失修复
  - `imageToolbar.ts` 编辑按钮按下态（参 `updateCropState` :555 / `setCaptionActive` :566 模式）呈选中高亮；`image.ts` `ImageWidget`（:606）编辑态保持原渲染尺寸不缩小；caption 默认隐藏、仅工具条按钮切换（`setCaptionActive` / `showCaptionInput` :415），裁剪态强制隐藏（`notifyImageCropState` :576）；先真机复现《中汽系统搭建情况对称1110.md》图片手柄偶发缺失，定位 `scanImageReference`（`image.ts:270`）/ 装饰重建时机根因后按证据修复。
  - 接线归属：本票不导出新 API，改动均在既有 `image.ts` / `imageToolbar.ts` / `imageCrop.ts` 内；描述区显隐经既有 `ImageToolbarActions` 接线。
  - AC：在 `npm run tauri dev` 打开页面，进入图片编辑态后编辑图标呈选中态且与未选中态有可测色差；编辑态图片宽度等于进入编辑前宽度（不缩小）；未点描述按钮时描述区隐藏，点击工具条按钮后切换显隐；打开含多张图片的文档逐张召唤，每张图片都出现手柄。
  - e2e：`e2e/editors/image-edit-quiet.spec.ts`
  - **视觉锚点**: design-system:§5
  - **数据面**: 无

## 3. 图片编辑 Quiet 对标——裁剪态

- [x] 3.1 裁剪角标加大 / 拖动柄图标 / 常驻 / 去「保存」文字
  - `imageCrop.ts` `HANDLE_MARK` / `HANDLE_CURSOR`（:510 起）加大角标尺寸与命中区；拖动柄改用裁剪样式图标（参 `CropOutlined`）；裁剪态常驻，单次拖动不弹回选中态（`mount` :209 状态机）；移除裁剪区下方「保存」文字（`SAVE_BUTTON_TESTID` :53 相关），保存走工具条既有双入口。
  - 接线归属：本票不导出新 API；裁剪态经既有 `openImageCrop` / `notifyImageCropState` 接线。
  - AC：在 `npm run tauri dev` 打开页面，进入裁剪态后角标尺寸大于既有默认值且命中区明显、拖动柄为裁剪样式图标；拖动裁剪边界一次后裁剪态保持、不弹回普通选中态；裁剪区下方不出现「保存」文字，保存入口在工具条。
  - e2e：`e2e/editors/image-crop-quiet.spec.ts`
  - **视觉锚点**: design-system:§5
  - **数据面**: 无

## 4. 高亮块调色入口与高亮类型行

- [x] 4.1 浮条颜色入口 + 高亮类型行（复用三色面板）
  - `floating-toolbar.ts` 点击高亮块时上方浮条出现颜色图标，点击展开三色面板（填充 / 边框 / 文字 + 恢复默认），复用 `block-menu.ts` 的 `cm-callout-color-panel`（:616 起）与 `callout-attrs.ts` `setCalloutAttrs`（:105）/ `serializeCalloutAttrs`（:81）；「高亮」转换组（`floating-toolbar.ts:456` `convert-callout-group`）顶部新增「高亮类型」单行，展开 `CALLOUT_EDIT_TYPES`（`callout-types.ts:38`，含「纯高亮」:53），选择即转换。
  - 接线归属：本票在 `floating-toolbar.ts` 接颜色动作与类型行；颜色面板复用 `block-menu.ts` 既有逻辑（提取为可复用函数则由本票在 `floating-toolbar.ts` 调用）；无跨票接线。
  - AC：在 `npm run tauri dev` 打开页面，点击高亮块后上方浮条出现颜色图标，点开三色面板可分别改填充 / 边框 / 文字，一次撤销只回退本次改色；高亮转换组顶部出现「高亮类型」行，展开含「纯高亮」，选择后块类型转换。
  - e2e：`e2e/editors/callout-color-entry.spec.ts`
  - **视觉锚点**: design-system:§6
  - **数据面**: 桥接,消费

## 5. 菜单快捷键区与圆角统一

- [x] 5.1 菜单行快捷键区 + 文件名右键菜单圆角
  - `block-menu.ts` 行渲染（:899 附近）右侧新增 kbd 显示区，无快捷键留白；`floating-toolbar.ts` 浮条与轮盘同构；`TabBar.tsx` 文件名右键菜单（:696 起）每行右侧加 kbd 区，容器圆角接入 `--menu-radius`（`editor.css:13`），移除旧小圆角字面量；行圆角走 `--menu-row-radius`（:14）。既有悬停 `title` 保留。
  - 接线归属：本票不导出新 API；kbd 样式新增于 `src/styles/editor.css`，由各菜单组件消费。
  - AC：在 `npm run tauri dev` 打开页面，打开块菜单 / 浮条 / 轮盘 / 文件名右键菜单时每行右侧出现 kbd 样式快捷键区、无快捷键行留白；文件名右键菜单容器计算圆角等于菜单圆角 token，且与块菜单容器圆角一致。
  - e2e：`e2e/editors/menu-shortcut-radius.spec.ts`
  - **视觉锚点**: design-system:§5
  - **数据面**: 消费

## 6. 附件手柄图标 + 手柄位置统一 + 有序图标还原

- [x] 6.1 附件扩展名图标 + 表格/高亮块手柄垂直居中 + 有序列表图标还原（Blocked by 1.1）
  - `blockHandleIcon`（`block-handle.ts:97`）增加 `file` 类型按引用扩展名映射（机制同 `imageMediaIcon` :79），缺失图标条目补 `src/editors/icons.ts` `ICON_REGISTRY`；表格与高亮块手柄位置改为块左侧垂直居中（`block-handle.ts` 手柄定位 / `anchorPos` / `anchorClientY`）；先复现有序列表手柄图标退化根因（:103 `/^\s*\d+\./` 判定 / `getBlocks` 首行），按证据修复。
  - 接线归属：本票导出 `blockHandleIcon` 扩展（同文件内），由本票在 `BlockHandlePlugin` 渲染路径接线；图标条目由本票补入 `ICON_REGISTRY`。
  - AC：在 `npm run tauri dev` 打开页面，附件块手柄按扩展名显示附件类图标且不等于图片图标；表格 / 高亮块手柄垂直中心与块渲染矩形垂直中心偏差 ≤ 2px、不落左上角；有序列表与无序列表手柄 `data-icon` 严格不相等。
  - e2e：`e2e/editors/handle-icon-position.spec.ts`
  - **视觉锚点**: design-system:§2; design-system:§3
  - **数据面**: 存储,校验

## 7. 附件卡多格式

- [x] 7.1 md 展开尺寸 / 滚动渐隐 + md/docx 样式面板 + docx 位置 + 空格退化
  - `fileEmbed.ts` `renderMarkdownBody`（:383）/ `FileEmbedWidget`（:454）md 默认展开、宽度=正文同宽、高度自适应 + 上限 600px + 内部滚动 + 底缘渐隐（新增 CSS，同步 manifest）；md / docx 样式调整面板（对齐 + 宽度，面板式同图片，复用 `selectEmbed` :177 选择态）；docx 显示位置（对齐）调整；定位并修复附件引用行首前导空格导致整块退化源码（`classifyFileEmbed` :89 / 引用解析）。
  - 接线归属：本票不导出新 API；样式面板经既有 `ImageToolbarActions` 同构机制接入 `fileEmbed`。
  - AC：在 `npm run tauri dev` 打开页面，打开含 md 附件的文档时 md 默认展开、宽度与正文文本块同宽、高度不超过 600px、超出部分可内部滚动且底缘有渐隐；选中 md / docx 附件打开样式面板可调对齐与宽度、docx 可调显示位置；在附件引用行首加前导空格后该引用仍保持内嵌 / 卡片渲染、不退化为源码。
  - e2e：`e2e/editors/file-embed-multiformat.spec.ts`
  - **视觉锚点**: design-system:§7
  - **数据面**: 无
