# Design: MD 编排层重写（E1b）

> 本文件同时是交互契约 ADR。实现必须服从这里的五条契约；任何偏离先在本文改，再改代码。

## D1 点击委托（click delegation）

**决定**：编辑器根节点 `.cm-editor` 只挂**一个** `pointerdown` 捕获监听；判定「内部/外部」用 `event.composedPath()` 是否包含已登记的活动层（菜单栈、浮层、色板、手柄）。菜单与浮层挂在编辑器容器内，不挂 `body` 级监听。

**理由**：每个浮层各自 `document.addEventListener` 会在嵌套层（菜单 → 子菜单 → 色板）互相判成「外部」而连锁关闭；`composedPath` 天然支持 shadow DOM 与 portal 渲染，把判断收敛到一个入口。

**失败后果**：浮层若改回 `body` 级监听，嵌套层会连锁关闭（豆包实测 U-07 的成因之一）；新增浮层未登记到菜单栈时，点击它会被当成外部点击而立刻收起。

## D2 菜单栈归属

**决定**：模块级单例 `MenuStack`，API 为 `push(entry): token` / `pop(token)` / `top()` / `closeAll(reason)`。`pop(token)` 幂等，重复弹出同一 token 不报错。条目携带 `element`、`onClose`、`ownerBlock`。规则：

1. **滑入即显示**：指针进入触发元素即 `push`，不等第二次事件。
2. **离栈即收**：指针离开**整个栈**（含所有已 push 的层）即全部 `pop`。
3. **不 retarget**：栈打开期间指针移到其它块，不重新 `push` 到新块；必须先离栈收起，再进入新块才重开。
4. **单一栈顶**：CM6 keymap（Esc/↑/↓/Enter）只问 `top()`，栈空时一律返回 `false`。

**理由**：豆包实测的 U-07（retarget 重开）与 F-07（滚动不消退）都源于「每层各自管理生命周期」。单栈把生命周期收敛到一处；`push` 返回 token 让每条层自证身份，`pop(token)` 因此可安全重复调用。

**失败后果**：若允许 retarget，鼠标掠过多个块会留下多个锚点互相覆盖的菜单（U-07）；若 `pop` 不幂等，离栈抖动会重复触发 `onClose`，可能把已关的层再写回一次状态。

## D3 锚点矩形来源

**决定**：所有浮层只接受 `AnchorRect = { from, to, side }`，矩形由 `view.coordsAtPos(pos, side)` 计算（块首用 `from`，块尾用 `to`）。浮层不接受调用方传 DOM 元素自行 `getBoundingClientRect()`，也不接受任意 DOM 位置。

**理由**：DOM 坐标在滚动、缩放、字体加载后会漂移；CM6 的坐标 API 已经处理了行内偏移与折行。统一入口才能在滚动时一致地重算锚点。

**失败后果**：若接受任意 DOM 位置，滚动后浮层会与锚点脱节（豆包 U-09「菜单在块上方」的成因），且各浮层各算一套坐标，无法统一在滚动时重算。

## D4 面板裁剪边界

**决定**：摆放前把 `AnchorRect` 与两个边界求交：视口 `visualViewport` 与编辑器滚动容器。规则：

1. 水平：右侧溢出先翻到锚点左侧；仍溢出再夹取到容器右缘减 8px。
2. 垂直：底部溢出先翻到锚点上方；仍溢出再在容器内滚动可用高度，最大 `min(360px, 容器高 - 16px)`。
3. 裁剪结果写入可断言的纯函数 `resolvePlacement(anchor, panelSize, viewportRect, containerRect)`，返回 `{ x, y, flippedX, flippedY }`。
4. 滚动容器 `scroll` 事件触发 `top().onClose()`（滚动即收）。
5. 窗口 `resize` / `visualViewport.resize` 重新计算，不关闭。

**理由**：豆包实测 U-03「近底部块菜单不弹出」，根因是摆放没有边界概念；把 flip 与 shift 写成纯函数，边界行为才能被单测钉死，而不是靠肉眼验收。

**失败后果**：若裁剪不可断言，靠近视口底部或右缘的菜单会被截断或整块消失（U-03 复现），且回归无法用测试拦住。

## D5 hover 门控

**决定**：`HoverGate` 统一管理「召唤与消退」：

1. 指针进入触发区后延迟 **300ms** 才 `push`（豆包 F-05：2px 即弹）。
2. 键盘输入中（打字、方向键、IME 组合中）一律隐藏，不触发 hover。
3. `pointerType !== "mouse"`（触摸/笔）不触发 hover，改由点击打开。
4. 拖拽进行中（手柄拖动、分栏 gutter 拖动）不触发 hover。
5. 指针离开立即收起；从触发区斜向移到菜单的缓冲由「进入栈内取消定时器」实现。

**理由**：豆包实测 F-05 与「远距离移动误触」都源于 hover 无门控。把门控收敛成一个模块，键盘与拖拽路径才能共享同一套抑制规则。

**失败后果**：若键盘输入中也弹手柄，打字会不断冒出浮层挡住正文；若拖拽中触发 hover，拖动块时菜单会跟着换锚点，与 D2 的不 retarget 冲突。

## D6 验收方式

按 `md-bundle/docs/doubao-editor-study/ui-gap-and-target.md` §4 目标态逐条对照：手柄 42×26 两段药丸、块菜单 236px / 行高 32px / 转为网格 10 项 / 按块型裁剪 / 顶端对齐块顶、插入菜单三入口共用、表格 hover 热点、色板字体色 9 格 + 背景色 16 格 + 恢复默认、高亮类型去重、编辑底 = 预览底、间距 4 倍数、编排 hover 召唤 + 离栈即收 + 视口夹取/翻转 + 滚动消退 + 展开缓冲、图标全站 `svg data-icon`。外加红线 5：

**红线 5（显示=源码）**：被操作块的可见文本 SHALL 严格等于源码值。

块手柄契约（验收锚点）：`42×26` 药丸，两段各 `22×22`（左块型图标、右拖拽把手），`border: 1px solid var(--app-border)`，`radius: 6px`，默认 `opacity: 0`，hover 淡入 120ms；图标按块型映射（表格 `DataSheetOutlined`、列表 `DisorderListOutlined`、高亮 `CalloutOutlined`、代码 `CodeblockOutlined`、图片 `ImageOutlined`、默认 `DragHandleOutlined`）；空行退化为单段「+」；拖拽 `pointerdown` 后整块高亮，移动超过 4px 才算拖拽，松手按目标块首重排，`doctext` 级单事务，可撤销。
