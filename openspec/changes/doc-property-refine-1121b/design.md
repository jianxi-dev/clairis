# 设计 — doc-property-refine-1121b

来源：spec issue #1311（用户 2026-11-21 反馈 11 项优化 + 截图证据）。既有规格：`openspec/specs/doc-property-panel/spec.md` 的 P-1 / P-3 / P-4 / P-5 / P-10、托管日期只读展示、控件悬停显隐与折叠淡出。规格 delta 由并行 agent 写入 `specs/doc-property-panel/spec.md`，本文件只描述实现决策。

## 现状与差距

- **密度**：`.dpb-chip` 为 `padding: 2px 6px` 且继承正文 `line-height: 1.78`，单行胶囊实测约 36px 高；`.dpb-bool` 为 `font-size: 11px` + `padding: 2px 10px` + 1px 描边，约 26px 高；footer `.dpb-a-foot` / `.dpb-b-foot` 恒渲染，`[data-testid="dpb-count"]` 恒可见，预览态额外挂 `.dpb-count-pill`（描边 + 全圆角 + 下沉底）。
- **列对齐**：`.dpb-b-row` 网格为 `16px auto minmax(0, max-content) minmax(0, 1fr) 18px`，名称列 `.dpb-b-label` 走 `max-width: var(--dpb-label-max-width, 16em)` + 省略号；A 空值输入走 `.dpb-input`（`flex: 1 1 140px`），点击区偏窄。
- **隐藏语义**：`hidden` 为 `src/stores/docPropertyPanel.ts` 的全局布尔；隐藏分支渲染 `.dpb-hidden-note`（「已隐藏，按 ⌘⇧Y 恢复」），编辑态 frontmatter 隐藏依赖 `src/editors/decorations/frontmatterHide.ts` 的 decoration。
- **chip 输入**：`FieldValue` 把 `array` 与 `multiselect` 一起路由到 `LinkListEditor`（占位符 `[[ 链接文档`），输入框 `.dpb-link-input` 常驻；标签 `TagEditor` 有 `.dpb-tag-input`（占位符 `+ 标签`）与 `SuggestMenu`；`select` 无编辑分支，回落 `ValueEditor` 自由文本框。
- **折叠**：折叠控件是右侧工具组里的 `.dpb-collapse` 文字按钮（「⌃ 折叠 / ⌄ 展开」），折叠态靠 `.dpb-panel.dpb-collapsed` 的 `opacity` 淡出。
- **日期**：`DatetimeEditor` 的值区占位符为「选择日期」/「选择日期时间」；空值打开面板草稿为空、时间落到 00:00；时间控件是 `TimeStepper`（文本 + ▲▼）；底部 `.dpb-dt-hint` 在 `.dpb-dt-foot:hover` / `:focus-within` / `:focus-visible` 时显现。
- **手柄与工具条**：`onHandlePointerDown` 在拖动开始（超过 `DRAG_THRESHOLD`）时调用 `applySelection([id])`，因此拖动会选中并弹出 `.dpb-ops`；`.dpb-ops` 渲染在 body 顶部，`border-radius: var(--radius-4)`、`margin-bottom: 8px`，占用一行。
- **页签信息窗**：`src/components/TabInfoPopover.tsx` 现为三行（`tab-info__name` / `tab-info__path` / `tab-info__time`），无字段显隐入口。

## 决策

### D1 密度 token 化（胶囊 / 布尔 / footer 行高）

在 `src/styles/tokens.css` 新增三个密度 token：`--dpb-chip-height`、`--dpb-bool-height`、`--dpb-footer-height`，数值由 `docs/design/system/spec.md` §7.2 / §7.6 给出。`src/styles/doc-property.css` 的 `.dpb-chip`、`.dpb-bool`、`.dpb-a-foot`、`.dpb-b-foot` 改为消费变量，组件内不写死像素；回退值只作为变量缺失时的兜底，不得成为第二真相源。布尔开关保留 `role="switch"` 与 `aria-checked` / `aria-label`，只改高度。

### D2 footer 计数显隐触发面收窄到文字自身

`[data-testid="dpb-count"]` 默认 `opacity: 0`，仅当指针进入该文字元素自身（`[data-testid="dpb-count"]:hover`）时恢复可读；触发面不是整个 footer 行或面板。预览态与编辑态一致：移除 `.dpb-count-pill` 的描边胶囊外观，两态都只渲染纯文本计数。footer 行高取 `--dpb-footer-height`（较现状减半）。托管日期的显隐规则不变。

### D3 B 列对齐与超长整列加宽

`.dpb-b-row` 名称列改固定 `--dpb-label-width`（8em），名称 `text-align: left`，值列左对齐且各行值左缘 x 一致。名称超过 8 个汉字时不做省略号截断，改为按当前面板内最长实际名称整列加宽（所有值起始位置一起右移）；实现上读 `--dpb-label-width` 作为基准，超长时用内联宽度覆盖，不回退成固定 92px。

### D4 A 空值输入区最小可点宽度

A 模式空值字段的输入区默认 `min-width` 取 200px（或 16ch，取较大者），保证空值也有可点击的编辑入口；非空值仍按内容自适应，不拖出长空白尾。

### D5 隐藏语义单一出口

`hidden` 为唯一开关。隐藏态不渲染属性面板、不渲染 frontmatter 源码块、不渲染 `.dpb-hidden-note`；恢复入口不再依赖正文内的提示条。编辑态 frontmatter 源码的隐藏继续经 `src/editors/decorations/frontmatterHide.ts` 的 `createFrontmatterHideDecorations` 单一出口，保留既有「选区触及该块时临时显现」的安全行为；源码模式仍显示完整 YAML。回滚只需切回 `hide` 分支。

### D6 页签信息窗字段显隐入口

`TabInfoPopover.tsx` 在路径行（`tab-info__path`）下方新增一行：文字按钮「隐藏字段」/「显示字段」+「N 个字段」+ `⌘⇧Y` 说明；`N` 与面板 footer 计数同源。该行仅当信息窗所属页签为活动页签时渲染。

### D7 chip 输入按需渲染与 Enter 续录

复选（`multiselect`）、列表（`array`）、标签三处统一为按需输入：输入框只在编辑态渲染，点击值区进入编辑；Enter 提交当前项后保留一个空的聚焦输入框继续录入下一条，并打开已有项菜单；Esc / 失焦 / 点击外部退出并隐藏输入框。`multiselect` 不再路由到 `LinkListEditor`，不再出现 `[[ 链接文档`；`array` 保留 `[[` 语义但输入框按需出现。A 模式胶囊宽度随内容，不留长空白尾。

### D8 标签全量建议、拖动排序与删除图标

标签编辑器聚焦/点击即显示全部已知标签（无需先输入），列表可滚动；标签胶囊支持拖动排序；删除图标保留。复用既有 `SuggestMenu` 的键盘语义（↑↓ 换选、⏎ 选用、⌘/Ctrl+1~9 直选）。

### D9 下拉选项菜单

`select` 值区改为打开选项菜单：行集 = 当前打开页签中同键的已有去重值 + 一个「新增值」输入行；当前值高亮。`multiselect` 复用同一菜单并改为多选切换。不新增任何配置或持久化键。

### D10 折叠三角、日期面板与手柄工具条

- **折叠三角**：折叠控件从右侧文字按钮改为标题行内的倒三角——B 在「文档属性」前、A 在文档名称前；右指=折叠、下指=展开，默认不可见，标题行 hover 或面板聚焦时显现；折叠态只保留标题行。图形经 `src/ui/icons.ts` 注册表新增 `foldTriangle`（24×24、描边 1.7），不内联一次性 SVG。
- **日期 / 日期时间**：值区占位符显示格式 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm`；空字段打开面板时预置当天日期与当前时刻（不是 00:00）；时间选择改为日历右侧的滚轮列（时 + 分，scroll-snap，选中行高亮），日期面板保持仅月历；面板 footer 增加「清除」按钮，点击写回空值并关闭；`.dpb-dt-hint` 的触发面收窄到提示文字自身 hover 或获得键盘焦点，不再是整条 footer 行。
- **手柄与工具条**：单击行手柄才选中并显示 `.dpb-ops`；拖动排序走原落点逻辑，但不调用 `applySelection`、不改变选中集、不弹工具条。`.dpb-ops` 从 body 顶部一行改为悬浮在标题行水平居中的胶囊（全圆角、中性表面色）。

### D11 信息窗显隐行图标

显隐行按钮前置状态图标，复用图标注册表的成对概念（§2.4 可逆动作成对）：面板可见（按钮「隐藏字段」）渲染 `eyeOff`，面板隐藏（按钮「显示字段」）渲染 `eye`；图标经 `src/ui/icons.ts` 渲染，不内联一次性 SVG。图标只做状态指示，不新增点击区，不改计数与 `⌘⇧Y` 说明。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§7.2, §7.6 | — | 密度数值唯一来源；新增或变更数值必须先有 spec 条款 |
| 存储 | src/styles/tokens.css | --dpb-chip-height | 唯一数值定义处，组件不写死像素 |
| 校验 | src/styles/doc-property.css | dpb-chip | 组件只消费变量，回退值不得成为第二真相源 |
| 桥接 | src/components/Content/DocPropertyBar.tsx | dpb-label-width | 列宽读变量，超长时整列一起加宽 |
| 消费 | src/ui/icons.ts | foldTriangle, eyeOff | 折叠三角与信息窗显隐图标走注册表，不得内联一次性 SVG |
| 回滚 | src/editors/decorations/frontmatterHide.ts | createFrontmatterHideDecorations | 隐藏语义单一出口，回滚只切 hide 分支并回落到显示态 |

## 规格冲突（Δ 清单）

以下条款由并行 agent 写入 `specs/doc-property-panel/spec.md`，本文件只登记冲突点，不复制其措辞：

- **P-1**：现「`⌘⇧Y` 隐藏面板后恢复显示完整源码块」与本 change「隐藏后不渲染源码块、不渲染提示条」冲突；恢复入口改为页签信息窗。
- **P-3**：现「下拉（选项可维护）」缺实现，本 change 落地选项菜单；「复选组」与「`[[` 文档链接菜单」拆分为两个编辑器；日期占位符、空值预置当前时刻、时分滚轮列、清除、底部提示触发面均需修订。
- **P-4**：现「点击行手柄选中、拖动排序」需补充「拖动不改变选中集、不弹工具条」；操作条落位由 body 行改为标题行居中悬浮胶囊。
- **P-5**：标签编辑态需补充「聚焦即显示全部已知标签、可滚动、可拖动排序」。
- **P-10**：胶囊高度、footer 计数显隐、B 列宽口径需修订；预览态计数胶囊条款废止。
- **托管日期只读展示**：现「计数恒显示」与本 change「计数默认隐藏、指针进入文字自身显现」冲突。
- **控件悬停显隐与折叠淡出**：折叠控件由右侧文字按钮改为标题前倒三角。
- **新增 P-11**：页签信息窗字段显隐入口。

## 验证策略

- 密度与列对齐用计算样式断言（`getComputedStyle` 的高度 / opacity / 宽度 / 水平位置），不用元素存在性代替数值。
- 交互语义用状态迁移断言（隐藏 → 显示、编辑态输入框计数 0→1、拖动 → 无工具条）。
- 每个用户可见改动在 `e2e/doc-property-panel.spec.ts` 或 `e2e/tab-info-popover.spec.ts` 有对应用例；锚点表 `anchors.md` 的 `assert` 全部可机读。
- 单测覆盖纯函数部分（列宽计算、选项去重、日期草稿预置），e2e 覆盖浏览器可观测行为。
