# Tasks: 第十四批真机走查（ui-polish-batch14）

> 切片原则：1 task = 1 用户可见交付物。Blocked by 只记真实文件级冲突（同一文件 = 冲突，本仓 1 issue = 1 PR）。
> QG-2：每条均新增/扩展 e2e（视频手势/画中画在 `npm run tauri dev` 真机补证）。
> QG-6：10 票 ≥ 6，集成 checkpoint 在 4.1 与 8.1 之后各一次。

## 1. 轮盘回归（#566）

依赖：无

- [x] 1.1 三层展开透明度 90% + 高亮块图标随类型
  - 粒度：用户可见交付物
  - 实现：`SUB_DIM_OPACITY`/`editor.css` 收敛到 90%；`callout-emoji.ts` 覆盖值按类型键存，类型切换取新类型默认图标。
  - 验收：三层展开后根/二层计算 opacity 严格等于 0.9；NOTE 改图标后转 TIP，卡片显示 TIP 默认图标；关闭轮盘无残留。
  - e2e：`e2e/roulette-regression-566.spec.ts`（新增）。
  - 接线归属：`roulette-view.ts` 渲染层与 `callout-emoji.ts` 取图标处（本票内完成）。

## 2. 音频分流（#2）

依赖：无

- [x] 2.1 MP3 走音频表面，不再进 PDF 渲染器
  - 粒度：用户可见交付物
  - 实现：先复现 `FPDF_LoadMemDocument failed`，定位分流点后修正（DQ-2：票面假设不是结论）；补齐音频播放/暂停/时长。
  - 验收：打开 mp3 后 `.pdf-*` 节点数为 0、音频控件可见且可播放；关闭页签无残留播放实例。
  - e2e：`e2e/audio-open.spec.ts`（新增）。
  - 接线归属：`PreviewView.tsx` 的类型分流处。

## 3. 视频播放核心（#1/#5/#14）

依赖：无

- [x] 3.1 全屏时间戳可见 + 播放列表记忆 + 移除循环图标 + 页签静音
  - 粒度：用户可见交付物
  - 实现：全屏容器层级修正；当前播放项写 state 并在重启恢复；列表顶部循环按钮移除；`TabBar` 页签名后加静音切换。
  - 验收：全屏后时间戳节点可见且不被裁剪；播放到第 2 项后重载仍为第 2 项；循环按钮数量为 0；页签喇叭点击后音频 muted 状态翻转。
  - e2e：`e2e/video-core.spec.ts`（新增，含 mock 媒体）。
  - 接线归属：`VideoPlayer.tsx` 与 `TabBar.tsx`（本票内完成）。

## 4. 视频布局与手势（#1）

依赖：3.1（同一 `VideoPlayer.tsx`）

- [x] 4.1 窄宽两级降级 + 双指音量/亮度 + 多画中画
  - 粒度：用户可见交付物
  - 实现：先挤按钮间距（gap 下限），到极限再按比例缩图标；双指上下滑动左半调亮度、右半调音量；每个视频实例独立画中画容器。
  - 验收：宽度收窄到阈值时全部按钮仍可见（溢出数 0），图标尺寸随二级降级变化；双指手势分别改变亮度/音量值；两个视频同时画中画时两个容器均存在。
  - e2e：`e2e/video-layout.spec.ts`（新增）；手势与画中画在 `npm run tauri dev` 真机补证。
  - 接线归属：`VideoPlayer.tsx` 布局与手势层。

## 5. 编辑导航（#3）

依赖：无

- [x] 5.1 macOS 前进/后退支持 cmd/ctrl
  - 粒度：用户可见交付物
  - 实现：App 全局 keydown 绑定 `cmd/ctrl+[`、`cmd/ctrl+]`，走编辑器 history。
  - 验收：编辑后 `cmd+[` 内容回退、`cmd+]` 前进；输入框聚焦时不劫持。
  - e2e：`e2e/editor-history-keys.spec.ts`（新增）。
  - 接线归属：`App.tsx` 的 keydown handler。

## 6. 悬浮小窗编辑态（#8）

依赖：无

- [x] 6.1 切到编辑态渲染富文本
  - 粒度：用户可见交付物
  - 实现：`FloatingPreview.tsx` 编辑态复用编辑器装饰渲染，不显示源码标记。
  - 验收：切编辑态后正文不出现 `**`/`##` 源码片段；切回预览内容一致。
  - e2e：`e2e/floating-preview-edit.spec.ts`（新增）。
  - 接线归属：`FloatingPreview.tsx` 正文渲染分支。

## 7. 胶囊改圆角矩形（#9）

依赖：无

- [x] 7.1 圆角矩形 + 承载轮盘全部功能 + 高频前置
  - 粒度：用户可见交付物
  - 实现：`capsule-toolbar.ts` 由双层大胶囊改为单层圆角矩形；`capsuleItems()` 覆盖轮盘全部动作；按最短点击路径排序。
  - 验收：胶囊计算 `border-radius` ≤ 12px 且为单行容器；动作项数量与轮盘可执行项一致；高频三项位于首屏。
  - e2e：`e2e/capsule-v2.spec.ts`（新增）。
  - 接线归属：`capsule-toolbar.ts` 与 `floating-toolbar.ts` 的 `capsuleItems()`。

## 8. 转换菜单与列表（#10/#11/#12）

依赖：无

- [x] 8.1 菜单图标 + 二级菜单隐藏 + 任务图标 + 同级转换与编号
  - 粒度：用户可见交付物
  - 实现：`ACTION_ROWS`/`ALIGN_INDENT_ITEMS` 补图标；二级菜单滑出后卸载；修正任务项 icon/action 绑定；`blockConvertChanges` 支持同级多块转换，有序列表自动编号。
  - 验收：插入 CSS 与缩进/对齐子项图标数量等于项数；滑出 400ms 后二级菜单节点数为 0；点任务项后块为 `- [ ]` 而非高亮；选中三块同级无序列表转有序后编号为 1/2/3。
  - e2e：`e2e/block-menu-batch14.spec.ts`（新增）。
  - 接线归属：`block-menu.ts` 与 `block-convert.ts`。

## 9. 弹窗对齐（#4）

依赖：无

- [x] 9.1 弹窗中心对齐按钮图标中心
  - 粒度：用户可见交付物
  - 实现：新增锚点函数，以按钮图标中心为基准；视口边缘按最短路径夹取。
  - 验收：格头菜单与右键菜单中心与触发图标中心的水平偏差 ≤ 2px；贴边时仍完整可见。
  - e2e：`e2e/menu-anchor.spec.ts`（新增）。
  - 接线归属：`paneHeaderMenu.ts` / `ContextMenu.tsx` 定位处。

## 10. 导出（#13）

依赖：无

- [x] 10.1 菜单顺序 word、mdpkg、图片、pdf、html、zip + PDF 复用 md-bundle
  - 粒度：用户可见交付物
  - 实现：重排 `EXPORT_MENU_ITEMS`；新增 PDF 动作，复用 md-bundle 导出能力。
  - 验收：导出菜单文本序列严格等于 `Word / .mdpkg / 图片 / PDF / HTML / ZIP`；点 PDF 生成文件且失败时给出可读错误。
  - e2e：`e2e/export-menu-order.spec.ts`（新增）。
  - 接线归属：`paneHeaderMenu.ts` 与导出动作处理处。
