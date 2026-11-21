# 任务 — doc-property-refine-1121b

> 切片原则：每张票贯穿「入口 → 行为 → e2e」，做完用户能在界面上看到变化。
> 票标题前缀 `[change=doc-property-refine-1121b/<任务号>]`；1 任务 = 1 票。

## 1. 密度

- [ ] 1.1 密度（胶囊高度 / 计数默认隐藏 / 布尔开关）
  - 交付物：`src/styles/tokens.css` 新增 `--dpb-chip-height` / `--dpb-bool-height` / `--dpb-footer-height`；`src/styles/doc-property.css` 的 `.dpb-chip`、`.dpb-bool`、`.dpb-a-foot`、`.dpb-b-foot` 改为消费变量；`[data-testid="dpb-count"]` 默认 `opacity: 0`，仅 `[data-testid="dpb-count"]:hover` 显现；移除预览态 `.dpb-count-pill` 胶囊外观。
  - 验收要点：胶囊计算高度 = `var(--dpb-chip-height)`；计数默认 opacity 0，指针进入「N 个字段」文字自身才显现，预览态与编辑态一致；布尔开关计算高度 = `var(--dpb-bool-height)` 且保留 `role="switch"` 与 aria 状态；footer 行高 = `var(--dpb-footer-height)`。
  - e2e：量取 `.dpb-chip` 计算高度、`[data-testid="dpb-count"]` 默认与 hover 的 opacity、`.dpb-bool` 计算高度。
  - **数据面**: 规格,存储,校验

## 2. 列对齐

- [ ] 2.1 B 列对齐 + A 空值宽度
  - 交付物：`.dpb-b-row` 名称列改 `--dpb-label-width`（8em）并左对齐，值列左缘统一；名称超 8 汉字不截断，按最长名整列加宽；A 空值输入区 `min-width` 取 200px（或 16ch 较大者）。
  - 验收要点：B 名称列计算宽度 = `var(--dpb-label-width)`；超长名称无省略号；各行值左缘 x 一致；A 空值输入区计算宽度 ≥ 200px。
  - e2e：测量 B 两行值列左缘 x 相等；长名文本无截断；A 空值输入区宽度。
  - **数据面**: 桥接

## 3. 隐藏语义

- [ ] 3.1 隐藏语义 + 页签信息窗入口
  - 交付物：`src/stores/docPropertyPanel.ts` 暴露显隐读写；`DocPropertyBar` 的 `hidden` 分支不再渲染 `.dpb-hidden-note`，编辑态 frontmatter 隐藏经 `src/editors/decorations/frontmatterHide.ts` 单一出口；`src/components/TabInfoPopover.tsx` 在路径行下方新增「隐藏字段 / 显示字段」+「N 个字段」+ `⌘⇧Y` 行。
  - 验收要点：隐藏后不渲染属性面板、不渲染 `---` 源码、不渲染提示条；信息窗行仅活动页签渲染，`N` 与面板 footer 计数同源；点击「显示字段」面板恢复。
  - e2e：隐藏后断言源码 `---` 不可见且无提示条；经信息窗切换回显示后属性面板出现。
  - **数据面**: 回滚

## 4. chip 输入

- [ ] 4.1 chip 输入统一（复选 / 列表 / 标签）
  - 交付物：`FieldValue` 把 `multiselect` 从 `LinkListEditor` 拆出；新增统一 chip 输入（非编辑态不渲染、点击值区进入、Enter 提交后保留空输入框并开已有项菜单、Esc / 失焦 / 点击外部退出）；标签编辑器聚焦即显示全部已知标签（可滚动）、胶囊可拖动排序、删除图标保留；A 胶囊宽度随内容。
  - 验收要点：非编辑态输入框节点数 = 0、编辑态 = 1；Enter 连续两次提交得 2 个 chip 且输入框仍聚焦；`multiselect` 不再出现 `[[ 链接文档`；`array` 保留 `[[` 语义但输入按需出现。
  - e2e：断言输入框计数（0 → 1）与 Enter 两次后的 chip 数及输入框焦点。
  - **数据面**: 无

## 5. 下拉选项

- [ ] 5.1 下拉选项
  - 交付物：新增 `select` 选项菜单（同键已有去重值 + 新增值输入行，当前值高亮）；`multiselect` 复用同构菜单并改多选切换。
  - 验收要点：打开菜单出现已有值行与新增输入行；当前值高亮；选择即写回 YAML；不新增配置或持久化键。
  - e2e：打开菜单、选择已有值并断言 YAML 写入；用新增值行提交并断言 YAML 出现新值。
  - **数据面**: 无

## 6. 折叠三角

- [ ] 6.1 折叠三角（B 在「文档属性」前 / A 在文档名称前）
  - 交付物：`src/ui/icons.ts` 注册 `foldTriangle`（24×24、描边 1.7）；B 标题「文档属性」前、A 文档名称前渲染三角，移除右侧 `.dpb-collapse` 文字按钮；折叠态只保留标题行。
  - 验收要点：三角 x 位于标题文本左侧；右指=折叠、下指=展开；默认不可见，标题行 hover 或面板聚焦时显现；折叠态字段行节点数 = 0。
  - e2e：断言三角 x 在标题左侧、折叠态字段行数为 0、hover 前后 opacity 变化。
  - **数据面**: 消费

## 7. 日期

- [ ] 7.1 日期 / 日期时间
  - 交付物：值区占位符改 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm`；空字段打开面板预置当天日期与当前时刻；时间选择改日历右侧滚轮列（时 + 分、scroll-snap、选中行高亮），日期面板保持仅月历；footer 增加「清除」按钮；`.dpb-dt-hint` 触发面收窄到自身 hover / 键盘聚焦。
  - 验收要点：placeholder 属性值正确；空字段打开时 / 分等于当前时刻（非 00:00）；滚轮列滚动改变选中值；「清除」写回空值并关闭；提示只在自身 hover / 聚焦时可见。
  - e2e：断言 placeholder、空字段打开时 / 分、滚轮滚动改值、清除写回空值。
  - **数据面**: 校验

## 8. 手柄与工具条

- [ ] 8.1 手柄与工具条
  - 交付物：`onHandlePointerDown` 拖动分支不再调用 `applySelection`，单击才选中并显示 `.dpb-ops`；`.dpb-ops` 改为悬浮在标题行水平居中的胶囊（全圆角、中性表面色），不再占用 body 一行。
  - 验收要点：拖动排序后选中集不变且 `.dpb-ops` 节点数 = 0；单击手柄后 `.dpb-ops` 节点数 = 1；工具条中心与标题行中心水平偏差 ≤ 2px。
  - e2e：拖动断言无 `.dpb-ops`、单击断言有；量取工具条与标题行中心偏差。
  - **数据面**: 无
