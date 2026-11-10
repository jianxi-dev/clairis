# Tasks: 第十二批真机走查（ui-polish-batch12）

> 切片原则：每条 = 一个用户可见交付物，贯穿「实现 → 样式/后端 → e2e」。Blocked by 只记真实文件级冲突（同一文件 = 冲突，本仓 1 issue = 1 PR）。
> QG-2：每条均新增/扩展 e2e，无 `no-ui-impact` 豁免。
> QG-6：9 票 ≥ 6，集成 checkpoint 在 4.1 之后与 7.1 之前各一次。

## 1. 视频暂停起播与多路并行

依赖：无

- [x] 1.1 视频打开为暂停态、重启不自动播放；多格独立控制且可同时出声
  - 关掉 `autoplay` 与 `autoPlayback`；ready 只 seek 不 play；重启恢复布局后仍为暂停。
  - 验收：打开视频后 500ms 内 `video.paused === true`；两栏各开一个视频，分别点播放后两个 `<video>` 均 `paused === false`、`muted === false`；重启模拟（重新挂载）后仍为暂停。
  - e2e：`e2e/video-multi-pane.spec.ts`（扩展）+ 新增暂停起播断言。
  - 接线归属：无新增导出。

## 2. 转换手柄二级菜单常驻

依赖：无

- [x] 2.1 展开的二级菜单在指针滑出后不消失
  - 类型二级面板补 keep-open（与颜色/对齐一致）；二级与父菜单间隙由面板内边距桥接；Esc / 外部点击才关。
  - 验收：打开「转为」→ 悬停「类型」展开二级 → 指针移到编辑器空白处 600ms 后二级面板仍可见；`Esc` 后二级与父菜单同时消失。
  - e2e：`e2e/block-menu.spec.ts`（扩展）。
  - 接线归属：无新增导出。

## 3. MD 行内字色 + 背景色叠加与清除格式

依赖：无

- [x] 3.1 字色与背景色同时生效；清除格式对已设背景的选区有效
  - 装饰层改为括号配对扫描，允许 `mdb-*` span 任意嵌套；清除格式把与选区相交的 span 整对纳入范围后解包（保留链接，一次撤销）。
  - 验收：选中文字依次设字色（绿）与背景色（紫）后，选区文字计算 `color` 为绿、计算 `background-color` 为紫，编辑区不出现任何 `<span` 源码文本；接着点「清除格式」后源码不含 `mdb-color-` / `mdb-bg-`。
  - e2e：`e2e/floating-toolbar.spec.ts`（扩展）+ `src/__tests__/editors/decorations/boldItalic.test.ts`（嵌套 span 单测）。
  - 接线归属：无新增导出。

## 4. 页面宽度四档与悬停弹窗

依赖：无

- [x] 4.1 宽度控件四档（720/960/1080/1200）、滑入即开弹窗、滑出全隐、色块对比度提高
  - `StatusBar` 与 `SettingsView` 预设统一为四档；悬停打开弹窗、离开按钮+弹窗并集 200ms 关闭；选中/未选中对比拉开。
  - 验收：悬停宽度控件后弹窗与按钮同时可见，移出 300ms 后两者都不可见；弹窗内恰有 4 个色块，高度按档位递增，选中块填充不透明度 1、未选中 ≤0.45。
  - e2e：`e2e/status-width.spec.ts`（扩展）。
  - 接线归属：无新增导出。

## 5. 页签右键菜单：复制路径迁入 + 移动到文件夹

依赖：无

- [x] 5.1 栏目「更多」移除复制路径；页签右键菜单分隔线下方提供「复制路径」「移动到…」
  - 新增 Rust `move_file`（同目录冲突加后缀、跨设备回退 copy+remove），前端选目录后移动并更新页签路径与资源注册。
  - 验收：栏目「更多」菜单项数由 9 → 8 且不含「复制路径」；页签右键菜单在分隔线下方出现「复制路径」「移动到…」；点「复制路径」剪贴板等于该文件路径；点「移动到…」选目录后文件出现在新目录、页签标题与路径更新、原目录不再有该文件。
  - e2e：`e2e/tab-context-menu.spec.ts`、`e2e/pane-header.spec.ts`（改断言）+ 新增移动用例（mock 桥）。
  - 接线归属：`move_file` 由本票在 `TabBar.tsx` 接线（`pick_folder` → `move_file` → 更新 store 页签路径）。

## 6. 新建文件默认保存路径

依赖：5.1（同触 `src-tauri/commands/file.rs` 与 `file-management` 规格）

- [x] 6.1 设置页可配置默认保存路径，新建文件首次保存落在该路径
  - 配置新增 `default_save_path`（缺省 `None`）；`save_as_file` 支持 `default_dir`；未落盘页签保存不再空转（修既有缺陷）。
  - 验收：在设置页设置默认路径并重启应用后该值仍在；对未保存的新建页签按 `Cmd+S` 弹出保存对话框且初始目录等于默认路径，确认后文件落在该目录、页签变为已保存。
  - e2e：新增 `e2e/settings-default-path.spec.ts`（设置读写 + 首次保存路径）。
  - 接线归属：`default_save_path` 由本票接进 `SettingsView` 与 `App.tsx handleSaveFile`。

## 7. 沉浸模式：PDF 顶栏收起 + 页签栏/PDF 按钮栏浮层

依赖：4.1、5.1（同触 `src/styles/editor.css` / `PaneTreeView.tsx`）

- [x] 7.1 沉浸态 PDF 顶栏 1.2s 无交互自动收起；页签栏与 PDF 按钮栏以浮层呈现，不改变正文高度
  - 沉浸态 `.app-chrome` 改绝对定位浮层；PDF 顶栏经 shadow CSS `transform/opacity` 收起，指针接近顶部复现。
  - 验收：沉浸态打开 PDF，指针移开 1.5s 后顶栏计算 `opacity` 为 0 且正文高度与收起前一致；指针移入顶部 24px 后顶栏恢复可见；指针移入页签热区后页签栏可见且 `position` 为 `absolute`/`fixed`，正文区高度不变。
  - e2e：`e2e/pdf-chrome.spec.ts`、`e2e/immersive-per-pane-tabs.spec.ts`（扩展）。
  - 接线归属：无新增导出。

## 8. 阅读空间 HTML 卡片缩略图稳定显示

依赖：无

- [x] 8.1 左栏滚动到 HTML 文件时卡片缩略图恒可见
  - 按 canonical A-14 移除 iframe 缩略图与并发上限，改为确定性中性占位（类型色底 + 文档字形），无竞态、无加载失败。
  - 验收：最近列表含 ≥6 个 HTML 文件时逐个滚动，每个卡片缩略图区域都不是空白（有可见底色与类型字形），且不出现 `<iframe>`。
  - e2e：`e2e/rail-cards.spec.ts`（扩展：6 个 HTML 卡片逐张断言可见）。
  - 接线归属：无新增导出。

## 9. 胶囊形悬停提示 + 轮盘选项提示

依赖：4.1、6.1、7.1（同触 `App.tsx` / `editor.css`）

- [x] 9.1 全部悬停提示改胶囊形；轮盘各扇区悬停显示中文提示
  - 新增全局 `TooltipLayer`（事件委托把 `title` 迁为 `data-tip` 并渲染自绘胶囊）；`tokens.css` 补 `--radius-full`；轮盘根扇区/二级单元/色条补 `data-tip`。
  - 验收：悬停任意功能按钮 600ms 后出现提示，其计算 `border-radius` ≥ 高度的一半（胶囊），且页面不再出现系统原生矩形提示；悬停轮盘任一扇区显示其中文名提示。
  - e2e：新增 `e2e/tooltip-pill.spec.ts` + `e2e/floating-toolbar.spec.ts`（扩展）。
  - 接线归属：`TooltipLayer` 由本票在 `App.tsx` 根部挂载；轮盘 `data-tip` 由本票在 `roulette-view.ts` 接线。
