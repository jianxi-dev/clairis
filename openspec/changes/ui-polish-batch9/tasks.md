# Tasks: 界面精度与交互一致性修复（第九批）

> 垂直切片：每条任务都能单独交付并在页面上看到结果。
> 依赖：见每节「依赖」行。同文件交集决定串行（不是功能依赖）。
> 反馈编号对应用户 2026-11-09 第五次走查清单 1–7。

## 1. 页面宽度三挡块 hover 虚线（反馈 1）

依赖：无

- [x] 1.1 三挡块每块 hover 显示虚线边框，移出隐藏

  实现要点：
  - `StatusBar.tsx`：`width-bar` 内增加 `span.width-bar-fill` 承担斜面与填充，外层按钮承担虚线边框
  - `styles/editor.css`：`.width-bar` 默认 `border: 1px dashed transparent`，hover/focus-visible 为 `--app-border-strong`；`.width-bar-fill` 保留原 `clip-path` 与 `is-active` 填充
  - `docs/design/system/decisions.md`：追加「宽度三挡块 hover 虚线」一行（append-only）
  - 测试：扩展 `e2e/status-width.spec.ts`——未 hover 时三柱 `border-style == "dashed"` 且 `border-color` 透明；hover 单柱后该柱 `border-color` 不透明，其余仍透明

## 2. 栏目右上角图标整区显隐（反馈 2）

依赖：无

- [x] 2.1 mode / 全屏 / 更多 / 关闭整组默认隐藏，滑入区域显示

  实现要点：
  - `PaneTreeView.tsx`：四个按钮收进 `.pane-actions`；菜单打开时 `data-open="true"`
  - `styles/editor.css`：`.pane-actions` 默认 `opacity: 0`；`.pane-leaf:hover .pane-actions`、`:focus-within`、`.pane-actions:hover`、`[data-open="true"]` 时 `opacity: 1`；删除全屏按钮独立的显隐规则
  - 测试：扩展 `e2e/pane-header.spec.ts`——未 hover 时整组计算 `opacity == 0`；指针移到栏目头右侧区域后 `opacity == 1`；打开更多菜单后保持 `opacity == 1`

## 3. 大纲按钮右缘对齐（反馈 3）

依赖：无

- [x] 3.1 大纲按钮右缘与栏目右侧图标区右缘同线

  实现要点：
  - `styles/editor.css`：`.biaoyue-outline` 的 `right: 28px` 改为 `4px`
  - `docs/design/system/decisions.md`：追加新行取代「距右缘一个按钮宽 28px」旧裁决
  - 测试：扩展 `e2e/outline-border.spec.ts`——大纲按钮右缘与 `[data-testid="pane-menu-button"]` 右缘差值 ≤ 1px

## 4. 悬浮窗钉住后多实例（反馈 4a）

依赖：无

- [x] 4.1 钉住一个窗口后继续打开新窗口，多窗共存且各自可关

  实现要点：
  - `lib/previewAnchor.ts`：`PreviewState` 增加 `id`
  - `stores/index.ts`：新增 `pinnedPreviews`；`openPreview` 生成 id；`togglePreviewPin` / `closePreview` / `movePreview` / `resizePreviewTo` 支持 id 并同步两个集合
  - `components/Preview/FloatingPreview.tsx`：接受可选 `preview` 与按 id 的动作；新增 `FloatingPreviewList` 按 id 去重渲染
  - `App.tsx`：改渲染 `FloatingPreviewList`
  - `ReadingRail.tsx` / `GridView.tsx` / `TabBar.tsx`：读取与关闭走当前 `preview` 语义不变
  - 测试：扩展 `e2e/floating-preview.spec.ts`——钉住 A 后打开 B、再钉住 B，`floating-preview` 节点数为 2；关闭其一后为 1，且剩余窗口路径正确

## 5. 状态栏 peek 悬浮化（反馈 4b）

依赖：4.1（同触 `App.tsx`，按依赖序开工）

- [x] 5.1 滑入底部状态栏不再挤压内容，滑出无抖动

  实现要点：
  - `StatusBar.tsx`：增加 `floating?: boolean`，根节点追加 `app-status-bar--floating`
  - `App.tsx`：隐藏/沉浸且 `statusBarPeek` 时传 `floating`
  - `styles/editor.css`：`.app-status-bar--floating { position: fixed; inset: auto 0 0; z-index: 40; box-shadow: 0 -8px 24px rgb(0 0 0 / .12) }`
  - 测试：新增/扩展 `e2e/status-bar-peek.spec.ts`——记录 `workspace-body` 高度，指针进入底部热区前后高度差为 0；状态栏出现后 `position == "fixed"`

## 6. 视频二级菜单交互（反馈 5）

依赖：无

- [x] 6.1 全屏可用、hover 显隐、鼠标居中、快捷键窗缩窄、截图提示上移

  实现要点：
  - `VideoPlayer.tsx`：删除 `openPopover` 的全屏拦截；控件 `mouseenter` 打开、`mouseleave` 180ms 延迟关闭；浮层自身进出取消/触发关闭；锚点按 `clientX` 水平居中并钳制；hints 宽 168；补 playlist/subtitle/note/hints 的 `data-name`；截图成功/失败提示改为按钮上方浮层，2s 自动消失
  - 测试：扩展 `e2e/video-controls.spec.ts`——全屏态点倍速出现菜单；hover 控件出现菜单、移出后消失；菜单水平中心与鼠标 x 差 ≤ 2px（边界场景允许钳制）；hints 宽度 ≈ 168；截图提示节点的 bottom 小于截图按钮 top

## 7. 视频右侧按钮统一与图标（反馈 5 续）

依赖：6.1（同文件，按依赖序开工）

- [x] 7.1 右侧一行视觉尺寸统一；快捷键/画面图标可辨认

  实现要点：
  - `ui/icons.ts`：`keyboardHints` 重绘为键盘外框 + 键帽 + 空格；`visual` 改用图片框构图；`speed` / `loop*` / `rotate` 外接框加宽到 14–16px
  - `styles/player.css`：右侧控件 38×38，自绘与原生 `.art-icon` 统一 24×24、svg 22×22，垂直水平居中
  - `docs/design/system/decisions.md`：追加「视频右侧按钮尺寸」「快捷键图标形状」「画面图标形状」三行
  - 测试：`e2e/video-controls.spec.ts` 断言右侧所有 `.art-control` 盒子宽高均为 38、图标盒子均为 24±1；`e2e/icon-system.spec.ts` 断言 keyboard 图标含外框矩形、visual 不再使用滑杆路径

## 8. 倍速菜单指针表盘（反馈 6）

依赖：7.1（同文件，按依赖序开工）

- [x] 8.1 六档各显示指针表盘，1.0× 在 12 点，低速偏左高速偏右

  实现要点：
  - `VideoPlayer.tsx`：新增 `RateDial`（`data-rate-dial`、`data-angle`），替换每行的 `speed` 图标；主控件保持 `speed`
  - 测试：扩展 `e2e/video-rate.spec.ts`——每行恰有 1 个表盘；`1.0×` 的 `data-angle` 为 0，`0.5×` < 0，`2.0×` > 0

## 9. MD 折叠三角与合行修复（反馈 7）

依赖：无

- [x] 9.1 三角放大一倍、默认隐藏、召唤区显示；相邻折叠不再合并成一行

  实现要点：
  - `editors/decorations/fold.ts`：replace 起点 `headingLine.to + 1`；三角 SVG 20×20
  - `editors/orchestration/block-handle.ts`：指针进入/离开 `isInSummonZone` 时切换 `contentDOM` 的 `cm-summon-zone` 类
  - `styles/editor.css`：三角默认 `opacity: 0`；`:hover`、`:focus-visible`、`.cm-fold-toggle-folded`、`.cm-summon-zone .cm-fold-toggle` 时 `opacity: 1`
  - `docs/design/system/decisions.md`：追加「折叠三角尺寸与召唤区」一行
  - 测试：扩展 `e2e/heading-fold.spec.ts`——四个相邻标题全部折叠后 `.cm-line` 数量为 4（或至少标题各自在不同行），文本不出现 `# A# B`；三角 `width/height == 20`；指针在正文右侧时 `opacity == 0`，进入左缘 25% 后 `opacity == 1`；单测 `fold.test.ts` 的 replace 起点改为 4
