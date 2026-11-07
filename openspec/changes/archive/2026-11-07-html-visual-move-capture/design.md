# Design: 拖拽移动与区域截图（H4）

沿用 E-16 的 D1–D8 与 E-19 的 D1–D5。本文只裁定这两项的新问题。

## D1 拖拽：判定在主侧，过程在 iframe

拖拽需要两类信息：指针下的元素（只有 iframe 里有）和文档结构（主侧持有 content）。

裁定：iframe 只负责**手势**（阈值、指示线、落点计算），结束时上报一条 `moveNode {nodeId, targetNodeId, position}`；主侧 `applyNodeMove` 做结构校验与真正的移动。理由同 E-19 D3：结构变更必须过 content 纯函数，才能保证保存产物干净。

## D2 拖拽阈值 4px，且不 preventDefault 直到越过阈值

低于 4px 的位移按点击处理（否则用户点一下选元素就会误触发移动，AGENTS.md 的 UI 检查清单也点名了这条）。

越过阈值前不 `preventDefault`：文本选择与点击语义都还活着，用户反悔时松手仍是一次正常点击。

## D3 非法落点：目标是自己或自己的后代

把 `<div>` 拖进它自己的子 `<div>` 里，`insertBefore` 会让整个子树从文档里消失（节点被搬进自己内部，浏览器行为是丢弃）。裁定：`applyNodeMove` 在移动前用 `el.contains(target)` 拦截，返回原 content。

## D4 截图不另写渲染管线，复用导出 PNG 的 SVG→canvas

`src/lib/export/png.ts` 已经有 `svgFromHtml` / `rasterizeSvgToPng` / `blobToBase64`，`src/lib/export/inlineImages.ts` 已有相对图片内联。截图只是「换一个裁剪窗口」，没有理由再写一套栅格化。

裁剪方式：外层 div 定宽高 = 选区尺寸并 `overflow:hidden`，内层 div 宽 = iframe 视口宽度、`position:absolute; left:-x; top:-y`。这样内部排版与预览完全一致，只是被窗口裁掉。

## D5 body 级样式必须由 iframe 上报后复制到外层

用户文档常把关键样式写在 `body{padding/margin/background/font-family}` 上。SVG 里嵌套的 `<body>` 标签会被解析忽略，那些声明就丢了——截图会和预览长得不一样。

裁定：截图消息里带上 body 的关键计算样式（margin / padding / background-color / color / font-family / font-size / line-height），主侧把它们写到外层 div 的 inline style 上。

## D6 截图只保证内联样式与相对路径图片

SVG 作为 `<img>` 加载时，浏览器不加载外部资源：`<link rel=stylesheet>`、`@import`、CDN 字体都拿不到。这是平台限制，不是实现缺陷。

裁定：明确写进规格与文档——内联 `<style>` 与相对路径 `<img>` 保留（后者经 `inlineImages` 转 data URL），外链样式不保证。若将来需要完整保真，走「离屏 iframe + 系统截图」那条更重的路。

## D7 拖拽后不保持选中

移动会改变同标签元素的遍历序号（`tag:index`），旧 `nodeId` 失效。与其猜新 id，不如拖完清掉选中与工具条——用户要接着改，点一下即可。
