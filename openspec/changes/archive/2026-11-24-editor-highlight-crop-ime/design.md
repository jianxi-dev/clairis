# 设计 — editor-highlight-crop-ime

## D1 纯高亮与标注视觉分家（R-1）

- 渲染仍共用 `CalloutWidget`，`type === "highlight"` 时：
  - 无 `.cm-callout-header`（既有行为）；
  - 底色取 `color-mix(in srgb, <bg 色> 38%, transparent)`，明显强于标注的 10% 软色；未设色时用 tone yellow 的 30% 叠底；
  - 1px 全边框（`--callout-border`），无左边框；圆角 4px；内距 `0.2em 0.45em`，视觉上像一条马克笔色带而不是卡片；
  - 标注保持 3px 左边框 + 10% 软底 + 8px 圆角。
- 点击工具条：纯高亮的条居中于块盒（`left = rect.left + (rect.width - barWidth)/2`），图标 `HighlighterOutlined`；标注维持贴左与 `FontcolorOutlined`。
- 纯高亮颜色面板使用独立色系 `HIGHLIGHT_COLORS`（8 色相：红橙黄绿青蓝紫灰），不再直接铺 15 色 `BACKGROUND_COLORS`。面板结构（自上而下）：字体颜色（字母 A 色块 + 右上「随机」）、边框颜色（实色）、填充颜色（浅色行 + 深色行）、恢复默认。
- 「随机」：从 `HIGHLIGHT_COLORS` 里随机取一个与当前不同的色相，同时写 `bg`（浅色档）与 `border`（同色相深色档），一次事务 = 一步撤销；不改 `text`。
- 「恢复默认」：清空 `bg` / `border` / `text`。

## D2 菜单图标与标签（R-2）

- `block-convert.ts`：`CALLOUT_MARK_ITEM.icon = "HighlighterOutlined"`；标注组 `icon = "CalloutOutlined"`；`calloutAnnotationItems()` 增加 `emoji` 字段（取 `CALLOUT_ANNOTATION_TYPES[].emoji`），`BlockMenuItem` 增可选 `emoji`。
- `block-menu.ts` 的转换浮层：有 `emoji` 时渲染文本 emoji，否则回退 `renderIcon(child.icon)`，与新增菜单同一份图标。
- `floating-toolbar.ts`：`convert-callout-mark` 的 `icon` 改 `"highlighter"`；标注组保持 `"callout"`。
- `slash.ts` 的 `addHandleCommands`：标注项 `label` 由「高亮」改为「标注」。

## D3 裁剪显示同构（R-3）

- `ImageWidget` 的 `crop` 显示只保留一条路径：
  - 外盒 `span.image-crop-window`：`overflow:hidden; display:inline-block; position:relative`，尺寸 = `w*scale × h*scale`；
  - 内层 `img`：`width = w px; height = h px`（裁剪矩形自然尺寸）、`object-fit:none`、`object-position = -l -t`、`transform: scale(scale)`、`transform-origin: 0 0`。
- `scale` 的来源：
  - `width` 属性存在（语义 = 可见裁剪宽度）→ `scale = width / w`；
  - 否则测量整图当前显示宽度 → `scale = fullW / natW`（既有 `applyCropScale` 路径保留）。
- `imageCrop.ts` 的 `onConfirm` 增加第二个参数：最终显示矩形；`ContentArea.onImageCrop` 写回 `crop` 的同时把 `width/height` 写成显示矩形取整值，保证确认前后缩放不变。整图判定不变。
- 已存在的 `crop` 进入裁剪时，`enterW` 仍取可见裁剪宽度；新的写回语义使二次裁剪自洽。

## D4 IME 稳定与大文档键入（R-4）

- `createDecorationField.update`：`composing && tr.docChanged` 时返回 `decos.map(tr.changes)`，绝不返回未映射的旧集合。
- 大文档快路径：文档 ≥ 50,000 字符且事务是普通键入（`input.type`，行数不变）时，映射现有装饰并登记该事务；伴生 ViewPlugin 在最后一次快路径后 180ms 派发一次重建 effect。结构变更、选区跳转、折叠、组合结束仍立即重建。
- `findCalloutBlocks` 改为单次遍历累计行首偏移，去掉每块回扫的 O(n²)。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | `openspec/specs/editing/spec.md` | E-44 / E-48 修订、E-51 新增 | 本 change 的 spec delta |
| 存储 | `> [!highlight]{bg=… border=… text=…}`、`{crop=… width=… height=…}` | 既有属性语法 | 序列化格式不变 |
| 校验 | `callout-attrs.ts` / `image.ts` | `parseCalloutAttrs` / `parseImageAttributes` | 未知色名忽略、宽高取整 |
| 桥接 | `callout-color-panel.ts` / `imageCrop.ts` / `decorations/index.ts` | `buildHighlightColorPanel` / `onConfirm(rect, displayRect)` / `decos.map` | 单测 + e2e |
| 消费 | `callout.ts` / `block-menu.ts` / `slash.ts` / `floating-toolbar.ts` | 渲染与菜单 | 计算样式 / DOM 断言 |
| 回滚 | 无新增持久化字段 | — | 删除属性即回到默认 |
