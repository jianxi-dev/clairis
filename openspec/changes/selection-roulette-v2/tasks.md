# Tasks: 选区轮盘工具条重制

> 批准设计：`docs/design/approved/selection-roulette/README.md`（2026-11-09 第七至第九轮）。
> 原型：`docs/design/approved/selection-roulette/prototype.html`。
> 垂直切片：每票做完都能在真实页面上看到变化；票间按 Blocked by 排。
> 视觉锚点（每票通用）：`design-system:§2.1;§4;§5;§6` + `ledger:选区轮盘`。

## 1. 轮盘几何、渲染与出现时机

依赖：无

- [x] 1.1 轮盘几何、SVG 渲染、三层外环、颜色双圈与出现时机
  - `roulette.ts` 常量对齐原型：根环 30–86、二层 92–122、三层 126–152、颜色 90–106 / 111–127、格宽 15°、缝隙 0.35°、画布 420、标签半径 60、圆心 31；新增 `sectorPath` / `angleOfPoint` 纯函数。
  - `roulette-view.ts` 改 SVG 扇形：根环 8 个 45° 扇区（`data-testid="sector-<id>"`）、图标 14px + 标签 11px 落在半径 60、圆心按钮独立。
  - 二层 92–122、三层 126–152：三层不替换二层，二层保留并降到 0.7；三层中心取被点击二层区块中心角；圆心在三级时变 `‹` 返回；展开下级后根环 0.7。
  - 颜色双圈：内圈 9 段文字色（平切 A、默认 A/）、外圈 16 段背景色；点击即时套用且轮盘保持展开。
  - 出现时机：`pointerdown` 取消待开计时，按住拖选不出现，`pointerup` 后 90ms 在鼠标落点出现；键盘选区用末端 rect；删除圆心死区；420×420 夹进视口。
  - 点击展开 / 再点收回；离开整轮 400ms 收回下级；`Esc` 逐层；数字键 1–8 直达；滚轮/方向键移动高亮 + `Enter`；`Ctrl+F` 独立筛选面板（输入框不重建）。
  - `src/styles/editor.css` 全部 `sr-*` 规则替换为扇形样式（CSS manifest 通过），三主题只用 `--app-*` / `color-mix`。
  - 单测 `src/__tests__/editor/roulette.test.ts`：扇区角度、扇形 path 边界、夹取、层级透明度、颜色环 9/16 段。
  - 验收：选中文字后根环是 8 个实心扇形方位块；拖选期间轮盘不含任何节点；点「格式」后 6 格扇形紧排在一侧；点「标题 ›」后 H1–H6 出现在更外一圈，二层仍可见且变淡；贴近右下角不越界。
  - 接线归属：`roulette-view` 由 `floating-toolbar.ts` 调用；样式落 `src/styles/editor.css`。

## 2. 命令与标注类型补全

依赖：1.1

- [x] 2.1 转换/格式/对齐/分栏/历史命令与全部标注类型
  - 转换二层：段落 7 项（代码块 / 表格 / 标题 › / 列表 › / 高亮 › / 引用 / 分割线），光标已在标题时多「正文」。
  - 标题三层 H1–H6；列表三层 无序/有序/待办；高亮三层 **提示/信息/注意/警告/危险** 五类，落 `> [!tip|info|note|warning|danger]`。
  - 格式二层顺序 链接 / 下划线 / 斜体 / 加粗 / 行内代码 / 删除线，使用 `icons.ts` 语义图标。
  - 对齐 5 项用 `alignLeft` / `alignCenter` / `alignRight` / `indent` / `outdent`；分栏 1–5 各画栏数图标；历史 4 项用 undo / redo / copy / trash。
  - 格式刷、清除格式、后退/前进回归：无死区、幂等、保留链接、共用历史。
  - e2e 扩展 `selection-roulette.spec.ts`：段落 7 项 / 标题 8 项 / 高亮 5 类 / 格式顺序 / 命令写入源码。
  - 验收：段落里打开「转换」看到 7 项；标题里看到 8 项；选「六级标题」源码变 `###### `；选「注意」源码变 `> [!note]`；「格式」六项顺序与批准稿一致且都有图标。

## 3. HTML 源码编辑态改横条

依赖：无（与 1–2 文件不重叠）

- [x] 3.1 HTML 源码编辑态使用横向文字工具条
  - `floatingToolbar(style)` 支持 `roulette` / `bar`；`bar` 渲染 `.cm-floating-toolbar`（AI 改写/翻译/润色 + 加粗/斜体/下划线/删除线/行内代码/链接/对齐/字色/清除格式）。
  - `ContentArea.createLanguageExtension` 对 `markdown` 挂轮盘、对 `html`/代码类挂横条；`setup.ts` 公共装配不再无条件挂轮盘。
  - 横条定位在选区上方、不遮挡选区；按钮作用于选区并写回源码；轮盘节点数为 0。
  - `src/styles/editor.css` 补齐 `.cm-floating-toolbar` 规则（CSS manifest 通过），三主题可读。
  - e2e 改写 `html-source-roulette.spec.ts`：横条在、轮盘不在、加粗写回源码。
  - 验收：打开 `.html` 源码模式选中一行文字，出现横向工具条，轮盘扇区节点数为 0；点加粗源码被 `**` 包裹；再点一次取消。

## 4. HTML 可视化拖拽修复

依赖：无（与 1–3 文件不重叠）

- [ ] 4.1 HTML 可视化拖拽的跟随幽灵与稳定落点
  - 越过 4px 后创建跟随指针的元素幽灵（fixed、pointer-events none、opacity 0.9），原元素加 `.cm-drag-source`。
  - 落点 6px 滞回：指针越过目标中线 ±6px 才切换 before/after；指示线只在候选变化时改位置。
  - `mouseup` 提交一次 `moveNode` 并幂等清理幽灵/类名；拖进自身子树仍拒绝。
  - 截图模式与文本编辑态不进入拖拽；保存零残留。
  - e2e 扩展 `html-edit-drag-capture.spec.ts`：幽灵出现、落点稳定、顺序交换可撤销。
  - 验收：可视化编辑态按住第二段拖动，半透明幽灵跟着指针；经过第一段时指示线稳定停在上/下半区不再跳；松手后顺序交换且可一次撤销。

## 5. 编辑态停用选区胶囊（E-18）

依赖：1.1、2.1

- [ ] 5.1 编辑态停用选区胶囊，AI 三动作归轮盘
  - `detectSelectionPillMode` 对编辑态返回 `null`；阅读态分支不动；`SelectionPill` 组件保留。
  - 编辑态选中文字只出现轮盘；轮盘「智能」扇区改写/翻译/润色带入选中文本。
  - 单测 `selectionPillMode.test.ts` 与 e2e `selection-pill.spec.ts`：编辑态反转为「轮盘在、胶囊不在」，阅读态保持。
  - 验收：MD 编辑态选中一段文字，DOM 中 `[data-selection-pill]` 节点数为 0；点「智能」→「改写」打开 AI 浮层且输入框带选中文本；阅读态胶囊照常出现。

## 6. 收尾

依赖：1.1–5.1

- 6.1 QG-5 证据：`.artifacts/<票号>/state-coverage.json` 至少 4 态（隐藏 / 根环 / 二层 / 三层 + HTML 横条），截图 + 断言（在各票内产出，不单独成票）
- 6.2 视觉数值落 `docs/design/system/decisions.md` 一行「选区轮盘」
- 6.3 `bash scripts/verify.sh` 全绿
