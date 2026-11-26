## 设计决策

### D1 工具条滚动抖动——方案A（用户已确认）

根因：`imageToolbar.ts` 的 document 捕获 scroll 监听（无节流）→ 每帧 rAF → 每帧 `getBoundingClientRect` 读 + 写 `left/top`，与浏览器滚动拉锯。

实施：
1. scroll 监听从 `document`（捕获）改为编辑器滚动容器（`.cm-scroller`，按 panelId 定位）+ `{ passive: true }`；保留 resize 监听。
2. 滚动判定：scroll 事件置 `scrolling=true` 并起 40ms 防抖计时；滚动期间给工具条加 `is-scrolling` class（CSS `display:none`），`scheduleReposition` 在滚动期**不执行** `positionToolbar`。
3. 防抖到期：清 `is-scrolling` → 执行一次 `positionToolbar()` → 显示。
4. 滚出视口判定改 IntersectionObserver（观察选中图片元素，`intersectionRatio === 0` 时隐藏工具条并清选中态），替代 `positionToolbar` 内的视口边界 `display` 切换判据（L768-776）。
5. 保留「文档变更时偏移漂移才重定位」路径（#1320）不变。

代价（已告知用户并接受）：滚动时工具条消失约 50ms。

### D2 裁剪清理同步化与多轮零残留

根因候选（探索报告）：`cleanup()` 的 `frame.remove()` 推迟到 rAF（防 WKWebView 残影的折衷）与新会话 `mount()` 竞态；`updateDOM` 返回 true 时旧 widget 复用导致框残留；`activeAlive()` 判死时清理分支不触发。

实施：
1. `cleanup()` 改为**同步移除**框/柄/蒙层 DOM；WKWebView 合成残影防护改用「先 `filter` 重栅格化再同步移除」的既有手段（#1493 先例），不用 rAF 推迟。
2. 新会话 `mount()` 前强制同步清扫：先调 `activeCleanup`（若存活）再兜底 `querySelectorAll` 全量清扫，保证竞态窗口关闭。
3. `updateDOM` 复用路径复核：若 widget 被复用且旧框挂在复用节点上，`toDOM/updateDOM` 前先清该节点的裁剪类与子框。
4. 首裁跳动：先跑 `cropJumpProbe` 采集（DEV），区分「1px 残影回弹」与「cropDisplayCache 未命中过渡帧」；前者若确认为跳动感知来源，改为不可见清理手段（不位移），后者扩大 cache 命中。

### D3 重置按钮条件显示

数据源：文档属性块 `{crop=...}` 解析结果（`parseImageAttributes`）。`selectImage`/`applySelection` 时读取当前选中图的 `_crop`，动态控制「重置图片」按钮的 `display`（按钮 DOM 保持常驻，切换可见性——不改 `BUTTON_SPECS` 常量结构，避免重建工具条）。放大层同口径：打开时按该图 crop 有无显示「重置图片」。

### D4 标识线必现与加载提示

`openImageCrop` 的两条静默 return（未加载等 load / 加载失败）补显式反馈：等 load 期间在图片上显示加载指示（复用既有 toast 或轻提示），加载失败提示文案。已加载（`complete && naturalWidth>0`）路径必须挂框；若挂框后发现竞态类缺失（偶发），按 D2.2 的挂载前清扫兜底。

### D5 放大层增强

1. **签名扩展**：`openImageMaximize` 增加可选参数（图片列表 [{src, alt, crop}] 与初始索引），向后兼容（缺省 = 单图模式，不显示切换控件）。
2. **多图列表来源**：编辑态由选中时从文档解析全部图片节点（装饰层已有全部图片 widget）；预览态由预览 DOM 收集全部 `figure img`。切换时更新浮层 `src` 与裁剪呈现，缩放重置为该图默认。
3. **± 与百分比**：固定步进（对齐滚轮步进的 1.1 倍数或固定 0.25 档，实现取与 `MAXIMIZE_WHEEL_STEP` 一致的最小耦合方案）；百分比显示取整；到边界禁用。
4. **tooltip**：轻量自制组件（div 气泡，`position:fixed`，出现延迟 200-300ms，移开即消，挂 body 防裁剪）；不用第三方依赖。
5. **键盘方向键**：放大层激活时左右键切换图片（须确认不与 CM6 keymap 冲突——放大层为独立浮层焦点，安全）。

### D6 预览态双击接线

预览渲染管线（`markdown.ts` postProcess 或 `PreviewView.tsx` 图片节点）给 `figure img` 绑 `dblclick` → 复用 `openImageMaximize`（带 D5 图片列表）。冲突处理：`PreviewView.tsx:617` 的容器 `dblclick`（缩放复位）须排除来自图片的事件（`closest('figure')` 判定），实现「双击图片打开放大层、双击空白复位缩放」并存。预览态 reset 动作回调由预览侧宿主提供（写回 crop 需文档写入通道——预览模式为只读渲染，reset 在预览态放大层**隐藏**或置灰，编辑态保留——简化决策：预览态不提供「重置图片」按钮，规格 delta 未要求）。

### D7 CSS 纪律

新增 `cm-*` 类名（tooltip 气泡、索引、± 按钮、加载提示）全部同步 `src/styles/` CSS（manifest 校验硬门禁）；放大层浮层注意层叠上下文（既有 overlay 已在 body，沿用）。

## 数据面

`cw-data-surface.sh new` 判定 SKIP（未命中信号）：本批按钮均为固定 UI 常量，不进配置 schema、无用户可配置项、无主题/图标/轮盘/开关改动。

## 测试缝隙

单一缝隙：浏览器层 e2e（Playwright + mock 桥 `__biaoyue_openFile__`）。断言计算样式与 DOM 计数（QG-4）：
- 多轮裁剪后 `document.querySelectorAll('.cm-image-crop-frame, .cm-image-crop-shade, .image-crop-mark')` 计数 0
- 无 crop 图片工具条中重置按钮 `display:none`，有 crop 图片可见
- 滚动进行中工具条计算样式 `display:none`，停滚后恢复并位置对齐
- 放大层 tooltip 节点出现/消失、± 点击后缩放 transform 值变化、索引文本
- 预览态双击后放大层节点存在

抖动类修复的 QG-5 证据：before/after 成对录屏或逐帧截图 + 探针测量数字（cropJumpProbe 输出）。
