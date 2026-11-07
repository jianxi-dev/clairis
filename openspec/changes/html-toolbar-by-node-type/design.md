# Design: 工具条按节点类型分化（H5）

沿用 E-16 与 E-19 的裁定。本文只补分化带来的新问题。

## D1 分化依据是「这个元素能表达什么」，不是标签白名单本身

判定用 `nodeKindOf(tag)`：容器类标签（div/section/article/header/footer/main/nav/ul/ol/table/figure/form）归 `block`，其余归 `text`。

未知标签落到 `text`：排版类操作（字号、粗体）在任何元素上都不至于无从下手，而给一个陌生标签加背景框更可能破坏它原本的视觉契约。误判代价小的一边才是默认。

## D2 写入必须基于「最新文档状态」，不能拿渲染期的样式算

这是实现时踩到的真 bug：勾下划线再勾删除线，下划线会消失。

原因：`onPatchStyle` 原本接收成品对象，而对象由渲染期的 `info.style` 拼出来。两次点击如果在同一帧内到达，第二次读到的是旧样式（还没含下划线），于是它写出的 `text-decoration` 只有 `line-through`。

裁定：`onPatchStyle` 改为接收 `(current) => patch` 函数，`current` 由上层在**最新 content** 上 `describeNode` 求值。按钮的显示态（`aria-pressed`）仍可用渲染期值——显示滞后一帧无害，写入错误会丢数据。

## D3 简写样式要带子属性回退

浏览器的 `CSSStyleDeclaration` 会把简写拆成子属性暴露：设了 `text-decoration: underline` 后，遍历时拿到的是 `text-decoration-line`；`border` 同理变成 `border-top-width` 等。

裁定：读样式走 `readStyle(style, key)`，`text-decoration` 回退到 `text-decoration-line`，`border` 回退到 `border-top-width`。直接读简写名会拿到空串——这正是 D2 那个 bug 的另一半原因。

## D4 删除元素的边界只有一条：html / body 不可删

删 `<body>` 等于清空整篇文档，`applyNodeRemove` 直接返回原 content。其余节点（含 `<table>`、`<figure>`）允许删除：用户明确点了垃圾桶，就是意图删除；不像「换标签」那样有结构性歧义。

## D5 链接只在 `<a>` 上出现

WorkBuddy 的链接按钮作用于选中文字（把 Range 包进 `<a>`）。我们没有字符级选区（见 non-goals）。

裁定：只有当选中元素本身就是 `<a>` 时显示 `href` 输入框；其他元素不显示链接控件。放一个点了没反应、或悄悄把整段包成链接的按钮，比没有这个按钮更糟。
