# 需求输入包 — ui-polish-batch13

来源：用户 2026-11-10 第十三次真机走查口述 14 条（无人值守模式提交）。
本包满足 L-1 五条契约：来源可追溯 / 空白显式化 / 一手证据 / 冲突显式 / 验收锚点。

## 来源清单（可追溯）

| # | 用户原话（节选） | 分类 | 一手证据 |
|---|---|---|---|
| 1 | 轮盘：颜色图标改水滴形；二三层展开后透明度 25%；三层默认高亮且沿二层滑动联动；提示信息只留圆心操作说明；圆心格式刷不生效 | 交互/视觉 | 走查截图诉求 + 现有实现勘察（`roulette-view.ts`、`editor.css`、`floating-toolbar.ts`） |
| 2 | md 文档切换到编辑态不能正常显示，都显示成源码格式 | 回归 | 浏览器探针复现：分栏重挂载后 `main` 面板 `mode=edit` 但 `.cm-heading-marker`/`.cm-callout` 计数 0（见 `.artifacts/batch13-probe/editor-remount.txt`） |
| 3 | 高亮块切换图标后再转换类型，图标不跟随；标题与图标间隔 3 个汉字 | 回归/视觉 | 代码事实：emoji 覆盖按序号存（`callout-emoji.ts:16`）；头部 `gap: 0.5em` + 空标题槽 `min-width: 40px`（`editor.css:1708/1718`） |
| 4 | 按恢复（撤销）快捷键必须先点页面才生效 | 缺陷 | 代码事实：撤销仅在 CM6 聚焦时由 `historyKeymap` 处理（`setup.ts:84`），App 无全局 undo 转发 |
| 5 | 栏目更多「打开所在文件夹」改名「打开文件位置」 | 文案 | `paneHeaderMenu.ts:48` |
| 6 | 设置行宽进度条最大值 = 状态栏页面宽度最大值 | 一致性 | `StatusBar.tsx:20 WIDTH_MAX=1400` vs `SettingsView.tsx:118 READER_WIDTH_MAX=2400` |
| 7 | MD 编辑态选中文字加胶囊工具条；设置可切换胶囊/轮盘；2 层按钮，常用在中间最近鼠标 | 新增能力 | `floating-toolbar.ts` 只产出轮盘；`selectionPillMode.ts` 编辑器选区返回 null |
| 8 | 双击栏目页签栏空白处新建 MD | 新增能力 | `TabBar.tsx:240` 页签条无空白区 dblclick |
| 9 | 状态栏页面宽度提示去掉「（点击调整）」 | 文案 | `StatusBar.tsx:298` |
| 10 | 视频打开不显示画面只显示加载、点击才播；打开要自动播放；多视频互不影响；时间戳笔记换笔写图标 | 回归/视觉 | `VideoPlayer.tsx:670 autoplay:false`、`:675 autoPlayback:false`、`:1022` ready 只 seek 不 play |
| 11 | 页签栏右键菜单弹出后不要再显示胶囊提示 | 缺陷 | `TooltipLayer.tsx` 无「弹窗打开」抑制；`ContextMenu`/栏目菜单各自为政 |
| 12 | 卡片 HTML 缩略图改坏了，现在都不显示 | 回归 | `726bd7e` 把 iframe 缩略图替换为中性占位（`ReadingRail.tsx:301-312`） |
| 13 | PDF 打开默认显示工具栏；双击收起、再双击固定；隐藏时鼠标滑入（顶部）以悬浮栏显示；不要正文滑入显示；取消沉浸态自动隐藏 | 交互 | `PdfViewer.tsx:315-343` 沉浸态 1.2s 自动收起；无双击切换 |
| 14 | md/html/文本悬浮小窗右上角钉住右侧加预览/编辑切换；小窗支持编辑 | 新增能力 | `FloatingPreview.tsx:545-590` 标题栏只有钉住/关闭 |

## 空白显式化（open-question）

| id | 空白 | 处置（已裁决） |
|---|---|---|
| Q-1 | 行宽上限统一到 1400 还是 2400？ | 统一到 **1400**：状态栏既有上限即 1400，且 1200 已是「宽松」档；2400 只存在于设置滑块，无设计依据（`docs/design/system/spec.md` 无行宽条款）。 |
| Q-2 | 胶囊工具条具体按钮集与「中间最近鼠标」的落位 | 两行：近指针行 = 加粗/斜体/字色/背景色/清除格式；远指针行 = 下划线/删除线/行内代码/链接/改写/翻译/润色。不新增设计刻度，复用 `--radius-full`、现有图标。 |
| Q-3 | HTML 缩略图如何避免上次的「偶发空白」 | 恢复 iframe 但去掉并发配额；iframe 透明铺底 + 类型色占位始终在底下，`onLoad` 后才淡入；任何加载失败都退回可见占位，不再出现纯白卡。 |
| Q-4 | 视频自动播放与浏览器策略 | Tauri WebView 允许有声 autoplay；`autoplay:true` + ready 后 `play()`，失败时保持可见首帧（不显示 loading 遮罩）。多路各自播放互不静音。 |
| Q-5 | 恢复快捷键的「恢复」指撤销还是重做 | 按 macOS 习惯同时覆盖：⌘Z 撤销、⌘⇧Z 重做（含 Ctrl 变体），作用对象 = 当前聚焦格的活动编辑器。 |

## 冲突显式

| 冲突 | 裁决 |
|---|---|
| 第 10 条要求「打开即自动播放」直接反转 batch12 第 1 条「打开为暂停态」 | 以本轮用户最新诉求为准；`reading` 规格 batch12 的暂停起播场景在本 change 中 supersede。 |
| 第 12 条要求缩略图 vs batch12 canonical A-14「中性占位、不伪造缩略图」 | 以本轮用户诉求为准；A-14 改为「真实首屏缩略图（iframe 受控渲染），失败才回退中性占位」。 |
| 第 13 条「取消沉浸模式现有隐藏工具栏」 vs batch12 7.1 自动收起 | 以本轮为准：删除 readingMode 自动收起，改为显式双击 + 顶部热区悬浮。 |

## 验收锚点

见 `openspec/changes/ui-polish-batch13/anchors.md`（机读层 `conformance.json` 由 `cw-conformance.sh generate/lock` 生成并锁定）。
