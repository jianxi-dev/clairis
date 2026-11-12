# Design: 图片块编辑态重做（image-block-editing）

## 1. 现状勘察（真机证据）

探针：Playwright Chromium + `e2e/mocks/tauri-mock.js`。原始输出 `.artifacts/probe/before-image-edit.txt`。

| 观测项 | 实测值 | 结论 |
|---|---|---|
| 图片位置 | img left=41，正文行 60–1140 | 默认左对齐 |
| 圆角 | `inset(0px round 4px)` | 4px，非卡片级 |
| 悬停工具条 | 替换/删除/定位，应用层未注入回调 | 三个死按钮 |
| 缩放手柄 | 右下角单个 10×10 | 无四边/四角 |
| 拖宽后的源码 | `![测试图片](photo.png)<!--w=220-->` | 注释写进源码 |
| 括号路径拖宽 | `![带括号](assets/image%20(1)<!--w=155-->.png)` | **文档被写坏** |
| 点击/双击 | 无选中态、无遮罩 | 缺口 |
| 块手柄 | 图片块 `FormatParagraphOutlined`，高亮块 `ReferenceOutlined` | 块型判定错 |
| #566 | emoji 跟随已修；图标-标题间距 9px | 间距未达 ≤2px |

## 2. 决策

- **D1 载体**：`![描述](src "图注"){width=… height=… align=… crop=…}`（与既有 `::: {.align-*}` 同族）。编辑态 widget 覆盖属性段；旧注释只读兼容、首次改尺寸迁移。
- **D2 路径解析**：尖括号优先、否则括号配对；写回时含空格/括号的路径用 `<...>`。
- **D3 默认居中**：独占一行的图片由 CSS 居中；显式左/右写 `align`，居中移除。
- **D4 选中态与工具条**：模块级按文档偏移存选中图；工具条 `position: fixed` 挂 body，中心对齐图片中心；装饰重建后按偏移恢复。
- **D5 四边/四角**：左右改 `width`、上下改 `height`、四角按原比例；40–2000px；松手一次 dispatch。
- **D6 写盘命令**：新增 `import_media_bytes(doc_path, base64, suggested_name)`，粘贴与后续裁剪共用；按内容去重（等长不同字节不复用）。
- **D7 裁剪**：无损显示裁剪，`crop=left,top,width,height`，可反复调整与恢复整图（用户 2026-11-11 裁定）。
- **D8 描述**：markdown title 承载，预览 `<figcaption>`；编辑态描述行占位/提交/收起。
- **D9 块型识别**：`getBlocks` 把「段落仅含一张 Image」判为 `image`、`> [!TYPE]` 判为 `callout`；手柄图标随块型。
- **D10 二级面板**：三个 flyout 统一注册关闭器、互斥、滑出/滚动即卸载；「对齐与缩进」行带图标；「转为」网格只留图标。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 菜单项图标 20px；新增图标名先注册再使用 |
| 存储 | src/editors/icons.ts | ICON_REGISTRY | 新增图标以字面名注册，键名即 `data-icon` 值 |
| 校验 | src/editors/icons.ts | hasIcon | 菜单常量每项图标名必须通过 hasIcon；单测逐项断言 |
| 桥接 | src/editors/icons.ts | renderIcon | 统一输出 20px 与 `data-icon`，未知名回退可见默认图标 |
| 消费 | src/editors/orchestration/block-menu.ts | ALIGN_INDENT_ITEMS | 数组顺序即显示顺序，每项 icon 非空 |
| 回滚 | git | revert <PR> | 纯代码改动、无新数据文件；回退后菜单与图标回到上一条款状态 |

## 3. 风险

- 属性语法在源码态可见（markdown 固有），编辑/预览不可见。
- canvas 类操作（后续裁剪）统一走字节流，避免 `asset://` 画布污染。
- 选中态依赖文档偏移，装饰重建必须按偏移恢复。
- 粘贴大图 >20MB 拒绝并提示。
