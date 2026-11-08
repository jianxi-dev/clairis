# Tasks: 界面细化与编辑器工具条批量修复（第六批）

> 垂直切片：每条任务都能单独交付并在页面上看到结果。
> 依赖：见每节「依赖」行。同文件交集决定串行（不是功能依赖）。
> 反馈编号对应用户 2026-11-08 第二次走查清单。

## 1. 顶栏与沉浸入口（反馈 4 / 5）

依赖：无

- [ ] 1.1 移除品牌顶栏，沉浸入口图标化

  实现要点：
  - `App.tsx`：删除 `<Toolbar />` 引用与 import；确认移除后无布局塌陷（首个分栏上边界即窗口内容边界）
  - `components/Toolbar.tsx`：删除文件
  - `components/StatusBar.tsx`：沉浸按钮去掉「沉浸」文字，只留 `Icon name="immersive"`；`title`/`aria-label` 保留
  - `styles/editor.css`：清理仅服务于品牌顶栏的 `.app-chrome` 规则（若分栏共用则改名保留）
  - 测试：`e2e/shell-chrome.spec.ts` 断言窗口顶部无品牌文字节点、沉浸按钮无文本节点且可访问名存在

## 2. 页签栏视觉（反馈 1 / 23）

依赖：无

- [ ] 2.1 页签选中态与底边框去重

  实现要点：
  - `components/TabBar.tsx` + `styles/editor.css`：选中页签去掉蓝色描边（`outline: none`），改为底色提亮 + 主色文字；非选中页签文字降至 `--app-text-2`
  - 页签容器不再画 `border-bottom`，边界交给栏目容器；单格与分栏两态底边视觉一致
  - 测试：扩展 `e2e/pane-header.spec.ts`，断言选中页签 `outline-width == 0px`、选中/未选中 `color` 不同、页签容器 `border-bottom-width == 0px`

## 3. 页签右键菜单图标（反馈 14）

依赖：无（与 2.1 同改 `TabBar` 附近，串行）

- [ ] 3.1 右键菜单补图标

  实现要点：
  - 菜单数据（`TabBar.tsx` 内菜单项定义或 `src/lib/*Menu.ts`）每项补 `icon`，名称取自 `src/ui/icons.ts` 现有集合；缺的补形状
  - 菜单行左侧渲染图标，宽度与既有菜单一致
  - 测试：e2e 断言右键菜单每项都有 `svg` 子节点

## 4. 状态栏基础交互（反馈 10）

依赖：无（与 5.x 同改 `StatusBar`/`App`，串行）

- [ ] 4.1 降高 + 双击显隐 + 隐藏态悬停显现

  实现要点：
  - `components/StatusBar.tsx`：垂直内距收紧，目标计算高度 ≤ 26px
  - `App.tsx`：`statusBarVisible` 状态 + 双击切换；隐藏时渲染 0 高触发器，`pointerenter` 起 500ms 定时器显现，`pointerleave` 清除定时器并隐藏
  - 快捷键不受影响（⌘⇧\ 等仍可用）
  - 测试：新增 `e2e/status-bar-visibility.spec.ts`，断言双击后隐藏、指针移入触发器 500ms 内显现、移出后隐藏

## 5. 状态栏主题弹窗（反馈 10）

依赖：4.1（同文件）

- [ ] 5.1 主题下拉箭头与选择弹窗

  实现要点：
  - `components/StatusBar.tsx`：主题按钮加 `chevronDown`；`pointerenter` 打开弹窗
  - 弹窗 `createPortal` 到 body，定位在按钮上方（复用 `placement.ts` 落位规则）；列出 亮色/暗色/暖色/跟随系统，数组驱动，便于扩展
  - 点击项设主题并关闭；`pointerleave` 区域（按钮+弹窗并集）延迟关闭
  - 测试：e2e 断言悬停后弹窗出现、四项、点击「暗色」后 `data-theme=dark`、弹窗关闭

## 6. 状态栏主页与宽度（反馈 2 / 11 / 12）

依赖：4.1 / 5.1（同文件）

- [ ] 6.1 主页入口

  实现要点：
  - `StatusBar.tsx`：`grid` 前插入 `home` 按钮，`aria-label="主页"`，行为回到启动页（复用现有回门户动作）
  - `src/ui/icons.ts`：若无 `home` 形状则补
  - 测试：e2e 断言主页按钮存在、点击后进入启动页

- [ ] 6.2 页面宽度调整面板

  实现要点：
  - `StatusBar.tsx`：`1200px` 变按钮，点击打开面板：三档预设 + 滑块（与 `readerWidth` 合法区间同界）
  - 拖动即预览并写入 `editorStore.config.readerWidth`；关闭保留当前值
  - 测试：e2e 断言点击后出现三档按钮与 `input[type=range]`、选择「窄」后状态栏宽度文本与正文宽度同步变化

## 7. 阅读空间卡片底部行（反馈 6）

依赖：无（与 8.x 同改 `ReadingRail`，串行）

- [ ] 7.1 底部行尺寸、收藏图标、路径交互、位置与重叠

  实现要点：
  - `components/Rail/ReadingRail.tsx` + `styles/reader.css`：底部动作图标 14px（热区不缩）；「收藏」改 `heart`（选中实心）；路径按钮与其它按钮同款 hover 变化，`title` 给完整路径，长路径中段省略
  - 整行下移贴近卡片底边；卡片最小高度下，缩略图/进度条/底部行三者不重叠（各自固定行高，缩略图可压缩）
  - 测试：扩展 `e2e/rail-cards.spec.ts`，断言三者的 `getBoundingClientRect` 无交叠、路径按钮 `title` 含完整路径、收藏图标为 `heart`

## 8. 悬浮预览窗宽度（反馈 8）

依赖：7.1（同改卡片命中区）

- [ ] 8.1 宽度恢复 + 缩略图宽，唤出区域收窄

  实现要点：
  - `components/Preview/FloatingPreview.tsx`：宽度 = 上一版基准 + 一个缩略图宽度（缩略图宽度抽成变量，其余为常量）
  - 卡片 `pointerenter` 命中区域宽度 == 缩略图宽度；缩略图左侧正文区不唤出
  - 测试：扩展 `e2e/floating-preview.spec.ts`，断言悬浮窗宽度增量 == 缩略图宽度、指针在缩略图左侧时悬浮窗不出现

## 9. 悬浮窗底部动作行（反馈 9 / 8）

依赖：8.1（同文件）

- [ ] 9.1 底部动作行悬停浮现（含 PDF）

  实现要点：
  - `FloatingPreview.tsx`：默认不渲染底部行；指针进入底部 36px 区域浮现，按钮尺寸与卡片内一致（同一组件/同一 class）
  - 卡片类型不限：PDF 卡片同样显示（缺陷修复）
  - 测试：e2e 断言悬浮窗初始无动作行、指针移到底部后出现且按钮计算宽度与卡片内同款相等

## 10. 图标造型（反馈 7 / 19）

依赖：无

- [ ] 10.1 pin / pinOff 收细

  实现要点：
  - `src/ui/icons.ts`：`pin` 梯形整体下移，斜杠缩短（`M7 17L17 7`）
  - 测试：`e2e/icon-system.spec.ts` 断言两图标 `path` 稳定且互不相同

- [ ] 10.2 md 图标去重与重绘

  实现要点：
  - `src/editors/icons.ts`：分栏（1–5 栏真实比例）、表格（封口网格）、数据看板（柱+折线）、插入 HTML（`</>`）、插入 CSS（`#`）、流程图（菱形+箭头）、视频与文件拆形、内嵌网页（浏览器框）、剪切块换直观形
  - 断言：上述图标 `path` 两两不同（去重）
  - 测试：新增 `e2e/editor-icons.spec.ts` 断言集合内无重复 path 且关键图标存在

## 11. 大纲边框（反馈 13）

依赖：无

- [ ] 11.1 未钉住无边框、钉住细边框

  实现要点：
  - `components/Content/OutlineMenu.tsx` + `styles/reader.css`：未钉住 `border: none`；钉住 `1px solid var(--app-border)`
  - 测试：e2e 断言未钉住 `border-*-width == 0px`、钉住后为 `1px`

## 12. 视频倍速（反馈 3）

依赖：无

- [ ] 12.1 倍速菜单与保音调

  实现要点：
  - `components/Content/VideoPlayer.tsx`：控件区加倍速按钮，菜单 0.5/0.75/1.0/1.25/1.5/2.0
  - 设置 `playbackRate` 时同时置 `preservesPitch`（含 `webkitPreservesPitch`）为真；切换视频重置 1.0
  - 测试：e2e 断言菜单六项、选 1.5× 后 `video.playbackRate == 1.5`、`preservesPitch === true`

## 13. 工具条归属（反馈 15）

依赖：无（与 14.x 同改工具条相关文件，串行）

- [ ] 13.1 md 复用 md-bundle 选区工具条；html 工具条不进 md

  实现要点：
  - `src/editors/orchestration/floating-toolbar.ts` + `toolbar-shared.ts`：md 选区工具条改为 md-bundle 的按钮集合（改写/翻译/润色 + 格式组），图标走 Clairis `icons.ts`
  - `components/Content/HtmlEditToolbar.tsx` / `HtmlVisualEditor.tsx`：只在 html 编辑态渲染，确保 md 编辑态不会出现这两条
  - 测试：`e2e/floating-toolbar.spec.ts` 断言 md 选中文本后按钮集合等于期望集合、且 html 专属按钮不在其中；html 编辑态不出现 md 工具条

## 14. 菜单落位（反馈 16 / 18）

依赖：13.1

- [ ] 14.1 最短路径落位规则

  实现要点：
  - `orchestration/placement.ts`：导出 `placeMenu(anchorRect, menuSize, viewport)`，实现 D-16 五条规则；各菜单（块菜单、工具条、主题弹窗、宽度面板）统一调用
  - 测试：新增单测覆盖「下方够/下方不够→上翻/右侧不够→左移/四角」四种情形

- [ ] 14.2 新增手柄滑入显示且跟随指针

  依赖：14.1
  实现要点：
  - `orchestration/block-handle.ts`：`pointerenter` 显示菜单（不再需点击），锚点为指针；`pointerleave` 延迟 120ms 关闭
  - 测试：e2e 断言滑入手柄后菜单出现且其左上角随指针位置变化（两次不同指针位置比较）

## 15. 转换手柄菜单（反馈 20 / 22）

依赖：14.1（同改 `block-menu.ts`）

- [ ] 15.1 缩进与对齐合并 + 对齐图标 + 宽度与间距

  实现要点：
  - `orchestration/block-menu.ts` / `block-convert.ts` / `block-alignment.ts`：合并为「对齐与缩进」，二级含 左/中/右 + 减少/增加缩进；对齐组带图标
  - 菜单宽度与新增手柄菜单同常量；标题项与无序列表项前两行间距调低
  - 测试：e2e 断言二级菜单含三项对齐与两项缩进、对齐项有 `svg`、两级菜单 `offsetWidth` 相等

## 16. 颜色菜单（反馈 21）

依赖：无（`block-color.ts` / `color-palette.ts`）

- [ ] 16.1 二级菜单弹出后不消失

  实现要点：
  - `orchestration/menu-stack.ts` / `block-color.ts`：父项打开二级时标记 `keepOpen`，父级 `pointerleave` 关闭逻辑跳过 `keepOpen`
  - 测试：e2e 断言打开色板后指针移出父项，色板仍存在；点击外部后关闭

## 17. 撤销/重做快捷键（反馈 17）

依赖：无

- [ ] 17.1 Cmd 与 Ctrl 双绑定

  实现要点：
  - `src/editors/keybindings.ts`：在既有 `Mod-z` / `Mod-Shift-z` 基础上显式加 `Ctrl-z` / `Ctrl-Shift-z` / `Ctrl-y`
  - HTML 编辑态快照栈同一映射
  - 测试：e2e 分别用 `Control+z` 与 `Meta+z` 断言内容回退，`Control+Shift+z` 恢复

## 18. 主题按钮（补充反馈 4 / 6）

依赖：无（`StatusBar` / `ui/icons.ts`，与 5.1 同文件，串行）

- [ ] 18.1 去掉下拉三角，亮色与暖色图标可区分

  实现要点：
  - `StatusBar.tsx`：主题按钮不再渲染 `chevronDown`，只留主题图形
  - `ui/icons.ts`：亮色与暖色改用不同线条数表达亮度（亮色 6 条、暖色 4 条），不再共用同一 sun 形
  - 测试：扩展 `e2e/status-bar-visibility.spec.ts`，断言主题按钮内 `svg` 数量为 1、`sunBright` 与 `sunWarm` 的 path 不同且亮色含 6 段光线

## 19. 页面宽度面板改版（补充反馈 5）

依赖：18.1（同改 `StatusBar`）

- [ ] 19.1 斜面柱状三档 + 下行长滑块，上限 1400

  实现要点：
  - `StatusBar.tsx`：面板分两行——上行三个可点击斜面柱状（高度递增代表三档），下行一条进度条/滑块，其长度大于上行按钮组总宽；三档位置与滑块三挡对齐
  - 宽度最大值改为 1400（`READER_WIDTH_MAX` 与滑块 `max` 同步）；预设仍 720/1080/1400
  - 面板中位默认跟随指针（以指针 x 为中心，再按窗口宽度夹取到可视区内）
  - 测试：扩展 `e2e/status-bar-visibility.spec.ts`，断言滑块宽度 > 按钮组总宽、滑块 `max=1400`、选「紧凑」后状态栏宽度为 720px

## 20. PDF 悬浮预览屏蔽缩放条（补充反馈 1）

依赖：无

- [ ] 20.1 PDF 悬浮预览不再显示放大缩小工具条

  实现要点：
  - `Preview/FloatingPreview.tsx`：PDF 预览沿用卡片缩略图的做法，禁用 embedpdf 的 `zoom-in`/`zoom-out` 按钮（`disabledCategories`），与缩略图一致
  - 测试：扩展 `e2e/floating-preview.spec.ts`，断言 PDF 预览里不出现 `data-epdf-i="zoom-toolbar"` 的缩放按钮

## 21. 卡片缩略图高度（补充反馈 2）

依赖：无（`Rail/ReadingRail.tsx`，与 7.1 同文件，串行）

- [ ] 21.1 缩略图高度下调，避免与上下文字重叠

  实现要点：
  - 缩略图盒高度由 54 降到 48（宽度保持 4:3 → 64×48），卡片最小高度下与标题、摘要、底部行均不重叠
  - 测试：扩展 `e2e/rail-cards.spec.ts`，断言缩略图尺寸为新值且与相邻文字矩形不相交

## 22. 大纲按钮位置（补充反馈 3）

依赖：无（`Content/OutlineMenu.tsx`，与 11.1 同文件，串行）

- [ ] 22.1 大纲按钮右移，距右缘为宽度的 2/3

  实现要点：
  - 大纲按钮定位改为距右侧「容器宽度的 2/3」，在窄窗口下仍完整可见
  - 测试：扩展 `e2e/outline-border.spec.ts`，断言按钮右侧空白约为容器宽度的 2/3（±4px）
