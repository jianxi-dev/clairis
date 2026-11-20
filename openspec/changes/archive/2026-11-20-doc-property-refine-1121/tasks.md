# 任务 — doc-property-refine-1121

> 切片原则：每张票贯穿「入口 → 行为 → e2e」，做完用户能在界面上看到变化。
> 票标题前缀 `[change=doc-property-refine-1121/<任务号>]`；1 任务 = 1 票。

## 1. 缺陷修复

- [x] 1.1 tags 字符串崩溃修复
  - 交付物：`src/lib/frontmatter.ts` 新增 `toListValue` 归一函数，`formatFrontmatterValue` 的列表分支改用之，标签行识别不再要求值为数组。
  - 验收要点：`tags: "#"` 打开后抛错次数 = 0、按单元素列表展示；未编辑时保留原文，首次编辑后按列表写回。
  - e2e：打开含 `tags: "#"` 的文档不崩，属性面板字段行显示 1 个列表项。
  - **数据面**: 无

- [x] 1.2 时间输入框 Tab 键修复
  - 交付物：`src/components/Content/DocPropertyBar.tsx` 面板容器对 `keydown` 的 Tab 做显式处理（`preventDefault` + 面板内焦点移动 + `stopPropagation`）。
  - 验收要点：面板内 Tab 不写入正文；文档首字符仍为 `-`；`setFrontmatterField` 未被调用；Enter/Esc 行为不变。
  - e2e：在真实编辑器聚焦日期时间的时/分输入框按 Tab，正文仍以 `---` 开头且属性面板不消失。
  - **数据面**: 无

## 2. 解析与识别

- [x] 2.1 frontmatter 容错解析与识别扩展
  - 交付物：`src/lib/frontmatter.ts` 新增 `parseLooseEntries` / `writeLooseFrontmatter` 与 `ParsedFrontmatter.yamlValid`，内置别称扩充，空值默认 `text`。
  - 验收要点：整块 YAML 失败时逐条顶层键兜底解析（模板文档识别字段数 ≥6）；单条失败保留原文按文本展示；不可解析块编辑只改写目标键连续行块、其余字节不变；空值类型 = `text`。
  - e2e：Obsidian 模板文档不再显示「0 个字段」；mdpkg 文档未识别键显著减少。
  - **数据面**: 校验（`normalizePropAliasMap` 八类枚举白名单）

## 3. 日期选择

- [x] 3.1 日期/日期时间选择器改版（含日期字段自绘）
  - 交付物：`src/components/Content/DocPropertyBar.tsx` 日期字段改用与日期时间同一自绘面板（仅日期），日期时间展示格式降密，标题切月/年视图，新增「今天」；`src/components/Content/useMenuPos.ts` 传宿主边界。
  - 验收要点：原生 `<input type="date">` 节点数 = 0；月格数 = 12；日期时间显示 `YYYY-MM-DD HH:mm`（秒为 00 省略）；日期提交 `YYYY-MM-DD`；窄宿主不溢出。
  - e2e：日期字段打开自绘面板；点标题「月」见 12 格；日期时间字段显示 `YYYY-MM-DD HH:mm`。
  - **数据面**: 规格（`docs/design/system/spec.md` §7.6 面板密度数值）

## 4. 头部与 footer

- [x] 4.1 面板头部/footer/图标（按钮顺序、计数对齐、锁图标、L/T 图标、全选图标、折叠条显隐）
  - 交付物：`src/components/Content/DocPropertyBar.tsx` 统一 A/B 按钮顺序与 footer，计数左缘对齐、锁图标缩小、折叠条显隐；`src/ui/icons.ts` 新增 `selectAll` 与 L/T 形态图标；`src/styles/doc-property.css` 配套样式。
  - 验收要点：两态按钮顺序一致且「添加字段」索引 = 0；footer 计数在日期之前；计数左缘与类型图标左缘偏差 ≤2px；锁图标 ≤12px；全选按钮前置图标。
  - e2e：A/B 两态标题右侧按钮顺序与 footer 顺序一致；折叠态 hover 显现、不用 `display:none`。
  - **数据面**: 规格,消费

## 5. 字段行

- [x] 5.1 字段行（居中、去类型文字、满行、字号跟随、删除悬停）
  - 交付物：`src/components/Content/DocPropertyBar.tsx` 删除行内类型文字、容器居中、满行编辑器、字号随正文；`src/styles/doc-property.css` 行高与删除叉号显隐。
  - 验收要点：行内类型文字节点数 = 0；类型图标/字段名/值中心差 ≤1px；文本/多行/列表/标签编辑器填满本行；⌘+/- 后字段名与值字号同步；删除叉号默认 opacity 0、悬停/聚焦/选中为 1。
  - e2e：⌘+/- 后字段名与值计算字号相等；hover 行删除叉号 opacity 为 1。
  - **数据面**: 规格,消费

## 6. 选中工具条

- [x] 6.1 选中操作条去色
  - 交付物：`src/styles/doc-property.css` 选中操作条改中性表面色、去强调色描边，按钮 hover 才反馈。
  - 验收要点：操作条背景色 ≠ 选中行高亮色；七个图标仍经 `iconSvg` 渲染；无 Unicode 字形文本。
  - e2e：选中若干字段行后操作条背景为中性表面色。
  - **数据面**: 规格,消费

## 7. 改名

- [x] 7.1 改名锁扩展名（页签 + 面板标题 + 另存为）
  - 交付物：新增 `src/lib/pathName.ts`（`splitStemExt` / `joinStemExt`）；`src/components/TabBar.tsx` 页签改名只承载主名、扩展名只读后缀；`DocPropertyBar` 标题字段剥扩展名；`App.tsx` 另存为预填名先剥后拼。
  - 验收要点：改名输入框内不出现扩展名；提交后标题仍以 `.md` 结尾；`.md.md` 出现次数 = 0；文件路径不变。
  - e2e：双击页签改名提交后标题以 `.md` 结尾；另存为输入 `x` 得 `x.md`。
  - **数据面**: 无
