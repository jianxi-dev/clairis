# 提案 — editor-highlight-crop-ime

## 问题

#1437 汇总一次真机走查报出的 5 项缺陷，跨三个面：

1. **图片裁剪确认后区域错位**。`crop` 存在且 `width` 属性存在时，编辑态走 `object-fit:none` + `object-position:-l` 的自然像素分支，却把旧的全图显示宽度当作可见宽度；确认后盒宽与内容都不缩放，看到的区域比拖拽预览更大、更靠上。拖回整图时 `crop` 被移除，`width` 恢复全图语义，于是「又正常」。
2. **纯高亮没有和标注分家**。`[!highlight]` 只去掉了左边框，底色/圆角/内距仍与标注同族；点击块弹出的工具条不是居中、图标不是荧光笔；颜色面板没有「随机」，也没有独立色系。
3. **转换手柄菜单图标重复**。「高亮」与「标注」同为 `CalloutOutlined`；「标注」浮层的 13 类类型也全部是同一个 `CalloutOutlined`，没有复用新增菜单的 emoji。
4. **新增手柄菜单命名错误**。`addHandleCommands` 把标注命令的标签写成「高亮」。
5. **长文 IME 输入崩溃**。`createDecorationField` 在组合期收到文档变更时 `return decos`，返回的是按旧文档算出的 `DecorationSet`，没有经过 `tr.changes` 映射。视图 tile 树与文档结构错位后，`@codemirror/view` 的 `TilePointer.advance` 在 `parents.pop()` 上抛 `TypeError`，可见内容大面积消失、编辑器不可用。同时，每次键入都全量重建装饰，大文档性能无界。

## 方案

- 裁剪显示统一成一套结构：外层 `overflow:hidden` 盒 = 可见裁剪显示尺寸，内层 `img` = 整图缩放后按 `crop` 平移；保存时同步写回可见 `width/height`，让确认前后同区域同缩放。这是 `docs/research/competitors/quiet-md/media-board.md` §5.3 已定位的根修方案。
- 纯高亮独立视觉与独立色板：无左边框、1px 全边框、更强荧光底、4px 圆角；点击工具条居中并使用荧光笔图标；面板含「随机」（同色系边框+填充一起换、文字色不动）与「恢复默认」。字体色色块恢复字母 A（用户明确否决 #1423 的荧光笔字形）。
- 菜单：`高亮` 走 `HighlighterOutlined`，`标注` 走 `CalloutOutlined`；标注类型浮层改用与新增菜单同一份 emoji；新增手柄菜单的误差标签改名「标注」。
- 稳定性：组合期文档变更 SHALL 返回 `decos.map(tr.changes)`；大文档（≥50k 字符）的普通键入同样映射 + 180ms 延迟重建，避免每键全量重算。

## 影响

- 编辑态高亮块、块菜单、新增菜单、图片裁剪显示。
- 不新增 Markdown 语法；`> [!highlight]` 与 `{crop=…}` 存储格式不变。

## 非目标

- 不迁移 `crop` 为分数坐标。
- 不重画标注的 13 类 tone。
- 不做编辑器架构级的增量装饰重构（本轮只加映射快路径与延迟重建）。
