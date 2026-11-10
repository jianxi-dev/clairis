# Design: 第十二批真机走查（ui-polish-batch12）

## 1. 背景与失败模式

9 条需求分三类：**回归**（R-2 二级菜单滑出消失，batch10 #497 已交付过）、**既有缺陷**（R-3 行内格式叠加/清除、R-8 HTML 缩略图偶发空白、R-1 自动播放）、**能力缺口**（R-4 四档宽度、R-5 移动文件、R-6 默认保存路径、R-7 胶囊提示、R-9 沉浸浮层）。

每条都对应一处可定位的实现事实，不靠猜测：

| 需求 | 实现事实（勘察结论） |
|---|---|
| R-1 | `VideoPlayer.tsx:670 autoplay: true` + `:676 autoPlayback: true` + `:1024-1038` ready 时读 `artplayer_settings` 并 `art.play()`；重启时 `useConfig.ts:172-221 restorePaneLayout` 重开媒体文件 → 重新挂载播放器 → 自动播放 |
| R-2 | `block-menu.ts` 的颜色/对齐二级面板调 `keepColorPanelOpen`（`:506`/`:604`）把父菜单钉住，**类型二级面板（`:373-418`）没有调用** → 指针离开后 150ms 被 `scheduleClose` 收掉；设计规则见 `docs/design/approved/popup-lifecycle/spec.md` R1/R3 |
| R-3 | `decorations/boldItalic.ts:22 spanBody` 只允许文本与 `<u>`，**不允许嵌套 `<span>`** → 外层字色 span 不被装饰、标签以源码形式漏出；`floating-toolbar.ts:137-150 clearFormatting` 只对**选区原文**剥标签，而 `toolbar-shared.ts:115-124` 应用颜色后把选区设到**标签内部** → 标签在选区外 → 正则无匹配 → 提前 return |
| R-4 | `StatusBar.tsx:10-14 WIDTH_PRESETS` = 720/960/1200；`SettingsView.tsx:108-112` = 720/1080/1200（不一致）；弹窗只在 click 打开（`widthOpen`），hover 只让按钮淡入（`editor.css:2668-2680`） |
| R-5 | `paneHeaderMenu.ts:49 copyPath` 在栏目菜单；`TabBar.tsx:479-482` 是既有分隔线；Rust 无任何用户可见移动命令；`file.rs:368 pick_folder` 已存在但前端未用 |
| R-6 | `config.rs AppConfig` 无默认路径字段；`App.tsx:161-173 handleSaveFile` 对 `path === null` **直接 return**（未落盘文件无法保存，既有缺陷）；`useFile.ts` 是死代码 |
| R-7 | 全仓**没有自绘 tooltip**，只有原生 `title=`（约 80 处、20 个文件）；原生提示由系统绘制，只能是矩形 |
| R-8 | `railView.ts:19 HTML_IFRAME_CAP = 4` + `ReadingRail.tsx:95-103 acquireHtmlThumb` 失败不重试，列表不虚拟化 → 第 5 个起永远占位；且 canonical `reading` spec A-14 明确要求「中性占位图，不伪造 HTML 页面缩略图」 |
| R-9 | `editor.css:988-992` 用 `max-height` 就地展开页签条（推挤正文）；PDF 顶栏在 EmbedPDF shadow DOM 的 `[data-epdf-i="main-toolbar"]`，`PdfViewer.tsx:78-100 injectPdfUiCss` 可注入样式但无任何收起逻辑 |

## 2. 决策

### D1 视频起播态（R-1）
- `autoplay: false`、`autoPlayback: false`；ready 时**只 seek 不 play**（保留「看到哪儿」的连续性，但不自动出声）。
- 多路并行：架构已按 `paneId` 持有独立 `ArtPlayer` 与 `<video>`（`mediaPlayerState.ts`、`MediaPlayerHost.tsx`），无全局静音/单例音频 owner。本票不改架构，只补齐验收（两格各自 play、`muted === false`、两个 `<video>` 都在播放）。
- 不恢复「播放中」状态：重启后一律暂停。

### D2 二级菜单常驻（R-2）
- 类型二级面板补 `keepColorPanelOpen` 等价调用（与颜色/对齐一致），释放时机 = 显式关闭（Esc / 外部 pointerdown / 菜单重建）。
- 间距按 popup-lifecycle R2：二级面板与父菜单的 4px 间隙由面板透明内边距桥接，不靠空白。
- 不改父菜单「离开 150ms 收起」的默认行为；只要二级开着就 `isKeepOpen` 短路。

### D3 行内字色 + 背景色叠加与清除（R-3）
- **装饰层**：把 `decorations/boldItalic.ts` 的正则匹配换成**括号配对扫描**（栈式）：扫描 `<span class="mdb-{family}-{variant}">` 与 `</span>`，允许任意层嵌套；外层与内层各自产出 `Decoration.replace`（标签隐藏）+ `Decoration.mark`（内容着色/背景）。CM6 mark 可重叠，内外层样式自然叠加。
- **清除格式**：新增 `expandToEnclosingSpans(text, from, to)`——把与选区相交的 mdb span **整对**纳入操作范围（迭代到稳定），再剥标签；保持链接 `[text](url)` 不动；一次 `view.dispatch` 可撤销。`horizontal-toolbar` 同法。
- **CSS**：`.cm-color-*` 与 `.cm-bg-*` 均为平铺类，重叠 mark 即可叠加；预览侧 `reader.css` 靠 `color` 继承已正确，不改。

### D4 页面宽度四档（R-4）
- 统一三处为一套：`720 / 960 / 1080 / 1200`，色块高度 `14 / 17 / 20 / 23`（档位递增，属控件几何、非间距刻度）。
- 悬停：指针进入宽度控件容器 → 打开弹窗；离开「按钮 + 弹窗」并集 200ms 后一起关闭（popup-lifecycle R1/R2/R3：进入取消、桥接内边距、Esc/外部 pointerdown 关闭）。
- 对比度：未选中 `opacity .35` + 描边，选中 `opacity 1` + accent 实色，尺寸差保留。
- `SettingsView` 预设与 `StatusBar` 对齐（消除 960/1080 分歧）；默认仍 1080。

### D5 页签右键菜单与移动文件（R-5）
- 栏目「更多」删除 `copyPath`（`paneHeaderMenu.ts` + `PaneTreeView.tsx` 分支）。
- 页签右键菜单在既有分隔线**下方**追加：`复制路径`、`移动到…`；顺序：`悬浮小窗 / 向右分栏 / 向下分栏 ── 复制路径 / 移动到… / 关闭 / 关闭其他`。
- 移动：新增 Rust `move_file(from, to_dir)` → 返回新路径；同目录同名冲突追加 `-1/-2`；跨设备 `rename` 失败时回退 copy+remove；失败返回 Err 不改状态。
- 前端 `pick_folder` 选目标目录 → `move_file` → 更新页签 `path`（并重新注册资源路径，使缩略图/相对资源继续工作）→ notice 提示。

### D6 新建文件默认保存路径（R-6）
- Rust `AppConfig` 新增 `default_save_path: Option<String>`（`serde(default, skip_serializing_if = "Option::is_none")`），缺省 `None` = 原行为。
- `save_as_file` 增可选 `default_dir`，用 dialog `set_directory` 定位初始目录（不改变「用户确认文件名」的既有契约 C-4）。
- `handleSaveFile`：未落盘页签不再直接 return，而是走 `save_as_file`（`default_name = 标题`、`default_dir = config.defaultSavePath`），成功后写回 `path`；这同时修掉「新建文件无法保存」的既有缺陷。
- 设置页新增「文件」分区：默认保存路径（只读展示 + 选择 / 清除）。

### D7 胶囊提示（R-7）
- 新增 `TooltipLayer`：全局 `pointerover/pointerout` 事件委托，把元素的 `title` 迁移为 `data-tip` 并渲染**自绘胶囊**（`--radius-full`，`--app-surface` 底 + `--app-shadow`，延迟 400ms，边界翻转）。
- 这样**约 80 处既有 `title=` 零改动**即获得胶囊形态；原生矩形提示不再出现（首次悬停即摘除 `title`）。
- 轮盘：`roulette-view.ts` 给根扇区 path、二级单元、色条补 `data-tip`（中文名），悬停即显示胶囊提示；根扇区既有常显标签保留（不冲突）。
- `tokens.css` 补 `--radius-full: 999px` 与 `--radius-4/--radius-8`（此前只在 `editor.css` 以 fallback 形式引用，属实现漂移）。

### D8 阅读空间 HTML 缩略图（R-8）
- **按 canonical A-14 收敛**：移除 HTML iframe 缩略图与 `HTML_IFRAME_CAP` 机制，改为**确定性中性占位**（类型色底 + 文档字形 + 文件名首字母），恒可见、无竞态、无加载失败。
- 理由：A-14 明文「中性占位图，不伪造 HTML 页面缩略图」；`e2e/rail-cards.spec.ts:412-430` 现有断言已是中性占位。若日后要真缩略图，须先 supersede A-14，不在本 change 内。
- 冲突显式记录：proposal 初稿写「可见时才生成、失败可重试」，经勘察后按规范收敛为占位；本文为准。

### D9 沉浸态浮层（R-9）
- **PDF 顶栏**：`injectPdfUiCss` 注入 `[data-epdf-i="main-toolbar"]{ transition: opacity .25s, transform .25s }`；容器加 `pdf-chrome-idle` 类时 `opacity:0; transform:translateY(-100%); pointer-events:none`。只在沉浸态启用；指针进入顶部 24px 或容器内移动重置 1.2s 计时。用 `transform` 而非 `display:none`，保证收起/浮现都不改变内容布局（浮动语义）。
- **页签栏**：沉浸态把每格 `.app-chrome` 改为 `position: absolute`（脱离流），`data-immersive-peek="true"` 时以 `max-height/opacity` 浮出并加 `--app-surface` 底 + `--app-shadow` + 圆角；因为绝对定位，展开不再推挤正文。热区与 400ms 收起逻辑不变。
- 复用 `docs/design/approved/popup-lifecycle/spec.md` 与 #484「浮层不占流式高度」原则。

## 3. 风险与回滚

- 风险：R-7 全局 `title` 迁移事件委托可能影响 iframe 内元素与 `title` 语义；缓解：`data-no-tip` 白名单 + 保留 `aria-label`，e2e 断言计算 `border-radius` 与 `::after`/浮层可见性。
- 风险：R-3 扫描器跨行/跨块误配；缓解：以「最近未闭合 span」配对，且只处理 `class="mdb-*"` 的 span，其余 `</span>` 计为普通闭合；单测覆盖三层嵌套与不配对场景。
- 风险：R-9 绝对定位页签栏在非沉浸态不受影响（作用域限定 `.immersive`）。
- 回滚：每票独立 PR，`git revert` 即可；无数据迁移，配置新字段向后兼容。

## 4. 不做

见 proposal「Non-goals」。另：不清理 `ImmersivePeekBar.tsx` 死代码（不在本次范围，但票上记录为已知发现，按 QG-8 转 issue 或标注）。
