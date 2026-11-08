# Tasks: 外壳与媒体交互（第八批）

> 垂直切片：每条任务都能单独交付并在页面上看到结果。
> 依赖：见每节「依赖」行。同文件交集决定串行（不是功能依赖）。
> 反馈编号对应用户 2026-11-08 第三次走查的 8 项。

## 1. 主题弹层生命周期与状态栏主题入口

依赖：无

- [x] 1.1 主题弹层不再在指针到达前关闭；单击图标循环切换主题；补齐关闭途径与可访问性；沉淀「悬停浮层生命周期」规则

  实现要点：
  - `components/StatusBar.tsx`：关闭定时器改为「进入面板/桥接区即取消」，离开面板与触发器并集后再排期；弹层与按钮之间加透明桥接覆盖 6px 间隙，消除死区。
  - 关闭途径：选中项、外部 `pointerdown`（面板与触发器双 `contains()` 守卫）、`Esc`、滚动/尺寸变化、卸载清理。
  - 底部隐藏态：`App.tsx` 的 footer `onPointerLeave` 不得在指针移向弹层时卸载状态栏；必要时把「临时显现」改为不卸载（保留 DOM，仅切显隐）。
  - 单击 `theme-entry` 循环 `system → light → dark → warm → system`；悬停仍打开面板；面板项点击设为该项。面板打开时点击图标同样循环、面板保持并高亮新项。
  - 触发器 `aria-haspopup` / `aria-expanded`；面板 `role="menu"`，项 `role="menuitemradio"` + `aria-checked`。
  - 宽度面板补外部点击与 `Esc` 关闭。
  - 新增 `docs/design/approved/popup-lifecycle/spec.md`（六条生命周期规则）；`docs/agents/ui-test-matrix.md` 增「弹层」状态列。
  - 测试：扩展 `e2e/status-bar-visibility.spec.ts` —— 分步移动（按钮 → 跨间隙 → 面板）后点击「暗色」，断言面板仍可见、根节点 `dark`；连续点击四次断言主题轮转；`Esc`/外部点击关闭；隐藏态（双击隐藏后底部热区唤出）下同样可用；断言 `aria-*` 与 `role`。状态覆盖见 `docs/agents/ui-test-matrix.md#弹层`。

## 2. 图片右键菜单

依赖：无（新增独立组件，不与其他票同文件）

- [x] 2.1 预览区右键图片改为应用自绘菜单，渲染不等 IPC

  实现要点：
  - 新增应用内右键菜单渲染路径（portal + 与 1.1 同一套关闭逻辑）；`Content/PreviewView.tsx` 的图片预览容器绑定 `contextmenu`，`preventDefault` 后**同步** `setState`，不 await 任何 `invoke`。
  - 菜单项：打开所在文件夹（`reveal_in_finder`）/ 另存为…（`save_binary_as_file`）/ 复制文件路径（`navigator.clipboard.writeText`）/ 关闭预览。无路径时相应项禁用。
  - 关闭：选一项、外部 `pointerdown`、`Esc`、滚动、切换文件。
  - 测试：新增 `e2e/image-context-menu.spec.ts` —— 用延迟 500ms 的 `invoke` 桩断言菜单在 IPC 未完成时已可见（证明不阻塞）；四项可见；外部点击/`Esc` 后菜单隐藏且页面无残留浮层；验证 `.spec.ts` 通过。

## 3. 页签右键菜单「关闭其他」图标

依赖：无

- [x] 3.1 重绘「关闭其他」图标为单一叉 + 短横线

  实现要点：
  - `ui/icons.ts` 的 `closeOthers`：改为一个实心叉（两条交叉描边）+ 右侧两条短横线；去掉 `dash` 与第二枚叉。`IconName` 字符串保持不变。
  - 测试：扩展 `e2e/tab-context-menu.spec.ts` —— 断言该图标不含 `stroke-dasharray`、叉形数量为 1、`path` 与 `close` 不同；18px 下描边不相连（可用截图 + 视觉探针复核）。

## 4. 视频容器自适应

依赖：无（`VideoPlayer.tsx` 串行链首位）

- [ ] 4.1 容器尺寸变化后视频自动重新适配

  实现要点：
  - `Content/VideoPlayer.tsx`：在播放器容器上挂 `ResizeObserver`，去抖后调用播放器自身的重排入口（`autoSize`）；卸载时断开。
  - 覆盖拖动栏间分隔线、栏目全屏、窗口缩放三类变化；不再依赖切一次网页全屏。
  - 测试：扩展 `e2e/tauri/media-player.spec.ts` 或新增 `e2e/video-fit.spec.ts` —— 改容器尺寸后断言视频元素宽高比与新容器一致（容差 1px），全屏该栏后同样成立。

## 5. 视频控制条扩展

依赖：4.1（同文件）、3.1（同改 `ui/icons.ts`）

- [ ] 5.1 上下集、截图、控件顺序与间距

  实现要点：
  - 播放键左右加 `prev(5)` / `next(15)`（left 位），点击复用现有 `playIndex`；无相邻项时禁用。
  - 截图控件 `screenshot(58)`：`video` 当前帧 → canvas → PNG → `save_binary_as_file`，默认名 `<视频名>-<分:秒>.png`；取消不落文件。
  - 顺序：`playlist(42) → 画面(44) → rate(50) → loop(52) → subtitle(54) → note(56) → screenshot(58) → fullscreenWeb(60) → pip(64) → hints(80)`。
  - 间距：新增播放器样式文件覆盖 ArtPlayer 控制条尺寸变量（控制高度/内距/图标尺寸），在全局样式入口导入；不动进度条高度。
  - 新增图标：`camera`（截图）、`adjust`（画面）。
  - 测试：扩展 `e2e/video-rate.spec.ts` 同套定位方式 —— 断言 `.art-control` 的 `data-name` 顺序；点击下一集后源变化；截图触发保存调用且默认文件名含时间码；音频不出现画面类控件。

## 6. 视频画面变换

依赖：5.1（同文件）

- [ ] 6.1 旋转 / 缩放（捏合与按钮）/ 亮度 / 平移

  实现要点：
  - 播放器内部单一状态 `{ rotation, zoom, brightness, panX, panY }`；应用顺序：旋转 → 缩放 → 平移，亮度走 `filter: brightness()`。
  - 「画面」面板（index 44）承载旋转 90° 步进、放大、缩小、亮度滑块、重置。
  - 画面区 `gesturestart` / `gesturechange` 捏合缩放（1×–4×），回退 `Ctrl` + 滚轮；缩放 >1 时拖拽平移并按范围夹取；回到 1× 平移归零。
  - 切换播放源复位为默认值；音频不渲染画面面板、不接受手势。
  - 新增图标：`rotate`、`zoomIn`、`zoomOut`（亮度复用现有 `sunBright`）。
  - 测试：扩展 `e2e/video-fit.spec.ts` —— 连续四次旋转后变换回到初始；捏合到 2× 后拖拽，画面位移在夹取范围内；亮度 150% 的计算 filter 生效；切文件后三项复位。

## 7. 沉浸模式：状态栏与阅读空间自动隐藏

依赖：无

- [ ] 7.1 沉浸态按派生可见性隐藏状态栏与未钉住的阅读空间

  实现要点：
  - `App.tsx`：状态栏可见性改为派生——沉浸态隐藏（不占位），底部热区 500ms 临时显现；不写回 `statusBarHidden`。
  - `Rail/ReadingRail.tsx`：沉浸态下未钉住时按 `collapsed` 渲染（不占位）；钉住态保持原宽度。
  - 退出沉浸自动恢复（派生条件复原，无快照）。
  - 测试：新增 `e2e/immersive-chrome.spec.ts` —— 进入沉浸后状态栏与阅读空间不可见；钉住后阅读空间可见；底部热区 500ms 后状态栏显现；退出后两者恢复。

## 8. 沉浸模式：每栏独立页签条

依赖：7.1（同改 `App.tsx`）

- [ ] 8.1 取消全局悬浮页签条，改为每栏独立展开

  实现要点：
  - 删除 `ImmersivePeekBar` 的渲染路径（文件可保留或删除，确认无引用）。
  - `Content/PaneTreeView.tsx`：沉浸态下每栏栏头默认收起；指针进入该栏内容区顶缘 16px 热区 → 该栏栏头 300ms 展开（宽度贴合该栏）；离开 400ms 收起；拖拽抑制；进入新栏时旧栏立即收起。
  - 空栏显示「空分栏」兜底文案；页签可切换且沉浸保持。
  - 测试：扩展 `e2e/immersive-peek.spec.ts` —— 两栏时分别悬停左右栏顶部，断言只有对应栏的栏头可见且其宽度等于该栏宽度；离开 400ms 后收起；点击页签后沉浸保持。

## 9. chrome 前景色统一

依赖：1.1（`StatusBar.tsx`）、3.1（`ui/icons.ts`/`TabBar.tsx`）、8.1（`PaneTreeView.tsx`）

- [ ] 9.1 新增 chrome 前景色 token 并替换四处零散实现

  实现要点：
  - `styles/tokens.css`：新增 `--app-chrome-rest`（默认暗）与 `--app-chrome-hover`（悬停亮），三主题各自取值。
  - 替换：状态栏右侧图标（AI 除外）、`TabBar.tsx` 未选中页签名、`PaneTreeView.tsx` 右侧功能按钮（模式/全屏/更多/关闭）、`ReadingRail.tsx` 卡片底部按钮行与路径文字。
  - 删除这些表面上的 `opacity-60` / `opacity-70` / `text-gray-400` / `hover:text-accent` 拼凑；AI 入口显式保留 accent；全屏按钮悬停改为与邻居一致。
  - 测试：新增 `e2e/chrome-colors.spec.ts` —— 断言四类元素静息计算色相等、悬停计算色相等且更亮、AI 与静息色不同、全屏按钮悬停色等于邻居。

## 10. 悬浮窗媒体与 HTML

依赖：无（`FloatingPreview.tsx` 独立）

- [ ] 10.1 图片按宽适配可滚动；HTML 本地地址直载并允许脚本

  实现要点：
  - `Preview/FloatingPreview.tsx` 图片分支：容器 `overflow: auto`；图片宽度 `min(100%, 原始宽度)`、高度自动；小图不放大。
  - HTML 分支：改为 `src={buildAssetUrl(path)}` + `sandbox="allow-scripts allow-same-origin allow-popups"`；删除 `srcDoc` 路径。
  - 已保存的 HTML / 图片 / 视频 / 音频 / PDF 不再经 `open_file_direct` 预读；仅 Markdown / 纯文本 / 代码读取文本。
  - 测试：扩展 `e2e/floating-preview.spec.ts` —— 长图渲染宽度等于内容区宽度且 `scrollHeight > clientHeight`；小图不放大；HTML iframe 无 `srcdoc`、`src` 指向本地资源、沙箱含允许脚本；用内联脚本改变背景色的样本断言脚本确实执行。

## 11. 一键自动布局栏目

依赖：1.1（同改 `StatusBar.tsx`）

- [ ] 11.1 自动布局纯逻辑 + store 动作 + 状态栏按钮

  实现要点：
  - 新增纯逻辑模块：输入 `{ root, tabs, focusedPaneId }` → 新树；按设计 D-13 的形状/比例表重排 leaf，媒体优先（图片/视频/PDF）。
  - `stores/index.ts` 新增动作调用纯函数并写回 `paneRoot`/`focusedPaneId`；保留每栏 `tabs` 顺序、`activeTabId`、`editorMode`。
  - `StatusBar.tsx` 在主页按钮右侧插入「自动布局」按钮（新图标 `layoutAuto`），`aria-label="自动布局"`。
  - 测试：单测覆盖 1/2/3/4/5/6 栏形状与「页签集合、顺序、activeTabId、editorMode、焦点栏」五不变；`e2e/auto-layout.spec.ts` 断言 2 栏媒体优先（视频栏 ≥60% 宽）、4 栏 2×2（±2px）、页签数不变。
  - **集成 checkpoint 计划**：本 change 共 11 票，每完成 ≤4 票执行一次 QG-6 集成 checkpoint（合并到集成分支 → `npx tsc --noEmit` + `npm test` → 浏览器打开一次 → 记录「用户现在能看到什么」）。
