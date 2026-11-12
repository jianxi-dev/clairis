# Proposal: 图片块编辑态重做（image-block-editing）

## Why

用户 2026-11-11 口述 10 项，其中图片 7 项是能力缺口：图片在编辑态只能看，不能居中、不能粘贴、不能选中、不能调尺寸、不能加描述。尺寸持久化用的 `<!--w=N-->` 还会**写坏文档**——真机复现：路径含括号时注释被插进图片 URL，`![带括号](assets/image%20(1)<!--w=155-->.png)`，图片裂开且行尾漏出 `.png)`。

另外 3 项是规格内行为的回归：转换菜单的图标补齐与二级菜单隐藏（A-8.1–A-8.4）用户已反馈 4 次仍未生效；高亮块的块手柄错显引用图标、卡片图标与标题间距实测 9px（#566 验收条件要求 ≤2px）。

## What Changes

1. 图片块识别：独占一行的图片识别为 image 块、`> [!TYPE]` 识别为 callout 块；手柄取 `ImageOutlined` / `CalloutOutlined`；图片块菜单不再显示「转为」网格。
2. 尺寸/对齐/描述载体：弃 `<!--w=N-->`，改用 `![描述](src "图注"){width=920 height=600 align=center crop=…}`；编辑态 widget 覆盖属性段；旧注释只读兼容并在首次改尺寸时迁移；路径解析支持尖括号与括号配对。
3. 选中态与工具条：点击出选中态（四角圆点）+ 图片上方居中工具条（AI / 裁剪 / 评论 ｜ 左/中/右 ｜ 剪切/复制/删除）；圆角 8px；双击最大化。
4. 四边拖拽改尺寸：左右改宽、上下改高、四角等比，松手写属性。
5. 粘贴插入：paste 处理器读剪贴板图片 → base64 → 新 Tauri 命令写入文档同级 `assets/` → 插入语法。
6. 裁剪（无损显示裁剪）：拖出裁剪框只显示该区域，原图与引用不变，可反复调整。
7. 描述行：图片下方占位「输入图片描述」，提交写 title，再次点击收起。
8. 转换菜单：插入 CSS / 缩进与对齐及子项图标补齐；三个二级面板注册、互斥、滑出即卸载、滚动关闭；「转为」网格去文字只留图标。
9. 高亮块：图标与标题间距 ≤2px；保留类型切换时图标跟随。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `editing`：图片块的尺寸/对齐/描述语法与编辑交互、块手柄图标语义、块菜单图标与二级菜单生命周期、高亮块头部间距。

## Impact

- 代码：`src/editors/decorations/{image,imageToolbar,index}.ts`、`src/editors/{block-model,icons}.ts`、`src/editors/orchestration/{block-handle,block-menu}.ts`、`src/components/Content/ContentArea.tsx`、`src/renderers/markdown.ts`、`src/styles/editor.css`、`src-tauri/src/commands/file.rs`、`src-tauri/src/lib.rs`
- 测试：`e2e/{image-block-edit,media-render,block-handle,block-menu,block-menu-batch14,callout-columns}.spec.ts`；单测 `src/__tests__/editor/*`
- 数据：旧 `<!--w=N-->` 文档保持可读，不回写、迁移惰性发生
