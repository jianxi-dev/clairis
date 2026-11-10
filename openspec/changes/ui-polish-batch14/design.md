# Design: 第十四批真机走查（ui-polish-batch14）

## 1. 现状与失败模式

| 需求 | 实现事实（勘察结论） |
|---|---|
| #566 透明度 | 三层展开时轮盘本体透明度由 `roulette.ts` 的 `SUB_DIM_OPACITY` 与 `editor.css` 的 `.selection-roulette.sub-open .sr-sector` 共同决定，当前值低于用户要求的 90%。 |
| #566 高亮块图标 | `src/editors/decorations/callout-emoji.ts` 的覆盖表按类型序号存值，`CalloutWidget.toDOM` 优先读覆盖值，类型切换后仍显示旧图标（batch13 已定位、未修复）。 |
| #2 音频 | `fileTypeOf` 已把 mp3/wav/m4a/flac/ogg 归为 `audio`，`PreviewView.tsx:218` 也把 audio 交给媒体播放器；但用户实际打开 MP3 得到 `FPDF_LoadMemDocument failed`，说明存在一条把音频送进 `PdfViewer` 的路径（`PreviewView.tsx:216`）。**票内必须先复现并定位真根因（DQ-2），不得按假设直接改**。 |
| #1 全屏时间戳 | 时间戳为播放器内浮层，全屏时被父级层叠上下文/全屏容器裁剪（需票内探针确认具体节点）。 |
| #1 播放列表记忆 | 播放列表当前项只存组件内状态，未写入配置/state，重启回到首个视频。 |
| #1 窄宽按钮 | 右侧按钮组为固定间距 flex，无「先挤间距、再缩图标」的两级降级。 |
| #1 多画中画 | 播放器实例与画中画容器按单例设计，多视频互相顶掉。 |
| #5 循环图标 | 播放列表顶部渲染了循环按钮，用户要求移除。 |
| #14 页签静音 | `TabBar.tsx` 无静音入口，播放器静音状态未外露。 |
| #3 前进后退 | CM6 有 `history`，但 App 全局 keydown 未绑定 `cmd/ctrl+[` / `cmd/ctrl+]`。 |
| #8 小窗编辑态 | `FloatingPreview.tsx` 正文为只读渲染，切编辑态仍渲染源码。 |
| #9 胶囊 | `capsule-toolbar.ts` 为双层大胶囊；`floating-toolbar.ts` 的 `capsuleItems()` 只挑部分动作，未覆盖轮盘全部功能。 |
| #10 转换菜单 | `block-menu.ts` 的 `ACTION_ROWS` / `ALIGN_INDENT_ITEMS` 无图标；二级菜单隐藏依赖 hover 时序，滑出后仍残留。 |
| #11 任务图标 | 轮盘 convert 的「任务」项 icon 与 action 绑定错位（点击后落到高亮转换）。 |
| #12 列表同级转换 | `blockConvertChanges` 只处理当前块；选中多块同级列表时不整体转换，有序列表未自动编号。 |
| #4 弹窗对齐 | `paneHeaderMenu` / `ContextMenu` 以按钮矩形边缘锚定，未以图标中心为锚点。 |
| #6 提示延迟 | 用户原文「停顿半分钟后显示」，30s 与 300ms 量级差距过大；标 open-question，未确认前不排期。 |
| #13 导出 | `paneHeaderMenu.ts` 的 `EXPORT_MENU_ITEMS` 当前顺序为 HTML/图片/Word/.mdpkg/ZIP，且无 PDF 动作；需按 word、mdpkg、图片、pdf、html、zip 重排并新增 PDF（复用 md-bundle）。 |

失败模式：把 14 项当一张大票一次改完，会让回归与能力混在一起、无法逐项验收；必须按「回归 → 音频 → 视频 → 编辑 → 一致性 → 导出」拆成垂直切片。

## 2. 决策

### D1 回归优先
`#566` 两项先修：透明度改 90%（视觉常量按 design-system 条款引用，不写像素）；高亮块图标改为「按当前类型取默认图标，覆盖值仅在原类型生效」。

### D2 音频先复现再修
票内先用真实 MP3 复现 `FPDF_LoadMemDocument failed`，定位是哪条路径把 audio 送进 PdfViewer；修复必须落在分流点，不在 PdfViewer 内打补丁。

### D3 视频按「播放核心 / 布局手势」两票拆
核心票：全屏时间戳、播放列表记忆、循环图标移除、页签静音；布局票：窄宽两级降级、双指音量/亮度、多画中画。两票共享 `VideoPlayer.tsx`，后者 Blocked by 前者。

### D4 编辑票按组件边界拆
导航快捷键（App）、小窗编辑态（FloatingPreview）、胶囊（capsule-toolbar + floating-toolbar）、转换菜单与列表（block-menu + block-convert）各自独立，避免同文件冲突。

### D5 弹窗对齐统一锚点
新增/复用一个锚点函数：以按钮图标中心为基准，弹窗中心对齐该点；超出视口时按最短路径夹取（沿用 D13 最短路径原则）。

### D6 导出顺序与 PDF
`EXPORT_MENU_ITEMS` 重排为 word、mdpkg、图片、pdf、html、zip；PDF 动作复用 md-bundle 既有导出能力，不新写渲染器。

### D7 open-question 不阻断
`#6` 提示延迟标 open-question，未确认前不排期；其余 13 项不受阻。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 图标尺寸只允许 14/18/24；透明度按语义色/层级条款引用 |
| 存储 | src-tauri/src/config.rs | roulette_sectors | 本批不新增字段，沿用既有配置；播放列表记忆写 state |
| 校验 | src-tauri/src/config.rs | validate_config | 既有白名单/范围；新增 state 字段不参与用户配置校验 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 既有归一化；本批不新增桥接分支 |
| 消费 | src/editors/orchestration/roulette-view.ts | createRoulette | 透明度与高亮块图标在渲染层生效 |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照 10 份；播放列表记忆可清空回落首个 |

## 3. 风险

- **同文件冲突**：视频两票都改 `VideoPlayer.tsx`，用 Blocked by 串行；编辑四票分别落在不同文件。
- **回归票与能力票混排**：`#566` 先合并，避免后续视觉调整掩盖回归。
- **音频根因未定**：D2 要求先复现；若根因在打开流程而非渲染分流，票内更正根因后再修（DQ-2）。
- **PDF 导出依赖 md-bundle**：先确认其导出入口与产物约束，再接线；不复用失败则票内记录并降级为「先隐藏 PDF 项」。
