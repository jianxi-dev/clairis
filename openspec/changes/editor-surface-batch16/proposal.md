# Proposal: 编辑表面第三批修复（editor-surface-batch16）

## Why

用户 2026-11-13 提交一批补充反馈，集中在四个表面：

- **测试基线失真**：`video-transform` 连续四次旋转稳定失败（实测为 `#523` 按 `#518` 验收改成逆时针后，e2e 仍断言顺时针的陈旧断言）；`video-playlist-memory` 用固定 1500ms sleep 等异步 `switchUrl`，表现为时序 flaky。两者都让「全绿」失去信号价值。
- **MD 编辑表面**：转换手柄滑入子菜单后回移会消失；图片/表格的转换菜单不跟随鼠标；手柄不能拖动块；全屏下按钮区不自动浮现；引用块/代码块两态宽度与文本块不齐；字体与 md-bundle 预览不一致；编辑态公式不显示、代码块不高亮；Pele 图表在预览与编辑态不统一；表格选择与分栏插入的手感不达标；缺少打印。
- **图片块**：描述按钮插成了引用块、输入不落盘也不回显；裁剪后下方出现长空白并漏出 `k<!--w=811—>`；左上角拖动方向相反；控制点没有裁剪语义；二次裁剪不按新区域保存；编辑态默认不居中、工具条不显示对齐态；双击预览缺无极缩放/超界拖动/捏合/旋转/下载/原尺寸；下两角圆角不足；图片手柄图标与菜单结构仍不对。
- **图标语义**：任务列表方框图标不是「方框内打勾」。

这批问题里，图片相关的多条在 `image-block-editing` 归档后仍未修好，说明现有测试只断言节点存在、不覆盖往返与手势，需要在交付时补上能真正失败的断言。

## What Changes

1. 视频测试基线：旋转断言按逆时针 90°（#518 验收）修正；播放列表恢复改为事件驱动等待，删除固定 sleep。
2. 转换手柄：滑入子菜单后指针回移不关闭；图片/表格转换菜单按指针横向位置定位，与标题/文本块一致。
3. 转换手柄拖动：按住手柄可把当前块移动到同文档其它位置，落点有插入指示。
4. 全屏：全屏下指针滑入按钮区即显示按钮栏与其浮层，与未全屏一致。
5. 块宽度：预览态引用块宽度等于文本块；编辑态引用块与代码块宽度等于文本块。
6. 字体：编辑态与预览态的标题、正文使用 md-bundle 预览一致的字体族。
7. 编辑态渲染：行内/块级公式可见；围栏代码块按语言高亮。
8. 图表：预览态与编辑态统一用 Pele 渲染 mermaid，主题跟随。
9. 插入菜单·表格：指针从任意位置滑入都选中「左上第一格→指针」的矩形区域，滑动流畅，单击插入。
10. 插入菜单·分栏：改为 5 个横向栏目，指针从左横向滑入选中，单击插入。
11. 打印：Markdown 支持打印，产出适合日常办公纸张的版式。
12. 图片·描述：工具条描述按钮改为在图片下方展开可编辑的描述输入，提交后写入并再次点击回显；图标改为「文本+笔」。
13. 图片·裁剪：消除裁剪后下方长空白与 `k<!--w=811—>` 泄漏；修正左上角方向；控制点显示裁剪标识与方向光标；二次裁剪按新区域保存。
14. 图片·对齐：编辑态新建图片默认居中，工具条高亮当前对齐方式。
15. 图片·双击预览：支持无极缩放、超界后拖动、捏合、旋转、下载、恢复原始尺寸。
16. 图片·圆角：图片下两角同为弧形，半径加大。
17. 图片·手柄：转换手柄使用图片图标；菜单项含缩进与对齐、剪切、复制、删除且排在下方。
18. 图片·缩放：单击选中后拖动锚点调整尺寸，不进入裁剪。
19. 任务图标：任务列表方框图标改为方框内带打勾。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `editing`：E-8 两态同貌的宽度/字体/公式/代码高亮；E-17 手柄菜单悬停稳定与跟随鼠标、手柄拖动移块；E-11 图片手柄图标与菜单结构、任务方框图标；块菜单插入入口的表格/分栏交互；图片描述、裁剪、对齐与缩放锚点。
- `reading`：预览态引用块与文本块等宽；预览字体对齐 md-bundle；预览图片四角 12px 圆角。
- `export`：新增 EX-7 Markdown 打印。

> `diagram-rendering` 不改：D-6 已要求编辑态出图，实测两态都走 Pele（预览 `renderAll`、编辑 `renderAllStatic`），本批只做一致性核查与断言锁定。

## Impact

- 代码：`src/editors/decorations/{index,quote,code,image,imageCrop,math,diagram,table}.ts`、`src/editors/orchestration/{block-menu,block-handle,insert-menu,block-drag}.ts`、`src/editors/block-model.ts`、`src/editors/setup.ts`、`src/renderers/markdown.ts`、`src/components/Content/VideoPlayer.tsx`、`src/styles/{editor,preview,tokens}.css`、`src/editors/icons.ts`
- 测试：`e2e/{video-transform,video-playlist-memory,image-block-edit,image-context-menu,block-menu,block-handle,table-decorations,mermaid-editor,markdown-structural-tags}.spec.ts` 扩展；新增打印、描述、拖拽移块的 e2e；单测覆盖裁剪矩形与描述序列化。
- 依赖：无新增运行时依赖（Pele 已在仓库内）。
- 数据面：不新增配置字段；图片描述沿用现有属性语法。
