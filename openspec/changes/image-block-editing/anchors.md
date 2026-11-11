# 验收锚点 — image-block-editing

锚点来源：用户 2026-11-11 口述 10 项（#649）+ 截图 1 张；design.md §1 与 D1–D10；真机证据 `.artifacts/probe/before-image-edit.txt`。

## R-1 图片块与高亮块的块手柄

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 图片块手柄的图标名 | "ImageOutlined" | #649 第 5 项 / design D9 |
| A-1.2 | exact | 高亮块手柄的图标名 | "CalloutOutlined" | #649 第 8 项 / design D9 |
| A-1.3 | exact | 图片块菜单结构动作可见 | "true" | #649 第 5 项 / design D9 |

## R-2 尺寸/对齐/描述载体

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 改尺寸后源码出现属性且无 HTML 注释 | "true" | #649 第 1 项 / design D1 |
| A-2.2 | exact | 括号路径拖宽后路径完整 | "true" | 真机复现 / design D2 |
| A-2.3 | exact | 旧 `<!--w=220-->` 文档的渲染宽度 | 220 | #649 第 1 项 / design D1 |

## R-3 选中态与工具条

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 点击后选中图片数量 | 1 | 截图 1 / design D4 |
| A-3.2 | exact | 选中态四角圆点数量 | 4 | 截图 1 / design D4 |
| A-3.3 | exact | 工具条按钮数量 | 9 | 截图 1 / #649 第 2 项 |
| A-3.4 | exact | 工具条中心与图片中心水平差（px） | 2 | 截图 1 / design D4 |
| A-3.5 | exact | 图片圆角计算样式 | "8px" | #649 第 7 项 / design-system:§5 |
| A-3.6 | exact | 双击遮罩节点数 / Esc 后节点数 | 1 | #649 第 6 项 / design D4 |

## R-4 四边/四角拖拽

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 选中后缩放手柄总数 | 8 | #649 第 1 项 / design D5 |
| A-4.2 | exact | 向右拖 120px 后图片宽度增加 | "true" | #649 第 1 项 / design D5 |
| A-4.3 | exact | 拖角后源码出现 height 属性 | "true" | #649 第 1 项 / design D5 |

## R-5 粘贴插入

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 派发含图片的 paste 后文档图片引用数 | 1 | #649 第 1 项 / design D6 |
| A-5.2 | exact | 插入引用的路径前缀 | "assets/" | #649 第 1 项 / design D6 |

## R-6 裁剪（无损显示裁剪）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 裁剪确认后图片引用 src 保持不变 | "true" | #649 第 3 项 / design D7 |
| A-6.2 | exact | 裁剪后可见尺寸小于原图 | "true" | #649 第 3 项 / design D7 |
| A-6.3 | exact | 再次打开裁剪时裁剪框还原为上次矩形 | "true" | 用户 2026-11-11 裁定 / design D7 |

## R-7 描述行

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 空描述占位文本 | "输入图片描述" | #649 第 4 项 / design D8 |
| A-7.2 | exact | 输入后写回 title | "雾山" | #649 第 4 项 / design D8 |
| A-7.3 | exact | 再次点击后描述行计算 display | "none" | #649 第 4 项 / design D8 |

## R-8 转换菜单

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 插入 CSS 行的图标名 | "CssOutlined" | #649 第 9 项 / design D10 |
| A-8.2 | exact | 对齐与缩进行 svg 数量 | 1 | #649 第 9 项 / design D10 |
| A-8.3 | state-machine | 指针滑出二级菜单后的节点数 | 0 | #649 第 9 项 / design D10 |
| A-8.4 | exact | 转为网格单元的文本长度 | 0 | #649 第 10 项 / design D10 |

## R-9 高亮块头部

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 图标右缘到标题左缘间距（px） | 2 | #566 验收条件 / 真机实测 9px |
| A-9.2 | exact | NOTE 改 emoji 后转 TIP 的卡片图标 | "💡" | #566 / #617 回归 |
